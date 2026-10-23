import { ensureGammacamaraArchitectureTables } from "@/lib/qc-gammacamara-architecture-db";
import { ensureGammacamaraEquipmentTables } from "@/lib/qc-gammacamara-equipment-db";
import { sql } from "@/lib/db";
import GammacamaraEvidenceApp from "@/components/quality-control/gammacamara-evidence-app";

/**
 * MODULO 2 - GAMMACAMARA - ARQUITECTURA
 * Pagina de evidencia grafica y documental.
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

export default async function GammacamaraEvidencePage() {
  await ensureGammacamaraArchitectureTables();
  const equipment = await getEquipment();
  return <GammacamaraEvidenceApp equipment={equipment} />;
}
