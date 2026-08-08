import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureCommissioningTables, logCommissioningAudit } from "@/lib/linac-commissioning";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureCommissioningTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const category = searchParams.get("category");
  const { rows } = await sql`
    SELECT *
    FROM linac_commissioning_datasets
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
      AND (${category}::text IS NULL OR category = ${category}::text)
    ORDER BY category ASC, measurement_type ASC, measurement_date DESC, id DESC
    LIMIT 1000
  `;
  return NextResponse.json({ ok: true, datasets: rows });
}

export async function POST(request: Request) {
  await ensureCommissioningTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const linacId = Number(body.linacId);
  if (!linacId || !body.category || !body.measurementType || !body.measurementDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let version = 1;
  if (body.supersedesId) {
    const { rows: prevRows } = await sql`SELECT version FROM linac_commissioning_datasets WHERE id = ${body.supersedesId}`;
    version = (Number(prevRows[0]?.version) || 0) + 1;
    await sql`UPDATE linac_commissioning_datasets SET is_current = false WHERE id = ${body.supersedesId}`;
  }

  const { rows } = await sql`
    INSERT INTO linac_commissioning_datasets (
      linac_id, category, modality, energy, measurement_type, version, is_current, supersedes_id,
      measurement_date, measured_by, instrument_used, data, notes, status, created_by
    ) VALUES (
      ${linacId}, ${body.category}, ${body.modality || null}, ${body.energy || null}, ${body.measurementType},
      ${version}, true, ${body.supersedesId || null}, ${body.measurementDate}, ${body.measuredBy || null},
      ${body.instrumentUsed || null}, ${JSON.stringify(body.data || {})}::jsonb, ${body.notes || null},
      ${body.status || "borrador"}, ${actorEmail}
    )
    RETURNING id;
  `;

  await logCommissioningAudit("create_commissioning_dataset", actorEmail, { id: rows[0]!.id, linacId, category: body.category, measurementType: body.measurementType, version });
  return NextResponse.json({ ok: true, id: rows[0]!.id, version });
}

export async function PATCH(request: Request) {
  await ensureCommissioningTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  if (body.action === "finalize") {
    await sql`UPDATE linac_commissioning_datasets SET status = 'finalizado', updated_at = now() WHERE id = ${id}`;
    await logCommissioningAudit("finalize_commissioning_dataset", actorEmail, { id });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "mark_baseline") {
    await sql`UPDATE linac_commissioning_datasets SET is_baseline = true, updated_at = now() WHERE id = ${id}`;
    await logCommissioningAudit("mark_baseline_commissioning_dataset", actorEmail, { id });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
