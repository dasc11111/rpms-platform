import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

  const { rows } = await sql`
  SELECT id, filename, blob_url, mime_type, size_bytes, source_type, provider,
  period_label, year, uploaded_by, uploaded_at, used_ocr, records_count, status
  FROM dosimetry_documents
  ORDER BY uploaded_at DESC
  LIMIT 200
  `;

  const pdfCount = rows.filter((r: any) => r.source_type === "pdf").length;
    const excelCount = rows.filter((r: any) => r.source_type === "xlsx" || r.source_type === "csv").length;
    const recordsExtracted = rows.reduce((acc: number, r: any) => acc + (Number(r.records_count) || 0), 0);
    const pendingValidation = rows.filter((r: any) => r.status === "pending").length;

  return NextResponse.json({
    documents: rows,
    stats: {
      pdfCount,
      excelCount,
      recordsExtracted,
      pendingValidation,
      totalDocuments: rows.length,
    },
  });
  } catch {
    return NextResponse.json({
      documents: [],
      stats: { pdfCount: 0, excelCount: 0, recordsExtracted: 0, pendingValidation: 0, totalDocuments: 0 },
    });
  }
}
