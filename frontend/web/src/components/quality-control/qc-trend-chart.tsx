'use client';

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Grafico de tendencia por prueba (requisito IAEA-TECDOC-602): permite
// proyectar la evolucion del valor medido frente al valor de referencia y
// la desviacion porcentual a lo largo del tiempo, para una misma prueba de
// control de calidad. No reemplaza la calibracion externa certificada.

export type QcTrendPoint = {
  test_date: string;
  measured_value: number | null;
  reference_value: number | null;
  deviation_percent: number | null;
};

export function QcTrendChart({
  points,
  unit,
}: {
  points: QcTrendPoint[];
  unit: string | null;
}) {
  const data = useMemo(() => {
    return points
      .filter((p) => p.measured_value !== null)
      .slice()
      .sort((a, b) => (a.test_date < b.test_date ? -1 : 1))
      .map((p) => ({
        fecha: p.test_date,
        Medido: p.measured_value !== null ? Number(p.measured_value) : null,
        Referencia: p.reference_value !== null ? Number(p.reference_value) : null,
        "Desviacion (%)": p.deviation_percent !== null ? Number(p.deviation_percent) : null,
      }));
  }, [points]);

  if (data.length < 2) {
    return (
      <p className="px-1 py-4 text-[11px] text-muted-foreground">
        Se necesitan al menos 2 mediciones con valor registrado para trazar la tendencia de esta prueba.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="fecha" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} width={42} />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            formatter={(value, name) => {
              const suffix = name === "Desviacion (%)" ? "%" : unit ? ` ${unit}` : "";
              return [`${value}${suffix}`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="Medido" stroke="#2563eb" dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Referencia" stroke="#16a34a" strokeDasharray="4 2" dot={false} />
          <Line type="monotone" dataKey="Desviacion (%)" stroke="#dc2626" dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
