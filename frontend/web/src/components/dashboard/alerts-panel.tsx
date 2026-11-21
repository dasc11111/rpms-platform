import { AlertTriangle, AlertCircle, Info, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Alert {
  id: string;
  type: "danger" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  regulation?: string;
  action?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <AlertCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-emerald-700">Sin alertas activas</p>
          <p className="text-xs text-muted-foreground">Todos los módulos están al día</p>
        </div>
      </div>
    );
  }

  const danger = alerts.filter((a) => a.type === "danger");
  const warning = alerts.filter((a) => a.type === "warning");

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold text-sm">Alertas del Sistema</h2>
        </div>
        <div className="flex gap-2 text-xs">
          {danger.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-medium">
              {danger.length} crítica{danger.length > 1 ? "s" : ""}
            </span>
          )}
          {warning.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
              {warning.length} advertencia{warning.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">
        {alerts.slice(0, 10).map((alert) => (
          <div key={alert.id} className={`flex gap-3 px-5 py-3.5 ${
            alert.type === "danger" ? "bg-red-50/40" : ""
          }`}>
            <div className="shrink-0 mt-0.5">
              {alert.type === "danger" ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : alert.type === "warning" ? (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              ) : (
                <Info className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    alert.type === "danger" ? "text-red-800" : "text-foreground"
                  }`}>
                    {alert.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                  {alert.regulation && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{alert.regulation}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    alert.type === "danger" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {alert.module}
                  </span>
                  {alert.action && (
                    <Link href={alert.action} className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {alerts.length > 10 && (
          <div className="px-5 py-3 text-xs text-muted-foreground text-center">
            {alerts.length - 10} alertas adicionales — revisa cada módulo
          </div>
        )}
      </div>
    </div>
  );
}
