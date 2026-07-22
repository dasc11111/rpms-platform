import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
    CONTAMINATION_SUGGESTION_FIELDS,
    buildMonitorDate,
    buildDedupeKey,
    calcConteoNeto,
    calcActividadBqCm2,
    bqCm2ToBqM2,
    clasificarPorcentaje,
    CLASIFICACION_SEMAFORO,
    calcFactorDescontaminacion,
    calcPctActividadResidual,
} from "@/lib/contamination";

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

const SORTABLE = new Set([
    "monitor_date",
    "punto_medicion",
    "radionuclido",
    "actividad_bq_m2",
    "pct_limite",
    "clasificacion",
    "estado",
    "created_at",
    "area",
    "sala",
    "responsable",
  ]);

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
    const day = searchParams.get("day");
    if (day) {
          params.push(Number(day));
          conditions.push(`monitor_day = $${params.length}`);
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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const { where, params } = buildFilters(searchParams);

  const sortField = searchParams.get("sort") ?? "monitor_date";
    const sortCol = SORTABLE.has(sortField) ? sortField : "monitor_date";
    const dir = searchParams.get("dir") === "asc" ? "ASC" : "DESC";

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));
    const offset = (page - 1) * pageSize;

  const countQuery = `SELECT COUNT(*)::int AS count FROM contamination_records ${where}`;
    const { rows: countRows } = await sql.query(countQuery, params);
    const total = countRows[0]?.count ?? 0;

  const dataParams = [...params, pageSize, offset];
    const dataQuery = `
        SELECT * FROM contamination_records
            ${where}
                ORDER BY ${sortCol} ${dir}, id ${dir}
                    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                      `;
    const { rows } = await sql.query(dataQuery, dataParams);

  return NextResponse.json({ rows, total, page, pageSize });
}

async function upsertSuggestions(body: Record<string, unknown>) {
    for (const field of CONTAMINATION_SUGGESTION_FIELDS) {
          const value = body[field];
          if (typeof value === "string" && value.trim()) {
                  await sql`
                          INSERT INTO contamination_field_suggestions (field_name, value, usage_count, last_used_at)
                                  VALUES (${field}, ${value.trim()}, 1, now())
                                          ON CONFLICT (field_name, value) DO UPDATE SET
                                                    usage_count = contamination_field_suggestions.usage_count + 1,
                                                              last_used_at = now()
                                                                    `;
          }
    }
}

async function logHistory(recordId: number, action: string, snapshot: unknown, actor: string | null) {
    await sql`
        INSERT INTO contamination_history (record_id, action, changed_by, snapshot)
            VALUES (${recordId}, ${action}, ${actor}, ${JSON.stringify(snapshot)})
              `;
}

type LimiteRow = {
    limite_bq_m2: number;
    pct_registro: number;
    pct_investigacion: number;
    pct_intervencion: number;
};

async function getLimiteAplicable(radionuclido: string): Promise<LimiteRow | null> {
    const { rows } = await sql`
        SELECT * FROM contamination_limits WHERE radionuclido = ${radionuclido}
          `;
    if (rows[0]) return rows[0] as unknown as LimiteRow;
    const { rows: fallback } = await sql`
        SELECT * FROM contamination_limits WHERE radionuclido = 'GENERICO'
          `;
    return (fallback[0] as unknown as LimiteRow) ?? null;
}

