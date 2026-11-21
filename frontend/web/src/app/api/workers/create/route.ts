import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { normalizeRut, cleanRut } from "@/lib/rut";
import { composeWorkerName } from "@/lib/worker-name";

export const dynamic = "force-dynamic";

function clean(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
}

function toBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1" || v === 1;
}

async function ensureNameColumns() {
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_1 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_2 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS first_names TEXT`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  await ensureNameColumns();

  const rutInput = clean(body.rut);
  const lastName1 = clean(body.last_name_1);
  const lastName2 = clean(body.last_name_2);
  const firstNames = clean(body.first_names);
  const name = composeWorkerName({
    last_name_1: lastName1,
    last_name_2: lastName2,
    first_names: firstNames,
    name: body.name,
  }) || null;

  if (!rutInput || !name) {
    return NextResponse.json({ ok: false, error: "RUT y nombre son obligatorios." }, { status: 400 });
  }

  const normalized = normalizeRut(rutInput);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }
  const rut = normalized.rut;
  const rutKey = cleanRut(rut);

  const role = clean(body.role);
  const service = clean(body.service);
  const category = clean(body.category);
  const annualDose = Number(body.annual_dose ?? 0) || 0;
  const dv = clean(body.dv);
  const sex = clean(body.sex);
  const address = clean(body.address);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const birthDate = clean(body.birth_date);
  const estamento = clean(body.estamento);
  const contractType = clean(body.contract_type);
  const unit = clean(body.unit);

  // Curso de Proteccion Radiologica y Autorizacion de Desempeno.
  const coursePrCompleted = toBool(body.course_pr_completed);
  const coursePrDate = clean(body.course_pr_date);
  const authorizationNumber = clean(body.authorization_number);
  const authorizationIssueDate = clean(body.authorization_issue_date);
  const authorizationExpiryDate = clean(body.authorization_expiry_date);
  const notes = clean(body.notes);

  // Comparacion tolerante: detecta al mismo trabajador aunque el RUT ya
  // guardado tenga puntos, guion o mayusculas distintas.
  const { rows: existingRows } = await sql`
    SELECT rut, status FROM workers
    WHERE regexp_replace(UPPER(rut), '[^0-9K]', '', 'g') = ${rutKey}
    LIMIT 1
  `;
  const existing = existingRows[0];

  if (existing && existing.status !== "inactive") {
    return NextResponse.json(
      { ok: false, error: "Ya existe un trabajador activo (o suspendido) con ese RUT." },
      { status: 409 }
    );
  }

  if (existing) {
    await sql`
      UPDATE workers SET
        rut = ${rut},
        name = ${name},
        last_name_1 = COALESCE(${lastName1}, last_name_1),
        last_name_2 = COALESCE(${lastName2}, last_name_2),
        first_names = COALESCE(${firstNames}, first_names),
        role = COALESCE(${role}, role),
        service = COALESCE(${service}, service),
        category = COALESCE(${category}, category),
        status = 'active',
        annual_dose = ${annualDose},
        dv = COALESCE(${dv}, dv),
        sex = COALESCE(${sex}, sex),
        address = COALESCE(${address}, address),
        phone = COALESCE(${phone}, phone),
        email = COALESCE(${email}, email),
        birth_date = COALESCE(${birthDate}, birth_date),
        estamento = COALESCE(${estamento}, estamento),
        contract_type = COALESCE(${contractType}, contract_type),
        unit = COALESCE(${unit}, unit),
        course_pr_completed = ${coursePrCompleted},
        course_pr_date = COALESCE(${coursePrDate}, course_pr_date),
        authorization_number = COALESCE(${authorizationNumber}, authorization_number),
        authorization_issue_date = COALESCE(${authorizationIssueDate}, authorization_issue_date),
        authorization_expiry_date = COALESCE(${authorizationExpiryDate}, authorization_expiry_date),
        notes = COALESCE(${notes}, notes),
        updated_at = now()
      WHERE rut = ${existing.rut}
    `;
    return NextResponse.json({ ok: true, reactivated: true, rut });
  }

  await sql`
    INSERT INTO workers (rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
      dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
      course_pr_completed, course_pr_date,
      authorization_number, authorization_issue_date, authorization_expiry_date, notes)
    VALUES (${rut}, ${name}, ${lastName1}, ${lastName2}, ${firstNames}, ${role}, ${service}, ${category}, 'active', ${annualDose},
      ${dv}, ${sex}, ${address}, ${phone}, ${email}, ${birthDate}, ${estamento}, ${contractType}, ${unit},
      ${coursePrCompleted}, ${coursePrDate},
      ${authorizationNumber}, ${authorizationIssueDate}, ${authorizationExpiryDate}, ${notes})
  `;
  return NextResponse.json({ ok: true, created: true, rut });
}
