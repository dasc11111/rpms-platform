"use client";


import { useEffect, useState } from "react";
import { RefreshCw, Trash2, AlertTriangle, BarChart3, TrendingUp, MapPin } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Totales {
  totalEnAlmacenamiento: number;
  liberablesAhora: number;
  tiempoPromedioAlmacenamientoDias: number;
  proximos30Dias: number;
}
interface PorUbicacion { location: string; count: number; }
interface ProximoALiberar {
  id: number; waste_code: string; radionuclide: string; activity_bq: number;
  storage_start: string; dias_restantes: number; location: string;
}
interface MovimientoMes { mes: string; entradas: string; salidas: string; }
interface DashData {
  totales: Totales;
  porUbicacion: PorUbicacion[];
  proximosALiberar: ProximoALiberar[];
  movimientosPorMes: MovimientoMes[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WasteStorageDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/waste-storage/dashboard")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const totalUbicacion = data ? data.porUbicacion.reduce((s, u) => s + u.count, 0) : 0;
  const maxMov = data ? Math.max(...data.movimientosPorMes.map(m => Math.max(Number(m.entradas) || 0, Number(m.salidas) || 0)), 1) : 1;

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Trash2 className="h-6 w-6 text-orange-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard de Almacenamiento de Desechos</h1>
              <p className="text-sm text-muted-foreground">Control de residuos radiactivos en almacenamiento — estado, liberaciones y movimientos</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-muted-foreground hover:text-muted-foreground">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-muted-foreground">Cargando datos...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* Alert: liberables ahora */}
            {data.totales.liberablesAhora > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3 text-green-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span><strong>{data.totales.liberablesAhora}</strong> residuos disponibles para liberación radiológica inmediata.</span>
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "En almacenamiento", value: data.totales.totalEnAlmacenamiento, icon: Trash2, color: "orange" },
                { label: "Liberables ahora",  value: data.totales.liberablesAhora,       icon: AlertTriangle, color: "green" },
                { label: "Liberables 30 días",value: data.totales.proximos30Dias,        icon: BarChart3, color: "yellow" },
                { label: "Tiempo prom. (días)",value: data.totales.tiempoPromedioAlmacenamientoDias, icon: TrendingUp, color: "blue" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-background rounded-xl border border-border px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString("es-CL") : value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Por ubicación */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-400" /> Distribución por Ubicación
                </h2>
                <div className="space-y-2">
                  {data.porUbicacion.map((u, i) => {
                    const pct = totalUbicacion > 0 ? (u.count / totalUbicacion) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-foreground/80 w-36 shrink-0 truncate">{u.location || "Sin ubicación"}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full">
                          <div className="h-2 bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{u.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Movimientos mensuales */}
              <div className="bg-background rounded-xl border border-border shadow-sm p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" /> Movimientos Mensuales
                </h2>
                {data.movimientosPorMes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin movimientos.</p>
                ) : (
                  <>
                    <div className="flex items-end gap-1 h-32">
                      {data.movimientosPorMes.map((m, i) => {
                        const ent = Number(m.entradas) || 0;
                        const sal = Number(m.salidas) || 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full flex gap-px items-end" style={{ height: "96px" }}>
                              <div className="flex-1 bg-orange-400 rounded-t" style={{ height: `${Math.round((ent / maxMov) * 96)}px`, minHeight: ent > 0 ? "2px" : "0" }} />
                              <div className="flex-1 bg-blue-400 rounded-t" style={{ height: `${Math.round((sal / maxMov) * 96)}px`, minHeight: sal > 0 ? "2px" : "0" }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground">{m.mes.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" /> Entradas</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> Salidas</span>
                    </div>
                  </>
                )}
              </div>

              {/* Próximos a liberar */}
              {data.proximosALiberar.length > 0 && (
                <div className="bg-background rounded-xl border border-border shadow-sm p-5 col-span-full">
                  <h2 className="font-semibold text-foreground mb-3">Residuos Próximos a Liberar (30 días)</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground uppercase tracking-wide">
                          <th className="py-2 pr-4">Código</th>
                          <th className="py-2 pr-4">Radionúclido</th>
                          <th className="py-2 pr-4">Actividad</th>
                          <th className="py-2 pr-4">Inicio almac.</th>
                          <th className="py-2 pr-4">Días rest.</th>
                          <th className="py-2">Ubicación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.proximosALiberar.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-1.5 pr-4 font-mono text-foreground/80">{p.waste_code}</td>
                            <td className="py-1.5 pr-4 text-foreground/80">{p.radionuclide}</td>
                            <td className="py-1.5 pr-4 text-foreground/80">{p.activity_bq ? p.activity_bq.toLocaleString("es-CL") + " Bq" : "—"}</td>
                            <td className="py-1.5 pr-4 text-muted-foreground">{fmtDate(p.storage_start)}</td>
                            <td className="py-1.5 pr-4">
                              <span className={`font-semibold ${p.dias_restantes <= 0 ? "text-green-600" : p.dias_restantes <= 7 ? "text-yellow-600" : "text-muted-foreground"}`}>
                                {p.dias_restantes <= 0 ? "¡Listo!" : p.dias_restantes + " días"}
                              </span>
                            </td>
                            <td className="py-1.5 text-muted-foreground">{p.location || "—"}</td>
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
                Decreto Supremo N°133/1984 Ministerio de Minería — Reglamento de Seguridad Radiológica, gestión de residuos radiactivos.
                Decreto Supremo N°12/2010 MINSAL — Reglamento de protección radiológica, almacenamiento y disposición.
                IAEA Safety Standards Series GSG-1 — Classification of Radioactive Waste.
                IAEA Safety Standards Series SSG-40 — Predisposal Management of Radioactive Waste from Nuclear Power Plants.
                CCHEN ORD. sobre gestión de residuos radiactivos en instalaciones hospitalarias.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
