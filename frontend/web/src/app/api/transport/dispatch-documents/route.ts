import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureTransportTables, logTransportAudit } from "@/lib/transport";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureTransportTables();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || "";
  if (!date) return NextResponse.json({ error: "date_required" }, { status: 400 });

  const { rows } = await sql`
    SELECT id, transport_date, file_name, mime_type, size_bytes, version, is_current, uploaded_by, uploaded_at
    FROM transport_dispatch_documents
    WHERE transport_date = ${date}
    ORDER BY version DESC;
  `;
  return NextResponse.json({ ok: true, documents: rows });
}

export async function POST(request: Request) {
  await ensureTransportTables();
  const form = await request.formData();
  const file = form.get("file");
  const transportDate = String(form.get("transportDate") || "").trim();
  const uploadedBy = (form.get("uploadedBy") as string) || null;

  if (!(file instanceof File) || !transportDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows: maxRows } = await sql`
    SELECT COALESCE(MAX(version), 0) AS max_version FROM transport_dispatch_documents WHERE transport_date = ${transportDate};
  `;
  const nextVersion = Number(maxRows[0]?.max_version ?? 0) + 1;

  await sql`
    UPDATE transport_dispatch_documents SET is_current = false WHERE transport_date = ${transportDate};
  `;

  const pathname = `transport/dispatch/${transportDate}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

  const { rows } = await sql`
    INSERT INTO transport_dispatch_documents (transport_date, file_name, blob_url, mime_type, size_bytes, version, is_current, uploaded_by)
    VALUES (${transportDate}, ${file.name}, ${blob.url}, ${file.type || null}, ${file.size || null}, ${nextVersion}, true, ${uploadedBy})
    RETURNING id;
  `;

  await logTransportAudit("upload_dispatch_document", uploadedBy, { transportDate, version: nextVersion, fileName: file.name });

  return NextResponse.json({ ok: true, id: rows[0]!.id, version: nextVersion });
}


export async function DELETE(request: NextRequest) {
  await ensureTransportTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`SELECT id, blob_url FROM transport_dispatch_documents WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  if (rows[0].blob_url) {
    try { await del(rows[0].blob_url); } catch { /* blob may not exist */ }
  }
  await sql`DELETE FROM transport_dispatch_documents WHERE id = ${id}`;
  await logTransportAudit("delete_dispatch_document", null, { id });
  return NextResponse.json({ ok: true, deleted: { id } });
}
