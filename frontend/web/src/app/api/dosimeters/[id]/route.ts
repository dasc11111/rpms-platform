import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS: Array<{ key: string; column: string; label: string }> = [
  { key: "code", column: "code", label: "Codigo XA" },
  { key: "type", column: "type", label: "Tipo de dosimetro" },
  { key: "status", column: "status", label: "Estado" },
  { key: "workerRut", column: "worker_rut", label: "RUN trabajador" },
  { key: "workerName", column: "worker_name", label: "Trabajador asignado" },
  { key: "service", column: "service", label: "Servicio" },
  { key: "unit", column: "unit", label: "Unidad" },
  { key: "deliveryDate", column: "delivery_date", label: "Fecha de entrega" },
  { key: "estimatedReturnDate", column: "estimated_return_date", label: "Fecha estimada de devolucion" },
  { key: "actualReturnDate", column: "actual_return_date", label: "Fecha efectiva de devolucion" },
  { key: "observations", column: "observations", label: "Observaciones" },
];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDosimeterTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { rows: dosimeterRows } = await sql`SELECT * FROM dosimeters WHERE id = ${id}`;
  const dosimeter = dosimeterRows[0];
  if (!dosimeter) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { rows: assignments } = await sql`
    SELECT * FROM dosimeter_assignments WHERE dosimeter_id = ${id} ORDER BY created_at DESC, id DESC
  `;

  const { rows: history } = await sql`
    SELECT * FROM dosimeter_history WHERE dosimeter_id = ${id} ORDER BY changed_at DESC, id DESC
  `;

  return NextResponse.json({ dosimeter, assignments, history });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDosimeterTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const changedBy = body.changedBy || "Usuario RPMS";

  const { rows: currentRows } = await sql`SELECT * FROM dosimeters WHERE id = ${id}`;
  const current = currentRows[0] as Record<string, unknown> | undefined;
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if ("code" in body) {
    const newCode = String(body.code || "").trim();
    if (newCode && newCode !== current.code) {
      const { rows: dupe } = await sql`SELECT id FROM dosimeters WHERE code = ${newCode} AND id <> ${id}`;
      if (dupe.length > 0) {
        return NextResponse.json({ error: "code_already_exists" }, { status: 409 });
      }
    }
  }

  const updates: string[] = [];
  const historyEntries: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  const values: unknown[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (!(field.key in body)) continue;
    const newValue = body[field.key];
    const oldValue = current[field.column];
    const oldStr = oldValue === null || oldValue === undefined ? null : String(oldValue);
    const newStr = newValue === null || newValue === undefined || newValue === "" ? null : String(newValue);
    if (oldStr === newStr) continue;

    values.push(newStr);
    updates.push(`${field.column} = $${values.length}`);
    historyEntries.push({ field: field.label, oldValue: oldStr, newValue: newStr });
  }

  if (updates.length === 0) {
    return NextResponse.json({ dosimeter: current, changed: false });
  }

  values.push(id);
  const query = `UPDATE dosimeters SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`;
  const { rows: updatedRows } = await sql.query(query, values);
  const updated = updatedRows[0];

  for (const entry of historyEntries) {
    await sql`
      INSERT INTO dosimeter_history (dosimeter_id, changed_by, field_name, old_value, new_value)
      VALUES (${id}, ${changedBy}, ${entry.field}, ${entry.oldValue}, ${entry.newValue})
    `;
  }

  return NextResponse.json({ dosimeter: updated, changed: true });
}
