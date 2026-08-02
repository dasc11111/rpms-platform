import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type ConfirmRow = {
  worker_rut: string;
  worker_name_report?: string;
  worker_name_system?: string;
  institucion?: string;
  departamento?: string;
  year: number | null;
  quarter: number | null;
  period_label?: string;
  dosimeter_number?: string;
  dosimeter_type?: string;
  radiation_type?: string;
  proceso?: string;
  hp10?: number | null;
  hp3?: number | null;
  hp007?: number | null;
  accum_year_body?: number | null;
  accum_12m_body?: number | null;
  accum_60m_body?: number | null;
  resolution: "actualizar" | "duplicar" | "cancelar" | "nuevo";
};

function levelFor(dose: number): string {
  if (dose >= 5) return "intervencion";
  if (dose >= 1.6) return "investigacion";
  if (dose >= 0.1) return "registro";
  return "normal";
}

function tipoFor(dosimeterType?: string | null): string {
  return dosimeterType && /extrem/i.test(dosimeterType) ? "EXTREMIDAD" : "C.E.";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const rowsRaw = String(form.get("rows") ?? "[]");
  const uploadedBy = (form.get("uploadedBy") as string) || "Usuario RPMS";
  const usedOcr = String(form.get("usedOcr") ?? "false") === "true";
  const fileHash = String(form.get("fileHash") ?? "");

if (!(file instanceof File)) {
  return NextResponse.json({ error: "invalid_file" }, { status: 400 });
}

let rows: ConfirmRow[] = [];
  try {
    rows = JSON.parse(rowsRaw);
  } catch {
    return NextResponse.json({ error: "invalid_rows" }, { status: 400 });
  }

await sql`
CREATE TABLE IF NOT EXISTS dosimetry_documents (
id SERIAL PRIMARY KEY,
filename TEXT NOT NULL,
blob_url TEXT,
mime_type TEXT,
size_bytes INT,
file_hash TEXT UNIQUE,
source_type TEXT DEFAULT 'pdf',
provider TEXT,
period_label TEXT,
year INT,
uploaded_by TEXT,
uploaded_at TIMESTAMP DEFAULT now(),
used_ocr BOOLEAN DEFAULT false,
records_count INT DEFAULT 0,
status TEXT DEFAULT 'processed'
)
`;
  await sql`
  CREATE TABLE IF NOT EXISTS dosimetry_quarterly_history (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES dosimetry_documents(id),
  worker_rut TEXT,
  worker_name TEXT,
  year INT,
  quarter INT,
  period_label TEXT,
  action TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
  )
  `;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS source_document_id INT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS entry_method TEXT DEFAULT 'manual'`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dosimeter_number TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dosimeter_type TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS radiation_type TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS proceso TEXT`;

const pathname = `dosimetry/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, { access: "private" });

const periodsUsed = Array.from(new Set(rows.map((r) => r.period_label).filter(Boolean)));
  const yearsUsed = Array.from(new Set(rows.map((r) => r.year).filter(Boolean)));

const { rows: docRows } = await sql`
INSERT INTO dosimetry_documents (
filename, blob_url, mime_type, size_bytes, file_hash, source_type,
provider, period_label, year, uploaded_by, used_ocr, records_count, status
) VALUES (
${file.name}, ${blob.url}, ${file.type || "application/pdf"}, ${file.size},
${fileHash || null}, 'pdf', ${null}, ${periodsUsed.join(", ") || null},
${yearsUsed[0] || null}, ${uploadedBy}, ${usedOcr}, ${rows.length}, 'processed'
)
ON CONFLICT (file_hash) DO UPDATE SET records_count = EXCLUDED.records_count
RETURNING id
`;
  const documentId = docRows[0]?.id;

let created = 0;
  let updated = 0;
  let duplicated = 0;
  let skipped = 0;

for (const r of rows) {
  if (!r.worker_rut || !r.year || !r.quarter || r.resolution === "cancelar") {
    skipped++;
    continue;
  }
  const periodLabel = r.period_label || `T${r.quarter}-${r.year}`;
  const doseBody = toNum(r.hp10) ?? 0;
  const doseLens = toNum(r.hp3) ?? 0;
  const doseSkin = toNum(r.hp007) ?? 0;
  const level = levelFor(doseBody);
  const workerName = r.worker_name_system || r.worker_name_report || "";

  if (r.resolution === "duplicar") {
    await sql`
    INSERT INTO dosimetry_quarterly_history (
    document_id, worker_rut, worker_name, year, quarter, period_label, action, payload
    ) VALUES (
    ${documentId}, ${r.worker_rut}, ${workerName}, ${r.year}, ${r.quarter}, ${periodLabel}, 'duplicate',
    ${JSON.stringify(r)}
    )
    `;
    duplicated++;
    continue;
  }

  const { rows: existing } = await sql`
  SELECT * FROM dosimetry_quarterly WHERE worker_rut = ${r.worker_rut} AND year = ${r.year} AND quarter = ${r.quarter}
  `;

  if (existing.length > 0) {
    await sql`
    INSERT INTO dosimetry_quarterly_history (
    document_id, worker_rut, worker_name, year, quarter, period_label, action, payload
    ) VALUES (
    ${documentId}, ${r.worker_rut}, ${workerName}, ${r.year}, ${r.quarter}, ${periodLabel}, 'superseded_by_update',
    ${JSON.stringify(existing[0])}
    )
    `;
    await sql`
    UPDATE dosimetry_quarterly SET
    worker_name = ${workerName},
    institucion = ${r.institucion || null},
    departamento = ${r.departamento || null},
    dose_body = ${doseBody},
    dose_lens = ${doseLens},
    dose_skin = ${doseSkin},
    accum_year_body = ${toNum(r.accum_year_body) ?? 0},
    accum_12m_body = ${toNum(r.accum_12m_body) ?? 0},
    accum_60m_body = ${toNum(r.accum_60m_body) ?? 0},
    level = ${level},
    source_document_id = ${documentId},
    entry_method = 'pdf',
    dosimeter_number = ${r.dosimeter_number || null},
    dosimeter_type = ${r.dosimeter_type || null},
    radiation_type = ${r.radiation_type || null},
      dosimetro = ${r.dosimeter_number || null},
      tipo = ${tipoFor(r.dosimeter_type)},
      radiacion = ${r.radiation_type || null},
    proceso = ${r.proceso || null},
    updated_at = now()
    WHERE worker_rut = ${r.worker_rut} AND year = ${r.year} AND quarter = ${r.quarter}
    `;
    updated++;
  } else {
    await sql`
    INSERT INTO dosimetry_quarterly (
    worker_rut, worker_name, institucion, departamento, year, quarter, period_label,
    dose_body, dose_lens, dose_skin, accum_year_body, accum_12m_body, accum_60m_body,
    accum_60m_lens, accum_60m_skin, level, source_document_id, entry_method,
    dosimeter_number, dosimeter_type, radiation_type, dosimetro, tipo, radiacion, proceso, updated_at
    ) VALUES (
    ${r.worker_rut}, ${workerName}, ${r.institucion || null}, ${r.departamento || null},
    ${r.year}, ${r.quarter}, ${periodLabel},
    ${doseBody}, ${doseLens}, ${doseSkin},
    ${toNum(r.accum_year_body) ?? 0}, ${toNum(r.accum_12m_body) ?? 0}, ${toNum(r.accum_60m_body) ?? 0},
    0, 0, ${level}, ${documentId}, 'pdf',
    ${r.dosimeter_number || null}, ${r.dosimeter_type || null}, ${r.radiation_type || null}, ${r.dosimeter_number || null}, ${tipoFor(r.dosimeter_type)}, ${r.radiation_type || null}, ${r.proceso || null}, now()
    )
    `;
    await sql`
    INSERT INTO dosimetry_quarterly_history (
    document_id, worker_rut, worker_name, year, quarter, period_label, action, payload
    ) VALUES (
    ${documentId}, ${r.worker_rut}, ${workerName}, ${r.year}, ${r.quarter}, ${periodLabel}, 'created',
    ${JSON.stringify(r)}
    )
    `;
    created++;
  }
}

return NextResponse.json({
  ok: true,
  documentId,
  blobUrl: blob.url,
  created,
  updated,
  duplicated,
  skipped,
});
}
