"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  Wrench, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Clock, Calendar, Building2, DollarSign, Search, Filter,
  TrendingUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type MaintStatus = "al_dia" | "proximo" | "urgente" | "vencido" | "sin_mantenimiento";

interface Instrument {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  service: string | null;
  unit: string | null;
  instrument_status: string | null;
  maintenance_frequency_months: number | null;
  last_maintenance_date: string | null;
  last_maintenance_type: string | null;
  last_company: string | null;
  next_maintenance_date: string | null;
  last_cost: string | null;
  total_maintenances: number;
  cost_this_year: string | null;
  maint_status: MaintStatus;
  days_to_next: number | null;
  next_date_computed: string | null;
}

interface Stats {
  total: number;
  al_dia: number;
  proximo: number;
  urgente: number;
  vencido: number;
  sin_mantenimiento: number;
  cost_year: number;
}

interface ByType {
  maintenance_type: string;
  count: number;
  total_cost: string;
}

interface ApiResponse {
  instruments: Instrument[];
  stats: Stats;
  upcoming: Instrument[];
  by_type: ByType[];
  services: string[];
  year: number;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<MaintStatus, { label: string; cls: string; dot: string; border: string }> = {
  al_dia:            { label: "Al día",          cls: "bg-green-100 text-green-700 border border-green-200",   dot: "bg-green-500",  border: "" },
  proximo:           { label: "Próximo ≤90d",    cls: "bg-yellow-100 text-yellow-700 border border-yellow-200", dot: "bg-yellow-500", border: "" },
  urgente:           { label: "Urgente ≤30d",    cls: "bg-orange-100 text-orange-700 border border-orange-200", dot: "bg-orange-500", border: "border-l-4 border-l-orange-400" },
  vencido:           { label: "Vencido",         cls: "bg-red-100 text-red-700 border border-red-200",         dot: "bg-red-500",    border: "border-l-4 border-l-red-500" },
  sin_mantenimiento: { label: "Sin mantención",  cls: "bg-gray-100 text-gray-600 border border-gray-200",     dot: "bg-gray-400",   border: "" },
};

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCLP(v: string | number | null) {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

function daysLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return `Vencido hace ${Math.abs(days)}d`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days <= 30) return `En ${days}d`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  if (rem === 0) return `En ${months}m`;
  return `En ${months}m ${rem}d`;
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenancesOverviewPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [q, setQ] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  // UI state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (serviceFilter) params.set("service", serviceFilter);
    if (q) params.set("q", q);
    params.set("year", String(year));
    try {
      const res = await fetch(`/api/maintenances-overview?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [typeFilter, serviceFilter, q, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side status filter
  const instruments = (data?.instruments ?? []).filter(i => {
    if (statusFilter && i.maint_status !== statusFilter) return false;
    return true;
  });

  const stats = data?.stats;
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Wrench className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resumen de Mantenimientos</h1>
            <p className="text-sm text-gray-500">Estado de mantención preventiva y correctiva de instrumentos</p>
          </div>
        </div>

        {/* KPI tiles */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiTile label="Total instrumentos" value={stats.total} color="bg-white border-gray-200 text-gray-800" />
            <KpiTile label="Al día" value={stats.al_dia} color="bg-green-50 border-green-200 text-green-800" />
            <KpiTile label="Próximos ≤90d" value={stats.proximo} color="bg-yellow-50 border-yellow-200 text-yellow-800" />
            <KpiTile label="Urgente ≤30d" value={stats.urgente} color="bg-orange-50 border-orange-200 text-orange-800" />
            <KpiTile label="Vencidos" value={stats.vencido} color="bg-red-50 border-red-200 text-red-800" />
            <KpiTile
              label={`Costo ${year}`}
              value={fmtCLP(stats.cost_year)}
              color="bg-indigo-50 border-indigo-200 text-indigo-800"
            />
          </div>
        )}

        {/* Próximos a mantener */}
        {data?.upcoming && data.upcoming.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setShowUpcoming(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-sm text-gray-800">
                  Próximos a mantener en 90 días ({data.upcoming.length})
                </span>
              </div>
              {showUpcoming ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            {showUpcoming && (
              <div className="px-5 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-3 font-medium text-gray-500">Instrumento</th>
                      <th className="text-left py-2 pr-3 font-medium text-gray-500">Servicio</th>
                      <th className="text-left py-2 pr-3 font-medium text-gray-500">Próxima mantención</th>
                      <th className="text-left py-2 font-medium text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming.map(r => {
                      const cfg = STATUS_CFG[r.maint_status];
                      return (
                        <tr key={r.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-3">
                            <span className="font-medium text-gray-900">{r.name}</span>
                            <span className="ml-2 font-mono text-xs text-gray-400">{r.code}</span>
                          </td>
                          <td className="py-2 pr-3 text-gray-500">{r.service ?? "—"}</td>
                          <td className="py-2 pr-3 text-gray-700">{fmtDate(r.next_date_computed)}</td>
                          <td className="py-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {daysLabel(r.days_to_next)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* By type breakdown */}
        {data?.by_type && data.by_type.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              <span className="font-semibold text-sm text-gray-800">Distribución por tipo — {year}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {data.by_type.map(bt => (
                <div key={bt.maintenance_type} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium capitalize text-gray-800">{bt.maintenance_type}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">{bt.count} registros</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-indigo-700 font-medium">{fmtCLP(bt.total_cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className={`${inp} pl-9`}
                placeholder="Nombre, código, empresa..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select className={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="al_dia">Al día</option>
              <option value="proximo">Próximo ≤90d</option>
              <option value="urgente">Urgente ≤30d</option>
              <option value="vencido">Vencido</option>
              <option value="sin_mantenimiento">Sin mantención</option>
            </select>
            <select className={inp} value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
              <option value="">Todos los servicios</option>
              {(data?.services ?? []).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className={inp} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="preventivo">Preventivo</option>
              <option value="correctivo">Correctivo</option>
              <option value="calibracion">Calibración</option>
              <option value="verificacion">Verificación</option>
            </select>
            <select className={inp} value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Instruments list */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : instruments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No se encontraron instrumentos con los filtros aplicados.</div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 font-medium">{instruments.length} instrumento{instruments.length !== 1 ? "s" : ""}</p>
            {instruments.map(inst => {
              const cfg = STATUS_CFG[inst.maint_status];
              const isExpanded = expandedId === inst.id;
              const isUrgent = inst.maint_status === "urgente" || inst.maint_status === "vencido";

              return (
                <div
                  key={inst.id}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isUrgent ? cfg.border : "border-gray-200"}`}
                >
                  {/* Card header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${isUrgent ? "bg-red-100" : "bg-blue-50"}`}>
                        {isUrgent
                          ? <AlertTriangle className="h-4 w-4 text-red-500" />
                          : <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{inst.name}</span>
                          <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{inst.code}</span>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {inst.days_to_next !== null && (
                            <span className={`text-xs font-medium ${inst.days_to_next < 0 ? "text-red-600" : inst.days_to_next <= 30 ? "text-orange-600" : "text-gray-500"}`}>
                              {daysLabel(inst.days_to_next)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                          {inst.service && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />{inst.service}
                            </span>
                          )}
                          {inst.last_maintenance_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Última: {fmtDate(inst.last_maintenance_date)}
                            </span>
                          )}
                          {inst.next_date_computed && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Próxima: {fmtDate(inst.next_date_computed)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        {/* Instrumento */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instrumento</p>
                          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5 text-sm">
                            {inst.brand && <div className="flex justify-between"><span className="text-gray-500">Marca</span><span className="font-medium">{inst.brand}</span></div>}
                            {inst.model && <div className="flex justify-between"><span className="text-gray-500">Modelo</span><span className="font-medium">{inst.model}</span></div>}
                            {inst.serial_number && <div className="flex justify-between"><span className="text-gray-500">N° serie</span><span className="font-mono text-xs">{inst.serial_number}</span></div>}
                            {inst.unit && <div className="flex justify-between"><span className="text-gray-500">Unidad</span><span>{inst.unit}</span></div>}
                            <div className="flex justify-between">
                              <span className="text-gray-500">Estado equipo</span>
                              <span className="capitalize">{inst.instrument_status ?? "—"}</span>
                            </div>
                            {inst.maintenance_frequency_months && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Frecuencia</span>
                                <span>Cada {inst.maintenance_frequency_months} mes{inst.maintenance_frequency_months !== 1 ? "es" : ""}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Última mantención */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Última mantención</p>
                          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Fecha</span>
                              <span className="font-medium">{fmtDate(inst.last_maintenance_date)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Tipo</span>
                              <span className="capitalize">{inst.last_maintenance_type ?? "—"}</span>
                            </div>
                            {inst.last_company && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Empresa</span>
                                <span>{inst.last_company}</span>
                              </div>
                            )}
                            {inst.last_cost && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3" />Costo</span>
                                <span className="font-medium text-indigo-700">{fmtCLP(inst.last_cost)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-500">Total registros</span>
                              <span>{inst.total_maintenances}</span>
                            </div>
                          </div>
                        </div>

                        {/* Próxima mantención + costos año */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Planificación</p>
                          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Próxima fecha</span>
                              <span className={`font-medium ${inst.maint_status === "vencido" ? "text-red-600" : inst.maint_status === "urgente" ? "text-orange-600" : "text-gray-800"}`}>
                                {fmtDate(inst.next_date_computed)}
                              </span>
                            </div>
                            {inst.days_to_next !== null && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Tiempo restante</span>
                                <span className={`font-medium ${inst.days_to_next < 0 ? "text-red-600" : inst.days_to_next <= 30 ? "text-orange-600" : "text-gray-700"}`}>
                                  {daysLabel(inst.days_to_next)}
                                </span>
                              </div>
                            )}
                            {inst.cost_this_year && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Costo {year}</span>
                                <span className="font-medium text-indigo-700">{fmtCLP(inst.cost_this_year)}</span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-gray-100">
                              <a
                                href={`/instruments/${inst.id}`}
                                className="text-xs text-blue-600 hover:underline font-medium"
                              >
                                Ver ficha del instrumento →
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>
            Decreto Supremo N°3/1985 MINSAL Art. 76-78 — Mantenimiento de equipos de radiación ionizante.
            Ley N°19.937 y DS N°140 — Gestión de equipamiento hospitalario crítico.
            IAEA Safety Reports Series No. 16 — Radiation Protection in Nuclear Medicine (mantenimiento de equipos).
            NCh-ISO 55001:2014 — Gestión de activos físicos (mantenimiento planificado).
            CCHEN ORD. aplicable sobre registros de mantenimiento de equipos con radiación.
          </p>
        </div>

      </div>
    </div>
  );
}
