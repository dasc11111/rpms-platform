import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABLES = {
  authorizations: "linac_authorizations",
  qc: "linac_qc_tests",
  maintenance: "linac_maintenance",
  incidents: "linac_incidents",
  documents: "linac_documents",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");
  const id = Number(searchParams.get("id"));
  if (!TABLES[table] || !id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  let rows;
  if (table === "authorizations") rows = (await sql`SELECT file_name, blob_url, mime_type, size_bytes FROM linac_authorizations WHERE id = ${id}`).rows;
  else if (table === "qc") rows = (await sql`SELECT file_name, blob_url, mime_type FROM linac_qc_tests WHERE id = ${id}`).rows;
  else if (table === "maintenance") rows = (await sql`SELECT file_name, blob_url, mime_type FROM linac_maintenance WHERE id = ${id}`).rows;
  else if (table === "incidents") rows = (await sql`SELECT file_name, blob_url, mime_type FROM linac_incidents WHERE id = ${id}`).rows;
  else if (table === "documents") rows = (await sql`SELECT file_name, blob_url, mime_type, size_bytes FROM linac_documents WHERE id = ${id}`).rows;

  const doc = rows && rows[0];
  if (!doc || !doc.blob_url) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const blobRes = await fetch(doc.blob_url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!blobRes.ok || !blobRes.body) {
    return NextResponse.json({ error: "blob_fetch_failed" }, { status: 502 });
  }

  const forceDownload = searchParams.get("dl") === "1";
  const disposition = forceDownload ? "attachment" : "inline";
  const filename = doc.file_name || "archivo";
  const safeFilename = filename.replace(/["\\]/g, "_");

  const headers = new Headers();
  headers.set("Content-Type", doc.mime_type || "application/octet-stream");
  headers.set(
    "Content-Disposition",
    `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  if (doc.size_bytes) headers.set("Content-Length", String(doc.size_bytes));

  return new NextResponse(blobRes.body, { headers });
}
