"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * MODULO 2 - GAMMACAMARA - FASE D
 * Componente de alertas de QC para Gammacámara.
 */

type AlertSeverity = "alta" | "media" | "baja";
type AlertType =
  | "fuera_de_tolerancia"
  | "advertencia"
  | "prueba_vencida"
  | "prueba_sin_registro"
  | "tendencia_progresiva";

interface GammaAlert {
  id: string;
  instrument_id: number | null;
  instrument_name: string;
  test_type: string;
  test_mode: string;
  severity: AlertSeverity;
  alert_type: AlertType;
  message: string;
  recommended_action: string;
  last_test_date: string | null;
  days_overdue: number | null;
}

interface AlertsResponse {
  alerts: GammaAlert[];
  summary: { alta: number; media: number; baja: number };
  checkedAt: string;
}

interface Instrument {
  id: number;
  code?: string;
  name: string;
}

interface Props {
  instruments: Instrument[];
}

const SEVERITY_COLORS: Record<AlertSeverity, { badge: string; row: string }> = {
  alta: { badge: "bg-red-100 text-red-800 border-red-200", row: "border-l-4 border-l-red-400" },
  media: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", row: "border-l-4 border-l-yellow-400" },
  baja: { badge: "bg-blue-100 text-blue-800 border-blue-200", row: "border-l-4 border-l-blue-300" },
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  fuera_de_tolerancia: "Fuera de tolerancia",
  advertencia: "Advertencia",
  prueba_vencida: "Prueba vencida",
  prueba_sin_registro: "Sin registro",
  tendencia_progresiva: "Tendencia",
};

export function GammacamaraAlertsApp({ instruments }: Props) {
  const [instrumentId, setInstrumentId] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (instrumentId) params.set("instrument_id", instrumentId);
      const res = await fetch(`/api/quality-control/gammacamara/alerts?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar alertas");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [instrumentId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const filteredAlerts = (data?.alerts ?? []).filter(
    (a) => filterSeverity === "all" || a.severity === filterSeverity
  );

  const summary = data?.summary ?? { alta: 0, media: 0, baja: 0 };
  const total = summary.alta + summary.media + summary.baja;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
          value={instrumentId}
          onChange={(e) => setInstrumentId(e.target.value)}
        >
          <option value="">Todos los instrumentos</option>
          {instruments.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.code ? `${i.code} — ` : ""}{i.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
        >
          <option value="all">Todas las severidades</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        <button
          onClick={loadAlerts}
          disabled={loading}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>

        {data?.checkedAt && (
          <span className="text-xs text-muted-foreground">
            Verificado: {new Date(data.checkedAt).toLocaleString("es-CL")}
          </span>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="Total" count={total} color="text-foreground" bg="bg-surface" />
        <SummaryTile label="Alta" count={summary.alta} color="text-red-700" bg="bg-red-50" />
        <SummaryTile label="Media" count={summary.media} color="text-yellow-700" bg="bg-yellow-50" />
        <SummaryTile label="Baja" count={summary.baja} color="text-blue-700" bg="bg-blue-50" />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>
      )}

      {/* Lista de alertas */}
      {!loading && !error && filteredAlerts.length === 0 && (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-xs text-muted-foreground">
          {total === 0
            ? "No hay alertas activas para la selección actual."
            : "No hay alertas con el filtro seleccionado."}
        </div>
      )}

      {filteredAlerts.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          {filteredAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-md border border-border ${bg} p-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{count}</p>
    </div>
  );
}

function AlertRow({ alert }: { alert: GammaAlert }) {
  const [expanded, setExpanded] = useState(false);
  const colors = SEVERITY_COLORS[alert.severity];

  return (
    <div
      className={`p-3 border-b last:border-b-0 border-border bg-surface ${colors.row} cursor-pointer hover:bg-muted/20 transition-colors`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${colors.badge}`}
        >
          {alert.severity.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">{alert.message}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ALERT_TYPE_LABELS[alert.alert_type]}
            {alert.last_test_date && ` · Último: ${alert.last_test_date}`}
            {alert.days_overdue !== null && ` · Vencida hace ${alert.days_overdue}d`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-2 pl-16">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Acción recomendada:</span> {alert.recommended_action}
          </p>
        </div>
      )}
    </div>
  );
}
