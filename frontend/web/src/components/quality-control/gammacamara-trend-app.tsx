"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * MODULO 2 - GAMMACAMARA - FASE D
 * Gráfico de control (Levey-Jennings) para Gammacámara.
 * Muestra la serie histórica de una prueba + instrumento + métrica seleccionada
 * con límites ±2DE (advertencia) y ±3DE (acción).
 */

interface TrendMetric {
  test_type: string;
  test_mode: string;
  label: string;
  column: string;
  unit: string;
}

type TrendPointStatus = "dentro_control" | "alerta_2de" | "fuera_control_3de";

interface TrendStatsPoint {
  record_id: number;
  performed_at: string;
  value: number;
  status: TrendPointStatus;
  westgard_2_2de: boolean;
}

interface TrendSeries {
  n: number;
  mean_value: number;
  stddev_value: number;
  upper_warning_2de: number | null;
  lower_warning_2de: number | null;
  upper_action_3de: number | null;
  lower_action_3de: number | null;
  points: TrendStatsPoint[];
}

interface TrendResponse {
  instrument_id: number;
  test_type: string;
  test_mode: string;
  label: string;
  unit: string;
  series: TrendSeries | null;
}

interface Instrument {
  id: number;
  code?: string;
  name: string;
}

interface Props {
  instruments: Instrument[];
}

const POINT_COLORS: Record<TrendPointStatus, string> = {
  dentro_control: "#22c55e",
  alerta_2de: "#f59e0b",
  fuera_control_3de: "#ef4444",
};

