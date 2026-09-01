"use client";

import { useState } from "react";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Tablero de control (dashboard) del modulo de Control de Calidad de
 * Activimetros. Consolida en una sola vista de solo lectura los
 * indicadores que ya calculan las pantallas existentes, sin inventar
 * formulas ni tolerancias nuevas (seccion 45 del prompt maestro):
 * - Cumplimiento de pruebas (qc_activimetro_tests, tabla compartida que ya
 *   recibe un registro resumen de las pruebas ACTIV-05/06/07 ademas de las
 *   5 pruebas basicas del modulo 1, ver comentarios en
 *   qc-activimetro-purity-db.ts / qc-activimetro-constancy-db.ts).
 * - Avisos de vencimiento/retraso (misma logica que
 *   /api/quality-control/activimetro/due-status).
 * - Inspecciones fisico-funcionales (ACTIV-01, tabla separada).
 * - Eventos de servicio tecnico abiertos (seccion 30).
 * - Evidencia documental total (seccion 31).
 * - Ultimos movimientos de la bitacora de auditoria (seccion 40).
 */

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

type EquipmentRow = { id: number; internal_code: string | null; manufacturer: string | null; model: string | null; baseline_count: number };

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

const TEST_TYPE_LABELS: Record<string, string> = {
  precision: "Precision (repetibilidad)",
  exactitud: "Exactitud",
  linealidad: "Linealidad",
  respuesta_fondo: "Respuesta de fondo",
  geometria_volumen: "Geometria / Volumen",
  constancia: "Constancia (ACTIV-06)",
  pureza_radionucleidica: "Pureza radionucleidica (ACTIV-07)",
};