export function calcularDerivados(input: {
    conteo_bruto_cps: number;
    fondo_cps: number;
    factor_eficiencia: number;
    area_monitoreada_cm2: number;
    conteo_post_limpieza_cps: number | null;
    limite: LimiteRow | null;
}) {
    const conteo_neto_cps = calcConteoNeto(input.conteo_bruto_cps, input.fondo_cps);
    const actividad_bq_cm2 = calcActividadBqCm2(conteo_neto_cps, input.factor_eficiencia, input.area_monitoreada_cm2);
    const actividad_bq_m2 = bqCm2ToBqM2(actividad_bq_cm2);

  let pct_limite: number | null = null;
    let clasificacion = "sin_contaminacion";
    let semaforo = "verde";
    let limite_bq_m2_aplicado: number | null = null;

  if (input.limite) {
        limite_bq_m2_aplicado = Number(input.limite.limite_bq_m2);
        pct_limite = limite_bq_m2_aplicado ? (actividad_bq_m2 / limite_bq_m2_aplicado) * 100 : 0;
        clasificacion = clasificarPorcentaje(pct_limite, {
                pct_registro: Number(input.limite.pct_registro),
                pct_investigacion: Number(input.limite.pct_investigacion),
                pct_intervencion: Number(input.limite.pct_intervencion),
        });
        semaforo = CLASIFICACION_SEMAFORO[clasificacion as keyof typeof CLASIFICACION_SEMAFORO];
  }

  let actividad_post_limpieza_bq_cm2: number | null = null;
    let factor_descontaminacion: number | null = null;
    let pct_actividad_residual: number | null = null;
    if (input.conteo_post_limpieza_cps !== null && input.conteo_post_limpieza_cps !== undefined) {
          const netoPost = calcConteoNeto(input.conteo_post_limpieza_cps, input.fondo_cps);
          actividad_post_limpieza_bq_cm2 = calcActividadBqCm2(netoPost, input.factor_eficiencia, input.area_monitoreada_cm2);
          factor_descontaminacion = calcFactorDescontaminacion(actividad_bq_cm2, actividad_post_limpieza_bq_cm2);
          pct_actividad_residual = calcPctActividadResidual(actividad_bq_cm2, actividad_post_limpieza_bq_cm2);
    }

  return {
        conteo_neto_cps,
        actividad_bq_cm2,
        actividad_bq_m2,
        pct_limite,
        clasificacion,
        semaforo,
        limite_bq_m2_aplicado,
        actividad_post_limpieza_bq_cm2,
        factor_descontaminacion,
        pct_actividad_residual,
  };
}

