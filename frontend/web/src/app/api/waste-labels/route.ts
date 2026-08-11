import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
    formatWasteLabelNumber,
    ensureWasteReleaseLimitsTable,
    ensureWasteLabelDispensaColumns,
    ensureWasteStorageInitialLocations,
    ensureWasteEngineV2,
    ensureWasteRoomReleaseIdNullable,
    isStandaloneWasteType,
    STANDALONE_WASTE_TYPE_RADIONUCLIDE,
    formatWasteLotNumber,
    calcActaActividadBqCm2,
    getHalfLifeDaysForRadionuclide,
    computeProyeccionDesdeUltimaMedicion,
    evaluaCriterioUniversal,
} from "@/lib/waste";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
    service: "service",
    sala: "sala",
    radionuclide: "radionuclide_code",
    status: "status",
};

const SORTABLE = new Set([
    "generation_date",
    "label_number",
    "service",
    "sala",
    "status",
    "created_at",
  ]);

function buildFilters(searchParams: URLSearchParams) {
    const conditions: string[] = [];
    const params: unknown[] = [];

  for (const [key, column] of Object.entries(FILTER_FIELDS)) {
        const val = searchParams.get(key);
        if (val) {
                params.push(val);
                conditions.push(`${column} = $${params.length}`);
        }
  }

  const year = searchParams.get("year");
    if (year) {
          params.push(Number(year));
          conditions.push(`label_year = $${params.length}`);
    }

  const q = searchParams.get("q");
    if (q) {
          params.push(`%${q}%`);
          const idx = params.length;
          conditions.push(
                  `(label_number ILIKE $${idx} OR paciente_nombre ILIKE $${idx} OR sala ILIKE $${idx} OR service ILIKE $${idx})`
                );
    }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, params };
}

export async function GET(req: NextRequest) {
    await ensureWasteLabelDispensaColumns();
    const { searchParams } = new URL(req.url);
    const { where, params } = buildFilters(searchParams);

  const sortField = searchParams.get("sort") ?? "generation_date";
    const sortCol = SORTABLE.has(sortField) ? sortField : "generation_date";
    const dir = searchParams.get("dir") === "asc" ? "ASC" : "DESC";

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));
    const offset = (page - 1) * pageSize;

  const countQuery = `SELECT COUNT(*)::int AS count FROM radioactive_waste_labels ${where}`;
    const { rows: countRows } = await sql.query(countQuery, params);
    const total = countRows[0]?.count ?? 0;

  const dataParams = [...params, pageSize, offset];
    const dataQuery = `
        SELECT * FROM radioactive_waste_labels
            ${where}
                ORDER BY ${sortCol} ${dir}, id ${dir}
                    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                      `;
    const { rows } = await sql.query(dataQuery, dataParams);

  return NextResponse.json({ rows, total, page, pageSize });
}

async function reserveLabelNumber(labelYear: number) {
    const { rows: seqRows } = await sql`
        INSERT INTO waste_label_sequence (label_year, last_correlative)
            VALUES (${labelYear}, 1)
                ON CONFLICT (label_year) DO UPDATE SET last_correlative = waste_label_sequence.last_correlative + 1
                    RETURNING last_correlative
                      `;
    const correlative = seqRows[0]?.last_correlative as number;
    return { correlative, label_number: formatWasteLabelNumber(labelYear, correlative) };
}

