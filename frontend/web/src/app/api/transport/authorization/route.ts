import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureTransportTables, logTransportAudit } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureTransportTables();
  const { rows } = await sql`
    SELECT id, number, issued_date, expiry_date, file_name, mime_type, size_bytes, version, is_current, uploaded_by, uploaded_at
    FROM transport_authorization_documents
    ORDER BY version DESC;
  `;
  const current = rows.find((r: any) => r.is_current) || null;
  return NextResponse.json({ ok: true, current, history: rows });
}

export async function POST(request: Request) {
  await ensureTransportTables();
  const form = await request.formData();
  const file = form.get("file");
  const number = (form.get("number") as string) || null;
  const issuedDate = (form.get("issuedDate") as string) || null;
  const expiryDate = (form.get("expiryDate") as string) || null;
  const uploadedBy = (form.get("uploadedBy") as string) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const { rows: maxRows } = await sql`SELECT COALESCE(MAX(version), 0) AS max_version FROM transport_authorization_documents;`;
  const nextVersion = Number(maxRows[0]?.max_version ?? 0) + 1;

  await sql`UPDATE transport_authorization_documents SET is_current = false;`;

  const pathname = `transport/authorization/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

  const { rows } = await sql`
    INSERT INTO transport_authorization_documents (number, issued_date, expiry_date, file_name, blob_url, mime_type, size_bytes, version, is_current, uploaded_by)
    VALUES (${number}, ${issuedDate}, ${expiryDate}, ${file.name}, ${blob.url}, ${file.type || null}, ${file.size || null}, ${nextVersion}, true, ${uploadedBy})
    RETURNING id;
  `;

  await logTransportAudit("upload_transport_authorization", uploadedBy, { number, issuedDate, expiryDate, version: nextVersion });

  return NextResponse.json({ ok: true, id: rows[0].id, version: nextVersion });
}
