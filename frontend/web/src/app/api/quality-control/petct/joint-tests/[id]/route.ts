import { NextRequest, NextResponse } from "next/server";
import {
  getJointTestById,
  listJointVersionChain,
  finalizeJointTest,
  updateDraftJointTest,
  createCorrectedJointVersion,
  ensureJointTestsTables,
} from "@/lib/qc-petct-joint-tests-db";

/**
 * MODULO 4 - PET/CT - FASE D
 * API de un resultado puntual de prueba de interaccion PET/CT (por id).
 *
 * GET: registro + cadena de versiones (correcciones previas, seccion 34).
 * PUT: tres acciones distintas segun body.action (seccion 33 del prompt):
 * - "finalizar": el OPR/Fisico Medico cierra el borrador (is_finalized=true).
 * - "editar_borrador": mientras no este finalizado, edita el mismo registro.
 * - "corregir_finalizado": si ya estaba finalizado, crea un NUEVO registro
 *   (nunca modifica el original) con motivo y usuario de la correccion.
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureJointTestsTables();
    const { id: idParam } = await params;
    const id = Number(idParam);
    const record = await getJointTestById(id);
    if (!record) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }
    const versionChain = await listJointVersionChain(id);
    return NextResponse.json({ ...record, version_chain: versionChain });
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/joint-tests/[id]:", error);
    return NextResponse.json({ error: "Error al obtener el registro" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureJointTestsTables();
    const { id: idParam } = await params;
    const id = Number(idParam);
    const body = await request.json();

    if (body.action === "finalizar") {
      if (!body.finalized_by) {
        return NextResponse.json({ error: "Falta finalized_by (quien finaliza el control)" }, { status: 400 });
      }
      const updated = await finalizeJointTest(id, body.finalized_by);
      if (!updated) {
        return NextResponse.json(
          { error: "El registro no existe o ya estaba finalizado" },
          { status: 409 }
        );
      }
      return NextResponse.json(updated);
    }

    if (body.action === "editar_borrador") {
      const updated = await updateDraftJointTest(id, body);
      if (!updated) {
        return NextResponse.json(
          { error: "El registro no existe o ya esta finalizado (use corregir_finalizado)" },
          { status: 409 }
        );
      }
      return NextResponse.json(updated);
    }

    if (body.action === "corregir_finalizado") {
      if (!body.edit_reason || !body.edited_by) {
        return NextResponse.json(
          { error: "La correccion de un registro finalizado requiere edit_reason y edited_by" },
          { status: 400 }
        );
      }
      const corrected = await createCorrectedJointVersion(id, body.patch ?? {}, body.edit_reason, body.edited_by);
      if (!corrected) {
        return NextResponse.json({ error: "Registro original no encontrado" }, { status: 404 });
      }
      return NextResponse.json(corrected, { status: 201 });
    }

    return NextResponse.json(
      { error: "action invalida. Use finalizar, editar_borrador o corregir_finalizado." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en PUT /api/quality-control/petct/joint-tests/[id]:", error);
    return NextResponse.json({ error: "Error al actualizar el registro" }, { status: 500 });
  }
}
