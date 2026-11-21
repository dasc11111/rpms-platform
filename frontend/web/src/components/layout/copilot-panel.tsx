"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, Info, Loader2, RefreshCw, ShieldAlert, Sparkles, X } from "lucide-react";

interface Alert {
  id: string;
  type: "danger" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  regulation?: string;
  action?: string;
}

const TYPE_ICON: Record<Alert["type"], React.ReactNode> = {
  danger: <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />,
  warning: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />,
  info: <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />,
};

const TYPE_BADGE: Record<Alert["type"], string> = {
  danger: "bg-danger/10 text-danger border-danger/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-accent/10 text-accent border-accent/20",
};

export function CopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadAlerts() {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data.slice(0, 8) : []);
        setLastUpdated(new Date());
      }
    } catch {
      // sin conexión — mantener datos anteriores
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadAlerts();
  }, [open]);

  if (!open) return null;

  const dangerCount = alerts.filter((a) => a.type === "danger").length;
  const warningCount = alerts.filter((a) => a.type === "warning").length;

  return (
    <div className="absolute right-0 top-11 z-40 w-80 rounded-lg border border-border bg-surface shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-accent" strokeWidth={2} />
          <span className="text-sm font-semibold">Copilot RPMS</span>
          {(dangerCount > 0 || warningCount > 0) && (
            <span className="ml-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {dangerCount + warningCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={loadAlerts}
            disabled={loading}
            aria-label="Actualizar alertas"
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Summary row */}
      {!loading && alerts.length > 0 && (
        <div className="flex gap-2 border-b border-border px-3 py-2">
          {dangerCount > 0 && (
            <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE.danger}`}>
              {dangerCount} crítica{dangerCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE.warning}`}>
              {warningCount} advertencia{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {lastUpdated && (
            <span className="ml-auto text-[10px] text-muted-foreground self-center">
              {lastUpdated.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-h-96 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando sistema…
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Sparkles className="h-6 w-6 text-success" />
            <p className="text-xs font-medium text-success">Sin alertas pendientes</p>
            <p className="text-[11px] text-muted-foreground">Todos los módulos operan dentro de parámetros normativos.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Danger first */}
            {[...alerts.filter(a => a.type === "danger"), ...alerts.filter(a => a.type !== "danger")].map((alert) => (
              alert.action ? (
                <Link
                  key={alert.id}
                  href={alert.action}
                  onClick={onClose}
                  className={`group flex items-start gap-2.5 rounded-md border p-2.5 hover:border-accent transition-colors ${
                    alert.type === "danger"
                      ? "border-danger/30 bg-danger/5"
                      : alert.type === "warning"
                      ? "border-warning/20 bg-warning/5"
                      : "border-border bg-background"
                  }`}
                >
                  {TYPE_ICON[alert.type]}
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="text-xs font-medium leading-snug truncate">{alert.title}</span>
                    <span className="text-[11px] text-muted-foreground leading-snug mt-0.5">{alert.detail}</span>
                    {alert.regulation && (
                      <span className="text-[10px] text-muted-foreground/70 mt-1 font-mono">{alert.regulation}</span>
                    )}
                  </div>
                </Link>
              ) : (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2.5 rounded-md border p-2.5 ${
                    alert.type === "danger"
                      ? "border-danger/30 bg-danger/5"
                      : alert.type === "warning"
                      ? "border-warning/20 bg-warning/5"
                      : "border-border bg-background"
                  }`}
                >
                  {TYPE_ICON[alert.type]}
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="text-xs font-medium leading-snug truncate">{alert.title}</span>
                    <span className="text-[11px] text-muted-foreground leading-snug mt-0.5">{alert.detail}</span>
                    {alert.regulation && (
                      <span className="text-[10px] text-muted-foreground/70 mt-1 font-mono">{alert.regulation}</span>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
