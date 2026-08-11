import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
    ensureWasteEngineV2,
    calcActaActividadBqCm2,
    evaluaCriterioUniversal,
    getHalfLifeDaysForRadionuclide,
    computeProyeccionDesdeUltimaMedicion,
    WASTE_DISPENSA_ESTADO_LABELS,
  } from "@/lib/waste";

export const dynamic = "force-dynamic";

const VALID_TIPOS = ["seguimiento", "verificacion_final", "dispensa"];

// Historial de mediciones de un rotulo: nunca se sobrescribe una medicion
// anterior, siempre se agrega una fila nueva (trazabilidad completa).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    await ensureWasteEngineV2();
    const { id } = await params;
    const { rows } = await sql`
      SELECT * FROM waste_measurements WHERE label_id = ${Number(id)} ORDER BY fecha ASC, id ASC
    `;
    return NextResponse.json({ rows });
  }

// Registra una nueva medicion del residuo (seguimiento, verificacion final o
                                            // confirmacion de dispensa). A partir de ella recalcula en vivo el estado de
// dispensa del rotulo siguiendo el criterio universal (Bq/cm2 <= 4 Y tasa de
                                                        // dosis < 2.5 uSv/h) y, cuando corresponde, una nueva fecha estimada de
// eliminacion proyectada SIEMPRE desde esta ultima medicion real (nunca
                                                                   // desde la actividad inicial de generacion).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    await ensureWasteEngineV2();
    const { id } = await params;
    const labelId = Number(id);
    const { rows: labelRows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${labelId}`;
    const label = labelRows[0];
    if (!label) {
          return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
        }
    if (!label.radionuclide_code) {
          return NextResponse.json(
                  { error: "El rótulo no tiene un radionúclido identificado; no se puede calcular la dispensa." },
                  { status: 400 }
                );
        }

    const body = await req.json();
    const tipo = body.tipo ? String(body.tipo) : "seguimiento";
    if (!VALID_TIPOS.includes(tipo)) {
          return NextResponse.json({ error: "Tipo de medición inválido." }, { status: 400 });
        }

    if (tipo === "dispensa") {
          if (label.dispensa_estado !== "apto_para_dispensa") {
                  return NextResponse.json(
                            { error: "Debe registrar primero una verificación final APTA PARA DISPENSA antes de confirmar la dispensa." },
                            { status: 400 }
                          );
                }
          const usuario = body.usuario ? String(body.usuario) : null;
          if (!usuario) {
                  return NextResponse.json({ error: "Debe indicar el usuario que confirma la dispensa." }, { status: 400 });
                }
          const fecha = body.fecha ? String(body.fecha) : new Date().toISOString().slice(0, 10);
          const { rows: lastRows } = await sql`
            SELECT * FROM waste_measurements WHERE label_id = ${labelId} ORDER BY fecha DESC, id DESC LIMIT 1
          `;
          const last = lastRows[0];
          const { rows: measRows } = await sql`
            INSERT INTO waste_measurements (
                      label_id, tipo, fecha, hora, cps, cps_fondo, cps_neto, bq_cm2, tasa_dosis_usv_h,
                      instrumento, usuario, cumple_contaminacion, cumple_tasa_dosis, resultado, observaciones
                    ) VALUES (
                      ${labelId}, 'dispensa', ${fecha}, ${body.hora ?? null}, ${last?.cps ?? null}, ${last?.cps_fondo ?? null}, ${last?.cps_neto ?? null}, ${last?.bq_cm2 ?? null}, ${last?.tasa_dosis_usv_h ?? null},
                      ${body.instrumento ?? last?.instrumento ?? null}, ${usuario}, ${last?.cumple_contaminacion ?? null}, ${last?.cumple_tasa_dosis ?? null}, 'DISPENSADO', ${body.observaciones ?? null}
                    ) RETURNING *
          `;
          const { rows: updRows } = await sql`
            UPDATE radioactive_waste_labels SET
              dispensa_estado = 'dispensado',
              fecha_dispensa = ${fecha},
              dispensado_por = ${usuario},
              status = 'liberado',
              updated_at = now()
            WHERE id = ${labelId}
            RETURNING *
          `;
          await sql`
            INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
            VALUES (${labelId}, ${label.label_number}, 'dispensado', ${usuario}, ${JSON.stringify(updRows[0])})
          `;
          return NextResponse.json({ row: updRows[0], measurement: measRows[0] }, { status: 201 });
        }

    const fecha = body.fecha ? String(body.fecha) : new Date().toISOString().slice(0, 10);
    if (Number.isNaN(new Date(fecha).getTime())) {
          return NextResponse.json({ error: "Fecha de medición inválida." }, { status: 400 });
        }
    const cps = body.cps === null || body.cps === undefined || body.cps === "" ? null : Number(body.cps);
    if (cps === null || Number.isNaN(cps) || cps < 0) {
          return NextResponse.json({ error: "Debe ingresar CPS medida (numérico, no negativo)." }, { status: 400 });
        }
    const cpsFondo = body.cps_fondo === null || body.cps_fondo === undefined || body.cps_fondo === "" ? 0 : Number(body.cps_fondo);
    if (Number.isNaN(cpsFondo) || cpsFondo < 0) {
          return NextResponse.json({ error: "CPS de fondo inválido." }, { status: 400 });
        }
    const tasaDosis =
      body.tasa_dosis_usv_h === null || body.tasa_dosis_usv_h === undefined || body.tasa_dosis_usv_h === ""
        ? null
        : Number(body.tasa_dosis_usv_h);
    if (tasaDosis !== null && (Number.isNaN(tasaDosis) || tasaDosis < 0)) {
          return NextResponse.json({ error: "Tasa de dosis inválida." }, { status: 400 });
        }
    if (tipo === "verificacion_final" && tasaDosis === null) {
          return NextResponse.json({ error: "La verificación final requiere registrar la tasa de dosis (µSv/h)." }, { status: 400 });
        }
    const usuario = body.usuario ? String(body.usuario) : label.responsible;

    const bqCm2 = calcActaActividadBqCm2(cps, cpsFondo);
    const criterio = evaluaCriterioUniversal(bqCm2, tasaDosis);

    const { rows: measRows } = await sql`
      INSERT INTO waste_measurements (
              label_id, tipo, fecha, hora, cps, cps_fondo, cps_neto, bq_cm2, tasa_dosis_usv_h,
              instrumento, usuario, cumple_contaminacion, cumple_tasa_dosis, resultado, observaciones
            ) VALUES (
              ${labelId}, ${tipo}, ${fecha}, ${body.hora ?? null}, ${cps}, ${cpsFondo}, ${Math.max(0, cps - cpsFondo)}, ${bqCm2}, ${tasaDosis},
              ${body.instrumento ?? null}, ${usuario}, ${criterio.cumpleContaminacion}, ${criterio.cumpleTasaDosis}, ${criterio.apto ? "APTO PARA DISPENSA" : "NO APTO PARA DISPENSA"}, ${body.observaciones ?? null}
            ) RETURNING *
    `;

    const halfLifeDays = await getHalfLifeDaysForRadionuclide(label.radionuclide_code);
    const proyeccion = computeProyeccionDesdeUltimaMedicion({
          ultimaBqCm2: bqCm2,
          fechaUltimaMedicion: fecha,
          halfLifeDays,
        });

    let dispensaEstado: string;
    if (tipo === "verificacion_final") {
          dispensaEstado = criterio.apto ? "apto_para_dispensa" : "no_apto";
        } else {
          dispensaEstado = proyeccion.aplica ? proyeccion.estado : "en_decaimiento";
        }

    const { rows: updRows } = await sql`
      UPDATE radioactive_waste_labels SET
        dispensa_estado = ${dispensaEstado},
        fecha_estimada_liberacion = ${proyeccion.aplica ? proyeccion.fechaEstimadaLiberacion : null},
        updated_at = now()
      WHERE id = ${labelId}
      RETURNING *
    `;

    await sql`
      INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
      VALUES (${labelId}, ${label.label_number}, ${tipo === "verificacion_final" ? "verificacion_final" : "medicion_seguimiento"}, ${usuario}, ${JSON.stringify(updRows[0])})
    `;

    return NextResponse.json(
          {
                  row: updRows[0],
                  measurement: measRows[0],
                  proyeccion,
                  dispensa_estado_label: WASTE_DISPENSA_ESTADO_LABELS[dispensaEstado] ?? dispensaEstado,
                },
          { status: 201 }
        );
  }
