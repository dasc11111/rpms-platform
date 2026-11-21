import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 1 - ACTIVIMETRO - FASE D
 * API de alertas de control de calidad para el Activímetro.
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

interface ActivimetroAlert {
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
  precision: "Precisión (CV%)",
  exactitud: "Exactitud",
  linealidad: "Linealidad",
  respuesta_fondo: "Respuesta de Fondo",
  geometria_volumen: "Geometría y Volumen",
};

function testLabel(testType: string): string {
  return TEST_TYPE_LABELS[String(testType)] ?? testType;
}

function recommendedAction(alertType: AlertType, testType: string): string {
  const label = testLabel(testType);
  switch (alertType) {
    case "fuera_de_tolerancia":
      return `Suspender uso clínico del activímetro hasta verificar ${label}. Notificar al Físico Médico/OPR para evaluación inmediata, posible recalibración y registro en bitácora.`;
    case "advertencia":
      return `Revisar ${label} con el Físico Médico/OPR. Evaluar tendencia reciente y programar verificación adicional antes del próximo uso clínico.`;
    case "prueba_vencida":
      return `Realizar ${label} a la brevedad. Verificar si el activímetro fue usado sin QC vigente; registrar en bitácora si corresponde acción correctiva.`;
    case "prueba_sin_registro":
      return `Registrar la primera prueba de ${label} para este activímetro antes de iniciar su uso clínico.`;
    default:
      return `Revisar ${label}.`;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureActivimetroQcTables();

    const { searchParams } = new URL(request.url);
    const instrumentIdParam = searchParams.get("instrument_id");
    const instrumentId = instrumentIdParam ? Number(instrumentIdParam) : null;

    // Tolerancias activas — tomar la más reciente por test_type
    const { rows: tolerances } = await sql`
      SELECT DISTINCT ON (test_type)
        test_type, tolerance_percent, warning_percent, frequency_days
      FROM qc_activimetro_tolerances
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
        (array_agg(result_status ORDER BY test_date DESC, id DESC))[1] AS last_status
      FROM qc_activimetro_tests
      WHERE instrument_id IS NOT NULL
      ${instrumentId ? sql`AND instrument_id = ${instrumentId}` : sql``}
      GROUP BY instrument_id, instrument_name, test_type;
    `;

    type LastTestRow = {
      instrument_id: number | null;
      instrument_name: string | null;
      test_type: string;
      last_test_date: string | null;
      last_status: string | null;
    };

    type ToleranceRow = {
      test_type: string;
      tolerance_percent: number | null;
      warning_percent: number | null;
      frequency_days: number | null;
    };

    const alerts: ActivimetroAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Alertas por último resultado registrado
    for (const row of lastTests as LastTestRow[]) {
      const iName = row.instrument_name || "Activímetro s/n";
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

      // Alerta de prueba vencida
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

    // Pruebas sin registro por ningún instrumento
    for (const tol of tolerances as ToleranceRow[]) {
      const hasTest = (lastTests as LastTestRow[]).some(
        (r) =>
          r.test_type === tol.test_type &&
          (instrumentId === null || r.instrument_id === instrumentId)
      );
      if (!hasTest) {
        alerts.push({
          id: `sin_registro_${tol.test_type}`,
          instrument_id: instrumentId,
          instrument_name: "–",
          test_type: tol.test_type,
          severity: "baja",
          alert_type: "prueba_sin_registro",
          message: `No hay registros de ${testLabel(tol.test_type)} para este activímetro`,
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
    console.error("Error en GET /api/quality-control/activimetro/alerts:", error);
    return NextResponse.json({ error: "Error al calcular alertas del Activímetro" }, { status: 500 });
  }
}
