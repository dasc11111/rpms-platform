import { ensureSpectArchitectureTables } from "@/lib/qc-spect-architecture-db";
import { ensureSpectEquipmentTables } from "@/lib/qc-spect-equipment-db";
import { sql } from "@/lib/db";
import SpectEvidenceApp from "@/components/quality-control/spect-evidence-app";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * Pagina de evidencia grafica y documental.
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

export default async function SpectEvidencePage() {
  await ensureSpectArchitectureTables();
  const equipment = await getEquipment();
  return <SpectEvidenceApp equipment={equipment} />;
}
