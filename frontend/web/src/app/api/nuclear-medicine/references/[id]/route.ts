import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureNmReferencesTables, logNmReferenceAudit } from "@/lib/nm-references";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureNmReferencesTables();
  const { rows } = await sql`SELECT * FROM nm_technical_references WHERE id = ${id}`;
  if (!rows[0]) {
    return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404 });
  }
  const { rows: history } = await sql`
    SELECT * FROM nm_reference_history WHERE reference_id = ${id} ORDER BY created_at ASC, id ASC
  `;
  return NextResponse.json({ ok: true, reference: rows[0], history });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureNmReferencesTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;

  const { rows: before } = await sql`SELECT * FROM nm_technical_references WHERE id = ${id}`;
  if (!before[0]) {
    return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404 });
  }

  await sql`
    UPDATE nm_technical_references SET
      document_title = COALESCE(${body.documentTitle || null}, document_title),
      document_code = COALESCE(${body.documentCode || null}, document_code),
      year = COALESCE(${body.year || null}, year),
      version = COALESCE(${body.version || null}, version),
      chapter = COALESCE(${body.chapter || null}, chapter),
      section_ref = COALESCE(${body.sectionRef || null}, section_ref),
      table_ref = COALESCE(${body.tableRef || null}, table_ref),
      radionuclide = COALESCE(${body.radionuclide || null}, radionuclide),
      criterion_type = COALESCE(${body.criterionType || null}, criterion_type),
      variable_name = COALESCE(${body.variableName || null}, variable_name),
      value_text = COALESCE(${body.valueText || null}, value_text),
      unit = COALESCE(${body.unit || null}, unit),
      context = COALESCE(${body.context || null}, context),
      official_url = COALESCE(${body.officialUrl || null}, official_url),
      verification_date = COALESCE(${body.verificationDate || null}, verification_date),
      verification_status = COALESCE(${body.verificationStatus || null}, verification_status),
      notes = COALESCE(${body.notes || null}, notes),
      status = COALESCE(${body.status || null}, status),
      updated_at = now()
    WHERE id = ${id}
  `;

  await sql`
    INSERT INTO nm_reference_history (reference_id, action, previous_value, new_value, notes, actor_email)
    VALUES (
      ${id}, 'actualizacion',
      ${before[0]!.verification_status}, ${body.verificationStatus || before[0]!.verification_status},
      ${body.notes || null}, ${actorEmail}
    )
  `;

  await logNmReferenceAudit("update_nm_reference", actorEmail, { id, fields: Object.keys(body) });
  return NextResponse.json({ ok: true });
}
