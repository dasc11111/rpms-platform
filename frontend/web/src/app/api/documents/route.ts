import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const SORTABLE: Record<string, string> = {
  name: "original_name",
  created_at: "created_at",
  updated_at: "updated_at",
  size: "size_bytes",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId") || 0);
  const search = (searchParams.get("search") || "").trim();
  const sortByParam = searchParams.get("sortBy") || "created_at";
  const sortDirParam = (searchParams.get("sortDir") || "desc").toLowerCase();
  const sortColumn = SORTABLE[sortByParam] ?? "created_at";
  const sortDir = sortDirParam === "asc" ? "ASC" : "DESC";

if (!categoryId) {
  return NextResponse.json({ documents: [] });
}

const params: unknown[] = [categoryId];
  let where = "category_id = $1";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND original_name ILIKE $${params.length}`;
  }

const { rows } = await sql.query(
  `SELECT id, original_name, blob_url, size_bytes, mime_type, uploaded_by, created_at, updated_at
  FROM documents
  WHERE ${where}
  ORDER BY ${sortColumn} ${sortDir}
  LIMIT 500`,
  params
  );

return NextResponse.json({ documents: rows });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const categoryId = Number(form.get("categoryId") || 0);
  const uploadedBy = (form.get("uploadedBy") as string) || "Usuario RPMS";

if (!(file instanceof File) || !categoryId) {
  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}

const { rows: catRows } = await sql`SELECT id FROM document_categories WHERE id = ${categoryId}`;
  if (catRows.length === 0) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }

const pathname = `documents/${categoryId}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "public" });

const { rows } = await sql`
INSERT INTO documents (category_id, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by)
VALUES (${categoryId}, ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || null}, ${uploadedBy})
RETURNING id, original_name, blob_url, size_bytes, mime_type, uploaded_by, created_at, updated_at
`;

return NextResponse.json({ document: rows[0] });
}
