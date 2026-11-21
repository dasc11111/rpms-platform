import { sql } from "@/lib/db";
import { ensureSpectArchitectureTables } from "@/lib/qc-spect-architecture-db";
import { ensureSpectEquipmentTables } from "@/lib/qc-spect-equipment-db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import SpectBaselineApp from "@/components/quality-control/spect-baseline-app";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * Pagina de baseline: consulta y establecimiento de valores de referencia
 * por equipo, tipo de prueba y parametro.
 */

export const dynamic = "force-dynamic";

async function getEquipment() {
  try {
    await ensureSpectEquipmentTables();
    const rows = await sql`
      SELECT id, manufacturer, model, internal_code
      FROM qc_spect_equipment
      ORDER BY manufacturer, model
    `;
    return rows as { id: number; manufacturer: string | null; model: string | null; internal_code: string | null }[];
  } catch {
    return [];
  }
}

async function getTolerances() {
  try {
    const rows = await sql`
      SELECT DISTINCT test_type
      FROM qc_spect_tolerances
      ORDER BY test_type
    `;
    return rows as { test_type: string }[];
  } catch {
    return [];
  }
}

export default async function SpectBaselinePage() {
  await Promise.all([ensureSpectArchitectureTables(), ensureSpectQcTables()]);
  const [equipment, tolerances] = await Promise.all([getEquipment(), getTolerances()]);
  return <SpectBaselineApp equipment={equipment} tolerances={tolerances} />;
}
