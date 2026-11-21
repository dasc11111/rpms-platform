import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 1 - ACTIVIMETRO - FASE D
 * API de tendencia y gráfico de control (Levey-Jennings) para el Activímetro.
 *
 * GET sin instrument_id/test_type: devuelve catálogo de métricas numéricas.
 * GET con instrument_id y test_type: devuelve serie histórica con ±2DE/±3DE.
 *
 * Métricas disponibles:
 * - precision      → cv_percent          (unidad: %)
 * - exactitud      → percent_difference  (unidad: %)
 * - linealidad     → percent_difference  (unidad: %)
 * - respuesta_fondo → mean_value         (unidad: unidades del equipo)
 * - geometria_volumen → percent_difference (unidad: %)
 */

const TREND_METRICS: Array<{
  test_type: string;
  label: string;
  column: string;
  unit: string;
}> = [
  {
    test_type: "precision",
    label: "Precisión — Coeficiente de Variación (%)",
    column: "cv_percent",
    unit: "%",
  },
  {
    test_type: "exactitud",
    label: "Exactitud — Diferencia porcentual (%)",
    column: "percent_difference",
    unit: "%",
  },
  {
    test_type: "linealidad",
    label: "Linealidad — Diferencia porcentual (%)",
    column: "percent_difference",
    unit: "%",
  },
  {
    test_type: "respuesta_fondo",
    label: "Respuesta de Fondo — Valor medio medido",
    column: "mean_value",
    unit: "u.a.",
  },
  {
    test_type: "geometria_volumen",
    label: "Geometría y Volumen — Diferencia porcentual (%)",
    column: "percent_difference",
    unit: "%",
  },
];

function mean(values: number[]): number {
  if (!values.length) return NaN;
  return values.reduce((a, v) => a + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroQcTables();

    const { searchParams } = new URL(request.url);
    const instrumentIdParam = searchParams.get("instrument_id");
    const testType = searchParams.get("test_type");

    if (!instrumentIdParam || !testType) {
      return NextResponse.json({ metrics: TREND_METRICS });
    }

    const instrumentId = Number(instrumentIdParam);
    if (!Number.isFinite(instrumentId)) {
      return NextResponse.json({ error: "instrument_id inválido" }, { status: 400 });
    }

    const metricDef = TREND_METRICS.find((m) => m.test_type === testType);
    if (!metricDef) {
      return NextResponse.json({ error: `No hay métrica definida para ${testType}` }, { status: 400 });
    }

    const { rows } = await sql`
      SELECT
        id,
        test_date,
        cv_percent,
        percent_difference,
        mean_value,
        result_status
      FROM qc_activimetro_tests
      WHERE instrument_id = ${instrumentId}
        AND test_type = ${testType}
      ORDER BY test_date ASC, id ASC;
    `;

    type TestRow = {
      id: number;
      test_date: string;
      cv_percent: number | null;
      percent_difference: number | null;
      mean_value: number | null;
      result_status: string;
    };

    const points: Array<{ record_id: number; performed_at: string; value: number }> = [];
    for (const row of rows as TestRow[]) {
      const raw = (row as Record<string, unknown>)[metricDef.column];
      const value = raw !== null && raw !== undefined ? Number(raw) : null;
      if (value === null || Number.isNaN(value)) continue;
      points.push({ record_id: row.id, performed_at: row.test_date, value });
    }

    if (points.length === 0) {
      return NextResponse.json({
        instrument_id: instrumentId,
        test_type: testType,
        label: metricDef.label,
        unit: metricDef.unit,
        series: null,
      });
    }

    const values = points.map((p) => p.value);
    const meanValue = mean(values);
    const sd = stddev(values);
    const hasLimits = sd > 0;

    type TrendPointStatus = "dentro_control" | "alerta_2de" | "fuera_control_3de";

    let previousDeviation: number | null = null;
    const statsPoints = points.map((p) => {
      const deviation = p.value - meanValue;
      let status: TrendPointStatus = "dentro_control";
      if (hasLimits) {
        const abs = Math.abs(deviation);
        if (abs > 3 * sd) status = "fuera_control_3de";
        else if (abs > 2 * sd) status = "alerta_2de";
      }
      let westgard_2_2de = false;
      if (
        hasLimits &&
        previousDeviation !== null &&
        Math.abs(previousDeviation) > 2 * sd &&
        Math.abs(deviation) > 2 * sd &&
        Math.sign(previousDeviation) === Math.sign(deviation)
      ) {
        westgard_2_2de = true;
      }
      previousDeviation = deviation;
      return { ...p, status, westgard_2_2de };
    });

    return NextResponse.json({
      instrument_id: instrumentId,
      test_type: testType,
      label: metricDef.label,
      unit: metricDef.unit,
      series: {
        n: points.length,
        mean_value: meanValue,
        stddev_value: sd,
        upper_warning_2de: hasLimits ? meanValue + 2 * sd : null,
        lower_warning_2de: hasLimits ? meanValue - 2 * sd : null,
        upper_action_3de: hasLimits ? meanValue + 3 * sd : null,
        lower_action_3de: hasLimits ? meanValue - 3 * sd : null,
        points: statsPoints,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/trend:", error);
    return NextResponse.json({ error: "Error al calcular tendencia del Activímetro" }, { status: 500 });
  }
}
