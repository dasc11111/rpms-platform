import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

// Fase C - Matriz de calibracion (Seccion 18 del Prompt Maestro Definitivo):
// Detector x Radionuclido x Geometria x Distancia x Eficiencia/Factor de
// calibracion x Vigencia. Nunca se asume una calibracion universal: cada
// entrada es especifica y debe consultarse por radionuclido/geometria.

export async function GET(request: Request) {
    await ensureWasteExpertSchema();
    const { searchParams } = new URL(request.url);
    const radionuclideCode = searchParams.get("radionuclide_code");
    const soloVigentes = searchParams.get("vigente") === "true";

    const { rows } = radionuclideCode
      ? soloVigentes
        ? await sql`SELECT * FROM waste_calibration_matrix WHERE radionuclide_code = ${radionuclideCode} AND vigente = true ORDER BY fecha_calibracion DESC`
        : await sql`SELECT * FROM waste_calibration_matrix WHERE radionuclide_code = ${radionuclideCode} ORDER BY fecha_calibracion DESC`
      : soloVigentes
        ? await sql`SELECT * FROM waste_calibration_matrix WHERE vigente = true ORDER BY fecha_calibracion DESC`
        : await sql`SELECT * FROM waste_calibration_matrix ORDER BY fecha_calibracion DESC`;

    return NextResponse.json({ calibrations: rows });
  }

export async function POST(request: Request) {
    await ensureWasteExpertSchema();
    const body = await request.json();

    const required = ["instrumento", "radionuclide_code", "metodo"];
    for (const field of required) {
          if (!body?.[field]) {
                  return NextResponse.json({ error: `Falta el campo requerido: ${field}` }, { status: 400 });
                }
        }
    if (body.metodo !== "eficiencia" && body.metodo !== "factor_calibracion") {
          return NextResponse.json({ error: "metodo debe ser 'eficiencia' o 'factor_calibracion'" }, { status: 400 });
        }
    if (body.metodo === "eficiencia" && (body.eficiencia === undefined || body.eficiencia === null)) {
          return NextResponse.json({ error: "Falta 'eficiencia' para el metodo seleccionado" }, { status: 400 });
        }
    if (body.metodo === "factor_calibracion" && (body.factor_calibracion === undefined || body.factor_calibracion === null)) {
          return NextResponse.json({ error: "Falta 'factor_calibracion' para el metodo seleccionado" }, { status: 400 });
        }

    const { rows: rnRows } = await sql`SELECT code FROM radionuclides WHERE code = ${body.radionuclide_code} AND active = true`;
    if (rnRows.length === 0) {
          return NextResponse.json(
                  { error: "INFORMACION INSUFICIENTE PARA UNA DECISION: radionuclido no registrado o inactivo. No se invento ningun valor." },
                  { status: 400 }
                );
        }

    const { rows } = await sql`
      INSERT INTO waste_calibration_matrix (
              instrumento, radionuclide_code, geometria, distancia_cm, metodo,
              eficiencia, factor_calibracion, area_efectiva_cm2, fecha_calibracion,
              fecha_vigencia_hasta, vigente, documento_fuente, notes
            ) VALUES (
              ${body.instrumento}, ${body.radionuclide_code}, ${body.geometria ?? null}, ${body.distancia_cm ?? null}, ${body.metodo},
              ${body.eficiencia ?? null}, ${body.factor_calibracion ?? null}, ${body.area_efectiva_cm2 ?? null}, ${body.fecha_calibracion ?? null},
              ${body.fecha_vigencia_hasta ?? null}, ${body.vigente ?? true}, ${body.documento_fuente ?? null}, ${body.notes ?? null}
            )
      RETURNING *
    `;

    return NextResponse.json({ calibration: rows[0] }, { status: 201 });
  }
