import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
await ensureRadioterapiaTables();
const { searchParams } = new URL(request.url);
const facilityId = searchParams.get("facilityId");
const historyOf = searchParams.get("historyOf");
if (historyOf) {
const { rows } = await sql`SELECT * FROM rt_incident_stage_history WHERE incident_id = ${historyOf} ORDER BY stage_date ASC, id ASC`;
return NextResponse.json({ ok: true, history: rows });
}
const { rows } = await sql`SELECT * FROM rt_incidents WHERE facility_id = ${facilityId} ORDER BY incident_date DESC`;
return NextResponse.json({ ok: true, incidents: rows });
}

export async function POST(request: Request) {
await ensureRadioterapiaTables();
const body = await request.json();
const actorEmail = body.actorEmail || null;

if (body.kind === "stage") {
const { rows } = await sql`
INSERT INTO rt_incident_stage_history (incident_id, stage, notes, responsible, stage_date)
VALUES (${body.incidentId}, ${body.stage}, ${body.notes || null}, ${body.responsible || null}, ${body.stageDate || null})
RETURNING id;
`;
await sql`UPDATE rt_incidents SET investigation_stage = ${body.stage}, updated_at = now() WHERE id = ${body.incidentId}`;
await logRadioterapiaAudit("create_rt_incident_stage", actorEmail, { incidentId: body.incidentId, stage: body.stage });
return NextResponse.json({ ok: true, id: rows[0]!.id });
}

const { rows } = await sql`
INSERT INTO rt_incidents (
facility_id, linac_id, is_near_miss, event, incident_date, incident_time, description, severity,
category, cause, person_involved, estimated_dose, impact, corrective_actions, immediate_actions,
responsible, documents_url, status, investigation_stage, root_cause_method, root_cause_data
)
VALUES (
${body.facilityId}, ${body.linacId || null}, ${!!body.isNearMiss}, ${body.event || null}, ${body.incidentDate || null}, ${body.incidentTime || null}, ${body.description || null}, ${body.severity || "menor"},
${body.category || "otro"}, ${body.cause || null}, ${body.personInvolved || null}, ${body.estimatedDose || null}, ${body.impact || null}, ${body.correctiveActions || null}, ${body.immediateActions || null},
${body.responsible || null}, ${body.documentsUrl || null}, ${body.status || "abierto"}, ${body.investigationStage || "registrado"}, ${body.rootCauseMethod || null}, ${body.rootCauseData ? JSON.stringify(body.rootCauseData) : null}
)
RETURNING id;
`;
await sql`
INSERT INTO rt_incident_stage_history (incident_id, stage, notes, responsible)
VALUES (${rows[0]!.id}, ${body.investigationStage || "registrado"}, 'Registro inicial del incidente', ${body.responsible || null})
`;
await logRadioterapiaAudit("create_rt_incident", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId });
return NextResponse.json({ ok: true, id: rows[0]!.id });
}

export async function PATCH(request: Request) {
await ensureRadioterapiaTables();
const body = await request.json();
const actorEmail = body.actorEmail || null;

if (body.field === "root_cause") {
await sql`
UPDATE rt_incidents
SET root_cause_method = ${body.rootCauseMethod || null}, root_cause_data = ${body.rootCauseData ? JSON.stringify(body.rootCauseData) : null}, updated_at = now()
WHERE id = ${body.id}
`;
await logRadioterapiaAudit("update_rt_incident_root_cause", actorEmail, { id: body.id, rootCauseMethod: body.rootCauseMethod });
return NextResponse.json({ ok: true });
}

await sql`UPDATE rt_incidents SET status = ${body.status}, updated_at = now() WHERE id = ${body.id}`;
await logRadioterapiaAudit("update_rt_incident_status", actorEmail, { id: body.id, status: body.status });
return NextResponse.json({ ok: true });
}
