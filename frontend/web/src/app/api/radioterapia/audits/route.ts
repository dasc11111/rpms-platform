import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, ensureAuditExtensionsTables, logRadioterapiaAudit, RT_DEFAULT_CHECKLIST_ITEMS } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  await ensureAuditExtensionsTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const auditId = searchParams.get("auditId");
  const kind = searchParams.get("kind");

  if (auditId && kind === "findings") {
    const { rows } = await sql`SELECT * FROM rt_audit_findings WHERE audit_id = ${auditId} ORDER BY created_at DESC`;
    return NextResponse.json({ ok: true, findings: rows });
  }

  if (auditId && kind === "checklist") {
    const { rows } = await sql`SELECT * FROM rt_audit_checklist_responses WHERE audit_id = ${auditId} ORDER BY id ASC`;
    return NextResponse.json({ ok: true, checklist: rows });
  }

  if (kind === "checklist_template") {
    const auditType = searchParams.get("auditType") || "interna";
    const { rows } = await sql`SELECT * FROM rt_audit_checklist_templates WHERE facility_id = ${facilityId} AND audit_type = ${auditType} AND active = true ORDER BY order_index ASC, id ASC`;
    return NextResponse.json({ ok: true, templates: rows, defaults: RT_DEFAULT_CHECKLIST_ITEMS[auditType] || [] });
  }

  const { rows } = await sql`SELECT * FROM rt_audits WHERE facility_id = ${facilityId} ORDER BY audit_date DESC`;
  return NextResponse.json({ ok: true, audits: rows });
}

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  await ensureAuditExtensionsTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;

  if (body.kind === "checklist_item_template") {
    const { rows } = await sql`
      INSERT INTO rt_audit_checklist_templates (facility_id, audit_type, item_text, category, order_index)
      VALUES (${body.facilityId}, ${body.auditType}, ${body.itemText}, ${body.category || null}, ${body.orderIndex || 0})
      RETURNING id;
    `;
    await logRadioterapiaAudit("create_rt_audit_checklist_template", actorEmail, { id: rows[0]!.id });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }

  if (body.kind === "checklist_response") {
    const { rows } = await sql`
      INSERT INTO rt_audit_checklist_responses (audit_id, item_text, category, response, notes)
      VALUES (${body.auditId}, ${body.itemText}, ${body.category || null}, ${body.response || "no_aplica"}, ${body.notes || null})
      RETURNING id;
    `;
    await logRadioterapiaAudit("create_rt_audit_checklist_response", actorEmail, { id: rows[0]!.id, auditId: body.auditId });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }

  if (body.kind === "finding") {
    const { rows } = await sql`
      INSERT INTO rt_audit_findings (audit_id, description, classification, requirement_ref, evidence_url, responsible, due_date, status)
      VALUES (${body.auditId}, ${body.description}, ${body.classification || "observacion"}, ${body.requirementRef || null}, ${body.evidenceUrl || null}, ${body.responsible || null}, ${body.dueDate || null}, ${body.status || "abierto"})
      RETURNING id;
    `;
    await logRadioterapiaAudit("create_rt_audit_finding", actorEmail, { id: rows[0]!.id, auditId: body.auditId });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }

  const { rows } = await sql`
    INSERT INTO rt_audits (facility_id, audit_type, audit_date, findings, nonconformities, actions, status, title, scope, lead_auditor, participants, next_audit_date)
    VALUES (${body.facilityId}, ${body.auditType || null}, ${body.auditDate || null}, ${body.findings || null}, ${body.nonconformities || null}, ${body.actions || null}, ${body.status || "abierta"}, ${body.title || null}, ${body.scope || null}, ${body.leadAuditor || null}, ${body.participants || null}, ${body.nextAuditDate || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_audit", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}

export async function PATCH(request: Request) {
  await ensureRadioterapiaTables();
  await ensureAuditExtensionsTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;

  if (body.field === "finding_status") {
    await sql`
      UPDATE rt_audit_findings
      SET status = ${body.status}, closed_date = ${body.status === "cerrado" ? new Date().toISOString().slice(0, 10) : null}
      WHERE id = ${body.id};
    `;
    await logRadioterapiaAudit("update_rt_audit_finding_status", actorEmail, { id: body.id, status: body.status });
    return NextResponse.json({ ok: true });
  }

  if (body.field === "report_generated") {
    await sql`UPDATE rt_audits SET report_generated_at = now() WHERE id = ${body.id};`;
    return NextResponse.json({ ok: true });
  }

  await sql`
    UPDATE rt_audits
    SET status = ${body.status}, closed_date = ${body.status === "cerrada" ? new Date().toISOString().slice(0, 10) : null}
    WHERE id = ${body.id};
  `;
  await logRadioterapiaAudit("update_rt_audit_status", actorEmail, { id: body.id, status: body.status });
  return NextResponse.json({ ok: true });
}
