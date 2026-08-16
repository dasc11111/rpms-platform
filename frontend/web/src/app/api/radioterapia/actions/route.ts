import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit, getActionAlertLevel } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const status = searchParams.get("status");
  const actionType = searchParams.get("actionType");

  const { rows } = facilityId
    ? await sql`SELECT * FROM rt_actions WHERE facility_id = ${facilityId} ORDER BY due_date ASC NULLS LAST, created_at DESC`
    : await sql`SELECT * FROM rt_actions ORDER BY due_date ASC NULLS LAST, created_at DESC`;

  let actions = rows.map((a: any) => ({
    ...a,
    alert: getActionAlertLevel(a.status, a.due_date),
  }));

  if (status) actions = actions.filter((a: any) => a.status === status);
  if (actionType) actions = actions.filter((a: any) => a.action_type === actionType);

  const openActions = actions.filter((a: any) => ["pendiente", "en_proceso", "atrasada"].includes(a.status));
  const summary = {
    total: actions.length,
    abiertas: openActions.length,
    vencidas: openActions.filter((a: any) => a.alert.level === "vencida").length,
    proximasA7: openActions.filter((a: any) => a.alert.level === "rojo").length,
    proximasA15: openActions.filter((a: any) => a.alert.level === "naranjo").length,
    proximasA30: openActions.filter((a: any) => a.alert.level === "amarillo").length,
    completadas: actions.filter((a: any) => a.status === "completada").length,
    noResueltas: actions.filter((a: any) => a.status === "no_resuelta").length,
  };

  return NextResponse.json({ ok: true, actions, summary });
}

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO rt_actions (
      facility_id, action_type, origin, origin_ref, description, cause, action,
      responsible, priority, status, due_date, evidence_url
    )
    VALUES (
      ${body.facilityId}, ${body.actionType || "correctiva"}, ${body.origin || "manual"}, ${body.originRef || null},
      ${body.description || null}, ${body.cause || null}, ${body.action || null},
      ${body.responsible || null}, ${body.priority || "media"}, ${body.status || "pendiente"},
      ${body.dueDate || null}, ${body.evidenceUrl || null}
    )
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_action", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId, origin: body.origin });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}

export async function PATCH(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const existingRes = await sql`SELECT * FROM rt_actions WHERE id = ${body.id}`;
  const existing = existingRes.rows[0];
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const nextStatus = body.status ?? existing.status;
  const nextClosedDate =
    body.closedDate !== undefined
      ? body.closedDate
      : nextStatus === "completada" || nextStatus === "no_resuelta" || nextStatus === "cancelada"
        ? existing.closed_date || new Date().toISOString().slice(0, 10)
        : existing.closed_date;

  await sql`
    UPDATE rt_actions SET
      status = ${nextStatus},
      description = ${body.description ?? existing.description},
      cause = ${body.cause ?? existing.cause},
      action = ${body.action ?? existing.action},
      responsible = ${body.responsible ?? existing.responsible},
      priority = ${body.priority ?? existing.priority},
      due_date = ${body.dueDate ?? existing.due_date},
      evidence_url = ${body.evidenceUrl ?? existing.evidence_url},
      effectiveness_verification = ${body.effectivenessVerification ?? existing.effectiveness_verification},
      closed_date = ${nextClosedDate},
      updated_at = now()
    WHERE id = ${body.id}
  `;
  await logRadioterapiaAudit("update_rt_action", actorEmail, {
    id: body.id,
    fromStatus: existing.status,
    toStatus: nextStatus,
  });
  return NextResponse.json({ ok: true });
}
