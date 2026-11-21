import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeMazesTable, listBlindajeMazes, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 11 - Laberintos (S30): cada laberinto (zona de acceso en
// laberinto para bunkers de aceleradores) se asocia a un proyecto y,
// opcionalmente, a una barrera. Registra numero de tramos, largo del
// ultimo tramo (dimension critica para el calculo de radiacion
// dispersa), dimensiones y material de los muros, sin inventar
// valores (S55, S61). El resultado/estado se declara explicitamente,
// nunca solo por color (S39).
export async function GET(request: NextRequest) {
  await ensureBlindajeMazesTable();
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("project_id"));
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  const mazes = await listBlindajeMazes(projectId);
  return NextResponse.json({ ok: true, mazes });
}

export async function POST(request: NextRequest) {
  await ensureBlindajeMazesTable();
  const body = await request.json();
  const projectId = Number(body.project_id);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El codigo y el nombre del laberinto son obligatorios." }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO blindaje_mazes (
project_id, barrier_id, code, name, location, leg_count, last_leg_length_m, maze_width_cm, maze_height_cm,
wall_material, result_value, result_unit, result_status, source_document, notes
) VALUES (
${projectId}, ${body.barrier_id || null}, ${body.code}, ${body.name}, ${body.location || null},
${body.leg_count || null}, ${body.last_leg_length_m || null}, ${body.maze_width_cm || null}, ${body.maze_height_cm || null},
${body.wall_material || null}, ${body.result_value || null}, ${body.result_unit || null},
${body.result_status || "sin_informacion"}, ${body.source_document || null}, ${body.notes || null}
)
RETURNING *
`;
  const mazeRow = rows[0];
  if (!mazeRow) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar el laberinto." }, { status: 500 });
  }

await logBlindajeAudit(
  "blindaje_mazes",
  mazeRow.id,
  null,
  null,
  JSON.stringify(mazeRow),
  body.user_name || null,
  "Alta de laberinto (Paso 11, S30)",
  projectId
  );

return NextResponse.json({ ok: true, maze: mazeRow });
}
