import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { listTestCatalog, ensurePetCtArchitectureTables } from "@/lib/qc-petct-architecture-db";
import PetCtBaselineApp from "@/components/quality-control/petct-baseline-app";

/**
 * MODULO 4 - PET/CT - FASE I
 * Pagina wrapper de gestion del baseline del equipo (secciones 27-28).
 */
export const dynamic = "force-dynamic";

export default async function PetCtBaselinePage() {
  await ensurePetCtEquipmentTables();
  await ensurePetCtArchitectureTables();
  const equipment = await listPetCtEquipment();
  const catalog = await listTestCatalog();
  return (
    <PetCtBaselineApp
      equipment={JSON.parse(JSON.stringify(equipment))}
      catalog={JSON.parse(JSON.stringify(catalog))}
    />
  );
}
