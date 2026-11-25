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
  X,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

interface AnnualRecord {
  year: number;
  heff_msv: number;
  periods: number;
  limit_pct: number;
  status: WorkerDose["status"];
}

interface WorkerDetail {
  worker: {
    id: number;
    name: string;
    rut: string;
    role: string | null;
    department: string | null;
    authorization_number: string | null;
    authorization_expiry_date: string | null;
  };
  annual_history: AnnualRecord[];
  summary: {
    heff_ytd: number;
    total_5y: number;
    annual_limit: number;
    five_year_limit: number;
    investigation_threshold: number;
    ytd_pct: number;
    five_year_pct: number;
    status: WorkerDose["status"];
  };
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
    chart: "#ef4444",
  },
  investigation: {
    label: "Nivel investigación",
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    bar: "bg-amber-500",
    row: "bg-amber-50/50 dark:bg-amber-950/20",
    chart: "#f59e0b",
  },
  elevated: {
    label: "Nivel elevado",
    icon: TrendingUp,
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    bar: "bg-blue-500",
    row: "",
    chart: "#3b82f6",
  },
  normal: {
    label: "Normal",
    icon: ShieldCheck,
    badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    bar: "bg-green-500",
    row: "",
    chart: "#22c55e",
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

// Custom tooltip for the trend chart
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const pct = Math.round((val / 20) * 100);
  const color = val >= 20 ? "#ef4444" : val >= 15 ? "#f59e0b" : val >= 10 ? "#3b82f6" : "#22c55e";
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color }} className="font-mono font-bold">{val.toFixed(2)} mSv</p>
      <p className="text-muted-foreground">{pct}% del límite anual</p>
    </div>
  );
}

