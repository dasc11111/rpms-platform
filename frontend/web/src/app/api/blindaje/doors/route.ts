import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeDoorsTable, listBlindajeDoors, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 8 - Puertas (S27): cada puerta se asocia a un proyecto y,
// opcionalmente, a una barrera. Registra ubicacion, dimensiones,
// material, espesor y equivalencia en plomo, sin inventar valores
// (S55, S61). El resultado/estado se declara explicitamente, nunca
// solo por color (S39).
export async function GET(request: NextRequest) {
  await ensureBlindajeDoorsTable();
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("project_id"));
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  const doors = await listBlindajeDoors(projectId);
  return NextResponse.json({ ok: true, doors });
}

export async function POST(request: NextRequest) {
  await ensureBlindajeDoorsTable();
  const body = await request.json();
  const projectId = Number(body.project_id);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El codigo y el nombre de la puerta son obligatorios." }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO blindaje_doors (
project_id, barrier_id, code, name, location, width_cm, height_cm,
material, thickness_cm, lead_equivalent_mm, result_value, result_unit,
result_status, source_document, notes
) VALUES (
${projectId}, ${body.barrier_id || null}, ${body.code}, ${body.name}, ${body.location || null},
${body.width_cm || null}, ${body.height_cm || null}, ${body.material || null}, ${body.thickness_cm || null},
${body.lead_equivalent_mm || null}, ${body.result_value || null}, ${body.result_unit || null},
${body.result_status || "sin_informacion"}, ${body.source_document || null}, ${body.notes || null}
)
RETURNING *
`;
  const door = rows[0];
  if (!door) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar la puerta." }, { status: 500 });
  }

await logBlindajeAudit(
  "blindaje_doors",
  door.id,
  null,
  null,
  JSON.stringify(door),
  body.user_name || null,
  "Alta de puerta (Paso 8, S27)",
  projectId
  );

return NextResponse.json({ ok: true, door });
}

export async function PATCH(request: NextRequest) {
  await ensureBlindajeDoorsTable();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE blindaje_doors SET
      barrier_id = COALESCE(${body.barrier_id ?? null}, barrier_id),
      code = COALESCE(${body.code ?? null}, code),
      name = COALESCE(${body.name ?? null}, name),
      location = COALESCE(${body.location ?? null}, location),
      width_cm = COALESCE(${body.width_cm ?? null}::numeric, width_cm),
      height_cm = COALESCE(${body.height_cm ?? null}::numeric, height_cm),
      material = COALESCE(${body.material ?? null}, material),
      thickness_cm = COALESCE(${body.thickness_cm ?? null}::numeric, thickness_cm),
      lead_equivalent_mm = COALESCE(${body.lead_equivalent_mm ?? null}::numeric, lead_equivalent_mm),
      result_value = COALESCE(${body.result_value ?? null}::numeric, result_value),
      result_unit = COALESCE(${body.result_unit ?? null}, result_unit),
      result_status = COALESCE(${body.result_status ?? null}, result_status),
      notes = COALESCE(${body.notes ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Puerta no encontrada." }, { status: 404 });
  await logBlindajeAudit("blindaje_doors", id, null, null, JSON.stringify(rows[0]), body.user_name || null, "Actualización de puerta", rows[0].project_id);
  return NextResponse.json({ ok: true, door: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureBlindajeDoorsTable();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM blindaje_doors WHERE id = ${id} RETURNING id, project_id, name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Puerta no encontrada." }, { status: 404 });
  await logBlindajeAudit("blindaje_doors", id, null, null, null, null, "Eliminación de puerta", rows[0].project_id);
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
