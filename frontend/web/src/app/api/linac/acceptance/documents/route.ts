import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureAcceptanceTables, logAcceptanceAudit } from "@/lib/linac-acceptance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureAcceptanceTables();
  const { searchParams } = new URL(request.url);
  const acceptanceTestId = searchParams.get("acceptanceTestId");
  if (!acceptanceTestId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { rows } = await sql`
  SELECT * FROM linac_acceptance_documents WHERE acceptance_test_id = ${acceptanceTestId} ORDER BY uploaded_at DESC
  `;
  return NextResponse.json({ ok: true, documents: rows });
}

export async function POST(request: Request) {
  await ensureAcceptanceTables();
  const form = await request.formData();
  const file = form.get("file");
  const acceptanceTestId = Number(form.get("acceptanceTestId"));
  const category = String(form.get("category") || "informe").trim();
  const title = String(form.get("title") || "").trim();
  const uploadedBy = (form.get("uploadedBy") as string) || null;
  if (!acceptanceTestId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

const pathname = `linac/acceptance/${acceptanceTestId}/${category}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

const { rows } = await sql`
INSERT INTO linac_acceptance_documents (
acceptance_test_id, category, title, file_name, blob_url, mime_type, size_bytes, uploaded_by
) VALUES (
${acceptanceTestId}, ${category}, ${title || file.name}, ${file.name}, ${blob.url}, ${file.type || null}, ${file.size || null}, ${uploadedBy}
)
RETURNING id;
`;

await logAcceptanceAudit("upload_acceptance_document", uploadedBy, { acceptanceTestId, category, title });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
