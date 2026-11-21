import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instrumentId = Number(idParam);
  if (!instrumentId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows } = await sql`
SELECT * FROM instrument_failures WHERE instrument_id = ${instrumentId} ORDER BY failure_date DESC, id DESC
`;
  return NextResponse.json({ failures: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instrumentId = Number(idParam);
  if (!instrumentId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows: instrumentRows } = await sql`SELECT id FROM instruments WHERE id = ${instrumentId}`;
  if (instrumentRows.length === 0) return NextResponse.json({ error: "instrument_not_found" }, { status: 404 });

const form = await request.formData();
  const failureDate = String(form.get("failureDate") || "").trim();
  const description = String(form.get("description") || "").trim();
  if (!failureDate || !description) {
    return NextResponse.json({ error: "failure_date_and_description_required" }, { status: 400 });
  }

const failureType = (form.get("failureType") as string) || null;
  const diagnosis = (form.get("diagnosis") as string) || null;
  const correctiveAction = (form.get("correctiveAction") as string) || null;
  const responsible = (form.get("responsible") as string) || null;
  const status = (form.get("status") as string) || "abierta";
  const notes = (form.get("notes") as string) || null;
  const createdBy = (form.get("createdBy") as string) || "Usuario RPMS";

const { rows: failRows } = await sql`
INSERT INTO instrument_failures (
instrument_id, failure_date, failure_type, description, diagnosis, corrective_action, responsible, status, notes
) VALUES (
${instrumentId}, ${failureDate}, ${failureType}, ${description}, ${diagnosis}, ${correctiveAction}, ${responsible}, ${status}, ${notes}
)
RETURNING *
`;
  const failure = failRows[0] as { id: number };

const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const uploadedDocs: Record<string, unknown>[] = [];
  for (const file of files) {
    const pathname = `instruments/failures/${failure.id}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    const { rows: docRows } = await sql`
    INSERT INTO instrument_documents (
    owner_type, owner_id, category, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by
    ) VALUES (
    'failure', ${failure.id}, 'fotografia', ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || null}, ${createdBy}
    )
    RETURNING *
    `;
    uploadedDocs.push(docRows[0] as Record<string, unknown>);
  }

await sql`
INSERT INTO instrument_history (instrument_id, changed_by, field_name, old_value, new_value)
VALUES (${instrumentId}, ${createdBy}, 'falla', NULL, ${"Falla registrada: " + description.slice(0, 120)})
`;

return NextResponse.json({ failure, documents: uploadedDocs });
}
