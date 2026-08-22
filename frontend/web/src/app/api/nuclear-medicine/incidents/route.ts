import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureNmIncidentsTables, logNmIncidentAudit } from "@/lib/nm-incidents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureNmIncidentsTables();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const historyOf = searchParams.get("historyOf");

  if (historyOf) {
    const { rows } = await sql`
      SELECT * FROM nm_incident_stage_history WHERE incident_id = ${historyOf} ORDER BY stage_date ASC, id ASC
    `;
    return NextResponse.json({ ok: true, history: rows });
  }

  if (status && category) {
    const { rows } = await sql`
      SELECT * FROM nm_incidents WHERE status = ${status} AND category = ${category} ORDER BY event_date DESC, id DESC
    `;
    return NextResponse.json({ ok: true, incidents: rows });
  }
  if (status) {
    const { rows } = await sql`
      SELECT * FROM nm_incidents WHERE status = ${status} ORDER BY event_date DESC, id DESC
    `;
    return NextResponse.json({ ok: true, incidents: rows });
  }
  if (category) {
    const { rows } = await sql`
      SELECT * FROM nm_incidents WHERE category = ${category} ORDER BY event_date DESC, id DESC
    `;
    return NextResponse.json({ ok: true, incidents: rows });
  }

  const { rows } = await sql`SELECT * FROM nm_incidents ORDER BY event_date DESC, id DESC`;
  return NextResponse.json({ ok: true, incidents: rows });
}

export async function POST(request: Request) {
  await ensureNmIncidentsTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;

  if (body.kind === "stage") {
    const { rows } = await sql`
      INSERT INTO nm_incident_stage_history (incident_id, stage, notes, responsible, stage_date)
      VALUES (${body.incidentId}, ${body.stage}, ${body.notes || null}, ${body.responsible || null}, ${body.stageDate || null})
      RETURNING id;
    `;
    await logNmIncidentAudit("create_nm_incident_stage", actorEmail, { incidentId: body.incidentId, stage: body.stage });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }

  if (!body.eventDate || !String(body.description || "").trim()) {
    return NextResponse.json({ ok: false, error: "Fecha del evento y descripcion son obligatorias." }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO nm_incidents (
      event_date, event_time, category, severity, is_near_miss, location, person_involved,
      description, immediate_actions, notification_status, notified_to, investigation_status,
      corrective_actions, responsible, documents_url, status
    )
    VALUES (
      ${body.eventDate}, ${body.eventTime || null}, ${body.category || "otro"}, ${body.severity || "leve"},
      ${!!body.isNearMiss}, ${body.location || null}, ${body.personInvolved || null},
      ${body.description.trim()}, ${body.immediateActions || null}, ${body.notificationStatus || "pendiente"},
      ${body.notifiedTo || null}, ${body.investigationStatus || "abierto"},
      ${body.correctiveActions || null}, ${body.responsible || null}, ${body.documentsUrl || null},
      ${body.status || "abierto"}
    )
    RETURNING id;
  `;

  await sql`
    INSERT INTO nm_incident_stage_history (incident_id, stage, notes, responsible)
    VALUES (${rows[0]!.id}, ${body.investigationStatus || "abierto"}, 'Registro inicial del incidente', ${body.responsible || null})
  `;

  await logNmIncidentAudit("create_nm_incident", actorEmail, { id: rows[0]!.id, category: body.category });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
