import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import PetCtComplianceApp from "@/components/quality-control/petct-compliance-app";

/**
 * MODULO 4 - PET/CT - FASE H
 * Pagina wrapper del panel de cumplimiento (vencimientos, seccion 25) y
 * del catalogo de pruebas de referencia (secciones 4 y 25).
 */
export const dynamic = "force-dynamic";

export default async function PetCtCompliancePage() {
  await ensurePetCtEquipmentTables();
  const equipment = await listPetCtEquipment();
  return <PetCtComplianceApp equipment={JSON.parse(JSON.stringify(equipment))} />;
}