function WorkerTrendDrawer({
  workerId,
  workerName,
  onClose,
}: {
  workerId: number;
  workerName: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dosimetry/worker-history?worker_id=${workerId}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workerId]);

  // Build chart data sorted ascending by year
  const chartData = detail
    ? [...detail.annual_history]
        .sort((a, b) => a.year - b.year)
        .map((r) => ({ year: String(r.year), heff: r.heff_msv, pct: r.limit_pct }))
    : [];

  const hasData = chartData.length > 0;

  // Determine overall trend
  let trendLabel = "";
  if (chartData.length >= 2) {
    const first = chartData[0].heff;
    const last = chartData[chartData.length - 1].heff;
    const diff = last - first;
    const pctChange = first > 0 ? Math.round((diff / first) * 100) : 0;
    if (Math.abs(diff) < 0.5) trendLabel = "Dosis estable en el período";
    else if (diff > 0) trendLabel = `Tendencia ascendente (+${pctChange}% respecto al primer año)`;
    else trendLabel = `Tendencia descendente (${pctChange}% respecto al primer año)`;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl bg-background border-l border-border h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">{workerName}</h2>
            {detail && (
              <p className="text-xs text-muted-foreground">
                {detail.worker.rut} · {detail.worker.department ?? "Sin servicio"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Cargando historial…</div>
          ) : !detail ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Error al cargar datos</div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: `Dosis ${new Date().getFullYear()}`,
                    value: `${detail.summary.heff_ytd.toFixed(2)} mSv`,
                    sub: `${detail.summary.ytd_pct}% del límite anual`,
                    color: detail.summary.ytd_pct >= 100 ? "text-red-600" : detail.summary.ytd_pct >= 75 ? "text-amber-600" : "text-green-600",
                  },
                  {
                    label: "Acumulado 5 años",
                    value: `${detail.summary.total_5y.toFixed(2)} mSv`,
                    sub: `${detail.summary.five_year_pct}% del límite quinquenal`,
                    color: detail.summary.five_year_pct >= 100 ? "text-red-600" : detail.summary.five_year_pct >= 75 ? "text-amber-600" : "text-green-600",
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={cn("text-xl font-bold font-mono mt-1", item.color)}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Trend chart */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-muted-foreground" />
                    Dosis efectiva por año (mSv)
                  </h3>
                  {trendLabel && (
                    <span className="text-xs text-muted-foreground">{trendLabel}</span>
                  )}
                </div>

                {!hasData ? (
                  <div className="text-center py-10 text-muted-foreground text-sm bg-muted/30 rounded-xl">
                    Sin registros históricos
                  </div>
                ) : (
                  <div className="bg-muted/20 rounded-xl p-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, Math.max(25, ...chartData.map((d) => d.heff)) + 2]}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          unit=" mSv"
                          width={60}
                        />
                        <Tooltip content={<TrendTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          formatter={(value) =>
                            value === "heff" ? "Dosis anual (mSv)" : value
                          }
                        />
                        {/* Reference lines */}
                        <ReferenceLine
                          y={20}
                          stroke="#ef4444"
                          strokeDasharray="4 2"
                          label={{ value: "Límite 20 mSv", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
                        />
                        <ReferenceLine
                          y={15}
                          stroke="#f59e0b"
                          strokeDasharray="4 2"
                          label={{ value: "Investig. 15 mSv", position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="heff"
                          name="heff"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={(props) => {
                            const { cx, cy, payload } = props as { cx: number; cy: number; payload: { heff: number } };
                            const val = payload.heff;
                            const color =
                              val >= 20 ? "#ef4444" : val >= 15 ? "#f59e0b" : "#3b82f6";
                            return (
                              <circle
                                key={`dot-${cx}-${cy}`}
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill={color}
                                stroke="white"
                                strokeWidth={2}
                              />
                            );
                          }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  Línea roja: límite anual 20 mSv (DS 3/1985) · Línea amarilla: nivel de investigación 15 mSv
                </p>
              </div>

              {/* Year-by-year table */}
              {hasData && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Detalle por año</h3>
                  <div className="border border-border rounded-xl overflow-hidden text-sm">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Año</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Heff (mSv)</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Trimestres</th>
                          <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs w-28">% Límite</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {[...detail.annual_history]
                          .sort((a, b) => b.year - a.year)
                          .map((r) => {
                            const cfg = STATUS_CONFIG[r.status];
                            const StatusIcon = cfg.icon;
                            return (
                              <tr key={r.year} className={cn("hover:bg-muted/30", cfg.row)}>
                                <td className="px-4 py-2.5 font-mono font-semibold">{r.year}</td>
                                <td className="px-4 py-2.5 text-right font-mono">{r.heff_msv.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{r.periods}</td>
                                <td className="px-4 py-2.5">
                                  <DoseBar
                                    pct={r.limit_pct}
                                    status={r.status}
                                  />
                                </td>
                                <td className="px-4 py-2.5">
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
                </div>
              )}

              {/* Authorization */}
              {(detail.worker.authorization_number || detail.worker.authorization_expiry_date) && (
                <div className="bg-muted/30 rounded-xl p-4 text-xs space-y-1">
                  <p className="font-medium">Autorización CCHEN</p>
                  {detail.worker.authorization_number && (
                    <p className="text-muted-foreground">N° {detail.worker.authorization_number}</p>
                  )}
                  {detail.worker.authorization_expiry_date && (
                    <p className="text-muted-foreground">
                      Vence: {new Date(detail.worker.authorization_expiry_date).toLocaleDateString("es-CL")}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkerDoseHistoryPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<{ id: number; name: string } | null>(null);

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
            Dosis efectiva acumulada (Heff) por trabajador — DS 3/1985 Art. 7 · CCHEN · Haz clic en un trabajador para ver su tendencia
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
                  <th className="px-4 py-3 font-medium text-muted-foreground w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((w) => {
                  const cfg = STATUS_CONFIG[w.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr
                      key={w.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors cursor-pointer",
                        cfg.row,
                        selectedWorker?.id === w.id && "ring-inset ring-2 ring-blue-500"
                      )}
                      onClick={() => setSelectedWorker({ id: w.id, name: w.name })}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{w.name}</span>
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
                      <td className="px-4 py-3 text-muted-foreground">
                        <BarChart2 className="h-4 w-4" />
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

      {/* Trend drawer */}
      {selectedWorker && (
        <WorkerTrendDrawer
          workerId={selectedWorker.id}
          workerName={selectedWorker.name}
          onClose={() => setSelectedWorker(null)}
        />
      )}
    </div>
  );
}
