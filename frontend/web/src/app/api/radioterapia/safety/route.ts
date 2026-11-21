import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

export async function POST(request: Request) {
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
    await logRadioterapiaAudit("create_rt_safety_check", actorEmail, { id: rows[0]!.id, deviceId: body.deviceId });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }
  const { rows } = await sql`
    INSERT INTO rt_safety_devices (bunker_id, device_type, name, location)
    VALUES (${body.bunkerId}, ${body.deviceType || null}, ${body.name || null}, ${body.location || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_safety_device", actorEmail, { id: rows[0]!.id, bunkerId: body.bunkerId });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}


export async function PATCH(request: NextRequest) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const id = Number(body.id);
  const kind = body.kind || "device";
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });

  if (kind === "check") {
    const { rows } = await sql`
      UPDATE rt_safety_device_checks SET
        check_date = COALESCE(${body.checkDate ?? null}::date, check_date),
        result = COALESCE(${body.result ?? null}, result),
        observations = COALESCE(${body.observations ?? null}, observations),
        responsible = COALESCE(${body.responsible ?? null}, responsible)
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Verificación no encontrada." }, { status: 404 });
    await logRadioterapiaAudit("update_rt_safety_check", body.actorEmail || null, { id });
    return NextResponse.json({ ok: true, check: rows[0] });
  }

  const { rows } = await sql`
    UPDATE rt_safety_devices SET
      device_type = COALESCE(${body.deviceType ?? null}, device_type),
      name = COALESCE(${body.name ?? null}, name),
      location = COALESCE(${body.location ?? null}, location),
      updated_at = now()
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Dispositivo no encontrado." }, { status: 404 });
  await logRadioterapiaAudit("update_rt_safety_device", body.actorEmail || null, { id });
  return NextResponse.json({ ok: true, device: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  const kind = searchParams.get("kind") || "device";
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });

  if (kind === "check") {
    const { rows } = await sql`DELETE FROM rt_safety_device_checks WHERE id = ${id} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Verificación no encontrada." }, { status: 404 });
    await logRadioterapiaAudit("delete_rt_safety_check", null, { id });
    return NextResponse.json({ ok: true, deleted: rows[0] });
  }

  // Cascade delete checks first
  await sql`DELETE FROM rt_safety_device_checks WHERE device_id = ${id}`;
  const { rows } = await sql`DELETE FROM rt_safety_devices WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Dispositivo no encontrado." }, { status: 404 });
  await logRadioterapiaAudit("delete_rt_safety_device", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
