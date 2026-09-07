import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, listBlindajeSources, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 4 - Fuente de radiacion (S17): los campos pertinentes (energia,
// intensidad, actividad, geometria) se adaptan segun el tipo de instalacion
// (facility_type) en el formulario del cliente; aqui se guardan en columnas
// genericas de blindaje_sources sin asumir un esquema fijo para todas las
// modalidades (S11).
export async function GET(request: NextRequest) {
    await ensureBlindajeTables();
    const { searchParams } = new URL(request.url);
    const projectId = Number(searchParams.get("project_id"));
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    const sources = await listBlindajeSources(projectId);
    return NextResponse.json({ ok: true, sources });
}

export async function POST(request: NextRequest) {
    await ensureBlindajeTables();
    const body = await request.json();
    const projectId = Number(body.project_id);
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    if (!body.source_type) {
          return NextResponse.json({ ok: false, error: "source_type es obligatorio." }, { status: 400 });
    }

  const { rows } = await sql`
      INSERT INTO blindaje_sources (
            project_id, source_type, radionuclide, energy, activity, activity_unit,
                  dose_rate, dose_rate_unit, geometry
                      ) VALUES (
                            ${projectId}, ${body.source_type}, ${body.radionuclide || null}, ${body.energy || null},
                                  ${body.activity ? Number(body.activity) : null}, ${body.activity_unit || null},
                                        ${body.dose_rate ? Number(body.dose_rate) : null}, ${body.dose_rate_unit || null},
                                              ${body.geometry || null}
                                                  )
                                                      RETURNING *
                                                        `;
    const source = rows[0];
    if (!source) {
          return NextResponse.json({ ok: false, error: "No se pudo crear la fuente de radiacion." }, { status: 500 });
    }

  await logBlindajeAudit(
        "blindaje_sources",
        source.id,
        null,
        null,
        JSON.stringify(source),
        body.user_name || null,
        "Alta de fuente de radiacion (Paso 4 - Fuente de radiacion)",
        projectId
      );

  return NextResponse.json({ ok: true, source });
}
