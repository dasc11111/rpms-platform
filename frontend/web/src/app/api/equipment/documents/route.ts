import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { query } from "@/lib/db";

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS equipment_documents (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_type      VARCHAR(50)  NOT NULL DEFAULT 'equipment',
      owner_id        UUID         NOT NULL,
      category        VARCHAR(100) NOT NULL DEFAULT 'general',
      original_name   TEXT         NOT NULL,
      blob_url        TEXT         NOT NULL,
      blob_pathname   TEXT         NOT NULL,
      size_bytes      BIGINT,
      mime_type       VARCHAR(255),
      uploaded_by     TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS equipment_documents_owner_idx
      ON equipment_documents (owner_type, owner_id)
  `);
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const formData = await req.formData();
    const ownerType = (formData.get("ownerType") as string) || "equipment";
    const ownerId   = formData.get("ownerId")   as string;
    const category  = (formData.get("category") as string) || "general";
    const uploadedBy = formData.get("uploadedBy") as string | null;

    if (!ownerId) {
      return NextResponse.json({ error: "ownerId is required" }, { status: 400 });
    }

    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const saved = [];
    for (const file of files) {
      const pathname = `equipment/${ownerType}/${ownerId}/${Date.now()}-${file.name}`;
      const blob = await put(pathname, file, { access: "private" });

      const result = await query(
        `INSERT INTO equipment_documents
           (owner_type, owner_id, category, original_name, blob_url, blob_pathname, size_bytes, mime_type, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          ownerType,
          ownerId,
          category,
          file.name,
          blob.url,
          blob.pathname,
          file.size,
          file.type || null,
          uploadedBy || null,
        ]
      );
      saved.push(result.rows[0]);
    }

    return NextResponse.json({ documents: saved }, { status: 201 });
  } catch (err) {
    console.error("Equipment documents POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("ownerType") || "equipment";
    const ownerId   = searchParams.get("ownerId");

    if (!ownerId) {
      return NextResponse.json({ error: "ownerId is required" }, { status: 400 });
    }

    const result = await query(
      `SELECT * FROM equipment_documents
       WHERE owner_type = $1 AND owner_id = $2
       ORDER BY created_at DESC`,
      [ownerType, ownerId]
    );

    return NextResponse.json({ documents: result.rows });
  } catch (err) {
    console.error("Equipment documents GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await query(
      `SELECT * FROM equipment_documents WHERE id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const doc = existing.rows[0];

    // Delete from Vercel Blob
    try {
      const { del } = await import("@vercel/blob");
      await del(doc.blob_url);
    } catch (blobErr) {
      console.warn("Blob delete failed (continuing):", blobErr);
    }

    await query(`DELETE FROM equipment_documents WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Equipment documents DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
