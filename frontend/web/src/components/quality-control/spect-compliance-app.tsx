"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * MODULO 3 - SPECT - FASE D
 * Panel de cumplimiento de frecuencias de QC para SPECT.
 */

type ComplianceStatus = "overdue" | "upcoming" | "ok" | "sin_registro";

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
  status: ComplianceStatus;
}

interface CatalogEntry {
  test_type: string;
  test_label: string;
  frequency_label: string;
  frequency_days: number;
}

interface ComplianceResponse {
  rows: ComplianceRow[];
  summary: { overdue: number; upcoming: number; sin_registro: number; ok: number };
  catalog: CatalogEntry[];
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

const STATUS_COLORS: Record<ComplianceStatus, { badge: string; dot: string }> = {
  overdue: { badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  upcoming: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  ok: { badge: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  sin_registro: { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  overdue: "Vencida",
  upcoming: "Próxima",
  ok: "Vigente",
  sin_registro: "Sin registro",
};

export function SpectComplianceApp({ instruments }: Props) {
  const [tab, setTab] = useState<"vencimientos" | "catalogo">("vencimientos");
  const [instrumentId, setInstrumentId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompliance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (instrumentId) params.set("instrument_id", instrumentId);
      const res = await fetch(`/api/quality-control/spect/compliance?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar cumplimiento");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [instrumentId]);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  const filteredRows = (data?.rows ?? []).filter(
    (r) => filterStatus === "all" || r.status === filterStatus
  );
  const summary = data?.summary ?? { overdue: 0, upcoming: 0, sin_registro: 0, ok: 0 };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {(["vencimientos", "catalogo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "vencimientos" ? "Vencimientos" : "Catálogo de pruebas"}
          </button>
        ))}
      </div>

      {tab === "vencimientos" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
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
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="overdue">Vencidas</option>
              <option value="upcoming">Próximas</option>
              <option value="sin_registro">Sin registro</option>
              <option value="ok">Vigentes</option>
            </select>

            <button
              onClick={loadCompliance}
              disabled={loading}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </button>

            {data?.checkedAt && (
              <span className="text-xs text-muted-foreground">Al {data.checkedAt}</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile label="Vencidas" count={summary.overdue} color="text-red-700" bg="bg-red-50" />
            <SummaryTile label="Próximas" count={summary.upcoming} color="text-yellow-700" bg="bg-yellow-50" />
            <SummaryTile label="Sin registro" count={summary.sin_registro} color="text-slate-600" bg="bg-slate-50" />
            <SummaryTile label="Vigentes" count={summary.ok} color="text-green-700" bg="bg-green-50" />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>
          )}

          {!loading && !error && filteredRows.length === 0 && (
            <div className="rounded-md border border-border bg-surface p-6 text-center text-xs text-muted-foreground">
              No hay pruebas con el filtro seleccionado.
            </div>
          )}

          {filteredRows.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Instrumento</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Prueba</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Frecuencia</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Último</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vence</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 text-foreground">{row.instrument_name}</td>
                      <td className="px-3 py-2 text-foreground">{row.test_label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.frequency_label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.last_test_date ?? "–"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.next_due_date ?? "–"}
                        {row.days_until_due !== null && row.status === "overdue" && (
                          <span className="ml-1 text-red-600">({Math.abs(row.days_until_due)}d)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "catalogo" && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Prueba</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Frecuencia</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {(data?.catalog ?? []).map((entry, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 text-foreground">{entry.test_label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.frequency_label}</td>
                  <td className="px-3 py-2 text-muted-foreground">IAEA TECDOC-602</td>
                </tr>
              ))}
              {!data?.catalog?.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                    No hay pruebas configuradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className={`rounded-md border border-border ${bg} p-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{count}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
