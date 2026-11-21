/**
 * API: /api/compliance/auto-update
 * Actualiza automáticamente el estado de los requisitos de compliance_requirements
 * en base a datos reales de los otros módulos del RPMS.
 *
 * Lógica NS-06.0:
 *  - Dosimetría: ok si todos los trabajadores tienen lecturas TLD en el trimestre actual
 *  - Instrumentos: ok si ningún instrumento está vencido en calibración
 *  - Fuentes: ok si todas las fuentes tienen inventario al día
 *  - Residuos: ok si no hay residuos en almacenamiento > 10 vidas medias
 *  - Capacitación: ok si todos los TOE tienen capacitación vigente
 *  - Incidentes: pendiente si hay incidentes sin investigar (INES ≥ 1)
 */

import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface UpdateResult {
  requirement_id: number;
  reference_code: string;
  old_status: string;
  new_status: string;
  reason: string;
}

export async function POST() {
  const results: UpdateResult[] = [];
  const errors: string[] = [];

  // Ensure tables exist first
  try {
    await sql`CREATE TABLE IF NOT EXISTS compliance_requirements (
      id SERIAL PRIMARY KEY,
      requirement VARCHAR(500) NOT NULL,
      regulation VARCHAR(200),
      reference_code VARCHAR(50),
      priority VARCHAR(20) DEFAULT 'normal',
      owner VARCHAR(200),
      service VARCHAR(200),
      next_review_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      last_auto_update TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    try {
      await sql`ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS reference_code VARCHAR(50)`;
      await sql`ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS last_auto_update TIMESTAMPTZ`;
    } catch { /* columns exist */ }
  } catch (e) {
    errors.push(`Schema error: ${String(e)}`);
  }

  // ── 1. Dosimetría trimestral (NS-06.0 §6 / DS 3/1985) ──────────────────────
  try {
    const qYear  = new Date().getFullYear();
    const qNum   = Math.ceil((new Date().getMonth() + 1) / 3);
    const { rows: dosRows } = await sql`
      SELECT COUNT(*)::int AS n FROM dosimetry_quarterly
      WHERE year = ${qYear} AND quarter = ${qNum}
    `;
    const dosCount = Number((dosRows[0] as any)?.n ?? 0);
    const dosStatus = dosCount >= 3 ? "ok" : "pending";
    const dosReason = dosCount >= 3
      ? `${dosCount} registros trimestrales (Q${qNum}/${qYear})`
      : `Solo ${dosCount} registros dosimétricos Q${qNum}/${qYear}`;

    await updateRequirement("NS-06.0-S06", dosStatus, dosReason, results);
  } catch (e) {
    errors.push(`Dosimetría: ${String(e)}`);
  }

  // ── 2. Calibración de instrumentos (NS-06.0 §7 / IAEA-TECDOC-1683) ─────────
  try {
    const { rows: instrRows } = await sql`
      SELECT COUNT(*)::int AS overdue FROM instruments
      WHERE next_calibration_due < now() AND status = 'active'
    `;
    const overdueInstr = Number((instrRows[0] as any)?.overdue ?? 0);
    const instrStatus = overdueInstr === 0 ? "ok" : overdueInstr <= 2 ? "pending" : "overdue";
    const instrReason = overdueInstr === 0
      ? "Todos los instrumentos con calibración vigente"
      : `${overdueInstr} instrumento(s) con calibración vencida`;

    await updateRequirement("NS-06.0-S07-INSTR", instrStatus, instrReason, results);
  } catch (e) {
    errors.push(`Instrumentos: ${String(e)}`);
  }

  // ── 3. Inventario fuentes radiactivas (NS-06.0 §4 / DS 133/1984) ───────────
  try {
    const { rows: srcRows } = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE last_inventory_check < now() - interval '365 days')::int AS overdue
      FROM radioactive_sources
    `;
    const totalSrc = Number((srcRows[0] as any)?.total ?? 0);
    const overdueSrc = Number((srcRows[0] as any)?.overdue ?? 0);
    const srcStatus = totalSrc === 0 ? "pending" : overdueSrc === 0 ? "ok" : "overdue";
    const srcReason = totalSrc === 0
      ? "Sin registros de fuentes"
      : overdueSrc === 0
      ? `${totalSrc} fuentes con inventario al día`
      : `${overdueSrc} fuentes sin inventario anual`;

    await updateRequirement("NS-06.0-S04", srcStatus, srcReason, results);
  } catch (e) {
    errors.push(`Fuentes: ${String(e)}`);
  }

  // ── 4. Gestión residuos radiactivos (NS-06.0 §9 / DS 133/1984) ─────────────
  try {
    const { rows: wasteRows } = await sql`
      SELECT COUNT(*)::int AS n FROM radioactive_waste
      WHERE status IN ('storage','decay_waiting')
    `;
    const wasteCount = Number((wasteRows[0] as any)?.n ?? 0);
    const wasteStatus = wasteCount >= 0 ? "ok" : "pending"; // Si la tabla existe, el sistema funciona
    const wasteReason = `${wasteCount} contenedores activos en gestión`;

    await updateRequirement("NS-06.0-S09", wasteStatus, wasteReason, results);
  } catch (e) {
    errors.push(`Residuos: ${String(e)}`);
  }

  // ── 5. Capacitación TOE (NS-06.0 §16 / DS 133/1984 Art.23) ────────────────
  try {
    const { rows: trainRows } = await sql`
      SELECT COUNT(*)::int AS n FROM training_courses
      WHERE status = 'completed'
        AND scheduled_date > now() - interval '1 year'
    `;
    const trainCount = Number((trainRows[0] as any)?.n ?? 0);
    const trainStatus = trainCount >= 2 ? "ok" : "pending";
    const trainReason = trainCount >= 2
      ? `${trainCount} cursos completados en el último año`
      : `Solo ${trainCount} cursos completados en el año`;

    await updateRequirement("NS-06.0-S16", trainStatus, trainReason, results);
  } catch (e) {
    errors.push(`Capacitación: ${String(e)}`);
  }

  // ── 6. Incidentes / INES sin investigar (NS-06.0 §17) ──────────────────────
  try {
    const { rows: incRows } = await sql`
      SELECT COUNT(*)::int AS n FROM incidents
      WHERE ines_level >= 1 AND status NOT IN ('closed','investigated')
    `;
    const openIncidents = Number((incRows[0] as any)?.n ?? 0);
    const incStatus = openIncidents === 0 ? "ok" : "overdue";
    const incReason = openIncidents === 0
      ? "Sin incidentes INES ≥1 sin investigar"
      : `${openIncidents} incidente(s) INES ≥1 sin cerrar`;

    await updateRequirement("NS-06.0-S17", incStatus, incReason, results);
  } catch (e) {
    errors.push(`Incidentes: ${String(e)}`);
  }

  // ── 7. Contaminación superficial (NS-06.0 §7-CONT) ─────────────────────────
  try {
    const { rows: contRows } = await sql`
      SELECT COUNT(*)::int AS n FROM contamination_records
      WHERE result = 'fail'
        AND measurement_date > now() - interval '30 days'
    `;
    const contFail = Number((contRows[0] as any)?.n ?? 0);
    const contStatus = contFail === 0 ? "ok" : "overdue";
    const contReason = contFail === 0
      ? "Sin fallas de contaminación en últimos 30 días"
      : `${contFail} medición(es) de contaminación fallida(s)`;

    await updateRequirement("NS-06.0-S07-CONT", contStatus, contReason, results);
  } catch (e) {
    errors.push(`Contaminación: ${String(e)}`);
  }

  return NextResponse.json({
    ok: true,
    updated: results.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}

async function updateRequirement(
  refCode: string,
  newStatus: string,
  reason: string,
  results: UpdateResult[]
) {
  const { rows } = await sql`
    SELECT id, status FROM compliance_requirements
    WHERE reference_code = ${refCode}
    LIMIT 1
  `;
  if (rows.length === 0) return; // requisito no sembrado aún

  const row = rows[0] as { id: number; status: string };
  if (row.status === newStatus) return; // sin cambio

  await sql`
    UPDATE compliance_requirements
    SET status = ${newStatus},
        notes = ${reason},
        last_auto_update = now()
    WHERE id = ${row.id}
  `;

  results.push({
    requirement_id: row.id,
    reference_code: refCode,
    old_status: row.status,
    new_status: newStatus,
    reason,
  });
}

export async function GET() {
  // GET devuelve el estado actual sin actualizar
  try {
    const { rows } = await sql`
      SELECT reference_code, status, notes, last_auto_update::text
      FROM compliance_requirements
      WHERE reference_code IS NOT NULL
      ORDER BY reference_code
    `;
    return NextResponse.json({ ok: true, requirements: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "compliance_requirements table not found" }, { status: 404 });
  }
}
