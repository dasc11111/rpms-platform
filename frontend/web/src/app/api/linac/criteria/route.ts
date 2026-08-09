import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const module_ = searchParams.get("module") || "";
  const linacId = Number(searchParams.get("linacId") || 0);
  const status = searchParams.get("status") || "";
  const search = (searchParams.get("search") || "").trim();

  const params: unknown[] = [];
  const clauses: string[] = [];
  if (module_) {
    params.push(module_);
    clauses.push(`c.module = $${params.length}`);
  }
  if (linacId) {
    params.push(linacId);
    clauses.push(`c.linac_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`c.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(c.parameter_name ILIKE $${params.length} OR c.source_name ILIKE $${params.length} OR c.fragment_text ILIKE $${params.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await sql.query(
    `SELECT c.*, d.original_name AS document_name, d.doc_code AS document_code, d.blob_url AS document_url
     FROM linac_technical_criteria c
     LEFT JOIN documents d ON d.id = c.document_id
     ${where}
     ORDER BY c.status = 'propuesto' DESC, c.updated_at DESC
     LIMIT 500`,
    params
  );

  return NextResponse.json({ criteria: rows });
}

export async function POST(request: Request) {
  await ensureScienceTables();
  const body = await request.json();
  const parameterName = (body.parameterName || "").trim();
  const module_ = (body.module || "general").trim();
  if (!parameterName) {
    return NextResponse.json({ error: "parameter_name_required" }, { status: 400 });
  }

  const linacId = body.linacId ? Number(body.linacId) : null;
  const sourceLevel = body.sourceLevel ? Number(body.sourceLevel) : null;
  const documentId = body.documentId ? Number(body.documentId) : null;

  const { rows } = await sql`
    INSERT INTO linac_technical_criteria (
      parameter_name, module, linac_id, value, unit, tolerance, action_limit,
      investigation_limit, critical_limit, source_level, source_name, document_id,
      document_version, page, chapter, section, table_ref, fragment_text,
      status, proposed_by
    ) VALUES (
      ${parameterName}, ${module_}, ${linacId}, ${body.value || null}, ${body.unit || null},
      ${body.tolerance || null}, ${body.actionLimit || null}, ${body.investigationLimit || null},
      ${body.criticalLimit || null}, ${sourceLevel}, ${body.sourceName || null}, ${documentId},
      ${body.documentVersion || null}, ${body.page || null}, ${body.chapter || null},
      ${body.section || null}, ${body.tableRef || null}, ${body.fragmentText || null},
      'propuesto', ${body.proposedBy || "Usuario RPMS"}
    )
    RETURNING *
  `;

  const criteria: any = rows[0];
  if (!criteria) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await sql`
    INSERT INTO linac_criteria_audit (criteria_id, action, actor, new_data, reason)
    VALUES (${criteria.id}, 'propuesto', ${body.proposedBy || "Usuario RPMS"}, ${JSON.stringify(criteria)}::jsonb, 'Criterio tecnico propuesto desde fuente documental')
  `;

  return NextResponse.json({ criteria });
}
