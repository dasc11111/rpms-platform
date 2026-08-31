import { NextRequest, NextResponse } from "next/server";
import {
  addActivimetroEvidence,
  listActivimetroEvidence,
  ensureActivimetroArchitectureTables,
} from "@/lib/qc-activimetro-architecture-db";

/**
 * MODULO ACTIVIMETRO - FASE C
 * API de evidencia grafica/documental asociada a una prueba o a un equipo
 * (seccion 31 del prompt maestro). El archivo en si se administra fuera de
 * esta tabla (almacenamiento externo de blobs); aqui solo se guarda la
 * referencia/URL y los metadatos (tipo, nombre, descripcion, quien la
 * subio y cuando).
 *
 * GET ?testId=&equipmentId= filtra la lista; sin parametros devuelve las
 * ultimas 200 entradas.
 * POST registra una nueva referencia de evidencia.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get("testId");
    const equipmentId = searchParams.get("equipmentId");

    const rows = await listActivimetroEvidence(
      testId ? Number(testId) : undefined,
      equipmentId ? Number(equipmentId) : undefined
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/evidence:", error);
    return NextResponse.json({ error: "Error al obtener la evidencia" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureActivimetroArchitectureTables();
    const body = await request.json();

    if (!body.evidence_type) {
      return NextResponse.json({ error: "Se requiere evidence_type" }, { status: 400 });
    }
    if (!body.file_url) {
      return NextResponse.json({ error: "Se requiere file_url (referencia externa del archivo)" }, { status: 400 });
    }

    const evidence = await addActivimetroEvidence({
      test_id: body.test_id ?? null,
      equipment_id: body.equipment_id ?? null,
      evidence_type: body.evidence_type,
      file_name: body.file_name ?? null,
      file_url: body.file_url,
      description: body.description ?? null,
      uploaded_by: body.uploaded_by ?? null,
    });

    return NextResponse.json(evidence, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/quality-control/activimetro/evidence:", error);
    return NextResponse.json({ error: "Error al registrar la evidencia" }, { status: 500 });
  }
}
