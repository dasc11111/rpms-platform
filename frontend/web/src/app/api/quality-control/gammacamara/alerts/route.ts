import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 2 - GAMMACAMARA - FASE D
 * API de alertas de control de calidad para la gammacámara.
 * Calcula alertas basadas en: pruebas vencidas (frecuencia superada),
 * pruebas sin registro, resultados fuera de tolerancia recientes,
 * y resultados con advertencia.
 *
 * GET ?instrument_id=N — filtra por instrumento (opcional)
 */

type AlertSeverity = "alta" | "media" | "baja";
type AlertType =
  | "fuera_de_tolerancia"
  | "advertencia"
  | "prueba_vencida"
  | "prueba_sin_registro"
  | "tendencia_progresiva";

interface GammaAlert {
  id: string;
  instrument_id: number | null;
  instrument_name: string;
  test_type: string;
  test_mode: string;
  severity: AlertSeverity;
  alert_type: AlertType;
  message: string;
  recommended_action: string;
  last_test_date: string | null;
  days_overdue: number | null;
}

const TEST_TYPE_LABELS: Record<string, string> = {
  uniformidad: "Uniformidad",
  resolucion: "Resolución espacial",
  sensibilidad: "Sensibilidad",
};

const TEST_MODE_LABELS: Record<string, string> = {
  intrinseca: "intrínseca",
  extrinseca: "extrínseca",
  na: "",
};

function testLabel(testType: string, testMode: string): string {
  const t = TEST_TYPE_LABELS[String(testType)] ?? testType;
  const m = TEST_MODE_LABELS[String(testMode)] ?? testMode;
  return m ? `${t} (${m})` : t;
}

