import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { listTestCatalog, ensurePetCtArchitectureTables } from "@/lib/qc-petct-architecture-db";
import PetCtEvidenceApp from "@/components/quality-control/petct-evidence-app";

/**
 * MODULO 4 - PET/CT - FASE J
 * Pagina wrapper de evidencia grafica (seccion 23).
 */
export const dynamic = "force-dynamic";

export default async function PetCtEvidencePage() {
  await ensurePetCtEquipmentTables();
  await ensurePetCtArchitectureTables();
  const equipment = await listPetCtEquipment();
  const catalog = await listTestCatalog();
  return (
    <PetCtEvidenceApp
      equipment={JSON.parse(JSON.stringify(equipment))}
      catalog={JSON.parse(JSON.stringify(catalog))}
    />
  );
}
