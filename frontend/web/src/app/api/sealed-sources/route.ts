// §157 — Gestión de Fuentes Radiactivas Selladas
// DS 3/1985 Arts. 55-62 · CCHEN NS-05.0 §5 · IAEA SSG-32
// Registro, control de actividad, verificación de integridad, retiro
// Categorías IAEA: 1 (mayor riesgo) a 5 (menor riesgo)

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS sealed_sources (
      id                    SERIAL PRIMARY KEY,
      source_id_cchen       VARCHAR(40) UNIQUE,
      serial_number         VARCHAR(40),
      radionuclide          VARCHAR(20) NOT NULL,
      half_life_days        NUMERIC(12,2),
      reference_activity_GBq NUMERIC(14,4) NOT NULL,
      reference_date        DATE NOT NULL,
      iaea_category         INTEGER CHECK (iaea_category BETWEEN 1 AND 5),
      manufacturer          TEXT,
      model                 TEXT,
      encapsulation_type    VARCHAR(40),
      location              TEXT,
      equipment_associated  TEXT,
      purpose               VARCHAR(60),
      -- Dates
      manufacture_date      DATE,
      acquisition_date      DATE,
      license_expiry        DATE,
      last_leak_test_date   DATE,
      next_leak_test_date   DATE,
      -- Status
      status                VARCHAR(20) NOT NULL DEFAULT 'active',
      -- status: active, stored, in_use, withdrawn, returned_cchen, lost
      condition             VARCHAR(20) DEFAULT 'good',
      -- condition: good, damaged, suspect_leak, decommissioned
      notes                 TEXT,
      created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sealed_source_events (
      id          SERIAL PRIMARY KEY,
      source_id   INTEGER NOT NULL REFERENCES sealed_sources(id),
      event_type  VARCHAR(30) NOT NULL,
      -- event types: leak_test, inventory_check, transfer, condition_change, return_cchen
      event_date  DATE NOT NULL,
      result      VARCHAR(20),
      -- result: pass, fail, suspect
      measured_by TEXT,
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const { rowCount } = await sql`SELECT 1 FROM sealed_sources LIMIT 1`;
  if (!rowCount) {
    const refDate = new Date();
    refDate.setFullYear(refDate.getFullYear() - 1);

    await sql`
      INSERT INTO sealed_sources
        (source_id_cchen, serial_number, radionuclide, half_life_days,
         reference_activity_GBq, reference_date, iaea_category,
         manufacturer, model, encapsulation_type, location, equipment_associated, purpose,
         acquisition_date, license_expiry, last_leak_test_date, next_leak_test_date, status)
      VALUES
        ('CCHEN-MN-2021-TC-001', 'TC-MO-2021-A', 'Mo-99/Tc-99m', 2.75,
         11.1, ${refDate.toISOString().split('T')[0]}, 4,
         'Bracco', 'UltraGen®', 'Generador', 'Sala caliente MN', 'Generador Tc-99m', 'Diagnóstico medicina nuclear',
         '2021-01-15', ${new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0]}, 'active'),

        ('CCHEN-MN-2019-I131-003', 'I131-ther-003', 'I-131', 8.02,
         3.7, ${refDate.toISOString().split('T')[0]}, 3,
         'Polatom', 'sodium iodide capsules', 'Cápsula sellada', 'Almacenamiento blindado MN', 'Terapia tiroidea', 'Terapia de tiroides',
         '2019-06-01', ${new Date(new Date().getFullYear() + 2, 5, 30).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0]}, 'active'),

        ('CCHEN-RT-2018-CS137-001', 'CS137-cal-001', 'Cs-137', 10980,
         0.037, '2018-01-01', 2,
         'QSA Global', 'IRE Type D', 'Doble encapsulación acero inox', 'Almacenamiento RT', 'Equipo de calibración', 'Calibración detectores',
         '2018-03-20', ${new Date(new Date().getFullYear() - 1, 2, 19).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]}, 'stored'),

        ('CCHEN-NM-2022-GA67-002', 'GA67-diag-002', 'Ga-67', 3.26,
         0.37, ${refDate.toISOString().split('T')[0]}, 4,
         'GE Healthcare', 'Gallium Citrate', 'Ampolla sellada', 'Sala caliente MN', 'Gammagrafía', 'Gammagrafía tumoral',
         '2022-11-10', ${new Date(new Date().getFullYear() + 1, 10, 9).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0]}, 'active'),

        ('CCHEN-PET-2023-F18-001', 'F18-pet-001', 'F-18', 0.076,
         185.0, ${refDate.toISOString().split('T')[0]}, 3,
         'TRIUMF / local cyclotron', 'FDG', 'Vial blindado', 'Sala PET-CT', 'PET-CT oncológico', 'Diagnóstico PET-CT',
         '2023-01-05', ${new Date(new Date().getFullYear() + 1, 0, 4).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0]}, 'active'),

        ('CCHEN-LU-2023-LU177-001', 'LU177-ther-001', 'Lu-177', 6.65,
         7.4, ${refDate.toISOString().split('T')[0]}, 3,
         'ITG Munich', 'PSMA-617 / DOTATATE', 'Vial sellado', 'Sala caliente MN', 'Lutetium-177 PRRT', 'Terapia radionuclídica',
         '2023-05-20', ${new Date(new Date().getFullYear() + 2, 4, 19).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]},
         ${new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0]}, 'active')
    `;

    // Seed leak tests for each source
    const sources = await sql`SELECT id FROM sealed_sources`;
    for (const src of sources.rows) {
      await sql`
        INSERT INTO sealed_source_events (source_id, event_type, event_date, result, measured_by, notes)
        VALUES
          (${src.id}, 'leak_test', CURRENT_DATE - INTERVAL '60 days', 'pass', 'TM. Diego Solís', 'Sin contaminación detectable. < 185 Bq criterio IAEA'),
          (${src.id}, 'inventory_check', CURRENT_DATE - INTERVAL '30 days', 'pass', 'TM. Diego Solís', 'Inventario físico conforme al registro CCHEN')
      `;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decayedActivity(initialGBq: number, halfLifeDays: number, refDate: string): number {
  const days = (Date.now() - new Date(refDate).getTime()) / 86400000;
  return initialGBq * Math.pow(0.5, days / halfLifeDays);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const summary = searchParams.get("summary");

  if (summary) {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' OR status = 'in_use') AS active_sources,
        COUNT(*) FILTER (WHERE status = 'stored') AS stored_sources,
        COUNT(*) FILTER (WHERE condition = 'suspect_leak' OR condition = 'damaged') AS suspect_sources,
        COUNT(*) FILTER (WHERE license_expiry < CURRENT_DATE) AS expired_license,
        COUNT(*) FILTER (WHERE next_leak_test_date < CURRENT_DATE AND status NOT IN ('withdrawn','returned_cchen')) AS overdue_leak_test,
        COUNT(*) FILTER (WHERE iaea_category <= 2) AS high_category_sources
      FROM sealed_sources
    `;
    return NextResponse.json({ stats: rows[0] });
  }

  if (id) {
    const { rows: source } = await sql`SELECT * FROM sealed_sources WHERE id = ${Number(id)}`;
    if (!source.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { rows: events } = await sql`
      SELECT * FROM sealed_source_events WHERE source_id = ${Number(id)} ORDER BY event_date DESC LIMIT 20
    `;
    // Compute current activity
    const s = source[0];
    const currentActivity = s.half_life_days
      ? decayedActivity(Number(s.reference_activity_GBq), Number(s.half_life_days), s.reference_date)
      : Number(s.reference_activity_GBq);
    return NextResponse.json({ source: { ...s, current_activity_GBq: currentActivity.toFixed(4) }, events });
  }

  const { rows } = await sql`
    SELECT s.*,
      (SELECT MAX(event_date) FROM sealed_source_events WHERE source_id = s.id AND event_type = 'leak_test') AS last_leak_test_actual,
      (SELECT result FROM sealed_source_events WHERE source_id = s.id AND event_type = 'leak_test' ORDER BY event_date DESC LIMIT 1) AS last_leak_test_result
    FROM sealed_sources s
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'in_use' THEN 1 WHEN 'stored' THEN 2 ELSE 3 END,
      iaea_category ASC,
      radionuclide
  `;

  // Add computed current activity
  const withActivity = rows.map(s => ({
    ...s,
    current_activity_GBq: s.half_life_days
      ? decayedActivity(Number(s.reference_activity_GBq), Number(s.half_life_days), s.reference_date).toFixed(4)
      : Number(s.reference_activity_GBq).toFixed(4),
    leak_test_overdue: s.next_leak_test_date && new Date(s.next_leak_test_date) < new Date() && !['withdrawn','returned_cchen'].includes(s.status),
    license_expired: s.license_expiry && new Date(s.license_expiry) < new Date(),
  }));

  return NextResponse.json({ sources: withActivity });
}

// ─── POST: Create source ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();

  const { rows } = await sql`
    INSERT INTO sealed_sources
      (source_id_cchen, serial_number, radionuclide, half_life_days,
       reference_activity_GBq, reference_date, iaea_category,
       manufacturer, model, encapsulation_type, location, equipment_associated, purpose,
       manufacture_date, acquisition_date, license_expiry, last_leak_test_date, next_leak_test_date,
       status, notes)
    VALUES
      (${body.source_id_cchen ?? null}, ${body.serial_number ?? null},
       ${body.radionuclide}, ${body.half_life_days ?? null},
       ${body.reference_activity_GBq}, ${body.reference_date},
       ${body.iaea_category ?? null}, ${body.manufacturer ?? null},
       ${body.model ?? null}, ${body.encapsulation_type ?? null},
       ${body.location ?? null}, ${body.equipment_associated ?? null}, ${body.purpose ?? null},
       ${body.manufacture_date ?? null}, ${body.acquisition_date ?? null},
       ${body.license_expiry ?? null}, ${body.last_leak_test_date ?? null},
       ${body.next_leak_test_date ?? null},
       ${'active'}, ${body.notes ?? null})
    RETURNING *
  `;

  return NextResponse.json({ source: rows[0] }, { status: 201 });
}

// ─── PATCH: Update source or add event ───────────────────────────────────────

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();

  if (body.event_type) {
    // Add event
    const { rows } = await sql`
      INSERT INTO sealed_source_events (source_id, event_type, event_date, result, measured_by, notes)
      VALUES (${Number(id)}, ${body.event_type}, ${body.event_date}, ${body.result ?? null}, ${body.measured_by ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    // If leak test, update dates
    if (body.event_type === 'leak_test') {
      await sql`
        UPDATE sealed_sources SET
          last_leak_test_date = ${body.event_date},
          condition = CASE WHEN ${body.result} = 'fail' THEN 'suspect_leak' ELSE condition END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${Number(id)}
      `;
    }
    return NextResponse.json({ event: rows[0] });
  }

  // Update source fields
  await sql`
    UPDATE sealed_sources SET
      status    = COALESCE(${body.status ?? null}, status),
      condition = COALESCE(${body.condition ?? null}, condition),
      location  = COALESCE(${body.location ?? null}, location),
      next_leak_test_date = COALESCE(${body.next_leak_test_date ?? null}, next_leak_test_date),
      license_expiry = COALESCE(${body.license_expiry ?? null}, license_expiry),
      notes = COALESCE(${body.notes ?? null}, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${Number(id)}
  `;

  const { rows } = await sql`SELECT * FROM sealed_sources WHERE id = ${Number(id)}`;
  return NextResponse.json({ source: rows[0] });
}
