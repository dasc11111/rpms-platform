/**
 * API Route: GET/POST /api/waste-release-criteria
 * Criterios de Liberación/Dispensa de Residuos Radiactivos (Secciones 27-28 SPRM)
 * Normativa: DS 133/1984 MINSAL · IAEA GSR Part 5 · IAEA SSG-45 · CCHEN
 *
 * IMPORTANTE: Estos son criterios de DISPENSA/LIBERACIÓN (umbral bajo el cual
 * un residuo puede liberarse al ambiente sin restricción radiológica). NO deben
 * confundirse con los criterios de CONTROL DE CONTAMINACIÓN en
 * waste_contamination_criteria. Sección 27 del Prompt Maestro Definitivo.
 *
 * Nunca se codifican valores directamente en fórmulas; deben consultarse
 * desde esta tabla configurada por jurisdicción/documento/radionúclido.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteReleaseCriteriaExpert } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureWasteReleaseCriteriaExpert();
  const { searchParams } = new URL(req.url);
  const radionuclideCode = searchParams.get("radionuclide_code");
  const tipoResiduo = searchParams.get("tipo_residuo");
  const soloActivos = searchParams.get("active") !== "false";

  let criteria;
  if (radionuclideCode && tipoResiduo) {
    ({ rows: criteria } = await sql`
      SELECT * FROM waste_release_criteria_expert
      WHERE (radionuclide_code = ${radionuclideCode} OR radionuclide_code IS NULL)
        AND (tipo_residuo = ${tipoResiduo} OR tipo_residuo IS NULL)
      ORDER BY (radionuclide_code IS NULL) ASC, (tipo_residuo IS NULL) ASC, fecha_vigencia_desde DESC NULLS LAST, id DESC
    `);
  } else if (radionuclideCode) {
    ({ rows: criteria } = await sql`
      SELECT * FROM waste_release_criteria_expert
      WHERE radionuclide_code = ${radionuclideCode} OR radionuclide_code IS NULL
      ORDER BY (radionuclide_code IS NULL) ASC, fecha_vigencia_desde DESC NULLS LAST, id DESC
    `);
  } else {
    ({ rows: criteria } = await sql`
      SELECT * FROM waste_release_criteria_expert
      ORDER BY jurisdiccion, documento_fuente, radionuclide_code NULLS LAST, parametro, id DESC
    `);
  }

  const result = soloActivos ? criteria.filter((r: Record<string, unknown>) => r.active) : criteria;
  return NextResponse.json({ criteria: result });
}

export async function POST(req: NextRequest) {
  await ensureWasteReleaseCriteriaExpert();
  const body = await req.json();

  const required = ["documento_fuente", "parametro", "valor", "unidad"];
  for (const field of required) {
    if (body?.[field] === undefined || body?.[field] === null || body?.[field] === "") {
      return NextResponse.json(
        { error: `Falta el campo requerido: ${field}` },
        { status: 400 }
      );
    }
  }

  const valorNum = Number(body.valor);
  if (!Number.isFinite(valorNum)) {
    return NextResponse.json({ error: "El valor debe ser un número válido." }, { status: 400 });
  }

  if (body.radionuclide_code) {
    const { rows: rnRows } = await sql`
      SELECT code FROM radionuclides WHERE code = ${body.radionuclide_code} AND active = true
    `;
    if (rnRows.length === 0) {
      return NextResponse.json(
        { error: "INFORMACION INSUFICIENTE: radionúclido no registrado o inactivo. Valor no insertado." },
        { status: 400 }
      );
    }
  }

  const { rows } = await sql`
    INSERT INTO waste_release_criteria_expert (
      jurisdiccion, documento_fuente, version, fecha_vigencia_desde, fecha_vigencia_hasta,
      radionuclide_code, tipo_residuo, via_eliminacion, parametro, valor, unidad,
      autoridad, condicion_aplicacion, active, notes
    ) VALUES (
      ${body.jurisdiccion ?? "Chile"},
      ${body.documento_fuente},
      ${body.version ?? null},
      ${body.fecha_vigencia_desde ?? null},
      ${body.fecha_vigencia_hasta ?? null},
      ${body.radionuclide_code ?? null},
      ${body.tipo_residuo ?? null},
      ${body.via_eliminacion ?? null},
      ${body.parametro},
      ${valorNum},
      ${body.unidad},
      ${body.autoridad ?? null},
      ${body.condicion_aplicacion ?? null},
      ${body.active ?? true},
      ${body.notes ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json({ criterion: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureWasteReleaseCriteriaExpert();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });

  if (updates.active !== undefined) {
    const { rows } = await sql`
      UPDATE waste_release_criteria_expert
      SET active = ${Boolean(updates.active)}, updated_at = now()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ criterion: rows[0] });
  }

  return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
}
