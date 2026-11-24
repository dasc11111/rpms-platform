import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const { rows } = await sql`
    SELECT original_name, blob_url, mime_type FROM module_pdfs WHERE id = ${id}
  `;
  if (!rows[0]) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const doc = rows[0] as { original_name: string; blob_url: string; mime_type: string };
  const download = new URL(request.url).searchParams.has("dl");

  // Proxy the blob URL so it stays private
  const blobRes = await fetch(doc.blob_url);
  if (!blobRes.ok) return NextResponse.json({ error: "Error al obtener el archivo." }, { status: 502 });

  const headers: Record<string, string> = {
    "Content-Type": doc.mime_type || "application/pdf",
    "Cache-Control": "private, max-age=60",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(doc.original_name)}"`;
  } else {
    headers["Content-Disposition"] = `inline; filename="${encodeURIComponent(doc.original_name)}"`;
  }

  return new NextResponse(blobRes.body, { headers });
}
