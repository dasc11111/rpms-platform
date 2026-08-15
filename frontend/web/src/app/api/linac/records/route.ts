import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac"; import { ensureRiskExtendedTables, classifyRiskLevel } from "@/lib/linac-risk";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["clinical", "radiation", "risk", "emergency", "audit"];

export async function GET(request: Request) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const linacId = searchParams.get("linacId");
  if (!type || !VALID_TYPES.includes(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  let rows: any[] = [];
  if (type === "clinical") {
    rows = (await sql`SELECT * FROM linac_clinical_operations WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int) ORDER BY op_date DESC, id DESC LIMIT 1000`).rows;
  } else if (type === "radiation") {
    rows = (await sql`SELECT * FROM linac_radiation_protection WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int) ORDER BY measurement_date DESC, id DESC LIMIT 1000`).rows;
  } else if (type === "risk") {
    await ensureRiskExtendedTables(); const riskRows = (await sql`SELECT * FROM linac_risks WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int) ORDER BY risk_level DESC NULLS LAST, id DESC LIMIT 1000`).rows; rows = riskRows.map((r: any) => ({ ...r, classification: classifyRiskLevel(r.risk_level).label }));
  } else if (type === "emergency") {
    rows = (await sql`SELECT * FROM linac_emergencies WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int) ORDER BY event_date DESC, id DESC LIMIT 1000`).rows;
  } else if (type === "audit") {
    rows = (await sql`SELECT * FROM linac_audits WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int) ORDER BY audit_date DESC, id DESC LIMIT 1000`).rows;
  }
  return NextResponse.json({ ok: true, records: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  const body = await request.json();
  const type = body.type;
  const linacId = Number(body.linacId);
  const actorEmail = body.actorEmail || null;
  if (!VALID_TYPES.includes(type) || !linacId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  let id = null;
  if (type === "clinical") {
    const { rows } = await sql`
      INSERT INTO linac_clinical_operations (linac_id, op_date, patients_treated, operating_hours, downtime_hours, interruptions, treatment_type, notes)
      VALUES (${linacId}, ${body.opDate}, ${body.patientsTreated || 0}, ${body.operatingHours || 0}, ${body.downtimeHours || 0}, ${body.interruptions || 0}, ${body.treatmentType || null}, ${body.notes || null})
      RETURNING id;
    `;
    id = rows[0]!.id;
  } else if (type === "radiation") {
    const { rows } = await sql`
      INSERT INTO linac_radiation_protection (linac_id, measurement_date, measurement_time, measurement_type, location, value, unit, instrument_ref, responsible, notes)
      VALUES (${linacId}, ${body.measurementDate}, ${body.measurementTime || null}, ${body.measurementType || null}, ${body.location || null}, ${body.value || null}, ${body.unit || null}, ${body.instrumentRef || null}, ${body.responsible || null}, ${body.notes || null})
      RETURNING id;
    `;
    id = rows[0]!.id;
  } else if (type === "risk") {
    await ensureRiskExtendedTables(); const freq = Number(body.frequency || 0);
    const cons = Number(body.consequence || 0);
    const level = freq * cons;
    const { rows } = await sql`
      INSERT INTO linac_risks (linac_id, risk, frequency, consequence, risk_level, responsible, mitigation, evidence, controls)
      VALUES (${linacId}, ${body.risk}, ${freq}, ${cons}, ${level}, ${body.responsible || null}, ${body.mitigation || null}, ${body.evidence || null}, ${body.controls || null})
      RETURNING id;
    `;
    id = rows[0]!.id;
  } else if (type === "emergency") {
    const { rows } = await sql`
      INSERT INTO linac_emergencies (linac_id, emergency_type, event_date, description, checklist, roles, responsible)
      VALUES (${linacId}, ${body.emergencyType || null}, ${body.eventDate}, ${body.description || null}, ${JSON.stringify(body.checklist || [])}::jsonb, ${JSON.stringify(body.roles || [])}::jsonb, ${body.responsible || null})
      RETURNING id;
    `;
    id = rows[0]!.id;
  } else if (type === "audit") {
    const { rows } = await sql`
      INSERT INTO linac_audits (linac_id, audit_type, audit_date, findings, nonconformities, actions, follow_up, status)
      VALUES (${linacId}, ${body.auditType || null}, ${body.auditDate}, ${body.findings || null}, ${body.nonconformities || null}, ${body.actions || null}, ${body.followUp || null}, ${body.status || "abierta"})
      RETURNING id;
    `;
    id = rows[0]!.id;
  }

  await logLinacAudit("create_linac_" + type, actorEmail, { linacId, id });
  return NextResponse.json({ ok: true, id });
}
