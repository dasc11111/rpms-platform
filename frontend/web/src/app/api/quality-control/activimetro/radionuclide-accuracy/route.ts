import { NextRequest, NextResponse } from "next/server";
import {
  listExactitudRadionuclidoTests,
  createExactitudRadionuclidoTest,
} from "@/lib/qc-activimetro-radionuclide-accuracy-db";

/**
* MODULO ACTIVIMETRO - ACTIV-05: Exactitud por radionuclido
* GET: lista pruebas registradas (opcional ?instrument_id=N&radionuclide=SYM).
* POST: registra una nueva prueba con sus lecturas.
*/
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instrumentId = searchParams.get("instrument_id");
    const radionuclide = searchParams.get("radionuclide");
    const tests = await listExactitudRadionuclidoTests(
      instrumentId ? Number(instrumentId) : undefined,
      radionuclide ?? undefined
      );
    return NextResponse.json(tests);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/radionuclide-accuracy:", error);
    return NextResponse.json({ error: "Error al obtener las pruebas de exactitud por radionuclido" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const test = await createExactitudRadionuclidoTest(body);
    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/activimetro/radionuclide-accuracy:", error);
    const messageText = error instanceof Error ? error.message : "Error al registrar la prueba de exactitud por radionuclido";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
