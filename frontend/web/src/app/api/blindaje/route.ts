import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBlindajeTables();
  const { rows } = await sql`SELECT * FROM blindaje_projects ORDER BY updated_at DESC`;
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  await ensureBlindajeTables();
  const body = await request.json();
  const {
    name, institution, service, unit, address, city,
    responsible, opr_name, medical_physicist, facility_type,
    project_number, version, created_by,
  } = body || {};

if (!name) {
  return NextResponse.json({ ok: false, error: "El nombre del proyecto es obligatorio" }, { status: 400 });
}

const { rows } = await sql`
INSERT INTO blindaje_projects
(name, institution, service, unit, address, city, responsible, opr_name, medical_physicist, facility_type, project_number, version, created_by)
VALUES
(${name}, ${institution || null}, ${service || null}, ${unit || null}, ${address || null}, ${city || null}, ${responsible || null}, ${opr_name || null}, ${medical_physicist || null}, ${facility_type || "diagnostico"}, ${project_number || null}, ${version || "1.0"}, ${created_by || null})
RETURNING *
`;

const project = rows[0];
  await logBlindajeAudit("blindaje_projects", project.id, null, null, JSON.stringify(project), created_by || null, "Creacion de proyecto (Paso 1 - Identificacion)");

return NextResponse.json({ ok: true, project });
}
