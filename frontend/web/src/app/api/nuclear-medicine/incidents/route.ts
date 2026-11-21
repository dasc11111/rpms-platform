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

export async function PATCH(request: Request) {
  try {
    await ensureNmIncidentsTables();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const { id, actorEmail, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const actor = (actorEmail as string) || "sistema";
    const { rows } = await sql`
      UPDATE nm_incidents SET
        event_date              = COALESCE(${(fields.eventDate as string) ?? null}::date, event_date),
        event_time              = COALESCE(${(fields.eventTime as string) ?? null}, event_time),
        category                = COALESCE(${(fields.category as string) ?? null}, category),
        severity                = COALESCE(${(fields.severity as string) ?? null}, severity),
        is_near_miss            = COALESCE(${fields.isNearMiss != null ? Boolean(fields.isNearMiss) : null}, is_near_miss),
        location                = COALESCE(${(fields.location as string) ?? null}, location),
        person_involved         = COALESCE(${(fields.personInvolved as string) ?? null}, person_involved),
        description             = COALESCE(${(fields.description as string) ?? null}, description),
        immediate_actions       = COALESCE(${(fields.immediateActions as string) ?? null}, immediate_actions),
        notification_status     = COALESCE(${(fields.notificationStatus as string) ?? null}, notification_status),
        notified_to             = COALESCE(${(fields.notifiedTo as string) ?? null}, notified_to),
        investigation_status    = COALESCE(${(fields.investigationStatus as string) ?? null}, investigation_status),
        corrective_actions      = COALESCE(${(fields.correctiveActions as string) ?? null}, corrective_actions),
        responsible             = COALESCE(${(fields.responsible as string) ?? null}, responsible),
        status                  = COALESCE(${(fields.status as string) ?? null}, status),
        updated_at              = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ error: "Incidente no encontrado" }, { status: 404 });
    await logNmIncidentAudit("update_nm_incident", actor, { id });
    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureNmIncidentsTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const actorEmail = searchParams.get("actorEmail") || "sistema";
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`UPDATE nm_incidents SET status = 'cerrado', updated_at = NOW() WHERE id = ${Number(id)}`;
    await logNmIncidentAudit("close_nm_incident", actorEmail, { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
