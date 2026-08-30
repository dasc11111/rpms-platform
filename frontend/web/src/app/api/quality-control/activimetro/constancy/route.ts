import { NextRequest, NextResponse } from "next/server";
import { listConstanciaTests, createConstanciaTest } from "@/lib/qc-activimetro-constancy-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-06: Constancia
 * GET: lista pruebas registradas (opcional ?instrument_id=N).
 * POST: registra una nueva prueba con sus lecturas, comparando contra el
 * baseline vigente del equipo (si existe) y la prueba anterior.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instrumentId = searchParams.get("instrument_id");
    const tests = await listConstanciaTests(instrumentId ? Number(instrumentId) : undefined);
    return NextResponse.json(tests);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/constancy:", error);
    return NextResponse.json({ error: "Error al obtener las pruebas de constancia" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const test = await createConstanciaTest(body);
    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/activimetro/constancy:", error);
    const messageText = error instanceof Error ? error.message : "Error al registrar la prueba de constancia";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
