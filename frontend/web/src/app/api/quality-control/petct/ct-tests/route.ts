import { NextRequest, NextResponse } from "next/server";
import {
  listCtTests,
  createCtTest,
  ensureCtTestsTables,
  type CtTestCode,
} from "@/lib/qc-petct-ct-tests-db";
import {
  calculateCt01,
  calculateCt02,
  calculateCt03,
  calculateCt04,
  calculateCt05,
  calculateCt06,
  calculateCt07,
  calculateCt08,
  calculateCt09,
  calculateCt10,
  calculateCt11,
  calculateCt12,
  calculateCt13,
  calculateCt14,
  type CtAcceptanceStatus,
  type CtActionLevel,
} from "@/lib/qc-petct-calc";

/**
 * MODULO 4 - PET/CT - FASE C
 * API de resultados de las pruebas CT-01 a CT-14 (seccion 19 del prompt de
 * mejora). GET lista/filtra registros. POST crea un registro nuevo: el
 * cliente envia unicamente los datos medidos (raw_inputs) y el motor de
 * calculo (qc-petct-calc.ts) determina calculated/status/action_level - el
 * operador nunca clasifica el resultado manualmente (seccion 3 del prompt
 * maestro).
 */

const VALID_TEST_CODES: CtTestCode[] = [
  "CT-01", "CT-02", "CT-03", "CT-04", "CT-05", "CT-06", "CT-07",
  "CT-08", "CT-09", "CT-10", "CT-11", "CT-12", "CT-13", "CT-14",
];

function computeForTestCode(
  testCode: CtTestCode,
  rawInputs: Record<string, any>
): { calculated: Record<string, unknown>; status: CtAcceptanceStatus; actionLevel: CtActionLevel } {
  switch (testCode) {
    case "CT-01": {
      const out = calculateCt01({
        measuredDoseRateUSvH: Number(rawInputs.measuredDoseRateUSvH),
        doseRateLimitUSvH: Number(rawInputs.doseRateLimitUSvH),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-02": {
      const out = calculateCt02({
        laserDeviationMm: Number(rawInputs.laserDeviationMm),
        toleranceMm: Number(rawInputs.toleranceMm),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-03": {
      const out = calculateCt03({
        tablePositionErrorMm: Number(rawInputs.tablePositionErrorMm),
        toleranceMm: Number(rawInputs.toleranceMm),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-04": {
      const out = calculateCt04({
        scoutViewErrorMm: Number(rawInputs.scoutViewErrorMm),
        toleranceMm: Number(rawInputs.toleranceMm),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-05": {
      const out = calculateCt05({
        visualInspection: rawInputs.visualInspection,
        safetyInterlocks: rawInputs.safetyInterlocks,
        tableMotion: rawInputs.tableMotion,
        gantryMotion: rawInputs.gantryMotion,
        softwareVersion: rawInputs.softwareVersion,
      });
      return { calculated: { ...out }, status: out.status, actionLevel: "normal" };
    }
    case "CT-06": {
      const out = calculateCt06({
        measuredSliceWidthMm: Number(rawInputs.measuredSliceWidthMm),
        nominalSliceWidthMm: Number(rawInputs.nominalSliceWidthMm),
        tolerancePercent: Number(rawInputs.tolerancePercent),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-07": {
      const out = calculateCt07({
        observedResolutionLpCm: Number(rawInputs.observedResolutionLpCm),
        expectedResolutionLpCm: Number(rawInputs.expectedResolutionLpCm),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-08": {
      const out = calculateCt08({
        kvpMeasured: Number(rawInputs.kvpMeasured),
        kvpNominal: Number(rawInputs.kvpNominal),
        kvpTolerancePercent: Number(rawInputs.kvpTolerancePercent),
        hvlMeasuredMmAl: Number(rawInputs.hvlMeasuredMmAl),
        hvlExpectedMmAl: Number(rawInputs.hvlExpectedMmAl),
        hvlTolerancePercent: Number(rawInputs.hvlTolerancePercent),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-09": {
      const out = calculateCt09({
        ctdivolMeasuredMgy: Number(rawInputs.ctdivolMeasuredMgy),
        ctdivolReferenceMgy: Number(rawInputs.ctdivolReferenceMgy),
        dlpMeasuredMgyCm: Number(rawInputs.dlpMeasuredMgyCm),
        dlpReferenceMgyCm: Number(rawInputs.dlpReferenceMgyCm),
        tolerancePercent: Number(rawInputs.tolerancePercent),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-10": {
      const out = calculateCt10({
        measuredNoiseSdHu: Number(rawInputs.measuredNoiseSdHu),
        expectedNoiseSdHu: Number(rawInputs.expectedNoiseSdHu),
        tolerancePercent: Number(rawInputs.tolerancePercent),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-11": {
      const peripheral = Array.isArray(rawInputs.peripheralRoiHu)
        ? rawInputs.peripheralRoiHu.map((v: unknown) => Number(v))
        : [];
      const out = calculateCt11({
        centralRoiHu: Number(rawInputs.centralRoiHu),
        peripheralRoiHu: peripheral,
        toleranceHu: Number(rawInputs.toleranceHu),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-12": {
      const out = calculateCt12({ artifactType: rawInputs.artifactType });
      return {
        calculated: { ...out },
        status: out.status,
        actionLevel: out.status === "cumple" ? "normal" : "advertencia",
      };
    }
    case "CT-13": {
      const out = calculateCt13({
        materialMeasuredHu: Number(rawInputs.materialMeasuredHu),
        materialExpectedHu: Number(rawInputs.materialExpectedHu),
        toleranceHu: Number(rawInputs.toleranceHu),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    case "CT-14": {
      const out = calculateCt14({
        notApplicable: Boolean(rawInputs.notApplicable),
        measuredElectronDensityRatio: Number(rawInputs.measuredElectronDensityRatio),
        referenceElectronDensityRatio: Number(rawInputs.referenceElectronDensityRatio),
        tolerancePercent: Number(rawInputs.tolerancePercent),
      });
      return { calculated: { ...out }, status: out.status, actionLevel: out.actionLevel };
    }
    default:
      throw new Error(`Codigo de prueba CT no soportado: ${testCode}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureCtTestsTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipment_id");
    const testCode = searchParams.get("test_code");

    const tests = await listCtTests({
      equipment_id: equipmentId ? Number(equipmentId) : undefined,
      test_code: testCode ? (testCode as CtTestCode) : undefined,
    });
    return NextResponse.json(tests);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/ct-tests:", error);
    return NextResponse.json({ error: "Error al obtener los resultados de pruebas CT" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCtTestsTables();
    const body = await request.json();
    const { test_code, equipment_id, raw_inputs, ...rest } = body;

    if (!test_code || !VALID_TEST_CODES.includes(test_code)) {
      return NextResponse.json({ error: "test_code invalido. Debe ser CT-01 a CT-14." }, { status: 400 });
    }
    if (!rest.operator) {
      return NextResponse.json({ error: "Falta el operador que realizo la prueba" }, { status: 400 });
    }

    const { calculated, status, actionLevel } = computeForTestCode(test_code, raw_inputs ?? {});

    const created = await createCtTest({
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
    console.error("Error en POST /api/quality-control/petct/ct-tests:", error);
    return NextResponse.json({ error: "Error al registrar el resultado de la prueba CT" }, { status: 500 });
  }
}
