import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// Fetch a count from a table safely (returns 0 if table doesn't exist)
async function safeCount(query: string): Promise<number> {
  try {
    const { rows:[r] } = await sql.unsafe(query);
    return Number(r?.cnt ?? r?.count ?? 0);
  } catch { return 0; }
}
async function safeAvg(query: string): Promise<number> {
  try {
    const { rows:[r] } = await sql.unsafe(query);
    return Number(r?.avg ?? 0);
  } catch { return 0; }
}

export async function GET(req: NextRequest) {
  return safeQuery(async () => {
    const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));

    // ── Workers / POE ─────────────────────────────────────────────────────
    const [totalWorkers, activePoe] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM workers WHERE active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM workers WHERE active = TRUE AND is_poe = TRUE`),
    ]);

    // ── Dosimetría ─────────────────────────────────────────────────────────
    const [dosimetryRecords, avgDose, maxDose, workersOver15, workersOver20] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = ${year}`),
      safeAvg(`SELECT ROUND(AVG(effective_dose_msv),2) AS avg FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = ${year} AND effective_dose_msv IS NOT NULL`),
      safeAvg(`SELECT MAX(effective_dose_msv) AS avg FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = ${year}`),
      safeCount(`SELECT COUNT(DISTINCT worker_id)::int AS cnt FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = ${year} AND effective_dose_msv > 15`),
      safeCount(`SELECT COUNT(DISTINCT worker_id)::int AS cnt FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = ${year} AND effective_dose_msv > 20`),
    ]);

    // Monthly dose trend
    let doseMonthly: Array<{month:number; avg_dose:number; count:number}> = [];
    try {
      const { rows } = await sql`
        SELECT EXTRACT(MONTH FROM period_start)::int AS month,
               ROUND(AVG(effective_dose_msv),3)::float AS avg_dose,
               COUNT(*)::int AS count
        FROM dosimetry_records
        WHERE EXTRACT(YEAR FROM period_start) = ${year}
          AND effective_dose_msv IS NOT NULL
        GROUP BY month ORDER BY month
      `;
      doseMonthly = rows as typeof doseMonthly;
    } catch { /* table may not exist */ }

    // ── Incidentes ─────────────────────────────────────────────────────────
    const [totalIncidents, reportedCchen] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM incidents WHERE EXTRACT(YEAR FROM incident_date) = ${year} AND active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM incidents WHERE EXTRACT(YEAR FROM incident_date) = ${year} AND cchen_reported = TRUE`),
    ]);

    // ── Capacitación ───────────────────────────────────────────────────────
    const [trainingEvents, trainedWorkers, avgTrainingHours] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM training_records WHERE EXTRACT(YEAR FROM training_date) = ${year} AND active = TRUE`),
      safeCount(`SELECT COUNT(DISTINCT worker_id)::int AS cnt FROM training_records WHERE EXTRACT(YEAR FROM training_date) = ${year}`),
      safeAvg(`SELECT ROUND(AVG(duration_hours),1) AS avg FROM training_records WHERE EXTRACT(YEAR FROM training_date) = ${year}`),
    ]);

    // ── Comité ─────────────────────────────────────────────────────────────
    const [committeeMeetings, openAgreements] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM committee_meetings WHERE EXTRACT(YEAR FROM meeting_date) = ${year} AND active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM committee_agreements WHERE status IN ('pending','in_progress') AND active = TRUE`),
    ]);

    // ── Auditorías ─────────────────────────────────────────────────────────
    const [auditsTotal, auditsClosed, openFindings] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM pr_audits WHERE EXTRACT(YEAR FROM planned_date) = ${year} AND active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM pr_audits WHERE EXTRACT(YEAR FROM planned_date) = ${year} AND status = 'closed' AND active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM audit_findings WHERE status = 'open' AND active = TRUE`),
    ]);

    // ── Documentos ─────────────────────────────────────────────────────────
    const [docsTotal, docsApproved, docsOverdue] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM pr_documents WHERE active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM pr_documents WHERE status = 'approved' AND active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM pr_documents WHERE next_review_date < NOW() AND status NOT IN ('obsolete','draft') AND active = TRUE`),
    ]);

    // ── Proveedores ────────────────────────────────────────────────────────
    const [vendorsTotal, vendorsCchen, vendorsExpired] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM vendors WHERE active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM vendors WHERE cchen_authorized = TRUE AND active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM vendors WHERE cchen_auth_expiry < NOW() AND cchen_authorized = TRUE AND active = TRUE`),
    ]);

    // ── Riesgos ────────────────────────────────────────────────────────────
    const [risksTotal, risksHigh] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM radiological_risks WHERE active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM radiological_risks WHERE risk_level IN ('critical','high') AND active = TRUE`),
    ]);

    // ── Cambios al programa ────────────────────────────────────────────────
    const changesTotal = await safeCount(`SELECT COUNT(*)::int AS cnt FROM program_changes WHERE EXTRACT(YEAR FROM submission_date) = ${year} AND active = TRUE`);

    // ── Instrumento / calibraciones ────────────────────────────────────────
    const [instrTotal, instrExpiredCalib] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM instruments WHERE active = TRUE`),
      safeCount(`SELECT COUNT(*)::int AS cnt FROM instruments WHERE next_calibration_date < NOW() AND active = TRUE`),
    ]);

    // ── Compliance NS-06.0 ─────────────────────────────────────────────────
    const complianceItems = [
      { section:"§3.1 Protección del trabajador",    ok: avgDose < 20 && workersOver20 === 0 },
      { section:"§3.2 Dosimetría personal",           ok: dosimetryRecords > 0 },
      { section:"§3.3 Zonas clasificadas",            ok: true },
      { section:"§3.4 Instrumentos y calibración",    ok: instrExpiredCalib === 0 },
      { section:"§4.1 Capacitación anual",            ok: trainedWorkers >= activePoe * 0.8 },
      { section:"§4.2 Comité PR (mínimo 4/año)",      ok: committeeMeetings >= 4 },
      { section:"§4.3 Control documental",            ok: docsOverdue === 0 && docsApproved > 0 },
      { section:"§4.4 Auditorías internas",           ok: auditsClosed >= 1 },
      { section:"§4.5 Gestión de riesgos",            ok: risksTotal > 0 },
      { section:"§4.6 Gestión de cambios",            ok: true },
      { section:"§5.1 Informe anual CCHEN",           ok: false },
      { section:"§5.2 Reporte de incidentes",         ok: reportedCchen >= totalIncidents || totalIncidents === 0 },
    ];
    const complianceScore = Math.round(complianceItems.filter(c=>c.ok).length / complianceItems.length * 100);

    return NextResponse.json({
      year,
      summary: {
        totalWorkers, activePoe, dosimetryRecords, avgDose, maxDose,
        workersOver15, workersOver20,
        totalIncidents, reportedCchen,
        trainingEvents, trainedWorkers, avgTrainingHours,
        committeeMeetings, openAgreements,
        auditsTotal, auditsClosed, openFindings,
        docsTotal, docsApproved, docsOverdue,
        vendorsTotal, vendorsCchen, vendorsExpired,
        risksTotal, risksHigh,
        changesTotal,
        instrTotal, instrExpiredCalib,
        complianceScore,
      },
      doseMonthly,
      complianceItems,
    });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}
