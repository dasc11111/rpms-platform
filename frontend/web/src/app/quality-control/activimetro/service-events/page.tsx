import { listActivimetroEquipment, ensureActivimetroArchitectureTables } from "@/lib/qc-activimetro-architecture-db";
import ActivimetroServiceEventsApp from "@/components/quality-control/activimetro-service-events-app";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Pagina wrapper de gestion de eventos de servicio tecnico (seccion 30).
 */
export const dynamic = "force-dynamic";

export default async function ActivimetroServiceEventsPage() {
  await ensureActivimetroArchitectureTables();
  const equipment = await listActivimetroEquipment();
  return <ActivimetroServiceEventsApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
