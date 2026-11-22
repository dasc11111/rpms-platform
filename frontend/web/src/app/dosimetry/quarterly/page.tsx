"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
const SEM: Record<string, string> = {
  verde:   "bg-green-100 text-green-700",
  amarillo:"bg-yellow-100 text-yellow-700",
  naranja: "bg-orange-100 text-orange-700",
  rojo:    "bg-red-100 text-red-700",
};

interface Reading {
  id: number;
  worker_rut: string;
  worker_name: string;
  dosimeter_type: string;
  period: string;
  dose: number;
  dose_unit: string;
  status: string;
  body_region: string;
  badge_number: string;
  lab_report_id: string;
  measured_at: string;
  notes: string;
  semaphore?: string;
  pct_limit?: number;
}

interface WorkerSummary {
  worker_rut: string;
  worker_name: string;
  total_dose: number;
  dose_unit: string;
  semaphore: string;
  pct_limit: number;
  record_count: number;
  periods: string;
  year: string;
}

function SemBadge({ s }: { s?: string }) {
  if (!s) return null;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEM[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>;
}

export default function DosimetryQuarterlyPage() {
  const [view, setView] = useState<"readings" | "summary">("readings");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [summary, setSummary] = useState<WorkerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [period, setPeriod] = useState("");
  const [rut, setRut] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const years = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());
  const quarters = ["", "Q1", "Q2", "Q3", "Q4"];

  async function fetchReadings() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (year) params.set("year", year);
      if (period) params.set("period", period);
      if (rut) params.set("rut", rut);
      const res = await fetch(`/api/dosimetry?${params}`);
      const data = await res.json();
      setReadings(data.readings ?? data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSummary() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ summary: "1" });
      if (year) params.set("year", year);
      const res = await fetch(`/api/dosimetry?${params}`);
      const data = await res.json();
      setSummary(data.rows ?? data.summary ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (view === "readings") fetchReadings();
    else fetchSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, year, period, rut, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const alertCount = summary.filter(w => w.semaphore === "rojo" || w.semaphore === "naranja").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dosimetría Trimestral</h1>
        <p className="text-sm text-gray-500 mt-1">Registros individuales de dosis efectiva por trabajador — DS 3/1985 MINSAL</p>
      </div>

      {/* KPI tiles */}
      {view === "summary" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Trabajadores</p>
            <p className="text-2xl font-bold text-gray-900">{summary.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Alertas activas</p>
            <p className={`text-2xl font-bold ${alertCount > 0 ? "text-red-600" : "text-green-600"}`}>{alertCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Conformes</p>
            <p className="text-2xl font-bold text-green-600">{summary.filter(w => w.semaphore === "verde").length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Año</p>
            <p className="text-2xl font-bold text-indigo-600">{year}</p>
          </div>
        </div>
      )}

      {/* Alert banner */}
      {view === "summary" && alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-500 shrink-0" size={20} />
          <div>
            <p className="font-semibold text-red-700">Límites de dosis en alerta</p>
            <p className="text-sm text-red-600">{alertCount} trabajador(es) superando umbrales DS 3/1985. Revisar inmediatamente.</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => { setView("readings"); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition ${view === "readings" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Lecturas
            </button>
            <button onClick={() => setView("summary")}
              className={`px-4 py-2 text-sm font-medium transition ${view === "summary" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Resumen Anual
            </button>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">Año</label>
            <select value={year} onChange={e => { setYear(e.target.value); setPage(1); }} className={inp}>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {view === "readings" && (
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-500 mb-1">Período</label>
              <select value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }} className={inp}>
                {quarters.map(q => <option key={q} value={q}>{q || "Todos"}</option>)}
              </select>
            </div>
          )}

          {view === "readings" && (
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-gray-500 mb-1">RUT trabajador</label>
              <input value={rut} onChange={e => { setRut(e.target.value); setPage(1); }} placeholder="12345678-9" className={inp} />
            </div>
          )}
        </div>
      </div>

      {/* Readings table */}
      {view === "readings" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Trabajador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RUT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Período</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Dosis</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Región</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Semáforo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Estado</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
                ) : readings.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin registros para los filtros seleccionados</td></tr>
                ) : readings.map(r => (
                  <>
                    <tr key={r.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.worker_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.worker_rut}</td>
                      <td className="px-4 py-3 text-gray-600">{r.period}</td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-700">{Number(r.dose).toFixed(3)} {r.dose_unit}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{r.body_region?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3"><SemBadge s={r.semaphore} /></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "read" ? "bg-green-100 text-green-700" : r.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`exp-${r.id}`} className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div><span className="text-gray-500 text-xs">Dosímetro</span><p className="font-medium">{r.dosimeter_type}</p></div>
                            <div><span className="text-gray-500 text-xs">N° Insignia</span><p className="font-medium">{r.badge_number || "—"}</p></div>
                            <div><span className="text-gray-500 text-xs">Lab Informe</span><p className="font-medium">{r.lab_report_id || "—"}</p></div>
                            <div><span className="text-gray-500 text-xs">Fecha medición</span><p className="font-medium">{r.measured_at ? new Date(r.measured_at).toLocaleDateString("es-CL") : "—"}</p></div>
                            {r.pct_limit !== undefined && (
                              <div>
                                <span className="text-gray-500 text-xs">% del límite anual</span>
                                <p className="font-medium">{r.pct_limit?.toFixed(1)}%</p>
                              </div>
                            )}
                            {r.notes && (
                              <div className="col-span-2 md:col-span-4">
                                <span className="text-gray-500 text-xs">Notas</span>
                                <p className="font-medium">{r.notes}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {view === "readings" && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {total} registros · Pág. {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={16} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary table */}
      {view === "summary" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Trabajador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RUT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Dosis total {year}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">% Límite</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Períodos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Semáforo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
                ) : summary.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin datos para {year}</td></tr>
                ) : summary.map((w, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{w.worker_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{w.worker_rut}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-700">{Number(w.total_dose).toFixed(3)} {w.dose_unit}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${w.semaphore === "rojo" ? "bg-red-500" : w.semaphore === "naranja" ? "bg-orange-500" : w.semaphore === "amarillo" ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, w.pct_limit ?? 0)}%` }} />
                        </div>
                        <span className="text-xs font-medium">{(w.pct_limit ?? 0).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{w.record_count} lecturas</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <SemBadge s={w.semaphore} />
                        {w.semaphore === "verde" && <CheckCircle size={14} className="text-green-500" />}
                        {(w.semaphore === "rojo" || w.semaphore === "naranja") && <AlertTriangle size={14} className="text-red-500" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — DS 3/1985 MINSAL (mod. DS 133/1984)</p>
        <p className="text-xs text-blue-600">Límite dosis efectiva: Categoría A 50 mSv/año · Categoría B 15 mSv/año · Umbral investigación 30% del límite</p>
      </div>
    </div>
  );
}
