"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  RefreshCw,
  TrendingUp,
  Users,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";

interface Summary {
  total_workers: number;
  total_collective_dose: number;
  mean_individual_dose: number;
  max_individual_dose: number;
  above_20msv: number;
  above_50msv: number;
  total_readings: number;
}

interface ServiceRow {
  service: string;
  workers: number;
  collective_dose: number;
  avg_dose: number;
  max_dose: number;
  above_20msv: number;
  above_50msv: number;
}

interface TrendRow {
  month: string;
  collective_dose: number;
  workers_monitored: number;
}

interface AtRiskRow {
  worker_name: string;
  worker_rut: string | null;
  category: string;
  service: string;
  annual_dose: number;
  limit_msv: number;
  pct_of_limit: number;
}

interface HistogramRow {
  range: string;
  workers: number;
  sort_order: number;
}

interface StatsData {
  year: number;
  summary: Summary;
  by_service: ServiceRow[];
  trend: TrendRow[];
  at_risk: AtRiskRow[];
  histogram: HistogramRow[];
}

const HIST_COLORS: Record<string, string> = {
  "< 1 mSv": "bg-green-400",
  "1–5 mSv": "bg-green-500",
  "5–10 mSv": "bg-yellow-400",
  "10–15 mSv": "bg-yellow-500",
  "15–20 mSv": "bg-orange-400",
  "20–50 mSv": "bg-red-400",
  "≥ 50 mSv": "bg-red-700",
};

