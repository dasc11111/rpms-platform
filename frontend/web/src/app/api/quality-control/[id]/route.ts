import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureQualityControlTables } from "@/lib/quality-control-db";
import { computeDeviationPercent, evaluateResultStatus } from "@/lib/quality-control";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await ensureQualityControlTables();
  const { rows } = await sql`SELECT * FROM quality_control_tests WHERE id = ${Number(params.id)}`;
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ test: rows[0] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await ensureQualityControlTables();
  const id = Number(params.id);
  const body = await request.json();

  const { rows: existingRows } = await sql`SELECT * FROM quality_control_tests WHERE id = ${id}`;
  if (existingRows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const existing = existingRows[0] as Record<string, unknown>;

  const measuredValue =
    body.measuredValue !== undefined
      ? body.measuredValue === "" ? null : Number(body.measuredValue)
      : (existing.measured_value as number | null);
  const referenceValue =
    body.referenceValue !== undefined
      ? body.referenceValue === "" ? null : Number(body.referenceValue)
      : (existing.reference_value as number | null);
  const tolerancePercent =
    body.tolerancePercent !== undefined
      ? body.tolerancePercent === "" ? null : Number(body.tolerancePercent)
      : (existing.tolerance_percent as number | null);

  const deviationPercent = computeDeviationPercent(measuredValue, referenceValue);
  const resultStatus = body.resultStatus || evaluateResultStatus(deviationPercent, tolerancePercent);

  const correctiveAction = body.correctiveAction !== undefined ? body.correctiveAction : existing.corrective_action;
  const notes = body.notes !== undefined ? body.notes : existing.notes;
  const performedBy = body.performedBy !== undefined ? body.performedBy : existing.performed_by;

  const { rows } = await sql`
    UPDATE quality_control_tests SET
      measured_value = ${measuredValue},
      reference_value = ${referenceValue},
      tolerance_percent = ${tolerancePercent},
      deviation_percent = ${deviationPercent},
      result_status = ${resultStatus},
      corrective_action = ${correctiveAction},
      notes = ${notes},
      performed_by = ${performedBy},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json({ test: rows[0] });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await ensureQualityControlTables();
  await sql`DELETE FROM quality_control_tests WHERE id = ${Number(params.id)}`;
  return NextResponse.json({ ok: true });
}
