import { NextRequest, NextResponse } from "next/server";
import {
  ensureSpectArchitectureTables,
  getCurrentSpectBaseline,
  getSpectBaselineHistory,
  setSpectBaseline,
} from "@/lib/qc-spect-architecture-db";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * API de baseline por equipo / tipo de prueba / parametro.
 * GET ?testType=X&parameterName=Z[&equipmentId=N][&history=true]
 * POST: establecer nuevo baseline (el anterior queda en historico).
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSpectArchitectureTables();
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get("testType") ?? "";
    const parameterName = searchParams.get("parameterName") ?? "";
    const equipmentId = searchParams.get("equipmentId");
    const history = searchParams.get("history") === "true";

    if (!testType || !parameterName) {
      return NextResponse.json({ error: "Se requieren testType y parameterName" }, { status: 400 });
    }

    const eqId = equipmentId ? Number(equipmentId) : undefined;

    if (history) {
      return NextResponse.json(await getSpectBaselineHistory(testType, parameterName, eqId));
    }
    const current = await getCurrentSpectBaseline(testType, parameterName, eqId);
    return NextResponse.json(current ?? null);
  } catch (error) {
    console.error("GET /api/quality-control/spect/baseline:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSpectArchitectureTables();
    const body = await request.json();
    if (!body.test_type || !body.parameter_name) {
      return NextResponse.json({ error: "Se requieren test_type y parameter_name" }, { status: 400 });
    }
    const result = await setSpectBaseline({
      equipment_id: body.equipment_id ?? null,
      test_type: body.test_type,
      parameter_name: body.parameter_name,
      value: body.value ?? null,
      unit: body.unit ?? null,
      methodology: body.methodology ?? null,
      phantom: body.phantom ?? null,
      protocol: body.protocol ?? null,
      operator: body.operator ?? null,
      physicist_responsible: body.physicist_responsible ?? null,
      change_reason: body.change_reason ?? null,
      changed_by: body.changed_by ?? null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/quality-control/spect/baseline:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
