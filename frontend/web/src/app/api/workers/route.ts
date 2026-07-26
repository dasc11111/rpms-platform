import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { normalizeRut, cleanRut } from "@/lib/rut";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const all = searchParams.get("all") === "1";

  let rows: any[];
  if (all) {
    // Usado por la exportacion de trabajadores: incluye TODOS los registros
    // (activos, suspendidos e inactivos) para no perder informacion.
    ({ rows } = await sql`
      SELECT rut, name, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
        course_pr_completed, course_pr_date,
        authorization_number, authorization_issue_date, authorization_expiry_date, notes
      FROM workers
      ORDER BY name ASC
    `);
  } else if (status) {
    ({ rows } = await sql`
      SELECT rut, name, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
        course_pr_completed, course_pr_date,
        authorization_number, authorization_issue_date, authorization_expiry_date, notes
      FROM workers
      WHERE status = ${status}
      ORDER BY name ASC
    `);
  } else {
    ({ rows } = await sql`
      SELECT rut, name, role, service, category, status, annual_dose,
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
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const rutRaw = String(r.rut ?? r.run ?? "").trim();
    const name = String(r.name ?? r.nombre ?? "").trim();
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
      INSERT INTO workers (rut, name, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit)
      VALUES (${targetRut}, ${name}, ${role}, ${service}, ${category}, ${status}, ${annualDose},
        ${dv}, ${sex}, ${address}, ${phone}, ${email}, ${birthDate}, ${estamento}, ${contractType}, ${unit})
      ON CONFLICT (rut) DO UPDATE SET
        rut = ${rut},
        name = EXCLUDED.name,
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
