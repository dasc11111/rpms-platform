import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, listBlindajeBarriers, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 7 - Barreras (S21, S23, S24, S25): cada barrera guarda codigo, nombre,
// tipo (primaria/secundaria/neutronica/captura), material, densidad y su
// fuente, espesor existente/requerido/adoptado, margen, PIR asociado,
// factor de uso y ocupacion, sin hardcodear valores normativos (S55). El
// resultado/estado se completa cuando el motor de calculo (fase futura)
// este disponible; por ahora queda "sin_informacion".
export async function GET(request: NextRequest) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("project_id"));
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  const barriers = await listBlindajeBarriers(projectId);
  return NextResponse.json({ ok: true, barriers });
}

export async function POST(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();
  const projectId = Number(body.project_id);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
  }
  if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El codigo y el nombre de la barrera son obligatorios." }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO blindaje_barriers (
project_id, pir_id, code, name, barrier_type, material, density, material_source,
thickness_existing_cm, thickness_required_cm, thickness_adopted_cm, margin_cm,
        distance_m, use_factor, occupancy_factor, result_value, result_unit, result_status
) VALUES (
${projectId}, ${body.pir_id || null}, ${body.code}, ${body.name}, ${body.barrier_type || "primaria"},
${body.material || null}, ${body.density || null}, ${body.material_source || null},
${body.thickness_existing_cm || null}, ${body.thickness_required_cm || null}, ${body.thickness_adopted_cm || null},
${body.margin_cm || null}, ${body.distance_m || null}, ${body.use_factor || null}, ${body.occupancy_factor || null},
        ${body.result_value || null}, ${body.result_unit || null}, ${body.result_status || "sin_informacion"}
)
RETURNING *
`;
  const barrier = rows[0];
  if (!barrier) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar la barrera." }, { status: 500 });
  }

await logBlindajeAudit(
  "blindaje_barriers",
  barrier.id,
  null,
  null,
  JSON.stringify(barrier),
  body.user_name || null,
  "Alta de barrera (Paso 7)",
  projectId
  );

return NextResponse.json({ ok: true, barrier });
}

export async function PATCH(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE blindaje_barriers SET
      pir_id = COALESCE(${body.pir_id ?? null}, pir_id),
      code = COALESCE(${body.code ?? null}, code),
      name = COALESCE(${body.name ?? null}, name),
      barrier_type = COALESCE(${body.barrier_type ?? null}, barrier_type),
      material = COALESCE(${body.material ?? null}, material),
      density = COALESCE(${body.density ?? null}::numeric, density),
      material_source = COALESCE(${body.material_source ?? null}, material_source),
      thickness_existing_cm = COALESCE(${body.thickness_existing_cm ?? null}::numeric, thickness_existing_cm),
      thickness_required_cm = COALESCE(${body.thickness_required_cm ?? null}::numeric, thickness_required_cm),
      thickness_adopted_cm = COALESCE(${body.thickness_adopted_cm ?? null}::numeric, thickness_adopted_cm),
      margin_cm = COALESCE(${body.margin_cm ?? null}::numeric, margin_cm),
      distance_m = COALESCE(${body.distance_m ?? null}::numeric, distance_m),
      use_factor = COALESCE(${body.use_factor ?? null}::numeric, use_factor),
      occupancy_factor = COALESCE(${body.occupancy_factor ?? null}::numeric, occupancy_factor),
      result_value = COALESCE(${body.result_value ?? null}::numeric, result_value),
      result_unit = COALESCE(${body.result_unit ?? null}, result_unit),
      result_status = COALESCE(${body.result_status ?? null}, result_status)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Barrera no encontrada." }, { status: 404 });
  await logBlindajeAudit("blindaje_barriers", id, null, null, JSON.stringify(rows[0]), body.user_name || null, "Actualización de barrera", rows[0].project_id);
  return NextResponse.json({ ok: true, barrier: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM blindaje_barriers WHERE id = ${id} RETURNING id, project_id, name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Barrera no encontrada." }, { status: 404 });
  await logBlindajeAudit("blindaje_barriers", id, null, null, null, null, "Eliminación de barrera", rows[0].project_id);
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
