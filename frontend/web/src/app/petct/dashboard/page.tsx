import { sql } from "@/lib/db";
import { PetctDashboard } from "@/components/petct/petct-dashboard";

export const dynamic = "force-dynamic";

// Fase 23C — Dashboard/Analytics PET/CT
// Calcula los indicadores en el servidor para el primer render sin parpadeo.
// La API /api/petct/dashboard reproduce el mismo cálculo para actualizaciones
// del cliente. DS 133/1984 Art. 22-26, IAEA HHS No. 1.

async function getDashboardData() {
  // KPIs globales
  const { rows: kpiRows } = await sql.query(`
    SELECT
      COUNT(*)                                              AS total_examinations,
      COUNT(*) FILTER (WHERE DATE(injection_datetime) = CURRENT_DATE)
                                                          AS exams_today,
      COUNT(*) FILTER (WHERE state = 'completado')       AS completed,
      COUNT(*) FILTER (WHERE state = 'cancelado')        AS cancelled,
      COUNT(*) FILTER (WHERE state IN ('en_espera','en_examen'))
                                                          AS active_patients,
      COUNT(*) FILTER (WHERE state = 'programado')       AS scheduled,
      ROUND(AVG(administered_mbq)::numeric, 1)           AS avg_dose_mbq,
      ROUND(MAX(administered_mbq)::numeric, 1)           AS max_dose_mbq,
      COUNT(*) FILTER (WHERE DATE(injection_datetime) >= CURRENT_DATE - INTERVAL '30 days')
                                                          AS exams_last_30d,
      COUNT(*) FILTER (WHERE DATE(injection_datetime) >= CURRENT_DATE - INTERVAL '7 days')
                                                          AS exams_last_7d
    FROM petct_examinations
  `);

  const { rows: pharmaRows } = await sql.query(`
    SELECT radiopharmaceutical AS name, COUNT(*) AS count,
           ROUND(AVG(administered_mbq)::numeric, 1) AS avg_mbq,
           ROUND(AVG(patient_weight_kg)::numeric, 1) AS avg_weight_kg
    FROM petct_examinations
    GROUP BY radiopharmaceutical ORDER BY count DESC
  `);

  const { rows: stateRows } = await sql.query(`
    SELECT state AS name, COUNT(*) AS value
    FROM petct_examinations GROUP BY state ORDER BY value DESC
  `);

  const { rows: nuclideRows } = await sql.query(`
    SELECT radionuclide AS name, COUNT(*) AS value
    FROM petct_examinations GROUP BY radionuclide ORDER BY value DESC
  `);

  const { rows: trendRows } = await sql.query(`
    SELECT TO_CHAR(DATE(injection_datetime), 'DD/MM') AS fecha,
           COUNT(*) AS examenes,
           ROUND(AVG(administered_mbq)::numeric, 1) AS dosis_prom_mbq
    FROM petct_examinations
    WHERE DATE(injection_datetime) >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(injection_datetime)
    ORDER BY DATE(injection_datetime) ASC
  `);

  const { rows: weeklyRows } = await sql.query(`
    SELECT TO_CHAR(DATE_TRUNC('week', injection_datetime), 'DD/MM') AS semana,
           COUNT(*) AS examenes,
           ROUND(SUM(administered_mbq)::numeric, 0) AS dosis_total_mbq
    FROM petct_examinations
    WHERE injection_datetime >= NOW() - INTERVAL '8 weeks'
    GROUP BY DATE_TRUNC('week', injection_datetime)
    ORDER BY DATE_TRUNC('week', injection_datetime) ASC
  `);

  const { rows: activeRows } = await sql.query(`
    SELECT id, patient_id, patient_name, radiopharmaceutical, radionuclide,
           administered_mbq, injection_datetime, uptake_minutes, state,
           exam_start, operator
    FROM petct_examinations
    WHERE state IN ('en_espera', 'en_examen')
    ORDER BY injection_datetime ASC
  `);

  const { rows: qcRows } = await sql.query(`
    SELECT qc_date, phantom_type, uniformity_pass, image_quality_pass, performed_by
    FROM petct_qc_daily ORDER BY qc_date DESC LIMIT 7
  `);

  // Serializar fechas
  const serializeActive = activeRows.map((r: Record<string, unknown>) => ({
    ...r,
    id: String(r.id),
    administered_mbq: Number(r.administered_mbq),
    uptake_minutes: Number(r.uptake_minutes),
    injection_datetime: r.injection_datetime
      ? new Date(r.injection_datetime as string).toISOString()
      : "",
    exam_start: r.exam_start
      ? new Date(r.exam_start as string).toISOString()
      : null,
  }));

  const serializeQc = qcRows.map((r: Record<string, unknown>) => ({
    ...r,
    qc_date: r.qc_date ? new Date(r.qc_date as string).toISOString() : null,
  }));

  return {
    kpi: kpiRows[0] ?? {},
    pharmaDistribution: pharmaRows,
    stateDistribution: stateRows,
    nuclideDistribution: nuclideRows,
    trend30d: trendRows,
    weeklyActivity: weeklyRows,
    activePatients: serializeActive,
    recentQc: serializeQc,
  };
}

export default async function PetctDashboardPage() {
  let initialData;
  try {
    initialData = await getDashboardData();
  } catch {
    initialData = {
      kpi: {},
      pharmaDistribution: [],
      stateDistribution: [],
      nuclideDistribution: [],
      trend30d: [],
      weeklyActivity: [],
      activePatients: [],
      recentQc: [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PetctDashboard initialData={initialData as any} />;
}
