"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Gauge,
  Layers,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
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
import type { I131Filters } from "./i131-search-panel";
import { mesNombre } from "@/lib/i131";

type Stats = {
  totals: {
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
  };
  radiofarmacoTop: { radiofarmaco: string; count: number; total_dosis: number } | null;
  porRadiofarmaco: { radiofarmaco: string; count: number; total_dosis: number }[];
  porTipoExamen: { tipo_examen: string; count: number }[];
  porMedico: { medico_solicitante: string; count: number }[];
  porProcedencia: { procedencia: string; count: number }[];
  porDiagnostico: { diagnostico: string; count: number }[];
  porEquipo: { equipo: string; count: number }[];
  porPrevision: { prevision: string; count: number }[];
  tendenciaMensual: { year: number; month: number; count: number; total_dosis: number }[];
  evolucionAnual: { year: number; count: number; total_dosis: number }[];
};

const PIE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

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

function filtersToQuery(filters: I131Filters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

// Dashboard 100% automatico: se recalcula solo, sin botones de actualizacion,
// cada vez que cambian los filtros o que se crea/edita/elimina un registro
// (prop "version").
export function I131Dashboard({ filters, version }: { filters: I131Filters; version: number }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    const qs = filtersToQuery(filters);
    fetch(`/api/i131/stats?${qs}`)
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
    dosis: Number(r.total_dosis),
  }));
  const evolucion = stats.evolucionAnual.map((r) => ({
    year: String(r.year),
    count: r.count,
    dosis: Number(r.total_dosis),
  }));
  const topDiagnostico = stats.porDiagnostico.slice(0, 10);
  const topMedico = stats.porMedico.slice(0, 10);
  const topProcedencia = stats.porProcedencia.slice(0, 10);
  const topEquipoTipo = [
    ...stats.porEquipo.map((r) => ({ label: r.equipo, count: r.count, tipo: "Equipo" })),
    ...stats.porTipoExamen.map((r) => ({ label: r.tipo_examen, count: r.count, tipo: "Tipo examen" })),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Heatmap simple year x month
  const years = Array.from(new Set(stats.tendenciaMensual.map((r) => r.year))).sort();
  const maxCount = Math.max(1, ...stats.tendenciaMensual.map((r) => r.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Total administraciones" value={t.total} icon={Layers} />
        <StatCard label="Hoy" value={t.today} icon={CalendarDays} />
        <StatCard label="Este mes" value={t.month} icon={CalendarDays} />
        <StatCard label="Este año" value={t.year} icon={CalendarDays} />
        <StatCard label="Pacientes" value={t.patients} icon={Users} />
        <StatCard label="Tipos de estudio" value={t.studies} icon={Activity} />
        <StatCard label="Máxima actividad" value={`${t.maxDosis.toFixed(0)} mCi`} icon={Zap} />
        <StatCard label="Actividad promedio" value={`${t.avgDosis.toFixed(1)} mCi`} icon={Gauge} />
        <StatCard label="Promedio diario" value={t.promedioDiario} icon={TrendingUp} />
        <StatCard label="Promedio mensual" value={t.promedioMensual} icon={TrendingUp} />
      </div>

      {stats.radiofarmacoTop && (
        <div className="rounded-lg border border-border bg-accent-subtle p-3 text-sm">
          Radiofármaco más utilizado:{" "}
          <span className="font-semibold">{stats.radiofarmacoTop.radiofarmaco}</span> ({stats.radiofarmacoTop.count}{" "}
          administraciones, {Number(stats.radiofarmacoTop.total_dosis).toFixed(0)} mCi acumulados)
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tendencia mensual">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="Administraciones" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolución anual">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolucion}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#16a34a" fill="#16a34a33" name="Administraciones" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 diagnósticos">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topDiagnostico} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="diagnostico" fontSize={9} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" name="Administraciones" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por previsión">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stats.porPrevision} dataKey="count" nameKey="prevision" outerRadius={80} label>
                {stats.porPrevision.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 médicos solicitantes">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topMedico} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="medico_solicitante" fontSize={9} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" name="Administraciones" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por procedencia">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topProcedencia} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="procedencia" fontSize={9} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#d97706" name="Administraciones" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ranking Top 10 (equipo / tipo de examen)">
          <ol className="space-y-1.5 text-sm">
            {topEquipoTipo.map((r, i) => (
              <li key={`${r.tipo}-${r.label}-${i}`} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {i + 1}
                  </span>
                  <span className="truncate">{r.label || "—"}</span>
                  <span className="text-[10px] text-muted-foreground">({r.tipo})</span>
                </span>
                <span className="font-medium tabular-nums">{r.count}</span>
              </li>
            ))}
            {topEquipoTipo.length === 0 && <p className="text-muted-foreground">Sin datos suficientes.</p>}
          </ol>
        </ChartCard>

        <ChartCard title="Heatmap de administraciones (año x mes)">
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
                            title={`${count} administraciones`}
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
      </div>
    </div>
  );
}
