import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { rows } = await sql`SELECT * FROM documents WHERE id = ${id}`;
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const blobRes = await fetch(doc.blob_url as string, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!blobRes.ok || !blobRes.body) {
    return NextResponse.json({ error: "blob_fetch_failed" }, { status: 502 });
  }

  const { searchParams } = new URL(request.url);
  const forceDownload = searchParams.get("dl") === "1";
  const disposition = forceDownload ? "attachment" : "inline";
  const filename = (doc.original_name as string) || "documento";
  const safeFilename = filename.replace(/["\\]/g, "_");

  const headers = new Headers();
  headers.set("Content-Type", (doc.mime_type as string) || "application/octet-stream");
  headers.set(
    "Content-Disposition",
    `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  if (doc.size_bytes) headers.set("Content-Length", String(doc.size_bytes));

  return new NextResponse(blobRes.body, { headers });
}
