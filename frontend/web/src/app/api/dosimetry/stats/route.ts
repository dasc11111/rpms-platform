import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const yearStr = String(year);

  try {
    // 1. Dosis colectiva y estadísticas por servicio para el año
    const { rows: byService } = await sql`
      SELECT
        COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio') AS service,
        COUNT(DISTINCT d.worker_rut)::int AS workers,
        ROUND(SUM(d.dose)::numeric, 2) AS collective_dose,
        ROUND(AVG(d.dose)::numeric, 3) AS avg_dose,
        ROUND(MAX(d.dose)::numeric, 3) AS max_dose,
        COUNT(CASE WHEN d.dose > 20 THEN 1 END)::int AS above_20msv,
        COUNT(CASE WHEN d.dose > 50 THEN 1 END)::int AS above_50msv
      FROM dosimetry_readings d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      WHERE (
        d.period LIKE ${yearStr + '-%'}
        OR d.period LIKE ${'%/' + yearStr}
        OR d.period LIKE ${yearStr + '%'}
      )
        AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
        AND d.status NOT IN ('lost', 'not_worn', 'damaged')
      GROUP BY 1
      ORDER BY collective_dose DESC
      LIMIT 20
    `;

    // 2. Tendencia mensual dosis colectiva (últimos 12 meses)
    const { rows: trend } = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE(d.measured_at, NOW())), 'YYYY-MM') AS month,
        ROUND(SUM(d.dose)::numeric, 2) AS collective_dose,
        COUNT(DISTINCT d.worker_rut)::int AS workers_monitored
      FROM dosimetry_readings d
      WHERE d.measured_at >= NOW() - INTERVAL '12 months'
        AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
        AND d.status NOT IN ('lost', 'not_worn', 'damaged')
      GROUP BY 1
      ORDER BY 1
    `;

    // 3. Dosis acumulada anual por trabajador — top riesgo
    const { rows: atRisk } = await sql`
      SELECT
        d.worker_name,
        d.worker_rut,
        COALESCE(w.category, 'B') AS category,
        COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio') AS service,
        ROUND(SUM(d.dose)::numeric, 3) AS annual_dose,
        CASE COALESCE(w.category, 'B')
          WHEN 'A' THEN 50
          ELSE 15
        END AS limit_msv,
        ROUND(
          100.0 * SUM(d.dose) /
          CASE COALESCE(w.category, 'B') WHEN 'A' THEN 50 ELSE 15 END
        ::numeric, 1) AS pct_of_limit
      FROM dosimetry_readings d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      WHERE (
        d.period LIKE ${yearStr + '-%'}
        OR d.period LIKE ${'%/' + yearStr}
        OR d.period LIKE ${yearStr + '%'}
      )
        AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
        AND d.status NOT IN ('lost', 'not_worn', 'damaged')
      GROUP BY d.worker_name, d.worker_rut, w.category, service
      HAVING SUM(d.dose) >= 5
      ORDER BY pct_of_limit DESC
      LIMIT 20
    `;

    // 4. Distribución por rango de dosis (histograma)
    const { rows: histogram } = await sql`
      WITH annual AS (
        SELECT
          d.worker_rut,
          d.worker_name,
          SUM(d.dose) AS total_dose
        FROM dosimetry_readings d
        WHERE (
          d.period LIKE ${yearStr + '-%'}
          OR d.period LIKE ${'%/' + yearStr}
          OR d.period LIKE ${yearStr + '%'}
        )
          AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
          AND d.status NOT IN ('lost', 'not_worn', 'damaged')
        GROUP BY d.worker_rut, d.worker_name
      )
      SELECT
        CASE
          WHEN total_dose < 1   THEN '< 1 mSv'
          WHEN total_dose < 5   THEN '1–5 mSv'
          WHEN total_dose < 10  THEN '5–10 mSv'
          WHEN total_dose < 15  THEN '10–15 mSv'
          WHEN total_dose < 20  THEN '15–20 mSv'
          WHEN total_dose < 50  THEN '20–50 mSv'
          ELSE '≥ 50 mSv'
        END AS range,
        COUNT(*)::int AS workers,
        CASE
          WHEN total_dose < 1   THEN 1
          WHEN total_dose < 5   THEN 2
          WHEN total_dose < 10  THEN 3
          WHEN total_dose < 15  THEN 4
          WHEN total_dose < 20  THEN 5
          WHEN total_dose < 50  THEN 6
          ELSE 7
        END AS sort_order
      FROM annual
      GROUP BY 1, 3
      ORDER BY 3
    `;

    // 5. Resumen global del año
    const { rows: summary } = await sql`
      SELECT
        COUNT(DISTINCT d.worker_rut)::int AS total_workers,
        ROUND(SUM(d.dose)::numeric, 2) AS total_collective_dose,
        ROUND(AVG(d.dose)::numeric, 3) AS mean_individual_dose,
        ROUND(MAX(d.dose)::numeric, 3) AS max_individual_dose,
        COUNT(CASE WHEN d.dose > 20 THEN 1 END)::int AS above_20msv,
        COUNT(CASE WHEN d.dose > 50 THEN 1 END)::int AS above_50msv,
        COUNT(d.id)::int AS total_readings
      FROM dosimetry_readings d
      WHERE (
        d.period LIKE ${yearStr + '-%'}
        OR d.period LIKE ${'%/' + yearStr}
        OR d.period LIKE ${yearStr + '%'}
      )
        AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
        AND d.status NOT IN ('lost', 'not_worn', 'damaged')
    `;

    return NextResponse.json({
      year,
      summary: summary[0] ?? {
        total_workers: 0,
        total_collective_dose: 0,
        mean_individual_dose: 0,
        max_individual_dose: 0,
        above_20msv: 0,
        above_50msv: 0,
        total_readings: 0,
      },
      by_service: byService,
      trend,
      at_risk: atRisk,
      histogram,
    });
  } catch (err) {
    console.error("[dosimetry/stats GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
