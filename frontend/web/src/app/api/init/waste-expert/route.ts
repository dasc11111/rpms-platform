import { NextResponse } from "next/server";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

// Fase B - Sistema Experto de Gestion de Desechos Radiactivos (nuevo
// PROMPT MAESTRO DEFINITIVO). Crea/actualiza el esquema nuevo (waste_items,
// matriz de calibracion, criterios de contaminacion y de liberacion
// configurables, mediciones individuales, mapa de contaminacion, historial
// de estados, correcciones auditadas, autorizaciones) sin tocar ninguna
// tabla ni columna del modulo anterior (src/lib/waste.ts). Idempotente:
// puede ejecutarse mas de una vez sin efectos adversos.
export async function GET() {
    await ensureWasteExpertSchema();
    return NextResponse.json({ ok: true });
}
