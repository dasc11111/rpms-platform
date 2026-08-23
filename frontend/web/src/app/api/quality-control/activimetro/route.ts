import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables, ActivimetroTestType } from "@/lib/qc-activimetro-db";
import {
  mean,
  stddev,
  coefficientOfVariation,
  percentDifference,
  lnLnRegression,
  evaluateTolerance,
  decayCorrectActivity,
  ResultStatus,
} from "@/lib/qc-activimetro-calc";

export const dynamic = "force-dynamic";

async function getActiveTolerance(testType: string) {
  const { rows } = await sql`
    SELECT * FROM qc_activimetro_tolerances
    WHERE test_type = ${testType} AND active = true
    ORDER BY effective_from DESC, id DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(request: Request) {
  await ensureActivimetroQcTables();
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
  const query = `SELECT * FROM qc_activimetro_tests ${where} ORDER BY test_date DESC, id DESC LIMIT ${Math.min(limit, 2000)}`;
  const { rows } = await sql.query(query, params);

  return NextResponse.json({ tests: rows, total: rows.length });
}

interface ReadingInput {
  value: number;
  label?: string;
  unit?: string;
  elapsedMinutes?: number;
  measuredAt?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export async function POST(request: Request) {
  await ensureActivimetroQcTables();
  const body = await request.json();

  const instrumentId = body.instrumentId ? Number(body.instrumentId) : null;
  const instrumentCode = body.instrumentCode || null;
  const instrumentName = body.instrumentName || null;
  const testType = String(body.testType || "").trim() as ActivimetroTestType;
  const testDate = body.testDate || null;
  const testTime = body.testTime || null;
  const performedBy = body.performedBy || null;
  const oprReviewedBy = body.oprReviewedBy || null;
  const radionuclide = body.radionuclide || null;
  const referenceSource = body.referenceSource || "Documento QA Activimetro proporcionado por usuario";
  const protocolVersion = body.protocolVersion || "1.0";
  const referenceValue = body.referenceValue !== undefined && body.referenceValue !== "" ? Number(body.referenceValue) : null;
  const halfLifeMinutes = body.halfLifeMinutes !== undefined && body.halfLifeMinutes !== "" ? Number(body.halfLifeMinutes) : null;
  const referenceActivity = body.referenceActivity !== undefined && body.referenceActivity !== "" ? Number(body.referenceActivity) : null;
  const referenceDatetime = body.referenceDatetime || null;
  const measurementDatetime = body.measurementDatetime || null;
  const observaciones = body.observaciones || null;
  const correctiveAction = body.correctiveAction || null;
  const createdBy = body.createdBy || "Usuario RPMS";
  const readings: ReadingInput[] = Array.isArray(body.readings) ? body.readings : [];

  if (!testType || !testDate) {
    return NextResponse.json({ error: "test_type_and_date_required" }, { status: 400 });
  }
  if (readings.length === 0) {
    return NextResponse.json({ error: "at_least_one_reading_required" }, { status: 400 });
  }

  const values = readings.map((r) => Number(r.value));
  const tolerance = await getActiveTolerance(testType);
  const tolerancePercent = tolerance ? Number(tolerance.tolerance_percent) : null;
  const warningPercent = tolerance ? Number(tolerance.warning_percent) : null;

  const meanValue = mean(values);
  const stddevValue = stddev(values);
  const cvPercent = coefficientOfVariation(values);
  let percentDiff: number | null = referenceValue ? percentDifference(meanValue, referenceValue) : null;
  let regressionSlope: number | null = null;
  let regressionIntercept: number | null = null;
  let regressionR2: number | null = null;
  let correctedActivity: number | null = null;
  let status: ResultStatus;

  if (testType === "linealidad" && readings.every((r) => r.elapsedMinutes !== undefined)) {
    const times = readings.map((r) => Number(r.elapsedMinutes));
    const reg = lnLnRegression(times, values);
    regressionSlope = reg.slope;
    regressionIntercept = reg.intercept;
    regressionR2 = reg.r2;
    const impliedHalfLife = reg.impliedHalfLifeMinutes;
    percentDiff = halfLifeMinutes ? percentDifference(impliedHalfLife, halfLifeMinutes) : null;
    status = evaluateTolerance(percentDiff ?? NaN, tolerancePercent, warningPercent);
  } else {
    const observed = referenceValue ? (percentDiff as number) : cvPercent;
    status = evaluateTolerance(observed, tolerancePercent, warningPercent);
  }

  if (halfLifeMinutes && referenceActivity && referenceDatetime && measurementDatetime) {
    const elapsed = (new Date(measurementDatetime).getTime() - new Date(referenceDatetime).getTime()) / 60000;
    correctedActivity = decayCorrectActivity(referenceActivity, halfLifeMinutes, elapsed, "forward");
  }

  const { rows } = await sql`
    INSERT INTO qc_activimetro_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_date, test_time,
      performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
      num_readings, mean_value, stddev_value, cv_percent, reference_value, percent_difference,
      tolerance_percent, tolerance_parameter, regression_slope, regression_intercept, regression_r2,
      half_life_minutes, reference_activity, reference_datetime, measurement_datetime, corrected_activity,
      result_status, observaciones, corrective_action, created_by
    ) VALUES (
      ${instrumentId}, ${instrumentCode}, ${instrumentName}, ${testType}, ${testDate}, ${testTime},
      ${performedBy}, ${oprReviewedBy}, ${radionuclide}, ${referenceSource}, ${protocolVersion},
      ${values.length}, ${meanValue}, ${stddevValue}, ${cvPercent}, ${referenceValue}, ${percentDiff},
      ${tolerancePercent}, ${tolerance?.parameter_name || null}, ${regressionSlope}, ${regressionIntercept}, ${regressionR2},
      ${halfLifeMinutes}, ${referenceActivity}, ${referenceDatetime}, ${measurementDatetime}, ${correctedActivity},
      ${status}, ${observaciones}, ${correctiveAction}, ${createdBy}
    )
    RETURNING *
  `;

  const test = rows[0];
  if (!test) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    await sql`
      INSERT INTO qc_activimetro_readings (
        test_id, reading_index, reading_label, measured_value, unit, elapsed_time_minutes, measured_at, metadata, notes
      ) VALUES (
        ${test.id}, ${i + 1}, ${r.label || null}, ${Number(r.value)}, ${r.unit || null},
        ${r.elapsedMinutes ?? null}, ${r.measuredAt || null}, ${r.metadata ? JSON.stringify(r.metadata) : null}, ${r.notes || null}
      )
    `;
  }

  const { rows: readingRows } = await sql`
    SELECT * FROM qc_activimetro_readings WHERE test_id = ${test.id} ORDER BY reading_index ASC
  `;

  return NextResponse.json({ test, readings: readingRows });
}