function testTypeLabel(t: string) {
  return TEST_TYPE_LABELS[t] ?? t;
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-green-300 bg-green-50"
      : tone === "warn"
      ? "border-yellow-300 bg-yellow-50"
      : tone === "bad"
      ? "border-red-300 bg-red-50"
      : "border-slate-300 bg-white";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const ALERT_STYLES: Record<string, string> = {
  overdue: "bg-red-100 text-red-800 border-red-300",
  upcoming: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sin_registro: "bg-slate-100 text-slate-700 border-slate-300",
};

const ALERT_LABELS: Record<string, string> = {
  overdue: "RETRASADA",
  upcoming: "PROXIMA A VENCER",
  sin_registro: "SIN REGISTRO",
};

export default function ActivimetroDashboardApp({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quality-control/activimetro/dashboard");
      const json = await res.json();
      if (!json.ok) throw new Error("respuesta invalida");
      setData(json);
    } catch {
      setError("Ocurrio un error al actualizar el tablero.");
    } finally {
      setLoading(false);
    }
  }

  const { kpis } = data;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tablero de Control - Activimetro</h1>
          <p className="text-sm text-gray-500">
            Resumen consolidado del modulo de Control de Calidad de Activimetros: cobertura de
            equipos, cumplimiento de pruebas, avisos de vencimiento, inspecciones, servicio tecnico,
            evidencia y auditoria. Datos calculados a partir de los registros existentes, sin
            formulas ni tolerancias nuevas.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm h-fit"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">Ultima actualizacion: {data.checkedAt}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Equipos activos" value={kpis.equipmentActive} />
        <KpiCard label="Pruebas registradas" value={kpis.testsTotal} />
        <KpiCard
          label="Cumplimiento de pruebas"
          value={kpis.testsCompliancePercent !== null ? `${kpis.testsCompliancePercent}%` : "N/D"}
          sub={`${kpis.testsCumple} cumple / ${kpis.testsAdvertencia} advertencia / ${kpis.testsNoCumple} no cumple`}
          tone={
            kpis.testsCompliancePercent === null
              ? "neutral"
              : kpis.testsCompliancePercent >= 90
              ? "ok"
              : kpis.testsCompliancePercent >= 75
              ? "warn"
              : "bad"
          }
        />
        <KpiCard label="Pendientes de revision" value={kpis.testsPendiente} tone={kpis.testsPendiente > 0 ? "warn" : "ok"} />
        <KpiCard label="Pruebas retrasadas" value={kpis.overdueCount} tone={kpis.overdueCount > 0 ? "bad" : "ok"} />
        <KpiCard label="Proximas a vencer" value={kpis.upcomingCount} tone={kpis.upcomingCount > 0 ? "warn" : "ok"} />
        <KpiCard label="Sin registro previo" value={kpis.sinRegistroCount} tone={kpis.sinRegistroCount > 0 ? "warn" : "ok"} />
        <KpiCard label="Eventos de servicio abiertos" value={kpis.serviceEventsOpen} tone={kpis.serviceEventsOpen > 0 ? "warn" : "ok"} />
        <KpiCard label="Inspecciones NO CUMPLE" value={kpis.inspectionsNoCumple} tone={kpis.inspectionsNoCumple > 0 ? "bad" : "ok"} />
        <KpiCard label="Inspecciones a revisar" value={kpis.inspectionsRequiereRevision} tone={kpis.inspectionsRequiereRevision > 0 ? "warn" : "ok"} />
        <KpiCard label="Evidencia documental" value={kpis.evidenceTotal} />
        <KpiCard label="Cambios de auditoria (30 dias)" value={kpis.auditRecent30d} />
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Cumplimiento por tipo de prueba</h2>
        {data.testsByType.length === 0 && <p className="text-xs text-gray-500">Aun no hay pruebas registradas.</p>}
        {data.testsByType.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1 pr-2">Prueba</th>
                  <th className="py-1 pr-2">Total</th>
                  <th className="py-1 pr-2">Cumple</th>
                  <th className="py-1 pr-2">Advertencia</th>
                  <th className="py-1 pr-2">No cumple</th>
                  <th className="py-1 pr-2">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {data.testsByType.map((row) => (
                  <tr key={row.test_type} className="border-b last:border-0">
                    <td className="py-1 pr-2 font-medium">{testTypeLabel(row.test_type)}</td>
                    <td className="py-1 pr-2">{row.total}</td>
                    <td className="py-1 pr-2 text-green-700">{row.cumple}</td>
                    <td className="py-1 pr-2 text-yellow-700">{row.advertencia}</td>
                    <td className="py-1 pr-2 text-red-700">{row.no_cumple}</td>
                    <td className="py-1 pr-2 text-slate-500">{row.pendiente_revision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">Inspecciones fisico-funcionales (ACTIV-01)</h2>
          {data.inspectionsByResult.length === 0 && <p className="text-xs text-gray-500">Sin inspecciones registradas.</p>}
          <ul className="space-y-1 text-xs">
            {data.inspectionsByResult.map((row) => (
              <li key={row.overall_result} className="flex justify-between border-b last:border-0 py-1">
                <span>{row.overall_result}</span>
                <span className="font-semibold">{row.total}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">Eventos de servicio tecnico</h2>
          {data.serviceEventsByStatus.length === 0 && <p className="text-xs text-gray-500">Sin eventos registrados.</p>}
          <ul className="space-y-1 text-xs">
            {data.serviceEventsByStatus.map((row) => (
              <li key={row.status} className="flex justify-between border-b last:border-0 py-1">
                <span>{row.status}</span>
                <span className="font-semibold">{row.total}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Avisos de vencimiento y retraso</h2>
        {data.dueAlerts.length === 0 && (
          <p className="text-xs text-gray-500">No hay avisos pendientes: todas las pruebas estan al dia.</p>
        )}
        <div className="space-y-2">
          {data.dueAlerts.map((a, idx) => (
            <div key={`${a.instrumentId}-${a.testType}-${idx}`} className="border rounded p-2 text-xs flex flex-wrap items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded border font-semibold ${ALERT_STYLES[a.status]}`}>{ALERT_LABELS[a.status]}</span>
              <span className="font-medium">
                {a.instrumentName ?? "Equipo"} ({a.instrumentCode ?? "s/codigo"})
              </span>
              <span className="text-gray-500">{testTypeLabel(a.testType)}</span>
              {a.lastTestDate && <span className="text-gray-500">Ultima: {a.lastTestDate}</span>}
              {a.nextDueDate && <span className="text-gray-500">Vence: {a.nextDueDate}</span>}
              {a.daysUntilDue !== null && (
                <span className="text-gray-500">
                  {a.daysUntilDue < 0 ? `${Math.abs(a.daysUntilDue)} dias de retraso` : `${a.daysUntilDue} dias restantes`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Equipos y estado de baseline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-1 pr-2">Equipo</th>
                <th className="py-1 pr-2">Codigo interno</th>
                <th className="py-1 pr-2">Baseline vigente</th>
              </tr>
            </thead>
            <tbody>
              {data.equipment.map((eq) => (
                <tr key={eq.id} className="border-b last:border-0">
                  <td className="py-1 pr-2 font-medium">
                    {eq.manufacturer ?? ""} {eq.model ?? ""}
                  </td>
                  <td className="py-1 pr-2">{eq.internal_code ?? "s/codigo"}</td>
                  <td className="py-1 pr-2">
                    {eq.baseline_count > 0 ? (
                      <span className="px-1.5 py-0.5 rounded border bg-green-100 text-green-800 border-green-300">Establecido</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-300">No establecido</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.equipment.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-gray-500">
                    No hay equipos activos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Ultimos movimientos de auditoria</h2>
        {data.recentAudit.length === 0 && <p className="text-xs text-gray-500">Sin movimientos recientes.</p>}
        <div className="space-y-2">
          {data.recentAudit.map((r) => (
            <div key={r.id} className="border rounded p-2 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                  {r.entity_type} #{r.entity_id}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{r.action}</span>
                <span className="text-gray-500">{new Date(r.changed_at).toLocaleString()}</span>
              </div>
              {r.changed_by && <div className="text-gray-600">Modificado por: {r.changed_by}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
