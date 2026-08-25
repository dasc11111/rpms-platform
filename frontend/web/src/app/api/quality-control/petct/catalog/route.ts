import { NextRequest, NextResponse } from "next/server";
import { listTestCatalog, getTestCatalogByCode, ensurePetCtArchitectureTables } from "@/lib/qc-petct-architecture-db";

/**
 * MODULO 4 - PET/CT - FASE A
 * API de solo lectura del catalogo configurable de pruebas (secciones 4 y
 * 25 del prompt de mejora). GET ?modality=PET|CT|PETCT filtra por modalidad.
 * GET ?code=PET-01 devuelve una prueba puntual del catalogo.
 * La edicion del catalogo (agregar/ajustar pruebas) se hace directamente en
 * la base de datos por el Fisico Medico; esta API no expone POST/PUT para
 * evitar que el catalogo normativo se modifique accidentalmente desde la UI.
 */
export async function GET(request: NextRequest) {
  try {
    await ensurePetCtArchitectureTables();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const modality = searchParams.get("modality") ?? undefined;

    if (code) {
      const entry = await getTestCatalogByCode(code);
      if (!entry) {
        return NextResponse.json({ error: "Prueba no encontrada en el catalogo" }, { status: 404 });
      }
      return NextResponse.json(entry);
    }

    const entries = await listTestCatalog(modality);
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/catalog:", error);
    return NextResponse.json({ error: "Error al obtener el catalogo de pruebas PET/CT" }, { status: 500 });
  }
}
