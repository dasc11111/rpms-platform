import { listActivimetroEquipment, ensureActivimetroArchitectureTables } from "@/lib/qc-activimetro-architecture-db";
import ActivimetroReportApp from "@/components/quality-control/activimetro-report-app";

/**
 * MODULO ACTIVIMETRO
 * Pagina wrapper del informe PDF (seccion 31 del prompt maestro).
 */
export const dynamic = "force-dynamic";

export default async function ActivimetroReportPage() {
  await ensureActivimetroArchitectureTables();
  const equipment = await listActivimetroEquipment();
  return <ActivimetroReportApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
