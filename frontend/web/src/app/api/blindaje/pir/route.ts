import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, listBlindajePir, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 6 - Geometria y Puntos de Interes / PIR (S19, S20): cada PIR guarda
// codigo, nombre, descripcion, coordenadas, distancia, clasificacion de area,
// ocupacion y el criterio de diseno con su fuente (S33), sin hardcodear
// valores normativos (S55). El resultado/estado se completa cuando el motor
// de calculo (fase futura) este disponible; por ahora queda "sin_informacion".
export async function GET(request: NextRequest) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("project_id"));
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
  const pir = await listBlindajePir(projectId);
  return NextResponse.json({ ok: true, pir });
  }

export async function POST(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();
  const projectId = Number(body.project_id);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
  if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El codigo y el nombre del PIR son obligatorios." }, { status: 400 });
    }

  const { rows } = await sql`
  INSERT INTO blindaje_pir (
    project_id, code, name, description, coordinates, distance_m, area_type,
    occupancy_type, occupancy_factor, design_criterion_value, design_criterion_unit,
    design_criterion_source, result_status
    ) VALUES (
    ${projectId}, ${body.code}, ${body.name}, ${body.description || null}, ${body.coordinates || null},
    ${body.distance_m || null}, ${body.area_type || null}, ${body.occupancy_type || null},
    ${body.occupancy_factor || null}, ${body.design_criterion_value || null}, ${body.design_criterion_unit || null},
    ${body.design_criterion_source || null}, ${body.result_status || "sin_informacion"}
    )
  RETURNING *
  `;
  const pir = rows[0];
  if (!pir) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar el punto de interes." }, { status: 500 });
    }

  await logBlindajeAudit(
    "blindaje_pir",
    pir.id,
    null,
    null,
    JSON.stringify(pir),
    body.user_name || null,
    "Alta de punto de interes / PIR (Paso 6)",
    projectId
    );

  return NextResponse.json({ ok: true, pir });
  }

export async function PATCH(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE blindaje_pir SET
      code = COALESCE(${body.code ?? null}, code),
      name = COALESCE(${body.name ?? null}, name),
      description = COALESCE(${body.description ?? null}, description),
      coordinates = COALESCE(${body.coordinates ?? null}, coordinates),
      distance_m = COALESCE(${body.distance_m ?? null}::numeric, distance_m),
      area_type = COALESCE(${body.area_type ?? null}, area_type),
      occupancy_type = COALESCE(${body.occupancy_type ?? null}, occupancy_type),
      occupancy_factor = COALESCE(${body.occupancy_factor ?? null}::numeric, occupancy_factor),
      design_criterion_value = COALESCE(${body.design_criterion_value ?? null}::numeric, design_criterion_value),
      design_criterion_unit = COALESCE(${body.design_criterion_unit ?? null}, design_criterion_unit),
      design_criterion_source = COALESCE(${body.design_criterion_source ?? null}, design_criterion_source),
      result_status = COALESCE(${body.result_status ?? null}, result_status)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Punto de interés no encontrado." }, { status: 404 });
  await logBlindajeAudit("blindaje_pir", id, null, null, JSON.stringify(rows[0]), body.user_name || null, "Actualización de punto de interés", rows[0].project_id);
  return NextResponse.json({ ok: true, pir: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM blindaje_pir WHERE id = ${id} RETURNING id, project_id, name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Punto de interés no encontrado." }, { status: 404 });
  await logBlindajeAudit("blindaje_pir", id, null, null, null, null, "Eliminación de punto de interés", rows[0].project_id);
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
