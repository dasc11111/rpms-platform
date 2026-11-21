import { sql } from "@/lib/db";
import { ensureGammacamaraArchitectureTables } from "@/lib/qc-gammacamara-architecture-db";
import { ensureGammacamaraEquipmentTables } from "@/lib/qc-gammacamara-equipment-db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";
import GammacamaraBaselineApp from "@/components/quality-control/gammacamara-baseline-app";

/**
 * MODULO 2 - GAMMACAMARA - ARQUITECTURA
 * Pagina de baseline: consulta y establecimiento de valores de referencia
 * por equipo, tipo de prueba, modo y parametro.
 */

export const dynamic = "force-dynamic";

async function getEquipment() {
  try {
    await ensureGammacamaraEquipmentTables();
    const rows = await sql`
      SELECT id, manufacturer, model, internal_code
      FROM qc_gammacamara_equipment
      ORDER BY manufacturer, model
    `;
    return rows as { id: number; manufacturer: string | null; model: string | null; internal_code: string | null }[];
  } catch {
    return [];
  }
}

async function getTolerances() {
  try {
    // Derive unique test_type + test_mode combinations from the tolerances table
    const rows = await sql`
      SELECT DISTINCT test_type, COALESCE(test_mode, 'N/A') AS test_mode
      FROM qc_gammacamara_tolerances
      ORDER BY test_type, test_mode
    `;
    return rows as { test_type: string; test_mode: string }[];
  } catch {
    return [];
  }
}

export default async function GammacamaraBaselinePage() {
  await Promise.all([ensureGammacamaraArchitectureTables(), ensureGammacamaraQcTables()]);
  const [equipment, tolerances] = await Promise.all([getEquipment(), getTolerances()]);
  return <GammacamaraBaselineApp equipment={equipment} tolerances={tolerances} />;
}
