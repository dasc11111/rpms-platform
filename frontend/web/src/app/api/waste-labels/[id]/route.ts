import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${Number(id)}`;
  const label = rows[0];
  if (!label) {
    return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
  }
  const { rows: history } = await sql`
    SELECT * FROM waste_label_history WHERE label_id = ${Number(id)} ORDER BY changed_at DESC
  `;
  const { rows: releaseRows } = await sql`
    SELECT * FROM room_release_records WHERE id = ${label.room_release_id}
  `;
  return NextResponse.json({ row: label, history, roomRelease: releaseRows[0] ?? null });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { rows: existingRows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${Number(id)}`;
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
  }

  const { rows } = await sql`
    UPDATE radioactive_waste_labels SET
      waste_type = ${body.waste_type ?? existing.waste_type},
      waste_classification = ${body.waste_classification ?? existing.waste_classification},
      container = ${body.container ?? existing.container},
      storage_location = ${body.storage_location ?? existing.storage_location},
      observations = ${body.observations ?? existing.observations},
      status = ${body.status ?? existing.status},
      updated_at = now()
    WHERE id = ${Number(id)}
    RETURNING *
  `;

  const updated = rows[0];
  if (!updated) {
    return NextResponse.json({ error: "No se pudo actualizar el rótulo" }, { status: 500 });
  }

  await sql`
    INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
    VALUES (${Number(id)}, ${updated.label_number}, 'updated', ${body.changed_by ?? null}, ${JSON.stringify(updated)})
  `;

  return NextResponse.json({ row: updated });
}
