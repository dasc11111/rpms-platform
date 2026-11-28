"use client";


import { useEffect, useState } from "react";
import { RefreshCw, Tag, AlertTriangle, BarChart3, TrendingUp, CheckCircle2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Totals {
  total: number; almacenados: number; liberados: number; pendientes: number;
  tiempoPromedioAlmacenamientoDias: number;
}
interface DistRow { label: string; count: number; }
interface MensualRow { mes: string; total: string; liberados: string; }
interface AnualRow { anio: string; total: string; liberados: string; }
interface DecayRow {
  id: number; waste_code: string; radionuclide: string; room: string;
  service: string; activity_bq: number; label_date: string;
  dias_restantes: number; status: string;
}
interface StatsData {
  totals: Totals;
  porRadionuclido: DistRow[];
  porTipo: DistRow[];
  porSala: DistRow[];
  porServicio: DistRow[];
  mensual: MensualRow[];
  anual: AnualRow[];
  proximosDecaimiento: DecayRow[];
  liberables: DecayRow[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function DistBar({ rows, colorClass }: { rows: DistRow[]; colorClass: string }) {
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <div className="space-y-1.5">
      {rows.slice(0, 10).map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-foreground/80 w-28 shrink-0 truncate">{r.label || "Sin dato"}</span>
          <div className="flex-1 h-2 bg-muted rounded-full">
            <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WasteLabelStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/waste-labels/stats")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const maxMensual = data ? Math.max(...data.mensual.map(m => Number(m.total) || 0), 1) : 1;
  const maxAnual   = data ? Math.max(...data.anual.map(a => Number(a.total) || 0), 1) : 1;

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Tag className="h-6 w-6 text-orange-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Estadísticas de Rótulos de Residuos</h1>
              <p className="text-sm text-muted-foreground">Análisis de rótulos radiactivos — ciclo de vida, distribuciones y próximos a liberar</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-muted-foreground hover:text-muted-foreground">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-muted-foreground">Cargando estadísticas...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* Alert: liberables */}
            {data.liberables.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3 text-green-700 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span><strong>{data.liberables.length}</strong> rótulos listos para liberación radiológica.</span>
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Total rótulos",    value: data.totals.total,            color: "orange" },
                { label: "Almacenados",      value: data.totals.almacenados,      color: "blue" },
                { label: "Liberados",        value: data.totals.liberados,        color: "green" },
                { label: "Pendientes",       value: data.totals.pendientes,       color: "yellow" },
                { label: "Tiempo prom. (d)", value: data.totals.tiempoPromedioAlmacenamientoDias.toFixed(1), color: "gray" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-background rounded-xl border border-border px-4 py-4 shadow-sm">
                  <div className="text-2xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Por radionúclido */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Radionúclido</h2>
                <DistBar rows={data.porRadionuclido} colorClass="bg-orange-400" />
              </div>

              {/* Por tipo */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Tipo de Residuo</h2>
                <DistBar rows={data.porTipo} colorClass="bg-blue-400" />
              </div>

              {/* Por sala */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Sala</h2>
                <DistBar rows={data.porSala} colorClass="bg-teal-400" />
              </div>

              {/* Por servicio */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4">Por Servicio</h2>
                <DistBar rows={data.porServicio} colorClass="bg-violet-400" />
              </div>

              {/* Mensual */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-400" /> Tendencia Mensual
                </h2>
                {data.mensual.length === 0 ? <p className="text-xs text-muted-foreground">Sin datos.</p> : (
                  <div className="flex items-end gap-1 h-32">
                    {data.mensual.map((m, i) => {
                      const tot = Number(m.total) || 0;
                      const lib = Number(m.liberados) || 0;
                      const h = Math.round((tot / maxMensual) * 96);
                      const libH = tot > 0 ? Math.round((lib / tot) * h) : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(h, tot > 0 ? 2 : 0)}px` }}>
                            <div className="bg-green-400 w-full" style={{ height: `${libH}px` }} />
                            <div className="bg-orange-300 w-full flex-1" />
                          </div>
                          <span className="text-[9px] text-muted-foreground">{m.mes.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-300 inline-block" /> Total</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Liberados</span>
                </div>
              </div>

              {/* Anual */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" /> Histórico Anual
                </h2>
                {data.anual.length === 0 ? <p className="text-xs text-muted-foreground">Sin datos.</p> : (
                  <div className="flex items-end gap-2 h-32">
                    {data.anual.map((a, i) => {
                      const tot = Number(a.total) || 0;
                      const h = Math.round((tot / maxAnual) * 96);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-muted-foreground">{tot > 0 ? tot : ""}</span>
                          <div className="w-full bg-blue-400 rounded-t" style={{ height: `${Math.max(h, tot > 0 ? 2 : 0)}px` }} />
                          <span className="text-[9px] text-muted-foreground">{a.anio}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Próximos a decaer */}
              {data.proximosDecaimiento.length > 0 && (
                <div className="bg-background rounded-xl border border-border shadow-sm p-5 col-span-full">
                  <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" /> Próximos a Decaer (30 días)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground uppercase tracking-wide">
                          <th className="py-2 pr-3">Código</th>
                          <th className="py-2 pr-3">Radionúclido</th>
                          <th className="py-2 pr-3">Sala</th>
                          <th className="py-2 pr-3">Actividad</th>
                          <th className="py-2 pr-3">Fecha rótulo</th>
                          <th className="py-2">Días rest.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.proximosDecaimiento.map((d, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-1.5 pr-3 font-mono text-foreground/80">{d.waste_code}</td>
                            <td className="py-1.5 pr-3">{d.radionuclide}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{d.room || "—"}</td>
                            <td className="py-1.5 pr-3">{d.activity_bq?.toLocaleString("es-CL")} Bq</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{fmtDate(d.label_date)}</td>
                            <td className="py-1.5">
                              <span className={`font-semibold ${d.dias_restantes <= 0 ? "text-green-600" : d.dias_restantes <= 7 ? "text-yellow-600" : "text-muted-foreground"}`}>
                                {d.dias_restantes <= 0 ? "¡Listo!" : d.dias_restantes + " días"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Regulatory footer */}
            <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-muted-foreground mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°133/1984 Ministerio de Minería — Reglamento de Seguridad Radiológica, rotulado y gestión de residuos.
                Decreto Supremo N°12/2010 MINSAL — Reglamento de protección radiológica de instalaciones radiactivas.
                IAEA Safety Standards Series GSG-1 — Classification of Radioactive Waste.
                CCHEN ORD. sobre procedimientos de liberación radiológica de residuos hospitalarios.
                DS N°594/1999 MINSAL — Condiciones sanitarias en el manejo de materiales radiactivos.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
