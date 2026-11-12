import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 3 - SPECT - FASE D
 * API de alertas de control de calidad para SPECT.
 * Calcula alertas basadas en: pruebas vencidas, sin registro,
 * resultados fuera de tolerancia y en advertencia.
 *
 * GET ?instrument_id=N — filtra por instrumento (opcional)
 */

type AlertSeverity = "alta" | "media" | "baja";
type AlertType =
  | "fuera_de_tolerancia"
  | "advertencia"
  | "prueba_vencida"
  | "prueba_sin_registro";

interface SpectAlert {
  id: string;
  instrument_id: number | null;
  instrument_name: string;
  test_type: string;
  severity: AlertSeverity;
  alert_type: AlertType;
  message: string;
  recommended_action: string;
  last_test_date: string | null;
  days_overdue: number | null;
}

const TEST_TYPE_LABELS: Record<string, string> = {
  centro_rotacion: "Centro de Rotación (COR)",
  uniformidad_tomografica: "Uniformidad Tomográfica",
};

function testLabel(testType: string): string {
  return TEST_TYPE_LABELS[String(testType)] ?? testType;
}

function recommendedAction(alertType: AlertType, testType: string): string {
  const label = testLabel(testType);
  switch (alertType) {
    case "fuera_de_tolerancia":
      return `Suspender adquisiciones SPECT hasta verificar ${label}. Contactar al Físico Médico para evaluación inmediata y corrección del sistema.`;
    case "advertencia":
      return `Revisar ${label} con el Físico Médico/OPR. Evaluar tendencia y programar mantenimiento preventivo.`;
    case "prueba_vencida":
      return `Realizar ${label} a la brevedad. Verificar que el equipo no esté siendo usado sin QC vigente.`;
    case "prueba_sin_registro":
      return `Registrar la primera prueba de ${label} para este instrumento SPECT.`;
    default:
      return `Revisar ${label}.`;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureSpectQcTables();

    const { searchParams } = new URL(request.url);
    const instrumentIdParam = searchParams.get("instrument_id");
    const instrumentId = instrumentIdParam ? Number(instrumentIdParam) : null;

    // Tolerancias activas
    const { rows: tolerances } = await sql`
      SELECT DISTINCT ON (test_type)
        test_type, tolerance_percent, tolerance_absolute, warning_percent, warning_absolute, frequency_days
      FROM qc_spect_tolerances
      WHERE active = true
      ORDER BY test_type, protocol_version DESC;
    `;

    // Último test por instrumento + test_type
    const { rows: lastTests } = await sql`
      SELECT
        instrument_id,
        instrument_name,
        test_type,
        MAX(test_date) AS last_test_date,
        (array_agg(result_status ORDER BY test_date DESC, id DESC))[1] AS last_status,
        (array_agg(percent_value ORDER BY test_date DESC, id DESC))[1] AS last_percent,
        (array_agg(absolute_difference ORDER BY test_date DESC, id DESC))[1] AS last_abs_diff
      FROM qc_spect_tests
      ${instrumentId ? sql`WHERE instrument_id = ${instrumentId}` : sql``}
      GROUP BY instrument_id, instrument_name, test_type;
    `;

    type LastTestRow = {
      instrument_id: number | null;
      instrument_name: string | null;
      test_type: string;
      last_test_date: string | null;
      last_status: string | null;
      last_percent: number | null;
      last_abs_diff: number | null;
    };

    type ToleranceRow = {
      test_type: string;
      tolerance_percent: number | null;
      tolerance_absolute: number | null;
      warning_percent: number | null;
      warning_absolute: number | null;
      frequency_days: number | null;
    };

    const alerts: SpectAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Alertas por último test
    for (const row of lastTests as LastTestRow[]) {
      const iName = row.instrument_name || "Instrumento s/n";
      const tol = (tolerances as ToleranceRow[]).find((t) => t.test_type === row.test_type);

      if (row.last_status === "no_cumple") {
        alerts.push({
          id: `no_cumple_${row.instrument_id}_${row.test_type}`,
          instrument_id: row.instrument_id,
          instrument_name: iName,
          test_type: row.test_type,
          severity: "alta",
          alert_type: "fuera_de_tolerancia",
          message: `${testLabel(row.test_type)} FUERA DE TOLERANCIA en ${iName} (último: ${row.last_test_date ?? "s/f"})`,
          recommended_action: recommendedAction("fuera_de_tolerancia", row.test_type),
          last_test_date: row.last_test_date,
          days_overdue: null,
        });
      }

      if (row.last_status === "advertencia") {
        alerts.push({
          id: `advertencia_${row.instrument_id}_${row.test_type}`,
          instrument_id: row.instrument_id,
          instrument_name: iName,
          test_type: row.test_type,
          severity: "media",
          alert_type: "advertencia",
          message: `${testLabel(row.test_type)} en zona de advertencia en ${iName} (último: ${row.last_test_date ?? "s/f"})`,
          recommended_action: recommendedAction("advertencia", row.test_type),
          last_test_date: row.last_test_date,
          days_overdue: null,
        });
      }

      if (tol?.frequency_days && row.last_test_date) {
        const lastDate = new Date(row.last_test_date);
        const nextDue = new Date(lastDate);
        nextDue.setDate(nextDue.getDate() + tol.frequency_days);
        const diffDays = Math.round((today.getTime() - nextDue.getTime()) / 86400000);
        if (diffDays > 0) {
          alerts.push({
            id: `vencida_${row.instrument_id}_${row.test_type}`,
            instrument_id: row.instrument_id,
            instrument_name: iName,
            test_type: row.test_type,
            severity: diffDays > 7 ? "alta" : "media",
            alert_type: "prueba_vencida",
            message: `${testLabel(row.test_type)} vencida en ${iName} hace ${diffDays} día${diffDays !== 1 ? "s" : ""}`,
            recommended_action: recommendedAction("prueba_vencida", row.test_type),
            last_test_date: row.last_test_date,
            days_overdue: diffDays,
          });
        }
      }
    }

    // Pruebas sin registro
    for (const tol of tolerances as ToleranceRow[]) {
      const hasTest = (lastTests as LastTestRow[]).some(
        (r) => r.test_type === tol.test_type && (instrumentId === null || r.instrument_id === instrumentId)
      );
      if (!hasTest) {
        alerts.push({
          id: `sin_registro_${tol.test_type}`,
          instrument_id: instrumentId,
          instrument_name: "–",
          test_type: tol.test_type,
          severity: "baja",
          alert_type: "prueba_sin_registro",
          message: `No hay registros de ${testLabel(tol.test_type)} para este instrumento`,
          recommended_action: recommendedAction("prueba_sin_registro", tol.test_type),
          last_test_date: null,
          days_overdue: null,
        });
      }
    }

    const severityOrder: Record<AlertSeverity, number> = { alta: 0, media: 1, baja: 2 };
    alerts.sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        a.instrument_name.localeCompare(b.instrument_name)
    );

    const summary = {
      alta: alerts.filter((a) => a.severity === "alta").length,
      media: alerts.filter((a) => a.severity === "media").length,
      baja: alerts.filter((a) => a.severity === "baja").length,
    };

    return NextResponse.json({ alerts, summary, checkedAt: today.toISOString() });
  } catch (error) {
    console.error("Error en GET /api/quality-control/spect/alerts:", error);
    return NextResponse.json({ error: "Error al calcular alertas de SPECT" }, { status: 500 });
  }
}
