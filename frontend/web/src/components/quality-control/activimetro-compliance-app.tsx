"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * MODULO 1 - ACTIVIMETRO - FASE D
 * Panel de cumplimiento de frecuencias de QC del Activímetro.
 * Dos tabs: Vencimientos (tabla de estado) y Catálogo (definición de pruebas).
 */

interface Instrument {
  id: number;
  code?: string | null;
  name: string;
}

interface ComplianceRow {
  instrument_id: number | null;
  instrument_name: string;
  test_type: string;
  test_label: string;
  frequency_days: number;
  frequency_label: string;
  last_test_date: string | null;
  next_due_date: string | null;
  days_until_due: number | null;
  status: "overdue" | "upcoming" | "ok" | "sin_registro";
}

interface CatalogItem {
  test_type: string;
  test_label: string;
  frequency_label: string;
  frequency_days: number;
}

interface ComplianceResponse {
  rows: ComplianceRow[];
  summary: { overdue: number; upcoming: number; sin_registro: number; ok: number };
  catalog: CatalogItem[];
  checkedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  overdue: "text-red-600 dark:text-red-400 font-semibold",
  upcoming: "text-amber-600 dark:text-amber-400 font-semibold",
  ok: "text-emerald-600 dark:text-emerald-400",
  sin_registro: "text-muted-foreground italic",
};

const STATUS_BADGE: Record<string, string> = {
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  upcoming: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  sin_registro: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  overdue: "Vencida",
  upcoming: "Próxima",
  ok: "Vigente",
  sin_registro: "Sin registro",
};

function SummaryTile({ count, label, colorClass }: { count: number; label: string; colorClass: string }) {
  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function ActivimetroComplianceApp({ instruments }: { instruments: Instrument[] }) {
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"vencimientos" | "catalogo">("vencimientos");

  const fetchCompliance = useCallback(async (instrumentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (instrumentId !== "all") params.set("instrument_id", instrumentId);
      const res = await fetch(`/api/quality-control/activimetro/compliance?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cumplimiento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompliance(selectedInstrument);
  }, [fetchCompliance, selectedInstrument]);

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
        <button
          className="ml-auto rounded border border-border bg-surface px-2.5 py-1 text-xs hover:bg-muted/40"
          onClick={() => fetchCompliance(selectedInstrument)}
        >
          Actualizar
        </button>
        {data?.checkedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(data.checkedAt + "T12:00:00").toLocaleDateString("es-CL")}
          </span>
        )}
      </div>

      {/* Summary tiles */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile
            count={data.summary.overdue}
            label="Pruebas vencidas"
            colorClass="border-red-200 dark:border-red-800"
          />
          <SummaryTile
            count={data.summary.upcoming}
            label="Próximas a vencer"
            colorClass="border-amber-200 dark:border-amber-800"
          />
          <SummaryTile
            count={data.summary.sin_registro}
            label="Sin registro"
            colorClass="border-border"
          />
          <SummaryTile
            count={data.summary.ok}
            label="Vigentes"
            colorClass="border-emerald-200 dark:border-emerald-800"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["vencimientos", "catalogo"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1.5 text-xs capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "vencimientos" ? "Vencimientos" : "Catálogo de pruebas"}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground text-center py-6">Cargando…</p>
      )}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {/* Tab: Vencimientos */}
      {!loading && !error && activeTab === "vencimientos" && data && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted-foreground">Instrumento</th>
                <th className="py-2 pr-3 font-medium text-muted-foreground">Prueba</th>
                <th className="py-2 pr-3 font-medium text-muted-foreground">Frecuencia</th>
                <th className="py-2 pr-3 font-medium text-muted-foreground">Último</th>
                <th className="py-2 pr-3 font-medium text-muted-foreground">Próxima</th>
                <th className="py-2 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin datos para mostrar
                  </td>
                </tr>
              ) : (
                data.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 pr-3 font-medium">{row.instrument_name}</td>
                    <td className="py-2 pr-3">{row.test_label}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.frequency_label}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      {row.last_test_date
                        ? new Date(row.last_test_date + "T12:00:00").toLocaleDateString("es-CL")
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.next_due_date ? (
                        <span className={STATUS_STYLES[row.status]}>
                          {new Date(row.next_due_date + "T12:00:00").toLocaleDateString("es-CL")}
                          {row.days_until_due !== null && row.days_until_due < 0 && (
                            <span className="ml-1 text-red-500">
                              ({Math.abs(row.days_until_due)}d vencida)
                            </span>
                          )}
                          {row.days_until_due !== null && row.days_until_due >= 0 && (
                            <span className="ml-1 text-muted-foreground">
                              (en {row.days_until_due}d)
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[row.status]}`}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Catálogo */}
      {!loading && !error && activeTab === "catalogo" && data && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted-foreground">Tipo de prueba</th>
                <th className="py-2 pr-3 font-medium text-muted-foreground">Frecuencia requerida</th>
                <th className="py-2 font-medium text-muted-foreground">Días</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog.map((item, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2 pr-3 font-medium">{item.test_label}</td>
                  <td className="py-2 pr-3">{item.frequency_label}</td>
                  <td className="py-2 text-muted-foreground tabular-nums">{item.frequency_days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Frecuencias según IAEA TECDOC-602 y documento QA Activímetro institucional.
            Configurable por el Físico Médico/OPR en la tabla de tolerancias.
          </p>
        </div>
      )}
    </div>
  );
}