export function GammacamaraTrendApp({ instruments }: Props) {
  const [instrumentId, setInstrumentId] = useState<string>("");
  const [metrics, setMetrics] = useState<TrendMetric[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric | null>(null);
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar catálogo de métricas
  useEffect(() => {
    fetch("/api/quality-control/gammacamara/trend")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.metrics)) setMetrics(j.metrics);
      })
      .catch(() => {});
  }, []);

  const loadTrend = useCallback(async () => {
    if (!instrumentId || !selectedMetric) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        instrument_id: instrumentId,
        test_type: selectedMetric.test_type,
        test_mode: selectedMetric.test_mode,
        metric: selectedMetric.column,
      });
      const res = await fetch(`/api/quality-control/gammacamara/trend?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar tendencia");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [instrumentId, selectedMetric]);

  useEffect(() => {
    if (instrumentId && selectedMetric) loadTrend();
  }, [loadTrend]);

  const series = data?.series;
  const points = series?.points ?? [];

  // SVG chart dimensions
  const SVG_W = 800;
  const SVG_H = 280;
  const PAD = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartW = SVG_W - PAD.left - PAD.right;
  const chartH = SVG_H - PAD.top - PAD.bottom;

  function toX(i: number) {
    return PAD.left + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2);
  }

  function toY(value: number, minV: number, maxV: number) {
    const range = maxV - minV || 1;
    return PAD.top + chartH - ((value - minV) / range) * chartH;
  }

  let minV = 0;
  let maxV = 1;
  if (series) {
    const allValues = [
      ...points.map((p) => p.value),
      series.upper_action_3de ?? 0,
      series.lower_action_3de ?? 0,
    ].filter((v) => v !== null);
    minV = Math.min(...allValues) * 1.1;
    maxV = Math.max(...allValues) * 1.1;
    if (minV === maxV) { minV -= 1; maxV += 1; }
  }

  return (
    <div className="space-y-4">
      {/* Selección */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
          value={instrumentId}
          onChange={(e) => { setInstrumentId(e.target.value); setData(null); }}
        >
          <option value="">Seleccione instrumento…</option>
          {instruments.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.code ? `${i.code} — ` : ""}{i.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
          value={selectedMetric ? `${selectedMetric.test_type}|${selectedMetric.test_mode}|${selectedMetric.column}` : ""}
          onChange={(e) => {
            const [tt, tm, col] = e.target.value.split("|");
            const m = metrics.find((x) => x.test_type === tt && x.test_mode === tm && x.column === col) ?? null;
            setSelectedMetric(m);
            setData(null);
          }}
        >
          <option value="">Seleccione métrica…</option>
          {metrics.map((m) => (
            <option key={`${m.test_type}|${m.test_mode}|${m.column}`} value={`${m.test_type}|${m.test_mode}|${m.column}`}>
              {m.label}
            </option>
          ))}
        </select>

        {instrumentId && selectedMetric && (
          <button
            onClick={loadTrend}
            disabled={loading}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>
      )}

      {!instrumentId || !selectedMetric ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center text-xs text-muted-foreground">
          Seleccione un instrumento y una métrica para ver el gráfico de control.
        </div>
      ) : !loading && data && !series ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center text-xs text-muted-foreground">
          No hay registros finalizados suficientes para generar el gráfico de control.
        </div>
      ) : series ? (
        <>
          {/* Stats summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="N registros" value={String(series.n)} />
            <StatTile label="Media" value={`${series.mean_value.toFixed(3)} ${data?.unit ?? ""}`} />
            <StatTile label="DE" value={`${series.stddev_value.toFixed(3)} ${data?.unit ?? ""}`} />
            <StatTile
              label="Fuera de control"
              value={String(points.filter((p) => p.status === "fuera_control_3de").length)}
              valueColor={points.filter((p) => p.status === "fuera_control_3de").length > 0 ? "text-red-600" : "text-foreground"}
            />
          </div>

          {/* Chart */}
          <div className="rounded-md border border-border bg-surface p-4 overflow-x-auto">
            <p className="text-xs font-medium text-foreground mb-2">{data?.label}</p>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ minWidth: 400 }}>
              {/* Límites */}
              {series.upper_action_3de !== null && (
                <line
                  x1={PAD.left} y1={toY(series.upper_action_3de, minV, maxV)}
                  x2={SVG_W - PAD.right} y2={toY(series.upper_action_3de, minV, maxV)}
                  stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" opacity={0.7}
                />
              )}
              {series.lower_action_3de !== null && (
                <line
                  x1={PAD.left} y1={toY(series.lower_action_3de, minV, maxV)}
                  x2={SVG_W - PAD.right} y2={toY(series.lower_action_3de, minV, maxV)}
                  stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" opacity={0.7}
                />
              )}
              {series.upper_warning_2de !== null && (
                <line
                  x1={PAD.left} y1={toY(series.upper_warning_2de, minV, maxV)}
                  x2={SVG_W - PAD.right} y2={toY(series.upper_warning_2de, minV, maxV)}
                  stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" opacity={0.7}
                />
              )}
              {series.lower_warning_2de !== null && (
                <line
                  x1={PAD.left} y1={toY(series.lower_warning_2de, minV, maxV)}
                  x2={SVG_W - PAD.right} y2={toY(series.lower_warning_2de, minV, maxV)}
                  stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" opacity={0.7}
                />
              )}
              {/* Media */}
              <line
                x1={PAD.left} y1={toY(series.mean_value, minV, maxV)}
                x2={SVG_W - PAD.right} y2={toY(series.mean_value, minV, maxV)}
                stroke="#6366f1" strokeWidth={1.5} opacity={0.9}
              />

              {/* Línea de puntos */}
              {points.length > 1 && (
                <polyline
                  points={points.map((p, i) => `${toX(i)},${toY(p.value, minV, maxV)}`).join(" ")}
                  fill="none" stroke="#94a3b8" strokeWidth={1} opacity={0.5}
                />
              )}

              {/* Puntos */}
              {points.map((p, i) => (
                <g key={p.record_id}>
                  <circle
                    cx={toX(i)}
                    cy={toY(p.value, minV, maxV)}
                    r={5}
                    fill={POINT_COLORS[p.status]}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  {p.westgard_2_2de && (
                    <circle
                      cx={toX(i)}
                      cy={toY(p.value, minV, maxV)}
                      r={8}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                    />
                  )}
                  <title>{`${p.performed_at}: ${p.value.toFixed(3)} ${data?.unit ?? ""}`}</title>
                </g>
              ))}

              {/* Eje Y labels */}
              {[series.mean_value, series.upper_warning_2de, series.lower_warning_2de].map(
                (v, i) =>
                  v !== null && (
                    <text
                      key={i}
                      x={PAD.left - 4}
                      y={toY(v, minV, maxV) + 4}
                      textAnchor="end"
                      fontSize={9}
                      fill="#64748b"
                    >
                      {v.toFixed(2)}
                    </text>
                  )
              )}

              {/* Eje X labels (fechas) — cada N puntos */}
              {points
                .filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0 || i === points.length - 1)
                .map((p, _, arr) => {
                  const i = points.indexOf(p);
                  return (
                    <text
                      key={p.record_id}
                      x={toX(i)}
                      y={SVG_H - PAD.bottom + 16}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#64748b"
                    >
                      {p.performed_at.slice(0, 10)}
                    </text>
                  );
                })}
            </svg>

            {/* Leyenda */}
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <LegendItem color="#6366f1" line label="Media" />
              <LegendItem color="#f59e0b" dashed label="±2DE (advertencia)" />
              <LegendItem color="#ef4444" dashed label="±3DE (acción)" />
              <LegendItem color="#22c55e" dot label="Dentro de control" />
              <LegendItem color="#f59e0b" dot label="Alerta 2DE" />
              <LegendItem color="#ef4444" dot label="Fuera de control 3DE" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, valueColor = "text-foreground" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

function LegendItem({ color, label, line, dashed, dot }: { color: string; label: string; line?: boolean; dashed?: boolean; dot?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot ? (
        <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: color }} />
      ) : (
        <svg width={20} height={10}>
          <line
            x1={0} y1={5} x2={20} y2={5}
            stroke={color}
            strokeWidth={2}
            strokeDasharray={dashed ? "4,3" : undefined}
          />
        </svg>
      )}
      <span>{label}</span>
    </div>
  );
}
