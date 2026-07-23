import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { STORAGE_MOVEMENT_TYPES } from "@/lib/waste";

export const dynamic = "force-dynamic";

// Historial de movimientos de inventario (ingreso, traslado, liberacion,
// ajuste). Se conserva siempre, incluso si el rotulo asociado cambia de
// estado despues, para no perder trazabilidad.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wasteLabelId = searchParams.get("waste_label_id");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? "100")));
  const offset = (page - 1) * pageSize;

  const where = wasteLabelId ? sql`WHERE m.waste_label_id = ${Number(wasteLabelId)}` : sql``;

  const { rows } = await sql`
    SELECT m.*, l.service, l.sala, l.radionuclide_code, l.status AS label_status
    FROM waste_inventory_movements m
    LEFT JOIN radioactive_waste_labels l ON l.id = m.waste_label_id
    ${where}
    ORDER BY m.moved_at DESC, m.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const { rows: countRows } = await sql`SELECT COUNT(*)::int AS count FROM waste_inventory_movements m ${where}`;

  return NextResponse.json({ rows, total: countRows[0]?.count ?? 0, page, pageSize });
}

// Registra un movimiento de inventario y actualiza automaticamente el estado
// y ubicacion del rotulo asociado. Reutiliza toda la informacion ya
// existente del rotulo (radionuclido, sala, servicio, etc.), sin solicitar
// nada nuevo salvo el propio movimiento.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const waste_label_id = Number(body.waste_label_id);
  const movement_type = String(body.movement_type ?? "");

  if (!waste_label_id) {
    return NextResponse.json({ error: "waste_label_id es obligatorio" }, { status: 400 });
  }
  if (!STORAGE_MOVEMENT_TYPES.includes(movement_type as (typeof STORAGE_MOVEMENT_TYPES)[number])) {
    return NextResponse.json({ error: "movement_type invalido" }, { status: 400 });
  }

  const { rows: labelRows } = await sql`SELECT * FROM radioactive_waste_labels WHERE id = ${waste_label_id}`;
  const label = labelRows[0];
  if (!label) {
    return NextResponse.json({ error: "No se encontró el rótulo indicado" }, { status: 404 });
  }

  const fromLocation = label.storage_location ?? null;
  let toLocation: string | null = fromLocation;
  let toLocationId: number | null = label.storage_location_id ?? null;

  if (movement_type === "ingreso" || movement_type === "traslado") {
    const locationId = Number(body.to_location_id);
    if (!locationId) {
      return NextResponse.json({ error: "to_location_id es obligatorio para ingreso/traslado" }, { status: 400 });
    }
    const { rows: locRows } = await sql`SELECT * FROM waste_storage_locations WHERE id = ${locationId}`;
    const location = locRows[0];
    if (!location) {
      return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });
    }
    toLocation = location.name;
    toLocationId = location.id;

    await sql`
      UPDATE radioactive_waste_labels
      SET storage_location_id = ${toLocationId}, storage_location = ${toLocation},
          status = CASE WHEN status = 'pendiente' THEN 'almacenado' ELSE status END,
          updated_at = now()
      WHERE id = ${waste_label_id}
    `;
  } else if (movement_type === "liberacion") {
    toLocation = null;
    toLocationId = null;
    await sql`
      UPDATE radioactive_waste_labels
      SET status = 'liberado', updated_at = now()
      WHERE id = ${waste_label_id}
    `;
    await sql`
      INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
      VALUES (${waste_label_id}, ${label.label_number}, 'liberado', ${body.moved_by ?? null}, ${JSON.stringify(label)})
    `;
  }

  const { rows } = await sql`
    INSERT INTO waste_inventory_movements (
      waste_label_id, label_number, movement_type, from_location, to_location, moved_by, observaciones
    ) VALUES (
      ${waste_label_id}, ${label.label_number}, ${movement_type}, ${fromLocation}, ${toLocation},
      ${body.moved_by ?? null}, ${body.observaciones ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json({ row: rows[0] }, { status: 201 });
}
