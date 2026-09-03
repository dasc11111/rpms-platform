import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

// Fase C - Criterios de contaminacion superficial configurables (Secciones
                                                                  // 8-9, 27-28 del Prompt Maestro Definitivo). Tabla configurable por
// jurisdiccion/documento/version/vigencia, radionuclido y tipo de superficie.
// NUNCA se codifican valores directamente en formulas (seccion 9, 44).
// IMPORTANTE (seccion 27): estos son criterios de CONTROL DE CONTAMINACION,
// no deben confundirse con criterios de DISPENSA/LIBERACION (ver tabla
                                                              // separada waste_release_criteria_expert).

export async function GET(request: Request) {
    await ensureWasteExpertSchema();
    const { searchParams } = new URL(request.url);
    const tipoSuperficie = searchParams.get("tipo_superficie");
    const radionuclideCode = searchParams.get("radionuclide_code");
    const soloActivos = searchParams.get("active") !== "false";

    const { rows } = await sql`
      SELECT * FROM waste_contamination_criteria
      WHERE (${tipoSuperficie}::text IS NULL OR tipo_superficie = ${tipoSuperficie})
        AND (${radionuclideCode}::text IS NULL OR radionuclide_code = ${radionuclideCode} OR radionuclide_code IS NULL)
      ORDER BY (radionuclide_code IS NULL) ASC, id DESC
    `;
    const criteria = soloActivos ? rows.filter((r: any) => r.active) : rows;

    return NextResponse.json({ criteria });
  }

export async function POST(request: Request) {
    await ensureWasteExpertSchema();
    const body = await request.json();

    const required = ["documento_fuente", "tipo_superficie", "valor"];
    for (const field of required) {
          if (body?.[field] === undefined || body?.[field] === null || body?.[field] === "") {
                  return NextResponse.json({ error: `Falta el campo requerido: ${field}` }, { status: 400 });
                }
        }

    const { rows } = await sql`
      INSERT INTO waste_contamination_criteria (
              jurisdiccion, documento_fuente, version, fecha_vigencia_desde, fecha_vigencia_hasta,
              clase, radionuclide_code, tipo_superficie, tipo_criterio, parametro, valor, unidad,
              condicion_aplicacion, active, notes
            ) VALUES (
              ${body.jurisdiccion ?? "Chile"}, ${body.documento_fuente}, ${body.version ?? null}, ${body.fecha_vigencia_desde ?? null}, ${body.fecha_vigencia_hasta ?? null},
              ${body.clase ?? null}, ${body.radionuclide_code ?? null}, ${body.tipo_superficie}, ${body.tipo_criterio ?? "contaminacion"}, ${body.parametro ?? "bq_cm2"}, ${body.valor}, ${body.unidad ?? "Bq/cm2"},
              ${body.condicion_aplicacion ?? null}, ${body.active ?? true}, ${body.notes ?? null}
            )
      RETURNING *
    `;

    return NextResponse.json({ criterio: rows[0] }, { status: 201 });
  }
