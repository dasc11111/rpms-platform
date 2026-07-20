import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function clean(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
}

function toBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1" || v === 1;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const rut = clean(body.rut);
  const name = clean(body.name);
  if (!rut || !name) {
    return NextResponse.json({ ok: false, error: "RUT y nombre son obligatorios." }, { status: 400 });
  }

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

  const { rows: existingRows } = await sql`SELECT rut, status FROM workers WHERE rut = ${rut} LIMIT 1`;
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
        name = ${name},
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
      WHERE rut = ${rut}
    `;
    return NextResponse.json({ ok: true, reactivated: true });
  }

  await sql`
    INSERT INTO workers (rut, name, role, service, category, status, annual_dose,
      dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
      course_pr_completed, course_pr_date,
      authorization_number, authorization_issue_date, authorization_expiry_date, notes)
    VALUES (${rut}, ${name}, ${role}, ${service}, ${category}, 'active', ${annualDose},
      ${dv}, ${sex}, ${address}, ${phone}, ${email}, ${birthDate}, ${estamento}, ${contractType}, ${unit},
      ${coursePrCompleted}, ${coursePrDate},
      ${authorizationNumber}, ${authorizationIssueDate}, ${authorizationExpiryDate}, ${notes})
  `;
  return NextResponse.json({ ok: true, created: true });
}
