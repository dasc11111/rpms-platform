import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureQualityControlTables } from "@/lib/quality-control-db";
import { computeDeviationPercent, evaluateResultStatus } from "@/lib/quality-control";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureQualityControlTables();
  const { searchParams } = new URL(request.url);
  const instrumentId = searchParams.get("instrumentId");
  const testType = searchParams.get("testType");
  const resultStatus = searchParams.get("resultStatus");

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
  const query = `SELECT * FROM quality_control_tests ${where} ORDER BY test_date DESC, id DESC LIMIT 2000`;
  const { rows } = await sql.query(query, params);

  return NextResponse.json({ tests: rows, total: rows.length });
}

export async function POST(request: Request) {
  await ensureQualityControlTables();
  const body = await request.json();

  const instrumentId = body.instrumentId ? Number(body.instrumentId) : null;
  const instrumentCode = body.instrumentCode || null;
  const instrumentName = body.instrumentName || null;
  const testType = String(body.testType || "").trim();
  const testDate = body.testDate || null;
  const performedBy = body.performedBy || null;
  const radionuclide = body.radionuclide || null;
  const measuredValue = body.measuredValue !== undefined && body.measuredValue !== "" ? Number(body.measuredValue) : null;
  const referenceValue = body.referenceValue !== undefined && body.referenceValue !== "" ? Number(body.referenceValue) : null;
  const unit = body.unit || null;
  const tolerancePercent = body.tolerancePercent !== undefined && body.tolerancePercent !== "" ? Number(body.tolerancePercent) : null;
  const notes = body.notes || null;
  const createdBy = body.createdBy || "Usuario RPMS";
  const correctiveAction = body.correctiveAction || null;

  if (!testType || !testDate) {
    return NextResponse.json({ error: "test_type_and_date_required" }, { status: 400 });
  }

  const deviationPercent = computeDeviationPercent(measuredValue, referenceValue);
  const resultStatus = body.resultStatus || evaluateResultStatus(deviationPercent, tolerancePercent);

  const { rows } = await sql`
    INSERT INTO quality_control_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_date, performed_by, radionuclide,
      measured_value, reference_value, unit, tolerance_percent, deviation_percent, result_status,
      corrective_action, notes, created_by
    ) VALUES (
      ${instrumentId}, ${instrumentCode}, ${instrumentName}, ${testType}, ${testDate}, ${performedBy}, ${radionuclide},
      ${measuredValue}, ${referenceValue}, ${unit}, ${tolerancePercent}, ${deviationPercent}, ${resultStatus},
      ${correctiveAction}, ${notes}, ${createdBy}
    )
    RETURNING *
  `;

  return NextResponse.json({ test: rows[0] });
}
