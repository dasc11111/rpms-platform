import { sql } from "@/lib/db";
import { ensureGammacamaraEquipmentTables } from "@/lib/qc-gammacamara-equipment-db";
import GammacamaraReportDownload from "@/components/quality-control/gammacamara-report-download";

/**
 * MODULO 2 - GAMMACAMARA - INFORME PDF
 * Pagina de descarga del informe técnico por equipo.
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

export default async function GammacamaraReportPage() {
  const equipment = await getEquipment();
  return <GammacamaraReportDownload equipment={equipment} />;
}
