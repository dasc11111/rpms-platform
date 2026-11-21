import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const bunkerId = searchParams.get("bunkerId");
  if (bunkerId) {
    const { rows } = await sql`SELECT * FROM rt_shielding WHERE bunker_id = ${bunkerId} ORDER BY id ASC`;
    return NextResponse.json({ ok: true, shielding: rows });
  }
  const { rows } = await sql`SELECT * FROM rt_bunkers WHERE facility_id = ${facilityId} ORDER BY id ASC`;
  return NextResponse.json({ ok: true, bunkers: rows });
}

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  if (body.kind === "shielding") {
    const { rows } = await sql`
      INSERT INTO rt_shielding (bunker_id, element, material, thickness_cm, calculation_reference, verification_date, status)
      VALUES (${body.bunkerId}, ${body.element || null}, ${body.material || null}, ${body.thicknessCm || null}, ${body.calculationReference || null}, ${body.verificationDate || null}, ${body.status || "conforme"})
      RETURNING id;
    `;
    await logRadioterapiaAudit("create_rt_shielding", actorEmail, { id: rows[0]!.id, bunkerId: body.bunkerId });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }
  const { rows } = await sql`
    INSERT INTO rt_bunkers (facility_id, linac_id, name, design_reference)
    VALUES (${body.facilityId}, ${body.linacId || null}, ${body.name || null}, ${body.designReference || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_bunker", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}


export async function PATCH(request: NextRequest) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const id = Number(body.id);
  const type = body.type || "bunker";
  const actorEmail = body.actorEmail || null;
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });

  if (type === "shielding") {
    const { rows } = await sql`
      UPDATE rt_shielding SET
        element = COALESCE(${body.element ?? null}, element),
        material = COALESCE(${body.material ?? null}, material),
        thickness_cm = COALESCE(${body.thicknessCm ?? null}::numeric, thickness_cm),
        calculation_reference = COALESCE(${body.calculationReference ?? null}, calculation_reference),
        verification_date = COALESCE(${body.verificationDate ?? null}::date, verification_date),
        status = COALESCE(${body.status ?? null}, status)
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Blindaje no encontrado." }, { status: 404 });
    await logRadioterapiaAudit("update_rt_shielding", actorEmail, { id });
    return NextResponse.json({ ok: true, shielding: rows[0] });
  }

  const { rows } = await sql`
    UPDATE rt_bunkers SET
      name = COALESCE(${body.name ?? null}, name),
      linac_id = COALESCE(${body.linacId ?? null}, linac_id),
      design_reference = COALESCE(${body.designReference ?? null}, design_reference)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Bunker no encontrado." }, { status: 404 });
  await logRadioterapiaAudit("update_rt_bunker", actorEmail, { id });
  return NextResponse.json({ ok: true, bunker: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  const type = searchParams.get("type") || "bunker";
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });

  if (type === "shielding") {
    const { rows } = await sql`DELETE FROM rt_shielding WHERE id = ${id} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Blindaje no encontrado." }, { status: 404 });
    await logRadioterapiaAudit("delete_rt_shielding", null, { id });
    return NextResponse.json({ ok: true, deleted: rows[0] });
  }

  await sql`DELETE FROM rt_shielding WHERE bunker_id = ${id}`;
  const { rows } = await sql`DELETE FROM rt_bunkers WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Bunker no encontrado." }, { status: 404 });
  await logRadioterapiaAudit("delete_rt_bunker", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
