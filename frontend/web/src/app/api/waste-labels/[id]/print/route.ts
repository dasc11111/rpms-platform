import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Registra cada impresion del rotulo (contador + fecha) para trazabilidad,
// segun lo requerido: "Cantidad de impresiones" y "Fecha de impresión".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

const { rows } = await sql`
UPDATE radioactive_waste_labels
SET print_count = print_count + 1, last_printed_at = now(), updated_at = now()
WHERE id = ${Number(id)}
RETURNING *
`;
  const label = rows[0] as Record<string, unknown> | undefined;
  if (!label) {
    return NextResponse.json({ error: "Rótulo no encontrado" }, { status: 404 });
  }

await sql`
INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
VALUES (${Number(id)}, ${label.label_number}, 'printed', ${body.changed_by ?? null}, ${JSON.stringify(label)})
`;

return NextResponse.json({ row: label });
}
