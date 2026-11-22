import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// §55 — Gestión de Residuos Radiactivos
// DS 3/1985 Arts. 55–60 — clasificación, almacenamiento y disposición
// IAEA GSR Part 5 — Gestión de desechos radiactivos
// Principio de decaimiento y almacenamiento: T10 = 10 semividas antes de disposición

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS radioactive_waste (
      id              SERIAL PRIMARY KEY,
      waste_code      VARCHAR(50) UNIQUE NOT NULL,
      description     TEXT NOT NULL,
      waste_type      VARCHAR(30) NOT NULL DEFAULT 'liquid',
      category        VARCHAR(30) NOT NULL DEFAULT 'low_level',
      origin          VARCHAR(50) DEFAULT 'nuclear_medicine',
      radionuclide    VARCHAR(50),
      half_life_hours NUMERIC(12,4),
      initial_activity_mbq NUMERIC(14,4),
      initial_date    TIMESTAMPTZ,
      current_activity_mbq NUMERIC(14,4),
      container       TEXT,
      volume_liters   NUMERIC(10,3),
      mass_kg         NUMERIC(10,3),
      storage_location TEXT,
      clearance_level_mbq NUMERIC(14,6),
      clearance_date  DATE,
      disposal_method VARCHAR(50),
      disposal_date   DATE,
      disposal_entity TEXT,
      status          VARCHAR(30) NOT NULL DEFAULT 'in_storage',
      responsible     TEXT,
      references_norm TEXT,
      notes           TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM radioactive_waste`;
  if (parseInt(count[0]?.count ?? "0") === 0) {
    // Seed: residuos típicos medicina nuclear
    // F-18 (T1/2 = 109.77 min), I-131 (T1/2 = 192.5h), Tc-99m (T1/2 = 6.01h), Ga-67 (T1/2 = 78.26h)
    const now = new Date();
    // Residuos recientes de F-18: prácticamente decaído (10 T1/2 ≈ 18.3h)
    const f18Initial = new Date(now.getTime() - 2 * 24 * 3600 * 1000); // hace 2 días
    // Residuos de I-131 terapia: en decaimiento (10 T1/2 ≈ 80 días)
    const i131Initial = new Date(now.getTime() - 15 * 24 * 3600 * 1000); // hace 15 días
    // Residuos de Tc-99m: prácticamente decaído (10 T1/2 ≈ 2.5 días)
    const tc99mInitial = new Date(now.getTime() - 3 * 24 * 3600 * 1000); // hace 3 días

    await sql`
      INSERT INTO radioactive_waste (waste_code, description, waste_type, category, origin, radionuclide, half_life_hours, initial_activity_mbq, initial_date, container, volume_liters, storage_location, clearance_level_mbq, status, responsible, references_norm)
      VALUES
        ('RW-F18-2026-001', 'Residuos líquidos F-18 FDG — jeringas y líneas IV post-PET', 'liquid', 'very_low_level', 'nuclear_medicine', 'F-18', 1.8295, 850.0, ${f18Initial.toISOString()}, 'Contenedor plomado 2L + bolsa roja', 1.5, 'Almacén PR, sala decaimiento F-18', 0.1, 'cleared', 'Encargado Protección Radiológica', 'DS 3/1985 Art. 56; IAEA GSR Part 5'),
        ('RW-I131-2026-001', 'Residuos sólidos I-131 — ropa protectora y materiales paciente terapia', 'solid', 'low_level', 'nuclear_medicine', 'I-131', 192.5, 1200.0, ${i131Initial.toISOString()}, 'Tambor plomado 100L, señalización radiactivo', 0.0, 'Almacén principal PR, sector I-131', 1.0, 'in_storage', 'Encargado Protección Radiológica', 'DS 3/1985 Arts. 57-60; IAEA GSR Part 5 Req. 24'),
        ('RW-TC99-2026-001', 'Residuos líquidos Tc-99m — frascos elución y jeringas SPECT', 'liquid', 'very_low_level', 'nuclear_medicine', 'Tc-99m', 6.0167, 2500.0, ${tc99mInitial.toISOString()}, 'Contenedor plomado 5L', 3.2, 'Almacén PR, sala decaimiento Tc-99m', 0.1, 'in_storage', 'Encargado Protección Radiológica', 'DS 3/1985 Art. 56; IAEA Safety Reports Series No.45'),
        ('RW-GA67-2026-001', 'Residuos Ga-67 — frascos residuales centelleografía', 'liquid', 'very_low_level', 'nuclear_medicine', 'Ga-67', 78.26, 180.0, ${new Date(now.getTime() - 7*24*3600*1000).toISOString()}, 'Contenedor plomado 1L', 0.5, 'Almacén PR, sala decaimiento', 0.1, 'in_storage', 'Encargado Protección Radiológica', 'DS 3/1985 Art. 56'),
        ('RW-MX-2025-001', 'Residuos sólidos mixtos — material contaminado año 2025', 'solid', 'low_level', 'nuclear_medicine', 'Tc-99m/I-131/F-18', 192.5, 450.0, ${new Date('2025-01-15').toISOString()}, 'Tambor plomado 200L', 0.0, 'Almacén principal PR', 1.0, 'disposed', 'Encargado Protección Radiológica', 'DS 3/1985 Arts. 55-60; IAEA GSR Part 5')
    `;

    // Actualizar el residuo mixto 2025 como dispuesto
    await sql`UPDATE radioactive_waste SET disposal_method='transfer_cchen', disposal_date='2025-12-20', disposal_entity='CCHEN — Comisión Chilena de Energía Nuclear' WHERE waste_code='RW-MX-2025-001'`;
  }
}

// Calcular actividad actual dado la actividad inicial, fecha inicial y T1/2 en horas
function computeCurrentActivity(initialMbq: number, initialDate: Date, halfLifeHours: number): number {
  const elapsedHours = (Date.now() - initialDate.getTime()) / (1000 * 3600);
  return initialMbq * Math.pow(0.5, elapsedHours / halfLifeHours);
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get("type");
    const status = searchParams.get("status");

    let waste;
    if (type && status) {
      waste = await sql`SELECT * FROM radioactive_waste WHERE active=TRUE AND waste_type=${type} AND status=${status} ORDER BY created_at DESC`;
    } else if (type) {
      waste = await sql`SELECT * FROM radioactive_waste WHERE active=TRUE AND waste_type=${type} ORDER BY created_at DESC`;
    } else if (status) {
      waste = await sql`SELECT * FROM radioactive_waste WHERE active=TRUE AND status=${status} ORDER BY created_at DESC`;
    } else {
      waste = await sql`SELECT * FROM radioactive_waste WHERE active=TRUE ORDER BY created_at DESC`;
    }

    // Compute current activities and clearance status dynamically
    const enriched = waste.map((w: {
      initial_activity_mbq: number; initial_date: string; half_life_hours: number;
      clearance_level_mbq: number; status: string;
    }) => {
      if (w.initial_activity_mbq && w.initial_date && w.half_life_hours) {
        const current = computeCurrentActivity(
          parseFloat(String(w.initial_activity_mbq)),
          new Date(w.initial_date),
          parseFloat(String(w.half_life_hours))
        );
        const halfLives = w.half_life_hours
          ? (Date.now() - new Date(w.initial_date).getTime()) / (1000 * 3600 * w.half_life_hours)
          : 0;
        const isCleared = w.clearance_level_mbq && current <= parseFloat(String(w.clearance_level_mbq));
        const clearanceProgress = w.clearance_level_mbq
          ? Math.min(100, (1 - current / parseFloat(String(w.initial_activity_mbq))) * 100)
          : 0;
        const hoursToCleared = w.clearance_level_mbq && w.half_life_hours
          ? Math.max(0, w.half_life_hours * Math.log2(current / parseFloat(String(w.clearance_level_mbq))))
          : null;
        return {
          ...w,
          current_activity_mbq: parseFloat(current.toFixed(6)),
          half_lives_elapsed: parseFloat(halfLives.toFixed(2)),
          is_cleared_by_decay: isCleared,
          clearance_progress_pct: parseFloat(clearanceProgress.toFixed(1)),
          hours_to_clearance: hoursToCleared !== null ? parseFloat(hoursToCleared.toFixed(1)) : null,
        };
      }
      return w;
    });

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active)                              AS total,
        COUNT(*) FILTER (WHERE active AND status='in_storage')      AS in_storage,
        COUNT(*) FILTER (WHERE active AND status='cleared')         AS cleared,
        COUNT(*) FILTER (WHERE active AND status='disposed')        AS disposed,
        COUNT(*) FILTER (WHERE active AND waste_type='liquid')      AS liquid,
        COUNT(*) FILTER (WHERE active AND waste_type='solid')       AS solid
      FROM radioactive_waste
    `;

    return NextResponse.json({ waste: enriched, stats });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { waste_code, description, waste_type = "liquid", category = "low_level", origin = "nuclear_medicine", radionuclide, half_life_hours, initial_activity_mbq, initial_date, container, volume_liters, mass_kg, storage_location, clearance_level_mbq, disposal_method, disposal_date, disposal_entity, status = "in_storage", responsible, references_norm, notes } = body;
    if (!waste_code || !description) return NextResponse.json({ error: "Código y descripción requeridos" }, { status: 400 });
    const [row] = await sql`
      INSERT INTO radioactive_waste (waste_code, description, waste_type, category, origin, radionuclide, half_life_hours, initial_activity_mbq, initial_date, container, volume_liters, mass_kg, storage_location, clearance_level_mbq, disposal_method, disposal_date, disposal_entity, status, responsible, references_norm, notes)
      VALUES (${waste_code}, ${description}, ${waste_type}, ${category}, ${origin}, ${radionuclide ?? null}, ${half_life_hours ?? null}, ${initial_activity_mbq ?? null}, ${initial_date ?? null}, ${container ?? null}, ${volume_liters ?? null}, ${mass_kg ?? null}, ${storage_location ?? null}, ${clearance_level_mbq ?? null}, ${disposal_method ?? null}, ${disposal_date ?? null}, ${disposal_entity ?? null}, ${status}, ${responsible ?? null}, ${references_norm ?? null}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const allowed = ["description","waste_type","category","origin","radionuclide","half_life_hours","initial_activity_mbq","initial_date","container","volume_liters","mass_kg","storage_location","clearance_level_mbq","clearance_date","disposal_method","disposal_date","disposal_entity","status","responsible","references_norm","notes"];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!entries.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const setClauses = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    const values = [id, ...entries.map(([, v]) => v)];
    const rows = await sql.unsafe(`UPDATE radioactive_waste SET ${setClauses}, updated_at=now() WHERE id=$1 AND active=TRUE RETURNING *`, values);
    return NextResponse.json(rows[0] ?? null);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`UPDATE radioactive_waste SET active=FALSE, updated_at=now() WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
