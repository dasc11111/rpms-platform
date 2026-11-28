"use client";

import { useEffect, useState } from "react";
import { Archive, CheckCircle2, Clock, Layers, PackageCheck, Timer, AlertTriangle, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Stats = {
  totals: {
    total: number;
    almacenados: number;
    liberados: number;
    pendientes: number;
    tiempoPromedioAlmacenamientoDias: number;
  };
  porRadionuclido: { radionuclide_code: string; count: number }[];
  porTipo: { waste_type: string; count: number }[];
  porSala: { sala: string; count: number }[];
  porServicio: { service: string; count: number }[];
  mensual: { year: number; month: number; count: number }[];
  anual: { year: number; count: number }[];
  proximosDecaimiento: { id: number; label_number: string; elapsed_days: number; half_life_days: number }[];
  liberables: { id: number; label_number: string; elapsed_days: number; half_life_days: number }[];
};

const PIE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

const KPI_COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  blue:   { border: "border-blue-100",   text: "text-blue-600",   bg: "bg-blue-50" },
  green:  { border: "border-green-100",  text: "text-green-600",  bg: "bg-green-50" },
  teal:   { border: "border-teal-100",   text: "text-teal-600",   bg: "bg-teal-50" },
  orange: { border: "border-orange-100", text: "text-orange-600", bg: "bg-orange-50" },
  red:    { border: "border-red-100",    text: "text-red-600",    bg: "bg-red-50" },
  yellow: { border: "border-yellow-100", text: "text-yellow-600", bg: "bg-yellow-50" },
  purple: { border: "border-purple-100", text: "text-purple-600", bg: "bg-purple-50" },
  sky:    { border: "border-sky-100",    text: "text-sky-600",    bg: "bg-sky-50" },
  rose:   { border: "border-rose-100",   text: "text-rose-600",   bg: "bg-rose-50" },
  indigo: { border: "border-indigo-100", text: "text-indigo-600", bg: "bg-indigo-50" },
  gray:   { border: "border-border/50",   text: "text-muted-foreground",   bg: "bg-muted/50" },
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Dashboard 100% automatico: se recalcula solo cada vez que se genera, edita
// o cambia el estado de un rotulo (prop "version"), sin botones de recarga.
export function WasteDashboard({ version }: { version: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dashTab, setDashTab] = useState("resumen");

  useEffect(() => {
    let active = true;
    fetch("/api/waste-labels/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [version]);

  if (!stats) {
    return <div className="text-sm text-muted-foreground">Cargando indicadores...</div>;
  }

  const t = stats.totals;
  const mensual = stats.mensual.map((r) => ({ label: `${MESES_CORTOS[r.month - 1] ?? r.month} ${String(r.year).slice(2)}`, count: r.count }));

  // Alertas críticas
  const hayAlertas = stats.proximosDecaimiento.length > 0 || stats.liberables.length > 0;

  return (
    <div className="space-y-4">
      {/* Panel del dashboard */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {/* Header con tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Dashboard de Almacenamiento de Residuos</span>
            {hayAlertas && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                {stats.proximosDecaimiento.length + stats.liberables.length} alertas
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {(["resumen", "inventario", "liberacion", "tendencias"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDashTab(t)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${dashTab === t ? "bg-accent text-white" : "text-muted-foreground hover:bg-accent/10"}`}
              >
                {t === "resumen" ? "Resumen" : t === "inventario" ? "Inventario" : t === "liberacion" ? "Próx. Liberación" : "Tendencias"}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido de tabs */}
        <div className="p-4">

          {/* TAB: RESUMEN */}
          {dashTab === "resumen" && (() => {
            const tasaLiberacion = t.total > 0 ? Math.round((t.liberados / t.total) * 100) : 0;
            const tasaAlmacenados = t.total > 0 ? Math.round((t.almacenados / t.total) * 100) : 0;
            const libColor = KPI_COLOR_MAP[stats.liberables.length === 0 ? "green" : stats.liberables.length <= 3 ? "yellow" : "orange"];
            const decColor = KPI_COLOR_MAP[stats.proximosDecaimiento.length === 0 ? "green" : "orange"];
            return (
              <div className="space-y-4">
                {/* KPIs principales */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Total rótulos", value: t.total, color: "blue", icon: Layers },
                    { label: "Almacenados", value: t.almacenados, color: "purple", icon: Archive },
                    { label: "Liberados", value: t.liberados, color: "green", icon: CheckCircle2 },
                    { label: "Pendientes", value: t.pendientes, color: "yellow", icon: Clock },
                    { label: "Prom. almacenamiento (días)", value: t.tiempoPromedioAlmacenamientoDias.toFixed(1), color: "sky", icon: Timer },
                    { label: "Liberables ahora", value: stats.liberables.length, color: stats.liberables.length === 0 ? "green" : "orange", icon: PackageCheck },
                  ].map((kpi) => {
                    const c = KPI_COLOR_MAP[kpi.color];
                    return (
                      <div key={kpi.label} className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground leading-tight">{kpi.label}</span>
                          <kpi.icon className={`h-3.5 w-3.5 ${c.text}`} strokeWidth={2} />
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${c.text}`}>{kpi.value}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Alertas */}
                {hayAlertas && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {stats.proximosDecaimiento.length > 0 && (
                      <div className={`rounded-lg border ${decColor.border} ${decColor.bg} p-3`}>
                        <div className="mb-2 flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${decColor.text}`} />
                          <span className={`text-xs font-semibold ${decColor.text}`}>Próximos a cumplir decaimiento</span>
                        </div>
                        <div className="space-y-1">
                          {stats.proximosDecaimiento.slice(0, 5).map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-xs">
                              <span className="font-medium">{r.label_number}</span>
                              <span className="text-muted-foreground">{r.elapsed_days}d / {r.half_life_days * 10}d</span>
                            </div>
                          ))}
                          {stats.proximosDecaimiento.length > 5 && (
                            <span className="text-[10px] text-muted-foreground">+{stats.proximosDecaimiento.length - 5} más</span>
                          )}
                        </div>
                      </div>
                    )}
                    {stats.liberables.length > 0 && (
                      <div className={`rounded-lg border ${libColor.border} ${libColor.bg} p-3`}>
                        <div className="mb-2 flex items-center gap-2">
                          <PackageCheck className={`h-4 w-4 ${libColor.text}`} />
                          <span className={`text-xs font-semibold ${libColor.text}`}>Liberables ahora</span>
                        </div>
                        <div className="space-y-1">
                          {stats.liberables.slice(0, 5).map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-xs">
                              <span className="font-medium">{r.label_number}</span>
                              <span className="text-muted-foreground">{r.elapsed_days}d transcurridos</span>
                            </div>
                          ))}
                          {stats.liberables.length > 5 && (
                            <span className="text-[10px] text-muted-foreground">+{stats.liberables.length - 5} más</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tasas de gestión */}
                <div className="rounded-lg border border-border p-3">
                  <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">Tasas de Gestión</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Tasa de liberación", pct: tasaLiberacion, color: "bg-green-500" },
                      { label: "En almacenamiento", pct: tasaAlmacenados, color: "bg-purple-500" },
                      { label: "Pendientes de gestión", pct: t.total > 0 ? Math.round((t.pendientes / t.total) * 100) : 0, color: "bg-yellow-500" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-0.5 flex justify-between text-[11px]">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-semibold">{item.pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div className={`h-2 rounded-full ${item.color} transition-all`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB: INVENTARIO */}
          {dashTab === "inventario" && (() => {
            const totalRnuclidos = stats.porRadionuclido.reduce((s, r) => s + r.count, 0);
            const totalSalas = stats.porSala.reduce((s, r) => s + r.count, 0);
            const totalServicios = stats.porServicio.reduce((s, r) => s + r.count, 0);
            const totalTipos = stats.porTipo.reduce((s, r) => s + r.count, 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Por radionúclido */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">Por Radionúclido</h4>
                    <div className="space-y-2">
                      {stats.porRadionuclido.slice(0, 8).map((r, i) => {
                        const pct = totalRnuclidos > 0 ? Math.round((r.count / totalRnuclidos) * 100) : 0;
                        const bgColors = ["bg-blue-500","bg-green-500","bg-orange-500","bg-red-500","bg-purple-500","bg-teal-500","bg-sky-500","bg-rose-500"];
                        return (
                          <div key={r.radionuclide_code}>
                            <div className="mb-0.5 flex justify-between text-[11px]">
                              <span className="font-medium">{r.radionuclide_code}</span>
                              <span className="text-muted-foreground">{r.count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div className={`h-2 rounded-full ${bgColors[i % bgColors.length]} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Por tipo de residuo */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">Por Tipo de Residuo</h4>
                    <div className="space-y-2">
                      {stats.porTipo.slice(0, 8).map((r, i) => {
                        const pct = totalTipos > 0 ? Math.round((r.count / totalTipos) * 100) : 0;
                        const bgColors = ["bg-indigo-500","bg-teal-500","bg-orange-500","bg-pink-500","bg-yellow-500","bg-cyan-500","bg-lime-500","bg-violet-500"];
                        return (
                          <div key={r.waste_type}>
                            <div className="mb-0.5 flex justify-between text-[11px]">
                              <span className="font-medium">{r.waste_type}</span>
                              <span className="text-muted-foreground">{r.count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div className={`h-2 rounded-full ${bgColors[i % bgColors.length]} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Por sala */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">Por Sala</h4>
                    <div className="space-y-2">
                      {stats.porSala.slice(0, 8).map((r) => {
                        const pct = totalSalas > 0 ? Math.round((r.count / totalSalas) * 100) : 0;
                        return (
                          <div key={r.sala}>
                            <div className="mb-0.5 flex justify-between text-[11px]">
                              <span className="font-medium">{r.sala}</span>
                              <span className="text-muted-foreground">{r.count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Por servicio */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">Por Servicio</h4>
                    <div className="space-y-2">
                      {stats.porServicio.slice(0, 8).map((r) => {
                        const pct = totalServicios > 0 ? Math.round((r.count / totalServicios) * 100) : 0;
                        return (
                          <div key={r.service}>
                            <div className="mb-0.5 flex justify-between text-[11px]">
                              <span className="font-medium">{r.service}</span>
                              <span className="text-muted-foreground">{r.count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div className="h-2 rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB: PRÓXIMOS A LIBERAR */}
          {dashTab === "liberacion" && (() => {
            const todasLiberables = stats.liberables;
            const proximasDecaimiento = stats.proximosDecaimiento;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { label: "Liberables ahora", value: todasLiberables.length, color: todasLiberables.length === 0 ? "green" : "orange" },
                    { label: "Próx. a decaer (≥8 T½)", value: proximasDecaimiento.length, color: proximasDecaimiento.length === 0 ? "green" : "yellow" },
                    { label: "Prom. almacenamiento (días)", value: t.tiempoPromedioAlmacenamientoDias.toFixed(1), color: "sky" },
                  ].map((kpi) => {
                    const c = KPI_COLOR_MAP[kpi.color];
                    return (
                      <div key={kpi.label} className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
                        <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{kpi.label}</div>
                        <div className={`text-2xl font-bold tabular-nums ${c.text}`}>{kpi.value}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Lista liberables */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">
                      Rótulos Liberables Ahora ({todasLiberables.length})
                    </h4>
                    {todasLiberables.length === 0 ? (
                      <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-center">
                        <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Sin rótulos liberables pendientes</span>
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {todasLiberables.map((r) => (
                          <div key={r.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-2 py-1.5 text-xs">
                            <span className="font-semibold text-orange-800">{r.label_number}</span>
                            <div className="text-right">
                              <div className="text-orange-700">{r.elapsed_days}d transcurridos</div>
                              <div className="text-[10px] text-muted-foreground">T½ × 10 = {r.half_life_days * 10}d requeridos</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista próximos a decaer */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">
                      Próximos a Cumplir Decaimiento ({proximasDecaimiento.length})
                    </h4>
                    {proximasDecaimiento.length === 0 ? (
                      <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-center">
                        <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Sin rótulos próximos a decaer</span>
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {proximasDecaimiento.map((r) => {
                          const pct = Math.min(100, Math.round((r.elapsed_days / (r.half_life_days * 10)) * 100));
                          return (
                            <div key={r.id} className="rounded-lg bg-yellow-50 p-2 text-xs">
                              <div className="mb-1 flex justify-between">
                                <span className="font-semibold text-yellow-800">{r.label_number}</span>
                                <span className="text-yellow-700">{pct}% completado</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-yellow-200">
                                <div className="h-1.5 rounded-full bg-yellow-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">{r.elapsed_days}d / {r.half_life_days * 10}d requeridos</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB: TENDENCIAS */}
          {dashTab === "tendencias" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Cantidad mensual (histórico)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={mensual}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="Rótulos" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Cantidad anual">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.anual.map((r) => ({ year: String(r.year), count: r.count }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="year" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#16a34a" name="Rótulos" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribución por radionúclido">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats.porRadionuclido} dataKey="count" nameKey="radionuclide_code" outerRadius={80} label>
                      {stats.porRadionuclido.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribución por tipo de residuo">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats.porTipo} dataKey="count" nameKey="waste_type" outerRadius={80} label>
                      {stats.porTipo.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribución por sala">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.porSala} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" fontSize={10} />
                    <YAxis type="category" dataKey="sala" fontSize={9} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#7c3aed" name="Rótulos" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribución por servicio">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.porServicio} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" fontSize={10} />
                    <YAxis type="category" dataKey="service" fontSize={9} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#d97706" name="Rótulos" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
