import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import PetCtAlertsApp from "@/components/quality-control/petct-alerts-app";

/**
 * MODULO 4 - PET/CT - FASE M
 * Pagina wrapper del motor de inteligencia de alertas (seccion 29 del
 * prompt de mejora).
 */
export const dynamic = "force-dynamic";

export default async function PetCtAlertsPage() {
  await ensurePetCtEquipmentTables();
  const equipment = await listPetCtEquipment();
  return <PetCtAlertsApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
