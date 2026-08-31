import { listActivimetroEquipment, ensureActivimetroArchitectureTables } from "@/lib/qc-activimetro-architecture-db";
import ActivimetroEvidenceApp from "@/components/quality-control/activimetro-evidence-app";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Pagina wrapper de evidencia grafica y documental (seccion 31 del
 * prompt maestro).
 */
export const dynamic = "force-dynamic";

export default async function ActivimetroEvidencePage() {
  await ensureActivimetroArchitectureTables();
  const equipment = await listActivimetroEquipment();
  return <ActivimetroEvidenceApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
