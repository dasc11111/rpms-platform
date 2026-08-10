import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureWasteReleaseLimitsTable,
  ensureWasteLabelDispensaColumns,
  getReleaseLimitForRadionuclide,
  resolveActaPointKeyForWasteType,
  computeDispensa,
  type ActaPuntoMedicion,
} from "@/lib/waste";

export const dynamic = "force-dynamic";

const VALID_WASTE_TYPES = ["ropa_cama", "basura_comun", "basura_bano", "otro"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureWasteLabelDispensaColumns();
  await ensureWasteReleaseLimitsTable();
  const { id } = await params;
  const { rows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${Number(id)}`;
  const label = rows[0];
  if (!label) {
    return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
  }
  const { rows: history } = await sql`
    SELECT * FROM waste_label_history WHERE label_id = ${Number(id)} ORDER BY changed_at DESC
  `;
  const { rows: releaseRows } = await sql`
    SELECT * FROM room_release_records WHERE id = ${label.room_release_id}
  `;
  const roomRelease = releaseRows[0] ?? null;

  // Calcula, siempre en vivo (nunca estimado a mano), el estado de dispensa
  // por decaimiento en Bq/cm2 del residuo, a partir del punto de medicion ya
  // registrado en el Acta que corresponde al Tipo de residuo seleccionado.
  const pointKey: string | null =
    label.punto_medicion_key || resolveActaPointKeyForWasteType(label.waste_type, label.waste_type_other);
  let actividadInicial: number | null =
    label.actividad_superficial_inicial_bq_cm2 !== null && label.actividad_superficial_inicial_bq_cm2 !== undefined
      ? Number(label.actividad_superficial_inicial_bq_cm2)
      : null;
  let fechaMedicion: string | null = label.fecha_medicion_superficial ?? null;

  if ((actividadInicial === null || fechaMedicion === null) && pointKey && roomRelease?.puntos_medicion) {
    const puntos = roomRelease.puntos_medicion as ActaPuntoMedicion[];
    const found = puntos.find((p) => p.key === pointKey);
    if (found) {
      actividadInicial = found.actividad_bq_cm2;
      fechaMedicion = roomRelease.release_date;
    }
  }

  const limit = await getReleaseLimitForRadionuclide(label.radionuclide_code);
  const dispensa = computeDispensa({
    radionuclideCode: label.radionuclide_code,
    halfLifeDays: limit ? Number(limit.half_life_days) : null,
    limiteBqCm2: limit ? Number(limit.limit_bq_cm2) : null,
    actividadInicialBqCm2: actividadInicial,
    fechaMedicionInicial: fechaMedicion,
  });

  return NextResponse.json({ row: label, history, roomRelease, dispensa });
}

// Correccion: se elimina la posibilidad de editar "Clasificación" (ya no se
// solicita ni se guarda) y se agregan Tipo de residuo (con "Otro" + texto
// libre) y Ubicación de almacenamiento (dropdown parametrizable). Cada vez
// que cambia el tipo de residuo se recalcula automaticamente, a partir de la
// medicion ya registrada en el Acta, la actividad superficial inicial usada
// para el calculo de dispensa (nunca se pide estimarla manualmente).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureWasteLabelDispensaColumns();
  const { id } = await params;
  const body = await req.json();

  const { rows: existingRows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${Number(id)}`;
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

  // Ubicacion de almacenamiento: dropdown parametrizable (waste_storage_locations).
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
  if (body.waste_type !== undefined || body.waste_type_other !== undefined) {
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
    WHERE id = ${Number(id)}
    RETURNING *
  `;

  const updated = rows[0];
  if (!updated) {
    return NextResponse.json({ error: "No se pudo actualizar el rótulo" }, { status: 500 });
  }

  await sql`
    INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
    VALUES (${Number(id)}, ${updated.label_number}, 'updated', ${body.changed_by ?? null}, ${JSON.stringify(updated)})
  `;

  return NextResponse.json({ row: updated });
}
