import { NextRequest, NextResponse } from "next/server";
import {
  listJointTests,
  createJointTest,
  ensureJointTestsTables,
  type JointTestCode,
} from "@/lib/qc-petct-joint-tests-db";
import {
  calculatePetCt01,
  calculatePetCt02,
  type CtAcceptanceStatus,
  type CtActionLevel,
} from "@/lib/qc-petct-calc";

/**
 * MODULO 4 - PET/CT - FASE D
 * API de resultados de las pruebas de interaccion PET/CT (PETCT-01 y
 * PETCT-02, secciones 6 y 14 del prompt de mejora). GET lista/filtra
 * registros. POST crea un registro nuevo: el cliente envia unicamente los
 * datos medidos (raw_inputs) y el motor de calculo determina
 * calculated/status/action_level - el operador nunca clasifica el resultado
 * manualmente (seccion 3 del prompt maestro).
 */

const VALID_TEST_CODES: JointTestCode[] = ["PETCT-01", "PETCT-02"];

function computeForTestCode(
  testCode: JointTestCode,
  rawInputs: Record<string, any>
): { calculated: Record<string, unknown>; status: CtAcceptanceStatus; actionLevel: CtActionLevel } {
  switch (testCode) {
    case "PETCT-01": {
      const out = calculatePetCt01({
        voxelSizeMm: Number(rawInputs.voxelSizeMm),
        displacementXMm: Number(rawInputs.displacementXMm),
        displacementYMm: Number(rawInputs.displacementYMm),
        displacementZMm: Number(rawInputs.displacementZMm),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "PETCT-02": {
      const num = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number(v));
      const out = calculatePetCt02({
        offsetXMm: Number(rawInputs.offsetXMm),
        offsetYMm: Number(rawInputs.offsetYMm),
        offsetZMm: Number(rawInputs.offsetZMm),
        toleranceMm: Number(rawInputs.toleranceMm),
        previousOffsetXMm: num(rawInputs.previousOffsetXMm),
        previousOffsetYMm: num(rawInputs.previousOffsetYMm),
        previousOffsetZMm: num(rawInputs.previousOffsetZMm),
        baselineOffsetXMm: num(rawInputs.baselineOffsetXMm),
        baselineOffsetYMm: num(rawInputs.baselineOffsetYMm),
        baselineOffsetZMm: num(rawInputs.baselineOffsetZMm),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    default:
      throw new Error(`Codigo de prueba PET/CT no soportado: ${testCode}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureJointTestsTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipment_id");
    const testCode = searchParams.get("test_code");

    const tests = await listJointTests({
      equipment_id: equipmentId ? Number(equipmentId) : undefined,
      test_code: testCode ? (testCode as JointTestCode) : undefined,
    });
    return NextResponse.json(tests);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/joint-tests:", error);
    return NextResponse.json({ error: "Error al obtener los resultados de pruebas PET/CT" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureJointTestsTables();
    const body = await request.json();
    const { test_code, equipment_id, raw_inputs, ...rest } = body;

    if (!test_code || !VALID_TEST_CODES.includes(test_code)) {
      return NextResponse.json({ error: "test_code invalido. Debe ser PETCT-01 o PETCT-02." }, { status: 400 });
    }
    if (!rest.operator) {
      return NextResponse.json({ error: "Falta el operador que realizo la prueba" }, { status: 400 });
    }

    const { calculated, status, actionLevel } = computeForTestCode(test_code, raw_inputs ?? {});

    const created = await createJointTest({
      equipment_id: equipment_id ? Number(equipment_id) : null,
      test_code,
      raw_inputs: raw_inputs ?? {},
      calculated,
      status,
      action_level: actionLevel,
      ...rest,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/petct/joint-tests:", error);
    return NextResponse.json({ error: "Error al registrar el resultado de la prueba PET/CT" }, { status: 500 });
  }
}
