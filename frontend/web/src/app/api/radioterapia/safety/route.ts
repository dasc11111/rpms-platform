import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const bunkerId = searchParams.get("bunkerId");
  const deviceId = searchParams.get("deviceId");
  if (deviceId) {
    const { rows } = await sql`SELECT * FROM rt_safety_device_checks WHERE device_id = ${deviceId} ORDER BY id DESC`;
    return NextResponse.json({ ok: true, checks: rows });
  }
  const { rows } = await sql`SELECT * FROM rt_safety_devices WHERE bunker_id = ${bunkerId} ORDER BY id ASC`;
  return NextResponse.json({ ok: true, devices: rows });
}

export async function POST(request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  if (body.kind === "check") {
    const { rows } = await sql`
      INSERT INTO rt_safety_device_checks (device_id, check_date, result, observations, responsible)
      VALUES (${body.deviceId}, ${body.checkDate || null}, ${body.result || "conforme"}, ${body.observations || null}, ${body.responsible || actorEmail})
      RETURNING id;
    `;
    await sql`UPDATE rt_safety_devices SET status = ${body.result || "conforme"}, updated_at = now() WHERE id = ${body.deviceId}`;
    await logRadioterapiaAudit("create_rt_safety_check", actorEmail, { id: rows[0].id, deviceId: body.deviceId });
    return NextResponse.json({ ok: true, id: rows[0].id });
  }
  const { rows } = await sql`
    INSERT INTO rt_safety_devices (bunker_id, device_type, name, location)
    VALUES (${body.bunkerId}, ${body.deviceType || null}, ${body.name || null}, ${body.location || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_safety_device", actorEmail, { id: rows[0].id, bunkerId: body.bunkerId });
  return NextResponse.json({ ok: true, id: rows[0].id });
}
