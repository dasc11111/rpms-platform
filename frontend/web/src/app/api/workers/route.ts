import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { normalizeRut, cleanRut } from "@/lib/rut";
import { composeWorkerName } from "@/lib/worker-name";

export const dynamic = "force-dynamic";

async function ensureNameColumns() {
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_1 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_2 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS first_names TEXT`;
}

export async function GET(request: Request) {
  await ensureNameColumns();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const all = searchParams.get("all") === "1";

  let rows: Record<string, unknown>[];
  if (all) {
    // Usado por la exportacion de trabajadores: incluye TODOS los registros
    // (activos, suspendidos e inactivos) para no perder informacion.
    ({ rows } = await sql`
      SELECT rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
        course_pr_completed, course_pr_date,
        authorization_number, authorization_issue_date, authorization_expiry_date, notes
      FROM workers
      ORDER BY name ASC
    `);
  } else if (status) {
    ({ rows } = await sql`
      SELECT rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
        course_pr_completed, course_pr_date,
        authorization_number, authorization_issue_date, authorization_expiry_date, notes
      FROM workers
      WHERE status = ${status}
      ORDER BY name ASC
    `);
  } else {
    ({ rows } = await sql`
      SELECT rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
        course_pr_completed, course_pr_date,
        authorization_number, authorization_issue_date, authorization_expiry_date, notes
      FROM workers
      WHERE status <> 'inactive'
      ORDER BY name ASC
    `);
  }

  return NextResponse.json({ workers: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];

  await ensureNameColumns();

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const rutRaw = String(r.rut ?? r.run ?? "").trim();
    const lastName1 = String(r.apellido_paterno ?? r.last_name_1 ?? "").trim() || null;
    const lastName2 = String(r.apellido_materno ?? r.last_name_2 ?? "").trim() || null;
    const firstNames = String(r.nombres ?? r.first_names ?? "").trim() || null;
    const name = composeWorkerName({
      last_name_1: lastName1,
      last_name_2: lastName2,
      first_names: firstNames,
      name: r.name ?? r.nombre,
    });
    if (!rutRaw || !name) {
      skipped++;
      continue;
    }

    const normalized = normalizeRut(rutRaw);
    if (!normalized.ok) {
      skipped++;
      if (errors.length < 20) errors.push(`${rutRaw}: ${normalized.error}`);
      continue;
    }
    const rut = normalized.rut;
    const rutKey = cleanRut(rut);

    const role = String(r.role ?? r.cargo ?? "").trim() || null;
    const service = String(r.service ?? r.servicio ?? "").trim() || null;
    const category = String(r.category ?? r.categoria ?? "").trim() || null;
    const status = (String(r.status ?? r.estado ?? "active").trim().toLowerCase()) || "active";
    const annualDose = Number(r.annual_dose ?? r.annualDose ?? r.dosis_anual ?? 0) || 0;
    const dv = String(r.dv ?? "").trim() || null;
    const sex = String(r.sex ?? r.sexo ?? "").trim() || null;
    const address = String(r.address ?? r.direccion ?? "").trim() || null;
    const phone = String(r.phone ?? r.telefono ?? "").trim() || null;
    const email = String(r.email ?? r.correo ?? "").trim() || null;
    const birthDate = String(r.birth_date ?? r.fecha_nacimiento ?? "").trim() || null;
    const estamento = String(r.estamento ?? "").trim() || null;
    const contractType = String(r.contract_type ?? r.calidad_contractual ?? "").trim() || null;
    const unit = String(r.unit ?? r.unidad ?? "").trim() || null;

    // Comparacion tolerante: si el mismo RUT ya existe con otro formato,
    // actualizamos ese registro en vez de crear uno duplicado.
    const { rows: existingRows } = await sql`
      SELECT rut FROM workers
      WHERE regexp_replace(UPPER(rut), '[^0-9K]', '', 'g') = ${rutKey}
      LIMIT 1
    `;
    const targetRut = existingRows[0]?.rut ?? rut;

    await sql`
      INSERT INTO workers (rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit)
      VALUES (${targetRut}, ${name}, ${lastName1}, ${lastName2}, ${firstNames}, ${role}, ${service}, ${category}, ${status}, ${annualDose},
        ${dv}, ${sex}, ${address}, ${phone}, ${email}, ${birthDate}, ${estamento}, ${contractType}, ${unit})
      ON CONFLICT (rut) DO UPDATE SET
        rut = ${rut},
        name = EXCLUDED.name,
        last_name_1 = COALESCE(EXCLUDED.last_name_1, workers.last_name_1),
        last_name_2 = COALESCE(EXCLUDED.last_name_2, workers.last_name_2),
        first_names = COALESCE(EXCLUDED.first_names, workers.first_names),
        role = EXCLUDED.role,
        service = EXCLUDED.service,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        annual_dose = EXCLUDED.annual_dose,
        dv = COALESCE(EXCLUDED.dv, workers.dv),
        sex = COALESCE(EXCLUDED.sex, workers.sex),
        address = COALESCE(EXCLUDED.address, workers.address),
        phone = COALESCE(EXCLUDED.phone, workers.phone),
        email = COALESCE(EXCLUDED.email, workers.email),
        birth_date = COALESCE(EXCLUDED.birth_date, workers.birth_date),
        estamento = COALESCE(EXCLUDED.estamento, workers.estamento),
        contract_type = COALESCE(EXCLUDED.contract_type, workers.contract_type),
        unit = COALESCE(EXCLUDED.unit, workers.unit),
        updated_at = now();
    `;
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped, errors });
}

export async function PATCH(request: Request) {
  await ensureNameColumns();
  const body = await request.json().catch(() => ({}));
  const { rut, ...fields } = body as {
    rut: string; name?: string; last_name_1?: string; last_name_2?: string; first_names?: string;
    role?: string; service?: string; category?: string; status?: string; annual_dose?: number;
    sex?: string; address?: string; phone?: string; email?: string; birth_date?: string;
    estamento?: string; contract_type?: string; unit?: string;
    course_pr_completed?: boolean; course_pr_date?: string;
    authorization_number?: string; authorization_issue_date?: string; authorization_expiry_date?: string;
    notes?: string;
  };
  if (!rut) return NextResponse.json({ error: "rut requerido" }, { status: 400 });
  const name = fields.name ? composeWorkerName({
    last_name_1: fields.last_name_1 ?? null, last_name_2: fields.last_name_2 ?? null,
    first_names: fields.first_names ?? null, name: fields.name,
  }) : undefined;
  const { rows } = await sql`
    UPDATE workers SET
      name = COALESCE(${name ?? null}, name),
      last_name_1 = COALESCE(${fields.last_name_1 ?? null}, last_name_1),
      last_name_2 = COALESCE(${fields.last_name_2 ?? null}, last_name_2),
      first_names = COALESCE(${fields.first_names ?? null}, first_names),
      role = COALESCE(${fields.role ?? null}, role),
      service = COALESCE(${fields.service ?? null}, service),
      category = COALESCE(${fields.category ?? null}, category),
      status = COALESCE(${fields.status ?? null}, status),
      annual_dose = COALESCE(${fields.annual_dose ?? null}, annual_dose),
      sex = COALESCE(${fields.sex ?? null}, sex),
      address = COALESCE(${fields.address ?? null}, address),
      phone = COALESCE(${fields.phone ?? null}, phone),
      email = COALESCE(${fields.email ?? null}, email),
      birth_date = COALESCE(${fields.birth_date ?? null}, birth_date),
      estamento = COALESCE(${fields.estamento ?? null}, estamento),
      contract_type = COALESCE(${fields.contract_type ?? null}, contract_type),
      unit = COALESCE(${fields.unit ?? null}, unit),
      course_pr_completed = COALESCE(${fields.course_pr_completed ?? null}, course_pr_completed),
      course_pr_date = COALESCE(${fields.course_pr_date ?? null}, course_pr_date),
      authorization_number = COALESCE(${fields.authorization_number ?? null}, authorization_number),
      authorization_issue_date = COALESCE(${fields.authorization_issue_date ?? null}, authorization_issue_date),
      authorization_expiry_date = COALESCE(${fields.authorization_expiry_date ?? null}, authorization_expiry_date),
      notes = COALESCE(${fields.notes ?? null}, notes),
      updated_at = NOW()
    WHERE rut = ${rut}
    RETURNING rut, name, role, service, category, status, annual_dose, authorization_expiry_date
  `;
  if (!rows[0]) return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  return NextResponse.json({ worker: rows[0] });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const rut = searchParams.get("rut");
  if (!rut) return NextResponse.json({ error: "rut requerido" }, { status: 400 });
  // Soft delete: set status to inactive
  await sql`UPDATE workers SET status = 'inactive', updated_at = NOW() WHERE rut = ${rut}`;
  return NextResponse.json({ ok: true });
}
