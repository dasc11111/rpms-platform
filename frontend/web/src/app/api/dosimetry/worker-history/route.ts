import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 Art. 7 — Límites de dosis ocupacional
const ANNUAL_LIMIT_MSV = 20; // mSv/año trabajador ocupacional
const FIVE_YEAR_LIMIT_MSV = 100; // mSv en 5 años consecutivos
const INVESTIGATION_THRESHOLD = 15; // mSv — acción de investigación

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("worker_id");
  const year = searchParams.get("year");

  try {
    if (workerId) {
      // Historial de dosis anuales para un trabajador específico
      const { rows: workerRows } = await sql`
        SELECT
          w.id, w.name, w.rut, w.role, w.department,
          w.authorization_number, w.authorization_expiry_date::text
        FROM workers w
        WHERE w.id = ${workerId} AND w.status <> 'inactive'
      `;
      if (workerRows.length === 0) {
        return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
      }
      const worker = workerRows[0];

      // Resumen anual de dosis (desde dosimetry_records)
      const { rows: annualRows } = await sql`
        SELECT
          year,
          ROUND(SUM(COALESCE(dose_whole_body_msv, 0))::numeric, 2) AS heff_msv,
          COUNT(*) AS periods
        FROM dosimetry_records
        WHERE worker_id = ${workerId}
        GROUP BY year
        ORDER BY year DESC
        LIMIT 10
      `;

      // Suma 5 años recientes para verificar límite quinquenal
      const currentYear = new Date().getFullYear();
      const { rows: fiveYearRows } = await sql`
        SELECT ROUND(SUM(COALESCE(dose_whole_body_msv, 0))::numeric, 2) AS total_5y
        FROM dosimetry_records
        WHERE worker_id = ${workerId}
          AND year BETWEEN ${currentYear - 4} AND ${currentYear}
      `;
      const total5y = parseFloat(fiveYearRows[0]?.total_5y ?? "0");

      // Dosis del año en curso
      const { rows: currentYearRows } = await sql`
        SELECT ROUND(SUM(COALESCE(dose_whole_body_msv, 0))::numeric, 2) AS heff_ytd
        FROM dosimetry_records
        WHERE worker_id = ${workerId} AND year = ${currentYear}
      `;
      const heffYtd = parseFloat(currentYearRows[0]?.heff_ytd ?? "0");

      return NextResponse.json({
        worker,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        annual_history: annualRows.map((r: any) => ({
          year: r.year,
          heff_msv: parseFloat(r.heff_msv),
          periods: parseInt(r.periods),
          limit_pct: Math.round((parseFloat(r.heff_msv) / ANNUAL_LIMIT_MSV) * 100),
          status:
            parseFloat(r.heff_msv) >= ANNUAL_LIMIT_MSV
              ? "exceeded"
              : parseFloat(r.heff_msv) >= INVESTIGATION_THRESHOLD
              ? "investigation"
              : parseFloat(r.heff_msv) >= ANNUAL_LIMIT_MSV * 0.5
              ? "elevated"
              : "normal",
        })),
        summary: {
          heff_ytd: heffYtd,
          total_5y: total5y,
          annual_limit: ANNUAL_LIMIT_MSV,
          five_year_limit: FIVE_YEAR_LIMIT_MSV,
          investigation_threshold: INVESTIGATION_THRESHOLD,
          ytd_pct: Math.round((heffYtd / ANNUAL_LIMIT_MSV) * 100),
          five_year_pct: Math.round((total5y / FIVE_YEAR_LIMIT_MSV) * 100),
          status:
            heffYtd >= ANNUAL_LIMIT_MSV
              ? "exceeded"
              : heffYtd >= INVESTIGATION_THRESHOLD
              ? "investigation"
              : heffYtd >= ANNUAL_LIMIT_MSV * 0.5
              ? "elevated"
              : "normal",
        },
      });
    }

    // Sin worker_id: resumen de todos los trabajadores con dosis en el año indicado o actual
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const { rows: summaryRows } = await sql`
      SELECT
        w.id,
        w.name,
        w.rut,
        w.department,
        w.role,
        ROUND(SUM(COALESCE(dr.dose_whole_body_msv, 0))::numeric, 2) AS heff_msv,
        COUNT(dr.id) AS periods
      FROM workers w
      LEFT JOIN dosimetry_records dr ON dr.worker_id = w.id AND dr.year = ${targetYear}
      WHERE w.status <> 'inactive'
      GROUP BY w.id, w.name, w.rut, w.department, w.role
      ORDER BY heff_msv DESC NULLS LAST
      LIMIT 100
    `;

    // 5-year totals for workers approaching limit
    const fiveYearData: Record<number, number> = {};
    try {
      const currentYear2 = new Date().getFullYear();
      const { rows: fy } = await sql`
        SELECT
          worker_id,
          ROUND(SUM(COALESCE(dose_whole_body_msv, 0))::numeric, 2) AS total_5y
        FROM dosimetry_records
        WHERE year BETWEEN ${currentYear2 - 4} AND ${currentYear2}
        GROUP BY worker_id
      `;
      for (const r of fy) {
        fiveYearData[r.worker_id] = parseFloat(r.total_5y);
      }
    } catch { /* ignore */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workers = summaryRows.map((r: any) => {
      const heff = parseFloat(r.heff_msv ?? "0");
      const fiveY = fiveYearData[r.id] ?? 0;
      return {
        id: r.id,
        name: r.name,
        rut: r.rut,
        department: r.department,
        role: r.role,
        heff_msv: heff,
        periods: parseInt(r.periods ?? "0"),
        total_5y: fiveY,
        ytd_pct: Math.round((heff / ANNUAL_LIMIT_MSV) * 100),
        five_year_pct: Math.round((fiveY / FIVE_YEAR_LIMIT_MSV) * 100),
        status:
          heff >= ANNUAL_LIMIT_MSV
            ? "exceeded"
            : heff >= INVESTIGATION_THRESHOLD
            ? "investigation"
            : heff >= ANNUAL_LIMIT_MSV * 0.5
            ? "elevated"
            : "normal",
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exceeded = workers.filter((w: any) => w.status === "exceeded").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const investigation = workers.filter((w: any) => w.status === "investigation").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elevated = workers.filter((w: any) => w.status === "elevated").length;

    return NextResponse.json({
      year: targetYear,
      workers,
      stats: { exceeded, investigation, elevated, total: workers.length },
      limits: {
        annual: ANNUAL_LIMIT_MSV,
        five_year: FIVE_YEAR_LIMIT_MSV,
        investigation: INVESTIGATION_THRESHOLD,
      },
    });
  } catch (err) {
    console.error(err);
    // If tables don't exist yet, return empty
    return NextResponse.json({
      year: new Date().getFullYear(),
      workers: [],
      stats: { exceeded: 0, investigation: 0, elevated: 0, total: 0 },
      limits: {
        annual: ANNUAL_LIMIT_MSV,
        five_year: FIVE_YEAR_LIMIT_MSV,
        investigation: INVESTIGATION_THRESHOLD,
      },
    });
  }
}
