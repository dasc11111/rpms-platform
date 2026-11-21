import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS area_monitoring_records (
        id SERIAL PRIMARY KEY,
        zone_name TEXT NOT NULL,
        location TEXT NOT NULL,
        measurement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
        instrument_id INT,
        instrument_name TEXT,
        dose_rate_usv_h NUMERIC(10,3) NOT NULL,
        background_usv_h NUMERIC(10,3),
        net_dose_rate_usv_h NUMERIC(10,3),
        expected_annual_dose_msv NUMERIC(10,2),
        occupancy_factor NUMERIC(5,2) DEFAULT 1.0,
        notes TEXT,
        performed_by TEXT,
        result TEXT NOT NULL DEFAULT 'pass' CHECK (result IN ('pass','fail','review')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
  } catch { /* table already exists */ }
}

// Límites de tasa de dosis DS 3/1985 (a 40h/semana, 50 semanas = 2000h)
// controlada: >6 mSv/año → >3 μSv/h (recomendado)
// supervisada: 1-6 mSv/año → 0.5-3 μSv/h
// libre: <1 mSv/año → <0.5 μSv/h
// Fondo típico: 0.08-0.12 μSv/h

function classifyRate(usv_h: number, occupancyFactor: number): {
  zone_type: string;
  annual_estimate_msv: number;
  result: "pass" | "fail" | "review";
} {
  const annual = (usv_h * occupancyFactor * 2000) / 1000; // μSv/h → mSv/año (2000h trabajo)
  let zone_type = "libre";
  let result: "pass" | "fail" | "review" = "pass";

  if (annual >= 6) {
    zone_type = "controlada";
    result = "review";
  } else if (annual >= 1) {
    zone_type = "supervisada";
    result = "pass";
  }

  if (annual >= 20) result = "fail"; // supera límite ocupacional

  return { zone_type, annual_estimate_msv: Math.round(annual * 100) / 100, result };
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const zone = searchParams.get("zone");
  const days = parseInt(searchParams.get("days") ?? "90");

  try {
    if (zone) {
      const { rows } = await sql`
        SELECT * FROM area_monitoring_records
        WHERE zone_name = ${zone}
          AND measurement_date >= NOW() - (${days} || ' days')::interval
        ORDER BY measurement_date DESC
        LIMIT 100
      `;
      return NextResponse.json(rows);
    }

    // Latest measurement per zone
    const { rows } = await sql`
      SELECT DISTINCT ON (zone_name)
        id, zone_name, location, measurement_date,
        dose_rate_usv_h, expected_annual_dose_msv, result,
        performed_by, instrument_name, occupancy_factor, notes
      FROM area_monitoring_records
      ORDER BY zone_name, measurement_date DESC
    `;

    // Stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(DISTINCT zone_name) AS zones_monitored,
        COUNT(*) FILTER (WHERE result = 'fail') AS fail_count,
        COUNT(*) FILTER (WHERE result = 'review') AS review_count,
        COUNT(*) FILTER (WHERE measurement_date >= NOW() - INTERVAL '30 days') AS last_30_days,
        ROUND(MAX(dose_rate_usv_h)::numeric, 3) AS max_rate
      FROM area_monitoring_records
    `;

    return NextResponse.json({ records: rows, stats: stats[0] });
  } catch {
    return NextResponse.json({ records: [], stats: null });
  }
}

export async function POST(req: NextRequest) {
  await ensureTable();
  try {
    const body = await req.json();
    const {
      zone_name,
      location,
      measurement_date,
      instrument_name,
      dose_rate_usv_h,
      background_usv_h,
      occupancy_factor = 1.0,
      notes,
      performed_by,
    } = body;

    if (!zone_name || !location || dose_rate_usv_h == null) {
      return NextResponse.json({ error: "Zona, ubicación y tasa de dosis son obligatorios" }, { status: 400 });
    }

    const net = background_usv_h != null
      ? Math.max(0, parseFloat(dose_rate_usv_h) - parseFloat(background_usv_h))
      : parseFloat(dose_rate_usv_h);

    const classification = classifyRate(net, parseFloat(occupancy_factor));

    const result = await sql`
      INSERT INTO area_monitoring_records (
        zone_name, location, measurement_date, instrument_name,
        dose_rate_usv_h, background_usv_h, net_dose_rate_usv_h,
        expected_annual_dose_msv, occupancy_factor, notes, performed_by, result
      ) VALUES (
        ${zone_name}, ${location},
        ${measurement_date ? new Date(measurement_date) : new Date()},
        ${instrument_name ?? null},
        ${parseFloat(dose_rate_usv_h)},
        ${background_usv_h ? parseFloat(background_usv_h) : null},
        ${net},
        ${classification.annual_estimate_msv},
        ${parseFloat(occupancy_factor)},
        ${notes ?? null},
        ${performed_by ?? null},
        ${classification.result}
      )
      RETURNING *
    `;
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  try {
    await sql`DELETE FROM area_monitoring_records WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
