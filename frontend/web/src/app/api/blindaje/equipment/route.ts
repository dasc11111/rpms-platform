import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, listBlindajeEquipment, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 3 - Equipo (S16/S17): los campos pertinentes dependen de la modalidad
// (facility_type) del proyecto y se adaptan en el formulario del cliente;
// aqui se guardan en la columna JSONB "parameters" sin asumir un esquema
// fijo para todas las modalidades (S11).
export async function GET(request: NextRequest) {
    await ensureBlindajeTables();
    const { searchParams } = new URL(request.url);
    const projectId = Number(searchParams.get("project_id"));
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    const equipment = await listBlindajeEquipment(projectId);
    return NextResponse.json({ ok: true, equipment });
}

export async function POST(request: NextRequest) {
    await ensureBlindajeTables();
    const body = await request.json();
    const projectId = Number(body.project_id);
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    if (!body.equipment_type) {
          return NextResponse.json({ ok: false, error: "equipment_type es obligatorio." }, { status: 400 });
    }

  const { rows } = await sql`
      INSERT INTO blindaje_equipment (project_id, manufacturer, model, equipment_type, parameters)
          VALUES (
                ${projectId}, ${body.manufacturer || null}, ${body.model || null},
                      ${body.equipment_type}, ${JSON.stringify(body.parameters || {})}
                          )
                              RETURNING *
                                `;
    const equipment = rows[0];
    if (!equipment) {
          return NextResponse.json({ ok: false, error: "No se pudo crear el equipo." }, { status: 500 });
    }

  await logBlindajeAudit(
        "blindaje_equipment",
        equipment.id,
        null,
        null,
        JSON.stringify(equipment),
        body.user_name || null,
        "Alta de equipo (Paso 3 - Equipo)",
        projectId
      );

  return NextResponse.json({ ok: true, equipment });
}
