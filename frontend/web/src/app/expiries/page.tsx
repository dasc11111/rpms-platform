"use client";


import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  Filter,
  ExternalLink,
  CalendarClock,
} from "lucide-react";

interface ExpiryItem {
  id: string;
  module: string;
  category: string;
  title: string;
  detail: string;
  expiry_date: string;
  days_remaining: number;
  urgency: "overdue" | "critical" | "warning" | "upcoming";
  action_url: string;
  regulation?: string;
}

interface ExpiriesData {
  stats: {
    overdue: number;
    critical: number;
    warning: number;
    upcoming: number;
    total: number;
  };
  items: ExpiryItem[];
  generated_at: string;
}

const URGENCY = {
  overdue: {
    label: "Vencido",
    icon: AlertCircle,
    rowBg: "bg-red-50",
    border: "border-l-4 border-red-500",
    badge: "bg-red-100 text-red-700",
    iconColor: "text-red-500",
    kpiBg: "bg-red-500 text-white",
    days: (d: number) => `Venció hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? "s" : ""}`,
  },
  critical: {
    label: "Crítico (≤7d)",
    icon: AlertCircle,
    rowBg: "bg-orange-50",
    border: "border-l-4 border-orange-500",
    badge: "bg-orange-100 text-orange-700",
    iconColor: "text-orange-500",
    kpiBg: "bg-orange-500 text-white",
    days: (d: number) => `${d} día${d !== 1 ? "s" : ""}`,
  },
  warning: {
    label: "Próximo (≤30d)",
    icon: AlertTriangle,
    rowBg: "bg-yellow-50",
    border: "border-l-4 border-yellow-400",
    badge: "bg-yellow-100 text-yellow-700",
    iconColor: "text-yellow-500",
    kpiBg: "bg-yellow-400 text-yellow-900",
    days: (d: number) => `${d} días`,
  },
  upcoming: {
    label: "Próximamente",
    icon: Clock,
    rowBg: "bg-blue-50",
    border: "border-l-4 border-blue-300",
    badge: "bg-blue-100 text-blue-700",
    iconColor: "text-blue-400",
    kpiBg: "bg-blue-100 text-blue-700",
    days: (d: number) => `${d} días`,
  },
};

