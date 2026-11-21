import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureTransportTables, logTransportAudit } from "@/lib/transport";

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