// Genera un rotulo de Gestion de Residuos Radiactivos. Admite dos origenes:
//
// 1) A partir de un Acta de Liberacion de Sala ya guardada (room_release_id):
//    toda la informacion se reutiliza desde ese registro, sin volver a
//    solicitar nada ya ingresado.
// 2) De forma independiente (sin Acta), para residuos que no provienen de la
//    liberacion de una sala de paciente hospitalizado: Capacho I-131,
//    Generador Mo-99/Tc-99m, Cortopunzante Tc-99m. En este caso el usuario
//    ingresa unicamente los parametros realmente medidos (CPS, CPS de fondo,
//    tasa de dosis); la actividad superficial (Bq/cm2) se calcula siempre
//    automaticamente, nunca se solicita como dato manual.
export async function POST(req: NextRequest) {
    await ensureWasteEngineV2();
    await ensureWasteRoomReleaseIdNullable();

  const body = await req.json();
    const room_release_id = body.room_release_id ? Number(body.room_release_id) : null;

  if (room_release_id) {
        const { rows: releaseRows } = await sql`
              SELECT * FROM room_release_records WHERE id = ${room_release_id}
                  `;
        const release = releaseRows[0];
        if (!release) {
                return NextResponse.json({ error: "No se encontró el Acta de Liberación de Sala indicada" }, { status: 404 });
        }

      const today = new Date().toISOString().slice(0, 10);
        const labelYear = new Date().getFullYear();
        const { correlative, label_number } = await reserveLabelNumber(labelYear);
        if (!correlative) {
                return NextResponse.json({ error: "No se pudo reservar el correlativo del rótulo" }, { status: 500 });
        }

      const { rows } = await sql`
            INSERT INTO radioactive_waste_labels (
                    label_number, label_year, correlative, room_release_id, generation_date, service, sala,
                            room_number, paciente_nombre, radionuclide_code, actividad_estimada_residual, unidad_actividad,
                                    waste_type, waste_type_other, container, storage_location, entry_date, responsible,
                                            observations, status, created_by
                                                  ) VALUES (
                                                          ${label_number}, ${labelYear}, ${correlative}, ${room_release_id}, ${today}, ${release.service}, ${release.sala},
                                                                  ${release.room_number}, ${release.paciente_nombre}, ${release.radionuclide_code}, null, ${release.unidad_actividad ?? "mCi"},
                                                                          ${body.waste_type ?? null}, ${body.waste_type_other ?? null}, ${body.container ?? null}, ${body.storage_location ?? null}, ${today}, ${release.responsable_opr ?? "Oficial de Protección Radiológica"},
                                                                                  ${body.observations ?? null}, 'pendiente', ${body.created_by ?? null}
                                                                                        ) RETURNING *
                                                                                            `;
        const label = rows[0];
        if (!label) {
                return NextResponse.json({ error: "No se pudo generar el rótulo" }, { status: 500 });
        }

      await sql`
            INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
                  VALUES (${label.id}, ${label.label_number}, 'created', ${body.created_by ?? null}, ${JSON.stringify(label)})
                      `;

      await sql`
            UPDATE room_release_records SET waste_label_generated = true, updated_at = now() WHERE id = ${room_release_id}
                `;

      return NextResponse.json({ row: label }, { status: 201 });
  }

  // --- Creacion independiente (sin Acta de Liberacion de Sala) -------------
  const wasteType = body.waste_type ? String(body.waste_type) : null;
    if (!wasteType || !isStandaloneWasteType(wasteType)) {
          return NextResponse.json(
            { error: "Debe indicar room_release_id, o un waste_type independiente valido (capacho_i131, generador_mo99_tc99m, cortopunzante_tc99m)." },
            { status: 400 }
                );
    }
    const radionuclide_code = STANDALONE_WASTE_TYPE_RADIONUCLIDE[wasteType];
    if (!radionuclide_code) {
          return NextResponse.json({ error: "No se pudo determinar el radionúclido para el tipo de residuo indicado." }, { status: 400 });
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
    if (wasteType === "otro") {
          // reservado por compatibilidad; no aplica a tipos standalone actuales
    }

  const bqCm2 = calcActaActividadBqCm2(cps, cpsFondo);

  const labelYear = new Date().getFullYear();
    const { correlative, label_number } = await reserveLabelNumber(labelYear);
    if (!correlative) {
          return NextResponse.json({ error: "No se pudo reservar el correlativo del rótulo" }, { status: 500 });
    }
    const lot_number = body.lot_number ? String(body.lot_number).trim() : formatWasteLotNumber(radionuclide_code, new Date(fecha));

  const service = body.service ? String(body.service) : "Medicina Nuclear";
    const sala = body.sala ? String(body.sala) : "Bodega de Residuos";
    const responsible = body.responsible ? String(body.responsible) : "Oficial de Protección Radiológica";

  let storageLocationId: number | null = null;
    let storageLocationName: string | null = null;
    if (body.storage_location_id) {
          const { rows: locRows } = await sql`SELECT * FROM waste_storage_locations WHERE id = ${Number(body.storage_location_id)}`;
          const loc = locRows[0];
          if (!loc) {
                  return NextResponse.json({ error: "Ubicación de almacenamiento inválida." }, { status: 400 });
          }
          storageLocationId = loc.id;
          storageLocationName = loc.name;
    }

  const { rows } = await sql`
      INSERT INTO radioactive_waste_labels (
            label_number, label_year, correlative, room_release_id, generation_date, service, sala,
                  room_number, paciente_nombre, radionuclide_code, actividad_estimada_residual, unidad_actividad,
                        waste_type, waste_type_other, lot_number, container, storage_location, storage_location_id,
                              entry_date, responsible, observations, status, created_by
                                  ) VALUES (
                                        ${label_number}, ${labelYear}, ${correlative}, null, ${fecha}, ${service}, ${sala},
                                              ${body.room_number ?? null}, null, ${radionuclide_code}, null, 'mCi',
                                                    ${wasteType}, ${body.waste_type_other ?? null}, ${lot_number}, ${body.container ?? null}, ${storageLocationName}, ${storageLocationId},
                                                          ${fecha}, ${responsible}, ${body.observations ?? null}, 'pendiente', ${body.created_by ?? null}
                                                              ) RETURNING *
                                                                `;
    const label = rows[0];
    if (!label) {
          return NextResponse.json({ error: "No se pudo generar el rótulo" }, { status: 500 });
    }

  const criterio = evaluaCriterioUniversal(bqCm2, tasaDosis);
    const { rows: measRows } = await sql`
        INSERT INTO waste_measurements (
              label_id, tipo, fecha, hora, cps, cps_fondo, cps_neto, bq_cm2, tasa_dosis_usv_h,
                    instrumento, usuario, cumple_contaminacion, cumple_tasa_dosis, resultado, observaciones
                        ) VALUES (
                              ${label.id}, 'seguimiento', ${fecha}, ${body.hora ?? null}, ${cps}, ${cpsFondo}, ${Math.max(0, cps - cpsFondo)}, ${bqCm2}, ${tasaDosis},
                                    ${body.instrumento ?? null}, ${responsible}, ${criterio.cumpleContaminacion}, ${criterio.cumpleTasaDosis}, ${criterio.apto ? "APTO PARA DISPENSA" : "NO APTO PARA DISPENSA"}, ${body.observaciones_medicion ?? null}
                                        ) RETURNING *
                                          `;

  const halfLifeDays = await getHalfLifeDaysForRadionuclide(radionuclide_code);
    const proyeccion = computeProyeccionDesdeUltimaMedicion({
          ultimaBqCm2: bqCm2,
          fechaUltimaMedicion: fecha,
          halfLifeDays,
    });

  const dispensaEstado = proyeccion.aplica ? proyeccion.estado : "en_decaimiento";
    await sql`
        UPDATE radioactive_waste_labels SET
              dispensa_estado = ${dispensaEstado},
                    fecha_estimada_liberacion = ${proyeccion.aplica ? proyeccion.fechaEstimadaLiberacion : null},
                          updated_at = now()
                              WHERE id = ${label.id}
                                `;

  await sql`
      INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
          VALUES (${label.id}, ${label.label_number}, 'created', ${body.created_by ?? null}, ${JSON.stringify(label)})
            `;

  return NextResponse.json({ row: { ...label, dispensa_estado: dispensaEstado }, measurement: measRows[0], proyeccion }, { status: 201 });
}
