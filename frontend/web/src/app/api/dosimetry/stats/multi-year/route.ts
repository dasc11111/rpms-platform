import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dosimetry/stats/multi-year
 * Returns collective dose per service for multiple years.
 *
 * Query params:
 *   years (comma-separated, e.g. "2021,2022,2023,2024,2025") — defaults to last 5 years
 *   top   (integer) — limit to top N services by recent total; default 8
 *
 * Response:
 * {
 *   years: number[],
 *   services: string[],
 *   rows: { service: string, data: { year: number, collective_dose: number, workers: number }[] }[]
 * }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

  const yearsParam = searchParams.get("years");
  const years: number[] = yearsParam
    ? yearsParam.split(",").map((y) => parseInt(y.trim(), 10)).filter((y) => !isNaN(y) && y > 2000 && y <= currentYear + 1)
    : defaultYears;

  const topN = Math.min(parseInt(searchParams.get("top") ?? "8", 10), 20);

  if (years.length === 0) {
    return NextResponse.json({ years: [], services: [], rows: [] });
  }

  try {
    // Build a LIKE clause for each year — matches YYYY-*, */YYYY, YYYY*
    // We use unnest to avoid dynamic SQL
    const yearConditions = years.map((y) => String(y));

    // Raw multi-year query: aggregate by (year, service)
    const { rows: rawRows } = await sql`
      SELECT
        CASE
          WHEN d.period ~ '^\d{4}-'    THEN SUBSTRING(d.period, 1, 4)::int
          WHEN d.period ~ '/\d{4}$'    THEN SUBSTRING(d.period, LENGTH(d.period)-3, 4)::int
          WHEN d.period ~ '^\d{4}'     THEN SUBSTRING(d.period, 1, 4)::int
          ELSE NULL
        END AS year,
        COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio') AS service,
        COUNT(DISTINCT d.worker_rut)::int AS workers,
        ROUND(SUM(d.dose)::numeric, 2) AS collective_dose
      FROM dosimetry_readings d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      WHERE (
        d.body_region = 'whole_body' OR d.body_region IS NULL
      )
        AND d.status NOT IN ('lost', 'not_worn', 'damaged')
        AND CASE
          WHEN d.period ~ '^\d{4}-'    THEN SUBSTRING(d.period, 1, 4)
          WHEN d.period ~ '/\d{4}$'    THEN SUBSTRING(d.period, LENGTH(d.period)-3, 4)
          WHEN d.period ~ '^\d{4}'     THEN SUBSTRING(d.period, 1, 4)
          ELSE ''
        END = ANY(${yearConditions})
      GROUP BY 1, 2
      HAVING CASE
          WHEN d.period ~ '^\d{4}-'    THEN SUBSTRING(d.period, 1, 4)
          WHEN d.period ~ '/\d{4}$'    THEN SUBSTRING(d.period, LENGTH(d.period)-3, 4)
          WHEN d.period ~ '^\d{4}'     THEN SUBSTRING(d.period, 1, 4)
          ELSE ''
        END IS NOT NULL
      ORDER BY year, collective_dose DESC
    `;

    // Find top N services by total dose across all queried years
    const totals: Record<string, number> = {};
    for (const r of rawRows) {
      if (r.year === null) continue;
      const svc = r.service as string;
      totals[svc] = (totals[svc] ?? 0) + Number(r.collective_dose);
    }
    const topServices = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([svc]) => svc);

    // Build output: one row per service, data array per year
    const byService: Record<string, Record<number, { collective_dose: number; workers: number }>> = {};
    for (const r of rawRows) {
      if (r.year === null) continue;
      const svc = r.service as string;
      if (!topServices.includes(svc)) continue;
      if (!byService[svc]) byService[svc] = {};
      byService[svc][r.year as number] = {
        collective_dose: Number(r.collective_dose),
        workers: Number(r.workers),
      };
    }

    const rows = topServices.map((svc) => ({
      service: svc,
      data: years.map((y) => ({
        year: y,
        collective_dose: byService[svc]?.[y]?.collective_dose ?? 0,
        workers: byService[svc]?.[y]?.workers ?? 0,
      })),
    }));

    return NextResponse.json({ years, services: topServices, rows });
  } catch (err) {
    console.error("[dosimetry/stats/multi-year GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
