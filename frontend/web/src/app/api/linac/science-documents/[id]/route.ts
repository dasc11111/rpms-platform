import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureScienceTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { rows } = await sql`SELECT * FROM documents WHERE id = ${id}`;
  const document = rows[0];
  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { rows: relations } = await sql`
    SELECT r.*, d1.original_name AS document_name, d2.original_name AS related_document_name
    FROM document_relations r
    LEFT JOIN documents d1 ON d1.id = r.document_id
    LEFT JOIN documents d2 ON d2.id = r.related_document_id
    WHERE r.document_id = ${id} OR r.related_document_id = ${id}
    ORDER BY r.created_at DESC
  `;

  const { rows: versionChain } = await sql`
    SELECT id, original_name, doc_version, doc_status, updated_at, previous_version_id
    FROM documents
    WHERE id = ${document.previous_version_id}::integer OR previous_version_id = ${id}
    ORDER BY updated_at DESC
  `;

  const { rows: versionAnalysis } = await sql`
    SELECT va.*, d1.original_name AS document_name, d2.original_name AS previous_document_name
    FROM document_version_analysis va
    LEFT JOIN documents d1 ON d1.id = va.document_id
    LEFT JOIN documents d2 ON d2.id = va.previous_document_id
    WHERE va.document_id = ${id} OR va.previous_document_id = ${id}
    ORDER BY va.created_at DESC
  `;

  return NextResponse.json({ document, relations, versionChain, versionAnalysis });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureScienceTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const action = body.action as string;

  const { rows: existingRows } = await sql`SELECT * FROM documents WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "cambiar_estado") {
    const newStatus = (body.docStatus || "").trim();
    const allowed = ["vigente", "proxima_revision", "requiere_revision", "obsoleto", "historico"];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const { rows } = await sql`
      UPDATE documents SET doc_status = ${newStatus}, updated_at = now() WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json({ document: rows[0] });
  }

  if (action === "actualizar_metadata") {
    const u = body.updates || {};
    const { rows } = await sql`
      UPDATE documents SET
        doc_type = ${u.docType ?? existing.doc_type},
        subcategory = ${u.subcategory ?? existing.subcategory},
        source_organism = ${u.sourceOrganism ?? existing.source_organism},
        doc_code = ${u.docCode ?? existing.doc_code},
        description = ${u.description ?? existing.description},
        keywords = ${u.keywords ?? existing.keywords},
        responsible = ${u.responsible ?? existing.responsible},
        observations = ${u.observations ?? existing.observations},
        review_date = ${u.reviewDate ?? existing.review_date},
        validity_date = ${u.validityDate ?? existing.validity_date},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json({ document: rows[0] });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
