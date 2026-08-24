import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSpectQcTables, SpectTestType } from "@/lib/qc-spect-db";
import {
  calculateCenterOfRotation,
  calculateTomographicUniformity,
  ResultStatus,
} from "@/lib/qc-spect-calc";

export const dynamic = "force-dynamic";

async function getActiveTolerance(testType: string, parameterName: string) {
  const { rows } = await sql`
    SELECT * FROM qc_spect_tolerances
    WHERE test_type = ${testType} AND parameter_name = ${parameterName} AND active = true
    ORDER BY effective_from DESC, id DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(request: Request) {
  await ensureSpectQcTables();
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
  const query = `SELECT * FROM qc_spect_tests ${where} ORDER BY test_date DESC, id DESC LIMIT ${Math.min(limit, 2000)}`;
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
      INSERT INTO qc_spect_readings (
        test_id, reading_index, reading_label, parameter_name, measured_value, unit, elapsed_time_minutes, measured_at, notes
      ) VALUES (
        ${testId}, ${i + 1}, ${r.label || null}, ${r.parameter || null}, ${Number(r.value)}, ${r.unit || null},
        ${r.elapsedMinutes ?? null}, ${r.measuredAt || null}, ${r.notes || null}
      )
    `;
  }
}

export async function POST(request: Request) {
  await ensureSpectQcTables();
  const body = await request.json();

  const instrumentId = body.instrumentId ? Number(body.instrumentId) : null;
  const instrumentCode = body.instrumentCode || null;
  const instrumentName = body.instrumentName || null;
  const testType = String(body.testType || "").trim() as SpectTestType;
  const testDate = body.testDate || null;
  const testTime = body.testTime || null;
  const performedBy = body.performedBy || null;
  const oprReviewedBy = body.oprReviewedBy || null;
  const radionuclide = body.radionuclide || null;
  const referenceSource = body.referenceSource || "IAEA TECDOC-602";
  const protocolVersion = body.protocolVersion || "1.0";
  const observaciones = body.observaciones || null;
  const correctiveAction = body.correctiveAction || null;
  const createdBy = body.createdBy || "Usuario RPMS";

  if (!testType || !testDate) {
    return NextResponse.json({ error: "test_type_and_date_required" }, { status: 400 });
  }

  let readings: ReadingInput[] = [];
  let meanValue: number | null = null;
  let stddevValue: number | null = null;
  let cvPercent: number | null = null;
  let referenceValue: number | null = null;
  let absoluteDifference: number | null = null;
  let percentValue: number | null = null;
  let tolerancePercent: number | null = null;
  let toleranceAbsolute: number | null = null;
  let toleranceParameter: string | null = null;
  let status: ResultStatus;

  if (testType === "centro_rotacion") {
    const inputReadings: ReadingInput[] = Array.isArray(body.readings) ? body.readings : [];
    if (inputReadings.length === 0) {
      return NextResponse.json({ error: "at_least_one_reading_required" }, { status: 400 });
    }
    const tolerance = await getActiveTolerance("centro_rotacion", "cor_offset_pixels");
    toleranceAbsolute = tolerance ? Number(tolerance.tolerance_absolute) : null;
    toleranceParameter = tolerance?.parameter_name || null;

    const values = inputReadings.map((r) => Number(r.value));
    const result = calculateCenterOfRotation({
      readings: values,
      toleranceAbsolute,
      warningAbsolute: tolerance ? Number(tolerance.warning_absolute) : null,
    });
    meanValue = result.meanValue;
    stddevValue = result.stddevValue;
    cvPercent = result.cvPercent;
    absoluteDifference = result.absoluteDifference;
    referenceValue = 0;
    status = result.status;
    readings = inputReadings.map((r, i) => ({
      value: Number(r.value),
      label: r.label || `COR proyeccion/cabezal ${i + 1}`,
      parameter: "cor_offset_pixels",
      unit: r.unit || "px",
    }));
  } else if (testType === "uniformidad_tomografica") {
    const uniformityPercent =
      body.uniformityPercent !== undefined && body.uniformityPercent !== "" ? Number(body.uniformityPercent) : NaN;
    if (Number.isNaN(uniformityPercent)) {
      return NextResponse.json({ error: "uniformity_percent_required" }, { status: 400 });
    }
    const tolerance = await getActiveTolerance("uniformidad_tomografica", "uniformity_percent");
    tolerancePercent = tolerance ? Number(tolerance.tolerance_percent) : null;
    toleranceParameter = tolerance?.parameter_name || null;

    const result = calculateTomographicUniformity({
      uniformityPercent,
      tolerancePercent,
      warningPercent: tolerance ? Number(tolerance.warning_percent) : null,
    });
    percentValue = uniformityPercent;
    status = result.status;
    readings = [
      { value: uniformityPercent, label: "Uniformidad tomografica (%)", parameter: "uniformity_percent", unit: "%" },
    ];
  } else {
    return NextResponse.json({ error: "invalid_test_type" }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO qc_spect_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_date, test_time,
      performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
      num_readings, mean_value, stddev_value, cv_percent, reference_value, absolute_difference, percent_value,
      tolerance_percent, tolerance_absolute, tolerance_parameter,
      result_status, observaciones, corrective_action, created_by
    ) VALUES (
      ${instrumentId}, ${instrumentCode}, ${instrumentName}, ${testType}, ${testDate}, ${testTime},
      ${performedBy}, ${oprReviewedBy}, ${radionuclide}, ${referenceSource}, ${protocolVersion},
      ${readings.length}, ${meanValue}, ${stddevValue}, ${cvPercent}, ${referenceValue}, ${absoluteDifference}, ${percentValue},
      ${tolerancePercent}, ${toleranceAbsolute}, ${toleranceParameter},
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
    SELECT * FROM qc_spect_readings WHERE test_id = ${test.id} ORDER BY reading_index ASC
  `;

  return NextResponse.json({ test, readings: readingRows });
}
