import { ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import PetCtEquipmentApp from "@/components/quality-control/petct-equipment-app";

/**
 * MODULO 4 - PET/CT - FASE A
 * Pagina wrapper de la ficha tecnica del equipo PET/CT.
 */
export default async function PetCtEquipmentPage() {
  await ensurePetCtEquipmentTables();
  return <PetCtEquipmentApp />;
}
