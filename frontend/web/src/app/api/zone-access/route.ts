import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// §152 — Registro de acceso a zonas radiológicas
// Normativa: DS 3/1985 Arts. 32-35 · CCHEN NS-05.0 §6 · IAEA GSR Part 3 Req. 24

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS zone_access_log (
    id                      SERIAL PRIMARY KEY,
    zone_name               TEXT NOT NULL,
    zone_type               TEXT NOT NULL DEFAULT 'controlada',
    person_name             TEXT NOT NULL,
    person_rut              TEXT,
    person_role             TEXT,
    entry_datetime          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_datetime           TIMESTAMPTZ,
    purpose                 TEXT,
    dosimeter_code          TEXT,
    entry_dose_reading_usv  NUMERIC(10,2),
    exit_dose_reading_usv   NUMERIC(10,2),
    dose_received_usv       NUMERIC(10,2),
    supervisor              TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
  )`;

  const { rows } = await sql`SELECT COUNT(*) FROM zone_access_log`;
  if (Number(rows[0].count) === 0) {
    // Seed demo data
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(now); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await sql`INSERT INTO zone_access_log
      (zone_name, zone_type, person_name, person_rut, person_role, entry_datetime, exit_datetime,
       purpose, dosimeter_code, entry_dose_reading_usv, exit_dose_reading_usv, dose_received_usv, supervisor)
      VALUES
      ('Sala de Terapia LINAC 1', 'controlada', 'Dr. Carlos Mendoza', '12.345.678-9', 'Médico Radioterapia',
       ${now.toISOString()}, NULL,
       'Verificación configuración tratamiento', 'TLD-0042', 0.00, NULL, NULL, 'Físico Médico de turno'),

      ('Sala de Medicina Nuclear', 'controlada', 'TM. Ana Soto', '14.567.890-1', 'Tecnólogo Médico',
       ${new Date(now.getTime() - 2*3600000).toISOString()},
       ${new Date(now.getTime() - 1.5*3600000).toISOString()},
       'Administración I-131', 'TLD-0015', 2.10, 4.80, 2.70, 'Encargado PR'),

      ('Sala PET-CT', 'controlada', 'TM. Roberto Lagos', '15.678.901-2', 'Tecnólogo Médico',
       ${new Date(now.getTime() - 4*3600000).toISOString()},
       ${new Date(now.getTime() - 3*3600000).toISOString()},
       'Procedimiento PET-CT diagnóstico', 'TLD-0023', 0.50, 1.20, 0.70, 'Encargado PR'),

      ('Sala de Almacenamiento Transitorio', 'controlada', 'TM. María González', '16.789.012-3', 'Tecnólogo Médico',
       ${yesterday.toISOString()},
       ${new Date(yesterday.getTime() + 1.5*3600000).toISOString()},
       'Verificación contenedores residuos Tc-99m', 'TLD-0031', 1.50, 2.80, 1.30, 'Encargado PR'),

      ('Sala Radiología Intervencionista', 'controlada', 'Dr. Felipe Reyes', '11.234.567-8', 'Médico Radiólogo',
       ${yesterday.toISOString()},
       ${new Date(yesterday.getTime() + 3*3600000).toISOString()},
       'Procedimientos intervencionistas programados', 'TLD-0007', 3.20, 8.50, 5.30, 'Jefe Servicio'),

      ('Pasillo zona supervisada Radioterapia', 'supervisada', 'Of. Técnico Juan Pérez', '13.456.789-0', 'Oficial Técnico',
       ${twoDaysAgo.toISOString()},
       ${new Date(twoDaysAgo.getTime() + 0.5*3600000).toISOString()},
       'Mantención preventiva equipos de climatización', 'TLD-0098', 0.10, 0.30, 0.20, 'Encargado PR')
    `;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const summary = searchParams.get("summary") === "1";
    const date    = searchParams.get("date");
    const id      = searchParams.get("id");

    // Single record for edit
    if (id) {
      const { rows } = await sql`SELECT * FROM zone_access_log WHERE id = ${Number(id)}`;
      return NextResponse.json(rows[0] ?? null);
    }

    // Summary stats
    if (summary) {
      const { rows } = await sql`
        SELECT
          COUNT(*)                                                        AS total_entries,
          COUNT(*) FILTER (WHERE exit_datetime IS NULL)                   AS currently_inside,
          COUNT(*) FILTER (WHERE entry_datetime::date = CURRENT_DATE)     AS today_entries,
          COUNT(DISTINCT person_rut) FILTER (WHERE entry_datetime::date = CURRENT_DATE) AS today_unique_persons,
          COALESCE(SUM(dose_received_usv) FILTER (WHERE entry_datetime::date = CURRENT_DATE), 0) AS today_dose_total_usv,
          COUNT(DISTINCT zone_name) FILTER (WHERE entry_datetime::date = CURRENT_DATE) AS zones_accessed
        FROM zone_access_log
      `;
      return NextResponse.json(rows[0]);
    }

    // List with optional date filter
    let entries;
    if (date) {
      const result = await sql`
        SELECT * FROM zone_access_log
        WHERE entry_datetime::date = ${date}::date
        ORDER BY entry_datetime DESC
      `;
      entries = result.rows;
    } else {
      const result = await sql`
        SELECT * FROM zone_access_log
        ORDER BY entry_datetime DESC
        LIMIT 100
      `;
      entries = result.rows;
    }

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("zone-access GET:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const {
      zone_name, zone_type = "controlada", person_name, person_rut = null,
      person_role = null, entry_datetime = null, exit_datetime = null,
      purpose = null, dosimeter_code = null, entry_dose_reading_usv = null,
      exit_dose_reading_usv = null, dose_received_usv = null,
      supervisor = null, notes = null,
    } = body;

    if (!zone_name || !person_name) {
      return NextResponse.json({ error: "zone_name y person_name son requeridos" }, { status: 400 });
    }

    // Auto-calculate dose if both readings provided
    const calcDose = (entry_dose_reading_usv !== null && exit_dose_reading_usv !== null)
      ? exit_dose_reading_usv - entry_dose_reading_usv
      : dose_received_usv;

    const entryTs = entry_datetime ?? new Date().toISOString();

    const { rows } = await sql`
      INSERT INTO zone_access_log
        (zone_name, zone_type, person_name, person_rut, person_role,
         entry_datetime, exit_datetime, purpose, dosimeter_code,
         entry_dose_reading_usv, exit_dose_reading_usv, dose_received_usv, supervisor, notes)
      VALUES
        (${zone_name}, ${zone_type}, ${person_name}, ${person_rut}, ${person_role},
         ${entryTs}, ${exit_datetime},
         ${purpose}, ${dosimeter_code},
         ${entry_dose_reading_usv}, ${exit_dose_reading_usv}, ${calcDose}, ${supervisor}, ${notes})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("zone-access POST:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const body = await req.json();
    const fields = [
      "zone_name", "zone_type", "person_name", "person_rut", "person_role",
      "entry_datetime", "exit_datetime", "purpose", "dosimeter_code",
      "entry_dose_reading_usv", "exit_dose_reading_usv", "dose_received_usv",
      "supervisor", "notes",
    ];

    // Build update from provided fields only
    const updates: Record<string, any> = {};
    for (const f of fields) {
      if (f in body) updates[f] = body[f];
    }

    // Auto-recalculate dose if readings changed
    const { rows: current } = await sql`SELECT * FROM zone_access_log WHERE id = ${Number(id)}`;
    const rec = current[0];
    if (rec) {
      const entryReading = "entry_dose_reading_usv" in updates ? updates.entry_dose_reading_usv : rec.entry_dose_reading_usv;
      const exitReading  = "exit_dose_reading_usv"  in updates ? updates.exit_dose_reading_usv  : rec.exit_dose_reading_usv;
      if (entryReading !== null && exitReading !== null) {
        updates.dose_received_usv = Number(exitReading) - Number(entryReading);
      }
    }

    updates.updated_at = new Date().toISOString();

    // Manual parameterized update
    const { rows } = await sql`
      UPDATE zone_access_log SET
        zone_name               = COALESCE(${updates.zone_name             ?? null}, zone_name),
        zone_type               = COALESCE(${updates.zone_type             ?? null}, zone_type),
        person_name             = COALESCE(${updates.person_name           ?? null}, person_name),
        person_rut              = COALESCE(${updates.person_rut            ?? null}, person_rut),
        person_role             = COALESCE(${updates.person_role           ?? null}, person_role),
        entry_datetime          = COALESCE(${updates.entry_datetime        ?? null}::timestamptz, entry_datetime),
        exit_datetime           = ${updates.exit_datetime ?? null},
        purpose                 = COALESCE(${updates.purpose              ?? null}, purpose),
        dosimeter_code          = COALESCE(${updates.dosimeter_code        ?? null}, dosimeter_code),
        entry_dose_reading_usv  = COALESCE(${updates.entry_dose_reading_usv  ?? null}, entry_dose_reading_usv),
        exit_dose_reading_usv   = COALESCE(${updates.exit_dose_reading_usv   ?? null}, exit_dose_reading_usv),
        dose_received_usv       = COALESCE(${updates.dose_received_usv       ?? null}, dose_received_usv),
        supervisor              = COALESCE(${updates.supervisor              ?? null}, supervisor),
        notes                   = COALESCE(${updates.notes                   ?? null}, notes),
        updated_at              = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    return NextResponse.json(rows[0] ?? null);
  } catch (err) {
    console.error("zone-access PATCH:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    await sql`DELETE FROM zone_access_log WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("zone-access DELETE:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
