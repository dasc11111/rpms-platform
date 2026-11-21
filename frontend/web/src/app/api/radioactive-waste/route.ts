import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS radioactive_waste (
      id SERIAL PRIMARY KEY,
      container_code VARCHAR(50) UNIQUE NOT NULL,
      nuclide VARCHAR(30) NOT NULL,
      category VARCHAR(20) DEFAULT 'llw',
      physical_state VARCHAR(10) DEFAULT 'solid',
      activity_bq_initial NUMERIC(16,2) NOT NULL,
      activity_reference_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      half_life_days NUMERIC(10,3),
      volume_liters NUMERIC(10,3) DEFAULT 0,
      mass_kg NUMERIC(10,3) DEFAULT 0,
      location VARCHAR(200),
      status VARCHAR(20) DEFAULT 'decay_waiting',
      estimated_release_date TIMESTAMPTZ,
      generated_by VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const { rows } = status
      ? await sql`
          SELECT id, container_code, nuclide, category, physical_state,
                 activity_bq_initial::float, activity_reference_date::text,
                 half_life_days::float, volume_liters::float, mass_kg::float,
                 location, status, estimated_release_date::text, generated_by, notes
          FROM radioactive_waste
          WHERE status = ${status}
          ORDER BY activity_bq_initial DESC
          LIMIT 500
        `
      : await sql`
          SELECT id, container_code, nuclide, category, physical_state,
                 activity_bq_initial::float, activity_reference_date::text,
                 half_life_days::float, volume_liters::float, mass_kg::float,
                 location, status, estimated_release_date::text, generated_by, notes
          FROM radioactive_waste
          WHERE status NOT IN ('disposed')
          ORDER BY
            CASE status WHEN 'storage' THEN 0 WHEN 'decay_waiting' THEN 1 WHEN 'ready_release' THEN 2 ELSE 3 END,
            activity_bq_initial DESC
          LIMIT 500
        `;
    return NextResponse.json({ containers: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { container_code, nuclide, category, physical_state, activity_bq_initial,
            activity_reference_date, half_life_days, volume_liters, mass_kg,
            location, status, estimated_release_date, generated_by, notes } = body;
    if (!container_code || !nuclide || !activity_bq_initial) {
      return NextResponse.json({ error: "container_code, nuclide y activity_bq_initial son obligatorios" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO radioactive_waste (
        container_code, nuclide, category, physical_state, activity_bq_initial,
        activity_reference_date, half_life_days, volume_liters, mass_kg,
        location, status, estimated_release_date, generated_by, notes
      ) VALUES (
        ${container_code}, ${nuclide}, ${category ?? "llw"}, ${physical_state ?? "solid"},
        ${Number(activity_bq_initial)},
        ${activity_reference_date ?? new Date().toISOString()}::timestamptz,
        ${half_life_days ?? null}, ${volume_liters ?? 0}, ${mass_kg ?? 0},
        ${location ?? null}, ${status ?? "decay_waiting"},
        ${estimated_release_date ?? null}::timestamptz,
        ${generated_by ?? null}, ${notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ container: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { id, container_code, nuclide, category, physical_state, activity_bq_initial,
            activity_reference_date, half_life_days, volume_liters, mass_kg,
            location, status, estimated_release_date, generated_by, notes } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`
      UPDATE radioactive_waste SET
        container_code          = COALESCE(${container_code ?? null}, container_code),
        nuclide                 = COALESCE(${nuclide ?? null}, nuclide),
        category                = COALESCE(${category ?? null}, category),
        physical_state          = COALESCE(${physical_state ?? null}, physical_state),
        activity_bq_initial     = COALESCE(${activity_bq_initial != null ? Number(activity_bq_initial) : null}, activity_bq_initial),
        activity_reference_date = COALESCE(${activity_reference_date ?? null}::timestamptz, activity_reference_date),
        half_life_days          = COALESCE(${half_life_days != null ? Number(half_life_days) : null}, half_life_days),
        volume_liters           = COALESCE(${volume_liters != null ? Number(volume_liters) : null}, volume_liters),
        mass_kg                 = COALESCE(${mass_kg != null ? Number(mass_kg) : null}, mass_kg),
        location                = COALESCE(${location ?? null}, location),
        status                  = COALESCE(${status ?? null}, status),
        estimated_release_date  = COALESCE(${estimated_release_date ?? null}::timestamptz, estimated_release_date),
        generated_by            = COALESCE(${generated_by ?? null}, generated_by),
        notes                   = COALESCE(${notes ?? null}, notes),
        updated_at              = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ error: "Contenedor no encontrado" }, { status: 404 });
    return NextResponse.json({ container: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await sql`UPDATE radioactive_waste SET status = 'disposed', updated_at = NOW() WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
