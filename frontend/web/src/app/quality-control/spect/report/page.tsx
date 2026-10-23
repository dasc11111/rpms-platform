import { sql } from "@/lib/db";
import { ensureSpectEquipmentTables } from "@/lib/qc-spect-equipment-db";
import SpectReportDownload from "@/components/quality-control/spect-report-download";

/**
 * MODULO 2 - SPECT - INFORME PDF
 * Pagina de descarga del informe técnico por equipo.
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

export default async function SpectReportPage() {
  const equipment = await getEquipment();
  return <SpectReportDownload equipment={equipment} />;
}
