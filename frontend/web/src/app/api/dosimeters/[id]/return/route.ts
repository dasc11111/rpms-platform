import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";

export const dynamic = "force-dynamic";

// Registra la devolucion (o cambio de estado terminal) de un dosimetro
// previamente asignado: devuelto, extraviado, en_laboratorio, danado o
// fuera_de_servicio. Cierra el historial de asignacion vigente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDosimeterTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const newStatus = body.newStatus || "devuelto";
  const actualReturnDate = body.actualReturnDate || new Date().toISOString().slice(0, 10);
  const observations = body.observations || null;
  const changedBy = body.changedBy || "Usuario RPMS";

  const allowedStatuses = ["devuelto", "extraviado", "en_laboratorio", "danado", "fuera_de_servicio"];
  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { rows: currentRows } = await sql`SELECT * FROM dosimeters WHERE id = ${id}`;
  const current = currentRows[0] as Record<string, unknown> | undefined;
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await sql`
    UPDATE dosimeter_assignments
    SET actual_return_date = ${actualReturnDate},
        status_at_close = ${newStatus},
        observations = COALESCE(${observations}, observations),
        closed_at = now()
    WHERE dosimeter_id = ${id} AND actual_return_date IS NULL
  `;

  const { rows: updatedRows } = await sql`
    UPDATE dosimeters
    SET status = ${newStatus},
        actual_return_date = ${actualReturnDate},
        observations = COALESCE(${observations}, observations),
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  await sql`
    INSERT INTO dosimeter_history (dosimeter_id, changed_by, field_name, old_value, new_value)
    VALUES (${id}, ${changedBy}, 'devolucion', ${String(current.status)}, ${newStatus})
  `;

  return NextResponse.json({ dosimeter: updatedRows[0] });
}