export async function POST(req: NextRequest) {
    const body = await req.json();

  const monitor_year = Number(body.monitor_year);
    const monitor_month = Number(body.monitor_month);
    const monitor_day = Number(body.monitor_day);
    const punto_medicion = (body.punto_medicion ?? "").toString().trim();
    const radionuclido = (body.radionuclido ?? "TC-99M").toString().trim() || "TC-99M";
    const responsable = (body.responsable ?? "").toString().trim();

  const errors: string[] = [];
    if (!monitor_year || monitor_year < 2000 || monitor_year > 2100) errors.push("Año inválido");
    if (!monitor_month || monitor_month < 1 || monitor_month > 12) errors.push("Mes inválido");
    if (!monitor_day || monitor_day < 1 || monitor_day > 31) errors.push("Día inválido");
    if (!punto_medicion) errors.push("El punto de medición es obligatorio");
    if (!responsable) errors.push("El responsable es obligatorio");
    if (body.conteo_bruto_cps !== undefined && Number(body.conteo_bruto_cps) < 0)
          errors.push("El conteo bruto no puede ser negativo");
    if (body.fondo_cps !== undefined && Number(body.fondo_cps) < 0) errors.push("El fondo no puede ser negativo");
    if (errors.length) {
          return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

  const monitor_date = buildMonitorDate(monitor_year, monitor_month, monitor_day);

  if (!body.force) {
        const { rows: existing } = await sql`
              SELECT id, monitor_date, punto_medicion, radionuclido FROM contamination_records
                    WHERE monitor_date = ${monitor_date} AND lower(punto_medicion) = lower(${punto_medicion}) AND lower(radionuclido) = lower(${radionuclido})
                        `;
        if (existing.length > 0) {
                return NextResponse.json({ duplicate: true, existing }, { status: 409 });
        }
  }

  const factor_eficiencia = body.factor_eficiencia ? Number(body.factor_eficiencia) : 0.15;
    const area_monitoreada_cm2 = body.area_monitoreada_cm2 ? Number(body.area_monitoreada_cm2) : 15;
    const conteo_bruto_cps = Number(body.conteo_bruto_cps ?? 0);
    const fondo_cps = Number(body.fondo_cps ?? 0);
    const conteo_post_limpieza_cps =
          body.conteo_post_limpieza_cps !== undefined &&
          body.conteo_post_limpieza_cps !== null &&
          body.conteo_post_limpieza_cps !== ""
        ? Number(body.conteo_post_limpieza_cps)
            : null;

  const limite = await getLimiteAplicable(radionuclido);
    const derivados = calcularDerivados({
          conteo_bruto_cps,
          fondo_cps,
          factor_eficiencia,
          area_monitoreada_cm2,
          conteo_post_limpieza_cps,
          limite,
    });

  const requiere_limpieza = derivados.clasificacion === "cercano_limite" || derivados.clasificacion === "sobre_limite";

  const dedupeKey =
        buildDedupeKey({
                monitor_date,
                punto_medicion,
                radionuclido,
                conteo_bruto_cps,
        }) + (body.force ? `|${Date.now()}` : "");

  const { rows } = await sql`
      INSERT INTO contamination_records (
            monitor_year, monitor_month, monitor_day, monitor_date,
                  area, sala, dependencia, punto_medicion, equipo, superficie,
                        radionuclido, instrumento, numero_serie_detector, factor_calibracion,
                              factor_eficiencia, area_monitoreada_cm2, tiempo_medicion_seg,
                                    fondo_cps, conteo_bruto_cps, conteo_neto_cps,
                                          actividad_bq_cm2, actividad_bq_m2, tasa_dosis_usv_h,
                                                limite_bq_m2_aplicado, pct_limite, clasificacion, semaforo,
                                                      requiere_limpieza, limpieza_realizada,
                                                            conteo_post_limpieza_cps, actividad_post_limpieza_bq_cm2,
                                                                  factor_descontaminacion, pct_actividad_residual,
                                                                        accion_correctiva, estado, motivo, responsable, observaciones, dedupe_key
                                                                            ) VALUES (
                                                                                  ${monitor_year}, ${monitor_month}, ${monitor_day}, ${monitor_date},
                                                                                        ${body.area ?? null}, ${body.sala ?? null}, ${body.dependencia ?? null}, ${punto_medicion}, ${body.equipo ?? null}, ${body.superficie ?? null},
                                                                                              ${radionuclido}, ${body.instrumento ?? null}, ${body.numero_serie_detector ?? null}, ${body.factor_calibracion ? Number(body.factor_calibracion) : null},
                                                                                                    ${factor_eficiencia}, ${area_monitoreada_cm2}, ${body.tiempo_medicion_seg ? Number(body.tiempo_medicion_seg) : null},
                                                                                                          ${fondo_cps}, ${conteo_bruto_cps}, ${derivados.conteo_neto_cps},
                                                                                                                ${derivados.actividad_bq_cm2}, ${derivados.actividad_bq_m2}, ${body.tasa_dosis_usv_h ? Number(body.tasa_dosis_usv_h) : null},
                                                                                                                      ${derivados.limite_bq_m2_aplicado}, ${derivados.pct_limite}, ${derivados.clasificacion}, ${derivados.semaforo},
                                                                                                                            ${requiere_limpieza}, ${Boolean(body.limpieza_realizada)},
                                                                                                                                  ${conteo_post_limpieza_cps}, ${derivados.actividad_post_limpieza_bq_cm2},
                                                                                                                                        ${derivados.factor_descontaminacion}, ${derivados.pct_actividad_residual},
                                                                                                                                              ${body.accion_correctiva ?? null}, ${body.estado ?? "ABIERTO"}, ${body.motivo ?? null}, ${responsable}, ${body.observaciones ?? null}, ${dedupeKey}
                                                                                                                                                  )
                                                                                                                                                      RETURNING *
                                                                                                                                                        `;

  const created = rows[0]!;
    await logHistory(created.id, "create", created, responsable);
    await upsertSuggestions({ ...body, punto_medicion, radionuclido, responsable });

  return NextResponse.json({ row: created }, { status: 201 });
}
