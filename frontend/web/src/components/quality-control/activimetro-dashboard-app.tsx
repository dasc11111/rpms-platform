"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

type Kpis = {
  equipmentActive: number;
  testsTotal: number;
  testsCumple: number;
  testsAdvertencia: number;
  testsNoCumple: number;
  testsPendiente: number;
  testsCompliancePercent: number | null;
  inspectionsTotal: number;
  inspectionsNoCumple: number;
  inspectionsRequiereRevision: number;
  serviceEventsOpen: number;
  evidenceTotal: number;
  auditRecent30d: number;
  overdueCount: number;
  upcomingCount: number;
  sinRegistroCount: number;
};

type TestsByType = {
  test_type: string;
  total: number;
  cumple: number;
  advertencia: number;
  no_cumple: number;
  pendiente_revision: number;
};

type CountRow = { status?: string; overall_result?: string; total: number };

type EquipmentRow = {
  id: number;
  internal_code: string | null;
  manufacturer: string | null;
  model: string | null;
  baseline_count: number;
};

type DueAlert = {
  instrumentId: number;
  instrumentCode: string | null;
  instrumentName: string | null;
  testType: string;
  frequencyDays: number;
  lastTestDate: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  status: "overdue" | "upcoming" | "sin_registro";
};

type AuditRecord = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

type DashboardData = {
  kpis: Kpis;
  testsByType: TestsByType[];
  inspectionsByResult: CountRow[];
  serviceEventsByStatus: CountRow[];
  equipment: EquipmentRow[];
  dueAlerts: DueAlert[];
  recentAudit: AuditRecord[];
  checkedAt: string;
};

const KPI_COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  blue:   { border: "border-blue-100",   text: "text-blue-600",   bg: "bg-blue-50" },
  green:  { border: "border-green-100",  text: "text-green-600",  bg: "bg-green-50" },
  teal:   { border: "border-teal-100",   text: "text-teal-600",   bg: "bg-teal-50" },
  orange: { border: "border-orange-100", text: "text-orange-600", bg: "bg-orange-50" },
  red:    { border: "border-red-100",    text: "text-red-600",    bg: "bg-red-50" },
  yellow: { border: "border-yellow-100", text: "text-yellow-600", bg: "bg-yellow-50" },
  purple: { border: "border-purple-100", text: "text-purple-600", bg: "bg-purple-50" },
  sky:    { border: "border-sky-100",    text: "text-sky-600",    bg: "bg-sky-50" },
  rose:   { border: "border-rose-100",   text: "text-rose-600",   bg: "bg-rose-50" },
  indigo: { border: "border-indigo-100", text: "text-indigo-600", bg: "bg-indigo-50" },
  gray:   { border: "border-border/50",   text: "text-muted-foreground",   bg: "bg-muted/50" },
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const TEST_TYPE_LABELS: Record<string, string> = {
  precision: "Precisión (repetibilidad)",
  exactitud: "Exactitud",
  linealidad: "Linealidad",
  respuesta_fondo: "Respuesta de fondo",
  geometria_volumen: "Geometría / Volumen",
  constancia: "Constancia (ACTIV-06)",
  pureza_radionucleidica: "Pureza radionuclídica (ACTIV-07)",
};

function testTypeLabel(t: string) {
  return TEST_TYPE_LABELS[t] ?? t;
}

const ALERT_STYLES: Record<string, string> = {
  overdue: "bg-red-100 text-red-800 border-red-300",
  upcoming: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sin_registro: "bg-muted text-foreground border-border",
};

const ALERT_LABELS: Record<string, string> = {
  overdue: "RETRASADA",
  upcoming: "PRÓXIMA A VENCER",
  sin_registro: "SIN REGISTRO",
};

const TABS = [
  { id: "resumen",      label: "Resumen" },
  { id: "pruebas",     label: "Pruebas QC" },
  { id: "operacion",   label: "Operación" },
  { id: "tendencias",  label: "Tendencias" },
];

