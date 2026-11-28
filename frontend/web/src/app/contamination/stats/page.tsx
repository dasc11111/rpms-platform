"use client";


import { useEffect, useState, useCallback } from "react";
import {
  Biohazard, BarChart3, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, MapPin,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Totals {
  total: number;
  today: number;
  month: number;
  year: number;
  areas: number;
  conformes: number;
  cercanos: number;
  sobreLimite: number;
  maxActividad: number;
  avgActividad: number;
  promedioDiario: number;
  promedioMensual: number;
}

interface GroupRow { [key: string]: string | number; count: number }

interface StatsData {
  totals: Totals;
  porRadionuclido: GroupRow[];
  porSala: GroupRow[];
  porArea: GroupRow[];
  porInstrumento: GroupRow[];
  porResponsable: GroupRow[];
  porClasificacion: GroupRow[];
  tendenciaMensual: { year: number; month: number; count: number; avg_actividad: number }[];
  evolucionAnual: { year: number; count: number; avg_actividad: number }[];
  areasTop: { punto_medicion: string; count: number }[];
}

const inp = "rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

function fmtBq(v: number) {
  if (!v) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 0 }) + " Bq/m²";
}

function MONTH_ES(m: number) {
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m - 1] ?? String(m);
}

const CLASIF_CFG: Record<string, { label: string; cls: string }> = {
  sin_contaminacion: { label: "Sin contaminación", cls: "text-green-600" },
  bajo_referencia:   { label: "Bajo nivel de referencia", cls: "text-green-500" },
  cercano_limite:    { label: "Cercano al límite", cls: "text-yellow-600" },
  sobre_limite:      { label: "Sobre el límite", cls: "text-red-600" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContaminationStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState("");
  const [filterClasif, setFilterClasif] = useState("");
  const [filterArea, setFilterArea] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterYear)   params.set("year",          filterYear);
    if (filterClasif) params.set("clasificacion",  filterClasif);
    if (filterArea)   params.set("area",           filterArea);
    fetch(`/api/contamination/stats?${params}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [filterYear, filterClasif, filterArea]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const years = data
    ? [...new Set(data.tendenciaMensual.map(m => m.year))].sort((a, b) => b - a)
    : [];

  const maxMonth = data ? Math.max(...data.tendenciaMensual.map(m => m.count), 1) : 1;
  const maxYear  = data ? Math.max(...data.evolucionAnual.map(y => y.count),   1) : 1;

  const totalClasif = data ? (data.totals.conformes + data.totals.cercanos + data.totals.sobreLimite) : 0;
  const pct = (v: number) => totalClasif > 0 ? Math.round((v / totalClasif) * 100) : 0;

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Biohazard className="h-6 w-6 text-orange-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Estadísticas de Monitoreo de Contaminación</h1>
              <p className="text-sm text-muted-foreground">Análisis de registros de contaminación superficial radiactiva</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-muted-foreground hover:text-muted-foreground">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-background rounded-xl border border-border shadow-sm px-5 py-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Año</label>
            <select className={inp} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">Todos</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Clasificación</label>
            <select className={inp} value={filterClasif} onChange={e => setFilterClasif(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(CLASIF_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Área</label>
            <input className={inp} placeholder="Filtrar por área…" value={filterArea}
              onChange={e => setFilterArea(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchData()} />
          </div>
          <button onClick={fetchData} className="px-4 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-100">
            Aplicar
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-muted-foreground">Cargando estadísticas...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* Alert if above-limit records */}
            {data.totals.sobreLimite > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3 text-red-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span><strong>{data.totals.sobreLimite}</strong> registros con actividad sobre los límites de referencia — revisar acciones correctivas.</span>
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total mediciones",    value: data.totals.total,  icon: Biohazard,     color: "orange" },
                { label: "Áreas monitoreadas",  value: data.totals.areas,  icon: MapPin,        color: "blue"   },
                { label: "Este mes",            value: data.totals.month,  icon: BarChart3,     color: "purple" },
                { label: "Este año",            value: data.totals.year,   icon: TrendingUp,    color: "indigo" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-background rounded-xl border border-border px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{value.toLocaleString("es-CL")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Classification summary + dose tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Classification breakdown */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Clasificación de Mediciones
                </h2>
                <div className="space-y-3">
                  {[
                    { key: "conformes",   label: "Conformes (sin cont. + bajo ref.)", value: data.totals.conformes, color: "bg-green-500" },
                    { key: "cercanos",    label: "Cercanos al límite",                 value: data.totals.cercanos,  color: "bg-yellow-500" },
                    { key: "sobreLimite", label: "Sobre el límite",                    value: data.totals.sobreLimite, color: "bg-red-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-44 shrink-0">{label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full">
                        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct(value)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground/80 w-14 text-right">{value} ({pct(value)}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dose metrics */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Actividad Superficial (Bq/m²)</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Actividad máxima",   value: fmtBq(data.totals.maxActividad) },
                    { label: "Actividad promedio",  value: fmtBq(data.totals.avgActividad) },
                    { label: "Prom. diario (medic.)", value: data.totals.promedioDiario.toFixed(1) },
                    { label: "Prom. mensual",       value: data.totals.promedioMensual.toFixed(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className="text-sm font-bold text-foreground">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Por radionúclido */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Radionúclido (top 10)</h2>
                <div className="space-y-2">
                  {data.porRadionuclido.slice(0, 10).map((r, i) => {
                    const name = String(r.radionuclido ?? "Sin dato");
                    const pctVal = data.totals.total > 0 ? (r.count / data.totals.total) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-foreground/80">{name}</span>
                            <span className="text-muted-foreground ml-2">{r.count}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full">
                            <div className="h-1.5 bg-orange-400 rounded-full" style={{ width: `${pctVal}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Por sala */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Sala (top 10)</h2>
                <div className="space-y-2">
                  {data.porSala.slice(0, 10).map((r, i) => {
                    const name = String(r.sala ?? "Sin dato");
                    const pctVal = data.totals.total > 0 ? (r.count / data.totals.total) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-foreground/80 truncate max-w-[200px]">{name}</span>
                            <span className="text-muted-foreground ml-2">{r.count}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full">
                            <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pctVal}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Por punto de medición */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Punto de Medición (top 10)</h2>
                <div className="space-y-1.5">
                  {data.areasTop.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground/80 truncate max-w-[220px]">{r.punto_medicion}</span>
                      <span className="font-medium text-foreground ml-2">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por responsable */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Responsable (top 10)</h2>
                <div className="space-y-1.5">
                  {data.porResponsable.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground/80 truncate max-w-[220px]">{String(r.responsable ?? "Sin dato")}</span>
                      <span className="font-medium text-foreground ml-2">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Tendencia Mensual</h2>
                {data.tendenciaMensual.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
                    {data.tendenciaMensual.map((m, i) => (
                      <div key={i} className="flex-1 min-w-[18px] flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">{m.count}</span>
                        <div className="w-full bg-orange-400 rounded-t"
                          style={{ height: `${Math.round((m.count / maxMonth) * 96)}px`, minHeight: "2px" }} />
                        <span className="text-[9px] text-muted-foreground">{MONTH_ES(m.month)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Evolución Anual</h2>
                {data.evolucionAnual.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-2 h-32">
                    {data.evolucionAnual.map((y, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">{y.count}</span>
                        <div className="w-full bg-orange-500 rounded-t"
                          style={{ height: `${Math.round((y.count / maxYear) * 96)}px`, minHeight: "2px" }} />
                        <span className="text-xs text-muted-foreground">{y.year}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Regulatory footer */}
            <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-muted-foreground mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°3/1985 MINSAL Art. 60-64 — Monitoreo de contaminación superficial en instalaciones radiactivas.
                DS N°594/1999 MINSAL — Límites de contaminación superficial en lugares de trabajo.
                IAEA Safety Reports Series No. 40 — Measurement and calculation of radon releases from uranium mill tailings.
                ICRP Publication 103 — Límites de contaminación de superficie (Tabla B-3, Anexo B).
                CCHEN ORD. sobre registros de monitoreo de contaminación radiactiva ambiental.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
