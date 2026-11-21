import { NextRequest, NextResponse } from "next/server";
import { computePetCtAlerts } from "@/lib/qc-petct-alerts";
import { withRecommendedActions } from "@/lib/qc-petct-decision";

export const dynamic = "force-dynamic";

/**
 * MODULO 4 - PET/CT - FASE M / FASE N
 * API de inteligencia de alertas (seccion 29) + motor de decision (seccion
 * 30 del prompt de mejora). GET opcionalmente filtrado por equipment_id;
 * devuelve el listado de alertas ya ordenado por severidad, cada una con
 * su accion recomendada textual, junto con un resumen por severidad.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const equipmentIdParam = searchParams.get("equipment_id");
    const equipmentId = equipmentIdParam ? Number(equipmentIdParam) : undefined;

    const rawAlerts = await computePetCtAlerts(equipmentId);
    const alerts = withRecommendedActions(rawAlerts);

    const summary = {
      alta: alerts.filter((a) => a.severity === "alta").length,
      media: alerts.filter((a) => a.severity === "media").length,
      baja: alerts.filter((a) => a.severity === "baja").length,
    };

    return NextResponse.json({ alerts, summary, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/alerts:", error);
    return NextResponse.json({ error: "Error al calcular las alertas PET/CT" }, { status: 500 });
  }
}
