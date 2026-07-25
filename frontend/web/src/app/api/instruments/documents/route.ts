import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

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
