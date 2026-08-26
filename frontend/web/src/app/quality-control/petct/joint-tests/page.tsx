import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { ensureJointTestsTables } from "@/lib/qc-petct-joint-tests-db";
import PetCtJointTestsApp from "@/components/quality-control/petct-joint-tests-app";

/**
 * MODULO 4 - PET/CT - FASE D
 * Pagina wrapper de las pruebas de interaccion PET/CT (PETCT-01, PETCT-02)
 * y de la vista PET/CT integrada.
 */
export const dynamic = "force-dynamic";

export default async function PetCtJointTestsPage() {
  await ensurePetCtEquipmentTables();
  await ensureJointTestsTables();
  const equipment = await listPetCtEquipment();
  return <PetCtJointTestsApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
