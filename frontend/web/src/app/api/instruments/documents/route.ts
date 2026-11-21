import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_OWNER_TYPES = ["instrument", "calibration", "failure", "maintenance"];

export async function POST(request: Request) {
  const form = await request.formData();
  const ownerType = String(form.get("ownerType") || "");
  const ownerId = Number(form.get("ownerId") || 0);
  const category = (form.get("category") as string) || "otro";
  const uploadedBy = (form.get("uploadedBy") as string) || "Usuario RPMS";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

if (!VALID_OWNER_TYPES.includes(ownerType) || !ownerId) {
  return NextResponse.json({ error: "invalid_owner" }, { status: 400 });
}
  if (files.length === 0) {
    return NextResponse.json({ error: "no_files" }, { status: 400 });
  }

const uploaded: Record<string, unknown>[] = [];
  for (const file of files) {
    const pathname = `instruments/${ownerType}/${ownerId}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    const { rows } = await sql`
    INSERT INTO instrument_documents (
    owner_type, owner_id, category, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by
    ) VALUES (
    ${ownerType}, ${ownerId}, ${category}, ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || null}, ${uploadedBy}
    )
    RETURNING *
    `;
    uploaded.push(rows[0] as Record<string, unknown>);
  }

return NextResponse.json({ documents: uploaded });
}


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerType = String(searchParams.get("ownerType") || "");
  const ownerId = Number(searchParams.get("ownerId") || 0);
  if (!VALID_OWNER_TYPES.includes(ownerType) || !ownerId) {
    return NextResponse.json({ error: "invalid_owner" }, { status: 400 });
  }
  const { rows } = await sql`
    SELECT id, owner_type, owner_id, category, original_name, blob_url, size_bytes, mime_type, uploaded_by, uploaded_at
    FROM instrument_documents
    WHERE owner_type = ${ownerType} AND owner_id = ${ownerId}
    ORDER BY uploaded_at DESC
  `;
  return NextResponse.json({ documents: rows });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`SELECT id, blob_url FROM instrument_documents WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  if (rows[0].blob_url) {
    try { await del(rows[0].blob_url); } catch { /* blob may not exist */ }
  }
  await sql`DELETE FROM instrument_documents WHERE id = ${id}`;
  return NextResponse.json({ ok: true, deleted: { id } });
}
