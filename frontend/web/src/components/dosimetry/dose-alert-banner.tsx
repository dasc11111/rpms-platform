"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export type QuarterlyDoseAlertWorker = {
    worker_rut: string;
    worker_name: string;
    dose_body: number;
};

export type QuarterlyDoseAlertSummary = {
    year: number;
    quarter: number;
    period_label: string;
    totalEvaluated: number;
    maxDose: number;
    workersOverThreshold: QuarterlyDoseAlertWorker[];
};

function fmtDose(n: number): string {
    return n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quarterLabel(summary: QuarterlyDoseAlertSummary): string {
    if (summary.quarter && summary.year) return summary.quarter + "\u00b0 trimestre " + summary.year;
    return summary.period_label;
}

export function DoseAlertBanner({ alerts }: { alerts: QuarterlyDoseAlertSummary[] }) {
    const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

    if (!alerts || alerts.length === 0) return null;

    return (
          <div className="mt-3 space-y-3">
      {alerts.map((summary) => {
                const key = summary.period_label || (summary.year + "-" + summary.quarter);
                if (dismissed[key]) return null;
                const hasAlert = summary.workersOverThreshold.length > 0;
                const boxClass = hasAlert
                            ? "relative rounded-md border border-danger/30 bg-danger/10 p-3 text-xs"
                            : "relative rounded-md border border-success/30 bg-success/10 p-3 text-xs";
                return (
                            <div key={key} className={boxClass}>
                              <button
                                type="button"
                                onClick={() => setDismissed((d) => ({ ...d, [key]: true }))}
                                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                aria-label="Cerrar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                  {hasAlert ? (
                                  <div>
                                    <p className="flex items-center gap-1.5 pr-5 font-semibold text-danger">
                                      <AlertTriangle className="h-4 w-4 shrink-0" />
                                      ALERTA DE DOSIS
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                    {"Se detectaron " + summary.workersOverThreshold.length + " trabajador(es) con dosis superiores a 5 mSv durante el periodo " + quarterLabel(summary) + "."}
                                    </p>
                                    <div className="mt-2 overflow-hidden rounded border border-border">
                                      <table className="w-full text-[11px]">
                                        <thead className="bg-muted/50 text-left">
                                          <tr>
                                            <th className="px-2 py-1.5">Trabajador</th>
                                            <th className="px-2 py-1.5">RUT</th>
                                            <th className="px-2 py-1.5">Periodo</th>
                                            <th className="px-2 py-1.5 text-right">Dosis</th>
                                            <th className="px-2 py-1.5">Unidad</th>
                                            <th className="px-2 py-1.5">Estado</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                    {summary.workersOverThreshold.map((w) => (
                                              <tr key={w.worker_rut}>
                                                <td className="px-2 py-1.5 font-medium">{w.worker_name}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{w.worker_rut}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{quarterLabel(summary)}</td>
                                                <td className="px-2 py-1.5 text-right font-semibold text-danger">{fmtDose(w.dose_body)}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground">mSv</td>
                                                <td className="px-2 py-1.5 text-danger">{"\u26a0\ufe0f ALERTA"}</td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <p className="mt-2 text-[10px] text-muted-foreground">
                                      Se requiere revision del resultado dosimetrico conforme al procedimiento establecido.
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="flex items-center gap-1.5 pr-5 font-semibold text-success">
                                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                                      SIN DOSIS DE ALERTA
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                    {"Para el periodo " + quarterLabel(summary) + " no se registraron dosis de alerta (>5 mSv)."}
                                    </p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                    {"Trabajadores evaluados: " + summary.totalEvaluated + " \u00b7 Dosis maxima registrada: " + fmtDose(summary.maxDose) + " mSv"}
                                    </p>
                                  </div>
                                )}
                            </div>
                          );
      })}
          </div>
        );
}
