import { NextRequest, NextResponse } from "next/server";
import {
  createServiceEvent,
  listServiceEvents,
  updateServiceEventStatus,
  ensurePetCtArchitectureTables,
} from "@/lib/qc-petct-architecture-db";

/**
 * MODULO 4 - PET/CT - FASE A
 * API de eventos de servicio tecnico / control post-servicio (seccion 26).
 * GET ?equipmentId= lista eventos (todos si no se indica equipo).
 * POST registra una intervencion tecnica; si no se envia tests_required, el
 * sistema calcula automaticamente las pruebas marcadas freq_post_service en
 * el catalogo (el sistema solo lista las pruebas, nunca decide resultados
 * clinicos ni de mantenimiento).
 * PUT actualiza el estado (pendiente/en_progreso/completado) y opcionalmente
 * la lista de pruebas ya completadas.
 */
export async function GET(request: NextRequest) {
  try {
    await ensurePetCtArchitectureTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipmentId");
    const events = await listServiceEvents(equipmentId ? Number(equipmentId) : undefined);
    return NextResponse.json(events);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/service-events:", error);
    return NextResponse.json({ error: "Error al obtener los eventos de servicio PET/CT" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePetCtArchitectureTables();
    const body = await request.json();

    if (!body.service_type || !body.service_date) {
      return NextResponse.json({ error: "Se requieren service_type y service_date" }, { status: 400 });
    }

    const event = await createServiceEvent({
      equipment_id: body.equipment_id ?? null,
      service_type: body.service_type,
      component_affected: body.component_affected ?? null,
      service_date: body.service_date,
      technician: body.technician ?? null,
      work_order_number: body.work_order_number ?? null,
      description: body.description ?? null,
      tests_required: body.tests_required ?? null,
      created_by: body.created_by ?? null,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/petct/service-events:", error);
    return NextResponse.json({ error: "Error al registrar el evento de servicio PET/CT" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensurePetCtArchitectureTables();
    const body = await request.json();
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Se requieren id y status" }, { status: 400 });
    }
    const event = await updateServiceEventStatus(Number(body.id), body.status, body.tests_completed);
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    console.error("Error en PUT /api/quality-control/petct/service-events:", error);
    return NextResponse.json({ error: "Error al actualizar el evento de servicio PET/CT" }, { status: 500 });
  }
}
