"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Gauge,
  Layers,
  MapPin,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ContaminationFilters } from "./contamination-search-panel";
import { mesNombre, CLASIFICACION_LABELS } from "@/lib/contamination";

type Stats = {
  totals: {
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
  };
  porRadionuclido: { radionuclido: string; count: number }[];
  porSala: { sala: string; count: number }[];
  porArea: { area: string; count: number }[];
  porInstrumento: { instrumento: string; count: number }[];
  porResponsable: { responsable: string; count: number }[];
  porClasificacion: { clasificacion: string; count: number }[];
  tendenciaMensual: { year: number; month: number; count: number; avg_actividad: number }[];
  evolucionAnual: { year: number; count: number; avg_actividad: number }[];
  areasTop: { punto_medicion: string; count: number }[];
};

const PIE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
const CLASIFICACION_COLORS: Record<string, string> = {
  sin_contaminacion: "#16a34a",
  bajo_referencia: "#22c55e",
  cercano_limite: "#d97706",
  sobre_limite: "#dc2626",
};

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  hint?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
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

function filtersToQuery(filters: ContaminationFilters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

// Dashboard 100% automatico: se recalcula solo, sin botones de actualizacion,
// cada vez que cambian los filtros o que se crea/edita/elimina un registro
// (prop "version").
export function ContaminationDashboard({ filters, version }: { filters: ContaminationFilters; version: number }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    const qs = filtersToQuery(filters);
    fetch(`/api/contamination/stats?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [filters, version]);

  if (!stats) {
    return <div className="text-sm text-muted-foreground">Cargando indicadores...</div>;
  }

  const t = stats.totals;
  const tendencia = stats.tendenciaMensual.map((r) => ({
    label: `${mesNombre(r.month).slice(0, 3)} ${String(r.year).slice(2)}`,
    count: r.count,
    avgActividad: Number(r.avg_actividad),
  }));
  const evolucion = stats.evolucionAnual.map((r) => ({
    year: String(r.year),
    count: r.count,
    avgActividad: Number(r.avg_actividad),
  }));
  const porClasificacionData = stats.porClasificacion.map((r) => ({
    name: CLASIFICACION_LABELS[r.clasificacion as keyof typeof CLASIFICACION_LABELS] ?? r.clasificacion,
    key: r.clasificacion,
    count: r.count,
  }));

  const years = Array.from(new Set(stats.tendenciaMensual.map((r) => r.year))).sort();
  const maxCount = Math.max(1, ...stats.tendenciaMensual.map((r) => r.count));
  const maxAreaCount = Math.max(1, ...stats.areasTop.map((r) => r.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Total monitoreos" value={t.total} icon={Layers} />
        <StatCard label="Hoy" value={t.today} icon={CalendarDays} />
        <StatCard label="Este mes" value={t.month} icon={CalendarDays} />
        <StatCard label="Este año" value={t.year} icon={CalendarDays} />
        <StatCard label="Áreas evaluadas" value={t.areas} icon={MapPin} />
        <StatCard label="Conformes" value={t.conformes} icon={CheckCircle2} />
        <StatCard label="Cercanos al límite" value={t.cercanos} icon={AlertTriangle} />
        <StatCard label="Sobre el límite" value={t.sobreLimite} icon={AlertTriangle} />
        <StatCard label="Actividad máxima" value={`${t.maxActividad.toFixed(0)} Bq/m²`} icon={Zap} />
        <StatCard label="Actividad promedio" value={`${t.avgActividad.toFixed(1)} Bq/m²`} icon={Gauge} />
        <StatCard label="Promedio diario" value={t.promedioDiario} icon={TrendingUp} />
        <StatCard label="Promedio mensual" value={t.promedioMensual} icon={TrendingUp} />
      </div>

      {t.sobreLimite > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Hay {t.sobreLimite} monitoreo{t.sobreLimite > 1 ? "s" : ""} sobre el límite de referencia. Revise las
          acciones correctivas pendientes en la pestaña Registros.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tendencia mensual (monitoreos y actividad promedio)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="Monitoreos" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolución anual">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucion}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" name="Monitoreos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución de resultados">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={porClasificacionData} dataKey="count" nameKey="name" outerRadius={80} label>
                {porClasificacionData.map((entry, i) => (
                  <Cell key={i} fill={CLASIFICACION_COLORS[entry.key] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por radionúclido">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stats.porRadionuclido} dataKey="count" nameKey="radionuclido" outerRadius={80} label>
                {stats.porRadionuclido.map((_, i) => (
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
              <YAxis type="category" dataKey="sala" fontSize={9} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" name="Monitoreos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por detector">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.porInstrumento} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="instrumento" fontSize={9} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" name="Monitoreos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por responsable">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.porResponsable} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="responsable" fontSize={9} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#d97706" name="Monitoreos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ranking Top 10 — áreas con mayor número de eventos">
          <ol className="space-y-1.5 text-sm">
            {stats.areasTop.map((r, i) => (
              <li key={`${r.punto_medicion}-${i}`} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{r.punto_medicion || "—"}</span>
                <span className="w-24 shrink-0">
                  <span
                    className="block h-2 rounded bg-accent"
                    style={{ width: `${Math.max(6, (r.count / maxAreaCount) * 100)}%` }}
                  />
                </span>
                <span className="font-medium tabular-nums">{r.count}</span>
              </li>
            ))}
            {stats.areasTop.length === 0 && <p className="text-muted-foreground">Sin datos suficientes.</p>}
          </ol>
        </ChartCard>

        <ChartCard title="Heatmap de monitoreos (año x mes)">
          <div className="overflow-x-auto">
            <table className="w-full text-center text-[10px]">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left">Año</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="px-1 py-1">
                      {mesNombre(i + 1).slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y}>
                    <td className="px-1 py-1 text-left font-medium">{y}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const found = stats.tendenciaMensual.find((r) => r.year === y && r.month === i + 1);
                      const count = found?.count ?? 0;
                      const intensity = count === 0 ? 0 : Math.max(0.15, count / maxCount);
                      return (
                        <td key={i} className="px-1 py-1">
                          <div
                            className="mx-auto flex h-6 w-6 items-center justify-center rounded"
                            style={{ backgroundColor: `rgba(37, 99, 235, ${intensity})` }}
                            title={`${count} monitoreos`}
                          >
                            {count > 0 ? count : ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Actividad superficial promedio (Bq/m²) por mes">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="avgActividad" stroke="#dc2626" strokeWidth={2} dot={false} name="Actividad promedio (Bq/m²)" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
