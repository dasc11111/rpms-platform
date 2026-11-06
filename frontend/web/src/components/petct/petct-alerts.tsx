"use client";

// Fase 23D — Panel de alertas PET/CT
// Detecta y muestra en tiempo real condiciones de riesgo radiológico:
//   uptake vencido, alta retrasada, examen no iniciado, QC fallido.
// DS 133/1984 Art. 22-26, IAEA HHS No. 1.

import { useState, useEffect, useCallback } from "react";
import type { PetctAlert, AlertSeverity } from "@/app/api/petct/alerts/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

function severityConfig(sev: AlertSeverity) {
  if (sev === "critical")
    return {
      border: "border-red-400 dark:border-red-700",
      bg: "bg-red-50 dark:bg-red-950/40",
      icon: "text-red-600 dark:text-red-400",
      badge: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
      label: "Crítica",
    };
  if (sev === "warning")
    return {
      border: "border-amber-400 dark:border-amber-700",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      icon: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
      label: "Advertencia",
    };
  return {
    border: "border-blue-400 dark:border-blue-700",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    icon: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
    label: "Info",
  };
}

function typeLabel(type: PetctAlert["type"]): string {
  const map: Record<PetctAlert["type"], string> = {
    uptake_overdue: "Captación vencida",
    discharge_overdue: "Alta retrasada",
    exam_not_started: "Examen no iniciado",
    qc_failure: "QC fallido",
  };
  return map[type] ?? type;
}

function AlertIcon({ severity }: { severity: AlertSeverity }) {
  if (severity === "critical")
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  if (severity === "warning")
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Alert card ─────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: PetctAlert }) {
  const cfg = severityConfig(alert.severity);
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4 flex gap-3`}>
      <span className={cfg.icon}>
        <AlertIcon severity={alert.severity} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
            {typeLabel(alert.type)}
          </span>
          {alert.since_minutes > 0 && (
            <span className="text-xs text-muted-foreground">
              hace {alert.since_minutes} min
            </span>
          )}
        </div>
        <p className="font-semibold text-sm text-foreground">{alert.message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
        {alert.exam_id && (
          <a
            href={`/petct/${alert.exam_id}`}
            className="inline-block mt-1.5 text-xs text-accent hover:underline"
          >
            Ver ficha del examen →
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main alerts panel ──────────────────────────────────────────────────────────

interface AlertsState {
  alerts: PetctAlert[];
  total: number;
  generated_at: string | null;
  loading: boolean;
  error: string | null;
}

export function PetctAlertsPanel() {
  const [state, setState] = useState<AlertsState>({
    alerts: [],
    total: 0,
    generated_at: null,
    loading: true,
    error: null,
  });

  const fetchAlerts = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/petct/alerts", { cache: "no-store" });
      if (!res.ok) throw new Error("Error al cargar alertas");
      const json = await res.json() as { alerts: PetctAlert[]; total: number; generated_at: string };
      setState({ alerts: json.alerts, total: json.total, generated_at: json.generated_at, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
    const id = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const { alerts, total, generated_at, loading, error } = state;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">Alertas PET/CT</h2>
          {total > 0 && (
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {criticalCount} crítica{criticalCount !== 1 ? "s" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-medium">
                  {warningCount} advertencia{warningCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generated_at && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {new Date(generated_at).toLocaleTimeString("es-CL")}
            </span>
          )}
          <button
            onClick={() => void fetchAlerts()}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded border border-border hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {/* Panel body */}
      <div className="p-5 space-y-3">
        {loading && alerts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Verificando alertas…</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!loading && !error && alerts.length === 0 && (
          <div className="flex items-center gap-3 py-3">
            <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              Sin alertas activas
            </span>
          </div>
        )}
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 text-xs text-muted-foreground">
        Actualización automática cada 60 s · DS 133/1984 Art. 22-26 · IAEA HHS No. 1
      </div>
    </div>
  );
}
