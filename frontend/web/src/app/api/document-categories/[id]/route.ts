import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 1 - Documentacion: permite re-asignar el padre (carpeta) de una
// categoria existente, para poder agrupar categorias ya creadas dentro de
// las 3 capas (Referencia Tecnica / Normativa Chilena / Procedimientos
// Internos) sin eliminar ni migrar ningun documento. Solo cambia metadatos
// de organizacion (parent_id / sort_order / name) de document_categories.

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: string[] = [];
  const values: unknown[] = [];

  if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
    const parentId = body.parentId === null ? null : Number(body.parentId);
    if (parentId === id) {
      return NextResponse.json({ error: "cannot_be_own_parent" }, { status: 400 });
    }
    values.push(parentId);
    updates.push(`parent_id = $${values.length}`);
  }

  if (typeof body.sortOrder === "number") {
    values.push(body.sortOrder);
    updates.push(`sort_order = $${values.length}`);
  }

  if (typeof body.name === "string" && body.name.trim()) {
    values.push(body.name.trim());
    updates.push(`name = $${values.length}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  values.push(id);
  const { rows } = await sql.query(
    `UPDATE document_categories SET ${updates.join(", ")} WHERE id = $${values.length}
     RETURNING id, name, slug, parent_id, sort_order`,
    values
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ category: rows[0] });
}
