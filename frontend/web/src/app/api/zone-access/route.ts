import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS zone_access_log (
      id SERIAL PRIMARY KEY,
      zone_id INT,
      zone_name VARCHAR(200) NOT NULL,
      zone_type VARCHAR(20) DEFAULT 'controlada',
      person_name VARCHAR(200) NOT NULL,
      person_rut VARCHAR(20),
      person_role VARCHAR(100),
      entry_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      exit_datetime TIMESTAMPTZ,
      purpose VARCHAR(300),
      dosimeter_code VARCHAR(100),
      entry_dose_reading_usv NUMERIC(10,3),
      exit_dose_reading_usv NUMERIC(10,3),
      dose_received_usv NUMERIC(10,3),
      supervisor VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const summary = searchParams.get("summary");
    const zone = searchParams.get("zone");
    const open = searchParams.get("open"); // only open entries (no exit)
    const date = searchParams.get("date"); // filter by date YYYY-MM-DD

    if (summary === "1") {
      const { rows: stats } = await sql`
        SELECT
          COUNT(*)::int AS total_entries,
          COUNT(*) FILTER (WHERE exit_datetime IS NULL)::int AS currently_inside,
          COUNT(*) FILTER (WHERE DATE(entry_datetime) = CURRENT_DATE)::int AS today_entries,
          COUNT(DISTINCT person_rut) FILTER (WHERE DATE(entry_datetime) = CURRENT_DATE)::int AS today_unique_persons,
          COALESCE(SUM(dose_received_usv) FILTER (WHERE DATE(entry_datetime) = CURRENT_DATE), 0)::float AS today_dose_total_usv,
          COUNT(DISTINCT zone_name)::int AS zones_accessed
        FROM zone_access_log
        WHERE entry_datetime >= NOW() - INTERVAL '30 days'
      `;

      const { rows: inside } = await sql`
        SELECT person_name, person_rut, person_role, zone_name, zone_type,
               entry_datetime, purpose, dosimeter_code, supervisor
        FROM zone_access_log
        WHERE exit_datetime IS NULL
        ORDER BY entry_datetime DESC
        LIMIT 20
      `;

      return NextResponse.json({ stats: stats[0], currently_inside: inside });
    }

    const { rows } = open === "1"
      ? await sql`
          SELECT * FROM zone_access_log
          WHERE exit_datetime IS NULL
          ORDER BY entry_datetime DESC LIMIT 100
        `
      : zone
      ? await sql`
          SELECT * FROM zone_access_log
          WHERE zone_name ILIKE ${'%' + zone + '%'}
          ORDER BY entry_datetime DESC LIMIT 200
        `
      : date
      ? await sql`
          SELECT * FROM zone_access_log
          WHERE DATE(entry_datetime) = ${date}
          ORDER BY entry_datetime DESC LIMIT 200
        `
      : await sql`
          SELECT * FROM zone_access_log
          ORDER BY entry_datetime DESC LIMIT 200
        `;

    return NextResponse.json({ entries: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const action = body.action; // "entry" | "exit" | "new"

    if (action === "exit" && body.id) {
      // Record exit and calculate dose
      const exitTime = body.exit_datetime ?? new Date().toISOString();
      const exitReading = body.exit_dose_reading_usv ?? null;

      const { rows: existing } = await sql`
        SELECT entry_dose_reading_usv FROM zone_access_log WHERE id = ${body.id}
      `;
      const entryReading = existing[0]?.entry_dose_reading_usv ?? null;
      const doseReceived = (exitReading != null && entryReading != null)
        ? Math.max(0, exitReading - entryReading)
        : null;

      const { rows } = await sql`
        UPDATE zone_access_log SET
          exit_datetime = ${exitTime},
          exit_dose_reading_usv = ${exitReading},
          dose_received_usv = ${doseReceived},
          notes = COALESCE(${body.notes ?? null}, notes)
        WHERE id = ${body.id}
        RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    // New entry
    const {
      zone_id = null, zone_name, zone_type = "controlada",
      person_name, person_rut = null, person_role = null,
      entry_datetime = new Date().toISOString(),
      purpose = null, dosimeter_code = null,
      entry_dose_reading_usv = null, supervisor = null, notes = null,
    } = body;

    if (!zone_name || !person_name) {
      return NextResponse.json({ error: "zone_name y person_name son obligatorios" }, { status: 400 });
    }

    const { rows } = await sql`
      INSERT INTO zone_access_log (
        zone_id, zone_name, zone_type, person_name, person_rut, person_role,
        entry_datetime, purpose, dosimeter_code, entry_dose_reading_usv, supervisor, notes
      ) VALUES (
        ${zone_id}, ${zone_name}, ${zone_type}, ${person_name}, ${person_rut},
        ${person_role}, ${entry_datetime}, ${purpose}, ${dosimeter_code},
        ${entry_dose_reading_usv}, ${supervisor}, ${notes}
      )
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM zone_access_log WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, exit_datetime, exit_dose_reading_usv, notes } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`
      UPDATE zone_access_log SET
        exit_datetime          = COALESCE(${exit_datetime ? new Date(exit_datetime) : null}, exit_datetime),
        exit_dose_reading_usv  = COALESCE(${exit_dose_reading_usv ?? null}, exit_dose_reading_usv),
        notes                  = COALESCE(${notes ?? null}, notes)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
