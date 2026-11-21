import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTransportTables } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureTransportTables();
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  const { rows } = search
    ? await sql`SELECT name FROM transport_oprs WHERE name ILIKE ${"%" + search + "%"} ORDER BY name LIMIT 20;`
    : await sql`SELECT name FROM transport_oprs ORDER BY name LIMIT 200;`;

  return NextResponse.json({ ok: true, oprs: rows });
}

import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  await ensureTransportTables();
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "El nombre es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    INSERT INTO transport_oprs (name)
    VALUES (${name})
    ON CONFLICT (name) DO NOTHING
    RETURNING *
  `;
  return NextResponse.json({ ok: true, opr: rows[0] });
}

export async function PATCH(request: NextRequest) {
  await ensureTransportTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE transport_oprs SET name = COALESCE(${body.name ?? null}, name)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "OPR no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, opr: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureTransportTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM transport_oprs WHERE id = ${id} RETURNING id, name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "OPR no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
