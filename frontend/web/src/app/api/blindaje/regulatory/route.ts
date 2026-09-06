import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureBlindajeTables,
  listBlindajeRegulatoryParameters,
  listBlindajeMaterials,
  addBlindajeAudit,
} from "@/lib/blindaje";

// MODULO: BLINDAJE Y DISENO - Motor Regulatorio (S6).
// Ningun valor normativo vive en el codigo: se lee/escribe aqui, siempre
// con norma, version, fuente y pagina (S55, S61).
export async function GET(request: NextRequest) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "parameters";
  const modality = searchParams.get("modality") || undefined;

if (type === "materials") {
  const materials = await listBlindajeMaterials();
  return NextResponse.json({ ok: true, materials });
}

const parameters = await listBlindajeRegulatoryParameters(modality);
  return NextResponse.json({ ok: true, parameters });
}

export async function POST(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();

if (!body.source_document) {
  return NextResponse.json(
    { ok: false, error: "source_document es obligatorio (S55/S61): toda entrada regulatoria debe citar su fuente." },
    { status: 400 }
    );
}

if (body.type === "material") {
  const rows = await sql`
  INSERT INTO blindaje_materials (
  name, density, density_unit, hvl, tvl, coefficients, method,
  application_range, source_document, source_page
  ) VALUES (
  ${body.name}, ${body.density || null}, ${body.density_unit || 'g/cm3'},
  ${body.hvl || null}, ${body.tvl || null}, ${JSON.stringify(body.coefficients || {})},
  ${body.method || null}, ${body.application_range || null},
  ${body.source_document}, ${body.source_page || null}
  ) RETURNING *;
  `;
  await addBlindajeAudit({
    entity_type: "blindaje_materials",
    entity_id: rows[0].id,
    field_name: "create",
    new_value: body.name,
    user_name: body.user_name || null,
    reason: "Alta de material con fuente citada",
  });
  return NextResponse.json({ ok: true, material: rows[0] });
}

const rows = await sql`
INSERT INTO blindaje_regulatory_parameters (
norma, version, effective_date, parameter_name, value, unit, modality,
applicability, source_document, source_page, source_section, notes
) VALUES (
${body.norma}, ${body.version || null}, ${body.effective_date || null},
${body.parameter_name}, ${body.value || null}, ${body.unit || null},
${body.modality || null}, ${body.applicability || null},
${body.source_document}, ${body.source_page || null},
${body.source_section || null}, ${body.notes || null}
) RETURNING *;
`;
  await addBlindajeAudit({
    entity_type: "blindaje_regulatory_parameters",
    entity_id: rows[0].id,
    field_name: "create",
    new_value: body.parameter_name,
    user_name: body.user_name || null,
    reason: "Alta de parametro regulatorio con fuente citada",
  });
  return NextResponse.json({ ok: true, parameter: rows[0] });
}
