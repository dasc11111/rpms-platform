import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── helpers ────────────────────────────────────────────────────────────────
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

// ── GET — consolidated executive dashboard ─────────────────────────────────
export async function GET() {
  const now = new Date();
  const year = now.getFullYear();
  const monthStart = new Date(year, now.getMonth(), 1).toISOString();
  const quarterStart = new Date(year, Math.floor(now.getMonth() / 3) * 3, 1).toISOString();

  // ── Dosimetría ─────────────────────────────────────────────────────────
  const dosimetry = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                              AS total_records,
        COUNT(*) FILTER (WHERE period >= ${monthStart}::date)AS this_month,
        COUNT(*) FILTER (WHERE dose_msv > dose_limit_msv)    AS over_limit,
        COUNT(*) FILTER (WHERE dose_msv > dose_limit_msv * 0.75 AND dose_msv <= dose_limit_msv)
                                                             AS approaching_limit,
        ROUND(AVG(dose_msv)::numeric, 3)                     AS avg_dose_msv,
        ROUND(MAX(dose_msv)::numeric, 3)                     AS max_dose_msv,
        SUM(dose_msv)                                        AS collective_dose_msv
      FROM dosimetry_records
      WHERE period >= ${quarterStart}::date
    `;
    const r = rows[0] ?? {};
    return {
      total_records: Number(r.total_records ?? 0),
      this_month: Number(r.this_month ?? 0),
      over_limit: Number(r.over_limit ?? 0),
      approaching_limit: Number(r.approaching_limit ?? 0),
      avg_dose_msv: Number(r.avg_dose_msv ?? 0),
      max_dose_msv: Number(r.max_dose_msv ?? 0),
      collective_dose_msv: Number(r.collective_dose_msv ?? 0),
    };
  }, { total_records: 0, this_month: 0, over_limit: 0, approaching_limit: 0, avg_dose_msv: 0, max_dose_msv: 0, collective_dose_msv: 0 });

  // ── Trabajadores ───────────────────────────────────────────────────────
  const workers = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE category = 'OER')             AS oer,
        COUNT(*) FILTER (WHERE category = 'OER_B')           AS oer_b,
        COUNT(*) FILTER (WHERE dosimetry_active = true)       AS with_dosimetry,
        COUNT(*) FILTER (WHERE medical_exam_expiry < NOW())   AS medical_expired,
        COUNT(*) FILTER (WHERE medical_exam_expiry BETWEEN NOW() AND NOW() + INTERVAL '90 days')
                                                             AS medical_expiring
      FROM workers WHERE active = true
    `;
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      oer: Number(r.oer ?? 0),
      oer_b: Number(r.oer_b ?? 0),
      with_dosimetry: Number(r.with_dosimetry ?? 0),
      medical_expired: Number(r.medical_expired ?? 0),
      medical_expiring: Number(r.medical_expiring ?? 0),
    };
  }, { total: 0, oer: 0, oer_b: 0, with_dosimetry: 0, medical_expired: 0, medical_expiring: 0 });

  // ── Fuentes radiactivas ────────────────────────────────────────────────
  const sources = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                                            AS total,
        COUNT(*) FILTER (WHERE status = 'in_use')                           AS in_use,
        COUNT(*) FILTER (WHERE status = 'stored')                           AS stored,
        COUNT(*) FILTER (WHERE cchen_auth_expiry < NOW())                   AS auth_expired,
        COUNT(*) FILTER (WHERE cchen_auth_expiry BETWEEN NOW() AND NOW() + INTERVAL '90 days')
                                                                            AS auth_expiring,
        COUNT(*) FILTER (WHERE next_leak_test < NOW())                      AS leak_test_overdue,
        COUNT(*) FILTER (WHERE last_leak_test_result = 'failed')            AS leak_test_failed
      FROM radioactive_sources WHERE active = true
    `;
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      in_use: Number(r.in_use ?? 0),
      stored: Number(r.stored ?? 0),
      auth_expired: Number(r.auth_expired ?? 0),
      auth_expiring: Number(r.auth_expiring ?? 0),
      leak_test_overdue: Number(r.leak_test_overdue ?? 0),
      leak_test_failed: Number(r.leak_test_failed ?? 0),
    };
  }, { total: 0, in_use: 0, stored: 0, auth_expired: 0, auth_expiring: 0, leak_test_overdue: 0, leak_test_failed: 0 });

  // ── Incidentes ─────────────────────────────────────────────────────────
  const incidents = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                                        AS total_year,
        COUNT(*) FILTER (WHERE status IN ('open','investigating'))      AS open,
        COUNT(*) FILTER (WHERE ines_level >= 1)                         AS ines_1_plus,
        COUNT(*) FILTER (WHERE cchen_notified = false AND ines_level >= 1)
                                                                        AS cchen_pending,
        COUNT(*) FILTER (WHERE incident_date >= ${monthStart}::date)   AS this_month
      FROM radiological_incidents
      WHERE EXTRACT(YEAR FROM incident_date) = ${year}
    `;
    const r = rows[0] ?? {};
    return {
      total_year: Number(r.total_year ?? 0),
      open: Number(r.open ?? 0),
      ines_1_plus: Number(r.ines_1_plus ?? 0),
      cchen_pending: Number(r.cchen_pending ?? 0),
      this_month: Number(r.this_month ?? 0),
    };
  }, { total_year: 0, open: 0, ines_1_plus: 0, cchen_pending: 0, this_month: 0 });

  // ── Reportes regulatorios ──────────────────────────────────────────────
  const reports = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('draft','in_progress'))  AS in_progress,
        COUNT(*) FILTER (WHERE status = 'submitted')               AS submitted,
        COUNT(*) FILTER (WHERE status = 'approved')                AS approved,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('submitted','approved'))
                                                                   AS overdue
      FROM regulatory_reports
      WHERE year = ${year}
    `;
    const r = rows[0] ?? {};
    return {
      in_progress: Number(r.in_progress ?? 0),
      submitted: Number(r.submitted ?? 0),
      approved: Number(r.approved ?? 0),
      overdue: Number(r.overdue ?? 0),
    };
  }, { in_progress: 0, submitted: 0, approved: 0, overdue: 0 });

  // ── Capacitaciones ─────────────────────────────────────────────────────
  const training = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                                            AS total_year,
        COUNT(*) FILTER (WHERE status = 'completed')                       AS completed,
        COUNT(*) FILTER (WHERE status = 'planned')                         AS planned,
        COALESCE(SUM(CASE WHEN status='completed' THEN participants_count ELSE 0 END),0)
                                                                           AS total_participants,
        COUNT(*) FILTER (WHERE scheduled_date < NOW() AND status = 'planned')
                                                                           AS overdue
      FROM training_sessions
      WHERE EXTRACT(YEAR FROM COALESCE(scheduled_date, completed_date)) = ${year}
    `;
    const r = rows[0] ?? {};
    return {
      total_year: Number(r.total_year ?? 0),
      completed: Number(r.completed ?? 0),
      planned: Number(r.planned ?? 0),
      total_participants: Number(r.total_participants ?? 0),
      overdue: Number(r.overdue ?? 0),
    };
  }, { total_year: 0, completed: 0, planned: 0, total_participants: 0, overdue: 0 });

  // ── Equipos / Instrumentos ─────────────────────────────────────────────
  const equipment = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                                                       AS total,
        COUNT(*) FILTER (WHERE next_calibration < NOW())                               AS calibration_overdue,
        COUNT(*) FILTER (WHERE next_calibration BETWEEN NOW() AND NOW() + INTERVAL '60 days')
                                                                                       AS calibration_soon,
        COUNT(*) FILTER (WHERE operational_status = 'out_of_service')                 AS out_of_service
      FROM instruments WHERE active = true
    `;
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      calibration_overdue: Number(r.calibration_overdue ?? 0),
      calibration_soon: Number(r.calibration_soon ?? 0),
      out_of_service: Number(r.out_of_service ?? 0),
    };
  }, { total: 0, calibration_overdue: 0, calibration_soon: 0, out_of_service: 0 });

  // ── Residuos radiactivos ───────────────────────────────────────────────
  const waste = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE status = 'stored')            AS stored,
        COUNT(*) FILTER (WHERE status = 'transferred')       AS transferred,
        SUM(total_activity_gbq)                              AS total_activity_gbq
      FROM radioactive_waste WHERE active = true
    `;
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      stored: Number(r.stored ?? 0),
      transferred: Number(r.transferred ?? 0),
      total_activity_gbq: Number(r.total_activity_gbq ?? 0),
    };
  }, { total: 0, stored: 0, transferred: 0, total_activity_gbq: 0 });

  // ── Alertas críticas consolidadas ──────────────────────────────────────
  const critical_alerts: Array<{ level: "critical"|"warning"|"info"; module: string; message: string; count: number; href: string }> = [];

  if (dosimetry.over_limit > 0)
    critical_alerts.push({ level: "critical", module: "Dosimetría", message: `${dosimetry.over_limit} trabajador(es) superaron límite de dosis`, count: dosimetry.over_limit, href: "/dosimetry" });
  if (sources.auth_expired > 0)
    critical_alerts.push({ level: "critical", module: "Fuentes", message: `${sources.auth_expired} autorización(es) CCHEN vencida(s)`, count: sources.auth_expired, href: "/sources" });
  if (sources.leak_test_failed > 0)
    critical_alerts.push({ level: "critical", module: "Fuentes", message: `${sources.leak_test_failed} prueba(s) de fuga fallida(s)`, count: sources.leak_test_failed, href: "/sources" });
  if (incidents.cchen_pending > 0)
    critical_alerts.push({ level: "critical", module: "Incidentes", message: `${incidents.cchen_pending} incidente(s) INES≥1 sin notificar a CCHEN`, count: incidents.cchen_pending, href: "/incidents" });
  if (workers.medical_expired > 0)
    critical_alerts.push({ level: "critical", module: "Trabajadores", message: `${workers.medical_expired} examen(es) médico(s) vencido(s)`, count: workers.medical_expired, href: "/workers" });
  if (reports.overdue > 0)
    critical_alerts.push({ level: "critical", module: "Reportes", message: `${reports.overdue} informe(s) CCHEN vencido(s) sin enviar`, count: reports.overdue, href: "/regulatory-reports" });

  if (dosimetry.approaching_limit > 0)
    critical_alerts.push({ level: "warning", module: "Dosimetría", message: `${dosimetry.approaching_limit} trabajador(es) >75% del límite anual`, count: dosimetry.approaching_limit, href: "/dosimetry" });
  if (sources.auth_expiring > 0)
    critical_alerts.push({ level: "warning", module: "Fuentes", message: `${sources.auth_expiring} autorización(es) vence en <90 días`, count: sources.auth_expiring, href: "/sources" });
  if (sources.leak_test_overdue > 0)
    critical_alerts.push({ level: "warning", module: "Fuentes", message: `${sources.leak_test_overdue} prueba(s) de fuga atrasada(s)`, count: sources.leak_test_overdue, href: "/sources" });
  if (equipment.calibration_overdue > 0)
    critical_alerts.push({ level: "warning", module: "Instrumentos", message: `${equipment.calibration_overdue} instrumento(s) con calibración vencida`, count: equipment.calibration_overdue, href: "/instruments" });
  if (workers.medical_expiring > 0)
    critical_alerts.push({ level: "warning", module: "Trabajadores", message: `${workers.medical_expiring} examen(es) médico(s) vencen en 90 días`, count: workers.medical_expiring, href: "/workers" });
  if (training.overdue > 0)
    critical_alerts.push({ level: "warning", module: "Capacitación", message: `${training.overdue} capacitación(es) planificada(s) no realizadas`, count: training.overdue, href: "/training" });
  if (equipment.calibration_soon > 0)
    critical_alerts.push({ level: "info", module: "Instrumentos", message: `${equipment.calibration_soon} instrumento(s) calibración próxima (<60 días)`, count: equipment.calibration_soon, href: "/instruments" });

  // ── Score general del programa PR ──────────────────────────────────────
  const criticalCount = critical_alerts.filter(a => a.level === "critical").length;
  const warningCount  = critical_alerts.filter(a => a.level === "warning").length;
  const programScore  = Math.max(0, 100 - (criticalCount * 15) - (warningCount * 5));
  const programStatus = criticalCount > 0 ? "critical" : warningCount > 3 ? "warning" : warningCount > 0 ? "attention" : "good";

  // ── Dosis mensual últimos 6 meses ──────────────────────────────────────
  const doseHistory = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        TO_CHAR(period, 'YYYY-MM') AS month,
        ROUND(AVG(dose_msv)::numeric,3) AS avg_dose,
        ROUND(MAX(dose_msv)::numeric,3) AS max_dose,
        COUNT(*) AS records
      FROM dosimetry_records
      WHERE period >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(period, 'YYYY-MM')
      ORDER BY month
    `;
    return rows.map(r => ({
      month: String(r.month),
      avg_dose: Number(r.avg_dose),
      max_dose: Number(r.max_dose),
      records: Number(r.records),
    }));
  }, []);

  // ── Incidentes por mes ──────────────────────────────────────────────────
  const incidentHistory = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        TO_CHAR(incident_date, 'YYYY-MM') AS month,
        COUNT(*)                           AS count,
        COUNT(*) FILTER (WHERE ines_level >= 1) AS ines_1_plus
      FROM radiological_incidents
      WHERE incident_date >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(incident_date, 'YYYY-MM')
      ORDER BY month
    `;
    return rows.map(r => ({
      month: String(r.month),
      count: Number(r.count),
      ines_1_plus: Number(r.ines_1_plus),
    }));
  }, []);

  return NextResponse.json({
    generated_at: now.toISOString(),
    year,
    program_score: programScore,
    program_status: programStatus,
    critical_alerts,
    modules: { dosimetry, workers, sources, incidents, reports, training, equipment, waste },
    trends: { dose_history: doseHistory, incident_history: incidentHistory },
  });
}
