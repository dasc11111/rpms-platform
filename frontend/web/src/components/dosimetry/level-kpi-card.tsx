"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = { default: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info" };

type LevelRow = {
  worker_rut: string;
  worker_name: string;
  departamento: string | null;
  period_label: string;
  dose_body: string;
  level: string;
};

export function LevelKpiCard({
  label,
  level,
  rows,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  level: string;
  rows: LevelRow[];
  icon: LucideIcon;
  tone?: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = rows
    .filter((r) => r.level === level)
    .sort((a, b) => Number(b.dose_body) - Number(a.dose_body));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3 text-left hover:border-accent"
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
          <Icon className={cn("h-3.5 w-3.5", TONE[tone])} strokeWidth={2} />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={cn("text-2xl font-semibold tabular-nums", TONE[tone])}>{matches.length}</span>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{label}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/40"
              >
                Cerrar
              </button>
            </div>
            {matches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay trabajadores registrados en esta categoria.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs">
                  <tr>
                    <th className="px-2 py-1.5">Trabajador</th>
                    <th className="px-2 py-1.5">RUT</th>
                    <th className="px-2 py-1.5">Departamento</th>
                    <th className="px-2 py-1.5">Periodo</th>
                    <th className="px-2 py-1.5 text-right">Dosis (mSv)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matches.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5 font-medium">{r.worker_name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.worker_rut}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.departamento}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.period_label}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{Number(r.dose_body).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
