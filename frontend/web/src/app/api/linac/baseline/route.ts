import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBaselineTables, promoteDatasetToBaseline, logBaselineAudit } from "@/lib/linac-baseline";
import { ensureCommissioningTables } from "@/lib/linac-commissioning";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureBaselineTables();
  await ensureCommissioningTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const category = searchParams.get("category");
  const history = searchParams.get("history");

  const { rows } = await sql`
    SELECT b.*, d.measurement_date, d.measured_by, d.instrument_used, d.data, d.notes AS dataset_notes, d.status AS dataset_status
    FROM linac_baselines b
    LEFT JOIN linac_commissioning_datasets d ON d.id = b.dataset_id
    WHERE (${linacId}::int IS NULL OR b.linac_id = ${linacId}::int)
      AND (${category}::text IS NULL OR b.category = ${category}::text)
      AND (${history}::text IS NOT NULL OR b.is_current = true)
    ORDER BY b.category ASC, b.measurement_type ASC, b.version DESC
    LIMIT 1000
  `;
  return NextResponse.json({ ok: true, baselines: rows });
}

export async function POST(request: Request) {
  await ensureBaselineTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const linacId = Number(body.linacId);
  const datasetId = Number(body.datasetId);
  if (!linacId || !datasetId || !body.category || !body.measurementType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { rows: datasetRows } = await sql`SELECT * FROM linac_commissioning_datasets WHERE id = ${datasetId}`;
  if (!datasetRows[0]) {
    return NextResponse.json({ error: "dataset_not_found" }, { status: 404 });
  }

  const result = await promoteDatasetToBaseline(
    linacId,
    body.category,
    body.measurementType,
    body.modality || null,
    body.energy || null,
    datasetId,
    actorEmail,
    body.notes || null
  );

  await sql`UPDATE linac_commissioning_datasets SET is_baseline = true, updated_at = now() WHERE id = ${datasetId}`;

  await logBaselineAudit("promote_to_baseline", actorEmail, {
    id: result.id, linacId, category: body.category, measurementType: body.measurementType, version: result.version, datasetId,
  });

  return NextResponse.json({ ok: true, id: result.id, version: result.version });
}
