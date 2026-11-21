import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, listBlindajeMaterials, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// MATERIALES (S22): biblioteca compartida de materiales de blindaje
// (hormigon, plomo, acero, ladrillo, tierra, vidrio plomado, acero
// pesado, etc). No esta asociada a un proyecto especifico. Cada
// material se registra con densidad, HVL, TVL, metodo y su fuente
// documental (norma/pagina), sin inventar valores (S55, S61).
export async function GET(request: NextRequest) {
  await ensureBlindajeTables();
  const materials = await listBlindajeMaterials();
  return NextResponse.json({ ok: true, materials });
}

export async function POST(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ ok: false, error: "El nombre del material es obligatorio." }, { status: 400 });
  }
  if (!body.source_document || !String(body.source_document).trim()) {
    return NextResponse.json({ ok: false, error: "La fuente documental del material es obligatoria (S33, S55)." }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO blindaje_materials (
name, density, density_unit, hvl, tvl, method, application_range,
source_document, source_page
) VALUES (
${body.name}, ${body.density || null}, ${body.density_unit || "g/cm3"}, ${body.hvl || null}, ${body.tvl || null},
${body.method || null}, ${body.application_range || null}, ${body.source_document}, ${body.source_page || null}
)
RETURNING *
`;
  const material = rows[0];
  if (!material) {
    return NextResponse.json({ ok: false, error: "No se pudo guardar el material." }, { status: 500 });
  }

await logBlindajeAudit(
  "blindaje_materials",
  material.id,
  null,
  null,
  JSON.stringify(material),
  body.user_name || null,
  "Alta de material en biblioteca compartida (S22)",
  null
  );

return NextResponse.json({ ok: true, material });
}
