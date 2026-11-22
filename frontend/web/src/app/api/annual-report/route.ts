import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// §63 — Informe Anual Integrado de Protección Radiológica
// CCHEN NS-06.0 Art. 36 — Informe Anual obligatorio al organismo regulador
// Consolida datos de todos los módulos del RPMS para el año seleccionado

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || "") || new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;

  // ── 1. Institución ────────────────────────────────────────────────────────
  const institution = {
    name: "Hospital Dr. Hernán Henríquez Aravena",
    address: "Manuel Montt 115, Temuco, Región de La Araucanía",
    cchen_license: "CCHEN-INS-2019-0847",
    opr_name: "Encargado de Protección Radiológica",
    opr_registration: "CCHEN-OPR-2018-0312",
    report_period: `${year}-01-01 al ${year}-12-31`,
    report_year: year,
  };

  // ── 2. Dosimetría personal ────────────────────────────────────────────────
  const dosimetry = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(DISTINCT worker_id)::int               AS workers_monitored,
        COALESCE(SUM(dose), 0)::numeric(10,3)        AS collective_dose_mSv,
        COALESCE(AVG(dose), 0)::numeric(8,3)         AS avg_dose_mSv,
        COALESCE(MAX(dose), 0)::numeric(8,3)         AS max_individual_dose_mSv,
        COUNT(*) FILTER (WHERE dose > 20)::int       AS above_20mSv,
        COUNT(*) FILTER (WHERE dose BETWEEN 6 AND 20)::int AS between_6_20mSv,
        COUNT(*) FILTER (WHERE dose > 0 AND dose < 1)::int AS below_1mSv
      FROM dosimetry_records
      WHERE period_year = ${year}
    `;
    const r = rows[0];
    // Monthly trend
    const monthly = await sql`
      SELECT period_month AS month,
             COALESCE(SUM(dose),0)::numeric(8,3) AS collective,
             COALESCE(MAX(dose),0)::numeric(8,3) AS max_dose,
             COUNT(DISTINCT worker_id)::int AS workers
      FROM dosimetry_records
      WHERE period_year = ${year}
      GROUP BY period_month ORDER BY period_month
    `;
    return { ...r, monthly_trend: monthly };
  }, { workers_monitored:0, collective_dose_mSv:0, avg_dose_mSv:0, max_individual_dose_mSv:0, above_20mSv:0, between_6_20mSv:0, below_1mSv:0, monthly_trend:[] });

  // ── 3. Personal ocupacionalmente expuesto ─────────────────────────────────
  const workers = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                        AS total,
        COUNT(*) FILTER (WHERE category='A')::int AS cat_a,
        COUNT(*) FILTER (WHERE category='B')::int AS cat_b,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE dosimeter_assigned=TRUE)::int AS with_dosimeter
      FROM workers
    `;
    return rows[0];
  }, { total:0, cat_a:0, cat_b:0, active:0, with_dosimeter:0 });

  // ── 4. Fuentes radiactivas ────────────────────────────────────────────────
  const sources = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                           AS total,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE sealed=TRUE)::int     AS sealed,
        COUNT(*) FILTER (WHERE sealed=FALSE)::int    AS unsealed,
        COUNT(*) FILTER (WHERE category='I')::int    AS cat_1,
        COUNT(*) FILTER (WHERE category='II')::int   AS cat_2,
        COUNT(*) FILTER (WHERE category='III')::int  AS cat_3,
        COUNT(*) FILTER (WHERE category='IV')::int   AS cat_4,
        COUNT(*) FILTER (WHERE category='V')::int    AS cat_5
      FROM radioactive_sources
    `;
    return rows[0];
  }, { total:0, active:0, sealed:0, unsealed:0, cat_1:0, cat_2:0, cat_3:0, cat_4:0, cat_5:0 });

  // ── 5. Incidentes radiológicos ────────────────────────────────────────────
  const incidents = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                              AS total,
        COUNT(*) FILTER (WHERE ines_level = 0)::int    AS ines_0,
        COUNT(*) FILTER (WHERE ines_level = 1)::int    AS ines_1,
        COUNT(*) FILTER (WHERE ines_level >= 2)::int   AS ines_2plus,
        COUNT(*) FILTER (WHERE status='closed')::int   AS closed,
        COUNT(*) FILTER (WHERE status='open')::int     AS open,
        COUNT(*) FILTER (WHERE status='investigating')::int AS investigating
      FROM radiological_incidents
      WHERE incident_date BETWEEN ${startDate} AND ${endDate}
    `;
    return rows[0];
  }, { total:0, ines_0:0, ines_1:0, ines_2plus:0, closed:0, open:0, investigating:0 });

  // ── 6. Capacitación ───────────────────────────────────────────────────────
  const training = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                           AS sessions_total,
        COUNT(*) FILTER (WHERE status='completed')::int AS sessions_completed,
        COALESCE(SUM(participants_count), 0)::int AS total_participants,
        COALESCE(SUM(duration_hours * participants_count), 0)::numeric(10,1) AS total_training_hours
      FROM training_sessions
      WHERE date BETWEEN ${startDate} AND ${endDate}
    `;
    return rows[0];
  }, { sessions_total:0, sessions_completed:0, total_participants:0, total_training_hours:0 });

  // ── 7. Instrumentos y calibraciones ──────────────────────────────────────
  const instruments = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                                   AS total,
        COUNT(*) FILTER (WHERE status='operational')::int    AS operational,
        COUNT(*) FILTER (WHERE status='calibration_due')::int AS calibration_due,
        COUNT(*) FILTER (WHERE status='out_of_service')::int AS out_of_service,
        COUNT(*) FILTER (WHERE next_calibration_date < NOW())::int AS overdue_calibration
      FROM instruments
    `;
    return rows[0];
  }, { total:0, operational:0, calibration_due:0, out_of_service:0, overdue_calibration:0 });

  // ── 8. Residuos radiactivos ────────────────────────────────────────────────
  const waste = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                                      AS total_entries,
        COUNT(*) FILTER (WHERE status='in_storage')::int      AS in_storage,
        COUNT(*) FILTER (WHERE status='cleared')::int         AS cleared,
        COUNT(*) FILTER (WHERE status='disposed')::int        AS disposed,
        COUNT(*) FILTER (WHERE category='very_low_level')::int AS vll,
        COUNT(*) FILTER (WHERE category='low_level')::int     AS low,
        COUNT(*) FILTER (WHERE category='intermediate_level')::int AS intermediate
      FROM radioactive_waste
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
    `;
    return rows[0];
  }, { total_entries:0, in_storage:0, cleared:0, disposed:0, vll:0, low:0, intermediate:0 });

  // ── 9. Cumplimiento normativo ──────────────────────────────────────────────
  const compliance = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                                     AS total,
        COUNT(*) FILTER (WHERE status='compliant')::int      AS compliant,
        COUNT(*) FILTER (WHERE status='partial')::int        AS partial,
        COUNT(*) FILTER (WHERE status='non_compliant')::int  AS non_compliant,
        COUNT(*) FILTER (WHERE status='not_applicable')::int AS not_applicable
      FROM compliance_requirements
    `;
    const r = rows[0];
    const denom = Math.max(1, r.total - r.not_applicable);
    const pct = Math.round(((r.compliant + r.not_applicable) / Math.max(1, r.total)) * 100);
    return { ...r, compliance_pct: pct };
  }, { total:0, compliant:0, partial:0, non_compliant:0, not_applicable:0, compliance_pct:0 });

  // ── 10. Programa ALARA ────────────────────────────────────────────────────
  const alara = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                                        AS objectives_total,
        COUNT(*) FILTER (WHERE status='achieved')::int          AS achieved,
        COUNT(*) FILTER (WHERE status='in_progress')::int       AS in_progress,
        COUNT(*) FILTER (WHERE status='overdue')::int           AS overdue,
        COALESCE(AVG(progress_pct), 0)::numeric(5,1)            AS avg_progress_pct
      FROM alara_objectives
    `;
    return rows[0];
  }, { objectives_total:0, achieved:0, in_progress:0, overdue:0, avg_progress_pct:0 });

  // ── 11. Reportes regulatorios CCHEN ──────────────────────────────────────
  const regulatoryReports = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                                       AS total,
        COUNT(*) FILTER (WHERE status='submitted')::int        AS submitted,
        COUNT(*) FILTER (WHERE status='approved')::int         AS approved,
        COUNT(*) FILTER (WHERE status='draft')::int            AS draft,
        COUNT(*) FILTER (WHERE year = ${year})::int            AS this_year
      FROM regulatory_reports
    `;
    return rows[0];
  }, { total:0, submitted:0, approved:0, draft:0, this_year:0 });

  // ── 12. Monitoreo ambiental ───────────────────────────────────────────────
  const environmental = await safeQuery(async () => {
    const rows = await sql`
      SELECT
        COUNT(*)::int                                      AS total_readings,
        COALESCE(AVG(dose_rate_uSv_h), 0)::numeric(8,4)  AS avg_dose_rate,
        COALESCE(MAX(dose_rate_uSv_h), 0)::numeric(8,4)  AS max_dose_rate,
        COUNT(*) FILTER (WHERE anomaly = TRUE)::int        AS anomalies
      FROM environmental_monitoring_readings
      WHERE measurement_date BETWEEN ${startDate} AND ${endDate}
    `;
    return rows[0];
  }, { total_readings:0, avg_dose_rate:0, max_dose_rate:0, anomalies:0 });

  // ── Conclusion/score ──────────────────────────────────────────────────────
  const criticalIssues: string[] = [];
  if (Number(dosimetry.above_20mSv) > 0) criticalIssues.push(`${dosimetry.above_20mSv} trabajador(es) superaron límite 20 mSv/año`);
  if (Number(incidents.ines_2plus) > 0) criticalIssues.push(`${incidents.ines_2plus} incidente(s) INES ≥ 2`);
  if (Number(compliance.non_compliant) > 0) criticalIssues.push(`${compliance.non_compliant} requisito(s) no conforme(s) NS-06.0`);
  if (Number(instruments.overdue_calibration) > 0) criticalIssues.push(`${instruments.overdue_calibration} instrumento(s) con calibración vencida`);

  const score = Math.max(0, 100 - criticalIssues.length * 15 - Number(incidents.open) * 3 - Number(alara.overdue) * 5);

  return NextResponse.json({
    year,
    generated_at: new Date().toISOString(),
    institution,
    summary: { score, critical_issues: criticalIssues },
    sections: {
      dosimetry,
      workers,
      sources,
      incidents,
      training,
      instruments,
      waste,
      compliance,
      alara,
      regulatory_reports: regulatoryReports,
      environmental,
    },
  });
}
