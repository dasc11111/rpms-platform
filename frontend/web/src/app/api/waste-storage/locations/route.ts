import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteStorageInitialLocations } from "@/lib/waste";

export const dynamic = "force-dynamic";

// Catalogo de ubicaciones de almacenamiento temporal (parametrizable): permite
// agregar nuevas salas, estantes o contenedores sin modificar el codigo.
//
// Correccion: por defecto solo se listan las ubicaciones ACTIVAS (inicialmente
// "Contenedor de basura" y "Contenedor de ropa de cama"), para que el
// desplegable de Ubicacion de almacenamiento muestre unicamente esas dos
// opciones. Las ubicaciones previas se desactivan (no se eliminan, preservando
// el historial) y siguen disponibles con ?all=1 para el panel de
// administracion de Inventario y Almacenamiento.
export async function GET(req: NextRequest) {
  await ensureWasteStorageInitialLocations();
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "1";
  const where = includeInactive ? "" : "WHERE l.active = true";
  const { rows } = await sql.query(
    `
      SELECT
        l.*,
        COUNT(w.id) FILTER (WHERE w.status != 'liberado')::int AS current_count
      FROM waste_storage_locations l
      LEFT JOIN radioactive_waste_labels w ON w.storage_location_id = l.id
      ${where}
      GROUP BY l.id
      ORDER BY l.sort_order, l.name
    `,
    []
  );
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "El nombre de la ubicación es obligatorio" }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO waste_storage_locations (name, description, capacity, sort_order) VALUES
    (${name}, ${body.description ?? null}, ${body.capacity ?? null}, ${body.sort_order ?? 0})
    ON CONFLICT (name) DO UPDATE SET
      description = EXCLUDED.description,
      capacity = EXCLUDED.capacity,
      updated_at = now()
    RETURNING *
  `;
  return NextResponse.json({ row: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = body.id ? Number(body.id) : null;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { rows } = await sql`
    UPDATE waste_storage_locations SET
      name        = COALESCE(${body.name ?? null}, name),
      description = COALESCE(${body.description ?? null}, description),
      capacity    = COALESCE(${body.capacity ?? null}::int, capacity),
      sort_order  = COALESCE(${body.sort_order ?? null}::int, sort_order),
      active      = COALESCE(${body.active ?? null}::boolean, active),
      updated_at  = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });
  return NextResponse.json({ row: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ? Number(searchParams.get("id")) : null;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Soft delete — deactivate rather than hard-delete to preserve history
  const { rows } = await sql`
    UPDATE waste_storage_locations SET active = false, updated_at = now()
    WHERE id = ${id}
    RETURNING id, name
  `;
  if (!rows.length) return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });
  return NextResponse.json({ deleted: rows[0] });
}
