"use client";

import * as React from "react";
import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

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
const PIE_COLORS_DASH = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4"];

export function CentroOperaciones({ dashboard, facilityName }: { dashboard: any; facilityName?: string }) {
  const [dashTab, setDashTab] = useState<"resumen" | "equipo" | "operacion" | "tendencias">("resumen");

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Cargando datos del dashboard…</p>
      </div>
    );
  }

  const kpis = dashboard.kpis || {};
  const alerts = dashboard.alerts || [];
  const recentAlerts = dashboard.recentAlerts || [];
  const monthlyOps = dashboard.monthlyOps || [];
  const treatmentTypes = dashboard.treatmentTypes || [];
  const qcStats = dashboard.qcStats || [];
  const maintenanceStats = dashboard.maintenanceStats || [];
  const authorizations = dashboard.authorizations || [];
  const topRisks = dashboard.topRisks || [];

  const kpiCards = [
    { label: "Disponibilidad", value: kpis.availability != null ? `${kpis.availability}%` : "—", color: "blue" },
    { label: "Cumpl. CQ",      value: kpis.qcCompliance  != null ? `${kpis.qcCompliance}%`  : "—", color: "green" },
    { label: "MTBF (h)",       value: kpis.mtbf           != null ? `${kpis.mtbf}`           : "—", color: "teal" },
    { label: "MTTR (h)",       value: kpis.mttr           != null ? `${kpis.mttr}`           : "—", color: "orange" },
    { label: "Pacientes",      value: kpis.totalPatients   != null ? `${kpis.totalPatients}`   : "—", color: "purple" },
    { label: "Horas Op.",      value: kpis.totalOperatingHours != null ? `${kpis.totalOperatingHours}h` : "—", color: "sky" },
    { label: "Docs",           value: kpis.documentsTotal  != null ? `${kpis.documentsTotal}`  : "—", color: "indigo" },
    { label: "Incidentes",     value: kpis.incidentsOpen   != null ? `${kpis.incidentsOpen}`   : "—", color: kpis.incidentsOpen > 0 ? "red" : "gray" },
  ];

  const alertSummary = [
    { label: "CQ",         count: kpis.qcAlertsOpen          || 0, color: "yellow" },
    { label: "Radiación",  count: kpis.radiationAlertsOpen   || 0, color: "orange" },
    { label: "Mantenim.",  count: kpis.maintenanceAlertsOpen || 0, color: "red"    },
  ];

  const TABS = [
    { id: "resumen",    label: "Resumen" },
    { id: "equipo",     label: "Equipo & CQ" },
    { id: "operacion",  label: "Operación" },
    { id: "tendencias", label: "Tendencias" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Centro de Operaciones</h2>
          {facilityName && <p className="text-sm text-muted-foreground">{facilityName}</p>}
        </div>
        <span className="text-xs text-muted-foreground">Actualizado: {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setDashTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              dashTab === t.id
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ─────────────────────────────────────────── */}
      {dashTab === "resumen" && (
        <div className="space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpiCards.map(k => {
              const c = KPI_COLOR_MAP[k.color] || KPI_COLOR_MAP.gray;
              return (
                <div key={k.label} className={`rounded-lg border p-3 ${c.border} ${c.bg}`}>
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${c.text}`}>{k.value}</p>
                </div>
              );
            })}
          </div>

          {/* Alert summary pills */}
          <div className="flex gap-3">
            {alertSummary.map(a => {
              const c = KPI_COLOR_MAP[a.color] || KPI_COLOR_MAP.gray;
              return (
                <div key={a.label} className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${c.bg} ${c.text}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${c.text.replace("text-", "bg-")}`} />
                  {a.count} alertas {a.label}
                </div>
              );
            })}
          </div>

          {/* Recent alerts */}
          {recentAlerts.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-white">
              <div className="border-b border-border/50 px-4 py-2">
                <h3 className="text-sm font-semibold text-foreground/80">Alertas recientes</h3>
              </div>
              <ul className="divide-y divide-gray-50">
                {recentAlerts.slice(0, 6).map((al: any, i: number) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2">
                    <span className={`mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                      al.severity === "critical" ? "bg-red-500" :
                      al.severity === "warning"  ? "bg-yellow-500" : "bg-blue-400"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground/80">{al.message || al.description}</p>
                      <p className="text-xs text-muted-foreground">{al.created_at ? new Date(al.created_at).toLocaleString("es-MX") : ""}</p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      al.severity === "critical" ? "bg-red-100 text-red-700" :
                      al.severity === "warning"  ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                    }`}>{al.severity || "info"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recentAlerts.length === 0 && (
            <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-green-700">✓ Sin alertas activas</p>
              <p className="text-xs text-green-500 mt-1">Todos los sistemas operando normalmente</p>
            </div>
          )}
        </div>
      )}

      {/* ── EQUIPO & CQ ─────────────────────────────────────── */}
      {dashTab === "equipo" && (() => {
        const vigColor: Record<string, string> = {
          vigente: "text-green-600", proximo: "text-yellow-600", vencido: "text-red-600",
        };
        return (
          <div className="space-y-4">
            {/* CQ compliance bars */}
            {qcStats.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-white">
                <div className="border-b border-border/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground/80">Cumplimiento de Control de Calidad</h3>
                </div>
                <div className="space-y-3 p-4">
                  {qcStats.map((q: any, i: number) => {
                    const pct = q.total > 0 ? Math.round((q.ok_count / q.total) * 100) : 0;
                    const barColor = pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span className="font-medium">{q.periodicity || q.period}</span>
                          <span>{q.ok_count}/{q.total} · {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Authorizations table */}
            {authorizations.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-white">
                <div className="border-b border-border/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground/80">Autorizaciones</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Documento</th>
                        <th className="px-4 py-2 text-left">Vencimiento</th>
                        <th className="px-4 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {authorizations.map((a: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="px-4 py-2 font-medium text-foreground/80">{a.doc_type}</td>
                          <td className="px-4 py-2 text-muted-foreground">{a.expiry_date ? new Date(a.expiry_date).toLocaleDateString("es-MX") : "—"}</td>
                          <td className={`px-4 py-2 font-medium ${vigColor[a.vigencyLevel] || "text-muted-foreground"}`}>
                            {a.vigencyLevel || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top risks */}
            {topRisks.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-white">
                <div className="border-b border-border/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground/80">Riesgos principales</h3>
                </div>
                <ul className="divide-y divide-gray-50">
                  {topRisks.map((r: any, i: number) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                        r.risk_level === "alto"   ? "bg-red-500" :
                        r.risk_level === "medio"  ? "bg-yellow-500" : "bg-green-500"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground/80">{r.risk}</p>
                        {r.responsible && <p className="text-xs text-muted-foreground">Resp: {r.responsible}</p>}
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.risk_level === "alto"  ? "bg-red-100 text-red-700" :
                        r.risk_level === "medio" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                      }`}>{r.risk_level || "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── OPERACIÓN ───────────────────────────────────────── */}
      {dashTab === "operacion" && (() => {
        const totalHrs  = monthlyOps.reduce((s: number, m: any) => s + (m.operating_hours  || 0), 0);
        const totalDown = monthlyOps.reduce((s: number, m: any) => s + (m.downtime_hours   || 0), 0);
        const totalPts  = monthlyOps.reduce((s: number, m: any) => s + (m.patients         || 0), 0);
        const availPct  = totalHrs + totalDown > 0
          ? Math.round((totalHrs / (totalHrs + totalDown)) * 100)
          : kpis.availability || 0;
        const summaryCards = [
          { label: "Disponibilidad acumulada", value: `${availPct}%`,     color: availPct >= 90 ? "green" : availPct >= 75 ? "yellow" : "red" },
          { label: "Horas operación",          value: `${totalHrs}h`,     color: "blue" },
          { label: "Horas paro",               value: `${totalDown}h`,    color: "orange" },
          { label: "Pacientes atendidos",      value: `${totalPts}`,      color: "purple" },
        ];
        return (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {summaryCards.map(k => {
                const c = KPI_COLOR_MAP[k.color] || KPI_COLOR_MAP.gray;
                return (
                  <div key={k.label} className={`rounded-lg border p-3 ${c.border} ${c.bg}`}>
                    <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                    <p className={`text-xl font-bold ${c.text}`}>{k.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Monthly hours bars */}
            {monthlyOps.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-white">
                <div className="border-b border-border/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground/80">Horas por mes</h3>
                </div>
                <div className="space-y-3 p-4">
                  {monthlyOps.map((m: any, i: number) => {
                    const total = (m.operating_hours || 0) + (m.downtime_hours || 0);
                    const opPct   = total > 0 ? Math.round((m.operating_hours / total) * 100) : 0;
                    const downPct = total > 0 ? Math.round((m.downtime_hours  / total) * 100) : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span className="font-medium">{m.month}</span>
                          <span className="text-muted-foreground">{m.operating_hours}h op · {m.downtime_hours}h paro</span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-2 bg-blue-400" style={{ width: `${opPct}%` }} />
                          <div className="h-2 bg-red-300"  style={{ width: `${downPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-blue-400" /> Operación</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-red-300"  /> Paro</span>
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance stats table */}
            {maintenanceStats.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-white">
                <div className="border-b border-border/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground/80">Estadísticas de mantenimiento</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Tipo</th>
                        <th className="px-4 py-2 text-right">Órdenes</th>
                        <th className="px-4 py-2 text-right">Horas paro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {maintenanceStats.map((m: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="px-4 py-2 font-medium text-foreground/80">{m.maintenance_type}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{m.count}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{m.total_downtime_hours ?? "—"}h</td>
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

      {/* ── TENDENCIAS ──────────────────────────────────────── */}
      {dashTab === "tendencias" && (
        <div className="space-y-4">
          {/* Patients by month bar chart */}
          {monthlyOps.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground/80">Pacientes por mes</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyOps} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="patients" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Pacientes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Operating vs downtime line chart */}
          {monthlyOps.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground/80">Horas operación vs paro</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyOps} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="operating_hours" stroke="#3b82f6" strokeWidth={2} dot={false} name="Op. (h)" />
                  <Line type="monotone" dataKey="downtime_hours"  stroke="#ef4444" strokeWidth={2} dot={false} name="Paro (h)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Treatment type pie chart */}
          {treatmentTypes.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground/80">Tipos de tratamiento</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={treatmentTypes} dataKey="count" nameKey="treatment_type" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                      {treatmentTypes.map((_: any, idx: number) => (
                        <Cell key={idx} fill={PIE_COLORS_DASH[idx % PIE_COLORS_DASH.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex-1 space-y-1 text-xs">
                  {treatmentTypes.map((t: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: PIE_COLORS_DASH[idx % PIE_COLORS_DASH.length] }} />
                      <span className="truncate text-muted-foreground">{t.treatment_type}</span>
                      <span className="ml-auto font-medium text-foreground/80">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Maintenance by type horizontal bar chart */}
          {maintenanceStats.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground/80">Órdenes de mantenimiento por tipo</h3>
              <ResponsiveContainer width="100%" height={maintenanceStats.length * 36 + 20}>
                <BarChart layout="vertical" data={maintenanceStats} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="maintenance_type" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#a855f7" radius={[0, 3, 3, 0]} name="Órdenes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
