import { NextRequest, NextResponse } from "next/server";
import {
  listPetTests,
  createPetTest,
  ensurePetTestsTables,
  type PetTestCode,
} from "@/lib/qc-petct-pet-tests-db";
import { getPetCtEquipmentById } from "@/lib/qc-petct-equipment-db";
import {
  calculatePet01,
  calculatePet02,
  calculatePet03,
  calculatePet04,
  calculatePet05,
  calculatePet06,
  type PetAcceptanceStatus,
  type PetActionLevel,
} from "@/lib/qc-petct-calc";

/**
 * MODULO 4 - PET/CT - FASE B
 * API de resultados de las pruebas PET-01 a PET-06 (seccion 5 del prompt de
 * mejora). GET lista/filtra registros. POST crea un registro nuevo: el
 * cliente envia unicamente los datos medidos (raw_inputs) y el motor de
 * calculo (qc-petct-calc.ts) determina calculated/status/action_level -
 * el operador nunca clasifica el resultado manualmente (seccion 3 del
 * prompt maestro). Para PET-06, el flag hasTof se obtiene siempre de la
 * ficha del equipo (petct_equipment.has_tof), nunca del cliente, para que
 * NO APLICA sea una consecuencia de la configuracion real del equipo.
 */

const VALID_TEST_CODES: PetTestCode[] = ["PET-01", "PET-02", "PET-03", "PET-04", "PET-05", "PET-06"];

function computeForTestCode(
  testCode: PetTestCode,
  rawInputs: Record<string, any>,
  hasTof: boolean
): { calculated: Record<string, unknown>; status: PetAcceptanceStatus; actionLevel: PetActionLevel } {
  switch (testCode) {
    case "PET-01": {
      const out = calculatePet01({
        fwhmObservedMm: Number(rawInputs.fwhmObservedMm),
        fwhmExpectedMm: Number(rawInputs.fwhmExpectedMm),
      });
      return { calculated: out, status: out.status, actionLevel: out.actionLevel };
    }
    case "PET-02": {
      const out = calculatePet02({
        sTotObservedCps: Number(rawInputs.sTotObservedCps),
        sTotExpectedCps: Number(rawInputs.sTotExpectedCps),
      });
      return { calculated: out, status: out.status, actionLevel: out.actionLevel };
    }
    case "PET-03": {
      const out = calculatePet03({
        scatterFractionObserved: Number(rawInputs.scatterFractionObserved),
        scatterFractionExpected: Number(rawInputs.scatterFractionExpected),
        trueCountRateKcps: Number(rawInputs.trueCountRateKcps),
        randomCountRateKcps: Number(rawInputs.randomCountRateKcps),
        scatterCountRateKcps: Number(rawInputs.scatterCountRateKcps),
        necObservedKcps: Number(rawInputs.necObservedKcps),
        necRecommendedKcps: Number(rawInputs.necRecommendedKcps),
        activityMbq: Number(rawInputs.activityMbq),
      });
      return { calculated: out, status: out.status, actionLevel: out.actionLevel };
    }
    case "PET-04": {
      const out = calculatePet04({
        energyResolutionObservedPercent: Number(rawInputs.energyResolutionObservedPercent),
        energyResolutionExpectedPercent: Number(rawInputs.energyResolutionExpectedPercent),
      });
      return { calculated: out, status: out.status, actionLevel: out.actionLevel };
    }
    case "PET-05": {
      const out = calculatePet05({
        uniformity: rawInputs.uniformity,
        contrast: rawInputs.contrast,
        recovery: rawInputs.recovery,
        artifacts: rawInputs.artifacts,
        concentrationAccuracy: rawInputs.concentrationAccuracy,
        sphereBehavior: rawInputs.sphereBehavior,
        attenuationScatterCorrection: rawInputs.attenuationScatterCorrection,
      });
      return { calculated: out, status: out.status, actionLevel: "normal" };
    }
    case "PET-06": {
      const out = calculatePet06({
        hasTof,
        timingResolutionObservedPs: Number(rawInputs.timingResolutionObservedPs),
        timingResolutionExpectedPs: Number(rawInputs.timingResolutionExpectedPs),
      });
      return { calculated: out, status: out.status, actionLevel: out.actionLevel };
    }
    default:
      throw new Error(`Codigo de prueba PET no soportado: ${testCode}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensurePetTestsTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipment_id");
    const testCode = searchParams.get("test_code");

    const tests = await listPetTests({
      equipment_id: equipmentId ? Number(equipmentId) : undefined,
      test_code: testCode ? (testCode as PetTestCode) : undefined,
    });
    return NextResponse.json(tests);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/pet-tests:", error);
    return NextResponse.json({ error: "Error al obtener los resultados de pruebas PET" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePetTestsTables();
    const body = await request.json();
    const { test_code, equipment_id, raw_inputs, ...rest } = body;

    if (!test_code || !VALID_TEST_CODES.includes(test_code)) {
      return NextResponse.json({ error: "test_code invalido. Debe ser PET-01 a PET-06." }, { status: 400 });
    }
    if (!rest.operator) {
      return NextResponse.json({ error: "Falta el operador que realizo la prueba" }, { status: 400 });
    }

    let hasTof = false;
    if (equipment_id) {
      const equipment = await getPetCtEquipmentById(Number(equipment_id));
      hasTof = equipment?.has_tof ?? false;
    }

    const { calculated, status, actionLevel } = computeForTestCode(test_code, raw_inputs ?? {}, hasTof);

    const created = await createPetTest({
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
    console.error("Error en POST /api/quality-control/petct/pet-tests:", error);
    return NextResponse.json({ error: "Error al registrar el resultado de la prueba PET" }, { status: 500 });
  }
}
