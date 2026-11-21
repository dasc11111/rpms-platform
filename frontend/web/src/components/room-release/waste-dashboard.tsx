"use client";

import { useEffect, useState } from "react";
import { Archive, CheckCircle2, Clock, Layers, PackageCheck, Timer } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total residuos" value={t.total} icon={Layers} />
        <StatCard label="Almacenados" value={t.almacenados} icon={Archive} />
        <StatCard label="Liberados" value={t.liberados} icon={CheckCircle2} />
        <StatCard label="Pendientes" value={t.pendientes} icon={Clock} />
        <StatCard label="Prom. almacenamiento (días)" value={t.tiempoPromedioAlmacenamientoDias.toFixed(1)} icon={Timer} />
        <StatCard label="Liberables ahora" value={stats.liberables.length} icon={PackageCheck} />
      </div>

      {stats.proximosDecaimiento.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <span className="font-medium">{stats.proximosDecaimiento.length} residuo(s)</span> próximos a cumplir su
          tiempo de decaimiento (≥ 8 períodos de semidesintegración).
        </div>
      )}

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
    </div>
  );
}
