import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables } from "@/lib/radioterapia";
import { ensureLinacTables } from "@/lib/linac";

export const dynamic = "force-dynamic";

function daysUntil(dateValue: any): number | null {
    if (!dateValue) return null;
    const target = new Date(dateValue);
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function addInterval(dateValue: any, periodicity: string): Date | null {
    if (!dateValue) return null;
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return null;
    switch (periodicity) {
      case "diario": d.setDate(d.getDate() + 1); break;
      case "semanal": d.setDate(d.getDate() + 7); break;
      case "mensual": d.setMonth(d.getMonth() + 1); break;
      case "trimestral": d.setMonth(d.getMonth() + 3); break;
      case "semestral": d.setMonth(d.getMonth() + 6); break;
      case "anual": d.setFullYear(d.getFullYear() + 1); break;
      default: return null;
    }
    return d;
}

function pct(numerator: number, denominator: number): number | null {
    if (!denominator) return null;
    return Math.round((numerator / denominator) * 1000) / 10;
}

function levelFromPct(p: number | null): string {
    if (p === null) return "unknown";
    if (p >= 90) return "ok";
    if (p >= 70) return "warning";
    if (p >= 40) return "urgent";
    return "critical";
}

function levelFromDays(days: number | null): string {
    if (days === null) return "unknown";
    if (days < 0) return "critical";
    if (days <= 15) return "urgent";
    if (days <= 30) return "warning";
    return "ok";
}

const QC_PERIODICITIES = [
  { value: "diario", label: "QC Diario" },
  { value: "semanal", label: "QC Semanal" },
  { value: "mensual", label: "QC Mensual" },
  { value: "trimestral", label: "QC Trimestral" },
  { value: "semestral", label: "QC Semestral" },
  { value: "anual", label: "QC Anual" },
  ];

const FRAMEWORKS = [
  { key: "seremi", label: "SEREMI" },
  { key: "cchen", label: "CCHEN" },
  { key: "iaea", label: "IAEA" },
  { key: "arpansa", label: "ARPANSA" },
  { key: "iec", label: "IEC" },
  { key: "iso", label: "ISO" },
  { key: "aapm", label: "AAPM" },
  ];

export async function GET(request: Request) {
    await ensureRadioterapiaTables();
    await ensureLinacTables();
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId");

  const bunkersRes = await sql`SELECT * FROM rt_bunkers WHERE facility_id = ${facilityId}`;
    const bunkers = bunkersRes.rows;
    const bunkerIds: any = bunkers.map((b: any) => b.id);
    const linacIds: any = Array.from(new Set(bunkers.map((b: any) => b.linac_id).filter((v: any) => v !== null && v !== undefined)));
const devicesRes = bunkerIds.length
      ? await sql`SELECT * FROM rt_safety_devices WHERE bunker_id = ANY(${bunkerIds}::int[])`
      : { rows: [] as any[] };
    const devices = devicesRes.rows;
    const devicesTotal = devices.length;
    const devicesOperational = devices.filter((d: any) => d.status === "operativo").length;

  const incidentsRes = await sql`SELECT * FROM rt_incidents WHERE facility_id = ${facilityId} ORDER BY incident_date DESC`;
    const incidents = incidentsRes.rows;

  const auditsRes = await sql`SELECT * FROM rt_audits WHERE facility_id = ${facilityId}`;
    const audits = auditsRes.rows;

const trainingsRes = await sql`SELECT * FROM rt_trainings WHERE facility_id = ${facilityId}`;
    const trainings = trainingsRes.rows;

  const surveysRes = bunkerIds.length
      ? await sql`SELECT * FROM rt_radiation_surveys WHERE bunker_id = ANY(${bunkerIds}::int[]) ORDER BY survey_date DESC`
        : { rows: [] as any[] };
    const surveys = surveysRes.rows;

  const shieldingRes = bunkerIds.length
      ? await sql`SELECT * FROM rt_shielding WHERE bunker_id = ANY(${bunkerIds}::int[])`
        : { rows: [] as any[] };
    const shielding = shieldingRes.rows;

const linacsRes = linacIds.length
      ? await sql`SELECT * FROM linac_units WHERE id = ANY(${linacIds}::int[])`
      : { rows: [] as any[] };
    const linacs = linacsRes.rows;

  const qcRes = linacIds.length
      ? await sql`SELECT * FROM linac_qc_tests WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY test_date DESC`
        : { rows: [] as any[] };
    const qcTests = qcRes.rows;

const maintenanceRes = linacIds.length
      ? await sql`SELECT * FROM linac_maintenance WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY maintenance_date DESC`
      : { rows: [] as any[] };
    const maintenance = maintenanceRes.rows;

  const clinicalOpsRes = linacIds.length
      ? await sql`SELECT * FROM linac_clinical_operations WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY op_date DESC`
        : { rows: [] as any[] };
    const clinicalOps = clinicalOpsRes.rows;

const linacAuthsRes = linacIds.length
      ? await sql`SELECT * FROM linac_authorizations WHERE linac_id = ANY(${linacIds}::int[]) AND is_current = true`
      : { rows: [] as any[] };
    const linacAuths = linacAuthsRes.rows;

  const linacDocsRes = linacIds.length
      ? await sql`SELECT * FROM linac_documents WHERE linac_id = ANY(${linacIds}::int[])`
        : { rows: [] as any[] };
    const linacDocs = linacDocsRes.rows;

const linacIncidentsRes = linacIds.length
      ? await sql`SELECT * FROM linac_incidents WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY incident_date DESC`
      : { rows: [] as any[] };
    const linacIncidents = linacIncidentsRes.rows;

  const linacAuditsRes = linacIds.length
      ? await sql`SELECT * FROM linac_audits WHERE linac_id = ANY(${linacIds}::int[])`
        : { rows: [] as any[] };
    const linacAudits = linacAuditsRes.rows;

const activityRes = await sql`
    SELECT * FROM audit_logs
        WHERE category IN ('radioterapia', 'linac')
            ORDER BY created_at DESC LIMIT 15
              `;

  const now = new Date();
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const dPrev30 = new Date(now); dPrev30.setDate(dPrev30.getDate() - 60);
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

const opsLast30 = clinicalOps.filter((o: any) => new Date(o.op_date) >= d30);
    const opsPrev30 = clinicalOps.filter((o: any) => new Date(o.op_date) >= dPrev30 && new Date(o.op_date) < d30);
    const operatingHours30 = opsLast30.reduce((s: number, o: any) => s + Number(o.operating_hours || 0), 0);
    const downtimeHours30 = opsLast30.reduce((s: number, o: any) => s + Number(o.downtime_hours || 0), 0);
    const patients30 = opsLast30.reduce((s: number, o: any) => s + Number(o.patients_treated || 0), 0);

const operatingHoursPrev30 = opsPrev30.reduce((s: number, o: any) => s + Number(o.operating_hours || 0), 0);
    const downtimeHoursPrev30 = opsPrev30.reduce((s: number, o: any) => s + Number(o.downtime_hours || 0), 0);

  const availabilityPct = operatingHours30 + downtimeHours30 > 0
      ? Math.round((operatingHours30 / (operatingHours30 + downtimeHours30)) * 1000) / 10
        : null;
    const availabilityPrevPct = operatingHoursPrev30 + downtimeHoursPrev30 > 0
      ? Math.round((operatingHoursPrev30 / (operatingHoursPrev30 + downtimeHoursPrev30)) * 1000) / 10
          : null;

const failuresLast30 = linacIncidents.filter((i: any) => new Date(i.incident_date) >= d30).length;
    const failuresPrev30 = linacIncidents.filter((i: any) => new Date(i.incident_date) >= dPrev30 && new Date(i.incident_date) < d30).length;
    const mtbfHours = failuresLast30 > 0 ? Math.round((operatingHours30 / failuresLast30) * 10) / 10 : null;
    const mttrHours = failuresLast30 > 0 ? Math.round((downtimeHours30 / failuresLast30) * 10) / 10 : null;

  const incidentsLast30 = incidents.filter((i: any) => new Date(i.incident_date) >= d30).length;
    const incidentsPrev30 = incidents.filter((i: any) => new Date(i.incident_date) >= dPrev30 && new Date(i.incident_date) < d30).length;

const qcLast90 = qcTests.filter((q: any) => new Date(q.test_date) >= d90);
    const qcNoCumple90 = qcLast90.filter((q: any) => q.status !== "cumple").length;

  const maintenanceLast90 = maintenance.filter((m: any) => new Date(m.maintenance_date) >= d90).length;

  const trainingsVigentes = trainings.filter((t: any) => t.expiry_date === null || (daysUntil(t.expiry_date) ?? 0) >= 0).length;
    const cumplimientoCapacitacion = pct(trainingsVigentes, trainings.length);

const docsCurrent = linacDocs.filter((d: any) => d.is_current).length;
    const cumplimientoDocumental = pct(docsCurrent, linacDocs.length);

  const auditsClosed = audits.filter((a: any) => a.status !== "abierta").length;
    const cumplimientoAuditorias = pct(auditsClosed, audits.length);

  const authsValid = linacAuths.filter((a: any) => a.expiry_date === null || (daysUntil(a.expiry_date) ?? 0) >= 0).length;
    const cumplimientoAutorizaciones = pct(authsValid, linacAuths.length);

const alerts: any[] = [];
    devices.filter((d: any) => d.status !== "operativo").forEach((d: any) =>
          alerts.push({ module: "safety", level: "critical", message: `Dispositivo "${d.name || d.device_type}" fuera de servicio` }));
    linacAuths.forEach((a: any) => {
          const days = daysUntil(a.expiry_date);
          if (days !== null && days < 0) alerts.push({ module: "linac", level: "critical", message: `Autorizacion ${a.doc_type} vencida` });
          else if (days !== null && days <= 60) alerts.push({ module: "linac", level: "urgent", message: `Autorizacion ${a.doc_type} vence en ${days} dias` });
    });

qcLast90.filter((q: any) => q.status !== "cumple").slice(0, 5).forEach((q: any) =>
      alerts.push({ module: "qc", level: "critical", message: `QC "${q.test_name}" no cumple (${String(q.test_date).slice(0, 10)})` }));
    trainings.forEach((t: any) => {
          const days = daysUntil(t.expiry_date);
          if (days !== null && days < 0) alerts.push({ module: "training", level: "critical", message: `Capacitacion vencida: ${t.worker_name} - ${t.training_name}` });
          else if (days !== null && days <= 60) alerts.push({ module: "training", level: "urgent", message: `Capacitacion por vencer: ${t.worker_name} - ${t.training_name}` });
    });

incidents.filter((i: any) => i.status === "abierto").forEach((i: any) =>
      alerts.push({ module: "incidents", level: i.severity === "grave" ? "critical" : "warning", message: `Incidente abierto: ${i.event}` }));
    linacIncidents.filter((i: any) => i.status === "abierto").forEach((i: any) =>
          alerts.push({ module: "linac", level: "critical", message: `Incidente acelerador abierto: ${i.event}` }));
    audits.filter((a: any) => a.status === "abierta" && a.nonconformities).forEach((a: any) =>
          alerts.push({ module: "audits", level: "warning", message: `Auditoria con no conformidades pendientes (${a.audit_type})` }));

bunkers.forEach((b: any) => {
      const bunkerSurveys = surveys.filter((s: any) => s.bunker_id === b.id);
      const last = bunkerSurveys[0];
      if (!last) {
              alerts.push({ module: "surveys", level: "warning", message: `Bunker "${b.name}" sin levantamiento radiometrico registrado` });
      } else {
              const days = daysUntil(last.survey_date);
              if (days !== null && Math.abs(days) > 180) {
                        alerts.push({ module: "surveys", level: "urgent", message: `Levantamiento radiometrico de "${b.name}" desactualizado (ultimo: ${String(last.survey_date).slice(0, 10)})` });
              }
      }
});
    shielding.filter((s: any) => s.status !== "conforme").forEach((s: any) =>
          alerts.push({ module: "shielding", level: "critical", message: `Blindaje "${s.element}" no conforme` }));

const criticalCount = alerts.filter((a) => a.level === "critical").length;
    const urgentCount = alerts.filter((a) => a.level === "urgent").length;
    const warningCount = alerts.filter((a) => a.level === "warning").length;

  let servicioLevel = "ok";
    if (criticalCount > 0) servicioLevel = "critical";
    else if (urgentCount > 0) servicioLevel = "urgent";
    else if (warningCount > 0) servicioLevel = "warning";
    else if (linacs.length === 0) servicioLevel = "unknown";

const controlCalidad = QC_PERIODICITIES.map((p) => {
      const testsForP = qcTests.filter((q: any) => q.periodicity === p.value);
      const last = testsForP[0] || null;
      const nextDue = last ? addInterval(last.test_date, p.value) : null;
      const days = nextDue ? daysUntil(nextDue) : null;
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const count365 = testsForP.filter((q: any) => new Date(q.test_date) >= oneYearAgo).length;
      return {
              periodicity: p.value,
              label: p.label,
              lastDate: last ? last.test_date : null,
              lastStatus: last ? last.status : null,
              count365,
              nextDue: nextDue ? nextDue.toISOString().slice(0, 10) : null,
              level: last ? (last.status !== "cumple" ? "critical" : levelFromDays(days)) : "unknown",
      };
});

const docsByCategoryMap: Record<string, number> = {};
    linacDocs.forEach((d: any) => { const c = d.category || "sin_categoria"; docsByCategoryMap[c] = (docsByCategoryMap[c] || 0) + 1; });
    const documentsByCategory = Object.entries(docsByCategoryMap).map(([category, count]) => ({ category, count }));
    const authorizationsExpiring = linacAuths
      .map((a: any) => ({ ...a, daysRemaining: daysUntil(a.expiry_date) }))
      .filter((a: any) => a.daysRemaining === null || a.daysRemaining <= 90)
      .sort((a: any, b: any) => (a.daysRemaining ?? -9999) - (b.daysRemaining ?? -9999));

const calendarEvents: any[] = [];
    trainings.forEach((t: any) => {
          if (t.expiry_date) calendarEvents.push({ date: t.expiry_date, type: "capacitacion", label: `Vence: ${t.training_name} (${t.worker_name})`, level: levelFromDays(daysUntil(t.expiry_date)) });
    });
    shielding.forEach((s: any) => {
          if (s.verification_date) calendarEvents.push({ date: s.verification_date, type: "blindaje", label: `Verificacion blindaje: ${s.element}`, level: levelFromDays(daysUntil(s.verification_date)) });
    });

linacAuths.forEach((a: any) => {
      if (a.expiry_date) calendarEvents.push({ date: a.expiry_date, type: "autorizacion", label: `Vence autorizacion: ${a.doc_type}`, level: levelFromDays(daysUntil(a.expiry_date)) });
});
    controlCalidad.forEach((c: any) => {
          if (c.nextDue) calendarEvents.push({ date: c.nextDue, type: "qc", label: `Proximo ${c.label}`, level: levelFromDays(daysUntil(c.nextDue)) });
    });
    calendarEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

const devicesOperationalPct = pct(devicesOperational, devicesTotal);
    const complianceValues = [cumplimientoDocumental, cumplimientoCapacitacion, cumplimientoAuditorias, cumplimientoAutorizaciones].filter((v) => v !== null) as number[];
    const cumplimientoGeneral = complianceValues.length ? Math.round((complianceValues.reduce((s, v) => s + v, 0) / complianceValues.length) * 10) / 10 : null;

  let nivelRiesgo = "ok";
    if (criticalCount > 5) nivelRiesgo = "critical";
    else if (criticalCount >= 3) nivelRiesgo = "urgent";
    else if (criticalCount >= 1 || urgentCount >= 3) nivelRiesgo = "warning";

const indiceCalidad = qcLast90.length ? Math.round((1 - qcNoCumple90 / qcLast90.length) * 1000) / 10 : null;
    const indiceSeguridad = devicesOperationalPct;
    const globalValues = [cumplimientoGeneral, indiceCalidad, indiceSeguridad, availabilityPct].filter((v) => v !== null) as number[];
    const indicadorGlobal = globalValues.length ? Math.round((globalValues.reduce((s, v) => s + v, 0) / globalValues.length) * 10) / 10 : null;

const modoAuditor = FRAMEWORKS.map((f) => {
      const combined = [
              ...audits.filter((a: any) => a.audit_type === f.key),
              ...linacAudits.filter((a: any) => a.audit_type === f.key),
            ];
      if (combined.length === 0) return { key: f.key, label: f.label, pct: null, level: "unknown", evidenceCount: 0 };
      const closed = combined.filter((a: any) => a.status !== "abierta").length;
      const p = pct(closed, combined.length);
      return { key: f.key, label: f.label, pct: p, level: levelFromPct(p), evidenceCount: combined.length };
});

const severityMap: Record<string, number> = {};
    incidents.forEach((i: any) => { severityMap[i.severity] = (severityMap[i.severity] || 0) + 1; });
    const incidentsBySeverity = Object.entries(severityMap).map(([severity, count]) => ({ severity, count }));

return NextResponse.json({
      ok: true,
      meta: { facilityId, linacCount: linacIds.length, generatedAt: new Date().toISOString() },
      kpis: {
              bunkers: bunkers.length,
              devicesTotal,
              devicesOperational,
              incidentsOpen: incidents.filter((i: any) => i.status === "abierto").length,
              nearMiss: incidents.filter((i: any) => i.is_near_miss).length,
              auditsOpen: audits.filter((a: any) => a.status === "abierta").length,
              trainingExpiring: trainings.filter((t: any) => { const d = daysUntil(t.expiry_date); return d !== null && d <= 60; }).length,
              availabilityPct,
              operatingHours30d: Math.round(operatingHours30 * 10) / 10,
              downtimeHours30d: Math.round(downtimeHours30 * 10) / 10,
              patients30d: patients30,
              mtbfHours,
              mttrHours,
              fallas30d: failuresLast30,
              qcEjecutados90d: qcLast90.length,
              qcNoCumple90d: qcNoCumple90,
              mantenimientos90d: maintenanceLast90,
              cumplimientoDocumental,
              cumplimientoCapacitacion,
              cumplimientoAuditorias,
              cumplimientoAutorizaciones,
      },

  estadoGeneral: {
          servicioLevel,
          linacs: linacs.map((l: any) => ({ id: l.id, brand: l.brand, model: l.model, room: l.room, operationalStatus: l.operational_status })),
          availabilityPct, operatingHours30d: Math.round(operatingHours30 * 10) / 10, downtimeHours30d: Math.round(downtimeHours30 * 10) / 10, patients30d: patients30,
  },
      alertasCriticas: alerts,
      proteccionRadiologica: {
              lastSurvey: surveys[0] || null,
              recentSurveys: surveys.slice(0, 10),
              incidentesRadiologicos: incidents.filter((i: any) => i.severity === "grave").length,
      },
      controlCalidad,
      gestionDocumental: { documentsByCategory, authorizationsExpiring },
      calendario: calendarEvents.slice(0, 30),
      actividadReciente: activityRes.rows,

  panelEjecutivo: {
          cumplimientoGeneral,
          nivelRiesgo,
          estadoServicio: servicioLevel,
          indiceCalidad,
          indiceSeguridad,
          indicadorGlobal,
          cumplimientoNormativo: cumplimientoAuditorias,
          preparacionAuditoria: cumplimientoGeneral,
  },
      modoAuditor,
      tendencias: {
              incidentsLast30, incidentsPrev30, incidentsTrendUp: incidentsLast30 > incidentsPrev30,
              failuresLast30, failuresPrev30, failuresTrendUp: failuresLast30 > failuresPrev30,
              availabilityPct, availabilityPrevPct, availabilityTrendDown: availabilityPct !== null && availabilityPrevPct !== null && availabilityPct < availabilityPrevPct,
      },
      incidentsBySeverity,
      recentSurveys: surveys.slice(0, 10),
});
}
