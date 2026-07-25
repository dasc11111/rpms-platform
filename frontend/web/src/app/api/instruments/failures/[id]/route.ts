import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS: Array<{ key: string; column: string }> = [
  { key: "failureDate", column: "failure_date" },
  { key: "failureType", column: "failure_type" },
  { key: "description", column: "description" },
  { key: "diagnosis", column: "diagnosis" },
  { key: "correctiveAction", column: "corrective_action" },
  { key: "responsible", column: "responsible" },
  { key: "status", column: "status" },
  { key: "notes", column: "notes" },
  ];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const body = await request.json();
  const changedBy = body.changedBy || "Usuario RPMS";

const { rows: currentRows } = await sql`SELECT * FROM instrument_failures WHERE id = ${id}`;
  const current = currentRows[0] as Record<string, unknown> | undefined;
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

const updates: string[] = [];
  const values: unknown[] = [];
  for (const field of EDITABLE_FIELDS) {
    if (!(field.key in body)) continue;
    values.push(body[field.key]);
    updates.push(`${field.column} = $${values.length}`);
  }

if (updates.length === 0) {
  return NextResponse.json({ failure: current, changed: false });
}

values.push(id);
  const query = `UPDATE instrument_failures SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`;
  const { rows: updatedRows } = await sql.query(query, values);
  const updated = updatedRows[0] as Record<string, unknown>;

await sql`
INSERT INTO instrument_history (instrument_id, changed_by, field_name, old_value, new_value)
VALUES (${updated.instrument_id as number}, ${changedBy}, 'falla_actualizada', ${String(current.status)}, ${String(updated.status)})
`;

return NextResponse.json({ failure: updated, changed: true });
}
