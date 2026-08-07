"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CHART_PALETTE } from "@/lib/design-system";

export interface ChartDatum {
  [key: string]: string | number;
}

const AXIS_STYLE = { stroke: "hsl(var(--muted-foreground))", fontSize: 11 };

export function BarChartCard({ data, xKey, yKeys, height = 260 }: { data: ChartDatum[]; xKey: string; yKeys: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} allowDecimals={false} />
        <Tooltip />
        <Legend />
        {yKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({ data, xKey, yKeys, height = 260 }: { data: ChartDatum[]; xKey: string; yKeys: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} />
        <Tooltip />
        <Legend />
        {yKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE[i % CHART_PALETTE.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaChartCard({ data, xKey, yKeys, height = 260 }: { data: ChartDatum[]; xKey: string; yKeys: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} />
        <Tooltip />
        <Legend />
        {yKeys.map((k, i) => (
          <Area key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE[i % CHART_PALETTE.length]} fill={CHART_PALETTE[i % CHART_PALETTE.length]} fillOpacity={0.2} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DonutChartCard({ data, dataKey, nameKey, height = 260 }: { data: ChartDatum[]; dataKey: string; nameKey: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={60} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RadarChartCard({ data, angleKey, valueKeys, height = 260 }: { data: ChartDatum[]; angleKey: string; valueKeys: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey={angleKey} tick={{ fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fontSize: 10 }} />
        {valueKeys.map((k, i) => (
          <Radar key={k} name={k} dataKey={k} stroke={CHART_PALETTE[i % CHART_PALETTE.length]} fill={CHART_PALETTE[i % CHART_PALETTE.length]} fillOpacity={0.3} />
        ))}
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function GaugeChartCard({ value, max = 100, label, height = 180 }: { value: number; max?: number; label?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const data = [
    { name: "value", value: pct },
    { name: "rest", value: 100 - pct },
  ];
  const color = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#10b981";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" startAngle={180} endAngle={0} innerRadius={60} outerRadius={90} cy="90%">
          <Cell fill={color} />
          <Cell fill="hsl(var(--muted))" />
        </Pie>
        {label ? (
          <text x="50%" y="80%" textAnchor="middle" className="fill-foreground text-lg font-bold">
            {label}
          </text>
        ) : null}
      </PieChart>
    </ResponsiveContainer>
  );
}
