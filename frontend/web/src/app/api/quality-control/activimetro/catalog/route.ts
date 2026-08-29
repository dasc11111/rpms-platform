import { NextRequest, NextResponse } from "next/server";
import { listActivimetroTestCatalog, getActivimetroTestCatalogByCode, ensureActivimetroArchitectureTables } from "@/lib/qc-activimetro-architecture-db";

/**
 * MODULO ACTIVIMETRO - FASE A
 * API de solo lectura del catalogo configurable ACTIV-01 a ACTIV-07
 * (seccion 4 del prompt maestro). GET ?code=ACTIV-02 devuelve una prueba
 * puntual. Sin POST/PUT: el catalogo normativo se ajusta directamente en
 * la base de datos por el Fisico Medico, para evitar modificaciones
 * accidentales desde la UI.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (code) {
      const entry = await getActivimetroTestCatalogByCode(code);
      if (!entry) {
        return NextResponse.json({ error: "Prueba no encontrada en el catalogo" }, { status: 404 });
      }
      return NextResponse.json(entry);
    }

    const entries = await listActivimetroTestCatalog();
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/catalog:", error);
    return NextResponse.json({ error: "Error al obtener el catalogo de pruebas" }, { status: 500 });
  }
}
