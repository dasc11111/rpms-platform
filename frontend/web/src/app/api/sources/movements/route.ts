import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// NS-04 CCHEN — Registro de Movimientos de Fuentes Radiactivas (IMAR)
// Tipos de movimiento:
//   alta        — ingreso de nueva fuente al inventario
//   baja        — retiro definitivo (desecho, devolución proveedor)
//   prestamo    — salida temporal a otra unidad/institución
//   devolucion  — retorno de un préstamo
//   traslado    — cambio de ubicación dentro del establecimiento
//   transferencia — traspaso definitivo a otra institución

const VALID_TYPES = ["alta", "baja", "prestamo", "devolucion", "traslado", "transferencia"] as const;

async function ensureTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS source_movements (
        id SERIAL PRIMARY KEY,
        source_id INT NOT NULL,
        source_name TEXT NOT NULL,
        isotope TEXT,
        serial_number TEXT,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('alta','baja','prestamo','devolucion','traslado','transferencia')),
        movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
        origin_location TEXT,
        destination_location TEXT,
        responsible TEXT,
        authorized_by TEXT,
        document_ref TEXT,
        expected_return_date DATE,
        actual_return_date DATE,
        activity_gbq NUMERIC(12,4),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sm_source_id ON source_movements(source_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sm_movement_date ON source_movements(movement_date DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sm_type ON source_movements(movement_type);`;
  } catch { /* table already exists */ }
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("source_id");
  const type = searchParams.get("type");
  const days = parseInt(searchParams.get("days") ?? "365", 10);
  const summary = searchParams.get("summary") === "1";

  if (summary) {
    // Count by type + sources currently on loan
    const { rows: byType } = await sql`
      SELECT movement_type, COUNT(*)::int AS count
      FROM source_movements
      WHERE movement_date >= CURRENT_DATE - ${days}::int
      GROUP BY movement_type
      ORDER BY count DESC
    `;

    const { rows: onLoan } = await sql`
      SELECT sm.*, p.id AS prestamo_id
      FROM source_movements sm
      LEFT JOIN source_movements p ON (
        p.source_id = sm.source_id
        AND p.movement_type = 'devolucion'
        AND p.movement_date >= sm.movement_date
      )
      WHERE sm.movement_type = 'prestamo'
        AND p.id IS NULL
      ORDER BY sm.movement_date ASC
    `;

    return NextResponse.json({ by_type: byType, on_loan: onLoan, on_loan_count: onLoan.length });
  }

  let rows;
  if (sourceId) {
    ({ rows } = await sql`
      SELECT * FROM source_movements
      WHERE source_id = ${parseInt(sourceId, 10)}
      ORDER BY movement_date DESC, id DESC
      LIMIT 200
    `);
  } else if (type) {
    ({ rows } = await sql`
      SELECT * FROM source_movements
      WHERE movement_type = ${type}
        AND movement_date >= CURRENT_DATE - ${days}::int
      ORDER BY movement_date DESC, id DESC
      LIMIT 200
    `);
  } else {
    ({ rows } = await sql`
      SELECT * FROM source_movements
      WHERE movement_date >= CURRENT_DATE - ${days}::int
      ORDER BY movement_date DESC, id DESC
      LIMIT 200
    `);
  }

  return NextResponse.json({ movements: rows });
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const {
    source_id, source_name, isotope, serial_number,
    movement_type, movement_date, origin_location, destination_location,
    responsible, authorized_by, document_ref,
    expected_return_date, activity_gbq, notes,
  } = body;

  if (!source_id || !source_name || !movement_type) {
    return NextResponse.json({ error: "source_id, source_name y movement_type son requeridos" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(movement_type)) {
    return NextResponse.json({ error: `movement_type debe ser uno de: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO source_movements (
      source_id, source_name, isotope, serial_number,
      movement_type, movement_date, origin_location, destination_location,
      responsible, authorized_by, document_ref,
      expected_return_date, activity_gbq, notes
    ) VALUES (
      ${source_id}, ${source_name}, ${isotope ?? null}, ${serial_number ?? null},
      ${movement_type}, ${movement_date ?? null}, ${origin_location ?? null}, ${destination_location ?? null},
      ${responsible ?? null}, ${authorized_by ?? null}, ${document_ref ?? null},
      ${expected_return_date ?? null}, ${activity_gbq ?? null}, ${notes ?? null}
    )
    RETURNING *
  `;

  // If movement_type = 'devolucion', update source status back to 'in_use'
  if (movement_type === "devolucion") {
    try {
      await sql`UPDATE radioactive_sources SET status = 'in_use' WHERE id = ${source_id}`;
    } catch { /* table may not exist */ }
  }
  if (movement_type === "prestamo") {
    try {
      await sql`UPDATE radioactive_sources SET status = 'on_loan' WHERE id = ${source_id}`;
    } catch { /* ignore */ }
  }
  if (movement_type === "baja" || movement_type === "transferencia") {
    try {
      await sql`UPDATE radioactive_sources SET status = 'inactive' WHERE id = ${source_id}`;
    } catch { /* ignore */ }
  }

  return NextResponse.json({ movement: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const body = (await req.json()) as Partial<{
    movement_type: string; movement_date: string; origin_location: string;
    destination_location: string; responsible: string; authorized_by: string;
    document_ref: string; expected_return_date: string; actual_return_date: string;
    activity_gbq: number; notes: string;
  }>;

  const { rows } = await sql`
    UPDATE source_movements SET
      movement_type       = COALESCE(${body.movement_type ?? null}, movement_type),
      movement_date       = COALESCE(${body.movement_date ?? null}::date, movement_date),
      origin_location     = COALESCE(${body.origin_location ?? null}, origin_location),
      destination_location = COALESCE(${body.destination_location ?? null}, destination_location),
      responsible         = COALESCE(${body.responsible ?? null}, responsible),
      authorized_by       = COALESCE(${body.authorized_by ?? null}, authorized_by),
      document_ref        = COALESCE(${body.document_ref ?? null}, document_ref),
      expected_return_date = COALESCE(${body.expected_return_date ?? null}::date, expected_return_date),
      actual_return_date  = COALESCE(${body.actual_return_date ?? null}::date, actual_return_date),
      activity_gbq        = COALESCE(${body.activity_gbq ?? null}::numeric, activity_gbq),
      notes               = COALESCE(${body.notes ?? null}, notes)
    WHERE id = ${parseInt(id, 10)}
    RETURNING *
  `;
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ movement: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await sql`DELETE FROM source_movements WHERE id = ${parseInt(id, 10)}`;
  return NextResponse.json({ ok: true });
}
