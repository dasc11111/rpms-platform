import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const kind = searchParams.get("kind");
  if (kind === "competency") {
    const { rows } = await sql`SELECT * FROM rt_competencies WHERE facility_id = ${facilityId} ORDER BY evaluation_date DESC`;
    return NextResponse.json({ ok: true, competencies: rows });
  }
  const { rows } = await sql`SELECT * FROM rt_trainings WHERE facility_id = ${facilityId} ORDER BY training_date DESC`;
  return NextResponse.json({ ok: true, trainings: rows });
}

export async function POST(request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  if (body.kind === "competency") {
    const { rows } = await sql`
      INSERT INTO rt_competencies (facility_id, worker_rut, worker_name, competency, evaluation_date, result, evaluator)
      VALUES (${body.facilityId}, ${body.workerRut || null}, ${body.workerName}, ${body.competency}, ${body.evaluationDate || null}, ${body.result || "competente"}, ${body.evaluator || null})
      RETURNING id;
    `;
    await logRadioterapiaAudit("create_rt_competency", actorEmail, { id: rows[0].id, facilityId: body.facilityId });
    return NextResponse.json({ ok: true, id: rows[0].id });
  }
  const { rows } = await sql`
    INSERT INTO rt_trainings (facility_id, worker_rut, worker_name, training_name, training_date, expiry_date, institution, status)
    VALUES (${body.facilityId}, ${body.workerRut || null}, ${body.workerName}, ${body.trainingName}, ${body.trainingDate || null}, ${body.expiryDate || null}, ${body.institution || null}, ${body.status || "vigente"})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_training", actorEmail, { id: rows[0].id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0].id });
}
