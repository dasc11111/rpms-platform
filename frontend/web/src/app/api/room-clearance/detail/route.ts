import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRoomClearanceSchema } from "@/lib/room-clearance-db";

// Detalle de una evaluacion de Liberacion de Sala (encabezado + puntos).
// Se implementa como /api/room-clearance/detail?id=123 (en vez de una ruta
// dinamica /room-clearance/[id]) para evitar problemas del editor web de
// GitHub con nombres de carpeta que contienen corchetes.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureRoomClearanceSchema();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const { rows: evalRows } = await sql`SELECT * FROM room_clearance_evaluations WHERE id = ${id}`;
  const evaluation = evalRows[0];
  if (!evaluation) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { rows: points } = await sql`
    SELECT * FROM room_clearance_points WHERE evaluation_id = ${id} ORDER BY area_tipo, id
  `;

  return NextResponse.json({ row: evaluation, points });
}
