import { NextRequest, NextResponse } from "next/server";
import {
  ensureSpectArchitectureTables,
  listSpectEvidence,
  createSpectEvidence,
} from "@/lib/qc-spect-architecture-db";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * API de evidencia grafica y documental.
 * GET ?equipmentId=N[&testId=M]: lista evidencia filtrada.
 * POST: registrar referencia de nuevo archivo.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSpectArchitectureTables();
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipmentId");
    const testId = searchParams.get("testId");
    return NextResponse.json(
      await listSpectEvidence(
        equipmentId ? Number(equipmentId) : undefined,
        testId ? Number(testId) : undefined
      )
    );
  } catch (error) {
    console.error("GET /api/quality-control/spect/evidence:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSpectArchitectureTables();
    const body = await request.json();
    if (!body.file_url) {
      return NextResponse.json({ error: "Se requiere file_url" }, { status: 400 });
    }
    const result = await createSpectEvidence({
      equipment_id: body.equipment_id ?? null,
      test_id: body.test_id ?? null,
      evidence_type: body.evidence_type ?? "foto_equipo",
      file_name: body.file_name ?? null,
      file_url: body.file_url,
      description: body.description ?? null,
      uploaded_by: body.uploaded_by ?? null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/quality-control/spect/evidence:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
