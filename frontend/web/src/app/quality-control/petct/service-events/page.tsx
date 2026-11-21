import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { ensurePetCtArchitectureTables } from "@/lib/qc-petct-architecture-db";
import PetCtServiceEventsApp from "@/components/quality-control/petct-service-events-app";

/**
 * MODULO 4 - PET/CT - FASE I
 * Pagina wrapper de gestion de eventos de servicio tecnico (seccion 26).
 */
export const dynamic = "force-dynamic";

export default async function PetCtServiceEventsPage() {
  await ensurePetCtEquipmentTables();
  await ensurePetCtArchitectureTables();
  const equipment = await listPetCtEquipment();
  return <PetCtServiceEventsApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
