import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS radioactive_waste (
      id SERIAL PRIMARY KEY,
      waste_code TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      origin_service TEXT,
      waste_type TEXT DEFAULT 'solid' CHECK (waste_type IN ('solid','liquid','gaseous','mixed','biological','sharps')),
      physical_state TEXT DEFAULT 'solid' CHECK (physical_state IN ('solid','liquid','gaseous','mixed')),
      radionuclide TEXT,
      estimated_activity_bq NUMERIC(20,4),
      activity_date DATE,
      half_life_days NUMERIC(10,4),
      volume_liters NUMERIC(10,3),
      mass_kg NUMERIC(10,3),
      container_type TEXT,
      container_id TEXT,
      location TEXT,
      storage_start_date DATE,
      projected_clearance_date DATE,
      status TEXT DEFAULT 'in_storage' CHECK (status IN ('in_storage','pending_clearance','cleared','transferred_cchen','disposed','lost')),
      clearance_basis TEXT CHECK (clearance_basis IN ('decay_in_storage','conditional','unconditional','transfer_cchen')),
      clearance_date DATE,
      clearance_by TEXT,
      dose_rate_usvh NUMERIC(10,4),
      contact_dose_usvh NUMERIC(10,4),
      generated_by TEXT,
      responsible TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS waste_events (
      id SERIAL PRIMARY KEY,
      waste_id INTEGER REFERENCES radioactive_waste(id) ON DELETE CASCADE,
      event_type TEXT CHECK (event_type IN ('created','measurement','container_change','location_change','clearance_check','transferred','disposed','noted')),
      event_date TIMESTAMPTZ DEFAULT NOW(),
      performed_by TEXT,
      activity_bq NUMERIC(20,4),
      dose_rate_usvh NUMERIC(10,4),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const count = await sql`SELECT COUNT(*) as n FROM radioactive_waste`;
  if (Number(count[0].n) === 0) {
    await sql`
      INSERT INTO radioactive_waste (
        waste_code, description, origin_service, waste_type, physical_state,
        radionuclide, estimated_activity_bq, activity_date, half_life_days,
        volume_liters, mass_kg, container_type, container_id, location,
        storage_start_date, projected_clearance_date,
        status, clearance_basis, dose_rate_usvh,
        generated_by, responsible, notes
      ) VALUES
      (
        'RR-2024-001', 'Residuo sólido Tc-99m — jeringuillas y materiales contaminados',
        'Medicina Nuclear', 'sharps', 'solid',
        'Tc-99m', 3.7e8, '2024-11-18', 0.251,
        1.5, 0.3, 'Contenedor plomado sharps', 'SHARP-MN-2024-047', 'Almacén residuos MN',
        '2024-11-18', '2024-11-21',
        'in_storage', 'decay_in_storage', 2.1,
        'Carmen López Fuentes', 'Diego Solís Catalán',
        'Contenedor sharps semanal. T½=6h → liberación en ~10 T½ (2.5 días). Verificar <10× fondo antes de disposición convencional'
      ),
      (
        'RR-2024-002', 'Residuo líquido Tc-99m — efluentes radiofarmacia',
        'Radiofarmacia', 'liquid', 'liquid',
        'Tc-99m', 1.85e8, '2024-11-18', 0.251,
        5.0, NULL, 'Bidón HDPE 10L blindado', 'BDON-RF-2024-022', 'Bodega decaimiento RF',
        '2024-11-18', '2024-11-21',
        'in_storage', 'decay_in_storage', 0.8,
        'Carmen López Fuentes', 'Diego Solís Catalán',
        'Efluentes líquidos semana 47. Medición antes de descarga por cañería autorizada'
      ),
      (
        'RR-2024-003', 'Residuo I-131 terapia — residuos sólidos paciente hospitalizado',
        'Medicina Nuclear', 'solid', 'solid',
        'I-131', 7.4e7, '2024-11-10', 8.021,
        3.0, 2.1, 'Contenedor plomado 10 cm Pb', 'CONT-I131-2024-012', 'Almacén blindado I-131',
        '2024-11-10', '2025-02-10',
        'in_storage', 'decay_in_storage', 15.4,
        'Roberto Soto Álvarez', 'Diego Solís Catalán',
        'Residuos sábanas, ropa hospital y materiales paciente I-131. 90 días almacenamiento = >10 T½. Tasa dosis actual alta → acceso restringido'
      ),
      (
        'RR-2024-004', 'Material contaminado Ga-67 — fractura accidental frasco',
        'Medicina Nuclear', 'mixed', 'mixed',
        'Ga-67', 4.0e7, '2024-11-15', 3.261,
        0.8, 0.5, 'Bolsa doble + caja cartón plomada', 'CONT-GA67-2024-003', 'Almacén residuos MN',
        '2024-11-15', '2024-12-15',
        'in_storage', 'decay_in_storage', 1.2,
        'Carmen López Fuentes', 'Diego Solís Catalán',
        'Incidente fractura frasco Ga-67. Material limpieza + EPI desechable. 30 días almacenamiento = >9 T½'
      ),
      (
        'RR-2024-005', 'Fuente sellada Am-241 — detectores de humo desmantelados',
        'Departamento Mantención', 'solid', 'solid',
        'Am-241', 2.96e4, '2024-01-01', 157861.5,
        0.1, 0.5, 'Envase blindado especial', 'AM241-MANT-2024-001', 'Bodega blindada SSAS',
        '2024-01-15', '2524-01-15',
        'pending_clearance', 'transfer_cchen', 0.05,
        'Francisco Morales Jara', 'Diego Solís Catalán',
        'Am-241 de 3 detectores de humo reemplazados. T½=432 años → no aplica decaimiento. Gestión via CCHEN para disposición especial. Contactado: pendiente respuesta'
      ),
      (
        'RR-2024-006', 'Residuo mixto Lu-177 DOTATATE — efluentes y materiales paciente',
        'Medicina Nuclear', 'mixed', 'liquid',
        'Lu-177', 1.0e9, '2024-10-28', 6.647,
        4.0, 1.2, 'Bidón HDPE + bolsas dobles', 'BDON-LU177-2024-008', 'Almacén blindado MN',
        '2024-10-28', '2024-12-28',
        'in_storage', 'decay_in_storage', 4.8,
        'Roberto Soto Álvarez', 'Diego Solís Catalán',
        'Residuos terapia Lu-177 DOTATATE. T½=6.65d → 60 días = >9 T½. Alto potencial energético beta'
      ),
      (
        'RR-2024-007', 'Agujas Ra-226 históricas — disposición especial CCHEN',
        'Bodega blindada SSAS', 'solid', 'solid',
        'Ra-226', 3.7e4, '1980-01-01', 585620.0,
        0.05, 0.3, 'Contenedor especial Ra-226 certificado', 'RA226-HIST-001', 'Bodega blindada SSAS',
        '2024-06-01', NULL,
        'transferred_cchen', 'transfer_cchen', 0.02,
        'Diego Solís Catalán', 'Diego Solís Catalán',
        'Fuente Ra-226 histórica transferida a CCHEN para disposición final según Protocolo FONDEF. Número de transferencia CCHEN: TRF-CCHEN-2024-0089'
      ),
      (
        'RR-2024-008', 'Residuos Ir-192 — material de cambio de fuente HDR',
        'Braquiterapia', 'solid', 'solid',
        'Ir-192', 3.7e11, '2024-04-01', 73.83,
        0.02, 0.1, 'Contenedor tipo C certificado transporte', 'IR192-HDR-2024-Q2', 'Contenedor retorno Elekta',
        '2024-04-15', '2024-07-15',
        'transferred_cchen', 'transfer_cchen', 120.0,
        'Dr. Carlos Pérez Muñoz', 'Diego Solís Catalán',
        'Fuente Ir-192 HDR expirada devuelta a Elekta Chile según contrato. Guía despacho N°892/2024. Contenedor tipo C certificado'
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
  const wasteId = searchParams.get("waste_id");
  const status = searchParams.get("status");
  const wasteType = searchParams.get("waste_type");
  const search = searchParams.get("search") || "";

  if (wasteId) {
    const events = await sql`
      SELECT * FROM waste_events WHERE waste_id = ${parseInt(wasteId)} ORDER BY event_date DESC LIMIT 20
    `;
    return NextResponse.json({ events });
  }

  const wastes = await sql`
    SELECT * FROM radioactive_waste
    WHERE active = true
      AND (${search} = '' OR description ILIKE ${'%' + search + '%'} OR waste_code ILIKE ${'%' + search + '%'} OR radionuclide ILIKE ${'%' + search + '%'})
      AND (${status || ''} = '' OR status = ${status || ''})
      AND (${wasteType || ''} = '' OR waste_type = ${wasteType || ''})
    ORDER BY
      CASE status
        WHEN 'in_storage' THEN 1
        WHEN 'pending_clearance' THEN 2
        WHEN 'cleared' THEN 4
        ELSE 5
      END,
      storage_start_date DESC
  `;

  const enhanced = wastes.map(w => {
    const currentActivity = w.half_life_days && w.estimated_activity_bq && w.activity_date && parseFloat(String(w.half_life_days)) < 10000
      ? decayActivity(parseFloat(String(w.estimated_activity_bq)), parseFloat(String(w.half_life_days)), String(w.activity_date))
      : parseFloat(String(w.estimated_activity_bq || 0));
    const halfLives = w.half_life_days && w.activity_date
      ? (Date.now() - new Date(String(w.activity_date)).getTime()) / (1000 * 60 * 60 * 24) / parseFloat(String(w.half_life_days))
      : null;
    const daysInStorage = w.storage_start_date
      ? Math.floor((Date.now() - new Date(String(w.storage_start_date)).getTime()) / 86400000)
      : null;
    const daysToClearance = w.projected_clearance_date
      ? Math.floor((new Date(String(w.projected_clearance_date)).getTime() - Date.now()) / 86400000)
      : null;
    return { ...w, current_activity_bq: currentActivity, half_lives_elapsed: halfLives, days_in_storage: daysInStorage, days_to_clearance: daysToClearance };
  });

  const stats = await safeQuery(async () => {
    const r = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active = true) as total,
        COUNT(*) FILTER (WHERE status = 'in_storage' AND active = true) as in_storage,
        COUNT(*) FILTER (WHERE status = 'pending_clearance' AND active = true) as pending_clearance,
        COUNT(*) FILTER (WHERE status = 'cleared' AND active = true) as cleared,
        COUNT(*) FILTER (WHERE status = 'transferred_cchen' AND active = true) as transferred,
        COUNT(*) FILTER (WHERE projected_clearance_date < NOW() AND status = 'in_storage' AND active = true) as overdue_clearance
      FROM radioactive_waste
    `;
    return r[0];
  }, { total: 0, in_storage: 0, pending_clearance: 0, cleared: 0, transferred: 0, overdue_clearance: 0 });

  return NextResponse.json({ wastes: enhanced, stats });
}

