import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { ensureCtTestsTables } from "@/lib/qc-petct-ct-tests-db";
import PetCtCtTestsApp from "@/components/quality-control/petct-ct-tests-app";

/**
 * MODULO 4 - PET/CT - FASE C
 * Pagina wrapper de las pruebas CT-01 a CT-14.
 */
export const dynamic = "force-dynamic";

export default async function PetCtCtTestsPage() {
  await ensurePetCtEquipmentTables();
  await ensureCtTestsTables();
  const equipment = await listPetCtEquipment();
  return <PetCtCtTestsApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