export default function ActivimetroDashboardApp({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashTab, setDashTab] = useState("resumen");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quality-control/activimetro/dashboard");
      const json = await res.json();
      if (!json.ok) throw new Error("respuesta inválida");
      setData(json);
    } catch {
      setError("Ocurrió un error al actualizar el tablero.");
    } finally {
      setLoading(false);
    }
  }

  const { kpis } = data;
  const compliance = kpis.testsCompliancePercent;
  const compColor = compliance === null ? "gray" : compliance >= 90 ? "green" : compliance >= 75 ? "yellow" : "red";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tablero — Activímetro QC</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control de Calidad de Activímetros · Hospital Dr. Hernán Henríquez Aravena
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Act.: {data.checkedAt}</span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-accent text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Tab Nav */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDashTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              dashTab === t.id
                ? "border border-b-white border-border bg-white text-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: RESUMEN */}
      {dashTab === "resumen" && (() => {
        const kpiCards = [
          { label: "Equipos activos", value: kpis.equipmentActive, color: "blue", sub: "instrumentos registrados" },
          { label: "Pruebas registradas", value: kpis.testsTotal, color: "indigo", sub: "todas las categorías" },
          { label: "Cumplimiento", value: compliance !== null ? `${compliance}%` : "N/D", color: compColor, sub: `${kpis.testsCumple} cumple / ${kpis.testsNoCumple} no cumple` },
          { label: "Pendientes revisión", value: kpis.testsPendiente, color: kpis.testsPendiente > 0 ? "yellow" : "green", sub: "requieren acción" },
          { label: "Pruebas retrasadas", value: kpis.overdueCount, color: kpis.overdueCount > 0 ? "red" : "green", sub: "fuera de plazo" },
          { label: "Próximas a vencer", value: kpis.upcomingCount, color: kpis.upcomingCount > 0 ? "yellow" : "green", sub: "en próximos 30 días" },
          { label: "Sin registro previo", value: kpis.sinRegistroCount, color: kpis.sinRegistroCount > 0 ? "orange" : "green", sub: "sin línea base" },
          { label: "Servicio técnico abierto", value: kpis.serviceEventsOpen, color: kpis.serviceEventsOpen > 0 ? "orange" : "green", sub: "eventos activos" },
          { label: "Inspecciones NO CUMPLE", value: kpis.inspectionsNoCumple, color: kpis.inspectionsNoCumple > 0 ? "red" : "green", sub: "ACTIV-01" },
          { label: "Inspecciones a revisar", value: kpis.inspectionsRequiereRevision, color: kpis.inspectionsRequiereRevision > 0 ? "yellow" : "green", sub: "requieren revisión" },
          { label: "Evidencia documental", value: kpis.evidenceTotal, color: "teal", sub: "documentos adjuntos" },
          { label: "Auditoría 30 días", value: kpis.auditRecent30d, color: "gray", sub: "cambios recientes" },
        ];
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiCards.map((k) => {
                const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.gray;
                return (
                  <div key={k.label} className={`rounded-xl border p-4 ${c.border} ${c.bg}`}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${c.text}`}>{k.value}</p>
                    {k.sub && <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>}
                  </div>
                );
              })}
            </div>

            {/* Alertas resumen */}
            {data.dueAlerts.length > 0 && (
              <div className="border border-red-100 rounded-xl bg-red-50 p-4">
                <h3 className="text-sm font-semibold text-red-700 mb-2">⚠ Avisos de vencimiento ({data.dueAlerts.length})</h3>
                <div className="space-y-1.5">
                  {data.dueAlerts.slice(0, 5).map((a, idx) => (
                    <div key={`${a.instrumentId}-${a.testType}-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded border font-semibold ${ALERT_STYLES[a.status]}`}>
                        {ALERT_LABELS[a.status]}
                      </span>
                      <span className="font-medium text-foreground/80">
                        {a.instrumentName ?? "Equipo"} ({a.instrumentCode ?? "s/código"})
                      </span>
                      <span className="text-muted-foreground">{testTypeLabel(a.testType)}</span>
                      {a.daysUntilDue !== null && (
                        <span className={a.daysUntilDue < 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {a.daysUntilDue < 0 ? `${Math.abs(a.daysUntilDue)} días de retraso` : `${a.daysUntilDue} días restantes`}
                        </span>
                      )}
                    </div>
                  ))}
                  {data.dueAlerts.length > 5 && (
                    <p className="text-xs text-red-600 font-medium">+{data.dueAlerts.length - 5} avisos adicionales — ver pestaña Operación</p>
                  )}
                </div>
              </div>
            )}

            {/* Equipos y baseline */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Equipos y estado de baseline</h3>
              {data.equipment.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay equipos activos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-1.5 pr-3 font-semibold">Equipo</th>
                        <th className="py-1.5 pr-3 font-semibold">Código</th>
                        <th className="py-1.5 font-semibold">Baseline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.equipment.map((eq) => (
                        <tr key={eq.id} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-3 font-medium text-foreground/80">
                            {eq.manufacturer ?? ""} {eq.model ?? ""}
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{eq.internal_code ?? "s/código"}</td>
                          <td className="py-1.5">
                            {eq.baseline_count > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Establecido</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700">No establecido</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB: PRUEBAS QC */}
      {dashTab === "pruebas" && (() => {
        const complianceItems = [
          { label: "Cumple", value: kpis.testsCumple, color: "bg-green-500" },
          { label: "Advertencia", value: kpis.testsAdvertencia, color: "bg-yellow-400" },
          { label: "No cumple", value: kpis.testsNoCumple, color: "bg-red-500" },
          { label: "Pendiente", value: kpis.testsPendiente, color: "bg-muted" },
        ];
        const total = kpis.testsTotal || 1;
        return (
          <div className="space-y-5">
            {/* Distribución global */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Distribución global de resultados</h3>
              <div className="flex h-5 rounded-full overflow-hidden mb-3">
                {complianceItems.map((item) => (
                  <div
                    key={item.label}
                    className={`${item.color} transition-all`}
                    style={{ width: `${(item.value / total) * 100}%` }}
                    title={`${item.label}: ${item.value}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                {complianceItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                    <span className="text-muted-foreground">({((item.value / total) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Por tipo de prueba */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Cumplimiento por tipo de prueba</h3>
              {data.testsByType.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aún no hay pruebas registradas.</p>
              ) : (
                <div className="space-y-3">
                  {data.testsByType.map((row) => {
                    const rowTotal = row.total || 1;
                    const cumplePct = (row.cumple / rowTotal) * 100;
                    return (
                      <div key={row.test_type} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-foreground/80">{testTypeLabel(row.test_type)}</span>
                          <span className="text-muted-foreground">{row.total} pruebas</span>
                        </div>
                        <div className="flex h-3 rounded overflow-hidden bg-muted">
                          <div className="bg-green-500 h-full" style={{ width: `${(row.cumple / rowTotal) * 100}%` }} title={`Cumple: ${row.cumple}`} />
                          <div className="bg-yellow-400 h-full" style={{ width: `${(row.advertencia / rowTotal) * 100}%` }} title={`Advertencia: ${row.advertencia}`} />
                          <div className="bg-red-500 h-full" style={{ width: `${(row.no_cumple / rowTotal) * 100}%` }} title={`No cumple: ${row.no_cumple}`} />
                        </div>
                        <div className="flex gap-3 text-[11px] text-muted-foreground">
                          <span className="text-green-700">✓ {row.cumple}</span>
                          <span className="text-yellow-600">⚠ {row.advertencia}</span>
                          <span className="text-red-600">✗ {row.no_cumple}</span>
                          {row.pendiente_revision > 0 && <span className="text-muted-foreground">⏳ {row.pendiente_revision}</span>}
                          <span className="ml-auto font-medium text-foreground/80">{cumplePct.toFixed(0)}% cumple</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabla detallada */}
            {data.testsByType.length > 0 && (
              <div className="border border-border rounded-xl p-4 bg-white">
                <h3 className="text-sm font-semibold text-foreground/80 mb-3">Tabla detallada por tipo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-1.5 pr-3 font-semibold">Prueba</th>
                        <th className="py-1.5 pr-2 font-semibold text-right">Total</th>
                        <th className="py-1.5 pr-2 font-semibold text-right text-green-600">Cumple</th>
                        <th className="py-1.5 pr-2 font-semibold text-right text-yellow-600">Advertencia</th>
                        <th className="py-1.5 pr-2 font-semibold text-right text-red-600">No cumple</th>
                        <th className="py-1.5 font-semibold text-right text-muted-foreground">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.testsByType.map((row) => (
                        <tr key={row.test_type} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-3 font-medium text-foreground/80">{testTypeLabel(row.test_type)}</td>
                          <td className="py-1.5 pr-2 text-right text-muted-foreground">{row.total}</td>
                          <td className="py-1.5 pr-2 text-right text-green-700 font-semibold">{row.cumple}</td>
                          <td className="py-1.5 pr-2 text-right text-yellow-700 font-semibold">{row.advertencia}</td>
                          <td className="py-1.5 pr-2 text-right text-red-700 font-semibold">{row.no_cumple}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{row.pendiente_revision}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: OPERACIÓN */}
      {dashTab === "operacion" && (() => {
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Eventos servicio abiertos", value: kpis.serviceEventsOpen, color: kpis.serviceEventsOpen > 0 ? "orange" : "green", sub: "técnico activos" },
                { label: "Inspecciones NO CUMPLE", value: kpis.inspectionsNoCumple, color: kpis.inspectionsNoCumple > 0 ? "red" : "green", sub: "ACTIV-01" },
                { label: "A revisar", value: kpis.inspectionsRequiereRevision, color: kpis.inspectionsRequiereRevision > 0 ? "yellow" : "green", sub: "requieren revisión" },
                { label: "Evidencia", value: kpis.evidenceTotal, color: "teal", sub: "documentos adjuntos" },
              ].map((k) => {
                const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.gray;
                return (
                  <div key={k.label} className={`rounded-xl border p-4 ${c.border} ${c.bg}`}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${c.text}`}>{k.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Inspecciones y servicio técnico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border rounded-xl p-4 bg-white">
                <h3 className="text-sm font-semibold text-foreground/80 mb-3">Inspecciones físico-funcionales (ACTIV-01)</h3>
                {data.inspectionsByResult.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin inspecciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {data.inspectionsByResult.map((row) => {
                      const inspTotal = data.inspectionsByResult.reduce((s, r) => s + r.total, 0) || 1;
                      const pct = (row.total / inspTotal) * 100;
                      const isOk = row.overall_result?.toLowerCase().includes("cumple") && !row.overall_result?.toLowerCase().includes("no");
                      return (
                        <div key={row.overall_result}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium text-muted-foreground">{row.overall_result}</span>
                            <span className="text-muted-foreground">{row.total} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 rounded bg-muted">
                            <div
                              className={`h-full rounded ${isOk ? "bg-green-500" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border border-border rounded-xl p-4 bg-white">
                <h3 className="text-sm font-semibold text-foreground/80 mb-3">Eventos de servicio técnico</h3>
                {data.serviceEventsByStatus.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {data.serviceEventsByStatus.map((row) => {
                      const svcTotal = data.serviceEventsByStatus.reduce((s, r) => s + r.total, 0) || 1;
                      const pct = (row.total / svcTotal) * 100;
                      const isOpen = row.status?.toLowerCase().includes("abiert") || row.status?.toLowerCase().includes("open");
                      return (
                        <div key={row.status}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium text-muted-foreground">{row.status}</span>
                            <span className="text-muted-foreground">{row.total} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 rounded bg-muted">
                            <div
                              className={`h-full rounded ${isOpen ? "bg-orange-400" : "bg-blue-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Todos los avisos */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">
                Todos los avisos de vencimiento y retraso
                {data.dueAlerts.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                    {data.dueAlerts.length}
                  </span>
                )}
              </h3>
              {data.dueAlerts.length === 0 ? (
                <p className="text-xs text-green-600 font-medium">✓ Todas las pruebas están al día.</p>
              ) : (
                <div className="space-y-2">
                  {data.dueAlerts.map((a, idx) => (
                    <div key={`${a.instrumentId}-${a.testType}-${idx}`} className="border border-border rounded-lg p-2.5 text-xs flex flex-wrap items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border font-semibold ${ALERT_STYLES[a.status]}`}>
                        {ALERT_LABELS[a.status]}
                      </span>
                      <span className="font-medium text-foreground/80">
                        {a.instrumentName ?? "Equipo"} ({a.instrumentCode ?? "s/código"})
                      </span>
                      <span className="text-muted-foreground">{testTypeLabel(a.testType)}</span>
                      {a.lastTestDate && <span className="text-muted-foreground">Última: {a.lastTestDate}</span>}
                      {a.nextDueDate && <span className="text-muted-foreground">Vence: {a.nextDueDate}</span>}
                      {a.daysUntilDue !== null && (
                        <span className={a.daysUntilDue < 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                          {a.daysUntilDue < 0 ? `${Math.abs(a.daysUntilDue)} días de retraso` : `${a.daysUntilDue} días restantes`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auditoría reciente */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">
                Últimos movimientos de auditoría
                <span className="ml-2 text-xs text-muted-foreground font-normal">(30 días)</span>
              </h3>
              {data.recentAudit.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin movimientos recientes.</p>
              ) : (
                <div className="space-y-2">
                  {data.recentAudit.map((r) => (
                    <div key={r.id} className="border border-border rounded-lg p-2.5 text-xs flex flex-wrap items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold">
                        {r.entity_type} #{r.entity_id}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">{r.action}</span>
                      <span className="text-muted-foreground">{new Date(r.changed_at).toLocaleString("es-CL")}</span>
                      {r.changed_by && <span className="text-muted-foreground">por {r.changed_by}</span>}
                      {r.field_name && (
                        <span className="text-muted-foreground">
                          campo: <span className="font-medium">{r.field_name}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB: TENDENCIAS (Recharts) */}
      {dashTab === "tendencias" && (
        <div className="space-y-5">
          {/* Cumplimiento por prueba — BarChart */}
          <div className="border border-border rounded-xl p-4 bg-white">
            <h3 className="text-sm font-semibold text-foreground/80 mb-4">Cumplimiento por tipo de prueba</h3>
            {data.testsByType.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin datos disponibles.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.testsByType.map((r) => ({
                  name: TEST_TYPE_LABELS[r.test_type] ?? r.test_type,
                  Cumple: r.cumple,
                  Advertencia: r.advertencia,
                  "No cumple": r.no_cumple,
                  Pendiente: r.pendiente_revision,
                }))} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Cumple" fill="#10b981" />
                  <Bar dataKey="Advertencia" fill="#f59e0b" />
                  <Bar dataKey="No cumple" fill="#ef4444" />
                  <Bar dataKey="Pendiente" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inspecciones — PieChart */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Inspecciones por resultado (ACTIV-01)</h3>
              {data.inspectionsByResult.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.inspectionsByResult.map((r) => ({ name: r.overall_result ?? "Sin resultado", value: r.total }))}
                      cx="50%" cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.inspectionsByResult.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Servicio técnico — PieChart */}
            <div className="border border-border rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Eventos de servicio por estado</h3>
              {data.serviceEventsByStatus.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.serviceEventsByStatus.map((r) => ({ name: r.status ?? "Sin estado", value: r.total }))}
                      cx="50%" cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.serviceEventsByStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Alertas por estado — BarChart horizontal */}
          <div className="border border-border rounded-xl p-4 bg-white">
            <h3 className="text-sm font-semibold text-foreground/80 mb-4">Distribución de alertas de vencimiento</h3>
            {(() => {
              const alertCounts = [
                { name: "Retrasadas", value: kpis.overdueCount, fill: "#ef4444" },
                { name: "Próximas a vencer", value: kpis.upcomingCount, fill: "#f59e0b" },
                { name: "Sin registro", value: kpis.sinRegistroCount, fill: "#94a3b8" },
              ];
              const maxVal = Math.max(...alertCounts.map((a) => a.value), 1);
              return (
                <div className="space-y-3">
                  {alertCounts.map((a) => (
                    <div key={a.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-muted-foreground">{a.name}</span>
                        <span className="font-semibold text-foreground/80">{a.value}</span>
                      </div>
                      <div className="h-3 rounded bg-muted">
                        <div
                          className="h-full rounded transition-all"
                          style={{ width: `${(a.value / maxVal) * 100}%`, backgroundColor: a.fill }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
