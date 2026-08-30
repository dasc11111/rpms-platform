import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { listActivimetroRadionuclides } from "@/lib/qc-activimetro-architecture-db";
import { getExactitudRadionuclidoTolerance } from "@/lib/qc-activimetro-radionuclide-accuracy-db";

/**
* MODULO ACTIVIMETRO - ACTIV-05
* Catalogo de apoyo para el formulario: instrumentos, radionucleidos
* configurables y tolerancia vigente (nunca se inventan en el frontend).
*/
export async function GET() {
  try {
    const { rows: instruments } = await sql`SELECT id, code, name FROM instruments ORDER BY name ASC;`;
    const radionuclides = await listActivimetroRadionuclides();
    const tolerance = await getExactitudRadionuclidoTolerance();
    return NextResponse.json({ instruments, radionuclides, tolerance });
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/radionuclide-accuracy/catalog:", error);
    return NextResponse.json({ error: "Error al obtener el catalogo de exactitud por radionuclido" }, { status: 500 });
  }
}
