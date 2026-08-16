import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, logRadioterapiaAudit, getRiskClassification } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const status = searchParams.get("status");

  const { rows } = facilityId
  ? await sql`SELECT * FROM rt_risks WHERE facility_id = ${facilityId} ORDER BY created_at DESC`
  : await sql`SELECT * FROM rt_risks ORDER BY created_at DESC`;

  let risks = rows.map((r: any) => ({
    ...r,
    classification: getRiskClassification(r.probability, r.severity),
    }));

  if (status) risks = risks.filter((r: any) => r.status === status);

  const openRisks = risks.filter((r: any) => r.status !== "cerrado");
  const summary = {
    total: risks.length,
    abiertos: openRisks.length,
    bajo: risks.filter((r: any) => r.classification.level === "bajo").length,
    moderado: risks.filter((r: any) => r.classification.level === "moderado").length,
    alto: risks.filter((r: any) => r.classification.level === "alto").length,
    muyAlto: risks.filter((r: any) => r.classification.level === "muy_alto").length,
    controlados: risks.filter((r: any) => r.status === "controlado").length,
    cerrados: risks.filter((r: any) => r.status === "cerrado").length,
    };

  const matrix: Record<string, Record<string, number>> = {};
  for (let p = 1; p <= 5; p++) {
    matrix[p] = {};
    for (let s = 1; s <= 5; s++) {
      matrix[p][s] = 0;
      }
    }
  for (const r of risks) {
    const p = Number(r.probability);
    const s = Number(r.severity);
    if (p >= 1 && p <= 5 && s >= 1 && s <= 5) {
      matrix[p][s] = (matrix[p][s] || 0) + 1;
      }
    }

  return NextResponse.json({ ok: true, risks, summary, matrix });
  }

export async function POST(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
  INSERT INTO rt_risks (
    facility_id, linac_id, description, area, equipment, process, cause, consequence,
    probability, severity, existing_control, action, responsible, due_date, status, evidence_url
    )
  VALUES (
    ${body.facilityId}, ${body.linacId || null}, ${body.description || null}, ${body.area || null},
    ${body.equipment || null}, ${body.process || null}, ${body.cause || null}, ${body.consequence || null},
    ${body.probability || 1}, ${body.severity || 1}, ${body.existingControl || null}, ${body.action || null},
    ${body.responsible || null}, ${body.dueDate || null}, ${body.status || "identificado"}, ${body.evidenceUrl || null}
    )
  RETURNING id;
  `;
  await logRadioterapiaAudit("create_rt_risk", actorEmail, { id: rows[0]!.id, facilityId: body.facilityId });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
  }

export async function PATCH(request: Request) {
  await ensureRadioterapiaTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const existingRes = await sql`SELECT * FROM rt_risks WHERE id = ${body.id}`;
  const existing = existingRes.rows[0];
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await sql`
  UPDATE rt_risks SET
  description = ${body.description ?? existing.description},
  area = ${body.area ?? existing.area},
  equipment = ${body.equipment ?? existing.equipment},
  process = ${body.process ?? existing.process},
  cause = ${body.cause ?? existing.cause},
  consequence = ${body.consequence ?? existing.consequence},
  probability = ${body.probability ?? existing.probability},
  severity = ${body.severity ?? existing.severity},
  existing_control = ${body.existingControl ?? existing.existing_control},
  action = ${body.action ?? existing.action},
  responsible = ${body.responsible ?? existing.responsible},
  due_date = ${body.dueDate ?? existing.due_date},
  status = ${body.status ?? existing.status},
  evidence_url = ${body.evidenceUrl ?? existing.evidence_url},
  updated_at = now()
  WHERE id = ${body.id}
  `;
  await logRadioterapiaAudit("update_rt_risk", actorEmail, { id: body.id, fromStatus: existing.status, toStatus: body.status ?? existing.status });
  return NextResponse.json({ ok: true });
  }
