import { listActivimetroEquipment, listActivimetroTestCatalog, ensureActivimetroArchitectureTables } from "@/lib/qc-activimetro-architecture-db";
import ActivimetroBaselineApp from "@/components/quality-control/activimetro-baseline-app";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Pagina wrapper de gestion del baseline del equipo (secciones 27-28).
 */
export const dynamic = "force-dynamic";

export default async function ActivimetroBaselinePage() {
  await ensureActivimetroArchitectureTables();
  const equipment = await listActivimetroEquipment();
  const catalog = await listActivimetroTestCatalog();
  return (
    <ActivimetroBaselineApp
      equipment={JSON.parse(JSON.stringify(equipment))}
      catalog={JSON.parse(JSON.stringify(catalog))}
    />
  );
}
