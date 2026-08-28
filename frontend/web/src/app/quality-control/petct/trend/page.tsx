import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import PetCtTrendApp from "@/components/quality-control/petct-trend-app";

/**
 * MODULO 4 - PET/CT - FASE K
 * Pagina wrapper del grafico de control y tendencia (Levey-Jennings),
 * secciones 16-18 del prompt de mejora.
 */
export const dynamic = "force-dynamic";

export default async function PetCtTrendPage() {
  await ensurePetCtEquipmentTables();
  const equipment = await listPetCtEquipment();
  return <PetCtTrendApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
