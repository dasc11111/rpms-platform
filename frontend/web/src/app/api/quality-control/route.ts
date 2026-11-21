import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureQualityControlTables } from "@/lib/quality-control-db";
import { computeDeviationPercent, evaluateResultStatus } from "@/lib/quality-control";
import { NextRequest } from "next/server";

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


export async function PATCH(request: NextRequest) {
  await ensureQualityControlTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE quality_control_tests SET
      test_type = COALESCE(${body.testType ?? null}, test_type),
      test_date = COALESCE(${body.testDate ?? null}::date, test_date),
      performed_by = COALESCE(${body.performedBy ?? null}, performed_by),
      radionuclide = COALESCE(${body.radionuclide ?? null}, radionuclide),
      measured_value = COALESCE(${body.measuredValue ?? null}::numeric, measured_value),
      reference_value = COALESCE(${body.referenceValue ?? null}::numeric, reference_value),
      unit = COALESCE(${body.unit ?? null}, unit),
      tolerance_percent = COALESCE(${body.tolerancePercent ?? null}::numeric, tolerance_percent),
      result_status = COALESCE(${body.resultStatus ?? null}, result_status),
      corrective_action = COALESCE(${body.correctiveAction ?? null}, corrective_action),
      notes = COALESCE(${body.notes ?? null}, notes)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, test: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureQualityControlTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM quality_control_tests WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
