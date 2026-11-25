"use client";


import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle, Award, CheckCircle2, Clock, ExternalLink, Search,
  ShieldCheck, Wrench, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstrumentCal {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  service: string | null;
  unit: string | null;
  instrument_status: string;
  calibration_frequency_months: number | null;
  last_calibration_date: string | null;
  expiry_date: string | null;
  certificate_number: string | null;
  calibration_company: string | null;
  total_calibrations: number;
  cal_status: string;
  days_to_expiry: number | null;
}

interface Stats {
  total: number; vigente: number; por_vencer: number;
  proximo: number; vencida: number; sin_calibrar: number;
}

interface Upcoming {
  id: number; code: string; name: string; service: string | null;
  expiry_date: string | null; days_to_expiry: number | null; cal_status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CAL_STATUS_LABEL: Record<string, string> = {
  vigente: "Vigente", por_vencer: "Por vencer (≤30 d)", proximo: "Próximo (≤90 d)",
  vencida: "Vencida", sin_calibrar: "Sin calibrar",
};

const CAL_STATUS_COLORS: Record<string, string> = {
  vigente:     "bg-green-50  border-green-200  text-green-700",
  por_vencer:  "bg-orange-50 border-orange-200 text-orange-700",
  proximo:     "bg-yellow-50 border-yellow-200 text-yellow-700",
  vencida:     "bg-red-50    border-red-200    text-red-700",
  sin_calibrar:"bg-muted     border-border     text-muted-foreground",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL");
}

function daysLabel(d: number | null): string {
  if (d === null) return "—";
  if (d < 0) return `Venció hace ${Math.abs(d)} días`;
  if (d === 0) return "Vence hoy";
  return `${d} días`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", CAL_STATUS_COLORS[status] ?? "bg-muted border-border text-muted-foreground")}>
      {CAL_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function KPI({ label, value, color = "gray", icon: Icon }: {
  label: string; value: number; color?: string; icon?: React.ComponentType<{ className?: string }>;
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
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CalibrationsOverviewPage() {
  const [instruments, setInstruments] = useState<InstrumentCal[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, vigente: 0, por_vencer: 0, proximo: 0, vencida: 0, sin_calibrar: 0 });
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [q, setQ] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (serviceFilter) params.set("service", serviceFilter);
    if (q) params.set("q", q);
    try {
      const res = await fetch(`/api/calibrations-overview?${params}`);
      const data = await res.json();
      setInstruments(data.instruments ?? []);
      setStats(data.stats ?? { total: 0, vigente: 0, por_vencer: 0, proximo: 0, vencida: 0, sin_calibrar: 0 });
      setUpcoming(data.upcoming ?? []);
      setServices(data.services ?? []);
    } finally { setLoading(false); }
  }, [statusFilter, serviceFilter, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setStatusFilter(""); setServiceFilter(""); setQ(""); };
  const hasFilters = statusFilter || serviceFilter || q;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Estado de Calibraciones
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            DS 3/1985 MINSAL · NCh-ISO/IEC 17025 · Frecuencias según NS-06.0 CCHEN
          </p>
        </div>
        <Link href="/instruments"
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <Wrench className="w-4 h-4" /> Ver todos los instrumentos
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total con calibración" value={stats.total}         color="blue"   icon={Wrench} />
        <KPI label="Calibración vigente"   value={stats.vigente}       color="green"  icon={CheckCircle2} />
        <KPI label="Por vencer (≤30 d)"    value={stats.por_vencer}    color={stats.por_vencer > 0 ? "orange" : "gray"} icon={Clock} />
        <KPI label="Próximos (≤90 d)"      value={stats.proximo}       color={stats.proximo > 0 ? "yellow" : "gray"} icon={Clock} />
        <KPI label="Vencidas / Sin cal."   value={stats.vencida + stats.sin_calibrar} color={stats.vencida > 0 ? "red" : "gray"} icon={AlertTriangle} />
      </div>

      {/* Upcoming calibrations */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border bg-orange-50 border-orange-200 p-4">
          <h2 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Próximas calibraciones (90 días)
          </h2>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(u => (
              <Link key={u.id} href={`/instruments/${u.id}`}
                className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs hover:bg-orange-50 transition-colors">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                  u.cal_status === "vencida" ? "bg-red-500" :
                  u.cal_status === "por_vencer" ? "bg-orange-500" : "bg-yellow-400")} />
                <span className="font-medium text-foreground">{u.name}</span>
                <span className="text-muted-foreground">{u.code}</span>
                <span className={cn("font-semibold",
                  (u.days_to_expiry ?? 0) < 0 ? "text-red-700" :
                  (u.days_to_expiry ?? 0) <= 30 ? "text-orange-700" : "text-yellow-700")}>
                  {daysLabel(u.days_to_expiry)}
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
            placeholder="Buscar instrumento, código, N° certificado…"
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">Todos los estados</option>
          {Object.entries(CAL_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">Todos los servicios</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
            No hay instrumentos con calibración{hasFilters ? " que coincidan con los filtros." : "."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Instrumento</th>
                <th className="text-left p-3">Servicio</th>
                <th className="text-left p-3">N° Certificado</th>
                <th className="text-left p-3">Empresa calibradora</th>
                <th className="text-center p-3">Última cal.</th>
                <th className="text-center p-3">Vence</th>
                <th className="text-center p-3">Días restantes</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-center p-3">Historial</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instruments.map(r => {
                const isUrgent = r.cal_status === "vencida" || r.cal_status === "por_vencer";
                return (
                  <tr key={r.id} className={cn("hover:bg-muted/30", isUrgent && "bg-red-50/40")}>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.code}{r.brand ? ` · ${r.brand}` : ""}{r.model ? ` ${r.model}` : ""}
                        {r.serial_number ? ` · S/N ${r.serial_number}` : ""}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.service ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{r.certificate_number ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.calibration_company ?? "—"}</td>
                    <td className="p-3 text-center text-xs">{formatDate(r.last_calibration_date)}</td>
                    <td className="p-3 text-center text-xs">
                      {r.expiry_date ? (
                        <span className={r.cal_status === "vencida" ? "text-red-700 font-semibold" : ""}>
                          {formatDate(r.expiry_date)}
                        </span>
                      ) : r.calibration_frequency_months ? (
                        <span className="text-muted-foreground italic">Estimado (cada {r.calibration_frequency_months} m.)</span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={cn("text-xs font-medium",
                        r.cal_status === "vencida"    ? "text-red-700" :
                        r.cal_status === "por_vencer" ? "text-orange-600" :
                        r.cal_status === "proximo"    ? "text-yellow-600" :
                        r.cal_status === "vigente"    ? "text-green-600" : "text-muted-foreground")}>
                        {daysLabel(r.days_to_expiry)}
                      </span>
                    </td>
                    <td className="p-3 text-center"><StatusBadge status={r.cal_status} /></td>
                    <td className="p-3 text-center">
                      <Link href={`/instruments/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        {r.total_calibrations} reg. <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground">
        Solo se muestran instrumentos marcados como "requiere calibración" o con frecuencia definida.
        Para registrar una calibración, ingrese al detalle del instrumento.
      </p>
    </div>
  );
}
