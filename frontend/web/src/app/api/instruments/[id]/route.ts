import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS: Array<{ key: string; column: string; label: string }> = [
  { key: "code", column: "code", label: "Codigo interno" },
  { key: "name", column: "name", label: "Nombre" },
  { key: "typeId", column: "type_id", label: "Tipo" },
  { key: "brand", column: "brand", label: "Marca" },
  { key: "model", column: "model", label: "Modelo" },
  { key: "serialNumber", column: "serial_number", label: "Numero de serie" },
  { key: "manufacturer", column: "manufacturer", label: "Fabricante" },
  { key: "service", column: "service", label: "Servicio" },
  { key: "unit", column: "unit", label: "Unidad" },
  { key: "location", column: "location", label: "Ubicacion" },
  { key: "acquisitionDate", column: "acquisition_date", label: "Fecha de adquisicion" },
  { key: "provider", column: "provider", label: "Proveedor" },
  { key: "status", column: "status", label: "Estado" },
  { key: "notes", column: "notes", label: "Observaciones" },
  ];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const { rows: instrumentRows } = await sql`
SELECT i.*, t.name AS type_name
FROM instruments i
LEFT JOIN instrument_types t ON t.id = i.type_id
WHERE i.id = ${id}
`;
  const instrument = instrumentRows[0];
  if (!instrument) return NextResponse.json({ error: "not_found" }, { status: 404 });

const { rows: calibrations } = await sql`
SELECT c.*, COALESCE(c.company_name, cc.name) AS company_name_resolved
FROM calibrations c
LEFT JOIN calibration_companies cc ON cc.id = c.company_id
WHERE c.instrument_id = ${id}
ORDER BY c.calibration_date DESC, c.id DESC
`;

const { rows: failures } = await sql`
SELECT * FROM instrument_failures WHERE instrument_id = ${id} ORDER BY failure_date DESC, id DESC
`;

const { rows: maintenances } = await sql`
SELECT * FROM instrument_maintenances WHERE instrument_id = ${id} ORDER BY maintenance_date DESC, id DESC
`;

const { rows: history } = await sql`
SELECT * FROM instrument_history WHERE instrument_id = ${id} ORDER BY changed_at DESC, id DESC
`;

const calibrationIds = calibrations.map((c: Record<string, unknown>) => c.id as number);
  const failureIds = failures.map((f: Record<string, unknown>) => f.id as number);
  const maintenanceIds = maintenances.map((m: Record<string, unknown>) => m.id as number);

const { rows: docRows } = await sql.query(
  `SELECT * FROM instrument_documents
  WHERE (owner_type = 'instrument' AND owner_id = $1)
  OR (owner_type = 'calibration' AND owner_id = ANY($2))
  OR (owner_type = 'failure' AND owner_id = ANY($3))
  OR (owner_type = 'maintenance' AND owner_id = ANY($4))
  ORDER BY created_at DESC`,
  [id, calibrationIds.length ? calibrationIds : [0], failureIds.length ? failureIds : [0], maintenanceIds.length ? maintenanceIds : [0]]
  );
  const documents = docRows as Record<string, unknown>[];

return NextResponse.json({ instrument, calibrations, failures, maintenances, history, documents });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

const body = await request.json();
  const changedBy = body.changedBy || "Usuario RPMS";

const { rows: currentRows } = await sql`SELECT * FROM instruments WHERE id = ${id}`;
  const current = currentRows[0] as Record<string, unknown> | undefined;
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

const updates: string[] = [];
  const historyEntries: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  const values: unknown[] = [];

for (const field of EDITABLE_FIELDS) {
  if (!(field.key in body)) continue;
  let newValue = body[field.key];
  if (field.key === "typeId") newValue = newValue ? Number(newValue) : null;
  const oldValue = current[field.column];
  const oldStr = oldValue === null || oldValue === undefined ? null : String(oldValue);
  const newStr = newValue === null || newValue === undefined ? null : String(newValue);
  if (oldStr === newStr) continue;

  values.push(newValue);
  updates.push(`${field.column} = $${values.length}`);
  historyEntries.push({ field: field.label, oldValue: oldStr, newValue: newStr });
}

if (updates.length === 0) {
  return NextResponse.json({ instrument: current, changed: false });
}

values.push(id);
  const query = `UPDATE instruments SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`;
  const { rows: updatedRows } = await sql.query(query, values);
  const updated = updatedRows[0];

for (const entry of historyEntries) {
  await sql`
  INSERT INTO instrument_history (instrument_id, changed_by, field_name, old_value, new_value)
  VALUES (${id}, ${changedBy}, ${entry.field}, ${entry.oldValue}, ${entry.newValue})
  `;
}

return NextResponse.json({ instrument: updated, changed: true });
}