function KPI({
  label,
  value,
  unit,
  alert,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  alert?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        alert ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
      } shadow-sm`}
    >
      <div className={`text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1 text-gray-500">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PctBar({ pct, limit }: { pct: number; limit: number }) {
  const clamped = Math.min(pct, 110);
  const color =
    pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-400" : pct >= 50 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span
        className={`text-xs font-semibold w-12 text-right ${
          pct >= 100 ? "text-red-600" : pct >= 75 ? "text-orange-500" : "text-gray-600"
        }`}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function DosimetryStatsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dosimetry/stats?year=${y}`);
      const json = await res.json();
      setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(year);
  }, [year]);

  const maxCollective = data
    ? Math.max(...data.by_service.map((s) => Number(s.collective_dose)), 1)
    : 1;
  const maxHistWorkers = data
    ? Math.max(...data.histogram.map((h) => h.workers), 1)
    : 1;
  const maxTrendDose = data
    ? Math.max(...data.trend.map((t) => Number(t.collective_dose)), 1)
    : 1;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dosimetry"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" /> Dosimetría
          </Link>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Estadísticas de Dosis por Servicio
              </h1>
              <p className="text-xs text-gray-500">
                DS 3/1985 Art. 7 · ICRP 103 · NS-06.0 — Dosis efectiva cuerpo entero
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => fetchStats(year)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-2" />
          Calculando estadísticas…
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KPI
              label="Trabajadores monitoreados"
              value={data.summary.total_workers}
              sub={`${data.summary.total_readings} lecturas`}
            />
            <KPI
              label="Dosis colectiva"
              value={Number(data.summary.total_collective_dose).toFixed(1)}
              unit="mSv"
              sub={`${year}`}
            />
            <KPI
              label="Dosis media individual"
              value={Number(data.summary.mean_individual_dose).toFixed(2)}
              unit="mSv"
            />
            <KPI
              label="Dosis máxima individual"
              value={Number(data.summary.max_individual_dose).toFixed(2)}
              unit="mSv"
              alert={Number(data.summary.max_individual_dose) > 20}
            />
            <KPI
              label="> 20 mSv (Cat. B limite)"
              value={data.summary.above_20msv}
              alert={data.summary.above_20msv > 0}
              sub="investigar"
            />
            <KPI
              label="> 50 mSv (Cat. A limite)"
              value={data.summary.above_50msv}
              alert={data.summary.above_50msv > 0}
              sub="límite superado"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* By service */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
                <Users className="h-4 w-4 text-blue-500" />
                Dosis colectiva por servicio ({year})
              </h2>
              {data.by_service.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin datos para {year}</p>
              ) : (
                <div className="space-y-3">
                  {data.by_service.map((s) => (
                    <div key={s.service}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">
                          {s.service}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{s.workers} TOE</span>
                          <span className="text-xs font-semibold text-gray-800">
                            {Number(s.collective_dose).toFixed(1)} mSv
                          </span>
                        </div>
                      </div>
                      <MiniBar
                        value={Number(s.collective_dose)}
                        max={maxCollective}
                        color={
                          s.above_50msv > 0
                            ? "bg-red-500"
                            : s.above_20msv > 0
                            ? "bg-orange-400"
                            : "bg-blue-400"
                        }
                      />
                      {(s.above_20msv > 0 || s.above_50msv > 0) && (
                        <div className="flex gap-2 mt-0.5">
                          {s.above_20msv > 0 && (
                            <span className="text-xs text-orange-600">
                              {s.above_20msv} sobre 20 mSv
                            </span>
                          )}
                          {s.above_50msv > 0 && (
                            <span className="text-xs text-red-600 font-semibold">
                              {s.above_50msv} sobre 50 mSv
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Histogram */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
                <Activity className="h-4 w-4 text-blue-500" />
                Distribución de dosis individual ({year})
              </h2>
              {data.histogram.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin datos para {year}</p>
              ) : (
                <div className="space-y-3">
                  {data.histogram.map((h) => (
                    <div key={h.range}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{h.range}</span>
                        <span className="text-xs text-gray-500">{h.workers} trabajadores</span>
                      </div>
                      <div className="h-6 w-full rounded bg-gray-100 overflow-hidden relative">
                        <div
                          className={`h-full rounded ${HIST_COLORS[h.range] ?? "bg-gray-400"}`}
                          style={{ width: `${Math.max(4, (h.workers / maxHistWorkers) * 100)}%` }}
                        />
                        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white drop-shadow-sm">
                          {h.workers}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400 inline-block" /> Normal
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 inline-block" /> Investigar
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" /> Intervenir
                </span>
              </div>
            </section>
          </div>

          {/* Trend chart */}
          {data.trend.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Tendencia dosis colectiva mensual (últimos 12 meses)
              </h2>
              <div className="flex items-end gap-1 h-32">
                {data.trend.map((t) => {
                  const h = Math.max(4, (Number(t.collective_dose) / maxTrendDose) * 100);
                  return (
                    <div key={t.month} className="flex flex-col items-center flex-1 min-w-0 group">
                      <div className="relative w-full flex flex-col justify-end" style={{ height: "96px" }}>
                        <div
                          className="w-full rounded-t bg-blue-400 group-hover:bg-blue-500 transition"
                          style={{ height: `${h}%` }}
                          title={`${t.month}: ${Number(t.collective_dose).toFixed(1)} mSv · ${t.workers_monitored} TOE`}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 mt-1 rotate-45 origin-left truncate">
                        {t.month.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* At-risk workers */}
          {data.at_risk.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ShieldAlert className="h-4 w-4 text-orange-500" />
                  Trabajadores con mayor porcentaje de límite anual ({year})
                </h2>
                <Link
                  href="/dosimetry/worker-history"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Ver historial individual <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 pb-2">Trabajador</th>
                      <th className="text-left text-xs font-semibold text-gray-500 pb-2">Servicio</th>
                      <th className="text-center text-xs font-semibold text-gray-500 pb-2">Cat.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 pb-2">Dosis</th>
                      <th className="text-right text-xs font-semibold text-gray-500 pb-2">Límite</th>
                      <th className="pb-2 w-32"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.at_risk.map((w) => (
                      <tr key={`${w.worker_rut ?? w.worker_name}`} className="hover:bg-gray-50">
                        <td className="py-2 font-medium text-gray-900 max-w-[180px] truncate">
                          {w.worker_name}
                        </td>
                        <td className="py-2 text-gray-500 text-xs max-w-[120px] truncate">
                          {w.service}
                        </td>
                        <td className="py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-1.5 py-0.5 text-xs font-bold ${
                              w.category === "A"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {w.category}
                          </span>
                        </td>
                        <td className="py-2 text-right font-semibold text-gray-800">
                          {Number(w.annual_dose).toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-gray-400 text-xs">
                          {w.limit_msv} mSv
                        </td>
                        <td className="py-2 pl-3">
                          <PctBar pct={Number(w.pct_of_limit)} limit={w.limit_msv} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.at_risk.some((w) => Number(w.pct_of_limit) >= 100) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">
                    <strong>Límite anual superado.</strong> Los trabajadores con barra en rojo han
                    superado el límite establecido en DS 3/1985 Art. 7. Se requiere notificación
                    inmediata a CCHEN y revisión de condiciones de trabajo.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Regulatory footer */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-500">
            <span className="font-medium text-gray-600">Límites DS 3/1985 Art. 7:</span>{" "}
            Categoría A: 50 mSv/año cuerpo entero, 150 mSv/año cristalino, 500 mSv/año extremidades.{" "}
            Categoría B: 15 mSv/año cuerpo entero. Umbral investigación: 20 mSv/año. ICRP 103 (2007).
          </div>
        </>
      )}
    </div>
  );
}
