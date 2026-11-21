import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureGammacamaraQcTables, GammacamaraTestType, GammacamaraTestMode } from "@/lib/qc-gammacamara-db";
import {
  calculateUniformity,
  calculateAgainstReference,
  calculateSensitivity,
  ResultStatus,
} from "@/lib/qc-gammacamara-calc";

export const dynamic = "force-dynamic";

async function getActiveTolerance(testType: string, testMode: string, parameterName: string) {
  const { rows } = await sql`
    SELECT * FROM qc_gammacamara_tolerances
    WHERE test_type = ${testType} AND test_mode = ${testMode} AND parameter_name = ${parameterName} AND active = true
    ORDER BY effective_from DESC, id DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(request: Request) {
  await ensureGammacamaraQcTables();
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
  const query = `SELECT * FROM qc_gammacamara_tests ${where} ORDER BY test_date DESC, id DESC LIMIT ${Math.min(limit, 2000)}`;
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
      INSERT INTO qc_gammacamara_readings (
        test_id, reading_index, reading_label, parameter_name, measured_value, unit, elapsed_time_minutes, measured_at, notes
      ) VALUES (
        ${testId}, ${i + 1}, ${r.label || null}, ${r.parameter || null}, ${Number(r.value)}, ${r.unit || null},
        ${r.elapsedMinutes ?? null}, ${r.measuredAt || null}, ${r.notes || null}
      )
    `;
  }
}

