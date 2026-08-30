import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { listActivimetroRadionuclides } from "@/lib/qc-activimetro-architecture-db";
import { getPurityTolerance } from "@/lib/qc-activimetro-purity-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-07
 * Catalogo de apoyo para el formulario guiado de 12 pasos: instrumentos,
 * radionucleidos configurables (informativo, 99mTc), y la tolerancia
 * vigente del limite de impureza (puede ser NULL: no se inventa).
 */
export async function GET(request: NextRequest) {
  try {
    const { rows: instruments } = await sql`SELECT id, code, name FROM instruments ORDER BY name ASC;`;
    const radionuclides = await listActivimetroRadionuclides();
    const tolerance = await getPurityTolerance();

    return NextResponse.json({ instruments, radionuclides, tolerance });
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/purity/catalog:", error);
    return NextResponse.json({ error: "Error al obtener el catalogo de pureza radionucleidica" }, { status: 500 });
  }
}
