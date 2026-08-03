import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const { rows } = await sql`
    SELECT * FROM linac_maintenance
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
    ORDER BY maintenance_date DESC, id DESC
    LIMIT 1000;
  `;
  return NextResponse.json({ ok: true, records: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  const form = await request.formData();
  const file = form.get("file");
  const linacId = Number(form.get("linacId"));
  const maintenanceType = String(form.get("maintenanceType") || "").trim();
  const maintenanceDate = String(form.get("maintenanceDate") || "").trim();
  const company = (form.get("company") as string) || null;
  const hours = (form.get("hours") as string) || null;
  const cost = (form.get("cost") as string) || null;
  const observations = (form.get("observations") as string) || null;
  const actorEmail = (form.get("actorEmail") as string) || null;
  if (!linacId || !maintenanceType || !maintenanceDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let blobUrl = null;
  let fileName = null;
  let mimeType = null;
  if (file instanceof File && file.size > 0) {
    const pathname = `linac/maintenance/${linacId}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    blobUrl = blob.url;
    fileName = file.name;
    mimeType = file.type || null;
  }

  const { rows } = await sql`
    INSERT INTO linac_maintenance (
      linac_id, maintenance_type, maintenance_date, company, hours, cost,
      observations, file_name, blob_url, mime_type
    ) VALUES (
      ${linacId}, ${maintenanceType}, ${maintenanceDate}, ${company}, ${hours}, ${cost},
      ${observations}, ${fileName}, ${blobUrl}, ${mimeType}
    )
    RETURNING id;
  `;

  await logLinacAudit("create_linac_maintenance", actorEmail, { linacId, maintenanceType, maintenanceDate });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
