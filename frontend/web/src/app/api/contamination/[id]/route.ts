import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { CONTAMINATION_SUGGESTION_FIELDS, buildMonitorDate, buildDedupeKey } from "@/lib/contamination";
import { calcularDerivados } from "../route";

export const dynamic = "force-dynamic";

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { rows } = await sql`SELECT * FROM contamination_records WHERE id = ${id}`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ row: rows[0] });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json();

  const { rows: currentRows } = await sql`SELECT * FROM contamination_records WHERE id = ${id}`;
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const monitor_year = Number(body.monitor_year ?? current.monitor_year);
    const monitor_month = Number(body.monitor_month ?? current.monitor_month);
    const monitor_day = Number(body.monitor_day ?? current.monitor_day);
    const punto_medicion = (body.punto_medicion ?? current.punto_medicion ?? "").toString().trim();
    const radionuclido = (body.radionuclido ?? current.radionuclido ?? "TC-99M").toString().trim() || "TC-99M";
    const responsable = (body.responsable ?? current.responsable ?? "").toString().trim();

  const errors: string[] = [];
    if (!monitor_year || monitor_year < 2000 || monitor_year > 2100) errors.push("Año inválido");
    if (!monitor_month || monitor_month < 1 || monitor_month > 12) errors.push("Mes inválido");
    if (!monitor_day || monitor_day < 1 || monitor_day > 31) errors.push("Día inválido");
    if (!punto_medicion) errors.push("El punto de medición es obligatorio");
    if (!responsable) errors.push("El responsable es obligatorio");
    if (errors.length) {
          return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

  const monitor_date = buildMonitorDate(monitor_year, monitor_month, monitor_day);

  if (!body.force) {
        const { rows: existing } = await sql`
              SELECT id FROM contamination_records
                    WHERE monitor_date = ${monitor_date} AND lower(punto_medicion) = lower(${punto_medicion})
                            AND lower(radionuclido) = lower(${radionuclido}) AND id <> ${id}
                                `;
        if (existing.length > 0) {
                return NextResponse.json({ duplicate: true, existing }, { status: 409 });
        }
  }

  const factor_eficiencia = body.factor_eficiencia !== undefined ? Number(body.factor_eficiencia) : Number(current.factor_eficiencia);
    const area_monitoreada_cm2 =
          body.area_monitoreada_cm2 !== undefined ? Number(body.area_monitoreada_cm2) : Number(current.area_monitoreada_cm2);
    const conteo_bruto_cps = body.conteo_bruto_cps !== undefined ? Number(body.conteo_bruto_cps) : Number(current.conteo_bruto_cps);
    const fondo_cps = body.fondo_cps !== undefined ? Number(body.fondo_cps) : Number(current.fondo_cps);
    const conteo_post_limpieza_cps =
          body.conteo_post_limpieza_cps !== undefined
        ? body.conteo_post_limpieza_cps === null || body.conteo_post_limpieza_cps === ""
              ? null
              : Number(body.conteo_post_limpieza_cps)
            : current.conteo_post_limpieza_cps !== null
          ? Number(current.conteo_post_limpieza_cps)
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

  const area = body.area ?? current.area;
    const sala = body.sala ?? current.sala;
    const dependencia = body.dependencia ?? current.dependencia;
    const equipo = body.equipo ?? current.equipo;
    const superficie = body.superficie ?? current.superficie;
    const instrumento = body.instrumento ?? current.instrumento;
    const numero_serie_detector = body.numero_serie_detector ?? current.numero_serie_detector;
    const factor_calibracion =
          body.factor_calibracion !== undefined ? Number(body.factor_calibracion) : current.factor_calibracion;
    const tiempo_medicion_seg =
          body.tiempo_medicion_seg !== undefined ? Number(body.tiempo_medicion_seg) : current.tiempo_medicion_seg;
    const tasa_dosis_usv_h = body.tasa_dosis_usv_h !== undefined ? Number(body.tasa_dosis_usv_h) : current.tasa_dosis_usv_h;
    const accion_correctiva = body.accion_correctiva ?? current.accion_correctiva;
    const estado = body.estado ?? current.estado;
    const motivo = body.motivo ?? current.motivo;
    const observaciones = body.observaciones ?? current.observaciones;
    const limpieza_realizada =
          body.limpieza_realizada !== undefined ? Boolean(body.limpieza_realizada) : Boolean(current.limpieza_realizada);

  const dedupeKey = buildDedupeKey({ monitor_date, punto_medicion, radionuclido, conteo_bruto_cps });

  const { rows } = await sql`
      UPDATE contamination_records SET
            monitor_year = ${monitor_year},
                  monitor_month = ${monitor_month},
                        monitor_day = ${monitor_day},
                              monitor_date = ${monitor_date},
                                    area = ${area},
                                          sala = ${sala},
                                                dependencia = ${dependencia},
                                                      punto_medicion = ${punto_medicion},
                                                            equipo = ${equipo},
                                                                  superficie = ${superficie},
                                                                        radionuclido = ${radionuclido},
                                                                              instrumento = ${instrumento},
                                                                                    numero_serie_detector = ${numero_serie_detector},
                                                                                          factor_calibracion = ${factor_calibracion},
                                                                                                factor_eficiencia = ${factor_eficiencia},
                                                                                                      area_monitoreada_cm2 = ${area_monitoreada_cm2},
                                                                                                            tiempo_medicion_seg = ${tiempo_medicion_seg},
                                                                                                                  fondo_cps = ${fondo_cps},
                                                                                                                        conteo_bruto_cps = ${conteo_bruto_cps},
                                                                                                                              conteo_neto_cps = ${derivados.conteo_neto_cps},
                                                                                                                                    actividad_bq_cm2 = ${derivados.actividad_bq_cm2},
                                                                                                                                          actividad_bq_m2 = ${derivados.actividad_bq_m2},
                                                                                                                                                tasa_dosis_usv_h = ${tasa_dosis_usv_h},
                                                                                                                                                      limite_bq_m2_aplicado = ${derivados.limite_bq_m2_aplicado},
                                                                                                                                                            pct_limite = ${derivados.pct_limite},
                                                                                                                                                                  clasificacion = ${derivados.clasificacion},
                                                                                                                                                                        semaforo = ${derivados.semaforo},
                                                                                                                                                                              requiere_limpieza = ${requiere_limpieza},
                                                                                                                                                                                    limpieza_realizada = ${limpieza_realizada},
                                                                                                                                                                                          conteo_post_limpieza_cps = ${conteo_post_limpieza_cps},
                                                                                                                                                                                                actividad_post_limpieza_bq_cm2 = ${derivados.actividad_post_limpieza_bq_cm2},
                                                                                                                                                                                                      factor_descontaminacion = ${derivados.factor_descontaminacion},
                                                                                                                                                                                                            pct_actividad_residual = ${derivados.pct_actividad_residual},
                                                                                                                                                                                                                  accion_correctiva = ${accion_correctiva},
                                                                                                                                                                                                                        estado = ${estado},
                                                                                                                                                                                                                              motivo = ${motivo},
                                                                                                                                                                                                                                    responsable = ${responsable},
                                                                                                                                                                                                                                          observaciones = ${observaciones},
                                                                                                                                                                                                                                                dedupe_key = ${dedupeKey},
                                                                                                                                                                                                                                                      updated_at = now()
                                                                                                                                                                                                                                                          WHERE id = ${id}
                                                                                                                                                                                                                                                              RETURNING *
                                                                                                                                                                                                                                                                `;

  const updated = rows[0]!;
    await logHistory(updated.id, "update", { before: current, after: updated }, responsable);
    await upsertSuggestions({ ...body, punto_medicion, radionuclido, responsable });

  return NextResponse.json({ row: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { rows: currentRows } = await sql`SELECT * FROM contamination_records WHERE id = ${id}`;
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await logHistory(Number(id), "delete", current, current.responsable ?? null);
    await sql`DELETE FROM contamination_records WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
}
