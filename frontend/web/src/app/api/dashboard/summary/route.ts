/**
 * API — Dashboard Summary (Resumen Ejecutivo en Tiempo Real)
 * GET /api/dashboard/summary
 *
 * Retorna KPIs clave de todos los módulos para el panel ejecutivo.
 * Cada módulo tiene try/catch independiente para resiliencia.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
  };

  // ── 1. Trabajadores (POE) ────────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')       AS active,
        COUNT(*) FILTER (WHERE status = 'suspended')    AS suspended,
        COUNT(*) FILTER (WHERE status = 'inactive')     AS inactive,
        COUNT(*) FILTER (
          WHERE status = 'active'
          AND authorization_expiry_date IS NOT NULL
          AND authorization_expiry_date < CURRENT_DATE
        ) AS expired_auth,
        COUNT(*) FILTER (
          WHERE status = 'active'
          AND authorization_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ) AS expiring_soon
      FROM workers
    `;
    summary.workers = rows[0];
  } catch { summary.workers = null; }

  // ── 2. Dosimetría (mes actual) ───────────────────────────────────────────
  try {
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { rows } = await sql`
      SELECT
        COUNT(DISTINCT worker_name)                     AS workers_this_month,
        ROUND(SUM(dose)::numeric, 2)                    AS collective_dose,
        ROUND(AVG(dose)::numeric, 3)                    AS avg_dose,
        ROUND(MAX(dose)::numeric, 3)                    AS max_dose,
        COUNT(*) FILTER (WHERE dose > 20)               AS above_annual_limit
      FROM dosimetry_readings
      WHERE (period LIKE ${currentPeriod + '%'})
        AND (body_region = 'whole_body' OR body_region IS NULL)
        AND status NOT IN ('lost', 'not_worn', 'damaged')
    `;
    summary.dosimetry = rows[0];
  } catch { summary.dosimetry = null; }

  // ── 3. Instrumentos ──────────────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*)                                                AS total,
        COUNT(*) FILTER (WHERE calibration_status = 'vigente') AS calibrated,
        COUNT(*) FILTER (WHERE calibration_status = 'vencida') AS expired,
        COUNT(*) FILTER (
          WHERE next_calibration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ) AS expiring_soon
      FROM instruments
    `;
    summary.instruments = rows[0];
  } catch { summary.instruments = null; }

  // ── 4. Incidentes (últimos 30 días) ─────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE incident_date >= CURRENT_DATE - 30) AS last_30_days,
        COUNT(*) FILTER (WHERE ines_level >= 2)                     AS high_severity,
        COUNT(*) FILTER (WHERE status <> 'closed')                  AS open,
        COUNT(*) FILTER (
          WHERE incident_date >= CURRENT_DATE - 30 AND ines_level >= 2
        ) AS high_severity_30d
      FROM incidents
    `;
    summary.incidents = rows[0];
  } catch { summary.incidents = null; }

  // ── 5. Cumplimiento NS-06.0 ──────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE status = 'compliant')         AS compliant,
        COUNT(*) FILTER (WHERE status = 'overdue')           AS overdue,
        COUNT(*) FILTER (WHERE status = 'pending')           AS pending,
        COUNT(*) FILTER (WHERE priority IN ('critica','alta') AND status <> 'compliant') AS critical_pending,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'compliant')::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1
        ) AS pct
      FROM compliance_requirements
    `;
    summary.compliance = rows[0];
  } catch { summary.compliance = null; }

  // ── 6. Capacitación ──────────────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')       AS pending_renewals,
        COUNT(*) FILTER (WHERE status = 'completed'
          AND training_date >= CURRENT_DATE - 365)       AS completed_this_year,
        COUNT(DISTINCT worker_id) FILTER (
          WHERE status = 'pending'
        ) AS workers_with_pending
      FROM training_records
    `;
    summary.training = rows[0];
  } catch { summary.training = null; }

  // ── 7. Fuentes radiactivas ───────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE status = 'in_use')       AS in_use,
        COUNT(*) FILTER (WHERE status = 'stored')       AS stored,
        COUNT(*) FILTER (WHERE status = 'decommissioned') AS decommissioned,
        COUNT(DISTINCT isotope)                          AS isotopes
      FROM radioactive_sources
    `;
    summary.sources = rows[0];
  } catch { summary.sources = null; }

  // ── 8. Residuos ──────────────────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE status = 'pending')           AS pending_auth,
        COUNT(*) FILTER (WHERE status = 'in_storage')        AS in_storage,
        COUNT(*) FILTER (WHERE category NOT IN ('exempt'))   AS regulated
      FROM waste_items
    `;
    summary.waste = rows[0];
  } catch { summary.waste = null; }

  // ── 9. Alertas activas ───────────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*) AS unread,
        COUNT(*) FILTER (WHERE type = 'danger')  AS danger,
        COUNT(*) FILTER (WHERE type = 'warning') AS warning
      FROM notifications
      WHERE is_read = false
    `;
    summary.notifications = rows[0];
  } catch { summary.notifications = null; }

  // ── 10. Medicina Nuclear / I-131 (últimas 24h) ──────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE administration_date >= NOW() - INTERVAL '24 hours') AS last_24h,
        COUNT(*) FILTER (WHERE administration_date >= CURRENT_DATE - 30)           AS last_30_days,
        COUNT(*) FILTER (WHERE patient_status = 'hospitalized')                    AS hospitalized_now
      FROM i131_administrations
    `;
    summary.i131 = rows[0];
  } catch { summary.i131 = null; }

  // ── 11. Plan de emergencia ───────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true)                   AS active_plans,
        COUNT(*) FILTER (
          WHERE next_drill_date < CURRENT_DATE AND is_active = true
        ) AS overdue_drills
      FROM emergency_plans
    `;
    summary.emergency = rows[0];
  } catch { summary.emergency = null; }

  // ── 12. Plataforma health ────────────────────────────────────────────────
  // Compute an overall RAG (Red/Amber/Green) health status
  const danger_signals = [
    (summary.incidents as any)?.high_severity_30d > 0,
    (summary.compliance as any)?.overdue > 0,
    (summary.workers as any)?.expired_auth > 0,
    (summary.instruments as any)?.expired > 0,
  ].filter(Boolean).length;

  const warning_signals = [
    (summary.workers as any)?.expiring_soon > 0,
    (summary.instruments as any)?.expiring_soon > 0,
    (summary.training as any)?.pending_renewals > 0,
    (summary.incidents as any)?.open > 0,
    (summary.waste as any)?.pending_auth > 0,
  ].filter(Boolean).length;

  summary.health = {
    status: danger_signals > 0 ? "danger" : warning_signals > 2 ? "warning" : "ok",
    danger_signals,
    warning_signals,
  };

  return NextResponse.json(summary);
}
