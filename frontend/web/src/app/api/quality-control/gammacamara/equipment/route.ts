import { NextRequest, NextResponse } from "next/server";
import {
  ensureGammacamaraEquipmentTables,
  listGammacamaraEquipment,
  getGammacamaraEquipmentById,
  createGammacamaraEquipment,
  updateGammacamaraEquipment,
} from "@/lib/qc-gammacamara-equipment-db";

/**
 * MODULO 2 - GAMMACAMARA - FASE A
 * API de la ficha técnica del equipo (DS 133/1984 — registro de equipos
 * generadores de radiación; IAEA TECDOC-602).
 * GET sin parámetros: lista equipos activos.
 * GET ?id=N: un equipo puntual.
 * POST: crea un equipo nuevo.
 * PUT: actualiza un equipo existente (por id en el body).
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureGammacamaraEquipmentTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const equipment = await getGammacamaraEquipmentById(Number(id));
      if (!equipment) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
      return NextResponse.json(equipment);
    }
    return NextResponse.json(await listGammacamaraEquipment());
  } catch (error) {
    console.error("GET /api/quality-control/gammacamara/equipment:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureGammacamaraEquipmentTables();
    const body = await request.json();
    return NextResponse.json(await createGammacamaraEquipment(body), { status: 201 });
  } catch (error) {
    console.error("POST /api/quality-control/gammacamara/equipment:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureGammacamaraEquipmentTables();
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    const result = await updateGammacamaraEquipment(Number(id), data);
    if (!result) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/quality-control/gammacamara/equipment:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