function ExpiryRow({ item }: { item: ExpiryItem }) {
  const cfg = URGENCY[item.urgency];
  const Icon = cfg.icon;
  const dateStr = new Date(item.expiry_date + "T12:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={`rounded-lg ${cfg.rowBg} ${cfg.border} px-4 py-3 flex items-start gap-3`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500 border border-gray-100">
            {item.module}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {item.category}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
        <p className="text-xs text-gray-500">{item.detail}</p>
        {item.regulation && (
          <p className="text-xs text-gray-400 italic mt-0.5">{item.regulation}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-xs font-semibold ${item.urgency === "overdue" ? "text-red-600" : "text-gray-700"}`}>
          {cfg.days(item.days_remaining)}
        </div>
        <div className="text-xs text-gray-400">{dateStr}</div>
        <Link
          href={item.action_url}
          className="mt-1 flex items-center justify-end gap-1 text-xs text-blue-600 hover:underline"
        >
          Ver <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export default function ExpiriesPage() {
  const [data, setData] = useState<ExpiriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expiries");
      setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const modules = data
    ? Array.from(new Set(data.items.map((i) => i.module))).sort()
    : [];

  const filtered = data
    ? data.items.filter((i) => {
        if (filterUrgency !== "all" && i.urgency !== filterUrgency) return false;
        if (filterModule !== "all" && i.module !== filterModule) return false;
        return true;
      })
    : [];

  // Group by urgency for sectioned display
  const sections: Array<{ key: ExpiryItem["urgency"]; items: ExpiryItem[] }> = [
    { key: "overdue", items: filtered.filter((i) => i.urgency === "overdue") },
    { key: "critical", items: filtered.filter((i) => i.urgency === "critical") },
    { key: "warning", items: filtered.filter((i) => i.urgency === "warning") },
    { key: "upcoming", items: filtered.filter((i) => i.urgency === "upcoming") },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-7 w-7 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tablero de Vencimientos</h1>
            <p className="text-sm text-gray-500">
              Control unificado de plazos críticos · Próximos 90 días · Todos los módulos
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Row */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => setFilterUrgency(filterUrgency === "overdue" ? "all" : "overdue")}
            className={`rounded-xl p-4 text-center transition hover:opacity-90 ${
              filterUrgency === "overdue" ? "ring-2 ring-offset-1 ring-red-400" : ""
            } bg-red-500 text-white`}
          >
            <div className="text-3xl font-bold">{data.stats.overdue}</div>
            <div className="text-xs mt-1 opacity-90">Vencidos</div>
          </button>
          <button
            onClick={() => setFilterUrgency(filterUrgency === "critical" ? "all" : "critical")}
            className={`rounded-xl p-4 text-center transition hover:opacity-90 ${
              filterUrgency === "critical" ? "ring-2 ring-offset-1 ring-orange-400" : ""
            } bg-orange-500 text-white`}
          >
            <div className="text-3xl font-bold">{data.stats.critical}</div>
            <div className="text-xs mt-1 opacity-90">Críticos ≤7d</div>
          </button>
          <button
            onClick={() => setFilterUrgency(filterUrgency === "warning" ? "all" : "warning")}
            className={`rounded-xl p-4 text-center transition hover:opacity-90 ${
              filterUrgency === "warning" ? "ring-2 ring-offset-1 ring-yellow-400" : ""
            } bg-yellow-400 text-yellow-900`}
          >
            <div className="text-3xl font-bold">{data.stats.warning}</div>
            <div className="text-xs mt-1">Próximos ≤30d</div>
          </button>
          <button
            onClick={() => setFilterUrgency(filterUrgency === "upcoming" ? "all" : "upcoming")}
            className={`rounded-xl p-4 text-center transition hover:opacity-90 ${
              filterUrgency === "upcoming" ? "ring-2 ring-offset-1 ring-blue-300" : ""
            } bg-blue-100 text-blue-800 border border-blue-200`}
          >
            <div className="text-3xl font-bold">{data.stats.upcoming}</div>
            <div className="text-xs mt-1">Próximamente</div>
          </button>
        </div>
      )}

      {/* Zero-state */}
      {data && data.stats.total === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <h2 className="text-lg font-semibold text-green-800">Sin vencimientos próximos</h2>
          <p className="text-sm text-green-600 mt-1">
            No se detectan vencimientos en los próximos 90 días para los módulos activos.
          </p>
        </div>
      )}

      {/* Filters */}
      {data && data.stats.total > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los módulos</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {(filterUrgency !== "all" || filterModule !== "all") && (
            <button
              onClick={() => { setFilterUrgency("all"); setFilterModule("all"); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {filtered.length} de {data.stats.total} vencimientos
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-2" />
          Cargando vencimientos…
        </div>
      )}

      {/* Sectioned list */}
      {!loading && sections.map(({ key, items }) => {
        const cfg = URGENCY[key];
        const SIcon = cfg.icon;
        return (
          <section key={key}>
            <h2 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3 ${cfg.iconColor}`}>
              <SIcon className="h-4 w-4" />
              {cfg.label} ({items.length})
            </h2>
            <div className="space-y-2">
              {items.map((item) => (
                <ExpiryRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Module legend */}
      {data && data.stats.total > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Módulos incluidos
          </h2>
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => {
              const count = data.items.filter((i) => i.module === m).length;
              const hasOverdue = data.items.some((i) => i.module === m && i.urgency === "overdue");
              const hasCritical = data.items.some((i) => i.module === m && i.urgency === "critical");
              return (
                <button
                  key={m}
                  onClick={() => setFilterModule(m === filterModule ? "all" : m)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    filterModule === m
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : hasOverdue
                      ? "border-red-200 bg-red-50 text-red-700"
                      : hasCritical
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {m}
                  <span className="rounded-full bg-white px-1.5 text-gray-700 font-bold text-xs border border-gray-100">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Fuentes:</span>{" "}
        Autorizaciones DS 3/1985 · Calibraciones NS-06.0 §9 · Inventarios de fuentes NS-06.0 §6 ·
        Simulacros DS 3/1985 Art. 25 · Cumplimiento NS-06.0 · Monitoreo Art. 15 · Capacitación NS-04.
        Horizonte de visibilidad: 90 días. Los vencimientos vienen de bases de datos activas.
      </div>
    </div>
  );
}
