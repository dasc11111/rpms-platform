import { NextRequest, NextResponse } from "next/server";
import {
  listActivimetroAuditLog,
  listActivimetroAuditLogRecent,
  ensureActivimetroArchitectureTables,
} from "@/lib/qc-activimetro-architecture-db";

/**
 * MODULO ACTIVIMETRO - FASE C
 * API de la bitacora de auditoria (seccion 40 del prompt maestro):
 * bitacora generica y reutilizable, de solo lectura desde esta pantalla.
 * Los registros se generan automaticamente como efecto de otras acciones
 * del sistema (por ejemplo, al modificar un baseline); esta API no
 * permite crear ni editar registros manualmente.
 *
 * GET ?entityType=&entityId= devuelve la bitacora de una entidad
 * especifica. Sin esos parametros, devuelve los cambios mas recientes
 * de cualquier entidad (?limit=, por defecto 200).
 */
export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const limit = searchParams.get("limit");

    if (entityType && entityId) {
      const rows = await listActivimetroAuditLog(entityType, Number(entityId));
      return NextResponse.json(rows);
    }

    const rows = await listActivimetroAuditLogRecent(limit ? Number(limit) : 200);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/audit:", error);
    return NextResponse.json({ error: "Error al obtener la bitacora de auditoria" }, { status: 500 });
  }
}
