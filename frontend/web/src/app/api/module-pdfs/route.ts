import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS module_pdfs (
      id            SERIAL PRIMARY KEY,
      module        VARCHAR(60)  NOT NULL,
      owner_type    VARCHAR(60)  NOT NULL DEFAULT 'module',
      owner_id      VARCHAR(120),
      original_name TEXT         NOT NULL,
      blob_url      TEXT         NOT NULL,
      blob_pathname TEXT         NOT NULL,
      size_bytes    BIGINT,
      mime_type     VARCHAR(80),
      description   TEXT,
      uploaded_by   VARCHAR(120) NOT NULL DEFAULT 'Usuario RPMS',
      uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_module_pdfs_lookup ON module_pdfs (module, owner_type, owner_id)`;
}

/* POST /api/module-pdfs
   FormData fields:
     module      (required) — e.g. "workers", "dosimetry", "equipment"
     ownerType   (optional) — "module" (page-level) or any entity type, e.g. "worker"
     ownerId     (optional) — string id of the entity row
     description (optional) — freetext label
     uploadedBy  (optional) — user display name
     files       (required, can repeat) — the PDF files
*/
export async function POST(request: Request) {
  try {
    await ensureTable();
    const form = await request.formData();
    const module = String(form.get("module") || "").trim();
    const ownerType = String(form.get("ownerType") || "module").trim();
    const ownerId = String(form.get("ownerId") || "").trim() || null;
    const description = String(form.get("description") || "").trim() || null;
    const uploadedBy = String(form.get("uploadedBy") || "Usuario RPMS").trim();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (!module) return NextResponse.json({ error: "El campo 'module' es obligatorio." }, { status: 400 });
    if (files.length === 0) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });

    const uploaded: Record<string, unknown>[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const pathname = `module-pdfs/${module}/${ownerType}/${ownerId ?? "general"}/${Date.now()}-${safeName}`;
      const blob = await put(pathname, file, { access: "private" });
      const { rows } = await sql`
        INSERT INTO module_pdfs
          (module, owner_type, owner_id, original_name, blob_url, blob_pathname, size_bytes, mime_type, description, uploaded_by)
        VALUES
          (${module}, ${ownerType}, ${ownerId}, ${file.name}, ${blob.url}, ${blob.pathname}, ${file.size}, ${file.type || "application/pdf"}, ${description}, ${uploadedBy})
        RETURNING *
      `;
      uploaded.push(rows[0] as Record<string, unknown>);
    }

    return NextResponse.json({ ok: true, documents: uploaded });
  } catch (err) {
    console.error("[module-pdfs POST]", err);
    return NextResponse.json({ error: "Error al subir el archivo." }, { status: 500 });
  }
}

/* GET /api/module-pdfs?module=workers&ownerType=module&ownerId= */
export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const module = String(searchParams.get("module") || "").trim();
    const ownerType = String(searchParams.get("ownerType") || "module").trim();
    const ownerId = searchParams.get("ownerId") ?? null;

    if (!module) return NextResponse.json({ error: "El campo 'module' es obligatorio." }, { status: 400 });

    let rows: Record<string, unknown>[];
    if (ownerId) {
      ({ rows } = await sql`
        SELECT id, module, owner_type, owner_id, original_name, blob_url, size_bytes, mime_type, description, uploaded_by, uploaded_at
        FROM module_pdfs
        WHERE module = ${module} AND owner_type = ${ownerType} AND owner_id = ${ownerId}
        ORDER BY uploaded_at DESC
      `);
    } else {
      ({ rows } = await sql`
        SELECT id, module, owner_type, owner_id, original_name, blob_url, size_bytes, mime_type, description, uploaded_by, uploaded_at
        FROM module_pdfs
        WHERE module = ${module} AND owner_type = ${ownerType}
        ORDER BY uploaded_at DESC
      `);
    }

    return NextResponse.json({ ok: true, documents: rows });
  } catch (err) {
    console.error("[module-pdfs GET]", err);
    return NextResponse.json({ error: "Error al obtener documentos." }, { status: 500 });
  }
}

/* DELETE /api/module-pdfs?id=123 */
export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "El parámetro 'id' es obligatorio." }, { status: 400 });

    const { rows } = await sql`SELECT id, blob_url FROM module_pdfs WHERE id = ${id}`;
    if (!rows[0]) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

    if ((rows[0] as { blob_url: string }).blob_url) {
      try { await del((rows[0] as { blob_url: string }).blob_url); } catch { /* blob may not exist */ }
    }
    await sql`DELETE FROM module_pdfs WHERE id = ${id}`;
    return NextResponse.json({ ok: true, deleted: { id } });
  } catch (err) {
    console.error("[module-pdfs DELETE]", err);
    return NextResponse.json({ error: "Error al eliminar el documento." }, { status: 500 });
  }
}
