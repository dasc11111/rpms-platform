import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 3 - SPECT - FASE D
 * Panel de cumplimiento de frecuencias para SPECT.
 *
 * GET ?instrument_id=N — filtra por instrumento (opcional)
 */

type ComplianceStatus = "overdue" | "upcoming" | "ok" | "sin_registro";

interface ComplianceRow {
  instrument_id: number | null;
  instrument_name: string;
  test_type: string;
  test_label: string;
  frequency_days: number;
  frequency_label: string;
  last_test_date: string | null;
  next_due_date: string | null;
  days_until_due: number | null;
  status: ComplianceStatus;
}

const TEST_TYPE_LABELS: Record<string, string> = {
  centro_rotacion: "Centro de Rotación (COR)",
  uniformidad_tomografica: "Uniformidad Tomográfica",
};

function testLabel(testType: string): string {
  return TEST_TYPE_LABELS[String(testType)] ?? testType;
}

function frequencyLabel(days: number): string {
  if (days <= 1) return "Diaria";
  if (days <= 7) return "Semanal";
  if (days <= 31) return "Mensual";
  if (days <= 92) return "Trimestral";
  return "Anual";
}

export async function GET(request: NextRequest) {
  try {
    await ensureSpectQcTables();

    const { searchParams } = new URL(request.url);
    const instrumentIdParam = searchParams.get("instrument_id");
    const instrumentId = instrumentIdParam ? Number(instrumentIdParam) : null;

    // Catálogo de tolerancias con frecuencia
    const { rows: toleranceRows } = await sql`
      SELECT DISTINCT ON (test_type)
        test_type, frequency_days
      FROM qc_spect_tolerances
      WHERE active = true AND frequency_days IS NOT NULL
      ORDER BY test_type, protocol_version DESC;
    `;

    type ToleranceRow = { test_type: string; frequency_days: number };

    // Instrumentos
    const { rows: instrumentRows } = instrumentId
      ? await sql`SELECT id, COALESCE(name,'Instrumento s/n') AS name FROM instruments WHERE id = ${instrumentId};`
      : await sql`SELECT id, COALESCE(name,'Instrumento s/n') AS name FROM instruments ORDER BY name;`;

    type InstrumentRow = { id: number; name: string };

    // Último test por instrumento + test_type
    const { rows: lastTests } = await sql`
      SELECT
        instrument_id,
        test_type,
        MAX(test_date) AS last_test_date
      FROM qc_spect_tests
      ${instrumentId ? sql`WHERE instrument_id = ${instrumentId}` : sql``}
      GROUP BY instrument_id, test_type;
    `;

    type LastTestRow = { instrument_id: number; test_type: string; last_test_date: string };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows: ComplianceRow[] = [];

    for (const instr of instrumentRows as InstrumentRow[]) {
      for (const tol of toleranceRows as ToleranceRow[]) {
        if (!tol.frequency_days) continue;

        const last = (lastTests as LastTestRow[]).find(
          (t) => t.instrument_id === instr.id && t.test_type === tol.test_type
        );

        if (!last?.last_test_date) {
          rows.push({
            instrument_id: instr.id,
            instrument_name: instr.name,
            test_type: tol.test_type,
            test_label: testLabel(tol.test_type),
            frequency_days: tol.frequency_days,
            frequency_label: frequencyLabel(tol.frequency_days),
            last_test_date: null,
            next_due_date: null,
            days_until_due: null,
            status: "sin_registro",
          });
          continue;
        }

        const lastDate = new Date(last.last_test_date);
        const nextDue = new Date(lastDate);
        nextDue.setDate(nextDue.getDate() + tol.frequency_days);
        const diffDays = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
        const warningWindow = Math.max(1, Math.round(tol.frequency_days * 0.15));
        const status: ComplianceStatus =
          diffDays < 0 ? "overdue" : diffDays <= warningWindow ? "upcoming" : "ok";

        rows.push({
          instrument_id: instr.id,
          instrument_name: instr.name,
          test_type: tol.test_type,
          test_label: testLabel(tol.test_type),
          frequency_days: tol.frequency_days,
          frequency_label: frequencyLabel(tol.frequency_days),
          last_test_date: last.last_test_date,
          next_due_date: nextDue.toISOString().slice(0, 10),
          days_until_due: diffDays,
          status,
        });
      }
    }

    const statusOrder: Record<ComplianceStatus, number> = { overdue: 0, sin_registro: 1, upcoming: 2, ok: 3 };
    rows.sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        a.instrument_name.localeCompare(b.instrument_name) ||
        a.test_type.localeCompare(b.test_type)
    );

    const summary = {
      overdue: rows.filter((r) => r.status === "overdue").length,
      upcoming: rows.filter((r) => r.status === "upcoming").length,
      sin_registro: rows.filter((r) => r.status === "sin_registro").length,
      ok: rows.filter((r) => r.status === "ok").length,
    };

    const catalogInfo = (toleranceRows as ToleranceRow[]).map((t) => ({
      test_type: t.test_type,
      test_label: testLabel(t.test_type),
      frequency_label: frequencyLabel(t.frequency_days),
      frequency_days: t.frequency_days,
    }));

    return NextResponse.json({
      rows,
      summary,
      catalog: catalogInfo,
      checkedAt: today.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error("Error en GET /api/quality-control/spect/compliance:", error);
    return NextResponse.json({ error: "Error al calcular cumplimiento de SPECT" }, { status: 500 });
  }
}
