import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 MINSAL Art. 7 - Límites anuales de dosis efectiva (mSv)
const ANNUAL_LIMITS = {
  A: 50,  // Categoría A: 50 mSv/año
  B: 15,  // Categoría B: 15 mSv/año (conservador, límite efectivo 20 mSv promedio 5 años)
};
const INVESTIGACION_THRESHOLD = 0.3; // 30% del límite → umbral investigación

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_readings (
      id              SERIAL PRIMARY KEY,
      worker_rut      TEXT,
      worker_name     TEXT NOT NULL,
      dosimeter_type  TEXT DEFAULT 'TLD',
      period          TEXT NOT NULL,
      dose            NUMERIC(10,4) DEFAULT 0,
      dose_unit       TEXT DEFAULT 'mSv',
      status          TEXT DEFAULT 'read',
      body_region     TEXT DEFAULT 'whole_body',
      badge_number    TEXT,
      lab_report_id   TEXT,
      measured_at     DATE,
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (worker_name, period, dosimeter_type, body_region)
    )
  `;
  // Columnas adicionales para instalaciones que ya tienen la tabla base
  const cols = [
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS dose_unit TEXT DEFAULT 'mSv'",
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS body_region TEXT DEFAULT 'whole_body'",
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS badge_number TEXT",
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS lab_report_id TEXT",
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS measured_at DATE",
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE dosimetry_readings ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY",
  ];
  for (const c of cols) {
    try { await sql.unsafe(c); } catch { /* ya existe */ }
  }
}

export async function GET(request: Request) {
  await ensureTable();
  const { searchParams } = new URL(request.url);
  const rut    = searchParams.get("rut");
  const year   = searchParams.get("year");
  const period = searchParams.get("period");
  const summary = searchParams.get("summary");

  // Resumen anual por trabajador con alerta de límites
  if (summary === "1") {
    const y = year ?? new Date().getFullYear().toString();
    const { rows } = await sql`
      SELECT
        d.worker_rut,
        d.worker_name,
        w.category,
        SUM(d.dose) FILTER (WHERE d.body_region = 'whole_body' OR d.body_region IS NULL)::numeric(10,4) AS total_dose_wb,
        SUM(d.dose) FILTER (WHERE d.body_region = 'extremities')::numeric(10,4) AS total_dose_ext,
        COUNT(DISTINCT d.period) AS periods_measured,
        MAX(d.dose)  AS max_single_dose,
        MIN(d.period) AS first_period,
        MAX(d.period) AS last_period
      FROM dosimetry_readings d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      WHERE d.period LIKE ${y + '-%'} OR d.period LIKE ${'%/' + y}
        OR d.period LIKE ${y + '%'}
      GROUP BY d.worker_rut, d.worker_name, w.category
      ORDER BY total_dose_wb DESC NULLS LAST
    `;
    // Enrich with limit checks
    const enriched = rows.map((r: Record<string, unknown>) => {
      const cat = (r.category as string) ?? "B";
      const limit = ANNUAL_LIMITS[cat as "A" | "B"] ?? ANNUAL_LIMITS.B;
      const dose = Number(r.total_dose_wb ?? 0);
      const pct  = dose / limit;
      const alert =
        pct >= 1.0 ? "exceeded" :
        pct >= INVESTIGACION_THRESHOLD ? "warning" :
        "ok";
      return { ...r, annual_limit: limit, limit_pct: Math.round(pct * 1000) / 10, alert };
    });
    const exceeded = enriched.filter((r: Record<string, unknown>) => r.alert === "exceeded").length;
    const warning  = enriched.filter((r: Record<string, unknown>) => r.alert === "warning").length;
    return NextResponse.json({ year: y, workers: enriched, stats: { total: enriched.length, exceeded, warning } });
  }

  // Historial de un trabajador
  if (rut) {
    const { rows } = await sql`
      SELECT * FROM dosimetry_readings
      WHERE worker_rut = ${rut}
      ORDER BY period DESC, body_region
    `;
    return NextResponse.json({ readings: rows });
  }

  // Por período
  if (period) {
    const { rows } = await sql`
      SELECT d.*, w.category, w.service, w.role
      FROM dosimetry_readings d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      WHERE d.period = ${period}
      ORDER BY d.worker_name
    `;
    return NextResponse.json({ readings: rows });
  }

  // Listado general con filtro de año
  const y = year ?? new Date().getFullYear().toString();
  const { rows } = await sql`
    SELECT d.*, w.category, w.service
    FROM dosimetry_readings d
    LEFT JOIN workers w ON w.rut = d.worker_rut
    WHERE d.period LIKE ${y + '-%'}
       OR d.period LIKE ${'%/' + y}
       OR d.period LIKE ${y + '%'}
    ORDER BY d.period DESC, d.worker_name
    LIMIT 500
  `;
  return NextResponse.json({ readings: rows, year: y });
}

export async function POST(request: Request) {
  await ensureTable();
  const body = await request.json().catch(() => ({}));

  // Inserción individual
  if (body.worker_name && !Array.isArray(body.rows)) {
    const { rows } = await sql`
      INSERT INTO dosimetry_readings
        (worker_rut, worker_name, dosimeter_type, period, dose, dose_unit,
         status, body_region, badge_number, lab_report_id, measured_at, notes)
      VALUES
        (${body.worker_rut ?? null}, ${body.worker_name}, ${body.dosimeter_type ?? 'TLD'},
         ${body.period}, ${Number(body.dose ?? 0)}, ${body.dose_unit ?? 'mSv'},
         ${body.status ?? 'read'}, ${body.body_region ?? 'whole_body'},
         ${body.badge_number ?? null}, ${body.lab_report_id ?? null},
         ${body.measured_at ?? null}, ${body.notes ?? null})
      ON CONFLICT (worker_name, period, dosimeter_type, body_region) DO UPDATE SET
        dose = EXCLUDED.dose, status = EXCLUDED.status,
        worker_rut = EXCLUDED.worker_rut, badge_number = EXCLUDED.badge_number,
        lab_report_id = EXCLUDED.lab_report_id, measured_at = EXCLUDED.measured_at,
        notes = EXCLUDED.notes, updated_at = NOW()
      RETURNING *
    `;
    return NextResponse.json({ reading: rows[0] }, { status: 201 });
  }

  // Bulk import
  const rowsIn: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];
  let inserted = 0;
  for (const r of rowsIn) {
    const workerName = String(r.worker_name ?? r.worker ?? r.trabajador ?? "").trim();
    const period = String(r.period ?? r.periodo ?? "").trim();
    if (!workerName || !period) continue;
    await sql`
      INSERT INTO dosimetry_readings
        (worker_rut, worker_name, dosimeter_type, period, dose, status, body_region, badge_number)
      VALUES
        (${String(r.worker_rut ?? r.rut ?? "").trim() || null},
         ${workerName},
         ${String(r.dosimeter_type ?? r.tipo ?? 'TLD').trim()},
         ${period},
         ${Number(r.dose ?? r.dosis ?? 0)},
         ${String(r.status ?? 'read').trim()},
         ${String(r.body_region ?? 'whole_body').trim()},
         ${String(r.badge_number ?? "").trim() || null})
      ON CONFLICT (worker_name, period, dosimeter_type, body_region) DO UPDATE SET
        dose = EXCLUDED.dose, status = EXCLUDED.status,
        worker_rut = EXCLUDED.worker_rut, updated_at = NOW()
    `;
    inserted++;
  }
  return NextResponse.json({ ok: true, inserted });
}

export async function PATCH(request: Request) {
  await ensureTable();
  const body = await request.json().catch(() => ({}));
  const { id, ...fields } = body as {
    id: number;
    dose?: number;
    status?: string;
    badge_number?: string;
    lab_report_id?: string;
    measured_at?: string;
    notes?: string;
    dosimeter_type?: string;
    body_region?: string;
    period?: string;
  };
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const { rows } = await sql`
    UPDATE dosimetry_readings SET
      dose           = COALESCE(${fields.dose ?? null}, dose),
      status         = COALESCE(${fields.status ?? null}, status),
      badge_number   = COALESCE(${fields.badge_number ?? null}, badge_number),
      lab_report_id  = COALESCE(${fields.lab_report_id ?? null}, lab_report_id),
      measured_at    = COALESCE(${fields.measured_at ?? null}::date, measured_at),
      notes          = COALESCE(${fields.notes ?? null}, notes),
      dosimeter_type = COALESCE(${fields.dosimeter_type ?? null}, dosimeter_type),
      body_region    = COALESCE(${fields.body_region ?? null}, body_region),
      period         = COALESCE(${fields.period ?? null}, period),
      updated_at     = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ error: "Lectura no encontrada" }, { status: 404 });
  return NextResponse.json({ reading: rows[0] });
}

export async function DELETE(request: Request) {
  await ensureTable();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await sql`DELETE FROM dosimetry_readings WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
