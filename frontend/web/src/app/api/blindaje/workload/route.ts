import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureBlindajeTables, listBlindajeWorkload, logBlindajeAudit } from "@/lib/blindaje";

export const dynamic = "force-dynamic";

// PASO 5 - Carga de trabajo (S18): existen 3 modos (simple, detallada,
// avanzada) que se adaptan en el formulario del cliente. Cada envio crea un
// nuevo registro (no se sobrescribe el historico, S35) con los datos en la
// columna JSONB "data" sin asumir un esquema fijo por modalidad (S11).
export async function GET(request: NextRequest) {
    await ensureBlindajeTables();
    const { searchParams } = new URL(request.url);
    const projectId = Number(searchParams.get("project_id"));
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    const workload = await listBlindajeWorkload(projectId);
    return NextResponse.json({ ok: true, workload });
}

export async function POST(request: NextRequest) {
    await ensureBlindajeTables();
    const body = await request.json();
    const projectId = Number(body.project_id);
    if (!projectId) {
          return NextResponse.json({ ok: false, error: "project_id es obligatorio." }, { status: 400 });
    }
    const inputMode = body.input_mode || "simple";
    if (!["simple", "detallada", "avanzada"].includes(inputMode)) {
          return NextResponse.json({ ok: false, error: "input_mode invalido." }, { status: 400 });
    }

  const { rows } = await sql`
      INSERT INTO blindaje_workload (project_id, input_mode, data)
          VALUES (${projectId}, ${inputMode}, ${JSON.stringify(body.data || {})})
              RETURNING *
                `;
    const workload = rows[0];
    if (!workload) {
          return NextResponse.json({ ok: false, error: "No se pudo guardar la carga de trabajo." }, { status: 500 });
    }

  await logBlindajeAudit(
        "blindaje_workload",
        workload.id,
        null,
        null,
        JSON.stringify(workload),
        body.user_name || null,
        "Alta de carga de trabajo (Paso 5, modo " + inputMode + ")",
        projectId
      );

  return NextResponse.json({ ok: true, workload });
}
