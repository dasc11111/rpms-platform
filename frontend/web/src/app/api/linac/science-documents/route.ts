import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId") || 0);
  const categoryRootId = Number(searchParams.get("categoryRootId") || 0);
  const checkName = (searchParams.get("checkName") || "").trim();
  const docStatus = (searchParams.get("docStatus") || "").trim();
  const docType = (searchParams.get("docType") || "").trim();
  const search = (searchParams.get("search") || "").trim();

  if (checkName) {
    if (!categoryId) return NextResponse.json({ candidates: [] });
    const { rows } = await sql`
      SELECT id, original_name, doc_version, doc_status, updated_at
      FROM documents
      WHERE category_id = ${categoryId}
        AND original_name ILIKE ${"%" + checkName + "%"}
        AND doc_status != 'historico'
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    return NextResponse.json({ candidates: rows });
  }

  const params: unknown[] = [];
  const clauses: string[] = [];
  if (categoryId) {
    params.push(categoryId);
    clauses.push(`category_id = ${params.length}`);
  } else if (categoryRootId) {
    const { rows: subtreeRows } = await sql`SELECT id FROM document_categories WHERE id = ${categoryRootId} OR parent_id = ${categoryRootId}`;
    const ids = subtreeRows.map((r: any) => r.id);
    params.push(ids.length > 0 ? ids : [-1]);
    clauses.push(`category_id = ANY(${params.length}::int[])`);
  }
  if (docStatus) {
    params.push(docStatus);
    clauses.push(`doc_status = $${params.length}`);
  }
  if (docType) {
    params.push(docType);
    clauses.push(`doc_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(original_name ILIKE $${params.length} OR doc_code ILIKE $${params.length} OR keywords ILIKE $${params.length} OR description ILIKE $${params.length} OR source_organism ILIKE $${params.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await sql.query(
    `SELECT id, category_id, original_name, doc_type, subcategory, source_organism, doc_code,
            doc_version, publication_date, validity_date, review_date, description, keywords,
            doc_status, responsible, observations, previous_version_id, blob_url, size_bytes,
            mime_type, uploaded_by, created_at, updated_at
     FROM documents
     ${where}
     ORDER BY updated_at DESC
     LIMIT 300`,
    params
  );

  const ids = rows.map((r: any) => r.id);
  let newerMap: Record<number, number> = {};
  if (ids.length > 0) {
    const { rows: newerRows } = await sql.query(
      `SELECT previous_version_id, id FROM documents WHERE previous_version_id = ANY($1::int[])`,
      [ids]
    );
    newerRows.forEach((n: any) => { newerMap[n.previous_version_id] = n.id; });
  }
  const documents = rows.map((r: any) => ({ ...r, newer_version_id: newerMap[r.id] || null }));

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  await ensureScienceTables();
  const form = await request.formData();
  const file = form.get("file");
  const categoryId = Number(form.get("categoryId") || 0);
  const uploadedBy = (form.get("uploadedBy") as string) || "Usuario RPMS";
  const previousVersionId = form.get("previousVersionId") ? Number(form.get("previousVersionId")) : null;

  if (!(file instanceof File) || file.size === 0 || !categoryId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows: catRows } = await sql`SELECT id FROM document_categories WHERE id = ${categoryId}`;
  if (catRows.length === 0) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }

  let previousDoc: any = null;
  if (previousVersionId) {
    const { rows: prevRows } = await sql`SELECT * FROM documents WHERE id = ${previousVersionId}`;
    previousDoc = prevRows[0] || null;
    if (!previousDoc) {
      return NextResponse.json({ error: "previous_version_not_found" }, { status: 404 });
    }
  }

  const pathname = `documents/${categoryId}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

  const docType = (form.get("docType") as string) || null;
  const subcategory = (form.get("subcategory") as string) || null;
  const sourceOrganism = (form.get("sourceOrganism") as string) || null;
  const docCode = (form.get("docCode") as string) || null;
  const docVersion = (form.get("docVersion") as string) || "1";
  const publicationDate = (form.get("publicationDate") as string) || null;
  const validityDate = (form.get("validityDate") as string) || null;
  const description = (form.get("description") as string) || null;
  const keywords = (form.get("keywords") as string) || null;
  const responsible = (form.get("responsible") as string) || null;
  const observations = (form.get("observations") as string) || null;

  const { rows } = await sql`
    INSERT INTO documents (
      category_id, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by,
      doc_type, subcategory, source_organism, doc_code, doc_version, publication_date, validity_date,
      description, keywords, doc_status, responsible, observations, previous_version_id
    ) VALUES (
      ${categoryId}, ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || null}, ${uploadedBy},
      ${docType}, ${subcategory}, ${sourceOrganism}, ${docCode}, ${docVersion}, ${publicationDate}, ${validityDate},
      ${description}, ${keywords}, 'vigente', ${responsible}, ${observations}, ${previousVersionId}
    )
    RETURNING *
  `;
  const created: any = rows[0];

  if (previousDoc && created) {
    await sql`UPDATE documents SET doc_status = 'historico', updated_at = now() WHERE id = ${previousDoc.id}`;
    await sql`
      INSERT INTO document_version_analysis (document_id, previous_document_id, status)
      VALUES (${created.id}, ${previousDoc.id}, 'pendiente')
    `;
  }

  return NextResponse.json({ document: created });
}
