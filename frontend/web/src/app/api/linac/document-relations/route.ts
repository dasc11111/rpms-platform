import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

const RELATION_TYPES = ["relacionado", "anexo", "addendum", "correccion", "circular", "guia", "interpretacion", "protocolo"];

export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const documentId = Number(searchParams.get("documentId") || 0);
  if (!documentId) return NextResponse.json({ relations: [] });

  const { rows } = await sql`
    SELECT r.*, d1.original_name AS document_name, d2.original_name AS related_document_name, d2.blob_url AS related_document_url
    FROM document_relations r
    LEFT JOIN documents d1 ON d1.id = r.document_id
    LEFT JOIN documents d2 ON d2.id = r.related_document_id
    WHERE r.document_id = ${documentId} OR r.related_document_id = ${documentId}
    ORDER BY r.created_at DESC
  `;
  return NextResponse.json({ relations: rows });
}

export async function POST(request: Request) {
  await ensureScienceTables();
  const body = await request.json();
  const documentId = Number(body.documentId || 0);
  const relatedDocumentId = Number(body.relatedDocumentId || 0);
  const relationType = RELATION_TYPES.includes(body.relationType) ? body.relationType : "relacionado";

  if (!documentId || !relatedDocumentId || documentId === relatedDocumentId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO document_relations (document_id, related_document_id, relation_type)
    VALUES (${documentId}, ${relatedDocumentId}, ${relationType})
    ON CONFLICT (document_id, related_document_id, relation_type) DO NOTHING
    RETURNING *
  `;
  return NextResponse.json({ relation: rows[0] || null });
}

export async function DELETE(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id") || 0);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  await sql`DELETE FROM document_relations WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
