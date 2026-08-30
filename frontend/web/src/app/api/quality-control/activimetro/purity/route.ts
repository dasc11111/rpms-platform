import { NextRequest, NextResponse } from "next/server";
import { listPurityTests, createPurityTest, reviewAndValidatePurityTest } from "@/lib/qc-activimetro-purity-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-07: Pureza radionucleidica de 99mTc
 * GET: lista pruebas registradas (opcional ?instrument_id=N).
 * POST: registra una nueva prueba guiada de 12 pasos.
 * PATCH: paso 11 (revision) y paso 12 (validacion) sobre una prueba ya
 * registrada, sin sobrescribir las mediciones originales.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instrumentId = searchParams.get("instrument_id");
    const tests = await listPurityTests(instrumentId ? Number(instrumentId) : undefined);
    return NextResponse.json(tests);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/purity:", error);
    return NextResponse.json({ error: "Error al obtener las pruebas de pureza radionucleidica" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const test = await createPurityTest(body);
    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/activimetro/purity:", error);
    const messageText = error instanceof Error ? error.message : "Error al registrar la prueba de pureza radionucleidica";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const test = await reviewAndValidatePurityTest(body);
    return NextResponse.json(test);
  } catch (error) {
    console.error("Error en PATCH /api/quality-control/activimetro/purity:", error);
    const messageText = error instanceof Error ? error.message : "Error al revisar/validar la prueba";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
