import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
  paciente: "paciente_nombre",
  run: "paciente_run",
  radiofarmaco: "radiofarmaco",
  medico_solicitante: "medico_solicitante",
  procedencia: "procedencia",
  diagnostico: "diagnostico",
  tipo_examen: "tipo_examen",
  equipo: "equipo",
  motivo: "motivo",
  protocolo: "protocolo",
  prevision: "prevision",
  ficha_clinica: "ficha_clinica",
  partida: "partida",
  pedido_numero: "pedido_numero",
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

  const year = searchParams.get("year");
  if (year) {
    params.push(Number(year));
    conditions.push(`admin_year = $${params.length}`);
  }
  const month = searchParams.get("month");
  if (month) {
    params.push(Number(month));
    conditions.push(`admin_month = $${params.length}`);
  }
  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`admin_date >= $${params.length}`);
  }
  const dateTo = searchParams.get("dateTo");
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`admin_date <= $${params.length}`);
  }
  const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(
      `(paciente_nombre ILIKE $${idx} OR ficha_clinica ILIKE $${idx} OR paciente_run ILIKE $${idx} OR pedido_numero ILIKE $${idx} OR partida ILIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

// Dashboard 100% automatico: todos los indicadores se recalculan en cada
// llamada directamente desde la base de datos (sin cache ni botones de
// actualizacion). Responde a los mismos filtros que la busqueda avanzada.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { where, params } = buildFilters(searchParams);
  const andWhere = where ? `${where} AND` : "WHERE";

  const totalsQuery = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE admin_date = CURRENT_DATE)::int AS today,
      COUNT(*) FILTER (WHERE admin_year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND admin_month = EXTRACT(MONTH FROM CURRENT_DATE)::int)::int AS this_month,
      COUNT(*) FILTER (WHERE admin_year = EXTRACT(YEAR FROM CURRENT_DATE)::int)::int AS this_year,
      COUNT(DISTINCT lower(paciente_nombre))::int AS patients,
      COUNT(DISTINCT tipo_examen) FILTER (WHERE tipo_examen IS NOT NULL AND tipo_examen <> '')::int AS studies,
      COALESCE(MAX(dosis_administrada), 0) AS max_dosis,
      COALESCE(AVG(dosis_administrada), 0) AS avg_dosis,
      COALESCE(SUM(dosis_administrada), 0) AS total_dosis,
      MIN(admin_date) AS first_date,
      MAX(admin_date) AS last_date
    FROM i131_administrations
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
    FROM i131_administrations
    ${andWhere} ${column} IS NOT NULL AND ${column} <> ''
    GROUP BY ${column}
    ORDER BY count DESC
    LIMIT 15
  `;

  const [
    porRadiofarmaco,
    porTipoExamen,
    porMedico,
    porProcedencia,
    porDiagnostico,
    porEquipo,
    porPrevision,
  ] = await Promise.all([
    sql.query(
      `SELECT radiofarmaco, COUNT(*)::int AS count, COALESCE(SUM(dosis_administrada),0) AS total_dosis
       FROM i131_administrations ${andWhere} radiofarmaco IS NOT NULL AND radiofarmaco <> ''
       GROUP BY radiofarmaco ORDER BY count DESC LIMIT 15`,
      params
    ),
    sql.query(groupQuery("tipo_examen", "tipo_examen"), params),
    sql.query(groupQuery("medico_solicitante", "medico_solicitante"), params),
    sql.query(groupQuery("procedencia", "procedencia"), params),
    sql.query(groupQuery("diagnostico", "diagnostico"), params),
    sql.query(groupQuery("equipo", "equipo"), params),
    sql.query(groupQuery("prevision", "prevision"), params),
  ]);

  const tendenciaMensualRes = await sql.query(
    `SELECT admin_year AS year, admin_month AS month, COUNT(*)::int AS count,
            COALESCE(SUM(dosis_administrada),0) AS total_dosis
     FROM i131_administrations
     ${where}
     GROUP BY admin_year, admin_month
     ORDER BY admin_year, admin_month`,
    params
  );

  const evolucionAnualRes = await sql.query(
    `SELECT admin_year AS year, COUNT(*)::int AS count,
            COALESCE(SUM(dosis_administrada),0) AS total_dosis
     FROM i131_administrations
     ${where}
     GROUP BY admin_year
     ORDER BY admin_year`,
    params
  );

  const radiofarmacoTop = porRadiofarmaco.rows[0] ?? null;

  return NextResponse.json({
    totals: {
      total: totals.total ?? 0,
      today: totals.today ?? 0,
      month: totals.this_month ?? 0,
      year: totals.this_year ?? 0,
      patients: totals.patients ?? 0,
      studies: totals.studies ?? 0,
      maxDosis: Number(totals.max_dosis ?? 0),
      avgDosis: Number(totals.avg_dosis ?? 0),
      totalDosis: Number(totals.total_dosis ?? 0),
      promedioDiario: Number(((totals.total ?? 0) / diasActivos).toFixed(2)),
      promedioMensual: Number(((totals.total ?? 0) / mesesActivos).toFixed(2)),
    },
    radiofarmacoTop,
    porRadiofarmaco: porRadiofarmaco.rows,
    porTipoExamen: porTipoExamen.rows,
    porMedico: porMedico.rows,
    porProcedencia: porProcedencia.rows,
    porDiagnostico: porDiagnostico.rows,
    porEquipo: porEquipo.rows,
    porPrevision: porPrevision.rows,
    tendenciaMensual: tendenciaMensualRes.rows,
    evolucionAnual: evolucionAnualRes.rows,
  });
}
