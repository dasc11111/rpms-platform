"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * MODULO 1 - ACTIVIMETRO - FASE D
 * Gráfico de control Levey-Jennings para el Activímetro.
 * Dibuja líneas ±2DE (advertencia) y ±3DE (acción), detecta regla Westgard 2·2DE.
 */

interface Instrument {
  id: number;
  code?: string | null;
  name: string;
}

interface TrendMetric {
  test_type: string;
  label: string;
  column: string;
  unit: string;
}

interface TrendPoint {
  record_id: number;
  performed_at: string;
  value: number;
  status: "dentro_control" | "alerta_2de" | "fuera_control_3de";
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
  points: TrendPoint[];
}

interface TrendResponse {
  instrument_id: number;
  test_type: string;
  label: string;
  unit: string;
  series: TrendSeries | null;
}

const PAD = { top: 20, right: 20, bottom: 50, left: 68 };
const W = 800;
const H = 280;
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function fmt(n: number, decimals = 2) {
  return Number.isFinite(n) ? n.toFixed(decimals) : "—";
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function LegendItem({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <svg width="20" height="10">
        <line
          x1="0"
          y1="5"
          x2="20"
          y2="5"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={dashed ? "4,2" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

export function ActivimetroTrendApp({ instruments }: { instruments: Instrument[] }) {
  const [metrics, setMetrics] = useState<TrendMetric[]>([]);
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>("");
  const [selectedTestType, setSelectedTestType] = useState<string>("");

  // Cargar catálogo de métricas al montar
  useEffect(() => {
    fetch("/api/quality-control/activimetro/trend")
      .then((r) => r.json())
      .then((json) => {
        setMetrics(json.metrics ?? []);
        if (json.metrics?.length) setSelectedTestType(json.metrics[0].test_type);
      })
      .catch(() => setError("Error al cargar catálogo de métricas"));
  }, []);

  // Seleccionar primer instrumento por defecto
  useEffect(() => {
    if (instruments.length && !selectedInstrument) {
      setSelectedInstrument(String(instruments[0]!.id));
    }
  }, [instruments, selectedInstrument]);

  const fetchSeries = useCallback(async () => {
    if (!selectedInstrument || !selectedTestType) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        instrument_id: selectedInstrument,
        test_type: selectedTestType,
      });
      const res = await fetch(`/api/quality-control/activimetro/trend?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar tendencia");
    } finally {
      setLoading(false);
    }
  }, [selectedInstrument, selectedTestType]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const series = data?.series ?? null;
  const unit = data?.unit ?? "";

  // Calcular rango Y para el gráfico
  function yRange(): [number, number] {
    if (!series) return [0, 1];
    const pts = series.points.map((p) => p.value);
    const limits = [
      series.upper_action_3de,
      series.lower_action_3de,
    ].filter((v): v is number => v !== null);
    const all = [...pts, ...limits];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.12 || 1;
    return [min - pad, max + pad];
  }

  function toY(value: number, yMin: number, yMax: number) {
    return PAD.top + INNER_H - ((value - yMin) / (yMax - yMin)) * INNER_H;
  }

  function toX(index: number, total: number) {
    if (total <= 1) return PAD.left + INNER_W / 2;
    return PAD.left + (index / (total - 1)) * INNER_W;
  }

  function pointColor(pt: TrendPoint) {
    if (pt.westgard_2_2de) return "#9333ea";
    switch (pt.status) {
      case "fuera_control_3de": return "#ef4444";
      case "alerta_2de": return "#f59e0b";
      default: return "#3b82f6";
    }
  }

  const [yMin, yMax] = series ? yRange() : [0, 1];

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));

  // X-axis ticks: show up to 8 dates
  const xLabels: { x: number; label: string }[] = [];
  if (series && series.points.length > 0) {
    const step = Math.max(1, Math.floor(series.points.length / 8));
    series.points.forEach((p, i) => {
      if (i % step === 0 || i === series.points.length - 1) {
        xLabels.push({
          x: toX(i, series.points.length),
          label: new Date(p.performed_at + "T12:00:00").toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "2-digit",
          }),
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Instrumento</label>
          <select
            className="rounded border border-border bg-surface px-2 py-1 text-xs"
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
          >
            {instruments.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Métrica</label>
          <select
            className="rounded border border-border bg-surface px-2 py-1 text-xs max-w-[260px]"
            value={selectedTestType}
            onChange={(e) => setSelectedTestType(e.target.value)}
          >
            {metrics.map((m) => (
              <option key={m.test_type} value={m.test_type}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {series && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="N registros" value={String(series.n)} />
          <StatTile label={`Media (${unit})`} value={fmt(series.mean_value)} />
          <StatTile label={`DE (${unit})`} value={fmt(series.stddev_value)} />
          <StatTile label="CV%" value={series.mean_value ? fmt((series.stddev_value / series.mean_value) * 100) : "—"} />
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground text-center py-10">Cargando datos…</p>
      )}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {!loading && !error && data && !series && (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          Sin datos suficientes para calcular tendencia.
          <br />
          Registre al menos dos pruebas de este tipo.
        </div>
      )}

      {/* Gráfico Levey-Jennings */}
      {!loading && !error && series && series.points.length > 0 && (
        <div className="rounded-lg border border-border bg-surface overflow-x-auto p-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ minWidth: "480px", maxHeight: "300px" }}
          >
            {/* Fondo */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={INNER_W}
              height={INNER_H}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="0.5"
              opacity="0.2"
            />

            {/* Grid Y */}
            {yTicks.map((tick, i) => {
              const y = toY(tick, yMin, yMax);
              return (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={PAD.left + INNER_W}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="0.5"
                    opacity="0.15"
                  />
                  <text
                    x={PAD.left - 5}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="currentColor"
                    opacity="0.6"
                  >
                    {fmt(tick)}
                  </text>
                </g>
              );
            })}

            {/* X labels */}
            {xLabels.map((xl, i) => (
              <text
                key={i}
                x={xl.x}
                y={PAD.top + INNER_H + 14}
                textAnchor="middle"
                fontSize="8"
                fill="currentColor"
                opacity="0.6"
              >
                {xl.label}
              </text>
            ))}

            {/* Y-axis label */}
            <text
              x={12}
              y={PAD.top + INNER_H / 2}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity="0.5"
              transform={`rotate(-90, 12, ${PAD.top + INNER_H / 2})`}
            >
              {unit}
            </text>

            {/* Líneas de control */}
            {/* ±3DE (acción) */}
            {series.upper_action_3de !== null && (
              <line
                x1={PAD.left}
                y1={toY(series.upper_action_3de, yMin, yMax)}
                x2={PAD.left + INNER_W}
                y2={toY(series.upper_action_3de, yMin, yMax)}
                stroke="#ef4444"
                strokeWidth="1"
                strokeDasharray="6,3"
                opacity="0.8"
              />
            )}
            {series.lower_action_3de !== null && (
              <line
                x1={PAD.left}
                y1={toY(series.lower_action_3de, yMin, yMax)}
                x2={PAD.left + INNER_W}
                y2={toY(series.lower_action_3de, yMin, yMax)}
                stroke="#ef4444"
                strokeWidth="1"
                strokeDasharray="6,3"
                opacity="0.8"
              />
            )}
            {/* ±2DE (advertencia) */}
            {series.upper_warning_2de !== null && (
              <line
                x1={PAD.left}
                y1={toY(series.upper_warning_2de, yMin, yMax)}
                x2={PAD.left + INNER_W}
                y2={toY(series.upper_warning_2de, yMin, yMax)}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4,2"
                opacity="0.8"
              />
            )}
            {series.lower_warning_2de !== null && (
              <line
                x1={PAD.left}
                y1={toY(series.lower_warning_2de, yMin, yMax)}
                x2={PAD.left + INNER_W}
                y2={toY(series.lower_warning_2de, yMin, yMax)}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4,2"
                opacity="0.8"
              />
            )}
            {/* Media */}
            <line
              x1={PAD.left}
              y1={toY(series.mean_value, yMin, yMax)}
              x2={PAD.left + INNER_W}
              y2={toY(series.mean_value, yMin, yMax)}
              stroke="#10b981"
              strokeWidth="1.2"
            />

            {/* Línea de puntos */}
            {series.points.length > 1 && (
              <polyline
                points={series.points
                  .map((p, i) => `${toX(i, series.points.length)},${toY(p.value, yMin, yMax)}`)
                  .join(" ")}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1"
                opacity="0.6"
              />
            )}

            {/* Puntos */}
            {series.points.map((pt, i) => {
              const cx = toX(i, series.points.length);
              const cy = toY(pt.value, yMin, yMax);
              const color = pointColor(pt);
              return (
                <g key={pt.record_id}>
                  <circle cx={cx} cy={cy} r="4" fill={color} opacity="0.9" />
                  {pt.westgard_2_2de && (
                    <circle cx={cx} cy={cy} r="7" fill="none" stroke={color} strokeWidth="1.5" />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 mt-2 px-2">
            <LegendItem color="#10b981" label="Media" />
            <LegendItem color="#f59e0b" label="±2DE advertencia" dashed />
            <LegendItem color="#ef4444" label="±3DE acción" dashed />
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <svg width="14" height="14">
                <circle cx="7" cy="7" r="4" fill="#3b82f6" />
              </svg>
              Dentro control
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <svg width="14" height="14">
                <circle cx="7" cy="7" r="4" fill="#f59e0b" />
              </svg>
              Advertencia (2DE)
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <svg width="14" height="14">
                <circle cx="7" cy="7" r="4" fill="#ef4444" />
              </svg>
              Fuera control (3DE)
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <svg width="14" height="14">
                <circle cx="7" cy="7" r="4" fill="none" stroke="#9333ea" strokeWidth="1.5" />
                <circle cx="7" cy="7" r="2" fill="#9333ea" />
              </svg>
              Westgard 2·2DE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
