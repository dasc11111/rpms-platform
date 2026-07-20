import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function toBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1" || v === 1;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const originalRut = String(body.original_rut ?? "").trim();
  const rut = String(body.rut ?? "").trim();
  const name = String(body.name ?? "").trim();

  if (!originalRut) {
    return NextResponse.json({ error: "Falta el RUT original del trabajador." }, { status: 400 });
  }
  if (!rut || !name) {
    return NextResponse.json({ error: "RUT y nombre son obligatorios." }, { status: 400 });
  }

  const { rows: existingRows } = await sql`SELECT rut FROM workers WHERE rut = ${originalRut} LIMIT 1`;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: "No se encontró el trabajador a editar." }, { status: 404 });
  }

  if (rut !== originalRut) {
    const { rows: conflictRows } = await sql`SELECT rut FROM workers WHERE rut = ${rut} LIMIT 1`;
    if (conflictRows.length > 0) {
      return NextResponse.json({ error: "Ya existe otro trabajador con ese RUT." }, { status: 409 });
    }
  }

  const role = String(body.role ?? "").trim() || null;
  const service = String(body.service ?? "").trim() || null;
  const category = String(body.category ?? "").trim() || null;
  const annualDose = Number(body.annual_dose ?? 0) || 0;
  const dv = String(body.dv ?? "").trim() || null;
  const sex = String(body.sex ?? "").trim() || null;
  const address = String(body.address ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;
  const email = String(body.email ?? "").trim() || null;
  const birthDate = String(body.birth_date ?? "").trim() || null;
  const estamento = String(body.estamento ?? "").trim() || null;
  const contractType = String(body.contract_type ?? "").trim() || null;
  const unit = String(body.unit ?? "").trim() || null;

  // Curso de Proteccion Radiologica y Autorizacion de Desempeno.
  const coursePrCompleted = toBool(body.course_pr_completed);
  const coursePrDate = String(body.course_pr_date ?? "").trim() || null;
  const authorizationNumber = String(body.authorization_number ?? "").trim() || null;
  const authorizationIssueDate = String(body.authorization_issue_date ?? "").trim() || null;
  const authorizationExpiryDate = String(body.authorization_expiry_date ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  await sql`
    UPDATE workers SET
      rut = ${rut},
      name = ${name},
      role = ${role},
      service = ${service},
      category = ${category},
      annual_dose = ${annualDose},
      dv = ${dv},
      sex = ${sex},
      address = ${address},
      phone = ${phone},
      email = ${email},
      birth_date = ${birthDate},
      estamento = ${estamento},
      contract_type = ${contractType},
      unit = ${unit},
      course_pr_completed = ${coursePrCompleted},
      course_pr_date = ${coursePrDate},
      authorization_number = ${authorizationNumber},
      authorization_issue_date = ${authorizationIssueDate},
      authorization_expiry_date = ${authorizationExpiryDate},
      notes = ${notes},
      updated_at = now()
    WHERE rut = ${originalRut}
  `;

  return NextResponse.json({ ok: true, rut });
}
