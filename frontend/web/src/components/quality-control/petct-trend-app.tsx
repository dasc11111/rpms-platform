"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * MODULO 4 - PET/CT - FASE K
 * Grafico de control tipo Levey-Jennings y tabla de tendencia (secciones
 * 16-18 del prompt de mejora). Complementa (no reemplaza) el criterio de
 * tolerancia de cada prueba: media y desviacion estandar (2DE/3DE)
 * calculadas sobre el historico de resultados FINALIZADOS de un mismo
 * equipo y prueba (los borradores no cuentan, igual que en el panel de
 * cumplimiento de la Fase H).
 */

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type TrendMetricInfo = {
  test_code: string;
  table: "pet" | "ct" | "joint";
  label: string;
  unit: string;
};

type TrendStatsPoint = {
  record_id: number;
  performed_at: string;
  value: number;
  status: "dentro_control" | "alerta_2de" | "fuera_control_3de";
  westgard_2_2de: boolean;
};

type TrendSeries = {
  n: number;
  mean_value: number;
  stddev_value: number;
  upper_warning_2de: number | null;
  lower_warning_2de: number | null;
  upper_action_3de: number | null;
  lower_action_3de: number | null;
  points: TrendStatsPoint[];
};

type TrendResponse = {
  equipment_id: number;
  test_code: string;
  label: string;
  unit: string;
  series: TrendSeries | null;
};

