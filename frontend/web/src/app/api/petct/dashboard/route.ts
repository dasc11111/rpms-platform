import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 23C — API de analytics para el dashboard PET/CT.
// Calcula KPIs globales, distribución por radiofármaco, distribución por estado,
// tendencia de exámenes (últimos 30 días), dosis promedio y pacientes activos.
// DS 133/1984 Art. 22-26, IAEA HHS No. 1.

export async function GET() {
  try {
    // ── KPIs globales ──────────────────────────────────────────────────────────
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
    const kpi = kpiRows[0] ?? {};

    // ── Distribución por radiofármaco ──────────────────────────────────────────
    const { rows: pharmaRows } = await sql.query(`
      SELECT
        radiopharmaceutical                                  AS name,
        COUNT(*)                                             AS count,
        ROUND(AVG(administered_mbq)::numeric, 1)            AS avg_mbq,
        ROUND(AVG(patient_weight_kg)::numeric, 1)           AS avg_weight_kg
      FROM petct_examinations
      GROUP BY radiopharmaceutical
      ORDER BY count DESC
    `);

    // ── Distribución por estado ────────────────────────────────────────────────
    const { rows: stateRows } = await sql.query(`
      SELECT
        state                                                AS name,
        COUNT(*)                                             AS value
      FROM petct_examinations
      GROUP BY state
      ORDER BY value DESC
    `);

    // ── Tendencia: exámenes por día — últimos 30 días ─────────────────────────
    const { rows: trendRows } = await sql.query(`
      SELECT
        TO_CHAR(DATE(injection_datetime), 'DD/MM') AS fecha,
        COUNT(*)                                   AS examenes,
        ROUND(AVG(administered_mbq)::numeric, 1)   AS dosis_prom_mbq
      FROM petct_examinations
      WHERE DATE(injection_datetime) >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(injection_datetime)
      ORDER BY DATE(injection_datetime) ASC
    `);

    // ── Distribución por radionúclido ─────────────────────────────────────────
    const { rows: nuclideRows } = await sql.query(`
      SELECT
        radionuclide                                         AS name,
        COUNT(*)                                             AS value
      FROM petct_examinations
      GROUP BY radionuclide
      ORDER BY value DESC
    `);

    // ── Pacientes activos (en_espera o en_examen) con datos de dosimetría ─────
    const { rows: activeRows } = await sql.query(`
      SELECT
        id, patient_id, patient_name, radiopharmaceutical, radionuclide,
        administered_mbq, injection_datetime, uptake_minutes, state,
        exam_start, operator
      FROM petct_examinations
      WHERE state IN ('en_espera', 'en_examen')
      ORDER BY injection_datetime ASC
    `);

    // ── QC diario reciente ────────────────────────────────────────────────────
    const { rows: qcRows } = await sql.query(`
      SELECT
        qc_date, phantom_type, uniformity_pass, image_quality_pass, performed_by
      FROM petct_qc_daily
      ORDER BY qc_date DESC
      LIMIT 7
    `);

    // ── Dosis total (MBq) por semana — últimas 8 semanas ─────────────────────
    const { rows: weeklyRows } = await sql.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('week', injection_datetime), 'DD/MM') AS semana,
        COUNT(*)                                                   AS examenes,
        ROUND(SUM(administered_mbq)::numeric, 0)                  AS dosis_total_mbq
      FROM petct_examinations
      WHERE injection_datetime >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', injection_datetime)
      ORDER BY DATE_TRUNC('week', injection_datetime) ASC
    `);

    return NextResponse.json({
      kpi,
      pharmaDistribution: pharmaRows,
      stateDistribution: stateRows,
      nuclideDistribution: nuclideRows,
      trend30d: trendRows,
      weeklyActivity: weeklyRows,
      activePatients: activeRows,
      recentQc: qcRows,
    });
  } catch (err) {
    console.error("[petct/dashboard GET]", err);
    return NextResponse.json({ error: "Error al calcular dashboard PET/CT" }, { status: 500 });
  }
}
