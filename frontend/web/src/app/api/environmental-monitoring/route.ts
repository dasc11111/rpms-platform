import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 Art. 32: Regulated areas must be surveyed periodically.
// Measurement points and dose rate results are recorded here.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS env_monitoring_points (
      id            SERIAL PRIMARY KEY,
      point_code    TEXT        NOT NULL UNIQUE,
      point_name    TEXT        NOT NULL,
      location      TEXT,
      area_type     TEXT        NOT NULL DEFAULT 'controlled',
      reference_level_usvh NUMERIC(10,3),
      active        BOOLEAN     DEFAULT true,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS env_monitoring_records (
      id            SERIAL PRIMARY KEY,
      point_id      INTEGER     REFERENCES env_monitoring_points(id) ON DELETE CASCADE,
      point_code    TEXT        NOT NULL,
      measurement_date DATE     NOT NULL,
      measured_by   TEXT,
      instrument_id TEXT,
      dose_rate_usvh NUMERIC(10,3) NOT NULL,
      background_usvh NUMERIC(10,3),
      net_rate_usvh NUMERIC(10,3) GENERATED ALWAYS AS
                    (dose_rate_usvh - COALESCE(background_usvh, 0.1)) STORED,
      conditions    TEXT,
      status        TEXT GENERATED ALWAYS AS (
        CASE
          WHEN dose_rate_usvh > 100 THEN 'critical'
          WHEN dose_rate_usvh > 25  THEN 'high'
          WHEN dose_rate_usvh > 2.5 THEN 'elevated'
          ELSE 'normal'
        END
      ) STORED,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM env_monitoring_points LIMIT 1`;
  if (rows.length === 0) {
    // Seed measurement points
    await sql`
      INSERT INTO env_monitoring_points (point_code, point_name, location, area_type, reference_level_usvh)
      VALUES
        ('MN-01', 'Sala de Captación PET',   'Medicina Nuclear – Sala 1',      'controlled', 2.5),
        ('MN-02', 'Sala de Dosis I-131',      'Medicina Nuclear – Sala 2',      'controlled', 2.5),
        ('MN-03', 'Sala de Espera Pacientes', 'Medicina Nuclear – Acceso',      'supervised',  1.0),
        ('MN-04', 'Pasillo exterior MN',      'Corredor Hospital 2° piso',      'public',      0.5),
        ('RF-01', 'Sala de Isótopos',         'Radiofísica – Almacén fuentes',  'controlled', 2.5),
        ('RF-02', 'Sala de Calibración',      'Radiofísica – Lab',              'controlled', 2.5),
        ('LN-01', 'Sala de Tratamiento LINAC','Radioterapia – Búnker 1',        'controlled', 2.5),
        ('LN-02', 'Sala de Control LINAC',    'Radioterapia – Sala control',    'supervised',  1.0)
    `;
    // Seed recent measurements
    const { rows: points } = await sql`SELECT id, point_code FROM env_monitoring_points`;
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const dateStr = lastMonth.toISOString().slice(0, 10);
    for (const p of points) {
      const baseRate = p.point_code.startsWith("LN") ? 0.15 :
                       p.point_code.startsWith("MN") ? 0.3  : 0.2;
      const rate = (baseRate + Math.random() * 0.3).toFixed(3);
      await sql`
        INSERT INTO env_monitoring_records (point_id, point_code, measurement_date, measured_by, dose_rate_usvh, background_usvh)
        VALUES (${p.id}, ${p.point_code}, ${dateStr}, 'Encargado PR', ${rate}, 0.1)
      `;
    }
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const view   = searchParams.get("view") ?? "records";
  const year   = searchParams.get("year");
  const month  = searchParams.get("month");
  const status = searchParams.get("status");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  try {
    if (view === "points") {
      const { rows } = await sql`SELECT * FROM env_monitoring_points WHERE active = true ORDER BY area_type, point_code`;
      return NextResponse.json({ points: rows });
    }

    // Records view
    let rows;
    if (year && month && status) {
      ({ rows } = await sql`
        SELECT r.*, p.point_name, p.area_type, p.reference_level_usvh
        FROM env_monitoring_records r
        LEFT JOIN env_monitoring_points p ON p.id = r.point_id
        WHERE EXTRACT(YEAR FROM r.measurement_date) = ${parseInt(year)}
          AND EXTRACT(MONTH FROM r.measurement_date) = ${parseInt(month)}
          AND r.status = ${status}
        ORDER BY r.measurement_date DESC, r.point_code LIMIT ${limit}`);
    } else if (year && month) {
      ({ rows } = await sql`
        SELECT r.*, p.point_name, p.area_type, p.reference_level_usvh
        FROM env_monitoring_records r
        LEFT JOIN env_monitoring_points p ON p.id = r.point_id
        WHERE EXTRACT(YEAR FROM r.measurement_date) = ${parseInt(year)}
          AND EXTRACT(MONTH FROM r.measurement_date) = ${parseInt(month)}
        ORDER BY r.measurement_date DESC, r.point_code LIMIT ${limit}`);
    } else if (year) {
      ({ rows } = await sql`
        SELECT r.*, p.point_name, p.area_type, p.reference_level_usvh
        FROM env_monitoring_records r
        LEFT JOIN env_monitoring_points p ON p.id = r.point_id
        WHERE EXTRACT(YEAR FROM r.measurement_date) = ${parseInt(year)}
        ORDER BY r.measurement_date DESC, r.point_code LIMIT ${limit}`);
    } else {
      ({ rows } = await sql`
        SELECT r.*, p.point_name, p.area_type, p.reference_level_usvh
        FROM env_monitoring_records r
        LEFT JOIN env_monitoring_points p ON p.id = r.point_id
        ORDER BY r.measurement_date DESC, r.point_code LIMIT ${limit}`);
    }

    // Stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total_records,
        COUNT(DISTINCT point_code) AS points_measured,
        COUNT(*) FILTER (WHERE status = 'critical')  AS critical,
        COUNT(*) FILTER (WHERE status = 'high')      AS high,
        COUNT(*) FILTER (WHERE status = 'elevated')  AS elevated,
        COUNT(*) FILTER (WHERE status = 'normal')    AS normal,
        ROUND(AVG(dose_rate_usvh)::numeric, 3)       AS avg_rate,
        MAX(dose_rate_usvh)                          AS max_rate,
        MAX(measurement_date)                        AS last_survey
      FROM env_monitoring_records
    `;

    // Latest per point
    const { rows: latest } = await sql`
      SELECT DISTINCT ON (r.point_code)
        r.*, p.point_name, p.area_type, p.reference_level_usvh
      FROM env_monitoring_records r
      LEFT JOIN env_monitoring_points p ON p.id = r.point_id
      ORDER BY r.point_code, r.measurement_date DESC
    `;

    return NextResponse.json({ records: rows, stats: stats[0], latest_by_point: latest });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.point_code || !body.measurement_date || body.dose_rate_usvh == null) {
      return NextResponse.json({ error: "point_code, measurement_date y dose_rate_usvh son obligatorios" }, { status: 400 });
    }
    // Look up point_id
    const { rows: pts } = await sql`SELECT id FROM env_monitoring_points WHERE point_code = ${body.point_code}`;
    const point_id = pts[0]?.id ?? null;

    const { rows } = await sql`
      INSERT INTO env_monitoring_records
        (point_id, point_code, measurement_date, measured_by, instrument_id,
         dose_rate_usvh, background_usvh, conditions, notes)
      VALUES
        (${point_id}, ${body.point_code}, ${body.measurement_date},
         ${body.measured_by ?? null}, ${body.instrument_id ?? null},
         ${body.dose_rate_usvh}, ${body.background_usvh ?? 0.1},
         ${body.conditions ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ record: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM env_monitoring_records WHERE id = ${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
