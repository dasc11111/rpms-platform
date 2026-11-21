import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 1 - Documentacion: separacion en tres capas (Referencia Tecnica /
// Normativa Chilena / Procedimientos Internos). Este endpoint permite crear
// nuevas categorias (por ejemplo, las 3 carpetas de capa de nivel superior)
// de forma aditiva. No modifica documentos existentes.

export async function GET() {
  const { rows } = await sql`
    SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order,
      COUNT(d.id)::int AS document_count
    FROM document_categories c
    LEFT JOIN documents d ON d.category_id = c.id
    GROUP BY c.id, c.name, c.slug, c.parent_id, c.sort_order
    ORDER BY c.sort_order, c.name
  `;
  return NextResponse.json({ categories: rows });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const parentId = body.parentId ? Number(body.parentId) : null;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;

  if (!name) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let parentSlug = "";
  if (parentId) {
    const { rows: parentRows } = await sql`SELECT slug FROM document_categories WHERE id = ${parentId}`;
    const parentRow = parentRows[0];
    if (!parentRow) {
      return NextResponse.json({ error: "parent_not_found" }, { status: 404 });
    }
    parentSlug = parentRow.slug as string;
  }

  const base = slugify(name);
  const slug = parentSlug ? `${parentSlug}-${base}` : base;

  const { rows } = await sql`
    INSERT INTO document_categories (name, slug, parent_id, sort_order)
    VALUES (${name}, ${slug}, ${parentId}, ${sortOrder})
    RETURNING id, name, slug, parent_id, sort_order
  `;

  return NextResponse.json({ category: rows[0] });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = body.id ? Number(body.id) : null;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : null;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : null;

  const { rows } = await sql`
    UPDATE document_categories SET
      name       = COALESCE(${name}, name),
      sort_order = COALESCE(${sortOrder}, sort_order)
    WHERE id = ${id}
    RETURNING id, name, slug, parent_id, sort_order
  `;
  if (!rows.length) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  return NextResponse.json({ category: rows[0] });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ? Number(searchParams.get("id")) : null;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Only delete if no documents reference this category
  const { rows: docs } = await sql`SELECT COUNT(*)::int AS n FROM documents WHERE category_id = ${id}`;
  if (docs[0].n > 0) {
    return NextResponse.json({ error: "No se puede eliminar una categoría con documentos asociados" }, { status: 409 });
  }

  const { rows } = await sql`DELETE FROM document_categories WHERE id = ${id} RETURNING id, name`;
  if (!rows.length) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  return NextResponse.json({ deleted: rows[0] });
}
