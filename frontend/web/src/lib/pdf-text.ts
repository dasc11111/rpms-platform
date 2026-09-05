// Extraccion y busqueda de texto completo en documentos PDF.
//
// Reutiliza pdfjs-dist (ya incluido como dependencia de la plataforma para
// el analisis de documentos LINAC), en vez de agregar una libreria de
// parsing de PDF duplicada. El texto extraido se cachea por documento
// (columna extracted_pages de la tabla "documents") para no volver a
// descargar y re-parsear el mismo PDF en cada busqueda.
//
// Referencia: PROMPT MAESTRO CLAUDE CHROME - MEDICINA NUCLEAR, Seccion 37
// (Documentos y Normativa: busqueda de texto completo en PDF por
// palabra/frase, mostrando documento / coincidencias / contexto / pagina).

import { sql } from "@/lib/db";

let columnsEnsured = false;
export async function ensureDocumentTextColumns(): Promise<void> {
  if (columnsEnsured) return;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_pages JSONB`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_extracted_at TIMESTAMPTZ`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_extraction_error TEXT`;
  columnsEnsured = true;
}

type PdfTextItem = { str?: string };

export async function extractPdfPagesText(data: Uint8Array): Promise<string[]> {
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false, disableWorker: true } as any).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as PdfTextItem[])
      .map((it) => (it && typeof it.str === "string" ? it.str : ""))
      .join(" ");
    pages.push(text.replace(/\s+/g, " ").trim());
  }
  await doc.destroy();
  return pages;
}

export async function fetchBlobBuffer(blobUrl: string): Promise<Uint8Array> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const res = await fetch(blobUrl, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`blob_fetch_failed_${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export type DocSearchMatch = {
  documentId: number;
  documentName: string;
  page: number;
  snippet: string;
};

const MAX_DOCS_TO_INDEX_PER_CALL = 3;
const SNIPPET_RADIUS = 90;

function buildSnippet(text: string, idx: number, termLen: number): string {
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + termLen + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export async function searchDocumentsFullText(params: {
  categoryId: number;
  query: string;
}): Promise<{
  matches: DocSearchMatch[];
  indexedNow: number;
  pendingCount: number;
  totalCandidates: number;
  lastError?: string;
}> {
  await ensureDocumentTextColumns();
  const { categoryId, query } = params;
  const term = query.trim().toLowerCase();
  if (!term) return { matches: [], indexedNow: 0, pendingCount: 0, totalCandidates: 0 };

  const { rows } = await sql`
    SELECT id, original_name, blob_url, mime_type, extracted_pages
    FROM documents
    WHERE category_id = ${categoryId} AND mime_type = 'application/pdf'
    ORDER BY original_name ASC
    LIMIT 500
  `;

  const matches: DocSearchMatch[] = [];
  let indexedNow = 0;
  let attempts = 0;
  let pendingCount = 0;
  let lastError: string | undefined;

  for (const row of rows) {
    let pages: string[] | null = Array.isArray(row.extracted_pages) ? (row.extracted_pages as string[]) : null;

    if (!pages) {
      if (attempts >= MAX_DOCS_TO_INDEX_PER_CALL) {
        pendingCount++;
        continue;
      }
      attempts++;
      try {
        const buffer = await fetchBlobBuffer(row.blob_url as string);
        pages = await extractPdfPagesText(buffer);
        await sql`
          UPDATE documents SET extracted_pages = ${JSON.stringify(pages)}::jsonb, text_extracted_at = now(), text_extraction_error = NULL
          WHERE id = ${row.id}
        `;
        indexedNow++;
      } catch (err) {
        lastError = `${row.original_name}: ${String(err instanceof Error ? err.message : err)}`;
        await sql`
          UPDATE documents SET text_extraction_error = ${lastError}, text_extracted_at = now()
          WHERE id = ${row.id}
        `;
        continue;
      }
    }

    pages.forEach((pageText, pageIdx) => {
      const lower = pageText.toLowerCase();
      const foundIdx = lower.indexOf(term);
      if (foundIdx !== -1) {
        matches.push({
          documentId: row.id as number,
          documentName: row.original_name as string,
          page: pageIdx + 1,
          snippet: buildSnippet(pageText, foundIdx, term.length),
        });
      }
    });
  }

  return { matches, indexedNow, pendingCount, totalCandidates: rows.length, lastError };
}
