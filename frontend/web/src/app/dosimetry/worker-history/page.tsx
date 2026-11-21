"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Search,
  TrendingUp,
  Users,
  ShieldAlert,
  ShieldCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface WorkerDose {
  id: number;
  name: string;
  rut: string;
  department: string | null;
  role: string | null;
  heff_msv: number;
  periods: number;
  total_5y: number;
  ytd_pct: number;
  five_year_pct: number;
  status: "normal" | "elevated" | "investigation" | "exceeded";
}

interface SummaryData {
  year: number;
  workers: WorkerDose[];
  stats: { exceeded: number; investigation: number; elevated: number; total: number };
  limits: { annual: number; five_year: number; investigation: number };
}

const STATUS_CONFIG = {
  exceeded: {
    label: "Límite superado",
    icon: ShieldAlert,
    badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    bar: "bg-red-500",
    row: "bg-red-50/50 dark:bg-red-950/20",
  },
  investigation: {
    label: "Nivel investigación",
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    bar: "bg-amber-500",
    row: "bg-amber-50/50 dark:bg-amber-950/20",
  },
  elevated: {
    label: "Nivel elevado",
    icon: TrendingUp,
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    bar: "bg-blue-500",
    row: "",
  },
  normal: {
    label: "Normal",
    icon: ShieldCheck,
    badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    bar: "bg-green-500",
    row: "",
  },
};

function DoseBar({ pct, status }: { pct: number; status: WorkerDose["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const clamped = Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", cfg.bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

export default function WorkerDoseHistoryPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dosimetry/worker-history?year=${y}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const filtered = (data?.workers ?? []).filter(
    (w) =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.rut.includes(search) ||
      (w.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dosimetry" className="flex items-center gap-1 hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" />
              Dosimetría
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de Dosis Individual</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dosis efectiva acumulada (Heff) por trabajador — DS 3/1985 Art. 7 · CCHEN
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Año:</label>
          <select
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Limits info */}
      <div className="flex flex-wrap gap-3">
        {data && [
          { label: "Límite anual", value: `${data.limits.annual} mSv/año`, color: "text-red-600", icon: ShieldAlert },
          { label: "Límite quinquenal", value: `${data.limits.five_year} mSv/5 años`, color: "text-amber-600", icon: AlertTriangle },
          { label: "Nivel investigación", value: `${data.limits.investigation} mSv/año`, color: "text-blue-600", icon: Info },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs">
              <Icon className={cn("h-3.5 w-3.5", item.color)} />
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="font-mono font-semibold">{item.value}</span>
            </div>
          );
        })}
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total trabajadores", value: data.stats.total, icon: Users, color: "" },
            {
              label: "Límite superado",
              value: data.stats.exceeded,
              icon: ShieldAlert,
              color: data.stats.exceeded > 0 ? "text-red-600" : "text-muted-foreground",
            },
            {
              label: "Nivel investigación",
              value: data.stats.investigation,
              icon: AlertTriangle,
              color: data.stats.investigation > 0 ? "text-amber-600" : "text-muted-foreground",
            },
            {
              label: "Nivel elevado (>50%)",
              value: data.stats.elevated,
              icon: TrendingUp,
              color: data.stats.elevated > 0 ? "text-blue-600" : "text-muted-foreground",
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{item.value}</span>
                  <Icon className={cn("h-5 w-5", item.color)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alert for exceeded */}
      {data && data.stats.exceeded > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-xl text-sm text-red-800 dark:text-red-300">
          <ShieldAlert className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">
              {data.stats.exceeded} trabajador(es) han superado el límite anual de {data?.limits.annual} mSv
            </p>
            <p className="text-xs mt-1 opacity-80">
              Notificar a CCHEN según NS-06.0 §16. Revisar dosimetría y apartar de trabajo con radiaciones hasta evaluación.
            </p>
          </div>
        </div>
      )}

      {/* Search + Table */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background"
            placeholder="Buscar trabajador, RUT, servicio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Cargando datos…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {search ? "Sin resultados para la búsqueda" : `No hay registros de dosis para ${year}`}
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trabajador</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Servicio</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Heff {year} (mSv)
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-40">% Límite anual</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                    5 años (mSv)
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-32 hidden lg:table-cell">
                    % Límite 5a
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((w) => {
                  const cfg = STATUS_CONFIG[w.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={w.id} className={cn("hover:bg-muted/30 transition-colors", cfg.row)}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/workers/${w.id}`}
                          className="font-medium hover:underline"
                        >
                          {w.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{w.rut}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {w.department ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {w.heff_msv.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <DoseBar pct={w.ytd_pct} status={w.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden lg:table-cell">
                        {w.total_5y.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <DoseBar
                          pct={w.five_year_pct}
                          status={w.five_year_pct >= 100 ? "exceeded" : w.five_year_pct >= 75 ? "investigation" : "normal"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                            cfg.badge
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
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

      {/* Regulatory note */}
      <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
        <p>
          <strong>Base normativa:</strong> DS 3/1985 (MINSAL) Art. 7 — Límites de dosis para trabajadores ocupacionalmente expuestos
        </p>
        <p>
          Heff ≤ 20 mSv/año · Suma quinquenal ≤ 100 mSv · Nivel de investigación: 15 mSv/año
        </p>
        <p>Los datos provienen de los registros de dosimetría importados desde informes CCHEN.</p>
      </div>
    </div>
  );
}
