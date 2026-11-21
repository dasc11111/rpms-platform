import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instrumentId = Number(idParam);
  if (!instrumentId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows } = await sql`
SELECT c.*, COALESCE(c.company_name, cc.name) AS company_name_resolved
FROM calibrations c
LEFT JOIN calibration_companies cc ON cc.id = c.company_id
WHERE c.instrument_id = ${instrumentId}
ORDER BY c.calibration_date DESC, c.id DESC
`;
  return NextResponse.json({ calibrations: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instrumentId = Number(idParam);
  if (!instrumentId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows: instrumentRows } = await sql`SELECT id, name FROM instruments WHERE id = ${instrumentId}`;
  const instrument = instrumentRows[0] as { id: number; name: string } | undefined;
  if (!instrument) return NextResponse.json({ error: "instrument_not_found" }, { status: 404 });

const form = await request.formData();
  const calibrationDate = String(form.get("calibrationDate") || "").trim();
  if (!calibrationDate) return NextResponse.json({ error: "calibration_date_required" }, { status: 400 });

const expiryDate = (form.get("expiryDate") as string) || null;
  const certificateNumber = (form.get("certificateNumber") as string) || null;
  const calibrationFactorRaw = form.get("calibrationFactor") as string | null;
  const calibrationFactor = calibrationFactorRaw ? Number(calibrationFactorRaw) : null;
  const magnitude = (form.get("magnitude") as string) || null;
  const units = (form.get("units") as string) || null;
  const method = (form.get("method") as string) || null;
  const standardUsed = (form.get("standardUsed") as string) || null;
  const notes = (form.get("notes") as string) || null;
  const createdBy = (form.get("createdBy") as string) || "Usuario RPMS";
  const companyNameInput = ((form.get("companyName") as string) || "").trim();
  const companyIdInput = form.get("companyId") as string | null;

let companyId: number | null = companyIdInput ? Number(companyIdInput) : null;
  let companyName: string | null = null;

if (!companyId && companyNameInput) {
  const { rows: existingCompany } = await sql`SELECT id, name FROM calibration_companies WHERE name = ${companyNameInput}`;
  if (existingCompany.length > 0) {
    companyId = existingCompany[0]?.id as number;
  } else {
    const { rows: newCompany } = await sql`
    INSERT INTO calibration_companies (name, kind) VALUES (${companyNameInput}, 'Otro')
    RETURNING id, name
    `;
    companyId = newCompany[0]?.id as number;
  }
  companyName = companyNameInput;
}

const { rows: calRows } = await sql`
INSERT INTO calibrations (
instrument_id, calibration_date, expiry_date, company_id, company_name, certificate_number,
calibration_factor, magnitude, units, method, standard_used, notes, created_by
) VALUES (
${instrumentId}, ${calibrationDate}, ${expiryDate}, ${companyId}, ${companyName}, ${certificateNumber},
${calibrationFactor}, ${magnitude}, ${units}, ${method}, ${standardUsed}, ${notes}, ${createdBy}
)
RETURNING *
`;
  const calibration = calRows[0] as { id: number };

const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const categories = form.getAll("categories").map((c) => String(c));
  const uploadedDocs: Record<string, unknown>[] = [];

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  if (!file) continue;
  const category = categories[i] || "otro";
  const pathname = `instruments/calibrations/${calibration.id}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });
  const { rows: docRows } = await sql`
  INSERT INTO instrument_documents (
  owner_type, owner_id, category, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by
  ) VALUES (
  'calibration', ${calibration.id}, ${category}, ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || null}, ${createdBy}
  )
  RETURNING *
  `;
  uploadedDocs.push(docRows[0] as Record<string, unknown>);
}

await sql`
INSERT INTO instrument_history (instrument_id, changed_by, field_name, old_value, new_value)
VALUES (
${instrumentId}, ${createdBy}, 'calibracion',
NULL,
${"Nueva calibracion registrada: " + calibrationDate + (expiryDate ? " (vence " + expiryDate + ")" : "")}
)
`;

return NextResponse.json({ calibration, documents: uploadedDocs });
}
