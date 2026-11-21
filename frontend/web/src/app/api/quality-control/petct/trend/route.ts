import { NextRequest, NextResponse } from "next/server";
import { ensurePetTestsTables, listPetTests, type PetTestCode } from "@/lib/qc-petct-pet-tests-db";
import { ensureCtTestsTables, listCtTests, type CtTestCode } from "@/lib/qc-petct-ct-tests-db";
import { ensureJointTestsTables, listJointTests, type JointTestCode } from "@/lib/qc-petct-joint-tests-db";
import {
  TREND_METRICS,
  getTrendMetricDefinition,
  extractMetricValue,
  buildTrendSeries,
  type TrendPoint,
} from "@/lib/qc-petct-trend";

export const dynamic = "force-dynamic";

/**
 * MODULO 4 - PET/CT - FASE K
 * API de tendencia y grafico de control (Levey-Jennings), secciones 16-18
 * del prompt de mejora. Solo considera registros FINALIZADOS de las tres
 * tablas de resultados (PET, CT e interaccion PET/CT) segun a cual
 * pertenezca el codigo de prueba consultado (seccion 2: nunca se mezclan
 * parametros de PET, CT y PETCT).
 *
 * GET sin equipment_id/test_code: devuelve el listado de pruebas que
 * tienen un indicador numerico definido para este grafico (las
 * evaluaciones puramente por componente, ej. PET-05/CT-05/CT-12/
 * PET-CLINICO, no tienen indicador numerico unico y no aparecen aqui).
 *
 * GET con equipment_id y test_code: devuelve la serie historica y los
 * limites de control (2DE/3DE) para esa combinacion especifica.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const equipmentIdParam = searchParams.get("equipment_id");
    const testCode = searchParams.get("test_code");

    if (!equipmentIdParam || !testCode) {
      return NextResponse.json({
        metrics: TREND_METRICS.map((m) => ({ test_code: m.test_code, table: m.table, label: m.label, unit: m.unit })),
      });
    }

    const def = getTrendMetricDefinition(testCode);
    if (!def) {
      return NextResponse.json(
        { error: `La prueba ${testCode} no tiene un indicador numerico definido para el grafico de tendencia/control.` },
        { status: 400 }
      );
    }

    const equipmentId = Number(equipmentIdParam);
    if (!Number.isFinite(equipmentId)) {
      return NextResponse.json({ error: "equipment_id invalido" }, { status: 400 });
    }

    await Promise.all([ensurePetTestsTables(), ensureCtTestsTables(), ensureJointTestsTables()]);

    let records: Array<{
      id: number;
      performed_at: string;
      is_finalized: boolean;
      calculated: Record<string, unknown>;
      raw_inputs: Record<string, unknown>;
    }> = [];

    if (def.table === "pet") {
      records = await listPetTests({ equipment_id: equipmentId, test_code: testCode as PetTestCode });
    } else if (def.table === "ct") {
      records = await listCtTests({ equipment_id: equipmentId, test_code: testCode as CtTestCode });
    } else {
      records = await listJointTests({ equipment_id: equipmentId, test_code: testCode as JointTestCode });
    }

    const finalized = records
      .filter((r) => r.is_finalized)
      .sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime());

    const points: TrendPoint[] = [];
    for (const r of finalized) {
      const value = extractMetricValue(def, r);
      if (value === null) continue;
      points.push({ record_id: r.id, performed_at: r.performed_at, value });
    }

    const series = buildTrendSeries(points);

    return NextResponse.json({
      equipment_id: equipmentId,
      test_code: testCode,
      label: def.label,
      unit: def.unit,
      series,
    });
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/trend:", error);
    return NextResponse.json({ error: "Error al calcular la tendencia PET/CT" }, { status: 500 });
  }
}
