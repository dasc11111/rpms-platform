import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const sourceModule = searchParams.get("module") || "";
  const sourceRecordId = Number(searchParams.get("recordId") || 0);
  const linacId = Number(searchParams.get("linacId") || 0);

  const params: unknown[] = [];
  const clauses: string[] = [];
  if (sourceModule) {
    params.push(sourceModule);
    clauses.push(`source_module = $${params.length}`);
  }
  if (sourceRecordId) {
    params.push(sourceRecordId);
    clauses.push(`source_record_id = $${params.length}`);
  }
  if (linacId) {
    params.push(linacId);
    clauses.push(`linac_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await sql.query(
    `SELECT * FROM linac_deviation_decisions ${where} ORDER BY decided_at DESC LIMIT 200`,
    params
  );
  return NextResponse.json({ decisions: rows });
}

export async function POST(request: Request) {
  await ensureScienceTables();
  const body = await request.json();
  const decision = (body.decision || "").trim();
  const sourceModule = (body.sourceModule || "").trim();
  if (!decision || !sourceModule) {
    return NextResponse.json({ error: "decision_and_module_required" }, { status: 400 });
  }

  const linacId = body.linacId ? Number(body.linacId) : null;
  const sourceRecordId = body.sourceRecordId ? Number(body.sourceRecordId) : null;
  const criteriaId = body.criteriaId ? Number(body.criteriaId) : null;

  const { rows } = await sql`
    INSERT INTO linac_deviation_decisions (
      linac_id, source_module, source_record_id, parameter_name, measured_value,
      reference_value, baseline_value, deviation, criteria_id, decision, justification, decided_by
    ) VALUES (
      ${linacId}, ${sourceModule}, ${sourceRecordId}, ${body.parameterName || null},
      ${body.measuredValue || null}, ${body.referenceValue || null}, ${body.baselineValue || null},
      ${body.deviation || null}, ${criteriaId}, ${decision}, ${body.justification || null},
      ${body.decidedBy || "Usuario RPMS"}
    )
    RETURNING *
  `;

  return NextResponse.json({ decision: rows[0] });
}