export async function POST(request: Request) {
  await ensureGammacamaraQcTables();
  const body = await request.json();

  const instrumentId = body.instrumentId ? Number(body.instrumentId) : null;
  const instrumentCode = body.instrumentCode || null;
  const instrumentName = body.instrumentName || null;
  const testType = String(body.testType || "").trim() as GammacamaraTestType;
  const testMode = String(body.testMode || "na").trim() as GammacamaraTestMode;
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
  let percentDiff: number | null = null;
  let tolerancePercent: number | null = null;
  let toleranceParameter: string | null = null;
  let integralPercent: number | null = null;
  let differentialPercent: number | null = null;
  let integralStatus: ResultStatus | null = null;
  let differentialStatus: ResultStatus | null = null;
  let worstParameter: string | null = null;
  let status: ResultStatus;
  let halfLifeMinutes: number | null = null;
  let referenceActivity: number | null = null;
  let referenceDatetime: string | null = null;
  let measurementDatetime: string | null = null;
  let correctedActivity: number | null = null;

  if (testType === "uniformidad") {
    integralPercent = body.integralPercent !== undefined && body.integralPercent !== "" ? Number(body.integralPercent) : NaN;
    differentialPercent =
      body.differentialPercent !== undefined && body.differentialPercent !== "" ? Number(body.differentialPercent) : NaN;

    if (Number.isNaN(integralPercent) || Number.isNaN(differentialPercent)) {
      return NextResponse.json({ error: "integral_and_differential_percent_required" }, { status: 400 });
    }

    const tolIntegral = await getActiveTolerance("uniformidad", testMode, "integral_percent");
    const tolDifferential = await getActiveTolerance("uniformidad", testMode, "differential_percent");

    const result = calculateUniformity({
      integralPercent,
      differentialPercent,
      toleranceIntegral: tolIntegral ? Number(tolIntegral.tolerance_percent) : null,
      toleranceDifferential: tolDifferential ? Number(tolDifferential.tolerance_percent) : null,
      warningIntegral: tolIntegral ? Number(tolIntegral.warning_percent) : null,
      warningDifferential: tolDifferential ? Number(tolDifferential.warning_percent) : null,
    });

    integralStatus = result.integralStatus;
    differentialStatus = result.differentialStatus;
    status = result.overallStatus;
    worstParameter = result.worstParameter;
    tolerancePercent = tolIntegral ? Number(tolIntegral.tolerance_percent) : null;
    toleranceParameter = "integral_percent + differential_percent";
    meanValue = null;
    readings = [
      { value: integralPercent, label: "Uniformidad integral (%)", parameter: "integral_percent", unit: "%" },
      { value: differentialPercent, label: "Uniformidad diferencial (%)", parameter: "differential_percent", unit: "%" },
    ];
  } else if (testType === "resolucion") {
    const inputReadings: ReadingInput[] = Array.isArray(body.readings) ? body.readings : [];
    if (inputReadings.length === 0) {
      return NextResponse.json({ error: "at_least_one_reading_required" }, { status: 400 });
    }
    referenceValue = body.referenceValue !== undefined && body.referenceValue !== "" ? Number(body.referenceValue) : null;
    const tolerance = await getActiveTolerance("resolucion", "na", "fwhm_percent_change");
    tolerancePercent = tolerance ? Number(tolerance.tolerance_percent) : null;
    toleranceParameter = tolerance?.parameter_name || null;

    const values = inputReadings.map((r) => Number(r.value));
    const result = calculateAgainstReference({
      readings: values,
      referenceValue,
      tolerancePercent,
      warningPercent: tolerance ? Number(tolerance.warning_percent) : null,
    });
    meanValue = result.meanValue;
    stddevValue = result.stddevValue;
    cvPercent = result.cvPercent;
    percentDiff = result.percentDifference;
    status = result.status;
    readings = inputReadings.map((r, i) => ({
      value: Number(r.value),
      label: r.label || `FWHM ${i + 1}`,
      parameter: "fwhm",
      unit: r.unit || "mm",
    }));
  } else if (testType === "sensibilidad") {
    const inputReadings: ReadingInput[] = Array.isArray(body.readings) ? body.readings : [];
    if (inputReadings.length === 0) {
      return NextResponse.json({ error: "at_least_one_reading_required" }, { status: 400 });
    }
    referenceValue = body.referenceValue !== undefined && body.referenceValue !== "" ? Number(body.referenceValue) : null;
    halfLifeMinutes = body.halfLifeMinutes !== undefined && body.halfLifeMinutes !== "" ? Number(body.halfLifeMinutes) : null;
    referenceActivity = body.referenceActivity !== undefined && body.referenceActivity !== "" ? Number(body.referenceActivity) : null;
    referenceDatetime = body.referenceDatetime || null;
    measurementDatetime = body.measurementDatetime || null;

    const tolerance = await getActiveTolerance("sensibilidad", "na", "percent_difference");
    tolerancePercent = tolerance ? Number(tolerance.tolerance_percent) : null;
    toleranceParameter = tolerance?.parameter_name || null;

    const values = inputReadings.map((r) => Number(r.value));

    if (halfLifeMinutes && referenceActivity && referenceDatetime && measurementDatetime) {
      const meanCountRate = values.reduce((a, b) => a + b, 0) / values.length;
      const result = calculateSensitivity({
        countRate: meanCountRate,
        referenceActivity,
        halfLifeMinutes,
        referenceDatetime,
        measurementDatetime,
        referenceSensitivity: referenceValue,
        tolerancePercent,
        warningPercent: tolerance ? Number(tolerance.warning_percent) : null,
      });
      meanValue = result.measuredSensitivity;
      correctedActivity = result.correctedActivity;
      percentDiff = result.percentDifference;
      status = result.status;
    } else {
      const result = calculateAgainstReference({
        readings: values,
        referenceValue,
        tolerancePercent,
        warningPercent: tolerance ? Number(tolerance.warning_percent) : null,
      });
      meanValue = result.meanValue;
      stddevValue = result.stddevValue;
      cvPercent = result.cvPercent;
      percentDiff = result.percentDifference;
      status = result.status;
    }
    readings = inputReadings.map((r, i) => ({
      value: Number(r.value),
      label: r.label || `Lectura ${i + 1}`,
      parameter: "count_rate",
      unit: r.unit || "cpm",
    }));
  } else {
    return NextResponse.json({ error: "invalid_test_type" }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO qc_gammacamara_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_mode, test_date, test_time,
      performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
      num_readings, mean_value, stddev_value, cv_percent, reference_value, percent_difference,
      tolerance_percent, tolerance_parameter, integral_percent, differential_percent,
      integral_status, differential_status, worst_parameter,
      half_life_minutes, reference_activity, reference_datetime, measurement_datetime, corrected_activity,
      result_status, observaciones, corrective_action, created_by
    ) VALUES (
      ${instrumentId}, ${instrumentCode}, ${instrumentName}, ${testType}, ${testMode}, ${testDate}, ${testTime},
      ${performedBy}, ${oprReviewedBy}, ${radionuclide}, ${referenceSource}, ${protocolVersion},
      ${readings.length}, ${meanValue}, ${stddevValue}, ${cvPercent}, ${referenceValue}, ${percentDiff},
      ${tolerancePercent}, ${toleranceParameter}, ${integralPercent}, ${differentialPercent},
      ${integralStatus}, ${differentialStatus}, ${worstParameter},
      ${halfLifeMinutes}, ${referenceActivity}, ${referenceDatetime}, ${measurementDatetime}, ${correctedActivity},
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
    SELECT * FROM qc_gammacamara_readings WHERE test_id = ${test.id} ORDER BY reading_index ASC
  `;

  return NextResponse.json({ test, readings: readingRows });
}
