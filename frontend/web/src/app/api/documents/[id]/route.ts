import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows: existingRows } = await sql`SELECT * FROM documents WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const pathname = `documents/${existing.category_id}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

  try {
    await del(existing.blob_url as string);
  } catch {
    // se ignora si el blob anterior ya no existe
  }

  const { rows } = await sql`
    UPDATE documents
    SET original_name = ${file.name}, blob_url = ${blob.url}, blob_pathname = ${blob.pathname},
        size_bytes = ${file.size}, mime_type = ${file.type || null}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, original_name, blob_url, size_bytes, mime_type, uploaded_by, created_at, updated_at
  `;

  return NextResponse.json({ document: rows[0] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { rows: existingRows } = await sql`SELECT * FROM documents WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await del(existing.blob_url as string);
  } catch {
    // se ignora si el blob ya no existe
  }

  await sql`DELETE FROM documents WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
