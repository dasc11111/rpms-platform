import { NextResponse } from "next/server";
import { searchDocumentsFullText } from "@/lib/pdf-text";

// Busqueda de texto completo en documentos PDF (solo lectura, no crea ni
// modifica documentos ni categorias). Ver src/lib/pdf-text.ts.
// Referencia: PROMPT MAESTRO CLAUDE CHROME - MEDICINA NUCLEAR, Seccion 37.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId") || 0);
  const q = (searchParams.get("q") || "").trim();

  if (!categoryId || !q) {
    return NextResponse.json({ matches: [], indexedNow: 0, pendingCount: 0, totalCandidates: 0 });
  }

  try {
    const result = await searchDocumentsFullText({ categoryId, query: q });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
