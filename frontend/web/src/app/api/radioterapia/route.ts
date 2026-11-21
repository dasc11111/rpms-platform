import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureRadioterapiaTables();
  const { rows } = await sql`SELECT * FROM rt_facilities WHERE status != 'eliminado' ORDER BY id ASC`;
  return NextResponse.json({ ok: true, facilities: rows });
}

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO rt_facilities (name, address, responsible_qa, description)
    VALUES (${body.name || null}, ${body.address || null}, ${body.responsibleQa || null}, ${body.description || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_facility", actorEmail, { id: rows[0]!.id, name: body.name });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}


export async function PATCH(request: NextRequest) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE rt_facilities SET
      name = COALESCE(${body.name ?? null}, name),
      address = COALESCE(${body.address ?? null}, address),
      responsible_qa = COALESCE(${body.responsibleQa ?? null}, responsible_qa),
      description = COALESCE(${body.description ?? null}, description)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Instalación no encontrada." }, { status: 404 });
  await logRadioterapiaAudit("update_rt_facility", body.actorEmail || null, { id });
  return NextResponse.json({ ok: true, facility: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`UPDATE rt_facilities SET status = 'eliminado' WHERE id = ${id} RETURNING id, name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Instalación no encontrada." }, { status: 404 });
  await logRadioterapiaAudit("delete_rt_facility", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
