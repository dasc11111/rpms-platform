import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureNmIncidentsTables, logNmIncidentAudit } from "@/lib/nm-incidents";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureNmIncidentsTables();
  const { rows } = await sql`SELECT * FROM nm_incidents WHERE id = ${id}`;
  if (!rows[0]) {
    return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404 });
  }
  const { rows: history } = await sql`
    SELECT * FROM nm_incident_stage_history WHERE incident_id = ${id} ORDER BY stage_date ASC, id ASC
  `;
  return NextResponse.json({ ok: true, incident: rows[0], history });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureNmIncidentsTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;

  if (body.kind === "stage") {
    const { rows } = await sql`
      INSERT INTO nm_incident_stage_history (incident_id, stage, notes, responsible, stage_date)
      VALUES (${id}, ${body.stage}, ${body.notes || null}, ${body.responsible || null}, ${body.stageDate || null})
      RETURNING id;
    `;
    await sql`UPDATE nm_incidents SET investigation_status = ${body.stage}, updated_at = now() WHERE id = ${id}`;
    await logNmIncidentAudit("update_nm_incident_stage", actorEmail, { id, stage: body.stage });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }

  await sql`
    UPDATE nm_incidents SET
      status = COALESCE(${body.status || null}, status),
      notification_status = COALESCE(${body.notificationStatus || null}, notification_status),
      notified_to = COALESCE(${body.notifiedTo || null}, notified_to),
      investigation_status = COALESCE(${body.investigationStatus || null}, investigation_status),
      corrective_actions = COALESCE(${body.correctiveActions || null}, corrective_actions),
      responsible = COALESCE(${body.responsible || null}, responsible),
      documents_url = COALESCE(${body.documentsUrl || null}, documents_url),
      updated_at = now()
    WHERE id = ${id}
  `;
  await logNmIncidentAudit("update_nm_incident", actorEmail, { id, fields: Object.keys(body) });
  return NextResponse.json({ ok: true });
}
