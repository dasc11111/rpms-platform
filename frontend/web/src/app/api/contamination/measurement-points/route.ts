import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureContaminationMeasurementPoints,
  CONTAMINATION_POINT_CATEGORIES,
} from "@/lib/contamination-points-db";

export const dynamic = "force-dynamic";

// Lista predefinida y editable de puntos de medicion de contaminacion
// (Seccion 12 del PROMPT MAESTRO CLAUDE CHROME - MEDICINA NUCLEAR).
// Complementa -sin reemplazar- el autocompletado por historial ya existente
// (/api/contamination/suggestions) en el formulario general de Contaminacion.
// No modifica el modulo "Liberacion de Sala" (src/lib/room-clearance.ts),
// que ya usa su propia lista fija equivalente.
export async function GET(req: NextRequest) {
  await ensureContaminationMeasurementPoints();
  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("activo") !== "false";
  const { rows } = await sql.query(
    `SELECT * FROM contamination_measurement_points ${onlyActive ? "WHERE activo = true" : ""} ORDER BY categoria ASC, orden ASC, nombre ASC`
  );
  return NextResponse.json({ rows });
}

// Agrega un nuevo punto a la lista editable (Seccion 12: "Crear una lista
// editable"). No requiere reemplazar puntos existentes.
export async function POST(req: NextRequest) {
  await ensureContaminationMeasurementPoints();
  const body = await req.json().catch(() => ({}));
  const categoria = (body.categoria ?? "").toString().trim().toUpperCase();
  const nombre = (body.nombre ?? "").toString().trim();

  if (!(CONTAMINATION_POINT_CATEGORIES as readonly string[]).includes(categoria)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (!nombre) {
    return NextResponse.json({ error: "El nombre del punto es obligatorio" }, { status: 400 });
  }

  const { rows: maxOrdenRows } = await sql`
    SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM contamination_measurement_points WHERE categoria = ${categoria}
  `;
  const orden = body.orden !== undefined ? Number(body.orden) : (maxOrdenRows[0]?.next ?? 1);
  const notas = body.notas ?? null;

  try {
    const { rows } = await sql`
      INSERT INTO contamination_measurement_points (categoria, nombre, orden, notas)
      VALUES (${categoria}, ${nombre}, ${orden}, ${notas})
      RETURNING *
    `;
    return NextResponse.json({ row: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe un punto con ese nombre en esta categoría" }, { status: 409 });
  }
}

// Edita o desactiva un punto existente (renombrar, reordenar, agregar notas,
// o poner activo=false para retirarlo sin borrar el historico que ya lo
// referencia). No permite eliminacion fisica (Seccion 48: no sobrescribir ni
// borrar historicos).
export async function PUT(req: NextRequest) {
  await ensureContaminationMeasurementPoints();
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) {
    return NextResponse.json({ error: "id es requerido" }, { status: 400 });
  }

  const { rows: existingRows } = await sql`SELECT * FROM contamination_measurement_points WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 });
  }

  const categoria = body.categoria ? body.categoria.toString().trim().toUpperCase() : existing.categoria;
  const nombre = body.nombre !== undefined ? body.nombre.toString().trim() : existing.nombre;
  const activo = body.activo !== undefined ? Boolean(body.activo) : existing.activo;
  const orden = body.orden !== undefined ? Number(body.orden) : existing.orden;
  const notas = body.notas !== undefined ? body.notas : existing.notas;

  if (!nombre) {
    return NextResponse.json({ error: "El nombre del punto es obligatorio" }, { status: 400 });
  }

  const { rows } = await sql`
    UPDATE contamination_measurement_points
    SET categoria = ${categoria}, nombre = ${nombre}, activo = ${activo}, orden = ${orden}, notas = ${notas}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json({ row: rows[0] });
}
