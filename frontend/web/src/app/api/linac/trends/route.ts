import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables } from "@/lib/linac";
import { computeStats, linearTrend } from "@/lib/linac-science";
import { evaluateAndMaybeAlert } from "@/lib/linac-alerts";

export const dynamic = "force-dynamic";

type Point = { idx: number; date: string; value: number; id: number };

export async function GET(request: Request) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const linacId = Number(searchParams.get("linacId") || 0);
  const measurementType = (searchParams.get("measurementType") || "").trim();
  const generateAlert = searchParams.get("generateAlert") === "true";
  const limit = Number(searchParams.get("limit") || 200);

  if (!linacId || !measurementType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, test_date, obtained_value, unit, semaphore
    FROM linac_qc_tests
    WHERE linac_id = ${linacId} AND measurement_type = ${measurementType} AND obtained_value IS NOT NULL
    ORDER BY test_date ASC, id ASC
    LIMIT ${limit};
  `;

  const series: Point[] = [];
  rows.forEach((r: any) => {
    const value = parseFloat(String(r.obtained_value).replace(",", "."));
    if (Number.isFinite(value)) {
      series.push({ idx: series.length, date: r.test_date, value, id: r.id });
    }
  });

  const stats = computeStats(series.map((p) => p.value));
  const trend = linearTrend(series.map((p) => ({ x: p.idx, y: p.value })));

  let evaluation: any = null;
  const latest = series[series.length - 1];
  if (latest) {
    evaluation = await evaluateAndMaybeAlert({
      module: "qc",
      linacId,
      parameterName: measurementType,
      measuredValue: latest.value,
      sourceRecordId: latest.id,
      sourceDate: latest.date,
      persist: generateAlert,
    });
  }

  return NextResponse.json({ series, stats, trend, evaluation, n: series.length });
}
