"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Datos reales provenientes del dashboard server component
export interface DoseDataPoint {
  month: string;
  dosis_total: number;
  trabajadores: number;
  dosis_max: number;
}

// Formato interno para el gráfico (por servicio)
interface ChartPoint {
  month: string;
  radiotherapy: number;
  nuclearMedicine: number;
  imaging: number;
  interventional: number;
}

// Datos de muestra: 12 meses por servicio (mSv)
const STATIC_DATA: ChartPoint[] = [
  { month: "Ago 25", radiotherapy: 1.2, nuclearMedicine: 2.1, imaging: 0.8, interventional: 1.5 },
  { month: "Sep 25", radiotherapy: 1.4, nuclearMedicine: 2.3, imaging: 0.9, interventional: 1.6 },
  { month: "Oct 25", radiotherapy: 1.1, nuclearMedicine: 2.0, imaging: 0.7, interventional: 1.4 },
  { month: "Nov 25", radiotherapy: 1.3, nuclearMedicine: 2.2, imaging: 0.8, interventional: 1.5 },
  { month: "Dic 25", radiotherapy: 1.5, nuclearMedicine: 2.4, imaging: 0.9, interventional: 1.7 },
  { month: "Ene 26", radiotherapy: 1.2, nuclearMedicine: 2.1, imaging: 0.8, interventional: 1.5 },
  { month: "Feb 26", radiotherapy: 1.3, nuclearMedicine: 2.3, imaging: 0.8, interventional: 1.4 },
  { month: "Mar 26", radiotherapy: 1.4, nuclearMedicine: 2.2, imaging: 0.9, interventional: 1.6 },
  { month: "Abr 26", radiotherapy: 1.1, nuclearMedicine: 2.0, imaging: 0.7, interventional: 1.5 },
  { month: "May 26", radiotherapy: 1.3, nuclearMedicine: 2.4, imaging: 0.8, interventional: 1.6 },
  { month: "Jun 26", radiotherapy: 1.5, nuclearMedicine: 2.6, imaging: 0.9, interventional: 1.8 },
  { month: "Jul 26", radiotherapy: 1.2, nuclearMedicine: 2.3, imaging: 0.8, interventional: 1.5 },
];

/** Convierte datos reales (dosis total) en formato de gráfico estimando por servicio (40/30/15/15%) */
function toChartPoints(data: DoseDataPoint[]): ChartPoint[] {
  return data.map((d) => ({
    month: d.month,
    radiotherapy: parseFloat((d.dosis_total * 0.40).toFixed(2)),
    nuclearMedicine: parseFloat((d.dosis_total * 0.30).toFixed(2)),
    imaging: parseFloat((d.dosis_total * 0.15).toFixed(2)),
    interventional: parseFloat((d.dosis_total * 0.15).toFixed(2)),
  }));
}

const SERIES: Array<{ key: keyof Omit<ChartPoint, "month">; label: string; color: string }> = [
  { key: "radiotherapy", label: "Radioterapia", color: "hsl(217 91% 60%)" },
  { key: "nuclearMedicine", label: "Medicina Nuclear", color: "hsl(158 76% 46%)" },
  { key: "imaging", label: "Imagenología", color: "hsl(38 92% 60%)" },
  { key: "interventional", label: "Intervencionismo", color: "hsl(280 65% 60%)" },
];

interface DoseChartProps {
  /** Datos reales desde worker_dose_summary_monthly. Si vacío, usa datos de muestra. */
  data?: DoseDataPoint[];
}

export function DoseChart({ data }: DoseChartProps) {
  const chartData: ChartPoint[] =
    data && data.length > 0 ? toChartPoints(data) : STATIC_DATA;

  const totalMsv = chartData
    .reduce((sum, d) => sum + d.radiotherapy + d.nuclearMedicine + d.imaging + d.interventional, 0)
    .toFixed(1);

  const isLive = data && data.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          {isLive ? `Total ${chartData.length}m: ${totalMsv} mSv` : `Muestra: ${totalMsv} mSv`}
        </span>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v} mSv`}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--surface-overlay))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="dose" fill={s.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
