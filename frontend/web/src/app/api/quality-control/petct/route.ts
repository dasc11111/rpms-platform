import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensurePetCtQcTables, PetCtTestType } from "@/lib/qc-petct-db";
import {
  calculateCrossCalibration,
  calculatePetImageUniformity,
  ResultStatus,
} from "@/lib/qc-petct-calc";

export const dynamic = "force-dynamic";

async function getActiveTolerance(testType: string, parameterName: string) {
  const { rows } = await sql`
    SELECT * FROM qc_petct_tolerances
    WHERE test_type = ${testType} AND parameter_name = ${parameterName} AND active = true
    ORDER BY effective_from DESC, id DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(request: Request) {
  await ensurePetCtQcTables();
  const { searchParams } = new URL(request.url);
  const instrumentId = searchParams.get("instrumentId");
  const testType = searchParams.get("testType");
  const resultStatus = searchParams.get("resultStatus");
  const limit = Number(searchParams.get("limit") || 200);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (instrumentId) {
    params.push(Number(instrumentId));
    conditions.push(`instrument_id = $${params.length}`);
  }
  if (testType) {
    params.push(testType);
    conditions.push(`test_type = $${params.length}`);
  }
  if (resultStatus) {
    params.push(resultStatus);
    conditions.push(`result_status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM qc_petct_tests ${where} ORDER BY test_date DESC, id DESC LIMIT ${Math.min(limit, 2000)}`;
  const { rows } = await sql.query(query, params);

  return NextResponse.json({ tests: rows, total: rows.length });
}

interface ReadingInput {
  value: number;
  label?: string;
  parameter?: string;
  unit?: string;
  elapsedMinutes?: number;
  measuredAt?: string;
  notes?: string;
}

async function insertReadings(testId: number, readings: ReadingInput[]) {
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (!r) continue;
    await sql`
      INSERT INTO qc_petct_readings (
        test_id, reading_index, reading_label, parameter_name, measured_value, unit, elapsed_time_minutes, measured_at, notes
      ) VALUES (
        ${testId}, ${i + 1}, ${r.label || null}, ${r.parameter || null}, ${Number(r.value)}, ${r.unit || null},
        ${r.elapsedMinutes ?? null}, ${r.measuredAt || null}, ${r.notes || null}
      )
    `;
  }
}

export async function POST(request: Request) {
  await ensurePetCtQcTables();
  const body = await request.json();

  const instrumentId = body.instrumentId ? Number(body.instrumentId) : null;
  const instrumentCode = body.instrumentCode || null;
  const instrumentName = body.instrumentName || null;
  const testType = String(body.testType || "").trim() as PetCtTestType;
  const testDate = body.testDate || null;
  const testTime = body.testTime || null;
  const performedBy = body.performedBy || null;
  const oprReviewedBy = body.oprReviewedBy || null;
  const radionuclide = body.radionuclide || "F-18";
  const referenceSource = body.referenceSource || "IAEA Human Health Series No. 1";
  const protocolVersion = body.protocolVersion || "1.0";
  const observaciones = body.observaciones || null;
  const correctiveAction = body.correctiveAction || null;
  const createdBy = body.createdBy || "Usuario RPMS";

  if (!testType || !testDate) {
    return NextResponse.json({ error: "test_type_and_date_required" }, { status: 400 });
  }

  let readings: ReadingInput[] = [];
  let referenceValue: number | null = null;
  let measuredValue: number | null = null;
  let percentValue: number | null = null;
  let tolerancePercent: number | null = null;
  let toleranceParameter: string | null = null;
  let status: ResultStatus;

  if (testType === "calibracion_cruzada") {
    const measuredActivityConcentration =
      body.measuredActivityConcentration !== undefined && body.measuredActivityConcentration !== ""
        ? Number(body.measuredActivityConcentration)
        : NaN;
    const referenceActivityConcentration =
      body.referenceActivityConcentration !== undefined && body.referenceActivityConcentration !== ""
        ? Number(body.referenceActivityConcentration)
        : NaN;
    if (Number.isNaN(measuredActivityConcentration) || Number.isNaN(referenceActivityConcentration)) {
      return NextResponse.json({ error: "activity_concentrations_required" }, { status: 400 });
    }
    const tolerance = await getActiveTolerance("calibracion_cruzada", "activity_deviation_percent");
    tolerancePercent = tolerance ? Number(tolerance.tolerance_percent) : null;
    toleranceParameter = tolerance?.parameter_name || null;

    const result = calculateCrossCalibration({
      measuredActivityConcentration,
      referenceActivityConcentration,
      tolerancePercent,
      warningPercent: tolerance ? Number(tolerance.warning_percent) : null,
    });
    measuredValue = measuredActivityConcentration;
    referenceValue = referenceActivityConcentration;
    percentValue = result.percentDeviation;
    status = result.status;
    readings = [
      { value: measuredActivityConcentration, label: "Concentracion medida (PET)", parameter: "measured_activity_concentration", unit: "Bq/mL" },
      { value: referenceActivityConcentration, label: "Concentracion de referencia (activimetro)", parameter: "reference_activity_concentration", unit: "Bq/mL" },
    ];
  } else if (testType === "uniformidad_imagen") {
    const uniformityPercent =
      body.uniformityPercent !== undefined && body.uniformityPercent !== "" ? Number(body.uniformityPercent) : NaN;
    if (Number.isNaN(uniformityPercent)) {
      return NextResponse.json({ error: "uniformity_percent_required" }, { status: 400 });
    }
    const tolerance = await getActiveTolerance("uniformidad_imagen", "uniformity_percent");
    tolerancePercent = tolerance ? Number(tolerance.tolerance_percent) : null;
    toleranceParameter = tolerance?.parameter_name || null;

    const result = calculatePetImageUniformity({
      uniformityPercent,
      tolerancePercent,
      warningPercent: tolerance ? Number(tolerance.warning_percent) : null,
    });
    percentValue = uniformityPercent;
    status = result.status;
    readings = [
      { value: uniformityPercent, label: "Uniformidad de imagen PET (%)", parameter: "uniformity_percent", unit: "%" },
    ];
  } else {
    return NextResponse.json({ error: "invalid_test_type" }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO qc_petct_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_date, test_time,
      performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
      num_readings, reference_value, measured_value, percent_value,
      tolerance_percent, tolerance_parameter,
      result_status, observaciones, corrective_action, created_by
    ) VALUES (
      ${instrumentId}, ${instrumentCode}, ${instrumentName}, ${testType}, ${testDate}, ${testTime},
      ${performedBy}, ${oprReviewedBy}, ${radionuclide}, ${referenceSource}, ${protocolVersion},
      ${readings.length}, ${referenceValue}, ${measuredValue}, ${percentValue},
      ${tolerancePercent}, ${toleranceParameter},
      ${status}, ${observaciones}, ${correctiveAction}, ${createdBy}
    )
    RETURNING *
  `;

  const test = rows[0];
  if (!test) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await insertReadings(test.id, readings);

  const { rows: readingRows } = await sql`
    SELECT * FROM qc_petct_readings WHERE test_id = ${test.id} ORDER BY reading_index ASC
  `;

  return NextResponse.json({ test, readings: readingRows });
}
