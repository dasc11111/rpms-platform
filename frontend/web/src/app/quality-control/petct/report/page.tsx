import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import PetCtReportApp from "@/components/quality-control/petct-report-app";

/**
 * MODULO 4 - PET/CT - FASE P
 * Pagina wrapper del informe PDF (seccion 31 del prompt de mejora).
 */
export const dynamic = "force-dynamic";

export default async function PetCtReportPage() {
  await ensurePetCtEquipmentTables();
  const equipment = await listPetCtEquipment();
  return <PetCtReportApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
