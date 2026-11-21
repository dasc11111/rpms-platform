import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const bunkerId = searchParams.get("bunkerId");
  const { rows } = await sql`SELECT * FROM rt_radiation_surveys WHERE bunker_id = ${bunkerId} ORDER BY survey_date DESC`;
  return NextResponse.json({ ok: true, surveys: rows });
}

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO rt_radiation_surveys (bunker_id, survey_date, location, measured_value, unit, instrument_ref, responsible, observations)
    VALUES (${body.bunkerId}, ${body.surveyDate || null}, ${body.location || null}, ${body.measuredValue || null}, ${body.unit || "uSv/h"}, ${body.instrumentRef || null}, ${body.responsible || actorEmail}, ${body.observations || null})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_survey", actorEmail, { id: rows[0]!.id, bunkerId: body.bunkerId });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}


export async function PATCH(request: NextRequest) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE rt_radiation_surveys SET
      survey_date = COALESCE(${body.surveyDate ?? null}::date, survey_date),
      location = COALESCE(${body.location ?? null}, location),
      measured_value = COALESCE(${body.measuredValue ?? null}::numeric, measured_value),
      unit = COALESCE(${body.unit ?? null}, unit),
      instrument_ref = COALESCE(${body.instrumentRef ?? null}, instrument_ref),
      responsible = COALESCE(${body.responsible ?? null}, responsible),
      observations = COALESCE(${body.observations ?? null}, observations)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Levantamiento no encontrado." }, { status: 404 });
  await logRadioterapiaAudit("update_rt_survey", body.actorEmail || null, { id });
  return NextResponse.json({ ok: true, survey: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM rt_radiation_surveys WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Levantamiento no encontrado." }, { status: 404 });
  await logRadioterapiaAudit("delete_rt_survey", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
