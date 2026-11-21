import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { NextRequest } from "next/server";

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

  const pdfCount = rows.filter((r: Record<string, unknown>) => r.source_type === "pdf").length;
    const excelCount = rows.filter((r: Record<string, unknown>) => r.source_type === "xlsx" || r.source_type === "csv").length;
    const recordsExtracted = rows.reduce((acc: number, r: Record<string, unknown>) => acc + (Number(r.records_count) || 0), 0);
    const pendingValidation = rows.filter((r: Record<string, unknown>) => r.status === "pending").length;

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


export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  try {
    const { rows } = await sql`SELECT id, blob_url FROM dosimetry_documents WHERE id = ${id}`;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    if (rows[0].blob_url) {
      try { await del(rows[0].blob_url); } catch { /* blob may already be gone */ }
    }
    await sql`DELETE FROM dosimetry_documents WHERE id = ${id}`;
    return NextResponse.json({ ok: true, deleted: { id } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
