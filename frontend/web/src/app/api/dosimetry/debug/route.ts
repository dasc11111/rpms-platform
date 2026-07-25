import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type PdfItem = { str: string; x: number; y: number };

function buildPageText(items: PdfItem[]): string {
  const cleaned = items.filter((it) => it.str && it.str.trim().length > 0);
  const sorted = [...cleaned].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs((l[0]?.y ?? 0) - it.y) < 3);
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines
    .map((l) => l.sort((a, b) => a.x - b.x).map((it) => it.str).join(" "))
    .join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = Number(searchParams.get("docId") || "1");
  const pageArg = Number(searchParams.get("page") || "1");

  const { rows } = await sql`SELECT blob_url FROM dosimetry_documents WHERE id = ${docId}`;
  const blobUrl = rows[0]?.blob_url as string | undefined;
  if (!blobUrl) return NextResponse.json({ error: "no_document" }, { status: 404 });

  let resp = await fetch(blobUrl);
  if (!resp.ok) {
    resp = await fetch(blobUrl, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN || ""}` } });
  }
  if (!resp.ok) {
    return NextResponse.json({ error: "fetch_failed", status: resp.status, blobUrl }, { status: 502 });
  }
  const buf = await resp.arrayBuffer();

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf), disableWorker: true } as any);
  const pdf = await loadingTask.promise;

  const numPages = pdf.numPages;
  const pageNum = Math.min(Math.max(1, pageArg), numPages);
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const items: PdfItem[] = (content.items as any[])
    .map((it) => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number }))
    .filter((it) => it.str.trim().length > 0);
  const pageText = buildPageText(items);

  return NextResponse.json({
    numPages,
    pageNum,
    byteLength: buf.byteLength,
    itemCount: items.length,
    pageText,
    rawItemsSample: items.slice(0, 40),
  });
}
