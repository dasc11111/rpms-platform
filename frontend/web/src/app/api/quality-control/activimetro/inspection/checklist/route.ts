import { NextResponse } from "next/server";
import { listActivimetroInspectionChecklist } from "@/lib/qc-activimetro-inspection-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-01
 * Devuelve el catalogo configurable de items del checklist de inspeccion
 * fisica y funcional (seccion 6 del prompt maestro).
 */
export async function GET() {
    try {
          const items = await listActivimetroInspectionChecklist();
          return NextResponse.json(items);
    } catch (error) {
          console.error("Error en GET /api/quality-control/activimetro/inspection/checklist:", error);
          return NextResponse.json({ error: "Error al obtener el checklist de inspeccion" }, { status: 500 });
    }
}
