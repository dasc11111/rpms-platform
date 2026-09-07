import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, getBlindajeProject, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    await ensureBlindajeTables();
    const id = Number(params.id);
    const project = await getBlindajeProject(id);
    if (!project) {
          return NextResponse.json({ ok: false, error: "Proyecto no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, project });
}

// PASO 2 - Tipo de instalacion (S16): unico campo editable en este endpoint
// es facility_type. Toda edicion queda auditada (S35) con valor anterior/nuevo.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    await ensureBlindajeTables();
    const id = Number(params.id);
    const existing = await getBlindajeProject(id);
    if (!existing) {
          return NextResponse.json({ ok: false, error: "Proyecto no encontrado." }, { status: 404 });
    }
    const body = await request.json();
    if (!body.facility_type) {
          return NextResponse.json({ ok: false, error: "facility_type es obligatorio." }, { status: 400 });
    }

  const { rows } = await sql`
      UPDATE blindaje_projects
          SET facility_type = ${body.facility_type}, updated_at = now()
              WHERE id = ${id}
                  RETURNING *
                    `;
    const project = rows[0];
    if (!project) {
          return NextResponse.json({ ok: false, error: "No se pudo actualizar el proyecto." }, { status: 500 });
    }

  await logBlindajeAudit(
        "blindaje_projects",
        id,
        "facility_type",
        existing.facility_type,
        body.facility_type,
        body.user_name || null,
        body.reason || "Edicion de Paso 2 - Tipo de instalacion",
        id
      );

  return NextResponse.json({ ok: true, project });
}
