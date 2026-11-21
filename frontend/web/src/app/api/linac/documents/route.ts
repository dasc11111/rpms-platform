import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const q = (searchParams.get("q") || "").trim();
  const { rows } = await sql`
    SELECT * FROM linac_documents
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
      AND is_current = true
      AND (${q} = '' OR title ILIKE '%' || ${q} || '%' OR category ILIKE '%' || ${q} || '%' OR file_name ILIKE '%' || ${q} || '%')
    ORDER BY uploaded_at DESC
    LIMIT 1000;
  `;
  return NextResponse.json({ ok: true, documents: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  const form = await request.formData();
  const file = form.get("file");
  const linacId = Number(form.get("linacId"));
  const category = String(form.get("category") || "general").trim();
  const title = String(form.get("title") || "").trim();
  const uploadedBy = (form.get("uploadedBy") as string) || null;
  if (!linacId || !title || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows: maxRows } = await sql`
    SELECT COALESCE(MAX(version), 0) AS max_version FROM linac_documents WHERE linac_id = ${linacId} AND title = ${title};
  `;
  const nextVersion = Number(maxRows[0]?.max_version ?? 0) + 1;
  await sql`UPDATE linac_documents SET is_current = false WHERE linac_id = ${linacId} AND title = ${title};`;

  const pathname = `linac/documents/${linacId}/${category}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

  const { rows } = await sql`
    INSERT INTO linac_documents (
      linac_id, category, title, file_name, blob_url, mime_type, size_bytes, version, is_current, uploaded_by
    ) VALUES (
      ${linacId}, ${category}, ${title}, ${file.name}, ${blob.url}, ${file.type || null}, ${file.size || null}, ${nextVersion}, true, ${uploadedBy}
    )
    RETURNING id;
  `;

  await logLinacAudit("upload_linac_document", uploadedBy, { linacId, category, title, version: nextVersion });
  return NextResponse.json({ ok: true, id: rows[0]!.id, version: nextVersion });
}


export async function DELETE(request: NextRequest) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`SELECT id, blob_url, title FROM linac_documents WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
  if (rows[0].blob_url) { try { await del(rows[0].blob_url); } catch { /* ignore */ } }
  await sql`DELETE FROM linac_documents WHERE id = ${id}`;
  await logLinacAudit("delete_linac_document", null, { id, title: rows[0].title });
  return NextResponse.json({ ok: true, deleted: { id } });
}
