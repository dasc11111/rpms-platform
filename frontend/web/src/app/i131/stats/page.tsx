"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Syringe, BarChart3, RefreshCw, TrendingUp, Users, Calendar, Beaker,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Totals {
  total: number;
  today: number;
  month: number;
  year: number;
  patients: number;
  studies: number;
  maxDosis: number;
  avgDosis: number;
  totalDosis: number;
  promedioDiario: number;
  promedioMensual: number;
}

interface GroupRow { [key: string]: string | number; count: number }

interface StatsData {
  totals: Totals;
  radiofarmacoTop: (GroupRow & { total_dosis: number }) | null;
  porRadiofarmaco: (GroupRow & { total_dosis: number })[];
  porTipoExamen: GroupRow[];
  porMedico: GroupRow[];
  porProcedencia: GroupRow[];
  porDiagnostico: GroupRow[];
  porEquipo: GroupRow[];
  porPrevision: GroupRow[];
  tendenciaMensual: { year: number; month: number; count: number; total_dosis: number }[];
  evolucionAnual: { year: number; count: number; total_dosis: number }[];
}

const inp = "rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";

function fmtMBq(v: number) {
  if (!v) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " MBq";
}

function MONTH_ES(m: number) {
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m - 1] ?? String(m);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function I131StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterQ, setFilterQ] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterYear)  params.set("year",  filterYear);
    if (filterMonth) params.set("month", filterMonth);
    if (filterQ)     params.set("q",     filterQ);
    fetch(`/api/i131/stats?${params}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [filterYear, filterMonth, filterQ]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxMonth = data ? Math.max(...data.tendenciaMensual.map(m => m.count), 1) : 1;
  const maxYear  = data ? Math.max(...data.evolucionAnual.map(y => y.count),   1) : 1;

  const years = data
    ? [...new Set(data.tendenciaMensual.map(m => m.year))].sort((a, b) => b - a)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Syringe className="h-6 w-6 text-purple-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Estadísticas de Administración I-131</h1>
              <p className="text-sm text-gray-500">Análisis de administraciones de Yodo-131 — distribución y tendencias</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
            <select className={inp} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">Todos</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <select className={inp} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={!filterYear}>
              <option value="">Todos</option>
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <option key={m} value={m}>{MONTH_ES(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Búsqueda libre</label>
            <input className={inp} placeholder="Paciente, ficha, RUN…" value={filterQ}
              onChange={e => setFilterQ(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchData()} />
          </div>
          <button onClick={fetchData} className="px-4 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-100">
            Aplicar
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-gray-400">Cargando estadísticas...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total administraciones", value: data.totals.total,   icon: Syringe,   color: "purple" },
                { label: "Pacientes únicos",        value: data.totals.patients, icon: Users,    color: "blue"   },
                { label: "Este mes",                value: data.totals.month,   icon: Calendar,  color: "green"  },
                { label: "Este año",                value: data.totals.year,    icon: TrendingUp, color: "indigo" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{value.toLocaleString("es-CL")}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Dose stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Dosis total administrada", value: fmtMBq(data.totals.totalDosis) },
                { label: "Dosis promedio",            value: fmtMBq(data.totals.avgDosis) },
                { label: "Dosis máxima registrada",   value: fmtMBq(data.totals.maxDosis) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm flex items-center gap-3">
                  <Beaker className="h-5 w-5 text-purple-400 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="text-lg font-bold text-gray-900">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Por radiofármaco */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Por Radiofármaco</h2>
                <div className="space-y-2">
                  {data.porRadiofarmaco.slice(0, 10).map((r, i) => {
                    const name = String(r.radiofarmaco ?? "Sin dato");
                    const pct = data.totals.total > 0 ? (r.count / data.totals.total) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-gray-700 truncate max-w-[180px]">{name}</span>
                            <span className="text-gray-500 ml-2">{r.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Por tipo examen */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Por Tipo de Examen</h2>
                <div className="space-y-2">
                  {data.porTipoExamen.slice(0, 10).map((r, i) => {
                    const name = String(r.tipo_examen ?? "Sin dato");
                    const pct = data.totals.total > 0 ? (r.count / data.totals.total) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-gray-700 truncate max-w-[200px]">{name}</span>
                            <span className="text-gray-500 ml-2">{r.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Por médico */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Por Médico Solicitante (top 10)</h2>
                <div className="space-y-1.5">
                  {data.porMedico.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700 truncate max-w-[220px]">{String(r.medico_solicitante ?? "Sin dato")}</span>
                      <span className="font-medium text-gray-800 ml-2">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por procedencia */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Por Procedencia</h2>
                <div className="space-y-1.5">
                  {data.porProcedencia.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700 truncate max-w-[220px]">{String(r.procedencia ?? "Sin dato")}</span>
                      <span className="font-medium text-gray-800 ml-2">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Monthly trend */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-400" /> Tendencia Mensual
                </h2>
                {data.tendenciaMensual.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
                    {data.tendenciaMensual.map((m, i) => (
                      <div key={i} className="flex-1 min-w-[18px] flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-gray-500">{m.count}</span>
                        <div className="w-full bg-purple-500 rounded-t"
                          style={{ height: `${Math.round((m.count / maxMonth) * 96)}px`, minHeight: "2px" }} />
                        <span className="text-[9px] text-gray-400">{MONTH_ES(m.month)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Annual evolution */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-400" /> Evolución Anual
                </h2>
                {data.evolucionAnual.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-2 h-32">
                    {data.evolucionAnual.map((y, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">{y.count}</span>
                        <div className="w-full bg-indigo-500 rounded-t"
                          style={{ height: `${Math.round((y.count / maxYear) * 96)}px`, minHeight: "2px" }} />
                        <span className="text-xs text-gray-500">{y.year}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Regulatory footer */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°133/1984 MINSAL — Reglamento sobre autorizaciones para instalaciones radiactivas y fuentes de radiación ionizante.
                DS N°3/1985 MINSAL Art. 68-72 — Registro y control de radiofármacos administrados a pacientes.
                CCHEN ORD. sobre administración de I-131 con fines diagnósticos y terapéuticos.
                ICRP Publication 103 — Sistema de protección radiológica para pacientes en medicina nuclear.
                DS N°594/1999 MINSAL — Áreas de trabajo controladas en instalaciones de medicina nuclear.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
