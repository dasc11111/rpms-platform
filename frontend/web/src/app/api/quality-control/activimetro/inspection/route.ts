import { NextRequest, NextResponse } from "next/server";
import {
    listActivimetroInspections,
    getActivimetroInspectionById,
    createActivimetroInspection,
} from "@/lib/qc-activimetro-inspection-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-01: Inspeccion fisica y funcional
 * GET sin parametros: lista inspecciones (opcional ?equipment_id=N).
 * GET ?id=N: detalle de una inspeccion con sus items.
 * POST: registra una nueva inspeccion con su checklist.
 */
export async function GET(request: NextRequest) {
    try {
          const { searchParams } = new URL(request.url);
          const id = searchParams.get("id");
          const equipmentId = searchParams.get("equipment_id");

      if (id) {
              const result = await getActivimetroInspectionById(Number(id));
              if (!result) {
                        return NextResponse.json({ error: "Inspeccion no encontrada" }, { status: 404 });
              }
              return NextResponse.json(result);
      }

      const inspections = await listActivimetroInspections(equipmentId ? Number(equipmentId) : undefined);
          return NextResponse.json(inspections);
    } catch (error) {
          console.error("Error en GET /api/quality-control/activimetro/inspection:", error);
          return NextResponse.json({ error: "Error al obtener las inspecciones" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
          const body = await request.json();
          const inspection = await createActivimetroInspection(body);
          return NextResponse.json(inspection, { status: 201 });
    } catch (error) {
          console.error("Error en POST /api/quality-control/activimetro/inspection:", error);
          return NextResponse.json({ error: "Error al registrar la inspeccion" }, { status: 500 });
    }
}
