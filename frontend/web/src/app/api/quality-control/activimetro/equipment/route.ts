import { NextRequest, NextResponse } from "next/server";
import {
  listActivimetroEquipment,
  getActivimetroEquipmentById,
  createActivimetroEquipment,
  updateActivimetroEquipment,
  ensureActivimetroArchitectureTables,
} from "@/lib/qc-activimetro-architecture-db";

/**
 * MODULO ACTIVIMETRO - FASE A
 * API de la ficha tecnica del equipo (seccion 3/4 del prompt maestro).
 * GET sin parametros: lista equipos activos. GET ?id=N: un equipo puntual.
 * POST: crea un equipo nuevo. PUT: actualiza un equipo existente (por id).
 */

export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const equipment = await getActivimetroEquipmentById(Number(id));
      if (!equipment) {
        return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
      }
      return NextResponse.json(equipment);
    }

    const equipment = await listActivimetroEquipment();
    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/equipment:", error);
    return NextResponse.json({ error: "Error al obtener la ficha del equipo" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const body = await request.json();
    const equipment = await createActivimetroEquipment(body);
    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/activimetro/equipment:", error);
    return NextResponse.json({ error: "Error al crear la ficha del equipo" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta el id del equipo a actualizar" }, { status: 400 });
    }
    const equipment = await updateActivimetroEquipment(Number(id), data);
    if (!equipment) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error en PUT /api/quality-control/activimetro/equipment:", error);
    return NextResponse.json({ error: "Error al actualizar la ficha del equipo" }, { status: 500 });
  }
}
