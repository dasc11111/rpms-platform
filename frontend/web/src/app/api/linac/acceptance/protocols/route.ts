import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureAcceptanceTables, logAcceptanceAudit } from "@/lib/linac-acceptance";
import { NextRequest } from "next/server";

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


export async function PATCH(request: NextRequest) {
  await ensureAcceptanceTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE linac_acceptance_protocols SET
      manufacturer = COALESCE(${body.manufacturer ?? null}, manufacturer),
      model = COALESCE(${body.model ?? null}, model),
      protocol_name = COALESCE(${body.protocolName ?? null}, protocol_name),
      applicable_norms = COALESCE(${body.applicableNorms ?? null}, applicable_norms),
      items = COALESCE(${body.items != null ? JSON.stringify(body.items) : null}::jsonb, items),
      status = COALESCE(${body.status ?? null}, status)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Protocolo no encontrado." }, { status: 404 });
  await logAcceptanceAudit("update_acceptance_protocol", body.actorEmail || null, { id });
  return NextResponse.json({ ok: true, protocol: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureAcceptanceTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`UPDATE linac_acceptance_protocols SET status = 'eliminado' WHERE id = ${id} RETURNING id, protocol_name`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Protocolo no encontrado." }, { status: 404 });
  await logAcceptanceAudit("delete_acceptance_protocol", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
