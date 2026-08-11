import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
    ensureWasteEngineV2,
    resolveActaPointKeyForWasteType,
    getHalfLifeDaysForRadionuclide,
    computeProyeccionDesdeUltimaMedicion,
    evaluaCriterioUniversal,
    WASTE_DISPENSA_ESTADO_LABELS,
    type ActaPuntoMedicion,
} from "@/lib/waste";

export const dynamic = "force-dynamic";

const VALID_WASTE_TYPES = [
    "capacho_i131",
    "generador_mo99_tc99m",
    "cortopunzante_tc99m",
    "ropa_cama",
    "basura_comun",
    "basura_bano",
    "otro",
  ];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    await ensureWasteEngineV2();
    const { id } = await params;
    const { rows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${Number(id)}`;
    const label = rows[0];
    if (!label) {
          return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
    }
    const { rows: history } = await sql`
        SELECT * FROM waste_label_history WHERE label_id = ${Number(id)} ORDER BY changed_at DESC
          `;
    const { rows: measurements } = await sql`
        SELECT * FROM waste_measurements WHERE label_id = ${Number(id)} ORDER BY fecha ASC, id ASC
          `;
    const roomRelease = label.room_release_id
      ? (await sql`SELECT * FROM room_release_records WHERE id = ${label.room_release_id}`).rows[0] ?? null
          : null;

  const lastMeasurement = measurements.length ? measurements[measurements.length - 1] : null;
    let ultimaBqCm2: number | null = lastMeasurement ? Number(lastMeasurement.bq_cm2) : null;
    let fechaUltimaMedicion: string | null = lastMeasurement ? String(lastMeasurement.fecha).slice(0, 10) : null;

  if (!lastMeasurement && label.actividad_superficial_inicial_bq_cm2 !== null && label.fecha_medicion_superficial) {
        ultimaBqCm2 = Number(label.actividad_superficial_inicial_bq_cm2);
        fechaUltimaMedicion = String(label.fecha_medicion_superficial).slice(0, 10);
  }

  const halfLifeDays = await getHalfLifeDaysForRadionuclide(label.radionuclide_code);
    const proyeccion = computeProyeccionDesdeUltimaMedicion({
          ultimaBqCm2,
          fechaUltimaMedicion,
          halfLifeDays,
    });

  return NextResponse.json({
        row: label,
        history,
        measurements,
        roomRelease,
        proyeccion,
        dispensa_estado_label: WASTE_DISPENSA_ESTADO_LABELS[label.dispensa_estado] ?? label.dispensa_estado,
  });
}

// Correccion: ya no se solicita ni se guarda "Actividad residual" ni
// "Clasificación". Se agregan Tipo de residuo (incluye Capacho I-131,
// Generador Mo-99/Tc-99m, Cortopunzante Tc-99m, ademas de los derivados del
// Acta) y Ubicación de almacenamiento (dropdown parametrizable). Cuando el
// tipo de residuo de un rotulo derivado de un Acta cambia, se resuelve de
// nuevo el punto de medicion ya registrado (nunca se pide estimar a mano) y
// se agrega una nueva medicion de seguimiento con ese valor.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    await ensureWasteEngineV2();
    const { id } = await params;
    const labelId = Number(id);
    const body = await req.json();

  const { rows: existingRows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${labelId}`;
    const existing = existingRows[0];
    if (!existing) {
          return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
    }

  let wasteType: string | null = existing.waste_type;
    let wasteTypeOther: string | null = existing.waste_type_other;
    if (body.waste_type !== undefined) {
          const wt = body.waste_type === null || body.waste_type === "" ? null : String(body.waste_type);
          if (wt !== null && !VALID_WASTE_TYPES.includes(wt)) {
                  return NextResponse.json({ error: "Tipo de residuo inválido" }, { status: 400 });
          }
          wasteType = wt;
    }
    if (body.waste_type_other !== undefined) {
          wasteTypeOther =
                  body.waste_type_other === null || body.waste_type_other === "" ? null : String(body.waste_type_other).trim();
    }
    if (wasteType === "otro" && !wasteTypeOther) {
          return NextResponse.json(
            { error: 'Debe especificar el tipo de residuo cuando selecciona "Otro"' },
            { status: 400 }
                );
    }

  let storageLocationId: number | null = existing.storage_location_id;
    let storageLocationName: string | null = existing.storage_location;
    if (body.storage_location_id !== undefined) {
          if (body.storage_location_id === null || body.storage_location_id === "") {
                  storageLocationId = null;
                  storageLocationName = null;
          } else {
                  const locId = Number(body.storage_location_id);
                  const { rows: locRows } = await sql`SELECT * FROM waste_storage_locations WHERE id = ${locId}`;
                  const loc = locRows[0];
                  if (!loc) {
                            return NextResponse.json({ error: "Ubicación de almacenamiento inválida" }, { status: 400 });
                  }
                  storageLocationId = loc.id;
                  storageLocationName = loc.name;
          }
    }

  let puntoMedicionKey: string | null = existing.punto_medicion_key;
    let actividadSuperficialInicial: number | null = existing.actividad_superficial_inicial_bq_cm2;
    let fechaMedicionSuperficial: string | null = existing.fecha_medicion_superficial;
    let nuevaMedicionSeguimiento: { cps: number | null; cpsFondo: number | null; tasaDosis: number | null; fecha: string } | null = null;

  if (existing.room_release_id && (body.waste_type !== undefined || body.waste_type_other !== undefined)) {
        const resolvedKey = resolveActaPointKeyForWasteType(wasteType, wasteTypeOther);
        puntoMedicionKey = resolvedKey;
        actividadSuperficialInicial = null;
        fechaMedicionSuperficial = null;
        if (resolvedKey) {
                const { rows: releaseRows } = await sql`SELECT * FROM room_release_records WHERE id = ${existing.room_release_id}`;
                const release = releaseRows[0];
                const puntos = (release?.puntos_medicion ?? []) as ActaPuntoMedicion[];
                const found = puntos.find((p) => p.key === resolvedKey);
                if (found && release) {
                          actividadSuperficialInicial = found.actividad_bq_cm2;
                          fechaMedicionSuperficial = release.release_date;
                          nuevaMedicionSeguimiento = {
                                      cps: found.cps,
                                      cpsFondo: found.cps_fondo,
                                      tasaDosis: found.tasa_dosis_usv_h,
                                      fecha: String(release.release_date).slice(0, 10),
                          };
                }
        }
  }

  const { rows } = await sql`
      UPDATE radioactive_waste_labels SET
            waste_type = ${wasteType},
                  waste_type_other = ${wasteTypeOther},
                        container = ${body.container ?? existing.container},
                              storage_location = ${storageLocationName},
                                    storage_location_id = ${storageLocationId},
                                          punto_medicion_key = ${puntoMedicionKey},
                                                actividad_superficial_inicial_bq_cm2 = ${actividadSuperficialInicial},
                                                      fecha_medicion_superficial = ${fechaMedicionSuperficial},
                                                            observations = ${body.observations ?? existing.observations},
                                                                  status = ${body.status ?? existing.status},
                                                                        updated_at = now()
                                                                            WHERE id = ${labelId}
                                                                                RETURNING *
                                                                                  `;

  const updated = rows[0];
    if (!updated) {
          return NextResponse.json({ error: "No se pudo actualizar el rótulo" }, { status: 500 });
    }

  if (nuevaMedicionSeguimiento) {
        const bqCm2 = actividadSuperficialInicial ?? 0;
        const criterio = evaluaCriterioUniversal(bqCm2, nuevaMedicionSeguimiento.tasaDosis);
        await sql`
              INSERT INTO waste_measurements (
                      label_id, tipo, fecha, cps, cps_fondo, cps_neto, bq_cm2, tasa_dosis_usv_h,
                              usuario, cumple_contaminacion, cumple_tasa_dosis, resultado, observaciones
                                    ) VALUES (
                                            ${labelId}, 'seguimiento', ${nuevaMedicionSeguimiento.fecha}, ${nuevaMedicionSeguimiento.cps}, ${nuevaMedicionSeguimiento.cpsFondo},
                                                    ${Math.max(0, (nuevaMedicionSeguimiento.cps ?? 0) - (nuevaMedicionSeguimiento.cpsFondo ?? 0))}, ${bqCm2}, ${nuevaMedicionSeguimiento.tasaDosis},
                                                            ${updated.responsible}, ${criterio.cumpleContaminacion}, ${criterio.cumpleTasaDosis}, ${criterio.apto ? "APTO PARA DISPENSA" : "NO APTO PARA DISPENSA"},
                                                                    'Medicion tomada del Acta de Liberacion de Sala al asociar el tipo de residuo.'
                                                                          )
                                                                              `;
        const halfLifeDays = await getHalfLifeDaysForRadionuclide(updated.radionuclide_code);
        const proyeccion = computeProyeccionDesdeUltimaMedicion({
                ultimaBqCm2: bqCm2,
                fechaUltimaMedicion: nuevaMedicionSeguimiento.fecha,
                halfLifeDays,
        });
        const dispensaEstado = proyeccion.aplica ? proyeccion.estado : "en_decaimiento";
        await sql`
              UPDATE radioactive_waste_labels SET
                      dispensa_estado = ${dispensaEstado},
                              fecha_estimada_liberacion = ${proyeccion.aplica ? proyeccion.fechaEstimadaLiberacion : null},
                                      updated_at = now()
                                            WHERE id = ${labelId}
                                                `;
  }

  await sql`
      INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
          VALUES (${labelId}, ${updated.label_number}, 'updated', ${body.changed_by ?? null}, ${JSON.stringify(updated)})
            `;

  return NextResponse.json({ row: updated });
}
