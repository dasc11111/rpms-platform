import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import PetCtComparisonApp from "@/components/quality-control/petct-comparison-app";

/**
 * MODULO 4 - PET/CT - FASE O
 * Pagina wrapper de la vista integrada de comparacion PET + CT + Fusion
 * (seccion 24 del prompt de mejora).
 */
export const dynamic = "force-dynamic";

export default async function PetCtComparisonPage() {
  await ensurePetCtEquipmentTables();
  const equipment = await listPetCtEquipment();
  return <PetCtComparisonApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
