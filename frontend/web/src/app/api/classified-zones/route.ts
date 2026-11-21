import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS classified_zones (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        zone_type TEXT NOT NULL CHECK (zone_type IN ('controlada','supervisada','libre')),
        location TEXT NOT NULL,
        service TEXT,
        dose_limit_msv NUMERIC(10,2),
        monitoring_frequency TEXT DEFAULT 'mensual',
        last_survey_date DATE,
        next_survey_date DATE,
        responsible TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
  } catch {
    // table already exists or DB unavailable
  }
}

export async function GET() {
  await ensureTable();
  try {
    const rows = await sql`
      SELECT * FROM classified_zones
      ORDER BY
        CASE zone_type
          WHEN 'controlada' THEN 1
          WHEN 'supervisada' THEN 2
          WHEN 'libre' THEN 3
        END,
        name
    `;
    return NextResponse.json(rows.rows);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  await ensureTable();
  try {
    const body = await req.json();
    const {
      name,
      zone_type,
      location,
      service,
      dose_limit_msv,
      monitoring_frequency,
      last_survey_date,
      next_survey_date,
      responsible,
      notes,
    } = body;

    if (!name || !zone_type || !location) {
      return NextResponse.json(
        { error: "Nombre, tipo de zona y ubicación son obligatorios" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO classified_zones (
        name, zone_type, location, service, dose_limit_msv,
        monitoring_frequency, last_survey_date, next_survey_date,
        responsible, notes
      ) VALUES (
        ${name}, ${zone_type}, ${location}, ${service ?? null},
        ${dose_limit_msv ?? null}, ${monitoring_frequency ?? "mensual"},
        ${last_survey_date ?? null}, ${next_survey_date ?? null},
        ${responsible ?? null}, ${notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al crear zona" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await ensureTable();
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const {
      name,
      zone_type,
      location,
      service,
      dose_limit_msv,
      monitoring_frequency,
      last_survey_date,
      next_survey_date,
      responsible,
      notes,
      status,
    } = fields;

    const result = await sql`
      UPDATE classified_zones SET
        name = COALESCE(${name ?? null}, name),
        zone_type = COALESCE(${zone_type ?? null}, zone_type),
        location = COALESCE(${location ?? null}, location),
        service = COALESCE(${service ?? null}, service),
        dose_limit_msv = COALESCE(${dose_limit_msv ?? null}, dose_limit_msv),
        monitoring_frequency = COALESCE(${monitoring_frequency ?? null}, monitoring_frequency),
        last_survey_date = COALESCE(${last_survey_date ?? null}, last_survey_date),
        next_survey_date = COALESCE(${next_survey_date ?? null}, next_survey_date),
        responsible = COALESCE(${responsible ?? null}, responsible),
        notes = COALESCE(${notes ?? null}, notes),
        status = COALESCE(${status ?? null}, status),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Zona no encontrada" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al actualizar zona" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await ensureTable();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    await sql`DELETE FROM classified_zones WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al eliminar zona" }, { status: 500 });
  }
}
