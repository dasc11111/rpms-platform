import { NextRequest, NextResponse } from "next/server";
import {
  setPetCtBaseline,
  getCurrentBaseline,
  listBaselineHistory,
  ensurePetCtArchitectureTables,
} from "@/lib/qc-petct-architecture-db";

/**
 * MODULO 4 - PET/CT - FASE A
 * API del baseline del equipo (seccion 28 del prompt de mejora).
 * GET ?equipmentId=&testCode=&parameterName=&history=true devuelve el
 * historico completo; sin history=true devuelve solo el baseline vigente.
 * POST establece un nuevo baseline: el anterior se conserva (is_current =
 * false), nunca se elimina. change_reason y changed_by quedan registrados.
 */
export async function GET(request: NextRequest) {
  try {
    await ensurePetCtArchitectureTables();
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
      const rows = await listBaselineHistory(eqId, testCode, parameterName);
      return NextResponse.json(rows);
    }

    const current = await getCurrentBaseline(eqId, testCode, parameterName);
    return NextResponse.json(current);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/baseline:", error);
    return NextResponse.json({ error: "Error al obtener el baseline PET/CT" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePetCtArchitectureTables();
    const body = await request.json();

    if (!body.test_code || !body.parameter_name) {
      return NextResponse.json({ error: "Se requieren test_code y parameter_name" }, { status: 400 });
    }

    const baseline = await setPetCtBaseline({
      equipment_id: body.equipment_id ?? null,
      test_code: body.test_code,
      parameter_name: body.parameter_name,
      value: body.value ?? null,
      unit: body.unit ?? null,
      methodology: body.methodology ?? null,
      phantom: body.phantom ?? null,
      activity: body.activity ?? null,
      protocol: body.protocol ?? null,
      reconstruction: body.reconstruction ?? null,
      operator: body.operator ?? null,
      physicist_responsible: body.physicist_responsible ?? null,
      change_reason: body.change_reason ?? null,
      changed_by: body.changed_by ?? null,
    });

    return NextResponse.json(baseline, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/petct/baseline:", error);
    return NextResponse.json({ error: "Error al establecer el baseline PET/CT" }, { status: 500 });
  }
}
