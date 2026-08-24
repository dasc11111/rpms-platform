import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 2 - GAMMACAMARA
 * Endpoint de avisos anticipados y alertas de retraso de pruebas de Control
 * de Calidad, segun la frecuencia configurada en qc_gammacamara_tolerances
 * (frequency_days). Mismo requisito y misma logica que el endpoint analogo
 * de Modulo 1 (Activimetro), aplicado a las combinaciones prueba + modo
 * (por ejemplo: uniformidad intrinseca vs. uniformidad extrinseca tienen
 * frecuencias distintas).
 *
 * Estados devueltos por combinacion equipo + prueba + modo:
 * - overdue: la fecha limite (ultima prueba + frequency_days) ya paso.
 * - upcoming: la fecha limite esta dentro de la ventana de aviso anticipado.
 * - sin_registro: nunca se ha registrado esta prueba para este equipo.
 * - ok: no requiere aviso (no se incluye en la respuesta).
 */

type DueAlert = {
  instrumentId: number;
  instrumentCode: string | null;
  instrumentName: string | null;
  testType: string;
  testMode: string;
  frequencyDays: number;
  lastTestDate: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  status: "overdue" | "upcoming" | "sin_registro";
};

export async function GET(request: Request) {
  await ensureGammacamaraQcTables();
  const { searchParams } = new URL(request.url);
  const instrumentIdParam = searchParams.get("instrumentId");

  const { rows: tolerances } = await sql`
    SELECT DISTINCT test_type, test_mode, frequency_days
    FROM qc_gammacamara_tolerances
    WHERE active = true AND frequency_days IS NOT NULL
  `;

  const { rows: instrumentsAll } = await sql`SELECT id, code, name FROM instruments ORDER BY name ASC`;
  const instruments = instrumentIdParam
    ? instrumentsAll.filter((i: any) => String(i.id) === instrumentIdParam)
    : instrumentsAll;

  const { rows: lastTests } = await sql`
    SELECT instrument_id, test_type, test_mode, MAX(test_date) AS last_test_date
    FROM qc_gammacamara_tests
    WHERE instrument_id IS NOT NULL
    GROUP BY instrument_id, test_type, test_mode
  `;

  const lastMap = new Map<string, string>();
  for (const row of lastTests) {
    lastMap.set(`${row.instrument_id}:${row.test_type}:${row.test_mode}`, row.last_test_date);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alerts: DueAlert[] = [];

  for (const instrument of instruments) {
    for (const tol of tolerances) {
      const frequencyDays = Number(tol.frequency_days);
      if (!frequencyDays || Number.isNaN(frequencyDays)) continue;

      const key = `${instrument.id}:${tol.test_type}:${tol.test_mode}`;
      const lastDateStr: string | undefined = lastMap.get(key);

      if (!lastDateStr) {
        alerts.push({
          instrumentId: instrument.id,
          instrumentCode: instrument.code,
          instrumentName: instrument.name,
          testType: tol.test_type,
          testMode: tol.test_mode,
          frequencyDays,
          lastTestDate: null,
          nextDueDate: null,
          daysUntilDue: null,
          status: "sin_registro",
        });
        continue;
      }

      const nextDueDate = new Date(lastDateStr);
      nextDueDate.setDate(nextDueDate.getDate() + frequencyDays);
      const diffDays = Math.round((nextDueDate.getTime() - today.getTime()) / 86400000);

      // Ventana de aviso anticipado: 15% de la frecuencia, minimo 1 dia.
      const warningWindowDays = Math.max(1, Math.round(frequencyDays * 0.15));

      if (diffDays < 0) {
        alerts.push({
          instrumentId: instrument.id,
          instrumentCode: instrument.code,
          instrumentName: instrument.name,
          testType: tol.test_type,
          testMode: tol.test_mode,
          frequencyDays,
          lastTestDate: lastDateStr,
          nextDueDate: nextDueDate.toISOString().slice(0, 10),
          daysUntilDue: diffDays,
          status: "overdue",
        });
      } else if (diffDays <= warningWindowDays) {
        alerts.push({
          instrumentId: instrument.id,
          instrumentCode: instrument.code,
          instrumentName: instrument.name,
          testType: tol.test_type,
          testMode: tol.test_mode,
          frequencyDays,
          lastTestDate: lastDateStr,
          nextDueDate: nextDueDate.toISOString().slice(0, 10),
          daysUntilDue: diffDays,
          status: "upcoming",
        });
      }
    }
  }

  const statusOrder: Record<string, number> = { overdue: 0, sin_registro: 1, upcoming: 2 };
  alerts.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

  return NextResponse.json({ alerts, checkedAt: today.toISOString().slice(0, 10) });
}
