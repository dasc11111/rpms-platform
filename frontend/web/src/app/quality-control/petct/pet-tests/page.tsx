import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { ensurePetTestsTables } from "@/lib/qc-petct-pet-tests-db";
import PetCtPetTestsApp from "@/components/quality-control/petct-pet-tests-app";

/**
 * MODULO 4 - PET/CT - FASE B
 * Pagina wrapper de las pruebas PET-01 a PET-06.
 */
export const dynamic = "force-dynamic";

export default async function PetCtPetTestsPage() {
  await ensurePetCtEquipmentTables();
  await ensurePetTestsTables();
  const equipment = await listPetCtEquipment();
  return <PetCtPetTestsApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
