import { Wrench, ClipboardCheck, AlertTriangle, AlertCircle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { sql } from "@/lib/db";
import {
  InstrumentRow,
  INSTRUMENT_STATUS_LABELS,
  CALIBRATION_ALERT_LABELS,
  CALIBRATION_ALERT_COLORS,
  getCalibrationAlertLevel,
} from "@/lib/instruments";
import { cn } from "@/lib/utils";
import { InstrumentFormModal } from "@/components/instruments/instrument-form-modal";
import { InstrumentEditModal } from "@/components/instruments/instrument-edit-modal";

export const dynamic = "force-dynamic";

async function getInstruments(): Promise<InstrumentRow[]> {
  try {
    const { rows } = await sql`
      SELECT
        i.*,
        t.name AS type_name,
        lc.calibration_date AS last_calibration_date,
        lc.expiry_date AS last_calibration_expiry,
        COALESCE(lc.company_name, cc.name) AS last_calibration_company,
        COALESCE(fc.open_count, 0) AS failures_open_count
      FROM instruments i
      LEFT JOIN instrument_types t ON t.id = i.type_id
      LEFT JOIN LATERAL (
        SELECT * FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1
      ) lc ON true
      LEFT JOIN calibration_companies cc ON cc.id = lc.company_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS open_count FROM instrument_failures f WHERE f.instrument_id = i.id AND f.status IN ('abierta','en_proceso')
      ) fc ON true
      ORDER BY i.name ASC
      LIMIT 5000
    `;
    return rows as InstrumentRow[];
  } catch {
    return [];
  }
}

export default async function InstrumentsPage() {
  const instruments = await getInstruments();

  const enriched = instruments.map((i) => {
    const alert = getCalibrationAlertLevel(i.last_calibration_expiry ?? null);
    return { ...i, alertLevel: alert.level, daysRemaining: alert.daysRemaining };
  });

  const total = enriched.length;
  const expiringCount = enriched.filter((i) => i.alertLevel === "amarillo" || i.alertLevel === "rojo").length;
  const expiredCount = enriched.filter((i) => i.alertLevel === "vencida").length;
  const withFailures = enriched.filter((i) => (i.failures_open_count ?? 0) > 0).length;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Instrumentos</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Instrumentos registrados" value={total} href="/instruments" icon={Wrench} />
        <KPICard label="Próximas a vencer" value={expiringCount} href="/instruments" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Vencidos" value={expiredCount} href="/instruments" icon={AlertTriangle} tone="danger" />
        <KPICard label="Con fallas abiertas" value={withFailures} href="/instruments" icon={AlertCircle} tone="danger" />
      </div>
      <InstrumentFormModal />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Instrumento</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">N° Serie</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Última calibración</th>
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2">Calibración</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {enriched.map((i) => (
              <tr key={i.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i.code}</td>
                <td className="px-3 py-2.5 font-medium">{i.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{i.type_name ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i.serial_number ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{i.service ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{i.last_calibration_date ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{i.last_calibration_expiry ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", CALIBRATION_ALERT_COLORS[i.alertLevel])}>
                    {CALIBRATION_ALERT_LABELS[i.alertLevel]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{INSTRUMENT_STATUS_LABELS[i.status]}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <InstrumentEditModal instrument={i} />
                  </div>
                </td>
              </tr>
            ))}
            {enriched.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                  No hay instrumentos registrados todavía. Agrega uno para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
