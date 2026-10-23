import { NextRequest, NextResponse } from "next/server";
import {
  ensureSpectEquipmentTables,
  listSpectServiceEvents,
  createSpectServiceEvent,
  updateSpectServiceEvent,
} from "@/lib/qc-spect-equipment-db";

/**
 * MODULO 2 - SPECT - FASE A
 * API de eventos de servicio técnico del equipo SPECT.
 * DS 133/1984: trazabilidad de mantenimientos de equipos radiológicos.
 * GET ?equipment_id=N: eventos de un equipo. GET sin params: todos.
 * POST: crear evento. PUT: actualizar estado/resultado.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSpectEquipmentTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipment_id");
    return NextResponse.json(
      await listSpectServiceEvents(equipmentId ? Number(equipmentId) : undefined)
    );
  } catch (error) {
    console.error("GET /api/quality-control/spect/service-events:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSpectEquipmentTables();
    const body = await request.json();
    return NextResponse.json(await createSpectServiceEvent(body), { status: 201 });
  } catch (error) {
    console.error("POST /api/quality-control/spect/service-events:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureSpectEquipmentTables();
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    const result = await updateSpectServiceEvent(Number(id), data);
    if (!result) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/quality-control/spect/service-events:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
