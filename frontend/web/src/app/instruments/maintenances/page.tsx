"use client";


import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, Clock, ExternalLink, Search,
  Wrench, X, DollarSign, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstrumentMaint {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  service: string | null;
  unit: string | null;
  instrument_status: string;
  maintenance_frequency_months: number | null;
  last_maintenance_date: string | null;
  last_maintenance_type: string | null;
  last_company: string | null;
  next_maintenance_date: string | null;
  next_date_computed: string | null;
  last_cost: string | null;
  total_maintenances: number;
  cost_this_year: string | null;
  maint_status: string;
  days_to_next: number | null;
}

interface Stats {
  total: number; al_dia: number; proximo: number; urgente: number;
  vencido: number; sin_mantenimiento: number; cost_year: number;
}

interface ByType { maintenance_type: string; count: number; total_cost: string | null; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAINT_STATUS_LABEL: Record<string, string> = {
  al_dia:           "Al día", proximo: "Próximo (≤90 d)",
  urgente:          "Urgente (≤30 d)", vencido: "Vencido",
  sin_mantenimiento:"Sin mantenimiento",
};
const MAINT_STATUS_COLORS: Record<string, string> = {
  al_dia:           "bg-green-50  border-green-200  text-green-700",
  proximo:          "bg-yellow-50 border-yellow-200 text-yellow-700",
  urgente:          "bg-orange-50 border-orange-200 text-orange-700",
  vencido:          "bg-red-50    border-red-200    text-red-700",
  sin_mantenimiento:"bg-muted     border-border     text-muted-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  preventivo: "Preventivo", correctivo: "Correctivo", predictivo: "Predictivo",
  mayor: "Mayor", menor: "Menor",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL");
}

function formatCLP(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

function daysLabel(d: number | null): string {
  if (d === null) return "—";
  if (d < 0) return `Atrasado ${Math.abs(d)} días`;
  if (d === 0) return "Hoy";
  return `${d} días`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", MAINT_STATUS_COLORS[status] ?? "bg-muted border-border text-muted-foreground")}>
      {MAINT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function KPI({ label, value, sub, color = "gray", icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ComponentType<{ className?: string }>;
}) {
  const C: Record<string, string> = {
    green:  "bg-green-50  border-green-200  text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red:    "bg-red-50    border-red-200    text-red-700",
    gray:   "bg-muted     border-border     text-foreground",
    blue:   "bg-blue-50   border-blue-200   text-blue-700",
  };
  return (
    <div className={`rounded-lg border p-4 ${C[color] ?? C.gray}`}>
      {Icon && <Icon className="w-5 h-5 mb-2 opacity-70" />}
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MaintenancesOverviewPage() {
  const [instruments, setInstruments] = useState<InstrumentMaint[]>([]);
  const [stats, setStats]     = useState<Stats>({ total: 0, al_dia: 0, proximo: 0, urgente: 0, vencido: 0, sin_mantenimiento: 0, cost_year: 0 });
  const [upcoming, setUpcoming] = useState<InstrumentMaint[]>([]);
  const [byType, setByType]   = useState<ByType[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [year, setYear]           = useState(CURRENT_YEAR);
  const [statusFilter, setStatus] = useState("");
  const [serviceFilter, setService] = useState("");
  const [q, setQ]                 = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (statusFilter) params.set("status", statusFilter);
    if (serviceFilter) params.set("service", serviceFilter);
    if (q) params.set("q", q);
    try {
      const res = await fetch(`/api/maintenances-overview?${params}`);
      const data = await res.json();
      setInstruments(data.instruments ?? []);
      setStats(data.stats ?? { total: 0, al_dia: 0, proximo: 0, urgente: 0, vencido: 0, sin_mantenimiento: 0, cost_year: 0 });
      setUpcoming(data.upcoming ?? []);
      setByType(data.by_type ?? []);
      setServices(data.services ?? []);
    } finally { setLoading(false); }
  }, [year, statusFilter, serviceFilter, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasFilters = statusFilter || serviceFilter || q;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Estado de Mantenimientos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestión preventiva y correctiva de instrumentos de medición
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background">
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link href="/instruments" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <Wrench className="w-4 h-4" /> Ver instrumentos
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI label="Total con mantenimiento"  value={stats.total}                  color="blue"   icon={Wrench} />
        <KPI label="Al día"                   value={stats.al_dia}                 color="green"  icon={CheckCircle2} />
        <KPI label="Próximos (≤90 d)"         value={stats.proximo}                color={stats.proximo > 0 ? "yellow" : "gray"} icon={Clock} />
        <KPI label="Urgentes (≤30 d)"         value={stats.urgente}                color={stats.urgente > 0 ? "orange" : "gray"} icon={AlertTriangle} />
        <KPI label="Vencidos"                 value={stats.vencido}                color={stats.vencido > 0 ? "red" : "gray"} icon={AlertTriangle} />
        <KPI label={`Costo total ${year}`}    value={formatCLP(stats.cost_year)}  color="gray"   icon={DollarSign} />
      </div>

      {/* Type breakdown */}
      {byType.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Distribución por tipo — {year}
          </h2>
          <div className="flex flex-wrap gap-4">
            {byType.map(t => (
              <div key={t.maintenance_type} className="flex items-center gap-2">
                <span className="text-sm font-medium">{TYPE_LABELS[t.maintenance_type] ?? t.maintenance_type}</span>
                <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-mono">{t.count}</span>
                {t.total_cost && <span className="text-xs text-muted-foreground">{formatCLP(t.total_cost)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border bg-orange-50 border-orange-200 p-4">
          <h2 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Próximos mantenimientos (90 días)
          </h2>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(u => (
              <Link key={u.id} href={`/instruments/${u.id}`}
                className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs hover:bg-orange-50 transition-colors">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                  u.maint_status === "vencido" ? "bg-red-500" :
                  u.maint_status === "urgente" ? "bg-orange-500" : "bg-yellow-400")} />
                <span className="font-medium">{u.name}</span>
                <span className="text-muted-foreground">{u.code}</span>
                <span className={cn("font-semibold",
                  (u.days_to_next ?? 0) <= 0 ? "text-red-700" :
                  (u.days_to_next ?? 0) <= 30 ? "text-orange-700" : "text-yellow-700")}>
                  {daysLabel(u.days_to_next)}
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar instrumento, código, empresa…"
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">Todos los estados</option>
          {Object.entries(MAINT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={serviceFilter} onChange={e => setService(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">Todos los servicios</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setStatus(""); setService(""); setQ(""); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" /> Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Cargando…</div>
        ) : instruments.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No hay instrumentos con mantenimiento registrado{hasFilters ? " que coincidan con los filtros." : "."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Instrumento</th>
                <th className="text-left p-3">Servicio</th>
                <th className="text-left p-3">Empresa / Responsable</th>
                <th className="text-center p-3">Último mant.</th>
                <th className="text-center p-3">Próximo</th>
                <th className="text-center p-3">Días</th>
                <th className="text-right p-3">Costo {year}</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-center p-3">Historial</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instruments.map(r => {
                const isUrgent = r.maint_status === "vencido" || r.maint_status === "urgente";
                return (
                  <tr key={r.id} className={cn("hover:bg-muted/30", isUrgent && "bg-orange-50/40")}>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.code}{r.brand ? ` · ${r.brand}` : ""}{r.model ? ` ${r.model}` : ""}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{r.service ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.last_company ?? "—"}</td>
                    <td className="p-3 text-center text-xs">
                      {formatDate(r.last_maintenance_date)}
                      {r.last_maintenance_type && (
                        <div className="text-muted-foreground">{TYPE_LABELS[r.last_maintenance_type] ?? r.last_maintenance_type}</div>
                      )}
                    </td>
                    <td className="p-3 text-center text-xs">
                      {r.next_maintenance_date
                        ? formatDate(r.next_maintenance_date)
                        : r.next_date_computed
                          ? <span className="italic text-muted-foreground">{formatDate(r.next_date_computed)} (est.)</span>
                          : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={cn("text-xs font-medium",
                        r.maint_status === "vencido"  ? "text-red-700" :
                        r.maint_status === "urgente"  ? "text-orange-600" :
                        r.maint_status === "proximo"  ? "text-yellow-600" :
                        r.maint_status === "al_dia"   ? "text-green-600" : "text-muted-foreground")}>
                        {daysLabel(r.days_to_next)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-xs">
                      {formatCLP(r.cost_this_year)}
                    </td>
                    <td className="p-3 text-center"><StatusBadge status={r.maint_status} /></td>
                    <td className="p-3 text-center">
                      <Link href={`/instruments/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        {r.total_maintenances} reg. <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
