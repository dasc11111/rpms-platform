import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeSlabsTable, listBlindajeSlabs, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 12 - Losas de techo y piso / Skyshine (S31): cada losa (techo
// o piso) se asocia a un proyecto y, opcionalmente, a una barrera.
// Registra tipo de losa, espesor, material, ocupacion del lado
// opuesto y distancia al limite del predio, relevante para el
// analisis de radiacion dispersa hacia el cielo (skyshine), sin
// inventar valores (S55, S61). El resultado/estado se declara
// explicitamente, nunca solo por color (S39).
export async function GET(request: NextRequest) {
    await ensureBlindajeSlabsTable();
    const { searchParams } = new URL(request.url);
    const projectId = Number(searchParams.get("project_id"));
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    const slabs = await listBlindajeSlabs(projectId);
    return NextResponse.json({ ok: true, slabs });
}

export async function POST(request: NextRequest) {
    await ensureBlindajeSlabsTable();
    const body = await request.json();
    const projectId = Number(body.project_id);
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    if (!body.code || !String(body.code).trim() || !body.name || !String(body.name).trim()) {
          return NextResponse.json({ ok: false, error: "El codigo y el nombre de la losa son obligatorios." }, { status: 400 });
    }

  const { rows } = await sql`
      INSERT INTO blindaje_slabs (
            project_id, barrier_id, code, name, location, slab_type, thickness_cm,
                  material, occupancy_above, distance_property_line_m, result_value, result_unit,
                        result_status, source_document, notes
                            ) VALUES (
                                  ${projectId}, ${body.barrier_id || null}, ${body.code}, ${body.name}, ${body.location || null},
                                        ${body.slab_type || null}, ${body.thickness_cm || null}, ${body.material || null},
                                              ${body.occupancy_above || null}, ${body.distance_property_line_m || null}, ${body.result_value || null}, ${body.result_unit || null},
                                                    ${body.result_status || "sin_informacion"}, ${body.source_document || null}, ${body.notes || null}
                                                        )
                                                            RETURNING *
                                                              `;
    const slabRow = rows[0];
    if (!slabRow) {
          return NextResponse.json({ ok: false, error: "No se pudo guardar la losa." }, { status: 500 });
    }

  await logBlindajeAudit(
        "blindaje_slabs",
        slabRow.id,
        null,
        null,
        JSON.stringify(slabRow),
        body.user_name || null,
        "Alta de losa (Paso 12, S31)",
        projectId
      );

  return NextResponse.json({ ok: true, slab: slabRow });
}
