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
