import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureCommissioningTables, logCommissioningAudit } from "@/lib/linac-commissioning";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureCommissioningTables();
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId");
  if (!datasetId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { rows } = await sql`
    SELECT * FROM linac_commissioning_documents WHERE dataset_id = ${datasetId} ORDER BY uploaded_at DESC
  `;
  return NextResponse.json({ ok: true, documents: rows });
}

export async function POST(request: Request) {
  await ensureCommissioningTables();
  const form = await request.formData();
  const file = form.get("file");
  const datasetId = Number(form.get("datasetId"));
  const category = String(form.get("category") || "informe").trim();
  const title = String(form.get("title") || "").trim();
  const uploadedBy = (form.get("uploadedBy") as string) || null;
  if (!datasetId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pathname = `linac/commissioning/${datasetId}/${category}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

  const { rows } = await sql`
    INSERT INTO linac_commissioning_documents (
      dataset_id, category, title, file_name, blob_url, mime_type, size_bytes, uploaded_by
    ) VALUES (
      ${datasetId}, ${category}, ${title || file.name}, ${file.name}, ${blob.url}, ${file.type || null}, ${file.size || null}, ${uploadedBy}
    )
    RETURNING id;
  `;

  await logCommissioningAudit("upload_commissioning_document", uploadedBy, { datasetId, category, title });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}


export async function DELETE(request: NextRequest) {
  await ensureCommissioningTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`SELECT id, blob_url FROM linac_commissioning_documents WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
  if (rows[0].blob_url) { try { await del(rows[0].blob_url); } catch { /* ignore */ } }
  await sql`DELETE FROM linac_commissioning_documents WHERE id = ${id}`;
  await logCommissioningAudit("delete_commissioning_document", null, { id });
  return NextResponse.json({ ok: true, deleted: { id } });
}
