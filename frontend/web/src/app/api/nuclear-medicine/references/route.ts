import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureNmReferencesTables, logNmReferenceAudit } from "@/lib/nm-references";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureNmReferencesTables();
  const { searchParams } = new URL(request.url);
  const recordType = searchParams.get("recordType");
  const organization = searchParams.get("organization");
  const status = searchParams.get("status");
  const historyOf = searchParams.get("historyOf");

  if (historyOf) {
    const { rows } = await sql`
      SELECT * FROM nm_reference_history WHERE reference_id = ${historyOf} ORDER BY created_at ASC, id ASC
    `;
    return NextResponse.json({ ok: true, history: rows });
  }

  if (recordType && organization && status) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references
      WHERE record_type = ${recordType} AND organization = ${organization} AND status = ${status}
      ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }
  if (recordType && organization) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references
      WHERE record_type = ${recordType} AND organization = ${organization}
      ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }
  if (recordType && status) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references
      WHERE record_type = ${recordType} AND status = ${status}
      ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }
  if (organization && status) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references
      WHERE organization = ${organization} AND status = ${status}
      ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }
  if (recordType) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references WHERE record_type = ${recordType} ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }
  if (organization) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references WHERE organization = ${organization} ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }
  if (status) {
    const { rows } = await sql`
      SELECT * FROM nm_technical_references WHERE status = ${status} ORDER BY document_title ASC, id DESC
    `;
    return NextResponse.json({ ok: true, references: rows });
  }

  const { rows } = await sql`SELECT * FROM nm_technical_references ORDER BY document_title ASC, id DESC`;
  return NextResponse.json({ ok: true, references: rows });
}

export async function POST(request: Request) {
  await ensureNmReferencesTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;

  if (!String(body.documentTitle || "").trim() || !body.organization || !body.recordType) {
    return NextResponse.json(
      { ok: false, error: "Tipo de registro, organizacion y documento son obligatorios." },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    INSERT INTO nm_technical_references (
      record_type, organization, document_title, document_code, year, version, chapter,
      section_ref, table_ref, radionuclide, criterion_type, variable_name, value_text, unit,
      context, official_url, verification_date, verification_status, notes, status, created_by
    )
    VALUES (
      ${body.recordType}, ${body.organization}, ${body.documentTitle.trim()}, ${body.documentCode || null},
      ${body.year || null}, ${body.version || null}, ${body.chapter || null},
      ${body.sectionRef || null}, ${body.tableRef || null}, ${body.radionuclide || null},
      ${body.criterionType || null}, ${body.variableName || null}, ${body.valueText || null}, ${body.unit || null},
      ${body.context || null}, ${body.officialUrl || null}, ${body.verificationDate || null},
      ${body.verificationStatus || "pendiente_verificacion"}, ${body.notes || null}, ${body.status || "activo"},
      ${actorEmail}
    )
    RETURNING id;
  `;

  await sql`
    INSERT INTO nm_reference_history (reference_id, action, new_value, actor_email)
    VALUES (${rows[0]!.id}, 'creacion', 'Registro creado', ${actorEmail})
  `;

  await logNmReferenceAudit("create_nm_reference", actorEmail, { id: rows[0]!.id, organization: body.organization });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
