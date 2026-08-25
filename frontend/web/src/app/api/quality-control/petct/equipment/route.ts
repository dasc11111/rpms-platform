import { NextRequest, NextResponse } from "next/server";
import {
  listPetCtEquipment,
  getPetCtEquipmentById,
  createPetCtEquipment,
  updatePetCtEquipment,
  ensurePetCtEquipmentTables,
} from "@/lib/qc-petct-equipment-db";

/**
 * MODULO 4 - PET/CT - FASE A
 * API de la ficha tecnica del equipo (seccion 3 del prompt de mejora).
 * GET sin parametros: lista equipos activos. GET ?id=N: un equipo puntual.
 * POST: crea un equipo nuevo. PUT: actualiza un equipo existente (por id).
 */

export async function GET(request: NextRequest) {
  try {
    await ensurePetCtEquipmentTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const equipment = await getPetCtEquipmentById(Number(id));
      if (!equipment) {
        return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
      }
      return NextResponse.json(equipment);
    }

    const equipment = await listPetCtEquipment();
    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/equipment:", error);
    return NextResponse.json({ error: "Error al obtener la ficha del equipo PET/CT" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePetCtEquipmentTables();
    const body = await request.json();
    const equipment = await createPetCtEquipment(body);
    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/petct/equipment:", error);
    return NextResponse.json({ error: "Error al crear la ficha del equipo PET/CT" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensurePetCtEquipmentTables();
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta el id del equipo a actualizar" }, { status: 400 });
    }
    const equipment = await updatePetCtEquipment(Number(id), data);
    if (!equipment) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error en PUT /api/quality-control/petct/equipment:", error);
    return NextResponse.json({ error: "Error al actualizar la ficha del equipo PET/CT" }, { status: 500 });
  }
}
