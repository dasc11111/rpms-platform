import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeCount(query: () => Promise<{ count: string }[]>): Promise<number> {
  try {
    const rows = await query();
    return parseInt(rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    // Gather KPIs from all modules (gracefully handle missing tables)
    const [
      workers,
      dosimetryAlerts,
      i131ThisMonth,
      incidentsOpen,
      incidentsGrave,
      complianceOk,
      compliancePendiente,
      complianceVencido,
      instruments,
      wastePending,
    ] = await Promise.all([
      // Workers
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM workers WHERE status = 'activo'`),
      // Dosimetry alerts (instruments not returned or overdue)
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM dosimeter_assignments WHERE returned_at IS NULL AND due_date < CURRENT_DATE`),
      // I-131 this month
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM i131_administrations WHERE admin_year = EXTRACT(YEAR FROM NOW()) AND admin_month = EXTRACT(MONTH FROM NOW())`),
      // Incidents open
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM nm_incidents WHERE status = 'abierto'`),
      // Incidents grave open
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM nm_incidents WHERE severity = 'grave' AND status = 'abierto'`),
      // Compliance ok
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'ok'`),
      // Compliance pendiente
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'pendiente'`),
      // Compliance vencido
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'vencido'`),
      // Instruments with overdue calibration (via calibrations join)
      safeCount(() => sql`
        SELECT COUNT(*)::text as count FROM instruments i
        WHERE i.status = 'operativo'
          AND NOT EXISTS (
            SELECT 1 FROM calibrations c
            WHERE c.instrument_id = i.id
              AND c.expiry_date >= CURRENT_DATE
          )
      `),
      // Waste pending
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM waste_records WHERE status = 'pending'`),
    ]);

    // Compliance score
    const complianceTotal = complianceOk + compliancePendiente + complianceVencido;
    const complianceScore = complianceTotal > 0 ? Math.round((complianceOk / complianceTotal) * 100) : null;

    const summary = {
      generated_at: new Date().toISOString(),
      modules: {
        workers: {
          label: "Trabajadores expuestos",
          value: workers,
          status: workers > 0 ? "ok" : "warning",
        },
        dosimetry: {
          label: "Dosímetros vencidos sin retornar",
          value: dosimetryAlerts,
          status: dosimetryAlerts === 0 ? "ok" : dosimetryAlerts <= 3 ? "warning" : "danger",
        },
        i131: {
          label: "Administraciones I-131 (mes actual)",
          value: i131ThisMonth,
          status: "ok",
        },
        incidents: {
          label: "Incidentes abiertos",
          value: incidentsOpen,
          status: incidentsOpen === 0 ? "ok" : incidentsGrave > 0 ? "danger" : "warning",
          detail: incidentsGrave > 0 ? `${incidentsGrave} grave(s)` : null,
        },
        compliance: {
          label: "Cumplimiento normativo",
          value: complianceScore !== null ? `${complianceScore}%` : "—",
          ok: complianceOk,
          pendiente: compliancePendiente,
          vencido: complianceVencido,
          status: complianceVencido > 0 ? "danger" : compliancePendiente > 0 ? "warning" : "ok",
        },
        instruments: {
          label: "Instrumentos con calibración vencida",
          value: instruments,
          status: instruments === 0 ? "ok" : instruments <= 2 ? "warning" : "danger",
        },
        waste: {
          label: "Residuos radiactivos pendientes",
          value: wastePending,
          status: wastePending === 0 ? "ok" : "warning",
        },
      },
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/reports", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
