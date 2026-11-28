"use client";


import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Filter,
  ExternalLink,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";

interface Alert {
  id: string;
  type: "danger" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  regulation?: string;
  action?: string;
}

interface AlertsData {
  total: number;
  danger: number;
  warning: number;
  alerts: Alert[];
  generated_at: string;
}

const TYPE_CONFIG = {
  danger: {
    label: "Peligro",
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-700",
    kpiBg: "bg-red-500",
    kpiText: "text-white",
  },
  warning: {
    label: "Advertencia",
    icon: AlertTriangle,
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    iconColor: "text-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
    kpiBg: "bg-yellow-400",
    kpiText: "text-yellow-900",
  },
  info: {
    label: "Información",
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
    kpiBg: "bg-blue-500",
    kpiText: "text-white",
  },
};

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = TYPE_CONFIG[alert.type];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {alert.module}
            </span>
          </div>
          <p className="mt-1 font-medium text-foreground text-sm leading-snug">{alert.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
          {alert.regulation && (
            <p className="mt-1 text-xs text-muted-foreground italic">{alert.regulation}</p>
          )}
        </div>
        {alert.action && (
          <Link
            href={alert.action}
            className="shrink-0 flex items-center gap-1 rounded-md bg-background px-2.5 py-1.5 text-xs font-medium text-foreground/80 shadow-sm border border-border hover:bg-muted/50 transition"
          >
            Ir <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "danger" | "warning" | "info">("all");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date(json.generated_at).toLocaleTimeString("es-CL"));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const modules = data
    ? Array.from(new Set(data.alerts.map((a) => a.module))).sort()
    : [];

  const filtered = data
    ? data.alerts.filter((a) => {
        if (filterType !== "all" && a.type !== filterType) return false;
        if (filterModule !== "all" && a.module !== filterModule) return false;
        return true;
      })
    : [];

  const infoCount = data ? data.alerts.filter((a) => a.type === "info").length : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertas y Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              Monitoreo centralizado de irregularidades radiológicas · DS 3/1985 · NS-06.0
            </p>
          </div>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm hover:bg-muted/50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Row */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-background border border-border shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-foreground">{data.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Alertas activas</div>
          </div>
          <div className="rounded-xl bg-red-500 p-4 text-center text-white">
            <div className="text-3xl font-bold">{data.danger}</div>
            <div className="text-xs mt-1 opacity-90">Peligro</div>
          </div>
          <div className="rounded-xl bg-yellow-400 p-4 text-center">
            <div className="text-3xl font-bold text-yellow-900">{data.warning}</div>
            <div className="text-xs mt-1 text-yellow-800">Advertencia</div>
          </div>
          <div className="rounded-xl bg-blue-500 p-4 text-center text-white">
            <div className="text-3xl font-bold">{infoCount}</div>
            <div className="text-xs mt-1 opacity-90">Información</div>
          </div>
        </div>
      )}

      {/* Zero-alert state */}
      {data && data.total === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <h2 className="text-lg font-semibold text-green-800">Sin alertas activas</h2>
          <p className="text-sm text-green-600 mt-1">
            Todos los sistemas radiológicos se encuentran dentro de parámetros normales.
          </p>
        </div>
      )}

      {/* Filters */}
      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los tipos</option>
            <option value="danger">Peligro</option>
            <option value="warning">Advertencia</option>
            <option value="info">Información</option>
          </select>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los módulos</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {(filterType !== "all" || filterModule !== "all") && (
            <button
              onClick={() => { setFilterType("all"); setFilterModule("all"); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} de {data.total} alertas
            {lastUpdated && ` · Actualizado: ${lastUpdated}`}
          </span>
        </div>
      )}

      {/* Alert list — by type */}
      {loading && (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-2" />
          Cargando alertas…
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {/* Danger */}
          {filtered.some((a) => a.type === "danger") && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">
                <AlertCircle className="h-4 w-4" /> Peligro — Acción inmediata requerida
              </h2>
              <div className="space-y-2">
                {filtered
                  .filter((a) => a.type === "danger")
                  .map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
              </div>
            </section>
          )}

          {/* Warning */}
          {filtered.some((a) => a.type === "warning") && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-yellow-700 uppercase tracking-wide mb-3">
                <AlertTriangle className="h-4 w-4" /> Advertencia — Revisar a la brevedad
              </h2>
              <div className="space-y-2">
                {filtered
                  .filter((a) => a.type === "warning")
                  .map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
              </div>
            </section>
          )}

          {/* Info */}
          {filtered.some((a) => a.type === "info") && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
                <Info className="h-4 w-4" /> Información
              </h2>
              <div className="space-y-2">
                {filtered
                  .filter((a) => a.type === "info")
                  .map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Module summary */}
      {data && data.total > 0 && (
        <section className="rounded-xl border border-border bg-background shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground/80 mb-4">Resumen por módulo</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const modAlerts = data.alerts.filter((a) => a.module === mod);
              const danger = modAlerts.filter((a) => a.type === "danger").length;
              const warning = modAlerts.filter((a) => a.type === "warning").length;
              const info = modAlerts.filter((a) => a.type === "info").length;
              return (
                <button
                  key={mod}
                  onClick={() => setFilterModule(mod)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition hover:shadow-sm ${
                    filterModule === mod
                      ? "border-blue-300 bg-blue-50"
                      : "border-border/50 bg-muted/50 hover:border-border"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">{mod}</span>
                  <div className="flex items-center gap-1">
                    {danger > 0 && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                        {danger}
                      </span>
                    )}
                    {warning > 0 && (
                      <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-bold text-yellow-700">
                        {warning}
                      </span>
                    )}
                    {info > 0 && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                        {info}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Regulatory footer */}
      <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-muted-foreground">Marco normativo:</span>{" "}
        DS 3/1985 MINSAL · NS-06.0 CCHEN · ICRP 103 · IAEA-TECDOC-1683 · NS-04 CCHEN.
        Las alertas se generan automáticamente al detectar desviaciones respecto a los límites
        reglamentarios. El encargado de protección radiológica debe revisar y gestionar cada alerta.
      </div>
    </div>
  );
}
