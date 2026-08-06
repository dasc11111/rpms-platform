import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

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
  await logRadioterapiaAudit("create_rt_survey", actorEmail, { id: rows[0].id, bunkerId: body.bunkerId });
  return NextResponse.json({ ok: true, id: rows[0].id });
}
