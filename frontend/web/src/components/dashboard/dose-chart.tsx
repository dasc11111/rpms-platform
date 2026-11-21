"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DosePoint {
  month: string;
  dosis_total: number;
  trabajadores: number;
  dosis_max: number;
}

interface DoseChartProps {
  data?: DosePoint[];
}

// Fallback data when no real data exists yet
const FALLBACK: DosePoint[] = [
  { month: "Sin datos", dosis_total: 0, trabajadores: 0, dosis_max: 0 },
];

export function DoseChart({ data }: DoseChartProps) {
  const chartData = data && data.length > 0 ? data : FALLBACK;
  const noData = !data || data.length === 0;

  return (
    <div className="relative h-[220px] w-full">
      {noData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground z-10">
            Sin registros en <code className="font-mono">worker_dose_summary_monthly</code>. Inicializa con <code className="font-mono">/api/init</code>.
          </p>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} mSv`} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                dosis_total: "Dosis colectiva (mSv)",
                dosis_max: "Dosis máx individual (mSv)",
              };
              return [`${value.toFixed(2)} mSv`, labels[name] ?? name];
            }}
          />
          <Bar dataKey="dosis_total" fill="hsl(217 91% 60%)" name="dosis_total" radius={[2, 2, 0, 0]} />
          <Bar dataKey="dosis_max" fill="hsl(38 92% 60%)" name="dosis_max" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
