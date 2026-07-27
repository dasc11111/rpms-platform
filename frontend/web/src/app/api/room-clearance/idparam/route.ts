import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRoomClearanceSchema } from "@/lib/room-clearance-db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureRoomClearanceSchema();
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const { rows: evalRows } = await sql`SELECT * FROM room_clearance_evaluations WHERE id = ${id}`;
  const evaluation = evalRows[0];
  if (!evaluation) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { rows: points } = await sql`
    SELECT * FROM room_clearance_points WHERE evaluation_id = ${id} ORDER BY area_tipo, id
  `;

  return NextResponse.json({ row: evaluation, points });
}
