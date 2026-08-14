import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import { ensureAlertsTables } from "@/lib/linac-alerts";
import { ensureScienceTables } from "@/lib/linac-science";
import {
  ensureMaintenanceExtendedTables,
  getRepeatedDeviationInfo,
  findMaintenanceOrderByAlert,
  buildInheritedObservations,
  logMaintenanceAudit,
} from "@/lib/linac-maintenance";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Fase 6.10 (Tarea 43): INTEGRACION CON MANTENIMIENTO
// ---------------------------------------------------------------------------
// Carga la alerta cientifica (con su criterio y documento de respaldo, si
// existen) para poder heredar el contexto completo sin volver a pedirlo.
async function loadAlertContext(alertId: number) {
  const { rows } = await sql`
    SELECT
      a.*,
      c.source_name AS criteria_source_name,
      c.tolerance AS criteria_tolerance,
      c.action_limit AS criteria_action_limit,
      c.investigation_limit AS criteria_investigation_limit,
      c.document_id AS criteria_document_id,
      c.document_version AS criteria_document_version,
      c.page AS criteria_page,
      c.section AS criteria_section,
      d.original_name AS document_name,
      d.blob_url AS document_url
    FROM linac_scientific_alerts a
    LEFT JOIN linac_technical_criteria c ON c.id = a.criteria_id
    LEFT JOIN documents d ON d.id = c.document_id
    WHERE a.id = ${alertId}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function GET(request: Request) {
  await ensureLinacTables();
  await ensureScienceTables();
  await ensureAlertsTables();
  await ensureMaintenanceExtendedTables();

  const { searchParams } = new URL(request.url);
  const alertId = Number(searchParams.get("alertId") || 0);
  if (!alertId) {
    return NextResponse.json({ error: "alert_id_required" }, { status: 400 });
  }

  const alert = await loadAlertContext(alertId);
  if (!alert) {
    return NextResponse.json({ error: "alert_not_found" }, { status: 404 });
  }

  const { count, history } = await getRepeatedDeviationInfo(alert.linac_id, alert.module, alert.parameter_name);
  const existingOrder = await findMaintenanceOrderByAlert(alertId);

  return NextResponse.json({
    alert,
    repetitionCount: count,
    isRepetitive: count >= 2,
    history,
    existingOrder,
  });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  await ensureScienceTables();
  await ensureAlertsTables();
  await ensureMaintenanceExtendedTables();

  const body: any = await request.json().catch(() => ({}));
  const alertId = Number(body?.alertId || 0);
  const actorEmail = body?.actorEmail || null;
  const decisionId = body?.decisionId ? Number(body.decisionId) : null;
  const decisionJustification = body?.justification || null;

  if (!alertId) {
    return NextResponse.json({ error: "alert_id_required" }, { status: 400 });
  }

  const alert = await loadAlertContext(alertId);
  if (!alert) {
    return NextResponse.json({ error: "alert_not_found" }, { status: 404 });
  }

  const { count, history } = await getRepeatedDeviationInfo(alert.linac_id, alert.module, alert.parameter_name);

  if (count < 2) {
    return NextResponse.json(
      {
        error: "no_es_desviacion_repetitiva",
        message: "Esta alerta no corresponde a una desviacion repetitiva (solo se ha detectado " + count + " vez/veces). No se genera orden de mantenimiento automatica.",
      },
      { status: 400 }
    );
  }

  // Idempotencia: si ya existe una orden generada desde esta misma alerta, no se duplica.
  const existing = await findMaintenanceOrderByAlert(alertId);
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, record: existing, already: true });
  }

  const observations = buildInheritedObservations({
    parameterName: alert.parameter_name,
    moduleName: alert.module,
    measuredValue: alert.measured_value,
    referenceValue: alert.reference_value,
    deviationPct: alert.deviation_pct,
    criteriaSourceName: alert.criteria_source_name,
    documentName: alert.document_name,
    documentVersion: alert.criteria_document_version,
    page: alert.criteria_page,
    section: alert.criteria_section,
    repetitionCount: count,
    requestedBy: actorEmail,
    alertId,
    decisionJustification,
  });

  const { rows } = await sql`
    INSERT INTO linac_maintenance (
      linac_id, maintenance_type, maintenance_date, status, semaphore, observations,
      source_alert_id, source_decision_id, parameter_name, source_module, criteria_id,
      reference_value, deviation_pct, repetition_count, history_snapshot, requested_by, origin, updated_at
    ) VALUES (
      ${alert.linac_id}, 'correctivo', CURRENT_DATE, 'pendiente', 'amarillo', ${observations},
      ${alertId}, ${decisionId}, ${alert.parameter_name}, ${alert.module}, ${alert.criteria_id},
      ${alert.reference_value}, ${alert.deviation_pct}, ${count}, ${JSON.stringify(history)}::jsonb, ${actorEmail}, 'motor_cientifico', now()
    )
    RETURNING *;
  `;

  const record = rows[0];

  await logLinacAudit("create_linac_maintenance_from_alert", actorEmail, { alertId, linacId: alert.linac_id, parameterName: alert.parameter_name, repetitionCount: count });
  await logMaintenanceAudit("create_linac_maintenance_from_alert", actorEmail, { alertId, recordId: record.id, repetitionCount: count });

  return NextResponse.json({ ok: true, id: record.id, record });
}

