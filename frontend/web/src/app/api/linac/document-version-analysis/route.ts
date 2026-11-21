import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const documentId = Number(searchParams.get("documentId") || 0);
  const status = (searchParams.get("status") || "").trim();

  const params: unknown[] = [];
  const clauses: string[] = [];
  if (documentId) {
    params.push(documentId);
    clauses.push(`(va.document_id = $${params.length} OR va.previous_document_id = $${params.length})`);
  }
  if (status) {
    params.push(status);
    clauses.push(`va.status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await sql.query(
    `SELECT va.*, d1.original_name AS document_name, d1.blob_url AS document_url,
            d2.original_name AS previous_document_name, d2.blob_url AS previous_document_url
     FROM document_version_analysis va
     LEFT JOIN documents d1 ON d1.id = va.document_id
     LEFT JOIN documents d2 ON d2.id = va.previous_document_id
     ${where}
     ORDER BY va.created_at DESC
     LIMIT 300`,
    params
  );
  return NextResponse.json({ analyses: rows });
}