function recommendedAction(alertType: AlertType, testType: string, testMode: string): string {
  const label = testLabel(testType, testMode);
  switch (alertType) {
    case "fuera_de_tolerancia":
      return `Suspender el uso clínico del equipo hasta verificar ${label}. Contactar al Físico Médico para evaluación inmediata.`;
    case "advertencia":
      return `Revisar ${label} con el Físico Médico/OPR. Evaluar tendencia y considerar mantenimiento preventivo.`;
    case "prueba_vencida":
      return `Realizar ${label} a la brevedad. Verificar que el equipo no esté siendo usado sin QC vigente.`;
    case "prueba_sin_registro":
      return `Registrar la primera prueba de ${label} para este instrumento.`;
    case "tendencia_progresiva":
      return `Monitorear ${label} con mayor frecuencia. Revisar fuentes de variación sistemática.`;
    default:
      return `Revisar ${label}.`;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureGammacamaraQcTables();

    const { searchParams } = new URL(request.url);
    const instrumentIdParam = searchParams.get("instrument_id");
    const instrumentId = instrumentIdParam ? Number(instrumentIdParam) : null;

    // Obtener tolerancias activas con frecuencia
    const { rows: tolerances } = await sql`
      SELECT DISTINCT ON (test_type, test_mode)
        test_type, test_mode, tolerance_percent, warning_percent, frequency_days
      FROM qc_gammacamara_tolerances
      WHERE active = true
      ORDER BY test_type, test_mode, protocol_version DESC;
    `;

    // Obtener instrumentos activos (con tests o todos si no hay filter)
    const { rows: instruments } = await sql`
      SELECT DISTINCT i.id, COALESCE(i.name, 'Instrumento s/n') AS name
      FROM instruments i
      ORDER BY i.name;
    `;

    const instrumentMap = new Map<number, string>(
      (instruments as Array<{ id: number; name: string }>).map((i) => [i.id, i.name])
    );

    // Último test por instrumento + test_type + test_mode
    const { rows: lastTests } = await sql`
      SELECT
        instrument_id,
        instrument_name,
        test_type,
        test_mode,
        MAX(test_date) AS last_test_date,
        (array_agg(result_status ORDER BY test_date DESC, id DESC))[1] AS last_status,
        (array_agg(percent_difference ORDER BY test_date DESC, id DESC))[1] AS last_percent_diff
      FROM qc_gammacamara_tests
      ${instrumentId ? sql`WHERE instrument_id = ${instrumentId}` : sql``}
      GROUP BY instrument_id, instrument_name, test_type, test_mode;
    `;

    type LastTestRow = {
      instrument_id: number | null;
      instrument_name: string | null;
      test_type: string;
      test_mode: string;
      last_test_date: string | null;
      last_status: string | null;
      last_percent_diff: number | null;
    };

    type ToleranceRow = {
      test_type: string;
      test_mode: string;
      tolerance_percent: number | null;
      warning_percent: number | null;
      frequency_days: number | null;
    };

    const alerts: GammaAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Alertas por último test
    for (const row of lastTests as LastTestRow[]) {
      const iName =
        row.instrument_name ||
        (row.instrument_id ? instrumentMap.get(row.instrument_id) : null) ||
        "Instrumento s/n";

      const tol = (tolerances as ToleranceRow[]).find(
        (t) => t.test_type === row.test_type && t.test_mode === row.test_mode
      );

      // Alerta: fuera de tolerancia
      if (row.last_status === "no_cumple") {
        alerts.push({
          id: `no_cumple_${row.instrument_id}_${row.test_type}_${row.test_mode}`,
          instrument_id: row.instrument_id,
          instrument_name: iName,
          test_type: row.test_type,
          test_mode: row.test_mode,
          severity: "alta",
          alert_type: "fuera_de_tolerancia",
          message: `${testLabel(row.test_type, row.test_mode)} FUERA DE TOLERANCIA en ${iName} (último: ${row.last_test_date ?? "s/f"})`,
          recommended_action: recommendedAction("fuera_de_tolerancia", row.test_type, row.test_mode),
          last_test_date: row.last_test_date,
          days_overdue: null,
        });
      }

      // Alerta: advertencia
      if (row.last_status === "advertencia") {
        alerts.push({
          id: `advertencia_${row.instrument_id}_${row.test_type}_${row.test_mode}`,
          instrument_id: row.instrument_id,
          instrument_name: iName,
          test_type: row.test_type,
          test_mode: row.test_mode,
          severity: "media",
          alert_type: "advertencia",
          message: `${testLabel(row.test_type, row.test_mode)} en zona de advertencia en ${iName} (último: ${row.last_test_date ?? "s/f"})`,
          recommended_action: recommendedAction("advertencia", row.test_type, row.test_mode),
          last_test_date: row.last_test_date,
          days_overdue: null,
        });
      }

      // Alerta: prueba vencida (si hay tolerancia con frecuencia)
      if (tol?.frequency_days && row.last_test_date) {
        const lastDate = new Date(row.last_test_date);
        const nextDue = new Date(lastDate);
        nextDue.setDate(nextDue.getDate() + tol.frequency_days);
        const diffDays = Math.round((today.getTime() - nextDue.getTime()) / 86400000);
        if (diffDays > 0) {
          alerts.push({
            id: `vencida_${row.instrument_id}_${row.test_type}_${row.test_mode}`,
            instrument_id: row.instrument_id,
            instrument_name: iName,
            test_type: row.test_type,
            test_mode: row.test_mode,
            severity: diffDays > 7 ? "alta" : "media",
            alert_type: "prueba_vencida",
            message: `${testLabel(row.test_type, row.test_mode)} vencida en ${iName} hace ${diffDays} día${diffDays !== 1 ? "s" : ""}`,
            recommended_action: recommendedAction("prueba_vencida", row.test_type, row.test_mode),
            last_test_date: row.last_test_date,
            days_overdue: diffDays,
          });
        }
      }
    }

    // Alertas: pruebas sin registro (cruzar tolerancias con tests existentes)
    for (const tol of tolerances as ToleranceRow[]) {
      const hasTest = (lastTests as LastTestRow[]).some(
        (r) =>
          r.test_type === tol.test_type &&
          r.test_mode === tol.test_mode &&
          (instrumentId === null || r.instrument_id === instrumentId)
      );
      if (!hasTest) {
        alerts.push({
          id: `sin_registro_${tol.test_type}_${tol.test_mode}`,
          instrument_id: instrumentId,
          instrument_name: "–",
          test_type: tol.test_type,
          test_mode: tol.test_mode,
          severity: "baja",
          alert_type: "prueba_sin_registro",
          message: `No hay registros de ${testLabel(tol.test_type, tol.test_mode)} para este instrumento`,
          recommended_action: recommendedAction("prueba_sin_registro", tol.test_type, tol.test_mode),
          last_test_date: null,
          days_overdue: null,
        });
      }
    }

    // Ordenar: alta → media → baja
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
    console.error("Error en GET /api/quality-control/gammacamara/alerts:", error);
    return NextResponse.json({ error: "Error al calcular alertas de Gammacámara" }, { status: 500 });
  }
}
