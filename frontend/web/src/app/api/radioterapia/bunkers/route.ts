import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

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
    await logRadioterapiaAudit("create_rt_shielding", actorEmail, { id: rows[0].id, bunkerId: body.bunkerId });
    return NextResponse.json({ ok: true, id: rows[0].id });
  }
  const { rows } = await sql`
    INSERT INTO rt_bunkers (facility_id, linac_id, name, design_reference)
    VALUES (${body.facilityId}, ${body.linacId || null}, ${body.name || null}, ${body.designReference || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_bunker", actorEmail, { id: rows[0].id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0].id });
}
