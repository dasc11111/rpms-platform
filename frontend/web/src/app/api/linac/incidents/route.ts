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
    SELECT * FROM linac_incidents
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
    ORDER BY incident_date DESC, id DESC
    LIMIT 1000;
  `;
  return NextResponse.json({ ok: true, incidents: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  const form = await request.formData();
  const file = form.get("file");
  const linacId = Number(form.get("linacId"));
  const event = String(form.get("event") || "").trim();
  const incidentDate = String(form.get("incidentDate") || "").trim();
  const incidentTime = form.get("incidentTime") || null;
  const description = form.get("description") || null;
  const cause = form.get("cause") || null;
  const consequence = form.get("consequence") || null;
  const dose = form.get("dose") || null;
  const inesLevel = form.get("inesLevel") || null;
  const investigation = form.get("investigation") || null;
  const correctiveActions = form.get("correctiveActions") || null;
  const actorEmail = form.get("actorEmail") || null;
  if (!linacId || !event || !incidentDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let blobUrl = null;
  let fileName = null;
  let mimeType = null;
  if (file instanceof File && file.size > 0) {
    const pathname = `linac/incidents/${linacId}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    blobUrl = blob.url;
    fileName = file.name;
    mimeType = file.type || null;
  }

  const { rows } = await sql`
    INSERT INTO linac_incidents (
      linac_id, event, incident_date, incident_time, description, cause, consequence,
      dose, ines_level, investigation, corrective_actions, status, file_name, blob_url, mime_type
    ) VALUES (
      ${linacId}, ${event}, ${incidentDate}, ${incidentTime}, ${description}, ${cause}, ${consequence},
      ${dose}, ${inesLevel}, ${investigation}, ${correctiveActions}, 'abierto', ${fileName}, ${blobUrl}, ${mimeType}
    )
    RETURNING id;
  `;

  await logLinacAudit("create_linac_incident", actorEmail, { linacId, event, incidentDate });
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function PATCH(request: Request) {
  await ensureLinacTables();
  const body = await request.json();
  const id = Number(body.id);
  const status = String(body.status || "").trim();
  const actorEmail = body.actorEmail || null;
  if (!id || !status) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  await sql`UPDATE linac_incidents SET status = ${status} WHERE id = ${id}`;
  await logLinacAudit("update_linac_incident_status", actorEmail, { id, status });
  return NextResponse.json({ ok: true });
}
