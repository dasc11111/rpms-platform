import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const like = `%${q}%`;

  const { rows: docRows } = await sql`
    SELECT id, original_name, doc_code, doc_version, subcategory, description, keywords,
           doc_status, category_id, blob_url
    FROM documents
    WHERE original_name ILIKE ${like} OR doc_code ILIKE ${like} OR keywords ILIKE ${like}
       OR description ILIKE ${like} OR extracted_text ILIKE ${like} OR source_organism ILIKE ${like}
    ORDER BY updated_at DESC
    LIMIT 40
  `;

  const { rows: criteriaRows } = await sql`
    SELECT c.id, c.parameter_name, c.value, c.unit, c.tolerance, c.status, c.module,
           c.page, c.chapter, c.section, c.table_ref, c.fragment_text, c.source_name,
           d.original_name AS document_name, d.id AS document_id
    FROM linac_technical_criteria c
    LEFT JOIN documents d ON d.id = c.document_id
    WHERE c.parameter_name ILIKE ${like} OR c.source_name ILIKE ${like}
       OR c.fragment_text ILIKE ${like} OR c.unit ILIKE ${like} OR c.section ILIKE ${like}
       OR c.chapter ILIKE ${like} OR c.table_ref ILIKE ${like}
    ORDER BY c.updated_at DESC
    LIMIT 40
  `;

  const results = [
    ...docRows.map((d: any) => ({
      type: "documento",
      id: d.id,
      title: d.original_name,
      subtitle: [d.doc_code, d.subcategory, d.doc_version ? `v${d.doc_version}` : null].filter(Boolean).join(" · "),
      status: d.doc_status,
      fragment: d.description || d.keywords || null,
      documentId: d.id,
      documentUrl: d.blob_url,
    })),
    ...criteriaRows.map((c: any) => ({
      type: "criterio",
      id: c.id,
      title: `${c.parameter_name}${c.value ? ": " + c.value : ""}${c.unit ? " " + c.unit : ""}`,
      subtitle: [c.source_name, c.module, c.status].filter(Boolean).join(" · "),
      status: c.status,
      fragment: c.fragment_text || null,
      page: c.page,
      chapter: c.chapter,
      section: c.section,
      tableRef: c.table_ref,
      documentId: c.document_id,
      documentName: c.document_name,
    })),
  ];

  return NextResponse.json({ results, query: q });
}
