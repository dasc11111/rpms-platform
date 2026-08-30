import { NextRequest, NextResponse } from "next/server";
import {
  setActivimetroBaseline,
  getCurrentActivimetroBaseline,
  listActivimetroBaselineHistory,
  ensureActivimetroArchitectureTables,
} from "@/lib/qc-activimetro-architecture-db";

/**
 * MODULO ACTIVIMETRO - FASE C
 * API del baseline del equipo (seccion 28 del prompt maestro). El baseline
 * es el valor de referencia de un parametro para una prueba dada,
 * establecido en la aceptacion o recomisionamiento del equipo. Nunca se
 * sobrescribe: al establecer un nuevo valor el anterior se conserva
 * (is_current = false) y queda enlazado via previous_baseline_id, junto
 * con el motivo, usuario y fecha del cambio.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipmentId");
    const testCode = searchParams.get("testCode");
    const parameterName = searchParams.get("parameterName");
    const history = searchParams.get("history") === "true";

    if (!testCode || !parameterName) {
      return NextResponse.json({ error: "Se requieren testCode y parameterName" }, { status: 400 });
    }

    const eqId = equipmentId ? Number(equipmentId) : null;

    if (history) {
      const rows = await listActivimetroBaselineHistory(eqId, testCode, parameterName);
      return NextResponse.json(rows);
    }

    const current = await getCurrentActivimetroBaseline(eqId, testCode, parameterName);
    return NextResponse.json(current);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/baseline:", error);
    return NextResponse.json({ error: "Error al obtener el baseline" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const body = await request.json();

    if (!body.test_code || !body.parameter_name) {
      return NextResponse.json({ error: "Se requieren test_code y parameter_name" }, { status: 400 });
    }

    const baseline = await setActivimetroBaseline({
      equipment_id: body.equipment_id ?? null,
      test_code: body.test_code,
      parameter_name: body.parameter_name,
      value: body.value ?? null,
      unit: body.unit ?? null,
      radionuclide: body.radionuclide ?? null,
      geometry: body.geometry ?? null,
      operator: body.operator ?? null,
      physicist_responsible: body.physicist_responsible ?? null,
      change_reason: body.change_reason ?? null,
      changed_by: body.changed_by ?? null,
    });

    return NextResponse.json(baseline, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/activimetro/baseline:", error);
    return NextResponse.json({ error: "Error al establecer el baseline" }, { status: 500 });
  }
}
