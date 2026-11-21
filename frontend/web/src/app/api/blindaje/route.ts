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
  if (!project) {
    return NextResponse.json({ ok: false, error: "No se pudo crear el proyecto." }, { status: 500 });
  }
  await logBlindajeAudit("blindaje_projects", project.id, null, null, JSON.stringify(project), created_by || null, "Creacion de proyecto (Paso 1 - Identificacion)");

return NextResponse.json({ ok: true, project });
}

export async function PATCH(request: Request) {
  await ensureBlindajeTables();
  const body = await request.json().catch(() => ({}));
  const id = body.id ? Number(body.id) : null;
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

  const { rows } = await sql`
    UPDATE blindaje_projects SET
      name              = COALESCE(${body.name ?? null}, name),
      institution       = COALESCE(${body.institution ?? null}, institution),
      service           = COALESCE(${body.service ?? null}, service),
      unit              = COALESCE(${body.unit ?? null}, unit),
      address           = COALESCE(${body.address ?? null}, address),
      city              = COALESCE(${body.city ?? null}, city),
      responsible       = COALESCE(${body.responsible ?? null}, responsible),
      opr_name          = COALESCE(${body.opr_name ?? null}, opr_name),
      medical_physicist = COALESCE(${body.medical_physicist ?? null}, medical_physicist),
      facility_type     = COALESCE(${body.facility_type ?? null}, facility_type),
      project_number    = COALESCE(${body.project_number ?? null}, project_number),
      version           = COALESCE(${body.version ?? null}, version),
      updated_at        = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) return NextResponse.json({ ok: false, error: "Proyecto no encontrado" }, { status: 404 });
  await logBlindajeAudit("blindaje_projects", id, null, null, JSON.stringify(rows[0]), body.updated_by || null, "Actualización de proyecto");
  return NextResponse.json({ ok: true, project: rows[0] });
}

export async function DELETE(request: Request) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ? Number(searchParams.get("id")) : null;
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

  const { rows } = await sql`DELETE FROM blindaje_projects WHERE id = ${id} RETURNING id, name`;
  if (!rows.length) return NextResponse.json({ ok: false, error: "Proyecto no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
