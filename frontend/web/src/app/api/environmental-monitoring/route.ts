// §156 — Monitoreo Ambiental Externo / Perimetral
// DS 3/1985 Arts. 38-42 · CCHEN NS-05.0 §8 · IAEA GSR Part 3 Req. 27
// Monitoreo de zonas no controladas: público, límites instalación, entorno perimetral

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// ─── Ensure tables ───────────────────────────────────────────────────────────

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS environmental_monitoring_points (
      id              SERIAL PRIMARY KEY,
      point_code      VARCHAR(20) NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      location        TEXT,
      point_type      VARCHAR(30) NOT NULL DEFAULT 'perimeter',
      -- Types: perimeter, public_area, effluent_air, effluent_liquid, soil, vegetation
      lat             NUMERIC(10,7),
      lng             NUMERIC(10,7),
      baseline_usvh   NUMERIC(8,4),
      alert_threshold_usvh  NUMERIC(8,4) DEFAULT 1.0,
      action_threshold_usvh NUMERIC(8,4) DEFAULT 2.5,
      frequency       VARCHAR(20) DEFAULT 'monthly',
      active          BOOLEAN DEFAULT TRUE,
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS environmental_readings (
      id              SERIAL PRIMARY KEY,
      point_id        INTEGER NOT NULL REFERENCES environmental_monitoring_points(id),
      reading_date    DATE NOT NULL,
      dose_rate_usvh  NUMERIC(8,4),
      cumulative_mSv  NUMERIC(8,4),
      instrument_code VARCHAR(30),
      measured_by     TEXT,
      weather         VARCHAR(60),
      anomaly         BOOLEAN DEFAULT FALSE,
      anomaly_note    TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const { rowCount } = await sql`SELECT 1 FROM environmental_monitoring_points LIMIT 1`;
  if (!rowCount) {
    // Seed monitoring points
    await sql`
      INSERT INTO environmental_monitoring_points
        (point_code, name, location, point_type, baseline_usvh, alert_threshold_usvh, action_threshold_usvh, frequency)
      VALUES
        ('PER-N',  'Límite norte instalación',      'Fachada norte, calle exterior',   'perimeter',    0.09, 0.50, 1.00, 'weekly'),
        ('PER-S',  'Límite sur instalación',         'Estacionamiento público sur',      'perimeter',    0.08, 0.50, 1.00, 'weekly'),
        ('PER-E',  'Límite este instalación',        'Calle lateral este',               'perimeter',    0.09, 0.50, 1.00, 'weekly'),
        ('PER-O',  'Límite oeste instalación',       'Edificio colindante oeste',        'perimeter',    0.09, 0.50, 1.00, 'weekly'),
        ('PUB-01', 'Sala de espera pública',         'Área de espera medicina nuclear',  'public_area',  0.10, 0.75, 1.50, 'daily'),
        ('PUB-02', 'Pasillo pacientes ambulatorios', 'Pasillo principal acceso público', 'public_area',  0.09, 0.75, 1.50, 'daily'),
        ('EFL-A1', 'Salida aire HVAC medicina nuclear', 'Extracción cuarto caliente',    'effluent_air', 0.11, 1.00, 2.50, 'weekly'),
        ('EFL-L1', 'Efluente líquido área caliente', 'Sistema drenaje radiactivo',      'effluent_liquid', 0.08, 0.50, 1.00, 'weekly')
    `;

    // Seed readings for the last 6 months
    const pointIds = await sql`SELECT id, point_code FROM environmental_monitoring_points`;

    const now = new Date();
    for (const point of pointIds.rows) {
      // Generate monthly readings for 6 months
      for (let m = 5; m >= 0; m--) {
        const readDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
        const baseRate = point.point_code.startsWith('PUB') ? 0.10 : 0.09;
        const reading = (baseRate + (Math.random() - 0.5) * 0.03).toFixed(4);
        const cumul   = (Number(reading) * 24 * 30 / 1000).toFixed(4); // approx monthly mSv

        await sql`
          INSERT INTO environmental_readings
            (point_id, reading_date, dose_rate_usvh, cumulative_mSv, instrument_code, measured_by, weather)
          VALUES
            (${point.id}, ${readDate.toISOString().split('T')[0]},
             ${reading}, ${cumul}, 'TLD-ENV-01',
             'TM. Diego Solís', 'Despejado')
        `;
      }
    }
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("point_id");
  const summary = searchParams.get("summary");

  if (summary) {
    // Return summary stats for dashboard
    const { rows: stats } = await sql`
      SELECT
        COUNT(DISTINCT mp.id) AS total_points,
        COUNT(DISTINCT mp.id) FILTER (WHERE mp.active) AS active_points,
        COUNT(r.id) FILTER (WHERE r.reading_date >= CURRENT_DATE - INTERVAL '30 days') AS readings_last_30d,
        COUNT(r.id) FILTER (WHERE r.anomaly) AS total_anomalies,
        MAX(r.dose_rate_usvh) AS max_rate_ever,
        ROUND(AVG(r.dose_rate_usvh)::numeric, 4) AS avg_rate
      FROM environmental_monitoring_points mp
      LEFT JOIN environmental_readings r ON r.point_id = mp.id
    `;

    // Points due for reading
    const { rows: due } = await sql`
      SELECT mp.point_code, mp.name, mp.frequency,
             MAX(r.reading_date) AS last_reading,
             CURRENT_DATE - MAX(r.reading_date) AS days_since
      FROM environmental_monitoring_points mp
      LEFT JOIN environmental_readings r ON r.point_id = mp.id
      WHERE mp.active = TRUE
      GROUP BY mp.id, mp.point_code, mp.name, mp.frequency
      HAVING MAX(r.reading_date) < CURRENT_DATE - INTERVAL '28 days'
         OR MAX(r.reading_date) IS NULL
      ORDER BY days_since DESC NULLS FIRST
      LIMIT 5
    `;

    return NextResponse.json({ stats: stats[0], due_points: due });
  }

  if (pointId) {
    // Single point detail with history
    const { rows: point } = await sql`SELECT * FROM environmental_monitoring_points WHERE id = ${Number(pointId)}`;
    if (!point.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { rows: readings } = await sql`
      SELECT * FROM environmental_readings WHERE point_id = ${Number(pointId)}
      ORDER BY reading_date DESC LIMIT 24
    `;
    return NextResponse.json({ point: point[0], readings });
  }

  // All points with latest reading
  const { rows } = await sql`
    SELECT
      mp.*,
      r.dose_rate_usvh AS latest_rate,
      r.cumulative_mSv AS latest_cumul,
      r.reading_date AS latest_reading_date,
      r.anomaly AS latest_anomaly,
      CURRENT_DATE - r.reading_date AS days_since_reading,
      CASE
        WHEN r.dose_rate_usvh >= mp.action_threshold_usvh THEN 'action'
        WHEN r.dose_rate_usvh >= mp.alert_threshold_usvh  THEN 'alert'
        ELSE 'normal'
      END AS alarm_level
    FROM environmental_monitoring_points mp
    LEFT JOIN LATERAL (
      SELECT * FROM environmental_readings
      WHERE point_id = mp.id ORDER BY reading_date DESC LIMIT 1
    ) r ON TRUE
    WHERE mp.active = TRUE
    ORDER BY
      CASE WHEN r.dose_rate_usvh >= mp.action_threshold_usvh THEN 0
           WHEN r.dose_rate_usvh >= mp.alert_threshold_usvh  THEN 1
           ELSE 2 END,
      mp.point_code
  `;

  return NextResponse.json({ points: rows });
}

// ─── POST: Add a reading ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();

  const { rows } = await sql`
    INSERT INTO environmental_readings
      (point_id, reading_date, dose_rate_usvh, cumulative_mSv, instrument_code, measured_by, weather, anomaly, anomaly_note)
    VALUES
      (${body.point_id}, ${body.reading_date}, ${body.dose_rate_usvh},
       ${body.cumulative_mSv ?? null}, ${body.instrument_code ?? null},
       ${body.measured_by ?? null}, ${body.weather ?? null},
       ${body.anomaly ?? false}, ${body.anomaly_note ?? null})
    RETURNING *
  `;

  // Check if reading exceeds thresholds
  const { rows: point } = await sql`
    SELECT alert_threshold_usvh, action_threshold_usvh FROM environmental_monitoring_points
    WHERE id = ${body.point_id}
  `;

  let alarm = "normal";
  if (point.length && body.dose_rate_usvh >= Number(point[0].action_threshold_usvh)) alarm = "action";
  else if (point.length && body.dose_rate_usvh >= Number(point[0].alert_threshold_usvh)) alarm = "alert";

  return NextResponse.json({ reading: rows[0], alarm }, { status: 201 });
}

// ─── PATCH: Add monitoring point ─────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    // Update existing point
    await sql`
      UPDATE environmental_monitoring_points SET
        name = COALESCE(${body.name ?? null}, name),
        location = COALESCE(${body.location ?? null}, location),
        alert_threshold_usvh = COALESCE(${body.alert_threshold_usvh ?? null}, alert_threshold_usvh),
        action_threshold_usvh = COALESCE(${body.action_threshold_usvh ?? null}, action_threshold_usvh),
        active = COALESCE(${body.active ?? null}, active),
        notes = COALESCE(${body.notes ?? null}, notes)
      WHERE id = ${Number(id)}
    `;
    const { rows } = await sql`SELECT * FROM environmental_monitoring_points WHERE id = ${Number(id)}`;
    return NextResponse.json({ point: rows[0] });
  }

  // Create new monitoring point
  const { rows } = await sql`
    INSERT INTO environmental_monitoring_points
      (point_code, name, location, point_type, baseline_usvh, alert_threshold_usvh, action_threshold_usvh, frequency, notes)
    VALUES
      (${body.point_code}, ${body.name}, ${body.location ?? null}, ${body.point_type ?? 'perimeter'},
       ${body.baseline_usvh ?? null}, ${body.alert_threshold_usvh ?? 1.0}, ${body.action_threshold_usvh ?? 2.5},
       ${body.frequency ?? 'monthly'}, ${body.notes ?? null})
    RETURNING *
  `;
  return NextResponse.json({ point: rows[0] }, { status: 201 });
}
