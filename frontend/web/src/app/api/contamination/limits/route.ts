import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Limites de contaminacion superficial configurables por radionuclido (ver
// src/app/api/init/route.ts para el detalle de la tabla y las notas sobre
// validacion normativa). Este endpoint permite consultarlos y editarlos desde
// el panel "Limites" del modulo, sin necesidad de modificar el codigo.
export async function GET() {
  const { rows } = await sql`
  SELECT id, radionuclido, limite_bq_m2, pct_registro, pct_investigacion, pct_intervencion, unidad, notas, updated_at
  FROM contamination_limits
  ORDER BY radionuclido ASC
  `;
  return NextResponse.json({ rows });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const radionuclido = (body.radionuclido ?? "").toString().trim().toUpperCase();
  if (!radionuclido) {
    return NextResponse.json({ error: "radionuclido es requerido" }, { status: 400 });
  }

const limite_bq_m2 = Number(body.limite_bq_m2);
  if (!Number.isFinite(limite_bq_m2) || limite_bq_m2 <= 0) {
    return NextResponse.json({ error: "El límite (Bq/m²) debe ser un número mayor a 0" }, { status: 400 });
  }

const pct_registro = Number(body.pct_registro ?? 5);
  const pct_investigacion = Number(body.pct_investigacion ?? 30);
  const pct_intervencion = Number(body.pct_intervencion ?? 50);
  if (!(pct_registro < pct_investigacion && pct_investigacion < pct_intervencion)) {
    return NextResponse.json(
      { error: "Los umbrales deben cumplir % Registro < % Investigación < % Intervención" },
      { status: 400 }
      );
  }

const unidad = (body.unidad ?? "Bq/m2").toString();
  const notas = body.notas ?? null;

const { rows } = await sql`
INSERT INTO contamination_limits (radionuclido, limite_bq_m2, pct_registro, pct_investigacion, pct_intervencion, unidad, notas, updated_at)
VALUES (${radionuclido}, ${limite_bq_m2}, ${pct_registro}, ${pct_investigacion}, ${pct_intervencion}, ${unidad}, ${notas}, now())
ON CONFLICT (radionuclido) DO UPDATE SET
limite_bq_m2 = EXCLUDED.limite_bq_m2,
pct_registro = EXCLUDED.pct_registro,
pct_investigacion = EXCLUDED.pct_investigacion,
pct_intervencion = EXCLUDED.pct_intervencion,
unidad = EXCLUDED.unidad,
notas = EXCLUDED.notas,
updated_at = now()
RETURNING *
`;

return NextResponse.json({ row: rows[0]! });
}
