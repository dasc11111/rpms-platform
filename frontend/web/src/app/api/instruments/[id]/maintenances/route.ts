import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instrumentId = Number(idParam);
  if (!instrumentId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows } = await sql`
SELECT * FROM instrument_maintenances WHERE instrument_id = ${instrumentId} ORDER BY maintenance_date DESC, id DESC
`;
  return NextResponse.json({ maintenances: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instrumentId = Number(idParam);
  if (!instrumentId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows: instrumentRows } = await sql`SELECT id FROM instruments WHERE id = ${instrumentId}`;
  if (instrumentRows.length === 0) return NextResponse.json({ error: "instrument_not_found" }, { status: 404 });

const form = await request.formData();
  const maintenanceDate = String(form.get("maintenanceDate") || "").trim();
  if (!maintenanceDate) return NextResponse.json({ error: "maintenance_date_required" }, { status: 400 });

const maintenanceType = (form.get("maintenanceType") as string) || "preventivo";
  const company = (form.get("company") as string) || null;
  const responsible = (form.get("responsible") as string) || null;
  const notes = (form.get("notes") as string) || null;
  const costRaw = form.get("cost") as string | null;
  const cost = costRaw ? Number(costRaw) : null;
  const createdBy = (form.get("createdBy") as string) || "Usuario RPMS";

const { rows: maintRows } = await sql`
INSERT INTO instrument_maintenances (
instrument_id, maintenance_type, maintenance_date, company, responsible, notes, cost
) VALUES (
${instrumentId}, ${maintenanceType}, ${maintenanceDate}, ${company}, ${responsible}, ${notes}, ${cost}
)
RETURNING *
`;
  const maintenance = maintRows[0] as { id: number };

const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const uploadedDocs: Record<string, unknown>[] = [];
  for (const file of files) {
    const pathname = `instruments/maintenances/${maintenance.id}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    const { rows: docRows } = await sql`
    INSERT INTO instrument_documents (
    owner_type, owner_id, category, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by
    ) VALUES (
    'maintenance', ${maintenance.id}, 'informe_tecnico', ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || null}, ${createdBy}
    )
    RETURNING *
    `;
    uploadedDocs.push(docRows[0] as Record<string, unknown>);
  }

await sql`
INSERT INTO instrument_history (instrument_id, changed_by, field_name, old_value, new_value)
VALUES (${instrumentId}, ${createdBy}, 'mantenimiento', NULL, ${"Mantenimiento " + maintenanceType + " registrado: " + maintenanceDate})
`;

return NextResponse.json({ maintenance, documents: uploadedDocs });
}
