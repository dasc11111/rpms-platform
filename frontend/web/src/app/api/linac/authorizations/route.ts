import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit, computeVigencyLevel } from "@/lib/linac";

export const dynamic = "force-dynamic";

export async function GET(request) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const rows = linacId
    ? (await sql`SELECT * FROM linac_authorizations WHERE linac_id = ${Number(linacId)} ORDER BY doc_type, version DESC`).rows
    : (await sql`SELECT * FROM linac_authorizations ORDER BY doc_type, version DESC`).rows;
  const authorizations = rows.map((r) => ({ ...r, vigencyLevel: computeVigencyLevel(r.expiry_date) }));
  return NextResponse.json({ ok: true, authorizations });
}

export async function POST(request) {
  await ensureLinacTables();
  const form = await request.formData();
  const file = form.get("file");
  const linacId = Number(form.get("linacId"));
  const docType = String(form.get("docType") || "").trim();
  const documentNumber = (form.get("documentNumber") || null);
  const issueDate = (form.get("issueDate") || null);
  const expiryDate = (form.get("expiryDate") || null);
  const uploadedBy = (form.get("uploadedBy") || null);
  if (!linacId || !docType) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { rows: maxRows } = await sql`
    SELECT COALESCE(MAX(version), 0) AS max_version FROM linac_authorizations WHERE linac_id = ${linacId} AND doc_type = ${docType};
  `;
  const nextVersion = Number(maxRows[0]?.max_version ?? 0) + 1;

  await sql`UPDATE linac_authorizations SET is_current = false WHERE linac_id = ${linacId} AND doc_type = ${docType};`;

  let blobUrl = null;
  let fileName = null;
  let mimeType = null;
  let sizeBytes = null;
  if (file instanceof File && file.size > 0) {
    const pathname = `linac/authorizations/${linacId}/${docType}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    blobUrl = blob.url;
    fileName = file.name;
    mimeType = file.type || null;
    sizeBytes = file.size || null;
  }

  const { rows } = await sql`
    INSERT INTO linac_authorizations (
      linac_id, doc_type, document_number, issue_date, expiry_date,
      file_name, blob_url, mime_type, size_bytes, version, is_current, uploaded_by
    ) VALUES (
      ${linacId}, ${docType}, ${documentNumber}, ${issueDate}, ${expiryDate},
      ${fileName}, ${blobUrl}, ${mimeType}, ${sizeBytes}, ${nextVersion}, true, ${uploadedBy}
    )
    RETURNING id;
  `;

  await logLinacAudit("upload_linac_authorization", uploadedBy, { linacId, docType, version: nextVersion, expiryDate });
  return NextResponse.json({ ok: true, id: rows[0].id, version: nextVersion });
}