function equipmentLabel(eq: Equipment): string {
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

const STATUS_LABELS: Record<TrendStatsPoint["status"], string> = {
  dentro_control: "Dentro de control",
  alerta_2de: "Alerta (> 2 DE)",
  fuera_control_3de: "Fuera de control (> 3 DE)",
};

const STATUS_CLASSES: Record<TrendStatsPoint["status"], string> = {
  dentro_control: "bg-green-100 text-green-800 border-green-300",
  alerta_2de: "bg-amber-100 text-amber-800 border-amber-300",
  fuera_control_3de: "bg-red-100 text-red-800 border-red-300",
};

function renderDot(props: { cx?: number; cy?: number; payload?: TrendStatsPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return <g />;
  let color = "#16a34a";
  if (payload.status === "alerta_2de") color = "#d97706";
  if (payload.status === "fuera_control_3de") color = "#dc2626";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1} />;
}
export default function PetCtTrendApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [testCode, setTestCode] = useState("");
  const [metrics, setMetrics] = useState<TrendMetricInfo[]>([]);
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch("/api/quality-control/petct/trend");
        const json = await res.json();
        setMetrics(Array.isArray(json.metrics) ? json.metrics : []);
      } finally {
        setLoadingMetrics(false);
      }
    }
    loadMetrics();
  }, []);

  async function loadTrend() {
    if (!equipmentId || !testCode) {
      setError("Debe seleccionar equipo y prueba.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quality-control/petct/trend?equipment_id=${equipmentId}&test_code=${encodeURIComponent(testCode)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al consultar la tendencia.");
        setData(null);
        return;
      }
      setData(json as TrendResponse);
    } catch {
      setError("Error al consultar la tendencia.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!data?.series) return [];
    return data.series.points.map((p) => ({
      fecha: new Date(p.performed_at).toLocaleDateString(),
      Valor: p.value,
      status: p.status,
      westgard_2_2de: p.westgard_2_2de,
      record_id: p.record_id,
    }));
  }, [data]);

  const groupedByTable = useMemo(() => {
    const groups: Record<string, TrendMetricInfo[]> = { pet: [], ct: [], joint: [] };
    for (const m of metrics) groups[m.table]?.push(m);
    return groups;
  }, [metrics]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tendencia y grafico de control PET/CT</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase K (secciones 16-18 del prompt de mejora). Grafico de control tipo
          Levey-Jennings: media y limites de advertencia (+/-2 DE) y de accion (+/-3 DE) calculados
          sobre el historico de resultados FINALIZADOS del equipo y prueba seleccionados. Complementa,
          no reemplaza, el criterio de tolerancia propio de cada prueba.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Equipo</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Seleccionar...</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {equipmentLabel(eq)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Prueba</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
          >
            <option value="">{loadingMetrics ? "Cargando..." : "Seleccionar..."}</option>
            {groupedByTable.pet.length > 0 && (
              <optgroup label="Pruebas PET">
                {groupedByTable.pet.map((m) => (
                  <option key={m.test_code} value={m.test_code}>
                    {m.test_code} - {m.label}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedByTable.ct.length > 0 && (
              <optgroup label="Pruebas CT">
                {groupedByTable.ct.map((m) => (
                  <option key={m.test_code} value={m.test_code}>
                    {m.test_code} - {m.label}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedByTable.joint.length > 0 && (
              <optgroup label="Interaccion PET/CT">
                {groupedByTable.joint.map((m) => (
                  <option key={m.test_code} value={m.test_code}>
                    {m.test_code} - {m.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={loadTrend}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
          >
            {loading ? "Consultando..." : "Consultar tendencia"}
          </button>
        </div>
        {error && <div className="md:col-span-3 text-sm text-red-600">{error}</div>}
      </div>

      {data && (
        <div className="space-y-4">
          {!data.series || data.series.points.length === 0 ? (
            <p className="text-sm text-gray-500 border rounded-lg p-4">
              No hay registros finalizados de {data.test_code} para el equipo seleccionado. Se
              requieren controles FINALIZADOS (no borradores) para trazar la tendencia.
            </p>
          ) : (
            <>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-sm">
                    {data.label} {data.unit ? "(" + data.unit + ")" : ""}
                  </h2>
                  <div className="text-xs text-gray-500">
                    n = {data.series.n} | Media = {data.series.mean_value.toFixed(3)} | DE ={" "}
                    {data.series.stddev_value.toFixed(3)}
                  </div>
                </div>
                {data.series.points.length < 2 && (
                  <p className="text-xs text-amber-600">
                    Se necesita al menos 2 controles finalizados para calcular limites de control
                    (2DE/3DE); se muestra unicamente el valor disponible.
                  </p>
                )}
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} width={50} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {data.series.mean_value !== null && (
                        <ReferenceLine
                          y={data.series.mean_value}
                          stroke="#2563eb"
                          strokeDasharray="4 2"
                          label={{ value: "Media", fontSize: 9, position: "insideTopLeft" }}
                        />
                      )}
                      {data.series.upper_warning_2de !== null && (
                        <ReferenceLine
                          y={data.series.upper_warning_2de}
                          stroke="#d97706"
                          strokeDasharray="3 3"
                          label={{ value: "+2DE", fontSize: 9, position: "insideTopLeft" }}
                        />
                      )}
                      {data.series.lower_warning_2de !== null && (
                        <ReferenceLine
                          y={data.series.lower_warning_2de}
                          stroke="#d97706"
                          strokeDasharray="3 3"
                          label={{ value: "-2DE", fontSize: 9, position: "insideBottomLeft" }}
                        />
                      )}
                      {data.series.upper_action_3de !== null && (
                        <ReferenceLine
                          y={data.series.upper_action_3de}
                          stroke="#dc2626"
                          strokeDasharray="2 2"
                          label={{ value: "+3DE", fontSize: 9, position: "insideTopLeft" }}
                        />
                      )}
                      {data.series.lower_action_3de !== null && (
                        <ReferenceLine
                          y={data.series.lower_action_3de}
                          stroke="#dc2626"
                          strokeDasharray="2 2"
                          label={{ value: "-3DE", fontSize: 9, position: "insideBottomLeft" }}
                        />
                      )}
                      <Line type="monotone" dataKey="Valor" stroke="#1e293b" strokeWidth={1.5} dot={renderDot} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h2 className="font-semibold text-sm mb-2">Detalle de puntos</h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1 pr-2">Fecha</th>
                      <th className="py-1 pr-2">Valor</th>
                      <th className="py-1 pr-2">Estado</th>
                      <th className="py-1 pr-2">Regla Westgard 2/2DE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.points.map((p) => (
                      <tr key={p.record_id} className="border-b last:border-0">
                        <td className="py-1 pr-2">{new Date(p.performed_at).toLocaleString()}</td>
                        <td className="py-1 pr-2">
                          {p.value.toFixed(3)} {data.unit}
                        </td>
                        <td className="py-1 pr-2">
                          <span className={"px-1.5 py-0.5 rounded border font-medium " + STATUS_CLASSES[p.status]}>
                            {STATUS_LABELS[p.status]}
                          </span>
                        </td>
                        <td className="py-1 pr-2">
                          {p.westgard_2_2de ? (
                            <span className="px-1.5 py-0.5 rounded border bg-orange-100 text-orange-800 border-orange-300 font-medium">
                              2 puntos consecutivos {">"} 2DE, mismo lado
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Nota: las pruebas evaluadas unicamente por componente (CUMPLE / NO CUMPLE / REQUIERE
        REVISION), como PET-05, CT-05, CT-12 y PET-CLINICO, no tienen un indicador numerico unico y
        por eso no aparecen en el selector de pruebas de este grafico de control.
      </p>
    </div>
  );
}
