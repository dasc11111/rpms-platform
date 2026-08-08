import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureAcceptanceTables, logAcceptanceAudit, computeOverallResult, evaluateItemResult } from "@/lib/linac-acceptance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureAcceptanceTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const { rows } = await sql`
  SELECT t.*, p.protocol_name, p.manufacturer, p.model
  FROM linac_acceptance_tests t
  LEFT JOIN linac_acceptance_protocols p ON p.id = t.protocol_id
  WHERE (${linacId}::int IS NULL OR t.linac_id = ${linacId}::int)
  ORDER BY t.test_date DESC, t.id DESC
  LIMIT 500
  `;
  return NextResponse.json({ ok: true, tests: rows });
}

export async function POST(request: Request) {
  await ensureAcceptanceTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const linacId = Number(body.linacId);
  if (!linacId || !body.testDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

const items = Array.isArray(body.results) ? body.results : [];
  const evaluatedItems = items.map((it: any) => {
    if (it.result === "cumple" || it.result === "cumple_observaciones" || it.result === "no_cumple") return it;
    const auto = evaluateItemResult(it.measuredValue, it.specification, it.tolerance);
    return { ...it, result: auto };
  });
  const overallResult = computeOverallResult(evaluatedItems);

let version = 1;
  if (body.supersedesId) {
    const { rows: prevRows } = await sql`SELECT version FROM linac_acceptance_tests WHERE id = ${body.supersedesId}`;
    version = (Number(prevRows[0]?.version) || 0) + 1;
    await sql`UPDATE linac_acceptance_tests SET is_current = false WHERE id = ${body.supersedesId}`;
  }

const { rows } = await sql`
INSERT INTO linac_acceptance_tests (
linac_id, protocol_id, version, is_current, supersedes_id, test_date, performed_by, company,
results, overall_result, observations, created_by
) VALUES (
${linacId}, ${body.protocolId || null}, ${version}, true, ${body.supersedesId || null}, ${body.testDate},
${body.performedBy || null}, ${body.company || null}, ${JSON.stringify(evaluatedItems)}::jsonb,
${overallResult}, ${body.observations || null}, ${actorEmail}
)
RETURNING id;
`;

await logAcceptanceAudit("create_linac_acceptance_test", actorEmail, { id: rows[0]!.id, linacId, overallResult, version });
  return NextResponse.json({ ok: true, id: rows[0]!.id, overallResult, version });
}
