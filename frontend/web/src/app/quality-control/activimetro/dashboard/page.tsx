import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import { ensureActivimetroArchitectureTables, listActivimetroAuditLogRecent } from "@/lib/qc-activimetro-architecture-db";
import { ensureActivimetroInspectionTables } from "@/lib/qc-activimetro-inspection-db";
import ActivimetroDashboardApp from "@/components/quality-control/activimetro-dashboard-app";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Pagina wrapper del tablero de control (dashboard). Calcula los mismos
 * indicadores que /api/quality-control/activimetro/dashboard para el
 * primer render (sin esperar al fetch del cliente), y el componente
 * cliente permite actualizar despues con el boton "Actualizar".
 */
export const dynamic = "force-dynamic";

type DueAlertRow = {
  instrumentId: number;
  instrumentCode: string | null;
  instrumentName: string | null;
  testType: string;
  frequencyDays: number;
  lastTestDate: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  status: "overdue" | "upcoming" | "sin_registro";
};

async function computeDueAlerts(): Promise<DueAlertRow[]> {
  const { rows: tolerances } = await sql`
    SELECT DISTINCT test_type, frequency_days
    FROM qc_activimetro_tolerances
    WHERE active = true AND frequency_days IS NOT NULL
  `;
  const { rows: instruments } = await sql`SELECT id, code, name FROM instruments ORDER BY name ASC`;
  const { rows: lastTests } = await sql`
    SELECT instrument_id, test_type, MAX(test_date) AS last_test_date
    FROM qc_activimetro_tests
    WHERE instrument_id IS NOT NULL
    GROUP BY instrument_id, test_type
  `;
  const lastMap = new Map<string, string>();
  for (const row of lastTests) {
    lastMap.set(`${row.instrument_id}:${row.test_type}`, row.last_test_date);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alerts: DueAlertRow[] = [];
  for (const instrument of instruments) {
    for (const tol of tolerances) {
      const frequencyDays = Number(tol.frequency_days);
      if (!frequencyDays || Number.isNaN(frequencyDays)) continue;
      const key = `${instrument.id}:${tol.test_type}`;
      const lastDateStr: string | undefined = lastMap.get(key);
      if (!lastDateStr) {
        alerts.push({
          instrumentId: instrument.id,
          instrumentCode: instrument.code,
          instrumentName: instrument.name,
          testType: tol.test_type,
          frequencyDays,
          lastTestDate: null,
          nextDueDate: null,
          daysUntilDue: null,
          status: "sin_registro",
        });
        continue;
      }
      const nextDueDate = new Date(lastDateStr);
      nextDueDate.setDate(nextDueDate.getDate() + frequencyDays);
      const diffDays = Math.round((nextDueDate.getTime() - today.getTime()) / 86400000);
      const warningWindowDays = Math.max(1, Math.round(frequencyDays * 0.15));
      if (diffDays < 0) {
        alerts.push({
          instrumentId: instrument.id,
          instrumentCode: instrument.code,
          instrumentName: instrument.name,
          testType: tol.test_type,
          frequencyDays,
          lastTestDate: lastDateStr,
          nextDueDate: nextDueDate.toISOString().slice(0, 10),
          daysUntilDue: diffDays,
          status: "overdue",
        });
      } else if (diffDays <= warningWindowDays) {
        alerts.push({
          instrumentId: instrument.id,
          instrumentCode: instrument.code,
          instrumentName: instrument.name,
          testType: tol.test_type,
          frequencyDays,
          lastTestDate: lastDateStr,
          nextDueDate: nextDueDate.toISOString().slice(0, 10),
          daysUntilDue: diffDays,
          status: "upcoming",
        });
      }
    }
  }
  const statusOrder: Record<string, number> = { overdue: 0, sin_registro: 1, upcoming: 2 };
  alerts.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  return alerts;
}

export default async function ActivimetroDashboardPage() {
  await ensureActivimetroQcTables();
  await ensureActivimetroArchitectureTables();
  await ensureActivimetroInspectionTables();

  const { rows: totals } = await sql`
    SELECT
      (SELECT COUNT(*) FROM qc_activimetro_equipment WHERE active = true) AS equipment_active,
      (SELECT COUNT(*) FROM qc_activimetro_tests) AS tests_total,
      (SELECT COUNT(*) FROM qc_activimetro_tests WHERE result_status = 'cumple') AS tests_cumple,
      (SELECT COUNT(*) FROM qc_activimetro_tests WHERE result_status = 'advertencia') AS tests_advertencia,
      (SELECT COUNT(*) FROM qc_activimetro_tests WHERE result_status = 'no_cumple') AS tests_no_cumple,
      (SELECT COUNT(*) FROM qc_activimetro_tests WHERE result_status = 'pendiente_revision') AS tests_pendiente,
      (SELECT COUNT(*) FROM qc_activimetro_inspections) AS inspections_total,
      (SELECT COUNT(*) FROM qc_activimetro_inspections WHERE overall_result = 'no_cumple') AS inspections_no_cumple,
      (SELECT COUNT(*) FROM qc_activimetro_inspections WHERE overall_result = 'requiere_revision') AS inspections_requiere_revision,
      (SELECT COUNT(*) FROM qc_activimetro_service_events WHERE status <> 'completado') AS service_events_open,
      (SELECT COUNT(*) FROM qc_activimetro_evidence) AS evidence_total,
      (SELECT COUNT(*) FROM qc_activimetro_audit_log WHERE changed_at >= now() - interval '30 days') AS audit_recent_30d
  `;

  const { rows: testsByType } = await sql`
    SELECT test_type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE result_status = 'cumple') AS cumple,
      COUNT(*) FILTER (WHERE result_status = 'advertencia') AS advertencia,
      COUNT(*) FILTER (WHERE result_status = 'no_cumple') AS no_cumple,
      COUNT(*) FILTER (WHERE result_status = 'pendiente_revision') AS pendiente_revision
    FROM qc_activimetro_tests
    GROUP BY test_type ORDER BY test_type ASC
  `;

  const { rows: inspectionsByResult } = await sql`
    SELECT overall_result, COUNT(*) AS total FROM qc_activimetro_inspections GROUP BY overall_result
  `;

  const { rows: serviceEventsByStatus } = await sql`
    SELECT status, COUNT(*) AS total FROM qc_activimetro_service_events GROUP BY status
  `;

  const { rows: equipmentBaseline } = await sql`
    SELECT e.id, e.internal_code, e.manufacturer, e.model,
      (SELECT COUNT(*)::int FROM qc_activimetro_baseline b WHERE b.equipment_id = e.id AND b.is_current = true) AS baseline_count
    FROM qc_activimetro_equipment e
    WHERE e.active = true
    ORDER BY e.manufacturer ASC NULLS LAST, e.model ASC NULLS LAST
  `;

  const dueAlerts = await computeDueAlerts();
  const overdueCount = dueAlerts.filter((a) => a.status === "overdue").length;
  const upcomingCount = dueAlerts.filter((a) => a.status === "upcoming").length;
  const sinRegistroCount = dueAlerts.filter((a) => a.status === "sin_registro").length;

  const recentAudit = await listActivimetroAuditLogRecent(10);

  const t: any = totals[0] || {};
  const testsTotal = Number(t.tests_total || 0);
  const testsCumple = Number(t.tests_cumple || 0);
  const testsAdvertencia = Number(t.tests_advertencia || 0);
  const testsNoCumple = Number(t.tests_no_cumple || 0);
  const testsPendiente = Number(t.tests_pendiente || 0);
  const evaluados = testsCumple + testsAdvertencia + testsNoCumple;
  const testsCompliancePercent = evaluados > 0 ? Math.round((testsCumple / evaluados) * 1000) / 10 : null;

  const initialData = {
    ok: true,
    checkedAt: new Date().toISOString().slice(0, 10),
    kpis: {
      equipmentActive: Number(t.equipment_active || 0),
      testsTotal,
      testsCumple,
      testsAdvertencia,
      testsNoCumple,
      testsPendiente,
      testsCompliancePercent,
      inspectionsTotal: Number(t.inspections_total || 0),
      inspectionsNoCumple: Number(t.inspections_no_cumple || 0),
      inspectionsRequiereRevision: Number(t.inspections_requiere_revision || 0),
      serviceEventsOpen: Number(t.service_events_open || 0),
      evidenceTotal: Number(t.evidence_total || 0),
      auditRecent30d: Number(t.audit_recent_30d || 0),
      overdueCount,
      upcomingCount,
      sinRegistroCount,
    },
    testsByType,
    inspectionsByResult,
    serviceEventsByStatus,
    equipment: equipmentBaseline,
    dueAlerts: dueAlerts.slice(0, 30),
    recentAudit,
  };

  return <ActivimetroDashboardApp initialData={JSON.parse(JSON.stringify(initialData))} />;
}
