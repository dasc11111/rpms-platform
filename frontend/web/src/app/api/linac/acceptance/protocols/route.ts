import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureAcceptanceTables, logAcceptanceAudit } from "@/lib/linac-acceptance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureAcceptanceTables();
  const { searchParams } = new URL(request.url);
  const manufacturer = searchParams.get("manufacturer");
  const model = searchParams.get("model");
  const { rows } = await sql`
  SELECT * FROM linac_acceptance_protocols
  WHERE status != 'eliminado'
  AND (${manufacturer}::text IS NULL OR manufacturer ILIKE ${manufacturer})
  AND (${model}::text IS NULL OR model ILIKE ${model})
  ORDER BY id DESC
  `;
  return NextResponse.json({ ok: true, protocols: rows });
}

export async function POST(request: Request) {
  await ensureAcceptanceTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  if (!body.manufacturer || !body.model || !body.protocolName) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { rows } = await sql`
  INSERT INTO linac_acceptance_protocols (manufacturer, model, protocol_name, applicable_norms, items, created_by)
  VALUES (${body.manufacturer}, ${body.model}, ${body.protocolName}, ${body.applicableNorms || null}, ${JSON.stringify(body.items || [])}::jsonb, ${actorEmail})
  RETURNING id;
  `;
  await logAcceptanceAudit("create_acceptance_protocol", actorEmail, { id: rows[0]!.id, manufacturer: body.manufacturer, model: body.model });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