export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { _type } = body;

  if (_type === "event") {
    const { waste_id, event_type, performed_by, activity_bq, dose_rate_usvh, notes } = body;
    const result = await sql`
      INSERT INTO waste_events (waste_id, event_type, performed_by, activity_bq, dose_rate_usvh, notes)
      VALUES (${waste_id}, ${event_type}, ${performed_by || null}, ${activity_bq || null}, ${dose_rate_usvh || null}, ${notes || null})
      RETURNING *
    `;
    if (event_type === "clearance_check" && notes?.includes("aprobada")) {
      await sql`UPDATE radioactive_waste SET status = 'cleared', clearance_date = NOW()::date, clearance_by = ${performed_by || null} WHERE id = ${waste_id}`;
    }
    return NextResponse.json(result[0], { status: 201 });
  }

  // Create waste record
  const {
    description, origin_service, waste_type = "solid", physical_state = "solid",
    radionuclide, estimated_activity_bq, activity_date, half_life_days,
    volume_liters, mass_kg, container_type, container_id, location,
    storage_start_date, projected_clearance_date, status = "in_storage",
    clearance_basis, dose_rate_usvh, generated_by, responsible, notes
  } = body;

  const year = new Date().getFullYear();
  const last = await sql`SELECT waste_code FROM radioactive_waste WHERE waste_code LIKE ${'RR-' + year + '-%'} ORDER BY id DESC LIMIT 1`;
  let seq = 1;
  if (last.length > 0) {
    seq = parseInt(last[0].waste_code.split("-").pop() || "0") + 1;
  }
  const code = `RR-${year}-${String(seq).padStart(3, "0")}`;

  const result = await sql`
    INSERT INTO radioactive_waste (
      waste_code, description, origin_service, waste_type, physical_state,
      radionuclide, estimated_activity_bq, activity_date, half_life_days,
      volume_liters, mass_kg, container_type, container_id, location,
      storage_start_date, projected_clearance_date, status, clearance_basis,
      dose_rate_usvh, generated_by, responsible, notes
    ) VALUES (
      ${code}, ${description}, ${origin_service || null}, ${waste_type}, ${physical_state},
      ${radionuclide || null}, ${estimated_activity_bq || null}, ${activity_date || null}, ${half_life_days || null},
      ${volume_liters || null}, ${mass_kg || null}, ${container_type || null}, ${container_id || null}, ${location || null},
      ${storage_start_date || null}, ${projected_clearance_date || null}, ${status}, ${clearance_basis || null},
      ${dose_rate_usvh || null}, ${generated_by || null}, ${responsible || null}, ${notes || null}
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
  const result = await sql.unsafe(`UPDATE radioactive_waste SET ${sets} WHERE id = $1 RETURNING *`, [id, ...vals]);
  return NextResponse.json(result[0]);
}

export async function DELETE(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await sql`UPDATE radioactive_waste SET active = false WHERE id = ${parseInt(id!)}`;
  return NextResponse.json({ ok: true });
}
