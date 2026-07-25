import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parseDosimetryText } from "@/lib/dosimetry-parse";

export const dynamic = "force-dynamic";

function rutBody(v: unknown): string {
  const s = String(v ?? "").toUpperCase().trim();
  const beforeDash = s.split("-")[0] ?? s;
  return beforeDash.replace(/[^0-9]/g, "");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawText = String(body?.rawText ?? "");
  const fileName = String(body?.fileName ?? "");
  const fileHash = String(body?.fileHash ?? "");
  const usedOcr = Boolean(body?.usedOcr);

const parsed = parseDosimetryText(rawText);

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

let duplicateFile = false;
  if (fileHash) {
    const { rows: existingDocs } = await sql`
    SELECT id, filename, uploaded_at FROM dosimetry_documents WHERE file_hash = ${fileHash} LIMIT 1
    `;
    duplicateFile = existingDocs.length > 0;
  }

const { rows: workers } = await sql`SELECT rut, name FROM workers`;
  const rutMap = new Map<string, { rut: string; name: string }>();
  for (const w of workers as any[]) {
    const key = rutBody(w.rut);
    if (key) rutMap.set(key, w as any);
  }

const existingKeys = new Set<string>();
  if (parsed.rows.length > 0) {
    const { rows: existingQ } = await sql`SELECT worker_rut, year, quarter FROM dosimetry_quarterly`;
    for (const r of existingQ as any[]) {
      existingKeys.add(`${r.worker_rut}__${r.year}__${r.quarter}`);
    }
  }

const enrichedRows = parsed.rows.map((r, idx) => {
  const key0 = rutBody(r.worker_run);
  const worker = rutMap.get(key0);
  const matched = Boolean(worker);
  const workerRut = worker ? worker.rut : "";
  const conflict = matched && r.year && r.quarter ? existingKeys.has(`${workerRut}__${r.year}__${r.quarter}`) : false;
  return {
    rowIndex: idx,
    ...r,
    worker_rut: workerRut,
    worker_matched: matched,
    worker_name_report: r.worker_name,
    worker_name_system: worker ? worker.name : "",
    conflict,
    resolution: conflict ? "actualizar" : "nuevo",
  };
});

const newRecords = enrichedRows.filter((r) => r.worker_matched && !r.conflict).length;
  const existingRecords = enrichedRows.filter((r) => r.conflict).length;
  const unmatchedRecords = enrichedRows.filter((r) => !r.worker_matched).length;

return NextResponse.json({
  ok: true,
  fileName,
  fileHash,
  usedOcr,
  duplicateFile,
  workersDetected: parsed.workersDetected,
  recordsFound: enrichedRows.length,
  periodsIdentified: parsed.periodsIdentified,
  quartersIdentified: parsed.quartersIdentified,
  errors: parsed.errors,
  warnings: [
    ...parsed.warnings,
    ...(unmatchedRecords > 0 ? [`${unmatchedRecords} registro(s) no coinciden con ningun RUN del listado de trabajadores.`] : []),
    ],
  newRecords,
  existingRecords,
  rows: enrichedRows,
});
}
