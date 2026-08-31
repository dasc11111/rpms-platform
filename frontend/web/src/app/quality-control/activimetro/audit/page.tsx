import { listActivimetroAuditLogRecent, ensureActivimetroArchitectureTables } from "@/lib/qc-activimetro-architecture-db";
import ActivimetroAuditApp from "@/components/quality-control/activimetro-audit-app";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Pagina wrapper de la bitacora de auditoria (seccion 40 del prompt
 * maestro).
 */
export const dynamic = "force-dynamic";

export default async function ActivimetroAuditPage() {
  await ensureActivimetroArchitectureTables();
  const records = await listActivimetroAuditLogRecent(200);
  return <ActivimetroAuditApp initialRecords={JSON.parse(JSON.stringify(records))} />;
}
