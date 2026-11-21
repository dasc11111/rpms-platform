import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || "") || new Date().getFullYear();

  // ── 1. Dosimetry summary ──────────────────────────────────────────────────
  const { rows: dosRows } = await sql`
    SELECT
      COUNT(DISTINCT worker_id)::int AS workers_monitored,
      SUM(dose)::numeric(10,2) AS collective_dose,
      AVG(dose)::numeric(8,3) AS avg_dose,
      MAX(dose)::numeric(8,3) AS max_dose,
      COUNT(*) FILTER (WHERE dose > 20)::int AS above_limit,
      COUNT(*) FILTER (WHERE dose > 6)::int AS above_constraint,
      COUNT(*) FILTER (WHERE dose = 0 OR dose IS NULL)::int AS zero_dose
    FROM dosimetry_readings
    WHERE EXTRACT(YEAR FROM period_end) = ${year}
      AND (body_region = 'whole_body' OR body_region IS NULL)
  `;
  const dosimetry = dosRows[0] ?? {};

  // ── 2. Incidents ──────────────────────────────────────────────────────────
  const { rows: incRows } = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE severity IN ('critico','alto') OR ines_level >= 2)::int AS high_severity,
      COUNT(*) FILTER (WHERE status = 'cerrado')::int AS closed,
      COUNT(*) FILTER (WHERE status NOT IN ('cerrado','cancelado'))::int AS open
    FROM incidents
    WHERE EXTRACT(YEAR FROM incident_date) = ${year}
  `.catch(() => ({ rows: [{ total: 0, high_severity: 0, closed: 0, open: 0 }] }));
  const incidents = incRows[0] ?? { total: 0, high_severity: 0, closed: 0, open: 0 };

  // ── 3. Training ───────────────────────────────────────────────────────────
  const { rows: trainRows } = await sql`
    SELECT
      COUNT(*)::int AS sessions,
      SUM(participants_registered)::int AS total_registered,
      SUM(participants_attended)::int AS total_attended,
      SUM(participants_passed)::int AS total_passed
    FROM training_courses
    WHERE EXTRACT(YEAR FROM scheduled_date) = ${year}
      AND status = 'completado'
  `.catch(() => ({ rows: [{ sessions: 0, total_registered: 0, total_attended: 0, total_passed: 0 }] }));
  const training = trainRows[0] ?? {};

  // ── 4. Calibrations status ────────────────────────────────────────────────
  const { rows: calRows } = await sql`
    SELECT
      COUNT(DISTINCT i.id)::int AS total_instruments,
      COUNT(DISTINCT CASE WHEN c.expiry_date >= CURRENT_DATE THEN i.id END)::int AS vigente,
      COUNT(DISTINCT CASE WHEN c.expiry_date < CURRENT_DATE THEN i.id END)::int AS vencida,
      COUNT(DISTINCT CASE WHEN c.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days') THEN i.id END)::int AS por_vencer
    FROM instruments i
    LEFT JOIN LATERAL (
      SELECT expiry_date FROM calibrations WHERE instrument_id = i.id ORDER BY calibration_date DESC LIMIT 1
    ) c ON true
    WHERE i.requires_calibration = true OR i.calibration_frequency_months IS NOT NULL
  `.catch(() => ({ rows: [{ total_instruments: 0, vigente: 0, vencida: 0, por_vencer: 0 }] }));
  const calibrations = calRows[0] ?? {};

  // ── 5. ALARA actions ──────────────────────────────────────────────────────
  const { rows: alaraRows } = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'completado')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'en_progreso')::int AS in_progress,
      ROUND(AVG(actual_reduction_pct) FILTER (WHERE actual_reduction_pct IS NOT NULL), 1) AS avg_reduction_pct
    FROM alara_actions
    WHERE year = ${year}
  `.catch(() => ({ rows: [{ total: 0, completed: 0, in_progress: 0, avg_reduction_pct: null }] }));
  const alara = alaraRows[0] ?? {};

  // ── 6. Waste summary ─────────────────────────────────────────────────────
  const { rows: wasteRows } = await sql`
    SELECT
      COUNT(*)::int AS total_records,
      COUNT(*) FILTER (WHERE status = 'almacenado')::int AS in_storage,
      COUNT(*) FILTER (WHERE status = 'liberado' AND EXTRACT(YEAR FROM release_date) = ${year})::int AS released_this_year
    FROM radioactive_waste_items
  `.catch(() => ({ rows: [{ total_records: 0, in_storage: 0, released_this_year: 0 }] }));
  const waste = wasteRows[0] ?? { total_records: 0, in_storage: 0, released_this_year: 0 };

  // ── 7. Compliance ─────────────────────────────────────────────────────────
  const { rows: complianceRows } = await sql`
    SELECT
      COUNT(*)::int AS total_items,
      COUNT(*) FILTER (WHERE status = 'cumple')::int AS compliant,
      COUNT(*) FILTER (WHERE status IN ('no_cumple','alerta'))::int AS non_compliant
    FROM compliance_items
  `.catch(() => ({ rows: [{ total_items: 0, compliant: 0, non_compliant: 0 }] }));
  const compliance = complianceRows[0] ?? { total_items: 0, compliant: 0, non_compliant: 0 };

  // ── 8. Workers by service ─────────────────────────────────────────────────
  const { rows: byService } = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio') AS service,
      COUNT(DISTINCT d.worker_id)::int AS workers,
      SUM(d.dose)::numeric(10,2) AS collective_dose,
      MAX(d.dose)::numeric(8,3) AS max_dose
    FROM dosimetry_readings d
    JOIN workers w ON w.id = d.worker_id
    WHERE EXTRACT(YEAR FROM d.period_end) = ${year}
      AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
    GROUP BY 1
    ORDER BY collective_dose DESC
    LIMIT 10
  `.catch(() => ({ rows: [] }));

  // ── 9. Emergency plans ────────────────────────────────────────────────────
  const { rows: emerRows } = await sql`
    SELECT
      COUNT(*)::int AS total_plans,
      COUNT(*) FILTER (WHERE status = 'activo')::int AS active_plans,
      COUNT(*) FILTER (WHERE next_drill_date < CURRENT_DATE AND next_drill_date IS NOT NULL)::int AS overdue_drills
    FROM emergency_plans
  `.catch(() => ({ rows: [{ total_plans: 0, active_plans: 0, overdue_drills: 0 }] }));
  const emergency = emerRows[0] ?? { total_plans: 0, active_plans: 0, overdue_drills: 0 };

  return NextResponse.json({
    year,
    dosimetry,
    incidents,
    training,
    calibrations,
    alara,
    waste,
    compliance,
    by_service: byService,
    emergency,
    generated_at: new Date().toISOString(),
  });
}
