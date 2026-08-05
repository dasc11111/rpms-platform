import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureRadioterapiaTables();
  const { rows } = await sql`SELECT * FROM rt_facilities WHERE status != 'eliminado' ORDER BY id ASC`;
  return NextResponse.json({ ok: true, facilities: rows });
}

export async function POST(request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO rt_facilities (name, address, responsible_qa, description)
    VALUES (${body.name || null}, ${body.address || null}, ${body.responsibleQa || null}, ${body.description || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_facility", actorEmail, { id: rows[0].id, name: body.name });
  return NextResponse.json({ ok: true, id: rows[0].id });
}
