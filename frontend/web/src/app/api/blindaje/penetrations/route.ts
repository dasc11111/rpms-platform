import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajePenetrationsTable, listBlindajePenetrations, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 10 - Penetraciones (S29): cada penetracion (ducto, tuberia,
// bandeja de cables, etc.) se asocia a un proyecto y, opcionalmente,
// a una barrera. Registra ubicacion, tipo, dimensiones, material de
// relleno/sellado y desplazamiento respecto a la linea recta para
// evitar streaming directo de radiacion, sin inventar valores
// (S55, S61). El resultado/estado se declara explicitamente, nunca
// solo por color (S39).
export async function GET(request: NextRequest) {
  await ensureBlindajePenetrationsTable();
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("project_id"));
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  const penetrations = await listBlindajePenetrations(projectId);
  return NextResponse.json({ ok: true, penetrations });
}

export async function POST(request: NextRequest) {
  await ensureBlindajePenetrationsTable();
  const body = await request.json();
  const projectId = Number(body.project_id);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El codigo y el nombre de la penetracion son obligatorios." }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO blindaje_penetrations (
project_id, barrier_id, code, name, location, penetration_type, diameter_cm, width_cm, height_cm,
fill_material, offset_cm, result_value, result_unit, result_status, source_document, notes
) VALUES (
${projectId}, ${body.barrier_id || null}, ${body.code}, ${body.name}, ${body.location || null},
${body.penetration_type || null}, ${body.diameter_cm || null}, ${body.width_cm || null}, ${body.height_cm || null},
${body.fill_material || null}, ${body.offset_cm || null}, ${body.result_value || null}, ${body.result_unit || null},
${body.result_status || "sin_informacion"}, ${body.source_document || null}, ${body.notes || null}
)
RETURNING *
`;
  const penetrationRow = rows[0];
  if (!penetrationRow) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar la penetracion." }, { status: 500 });
  }

await logBlindajeAudit(
  "blindaje_penetrations",
  penetrationRow.id,
  null,
  null,
  JSON.stringify(penetrationRow),
  body.user_name || null,
  "Alta de penetracion (Paso 10, S29)",
  projectId
  );

return NextResponse.json({ ok: true, penetration: penetrationRow });
}
