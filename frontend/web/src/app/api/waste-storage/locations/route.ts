import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Catalogo de ubicaciones de almacenamiento temporal (parametrizable): permite
// agregar nuevas salas, estantes o contenedores sin modificar el codigo.
export async function GET() {
  const { rows } = await sql`
    SELECT
      l.*,
      COUNT(w.id) FILTER (WHERE w.status != 'liberado')::int AS current_count
    FROM waste_storage_locations l
    LEFT JOIN radioactive_waste_labels w ON w.storage_location_id = l.id
    GROUP BY l.id
    ORDER BY l.sort_order, l.name
  `;
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "El nombre de la ubicación es obligatorio" }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO waste_storage_locations (name, description, capacity, sort_order)
    VALUES (${name}, ${body.description ?? null}, ${body.capacity ?? null}, ${body.sort_order ?? 0})
    ON CONFLICT (name) DO UPDATE SET
      description = EXCLUDED.description,
      capacity = EXCLUDED.capacity,
      updated_at = now()
    RETURNING *
  `;
  return NextResponse.json({ row: rows[0] }, { status: 201 });
}
