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
    if (!["simple", "detallada", "avanzada", "braquiterapia"].includes(inputMode)) {
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

export async function PATCH(request: NextRequest) {
  await ensureBlindajeTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE blindaje_workload SET
      input_mode = COALESCE(${body.input_mode ?? null}, input_mode),
      data = COALESCE(${body.data ? JSON.stringify(body.data) : null}::jsonb, data)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Carga de trabajo no encontrada." }, { status: 404 });
  await logBlindajeAudit("blindaje_workload", id, null, null, JSON.stringify(rows[0]), body.user_name || null, "Actualización de carga de trabajo", rows[0].project_id);
  return NextResponse.json({ ok: true, workload: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureBlindajeTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`DELETE FROM blindaje_workload WHERE id = ${id} RETURNING id, project_id, input_mode`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Carga de trabajo no encontrada." }, { status: 404 });
  await logBlindajeAudit("blindaje_workload", id, null, null, null, null, "Eliminación de carga de trabajo", rows[0].project_id);
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
