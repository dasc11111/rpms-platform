"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * MODULO 1 - ACTIVIMETRO - FASE D
 * Panel de alertas de control de calidad del Activímetro.
 */

interface Instrument {
  id: number;
  code?: string | null;
  name: string;
}

interface ActivimetroAlert {
  id: string;
  instrument_id: number | null;
  instrument_name: string;
  test_type: string;
  severity: "alta" | "media" | "baja";
  alert_type: string;
  message: string;
  recommended_action: string;
  last_test_date: string | null;
  days_overdue: number | null;
}

interface AlertsSummary {
  alta: number;
  media: number;
  baja: number;
}

interface AlertsResponse {
  alerts: ActivimetroAlert[];
  summary: AlertsSummary;
  checkedAt: string;
}

const SEVERITY_COLORS = {
  alta: "border-red-400 bg-red-50 dark:bg-red-950/20",
  media: "border-amber-400 bg-amber-50 dark:bg-amber-950/20",
  baja: "border-blue-400 bg-blue-50 dark:bg-blue-950/20",
};

const SEVERITY_BADGE = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  baja: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

const SEVERITY_LABELS = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const TEST_TYPE_LABELS: Record<string, string> = {
  precision: "Precisión (CV%)",
  exactitud: "Exactitud",
  linealidad: "Linealidad",
  respuesta_fondo: "Resp. Fondo",
  geometria_volumen: "Geometría/Vol.",
};

function SummaryTile({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function ActivimetroAlertsApp({ instruments }: { instruments: Instrument[] }) {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async (instrumentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (instrumentId !== "all") params.set("instrument_id", instrumentId);
      const res = await fetch(`/api/quality-control/activimetro/alerts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts(selectedInstrument);
  }, [fetchAlerts, selectedInstrument]);

  const filteredAlerts = (data?.alerts ?? []).filter(
    (a) => severityFilter === "all" || a.severity === severityFilter
  );

  function toggleExpand(id: string) {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Instrumento</label>
          <select
            className="rounded border border-border bg-surface px-2 py-1 text-xs"
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
          >
            <option value="all">Todos</option>
            {instruments.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Severidad</label>
          <select
            className="rounded border border-border bg-surface px-2 py-1 text-xs"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <button
          className="ml-auto rounded border border-border bg-surface px-2.5 py-1 text-xs hover:bg-muted/40"
          onClick={() => fetchAlerts(selectedInstrument)}
        >
          Actualizar
        </button>
        {data?.checkedAt && (
          <span className="text-xs text-muted-foreground">
            Verificado: {new Date(data.checkedAt).toLocaleDateString("es-CL")}
          </span>
        )}
      </div>

      {/* Summary tiles */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile
            count={data.summary.alta}
            label="Alertas alta"
            color="border-red-200 dark:border-red-800"
          />
          <SummaryTile
            count={data.summary.media}
            label="Alertas media"
            color="border-amber-200 dark:border-amber-800"
          />
          <SummaryTile
            count={data.summary.baja}
            label="Alertas baja"
            color="border-blue-200 dark:border-blue-800"
          />
          <SummaryTile
            count={data.summary.alta + data.summary.media + data.summary.baja}
            label="Total alertas"
            color="border-border"
          />
        </div>
      )}

      {/* Estado */}
      {loading && (
        <p className="text-xs text-muted-foreground text-center py-6">Calculando alertas…</p>
      )}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {/* Sin alertas */}
      {!loading && !error && data && filteredAlerts.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          ✅ No hay alertas activas para los filtros seleccionados
        </div>
      )}

      {/* Lista de alertas */}
      {!loading && !error && filteredAlerts.length > 0 && (
        <div className="space-y-2">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border-l-4 border border-border p-3 ${SEVERITY_COLORS[alert.severity]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[alert.severity]}`}
                    >
                      {SEVERITY_LABELS[alert.severity]}
                    </span>
                    <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {TEST_TYPE_LABELS[alert.test_type] ?? alert.test_type}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{alert.message}</p>
                  {alert.last_test_date && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Última prueba: {new Date(alert.last_test_date + "T12:00:00").toLocaleDateString("es-CL")}
                      {alert.days_overdue !== null && (
                        <span className="ml-1 text-red-600 dark:text-red-400 font-medium">
                          · vencida hace {alert.days_overdue}d
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground underline"
                  onClick={() => toggleExpand(alert.id)}
                >
                  {expandedAlerts.has(alert.id) ? "Ocultar" : "Acción"}
                </button>
              </div>
              {expandedAlerts.has(alert.id) && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Acción recomendada:</span>{" "}
                    {alert.recommended_action}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
