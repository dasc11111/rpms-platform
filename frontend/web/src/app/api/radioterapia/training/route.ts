import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit } from "@/lib/radioterapia";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  if (body.kind === "competency") {
    const { rows } = await sql`
      INSERT INTO rt_competencies (facility_id, worker_rut, worker_name, competency, evaluation_date, result, evaluator)
      VALUES (${body.facilityId}, ${body.workerRut || null}, ${body.workerName}, ${body.competency}, ${body.evaluationDate || null}, ${body.result || "competente"}, ${body.evaluator || null})
      RETURNING id;
    `;
    await logRadioterapiaAudit("create_rt_competency", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId });
    return NextResponse.json({ ok: true, id: rows[0]!.id });
  }
  const { rows } = await sql`
    INSERT INTO rt_trainings (facility_id, worker_rut, worker_name, training_name, training_date, expiry_date, institution, status)
    VALUES (${body.facilityId}, ${body.workerRut || null}, ${body.workerName}, ${body.trainingName}, ${body.trainingDate || null}, ${body.expiryDate || null}, ${body.institution || null}, ${body.status || "vigente"})
    RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_training", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}


export async function PATCH(request: NextRequest) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const id = Number(body.id);
  const type = body.type || "training";
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });

  if (type === "competency") {
    const { rows } = await sql`
      UPDATE rt_competencies SET
        worker_rut = COALESCE(${body.workerRut ?? null}, worker_rut),
        worker_name = COALESCE(${body.workerName ?? null}, worker_name),
        competency = COALESCE(${body.competency ?? null}, competency),
        evaluation_date = COALESCE(${body.evaluationDate ?? null}::date, evaluation_date),
        result = COALESCE(${body.result ?? null}, result),
        evaluator = COALESCE(${body.evaluator ?? null}, evaluator)
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Competencia no encontrada." }, { status: 404 });
    await logRadioterapiaAudit("update_rt_competency", body.actorEmail || null, { id });
    return NextResponse.json({ ok: true, competency: rows[0] });
  }

  const { rows } = await sql`
    UPDATE rt_trainings SET
      worker_rut = COALESCE(${body.workerRut ?? null}, worker_rut),
      worker_name = COALESCE(${body.workerName ?? null}, worker_name),
      training_name = COALESCE(${body.trainingName ?? null}, training_name),
      training_date = COALESCE(${body.trainingDate ?? null}::date, training_date),
      expiry_date = COALESCE(${body.expiryDate ?? null}::date, expiry_date),
      institution = COALESCE(${body.institution ?? null}, institution),
      status = COALESCE(${body.status ?? null}, status)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Capacitación no encontrada." }, { status: 404 });
  await logRadioterapiaAudit("update_rt_training", body.actorEmail || null, { id });
  return NextResponse.json({ ok: true, training: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  const type = searchParams.get("type") || "training";
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });

  if (type === "competency") {
    const { rows } = await sql`DELETE FROM rt_competencies WHERE id = ${id} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Competencia no encontrada." }, { status: 404 });
    await logRadioterapiaAudit("delete_rt_competency", null, { id });
    return NextResponse.json({ ok: true, deleted: rows[0] });
  }

  const { rows } = await sql`DELETE FROM rt_trainings WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Capacitación no encontrada." }, { status: 404 });
  await logRadioterapiaAudit("delete_rt_training", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
