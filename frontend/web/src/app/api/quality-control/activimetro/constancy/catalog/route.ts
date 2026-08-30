import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { listActivimetroRadionuclides } from "@/lib/qc-activimetro-architecture-db";
import { getConstanciaTolerance, getConstanciaBaselineInfo } from "@/lib/qc-activimetro-constancy-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-06
 * Catalogo de apoyo para el formulario: instrumentos, radionucleidos
 * configurables (opcional), tolerancia vigente (puede ser NULL: no se
 * inventa) y, si se indica ?instrument_id=, informacion del baseline
 * vigente del equipo vinculado (si existe ficha tecnica en
 * qc_activimetro_equipment).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instrumentIdParam = searchParams.get("instrument_id");

    const { rows: instruments } = await sql`SELECT id, code, name FROM instruments ORDER BY name ASC;`;
    const radionuclides = await listActivimetroRadionuclides();
    const tolerance = await getConstanciaTolerance();
    const baselineInfo = instrumentIdParam ? await getConstanciaBaselineInfo(Number(instrumentIdParam)) : null;

    return NextResponse.json({ instruments, radionuclides, tolerance, baselineInfo });
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/constancy/catalog:", error);
    return NextResponse.json({ error: "Error al obtener el catalogo de constancia" }, { status: 500 });
  }
}
