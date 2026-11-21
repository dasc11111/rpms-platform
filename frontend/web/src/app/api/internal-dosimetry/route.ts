import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 — Dosimetría Interna (Bioassay)
// Monitoreo de incorporación de radionúclidos por vía interna:
// inhalación, ingestión o absorción cutánea. Referencia: ICRP 103.
// Límite dosis efectiva comprometida: 20 mSv/año trabajador ocupacional.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS internal_dose_records (
      id              SERIAL PRIMARY KEY,
      worker_id       INT,
      worker_rut      TEXT,
      worker_name     TEXT,
      service         TEXT,
      measurement_date DATE NOT NULL,
      radionuclide    TEXT NOT NULL,
      pathway         TEXT NOT NULL DEFAULT 'inhalation',
      method          TEXT NOT NULL DEFAULT 'bioassay',
      measured_value  NUMERIC(14,4),
      measured_unit   TEXT DEFAULT 'Bq',
      intake_bq       NUMERIC(14,2),
      committed_dose_msv NUMERIC(10,4),
      dcf_sv_bq       NUMERIC(20,15),
      fraction_alimit NUMERIC(8,4),
      annual_limit_bq NUMERIC(14,2),
      notes           TEXT,
      performed_by    TEXT,
      status          TEXT NOT NULL DEFAULT 'final',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM internal_dose_records LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    // DCF para I-131 inhalación: 7.4e-9 Sv/Bq (ICRP 68)
    // DCF para Tc-99m inhalación: 2.0e-11 Sv/Bq
    // DCF para F-18 inhalación: 2.4e-11 Sv/Bq
    await sql`
      INSERT INTO internal_dose_records
        (worker_name, worker_rut, service, measurement_date, radionuclide, pathway, method,
         measured_value, measured_unit, intake_bq, dcf_sv_bq, committed_dose_msv,
         annual_limit_bq, fraction_alimit, status, performed_by)
      VALUES
        ('María González', '12.345.678-9', 'Medicina Nuclear',
         ${`${y}-03-15`}, 'I-131', 'inhalation', 'thyroid_counting',
         1200, 'Bq', 1200, 7.4e-9, 0.009, 270270, 0.0044, 'final', 'Encargado PR'),
        ('Carlos Muñoz', '14.567.890-1', 'Medicina Nuclear',
         ${`${y}-06-20`}, 'I-131', 'inhalation', 'thyroid_counting',
         850, 'Bq', 850, 7.4e-9, 0.006, 270270, 0.0031, 'final', 'Encargado PR'),
        ('Ana Reyes', '15.678.901-2', 'Radiofarmacia',
         ${`${y}-09-05`}, 'Tc-99m', 'inhalation', 'bioassay',
         45000, 'Bq', 45000, 2.0e-11, 0.001, 50000000, 0.0009, 'final', 'Encargado PR')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const year      = searchParams.get("year");
  const worker    = searchParams.get("worker");
  const nuclide   = searchParams.get("nuclide");

  try {
    let rows;
    if (year && worker && nuclide) {
      ({ rows } = await sql`SELECT * FROM internal_dose_records WHERE EXTRACT(YEAR FROM measurement_date)=${parseInt(year)} AND worker_rut ILIKE ${`%${worker}%`} AND radionuclide ILIKE ${`%${nuclide}%`} ORDER BY measurement_date DESC`);
    } else if (year && worker) {
      ({ rows } = await sql`SELECT * FROM internal_dose_records WHERE EXTRACT(YEAR FROM measurement_date)=${parseInt(year)} AND worker_rut ILIKE ${`%${worker}%`} ORDER BY measurement_date DESC`);
    } else if (year && nuclide) {
      ({ rows } = await sql`SELECT * FROM internal_dose_records WHERE EXTRACT(YEAR FROM measurement_date)=${parseInt(year)} AND radionuclide ILIKE ${`%${nuclide}%`} ORDER BY measurement_date DESC`);
    } else if (year) {
      ({ rows } = await sql`SELECT * FROM internal_dose_records WHERE EXTRACT(YEAR FROM measurement_date)=${parseInt(year)} ORDER BY measurement_date DESC`);
    } else {
      ({ rows } = await sql`SELECT * FROM internal_dose_records ORDER BY measurement_date DESC LIMIT 200`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT worker_rut) AS workers_tested,
        ROUND(SUM(committed_dose_msv)::numeric, 4) AS total_committed_msv,
        ROUND(MAX(committed_dose_msv)::numeric, 4) AS max_single_msv,
        ROUND(MAX(fraction_alimit)::numeric, 4) AS max_fraction,
        COUNT(*) FILTER (WHERE fraction_alimit > 0.1) AS above_10pct,
        COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM measurement_date) = EXTRACT(YEAR FROM now())) AS this_year
      FROM internal_dose_records
    `;

    const { rows: byWorker } = await sql`
      SELECT worker_rut, worker_name, service,
             SUM(committed_dose_msv)::numeric AS annual_committed_msv,
             COUNT(*) AS measurements,
             MAX(measurement_date) AS last_measurement
      FROM internal_dose_records
      WHERE EXTRACT(YEAR FROM measurement_date) = EXTRACT(YEAR FROM now())
      GROUP BY worker_rut, worker_name, service
      ORDER BY annual_committed_msv DESC
    `;

    const { rows: years } = await sql`SELECT DISTINCT EXTRACT(YEAR FROM measurement_date)::int AS y FROM internal_dose_records ORDER BY y DESC`;
    const { rows: nuclides } = await sql`SELECT DISTINCT radionuclide FROM internal_dose_records ORDER BY radionuclide`;

    return NextResponse.json({
      records: rows, stats: stats[0], byWorker, years: years.map(r => r.y),
      nuclides: nuclides.map(r => r.radionuclide),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.measurement_date || !body.radionuclide) {
      return NextResponse.json({ error: "measurement_date y radionuclide requeridos" }, { status: 400 });
    }
    // Compute committed_dose_msv = intake_bq * dcf_sv_bq * 1000
    let committed = body.committed_dose_msv ?? null;
    if (committed == null && body.intake_bq && body.dcf_sv_bq) {
      committed = parseFloat(body.intake_bq) * parseFloat(body.dcf_sv_bq) * 1000;
    }
    // fraction = committed_dose_msv / 20 (20 mSv annual limit)
    const fraction = committed != null ? committed / 20 : null;

    const { rows } = await sql`
      INSERT INTO internal_dose_records
        (worker_id, worker_rut, worker_name, service, measurement_date, radionuclide,
         pathway, method, measured_value, measured_unit, intake_bq, committed_dose_msv,
         dcf_sv_bq, fraction_alimit, annual_limit_bq, notes, performed_by, status)
      VALUES
        (${body.worker_id ?? null}, ${body.worker_rut ?? null}, ${body.worker_name ?? null},
         ${body.service ?? null}, ${body.measurement_date}, ${body.radionuclide},
         ${body.pathway ?? "inhalation"}, ${body.method ?? "bioassay"},
         ${body.measured_value ?? null}, ${body.measured_unit ?? "Bq"},
         ${body.intake_bq ?? null}, ${committed}, ${body.dcf_sv_bq ?? null},
         ${fraction}, ${body.annual_limit_bq ?? null}, ${body.notes ?? null},
         ${body.performed_by ?? null}, ${body.status ?? "final"})
      RETURNING *
    `;
    return NextResponse.json({ record: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["worker_rut","worker_name","service","measurement_date","radionuclide",
      "pathway","method","measured_value","measured_unit","intake_bq","committed_dose_msv",
      "dcf_sv_bq","fraction_alimit","annual_limit_bq","notes","performed_by","status"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(`UPDATE internal_dose_records SET ${sets} WHERE id=$1 RETURNING *`, vals);
    return NextResponse.json({ record: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM internal_dose_records WHERE id=${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
