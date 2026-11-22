"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface TrendData {
  series: { date: string; value: number; semaphore?: string; id: number }[];
  stats: { mean: number; std: number; min: number; max: number; count: number; range: number };
  trend: { slope: number; intercept: number; r2: number; direction: "ascending" | "descending" | "stable" };
  violations: { type: string; date: string; value: number; message: string }[];
  measurementType: string; unit: string | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function TrendArrow({ dir }: { dir: string }) {
  if (dir === "ascending") return <ArrowUp className="h-4 w-4 text-orange-500" />;
  if (dir === "descending") return <ArrowDown className="h-4 w-4 text-blue-500" />;
  return <Minus className="h-4 w-4 text-green-500" />;
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

export default function LinacTrendsPage() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [measurementType, setMeasurementType] = useState("");
  const [msg, setMsg] = useState("");

  const fetchData = () => {
    if (!linacId || !measurementType.trim()) { setMsg("Indica el ID del LINAC y el tipo de medición."); return; }
    setLoading(true); setMsg("");
    fetch(`/api/linac/trends?linacId=${linacId}&measurementType=${encodeURIComponent(measurementType.trim())}`)
      .then(r => r.json())
      .then(d => { if (d.error) setMsg(d.error); else setData(d); })
      .finally(() => setLoading(false));
  };

  const maxVal = data ? Math.max(...data.series.map(p => p.value)) : 0;
  const minVal = data ? Math.min(...data.series.map(p => p.value)) : 0;
  const valRange = maxVal - minVal || 1;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100"><TrendingUp className="h-6 w-6 text-indigo-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tendencias CC LINAC</h1>
              <p className="text-sm text-gray-500">Análisis estadístico y detección de violaciones de control</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {msg && <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700">{msg}</div>}

        {/* Selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ID del LINAC</label>
              <input className={inp} type="number" min="1" value={linacId} onChange={e => setLinacId(e.target.value)} placeholder="1" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Tipo de medición</label>
              <input className={inp} value={measurementType} onChange={e => setMeasurementType(e.target.value)} placeholder="Ej: output_6mv_diario, flatness_6mv, symmetry_6mv" />
            </div>
          </div>
          <button onClick={fetchData} disabled={loading || !linacId || !measurementType.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
            {loading ? "Cargando…" : "Analizar tendencia"}
          </button>
        </div>

        {data && (
          <>
            {/* Violations alert */}
            {data.violations.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 space-y-1">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm"><AlertTriangle className="h-4 w-4" /> {data.violations.length} violación{data.violations.length > 1 ? "es" : ""} de control detectada{data.violations.length > 1 ? "s" : ""}</div>
                {data.violations.map((v, i) => (
                  <div key={i} className="text-xs text-red-600 ml-6">{fmtDate(v.date)}: {v.message}</div>
                ))}
              </div>
            )}

            {/* Stats tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "N", value: data.stats.count.toString() },
                { label: "Media", value: `${data.stats.mean.toFixed(3)} ${data.unit ?? ""}` },
                { label: "Desv. estándar", value: `${data.stats.std.toFixed(3)}` },
                { label: "Rango", value: `${data.stats.range.toFixed(3)}` },
                { label: "R²", value: data.trend.r2.toFixed(3) },
              ].map(t => (
                <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
                  <div className="text-lg font-bold text-gray-700">{t.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{t.label}</div>
                </div>
              ))}
            </div>

            {/* Trend direction */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <TrendArrow dir={data.trend.direction} />
                <span className="font-semibold text-gray-800">
                  Tendencia {data.trend.direction === "ascending" ? "ascendente" : data.trend.direction === "descending" ? "descendente" : "estable"}
                </span>
                <span className="text-sm text-gray-400">pendiente: {data.trend.slope.toExponential(2)}</span>
              </div>

              {/* Sparkline chart */}
              <div className="relative h-40 bg-gray-50 rounded-lg overflow-hidden">
                <svg viewBox={`0 0 ${data.series.length} 100`} preserveAspectRatio="none" className="w-full h-full">
                  {/* Mean line */}
                  <line x1="0" y1={100 - ((data.stats.mean - minVal) / valRange) * 100} x2={data.series.length} y2={100 - ((data.stats.mean - minVal) / valRange) * 100} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="1,1" />
                  {/* Trend line */}
                  {data.series.length > 1 && (
                    <line
                      x1="0" y1={100 - ((data.trend.intercept - minVal) / valRange) * 100}
                      x2={data.series.length} y2={100 - ((data.trend.intercept + data.trend.slope * data.series.length - minVal) / valRange) * 100}
                      stroke="#6366f1" strokeWidth="0.8" opacity="0.6"
                    />
                  )}
                  {/* Data points */}
                  {data.series.map((p, i) => {
                    const y = 100 - ((p.value - minVal) / valRange) * 100;
                    const color = p.semaphore === "rojo" ? "#ef4444" : p.semaphore === "naranja" ? "#f97316" : p.semaphore === "amarillo" ? "#eab308" : "#22c55e";
                    return <circle key={i} cx={i + 0.5} cy={y} r="1" fill={color} />;
                  })}
                  {/* Connecting line */}
                  <polyline
                    fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.4"
                    points={data.series.map((p, i) => `${i + 0.5},${100 - ((p.value - minVal) / valRange) * 100}`).join(" ")}
                  />
                </svg>
                <div className="absolute top-1 left-2 text-xs text-gray-400">{maxVal.toFixed(3)}</div>
                <div className="absolute bottom-1 left-2 text-xs text-gray-400">{minVal.toFixed(3)}</div>
              </div>
            </div>

            {/* Recent data table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Últimos {Math.min(20, data.series.length)} registros</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b"><th className="text-left pb-2">Fecha</th><th className="text-right pb-2">Valor</th><th className="text-right pb-2">Estado</th></tr></thead>
                <tbody>
                  {data.series.slice(-20).reverse().map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 text-gray-600">{fmtDate(p.date)}</td>
                      <td className="py-1.5 text-right font-mono text-gray-700">{p.value.toFixed(3)} {data.unit ?? ""}</td>
                      <td className="py-1.5 text-right">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.semaphore === "rojo" ? "bg-red-100 text-red-700" : p.semaphore === "amarillo" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                          {p.semaphore ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>AAPM TG-40 / TG-142 — Reglas de control estadístico (Shewhart, CUSUM) para CC de aceleradores. IAEA TECDOC-1151 — Análisis de tendencias en dosimetría de haz externo. DS N°12/2010 MINSAL — Requisitos de registro y análisis de CC. CCHEN ORD sobre control estadístico de procesos en instalaciones de radioterapia.</p>
        </div>
      </div>
    </div>
  );
}
