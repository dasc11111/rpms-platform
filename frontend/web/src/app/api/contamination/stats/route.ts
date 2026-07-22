import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
    area: "area",
    sala: "sala",
    dependencia: "dependencia",
    punto_medicion: "punto_medicion",
    equipo: "equipo",
    superficie: "superficie",
    radionuclido: "radionuclido",
    instrumento: "instrumento",
    responsable: "responsable",
    motivo: "motivo",
    accion_correctiva: "accion_correctiva",
    observaciones: "observaciones",
};

function buildFilters(searchParams: URLSearchParams) {
    const conditions: string[] = [];
    const params: unknown[] = [];

  for (const [key, column] of Object.entries(FILTER_FIELDS)) {
        const val = searchParams.get(key);
        if (val) {
                params.push(`%${val}%`);
                conditions.push(`${column} ILIKE $${params.length}`);
        }
  }
    const estado = searchParams.get("estado");
    if (estado) {
          params.push(estado);
          conditions.push(`estado = $${params.length}`);
    }
    const clasificacion = searchParams.get("clasificacion");
    if (clasificacion) {
          params.push(clasificacion);
          conditions.push(`clasificacion = $${params.length}`);
    }
    const year = searchParams.get("year");
    if (year) {
          params.push(Number(year));
          conditions.push(`monitor_year = $${params.length}`);
    }
    const month = searchParams.get("month");
    if (month) {
          params.push(Number(month));
          conditions.push(`monitor_month = $${params.length}`);
    }
    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) {
          params.push(dateFrom);
          conditions.push(`monitor_date >= $${params.length}`);
    }
    const dateTo = searchParams.get("dateTo");
    if (dateTo) {
          params.push(dateTo);
          conditions.push(`monitor_date <= $${params.length}`);
    }
    const q = searchParams.get("q");
    if (q) {
          params.push(`%${q}%`);
          const idx = params.length;
          conditions.push(
                  `(punto_medicion ILIKE $${idx} OR observaciones ILIKE $${idx} OR accion_correctiva ILIKE $${idx} OR responsable ILIKE $${idx} OR area ILIKE $${idx} OR sala ILIKE $${idx})`
                );
    }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, params };
}

// Dashboard 100% automatico: todos los indicadores se recalculan en cada
// llamada directamente desde la base de datos (sin cache ni botones de
// actualizacion), respondiendo a los mismos filtros que la busqueda avanzada.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const { where, params } = buildFilters(searchParams);
    const andWhere = where ? `${where} AND` : "WHERE";

  const totalsQuery = `
      SELECT
            COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE monitor_date = CURRENT_DATE)::int AS today,
                        COUNT(*) FILTER (WHERE monitor_year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND monitor_month = EXTRACT(MONTH FROM CURRENT_DATE)::int)::int AS this_month,
                              COUNT(*) FILTER (WHERE monitor_year = EXTRACT(YEAR FROM CURRENT_DATE)::int)::int AS this_year,
                                    COUNT(DISTINCT lower(area)) FILTER (WHERE area IS NOT NULL AND area <> '')::int AS areas,
                                          COUNT(*) FILTER (WHERE clasificacion IN ('sin_contaminacion','bajo_referencia'))::int AS conformes,
                                                COUNT(*) FILTER (WHERE clasificacion = 'cercano_limite')::int AS cercanos,
                                                      COUNT(*) FILTER (WHERE clasificacion = 'sobre_limite')::int AS sobre_limite,
                                                            COALESCE(MAX(actividad_bq_m2), 0) AS max_actividad,
                                                                  COALESCE(AVG(actividad_bq_m2), 0) AS avg_actividad,
                                                                        MIN(monitor_date) AS first_date,
                                                                              MAX(monitor_date) AS last_date
                                                                                  FROM contamination_records
                                                                                      ${where}
                                                                                        `;
    const { rows: totalsRows } = await sql.query(totalsQuery, params);
    const totals = totalsRows[0] ?? {};

  let diasActivos = 1;
    let mesesActivos = 1;
    if (totals.first_date && totals.last_date) {
          const first = new Date(totals.first_date);
          const last = new Date(totals.last_date);
          diasActivos = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
          mesesActivos = Math.max(
                  1,
                  (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1
                );
    }

  const groupQuery = (column: string, alias: string) => `
      SELECT ${column} AS ${alias}, COUNT(*)::int AS count
          FROM contamination_records
              ${andWhere} ${column} IS NOT NULL AND ${column} <> ''
                  GROUP BY ${column}
                      ORDER BY count DESC
                          LIMIT 15
                            `;

  const [porRadionuclido, porSala, porArea, porInstrumento, porResponsable, porClasificacion] = await Promise.all([
        sql.query(groupQuery("radionuclido", "radionuclido"), params),
        sql.query(groupQuery("sala", "sala"), params),
        sql.query(groupQuery("area", "area"), params),
        sql.query(groupQuery("instrumento", "instrumento"), params),
        sql.query(groupQuery("responsable", "responsable"), params),
        sql.query(groupQuery("clasificacion", "clasificacion"), params),
      ]);

  const tendenciaMensualRes = await sql.query(
        `SELECT monitor_year AS year, monitor_month AS month, COUNT(*)::int AS count,
                    COALESCE(AVG(actividad_bq_m2),0) AS avg_actividad
                         FROM contamination_records
                              ${where}
                                   GROUP BY monitor_year, monitor_month
                                        ORDER BY monitor_year, monitor_month`,
        params
      );

  const evolucionAnualRes = await sql.query(
        `SELECT monitor_year AS year, COUNT(*)::int AS count,
                    COALESCE(AVG(actividad_bq_m2),0) AS avg_actividad
                         FROM contamination_records
                              ${where}
                                   GROUP BY monitor_year
                                        ORDER BY monitor_year`,
        params
      );

  const areasTopRes = await sql.query(
        `SELECT punto_medicion, COUNT(*)::int AS count
             FROM contamination_records
                  ${andWhere} punto_medicion IS NOT NULL AND punto_medicion <> ''
                       GROUP BY punto_medicion
                            ORDER BY count DESC
                                 LIMIT 10`,
        params
      );

  return NextResponse.json({
        totals: {
                total: totals.total ?? 0,
                today: totals.today ?? 0,
                month: totals.this_month ?? 0,
                year: totals.this_year ?? 0,
                areas: totals.areas ?? 0,
                conformes: totals.conformes ?? 0,
                cercanos: totals.cercanos ?? 0,
                sobreLimite: totals.sobre_limite ?? 0,
                maxActividad: Number(totals.max_actividad ?? 0),
                avgActividad: Number(totals.avg_actividad ?? 0),
                promedioDiario: Number(((totals.total ?? 0) / diasActivos).toFixed(2)),
                promedioMensual: Number(((totals.total ?? 0) / mesesActivos).toFixed(2)),
        },
        porRadionuclido: porRadionuclido.rows,
        porSala: porSala.rows,
        porArea: porArea.rows,
        porInstrumento: porInstrumento.rows,
        porResponsable: porResponsable.rows,
        porClasificacion: porClasificacion.rows,
        tendenciaMensual: tendenciaMensualRes.rows,
        evolucionAnual: evolucionAnualRes.rows,
        areasTop: areasTopRes.rows,
  });
}
