import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS radioactive_sources (
      id SERIAL PRIMARY KEY,
      source_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      radionuclide TEXT NOT NULL,
      source_type TEXT DEFAULT 'sealed' CHECK (source_type IN ('sealed','unsealed','generator','device')),
      physical_form TEXT,
      activity_bq NUMERIC(20,4),
      activity_unit TEXT DEFAULT 'GBq',
      activity_date DATE,
      half_life_days NUMERIC(10,4),
      manufacturer TEXT,
      serial_number TEXT,
      model TEXT,
      use_category TEXT,
      location TEXT,
      storage_location TEXT,
      custodian TEXT,
      authorized_use TEXT,
      cchen_registration TEXT,
      cchen_registration_expiry DATE,
      license_number TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','in_use','storage','maintenance','transfer','decommissioned','lost')),
      condition_status TEXT DEFAULT 'good' CHECK (condition_status IN ('good','acceptable','damaged','contaminated','unknown')),
      last_inventory_date DATE,
      next_inventory_date DATE,
      last_leak_test_date DATE,
      next_leak_test_date DATE,
      leak_test_result TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS source_movements (
      id SERIAL PRIMARY KEY,
      source_id INTEGER REFERENCES radioactive_sources(id) ON DELETE CASCADE,
      movement_type TEXT CHECK (movement_type IN ('transfer_in','transfer_out','use','return','inventory','leak_test','maintenance','disposal')),
      from_location TEXT,
      to_location TEXT,
      movement_date TIMESTAMPTZ DEFAULT NOW(),
      performed_by TEXT,
      authorized_by TEXT,
      purpose TEXT,
      activity_bq NUMERIC(20,4),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const count = await sql`SELECT COUNT(*) as n FROM radioactive_sources`;
  if (Number(count[0].n) === 0) {
    await sql`
      INSERT INTO radioactive_sources (
        source_code, name, radionuclide, source_type, physical_form,
        activity_bq, activity_unit, activity_date, half_life_days,
        manufacturer, serial_number, model, use_category, location, storage_location,
        custodian, cchen_registration, cchen_registration_expiry, license_number,
        status, condition_status, last_inventory_date, next_inventory_date,
        last_leak_test_date, next_leak_test_date, leak_test_result, notes
      ) VALUES
      (
        'FS-001', 'Fuente de calibración Am-241', 'Am-241', 'sealed', 'Cápsula metálica',
        3.7e4, 'kBq', '2020-01-01', 157861.5,
        'Amersham', 'AME-2020-0045', 'Calibration Source Type A', 'Calibración',
        'Lab Física Médica', 'Caja blindada LFM', 'Diego Solís Catalán',
        'REG-CCHEN-2020-0123', '2026-01-01', 'LIC-MN-0045',
        'storage', 'good', '2024-10-15', '2025-04-15',
        '2024-10-15', '2025-04-15', 'No detectada', 'Fuente de referencia para calibración de detectores'
      ),
      (
        'FS-002', 'Fuente lineal Co-57 escáner', 'Co-57', 'sealed', 'Fuente lineal',
        2.775e8, 'MBq', '2024-01-15', 271.74,
        'Eckert & Ziegler', 'EZ-CO57-2024-012', 'LineSource Co-57', 'Medicina Nuclear',
        'Sala Gamma Cámara', 'Dentro de equipo gammacámara', 'Roberto Soto Álvarez',
        'REG-CCHEN-2024-0456', '2026-06-15', 'LIC-MN-0045',
        'in_use', 'good', '2024-11-01', '2025-05-01',
        '2024-07-15', '2025-01-15', 'No detectada', 'Fuente de control calidad gammacámara Siemens'
      ),
      (
        'FS-003', 'Fuente puntual Cs-137', 'Cs-137', 'sealed', 'Cápsula cerámica',
        3.7e5, 'kBq', '2015-06-01', 11023.14,
        'Eckert & Ziegler', 'EZ-CS137-2015-089', 'Point Source Cs-137', 'Control calidad',
        'Lab Física Médica', 'Contenedor plomado LFM-3', 'Diego Solís Catalán',
        'REG-CCHEN-2015-0789', '2025-06-01', 'LIC-FIS-0012',
        'storage', 'good', '2024-10-15', '2025-04-15',
        '2024-10-15', '2026-10-15', 'No detectada', 'Control calidad detectores y medidores'
      ),
      (
        'FS-004', 'Generador Tc-99m Molybdeno-99', 'Mo-99/Tc-99m', 'generator', 'Generador de radionúclidos',
        2.22e10, 'MBq', '2024-11-18', 2.749,
        'Nordion', 'NOR-2024-W47-003', 'TechneLite Generator', 'Medicina Nuclear diagnóstica',
        'Radiofarmacia', 'Blindaje específico radiofarmacia', 'Carmen López Fuentes',
        'REG-CCHEN-2024-W47', '2024-12-02', 'LIC-MN-0045',
        'in_use', 'good', '2024-11-18', '2024-11-25',
        NULL, NULL, NULL, 'Generador semana 47. Vence 02-Dic-2024. Eluciones diarias 7:30h'
      ),
      (
        'FS-005', 'Fuente sellada Ir-192 braquiterapia', 'Ir-192', 'sealed', 'Cápsula metálica HDR',
        3.7e11, 'GBq', '2024-10-01', 73.83,
        'Elekta', 'ELK-IR192-2024-Q4-07', 'microSelectron HDR v3', 'Braquiterapia HDR',
        'Sala Braquiterapia', 'Unidad HDR (cargada)', 'Dr. Carlos Pérez Muñoz',
        'REG-CCHEN-2024-0901', '2025-01-01', 'LIC-RAD-0078',
        'in_use', 'good', '2024-11-01', '2024-12-01',
        NULL, NULL, NULL, 'Fuente HDR activa. Próximo cambio fuente enero 2025. Verificar actividad semanal.'
      ),
      (
        'FS-006', 'Fuente Ra-226 histórica (descomisionada)', 'Ra-226', 'sealed', 'Aguja Ra antigua',
        3.7e4, 'kBq', '1980-01-01', 585620.0,
        'Desconocido', 'HIST-RA226-001', 'Aguja Ra-226 legacy', 'Sin uso activo',
        'Bodega blindada SSAS', 'Contenedor especial Ra-226', 'Diego Solís Catalán',
        'REG-CCHEN-HIST-001', '2025-12-31', 'LIC-HIST-001',
        'decommissioned', 'acceptable', '2024-06-01', '2025-06-01',
        '2020-06-01', '2026-06-01', 'No detectada', 'Fuente histórica en gestión de residuos. Pendiente disposición final CCHEN'
      ),
      (
        'FS-007', 'Fuente Ga-67 vial diagnóstico', 'Ga-67', 'unsealed', 'Solución inyectable',
        1.85e8, 'MBq', '2024-11-20', 3.261,
        'Positron', 'POS-GA67-2024-320', 'Galio-67 citrato inyectable', 'Medicina Nuclear',
        'Radiofarmacia', 'Blindaje Ra-67 RF', 'Carmen López Fuentes',
        'REG-CCHEN-2024-GA67', '2024-11-27', 'LIC-MN-0045',
        'storage', 'good', '2024-11-20', '2024-11-27',
        NULL, NULL, NULL, 'Vial diagnóstico infecciones/tumores. Administrar antes del 24-Nov-2024'
      ),
      (
        'FS-008', 'Fuente BEV Sr-90 oftalmología', 'Sr-90', 'sealed', 'Aplicador oftálmico',
        4.44e7, 'MBq', '2016-01-01', 10547.6,
        'Eckert & Ziegler', 'EZ-SR90-2016-003', 'Eye Plaque Sr-90/Y-90', 'Braquiterapia ocular',
        'Oftalmología', 'Contenedor plomado OFT-1', 'Dra. Ana González Vidal',
        'REG-CCHEN-2016-0234', '2026-01-01', 'LIC-RAD-0045',
        'storage', 'good', '2024-09-01', '2025-03-01',
        '2024-09-01', '2026-09-01', 'No detectada', 'Aplicador Sr-90 para tratamiento pterigión. Vida útil hasta 2036.'
      )
    `;
  }
}

function decayActivity(activityBq: number, halfLifeDays: number, activityDate: string): number {
  const refDate = new Date(activityDate);
  const now = new Date();
  const daysDiff = (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
  return activityBq * Math.pow(0.5, daysDiff / halfLifeDays);
}

export async function GET(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("source_id");
  const sourceType = searchParams.get("source_type");
  const status = searchParams.get("status");
  const search = searchParams.get("search") || "";

  if (sourceId) {
    const movements = await sql`
      SELECT * FROM source_movements
      WHERE source_id = ${parseInt(sourceId)}
      ORDER BY movement_date DESC
      LIMIT 20
    `;
    return NextResponse.json({ movements });
  }

  const sources = await sql`
    SELECT * FROM radioactive_sources
    WHERE active = true
      AND (${search} = '' OR name ILIKE ${'%' + search + '%'} OR radionuclide ILIKE ${'%' + search + '%'} OR source_code ILIKE ${'%' + search + '%'})
      AND (${sourceType || ''} = '' OR source_type = ${sourceType || ''})
      AND (${status || ''} = '' OR status = ${status || ''})
    ORDER BY
      CASE status
        WHEN 'in_use' THEN 1
        WHEN 'active' THEN 2
        WHEN 'storage' THEN 3
        WHEN 'maintenance' THEN 4
        ELSE 5
      END,
      name
  `;

  // Compute decayed activities server-side annotation
  const enhanced = sources.map(s => ({
    ...s,
    current_activity_bq: s.half_life_days && s.activity_bq && s.activity_date
      ? decayActivity(parseFloat(s.activity_bq), parseFloat(s.half_life_days), s.activity_date)
      : null,
    days_to_cchen_expiry: s.cchen_registration_expiry
      ? Math.floor((new Date(s.cchen_registration_expiry).getTime() - Date.now()) / 86400000)
      : null,
    days_to_next_inventory: s.next_inventory_date
      ? Math.floor((new Date(s.next_inventory_date).getTime() - Date.now()) / 86400000)
      : null,
    days_to_next_leak_test: s.next_leak_test_date
      ? Math.floor((new Date(s.next_leak_test_date).getTime() - Date.now()) / 86400000)
      : null,
  }));

  const stats = await safeQuery(async () => {
    const r = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active = true) as total,
        COUNT(*) FILTER (WHERE status = 'in_use' AND active = true) as in_use,
        COUNT(*) FILTER (WHERE status = 'storage' AND active = true) as in_storage,
        COUNT(*) FILTER (WHERE status = 'decommissioned' AND active = true) as decommissioned,
        COUNT(*) FILTER (WHERE source_type = 'sealed' AND active = true) as sealed_count,
        COUNT(*) FILTER (WHERE source_type = 'unsealed' AND active = true) as unsealed_count,
        COUNT(*) FILTER (WHERE source_type = 'generator' AND active = true) as generators,
        COUNT(*) FILTER (WHERE cchen_registration_expiry < NOW() + INTERVAL '90 days' AND active = true) as expiring_soon,
        COUNT(*) FILTER (WHERE next_inventory_date < NOW() AND active = true) as overdue_inventory,
        COUNT(*) FILTER (WHERE next_leak_test_date < NOW() AND source_type = 'sealed' AND active = true) as overdue_leak_test
      FROM radioactive_sources
    `;
    return r[0];
  }, { total: 0, in_use: 0, in_storage: 0, decommissioned: 0, sealed_count: 0, unsealed_count: 0, generators: 0, expiring_soon: 0, overdue_inventory: 0, overdue_leak_test: 0 });

  return NextResponse.json({ sources: enhanced, stats });
}

export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { _type } = body;

  if (_type === "movement") {
    const { source_id, movement_type, from_location, to_location, movement_date, performed_by, authorized_by, purpose, activity_bq, notes } = body;
    const result = await sql`
      INSERT INTO source_movements (source_id, movement_type, from_location, to_location, movement_date, performed_by, authorized_by, purpose, activity_bq, notes)
      VALUES (${source_id}, ${movement_type}, ${from_location || null}, ${to_location || null}, ${movement_date || 'NOW()'}, ${performed_by || null}, ${authorized_by || null}, ${purpose || null}, ${activity_bq || null}, ${notes || null})
      RETURNING *
    `;
    // Update source location/status if applicable
    if (movement_type === "transfer_out" || movement_type === "transfer_in") {
      await sql`UPDATE radioactive_sources SET location = ${to_location || null} WHERE id = ${source_id}`;
    }
    if (movement_type === "inventory") {
      await sql`UPDATE radioactive_sources SET last_inventory_date = NOW()::date WHERE id = ${source_id}`;
    }
    if (movement_type === "leak_test") {
      await sql`UPDATE radioactive_sources SET last_leak_test_date = NOW()::date, leak_test_result = ${notes || null} WHERE id = ${source_id}`;
    }
    return NextResponse.json(result[0], { status: 201 });
  }

  // Create new source
  const {
    source_code, name, radionuclide, source_type = "sealed", physical_form,
    activity_bq, activity_unit = "GBq", activity_date, half_life_days,
    manufacturer, serial_number, model, use_category, location, storage_location,
    custodian, cchen_registration, cchen_registration_expiry, license_number,
    status = "storage", notes
  } = body;

  let code = source_code;
  if (!code) {
    const last = await sql`SELECT source_code FROM radioactive_sources ORDER BY id DESC LIMIT 1`;
    if (last.length > 0) {
      const n = parseInt(last[0].source_code.replace("FS-", "")) + 1;
      code = `FS-${String(n).padStart(3, "0")}`;
    } else { code = "FS-001"; }
  }

  const result = await sql`
    INSERT INTO radioactive_sources (
      source_code, name, radionuclide, source_type, physical_form,
      activity_bq, activity_unit, activity_date, half_life_days,
      manufacturer, serial_number, model, use_category, location, storage_location,
      custodian, cchen_registration, cchen_registration_expiry, license_number, status, notes
    ) VALUES (
      ${code}, ${name}, ${radionuclide}, ${source_type}, ${physical_form || null},
      ${activity_bq || null}, ${activity_unit}, ${activity_date || null}, ${half_life_days || null},
      ${manufacturer || null}, ${serial_number || null}, ${model || null}, ${use_category || null},
      ${location || null}, ${storage_location || null}, ${custodian || null},
      ${cchen_registration || null}, ${cchen_registration_expiry || null}, ${license_number || null},
      ${status}, ${notes || null}
    ) RETURNING *
  `;
  return NextResponse.json(result[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { id, ...fields } = body;
  delete fields._type;

  const sets = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k], i) => `"${k}" = $${i + 2}`)
    .join(", ");
  const vals = Object.values(fields).filter(v => v !== undefined);

  if (!sets) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const result = await sql.unsafe(
    `UPDATE radioactive_sources SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...vals]
  );
  return NextResponse.json(result[0]);
}

export async function DELETE(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await sql`UPDATE radioactive_sources SET active = false WHERE id = ${parseInt(id!)}`;
  return NextResponse.json({ ok: true });
}
