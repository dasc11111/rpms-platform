import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const { rows } = await sql`SELECT * FROM rt_incidents WHERE facility_id = ${facilityId} ORDER BY incident_date DESC`;
  return NextResponse.json({ ok: true, incidents: rows });
}

export async function POST(request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO rt_incidents (facility_id, linac_id, is_near_miss, event, incident_date, description, severity, cause, corrective_actions, status)
    VALUES (${body.facilityId}, ${body.linacId || null}, ${!!body.isNearMiss}, ${body.event || null}, ${body.incidentDate || null}, ${body.description || null}, ${body.severity || "menor"}, ${body.cause || null}, ${body.correctiveActions || null}, ${body.status || "abierto"})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_incident", actorEmail, { id: rows[0].id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function PATCH(request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  await sql`UPDATE rt_incidents SET status = ${body.status}, updated_at = now() WHERE id = ${body.id}`;
  await logRadioterapiaAudit("update_rt_incident_status", actorEmail, { id: body.id, status: body.status });
  return NextResponse.json({ ok: true });
}
