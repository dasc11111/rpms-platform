import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const { rows } = await sql`SELECT * FROM rt_audits WHERE facility_id = ${facilityId} ORDER BY audit_date DESC`;
  return NextResponse.json({ ok: true, audits: rows });
}

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO rt_audits (facility_id, audit_type, audit_date, findings, nonconformities, actions, status)
    VALUES (${body.facilityId}, ${body.auditType || null}, ${body.auditDate || null}, ${body.findings || null}, ${body.nonconformities || null}, ${body.actions || null}, ${body.status || "abierta"})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_audit", actorEmail, { id: rows[0].id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0].id });
}
