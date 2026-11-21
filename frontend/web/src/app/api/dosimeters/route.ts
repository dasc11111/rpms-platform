import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";
import { isOverdue, daysOverdue } from "@/lib/dosimeters";

export const dynamic = "force-dynamic";

type Filters = {
  q?: string;
  type?: string;
  status?: string;
  service?: string;
  unit?: string;
};

function buildWhere(filters: Filters): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const p = params.length;
    conditions.push(
      `(code ILIKE $${p} OR worker_name ILIKE $${p} OR worker_rut ILIKE $${p} OR service ILIKE $${p} OR unit ILIKE $${p})`
    );
  }
  if (filters.type) {
    params.push(filters.type);
    conditions.push(`type = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.service) {
    params.push(filters.service);
    conditions.push(`service = $${params.length}`);
  }
  if (filters.unit) {
    params.push(filters.unit);
    conditions.push(`unit = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export async function GET(request: Request) {
  await ensureDosimeterTables();

  const { searchParams } = new URL(request.url);
  const filters: Filters = {
    q: searchParams.get("q") || undefined,
    type: searchParams.get("type") || undefined,
    status: searchParams.get("status") || undefined,
    service: searchParams.get("service") || undefined,
    unit: searchParams.get("unit") || undefined,
  };

  const { where, params } = buildWhere(filters);
  const query = `SELECT * FROM dosimeters ${where} ORDER BY code ASC LIMIT 5000`;
  const { rows } = await sql.query(query, params);

  type Row = Record<string, unknown>;
  const items = (rows as Row[]).map((row) => {
    const overdue = isOverdue(row as any);
    return {
      ...row,
      overdue,
      days_overdue: overdue ? daysOverdue(row.estimated_return_date as string) : null,
    };
  });

  return NextResponse.json({ dosimeters: items, total: items.length });
}

export async function POST(request: Request) {
  await ensureDosimeterTables();

  const body = await request.json();
  const code = String(body.code || "").trim();
  if (!code) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  const { rows: existing } = await sql`SELECT id FROM dosimeters WHERE code = ${code}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "code_already_exists" }, { status: 409 });
  }

  const type = body.type || "cuerpo_entero";
  const workerRut = body.workerRut || null;
  const workerName = body.workerName || null;
  const service = body.service || null;
  const unit = body.unit || null;
  const deliveryDate = body.deliveryDate || null;
  const estimatedReturnDate = body.estimatedReturnDate || null;
  const observations = body.observations || null;
  const status = body.status || (workerRut ? "asignado" : "disponible");
  const changedBy = body.changedBy || "Usuario RPMS";

  const { rows } = await sql`
    INSERT INTO dosimeters (
      code, type, status, worker_rut, worker_name, service, unit, delivery_date, estimated_return_date, observations
    ) VALUES (
      ${code}, ${type}, ${status}, ${workerRut}, ${workerName}, ${service}, ${unit}, ${deliveryDate}, ${estimatedReturnDate}, ${observations}
    )
    RETURNING *
  `;

  const created = rows[0] as { id: number };

  await sql`
    INSERT INTO dosimeter_history (dosimeter_id, changed_by, field_name, old_value, new_value)
    VALUES (${created.id}, ${changedBy}, 'creacion', NULL, ${"Dosimetro creado: " + code})
  `;

  if (workerRut) {
    await sql`
      INSERT INTO dosimeter_assignments (
        dosimeter_id, worker_rut, worker_name, service, unit, delivery_date, estimated_return_date, observations
      ) VALUES (
        ${created.id}, ${workerRut}, ${workerName}, ${service}, ${unit}, ${deliveryDate}, ${estimatedReturnDate}, ${observations}
      )
    `;
  }

  return NextResponse.json({ dosimeter: created });
}
