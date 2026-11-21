import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeOccupancyPointsTable, listBlindajeOccupancyPoints, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 13 - Puntos de ocupacion / Receptores de dosis (S32): cada
// punto de ocupacion se asocia a un proyecto y, opcionalmente, a una
// barrera. Registra el tipo de ocupante, el factor de ocupacion (T),
// la distancia a la fuente y el componente del haz (primario,
// dispersa o fuga) relevante para el calculo de dosis en ese
// receptor, sin inventar valores (S55, S61). El resultado/estado se
// declara explicitamente, nunca solo por color (S39).
export async function GET(request: NextRequest) {
  await ensureBlindajeOccupancyPointsTable();
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("project_id"));
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  const occupancy_points = await listBlindajeOccupancyPoints(projectId);
  return NextResponse.json({ ok: true, occupancy_points });
}

export async function POST(request: NextRequest) {
  await ensureBlindajeOccupancyPointsTable();
  const body = await request.json();
  const projectId = Number(body.project_id);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El codigo y el nombre del punto de ocupacion son obligatorios." }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO blindaje_occupancy_points (
project_id, barrier_id, code, name, location, occupancy_type, occupancy_factor_t,
distance_m, beam_component, result_value, result_unit,
result_status, source_document, notes
) VALUES (
${projectId}, ${body.barrier_id || null}, ${body.code}, ${body.name}, ${body.location || null},
${body.occupancy_type || null}, ${body.occupancy_factor_t || null}, ${body.distance_m || null},
${body.beam_component || null}, ${body.result_value || null}, ${body.result_unit || null},
${body.result_status || "sin_informacion"}, ${body.source_document || null}, ${body.notes || null}
)
RETURNING *
`;
  const occupancyPointRow = rows[0];
  if (!occupancyPointRow) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar el punto de ocupacion." }, { status: 500 });
  }

await logBlindajeAudit(
  "blindaje_occupancy_points",
  occupancyPointRow.id,
  null,
  null,
  JSON.stringify(occupancyPointRow),
  body.user_name || null,
  "Alta de punto de ocupacion (Paso 13, S32)",
  projectId
  );

return NextResponse.json({ ok: true, occupancy_point: occupancyPointRow });
}

export async function PATCH(request: NextRequest) {
  await ensureBlindajeOccupancyPointsTable();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE blindaje_occupancy_points SET
      barrier_id = COALESCE(${body.barrier_id ?? null}, barrier_id),
      code = COALESCE(${body.code ?? null}, code),
      name = COALESCE(${body.name ?? null}, name),
      location = COALESCE(${body.location ?? null}, location),
      occupancy_type = COALESCE(${body.occupancy_type ?? null}, occupancy_type),
      occupancy_factor_t = COALESCE(${body.occupancy_factor_t ?? null}::numeric, occupancy_factor_t),
      distance_m = COALESCE(${body.distance_m ?? null}::numeric, distance_m),
      beam_component = COALESCE(${body.beam_component ?? null}, beam_component),
      result_value = COALESCE(${body.result_value ?? null}::numeric, result_value),
      result_unit = COALESCE(${body.result_unit ?? null}, result_unit),
      result_status = COALESCE(${body.result_status ?? null}, result_status),
      notes = COALESCE(${body.notes ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Punto de ocupación no encontrado." }, { status: 404 });
  await logBlindajeAudit("blindaje_occupancy_points", id, null, null, JSON.stringify(rows[0]), body.user_name || null, "Actualización de punto de ocupación", rows[0].project_id);
  return NextResponse.json({ ok: true, point: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureBlindajeOccupancyPointsTable();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM blindaje_occupancy_points WHERE id = ${id} RETURNING id, project_id, name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Punto de ocupación no encontrado." }, { status: 404 });
  await logBlindajeAudit("blindaje_occupancy_points", id, null, null, null, null, "Eliminación de punto de ocupación", rows[0].project_id);
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
