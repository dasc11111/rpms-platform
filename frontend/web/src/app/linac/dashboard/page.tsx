"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Zap, BarChart3, TrendingUp, Shield, Wrench } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Unit { id: number; brand: string; model: string; room: string; operational_status: string; }
interface KPIs {
  availability: number; qcCompliance: number; qcAlertsOpen: number;
  radiationAlertsOpen: number; maintenanceAlertsOpen: number; incidentsOpen: number;
  documentsTotal: number; totalPatients: number; totalOperatingHours: number;
  totalDowntimeHours: number; mtbf: number; mttr: number; maintenanceAvailability: number;
}
interface MonthlyOp { month: string; patients: string; operating_hours: string; downtime_hours: string; }
interface QcStat { periodicity: string; total: string; ok_count: string; }
interface SemaphoreCount { semaphore: string; count: string; }
interface Alert { id: number; description: string; alert_type: string; severity: string; created_at: string; }
interface Auth { id: number; auth_type: string; issuer: string; expiry_date: string; vigencyLevel: string; }
interface MaintenanceStat { maintenance_type: string; count: string; total_hours: string; total_cost: string; total_downtime_hours: string; }
interface Risk { risk: string; risk_level: string; responsible: string; }
interface RadByCat { category: string; total: string; ok_count: string; }
interface DashData {
  ok: boolean; units: Unit[]; kpis: KPIs;
  monthlyOps: MonthlyOp[]; treatmentTypes: { treatment_type: string; count: string }[];
  qcStats: QcStat[]; qcSemaphore: SemaphoreCount[]; qcAlerts: Alert[];
  radiationByCategory: RadByCat[]; radiationSemaphore: SemaphoreCount[]; radiationAlerts: Alert[];
  authorizations: Auth[]; incidentStats: { status: string; count: string }[];
  maintenanceStats: MaintenanceStat[]; maintenanceSemaphore: SemaphoreCount[]; maintenanceAlerts: Alert[];
  topRisks: Risk[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function semColor(s: string) {
  return s === "verde" ? "bg-green-500" : s === "amarillo" ? "bg-yellow-400" : s === "naranja" ? "bg-orange-500" : "bg-red-600";
}
function semTextColor(s: string) {
  return s === "verde" ? "text-green-700" : s === "amarillo" ? "text-yellow-700" : s === "naranja" ? "text-orange-700" : "text-red-700";
}
function vigColor(v: string) {
  return v === "vigente" ? "bg-green-100 text-green-700" : v === "proximo" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
}

function CompBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 95 ? "bg-green-500" : pct >= 80 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LinacDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/linac/dashboard")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const totalAlerts = data ? data.kpis.qcAlertsOpen + data.kpis.radiationAlertsOpen + data.kpis.maintenanceAlertsOpen : 0;
  const maxMonthPatients = data ? Math.max(...data.monthlyOps.map(m => Number(m.patients) || 0), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <Zap className="h-6 w-6 text-violet-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard LINAC</h1>
              <p className="text-sm text-gray-500">Control de equipos de radioterapia — disponibilidad, calidad y protección radiológica</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-gray-400">Cargando dashboard LINAC...</div>
        ) : !data?.ok ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* Alert banner */}
            {totalAlerts > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3 text-red-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span><strong>{totalAlerts}</strong> alertas abiertas — {data.kpis.qcAlertsOpen} CC, {data.kpis.radiationAlertsOpen} PR, {data.kpis.maintenanceAlertsOpen} mantenimiento.</span>
              </div>
            )}

            {/* Units status */}
            {data.units.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.units.map(u => (
                  <div key={u.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${u.operational_status === "operativo" ? "bg-green-500" : u.operational_status === "mantenimiento" ? "bg-yellow-400" : "bg-red-500"}`} />
                      <span className="text-xs text-gray-500 capitalize">{u.operational_status}</span>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm">{u.brand} {u.model}</div>
                    <div className="text-xs text-gray-400">{u.room}</div>
                  </div>
                ))}
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Disponibilidad", value: `${data.kpis.availability.toFixed(1)}%`, icon: Zap, color: data.kpis.availability >= 95 ? "green" : data.kpis.availability >= 80 ? "yellow" : "red" },
                { label: "Cumplimiento CC", value: `${data.kpis.qcCompliance.toFixed(1)}%`, icon: CheckCircle2, color: data.kpis.qcCompliance >= 95 ? "green" : data.kpis.qcCompliance >= 80 ? "yellow" : "red" },
                { label: "Pacientes tratados", value: data.kpis.totalPatients.toLocaleString("es-CL"), icon: BarChart3, color: "blue" },
                { label: "Incidentes abiertos", value: data.kpis.incidentsOpen.toString(), icon: AlertTriangle, color: data.kpis.incidentsOpen === 0 ? "green" : "red" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Operational metrics */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Métricas Operacionales</h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Hrs operación total", value: data.kpis.totalOperatingHours.toFixed(0) + " h" },
                    { label: "Hrs tiempo caído total", value: data.kpis.totalDowntimeHours.toFixed(0) + " h" },
                    { label: "MTBF", value: data.kpis.mtbf ? data.kpis.mtbf.toFixed(1) + " h" : "—" },
                    { label: "MTTR", value: data.kpis.mttr ? data.kpis.mttr.toFixed(1) + " h" : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className="font-bold text-gray-800">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* QC compliance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Control de Calidad por Periodicidad
                </h2>
                <div className="space-y-2">
                  {data.qcStats.map((s, i) => {
                    const pct = Number(s.total) > 0 ? (Number(s.ok_count) / Number(s.total)) * 100 : 0;
                    return <CompBar key={i} pct={pct} label={s.periodicity || "Sin dato"} />;
                  })}
                </div>
                {/* semaphore pills */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {data.qcSemaphore.map((s, i) => (
                    <span key={i} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${semTextColor(s.semaphore)} bg-gray-100`}>
                      <span className={`w-2 h-2 rounded-full ${semColor(s.semaphore)}`} />
                      {s.semaphore}: {s.count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Radiation protection by category */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" /> Protección Radiológica por Categoría
                </h2>
                <div className="space-y-2">
                  {data.radiationByCategory.map((r, i) => {
                    const pct = Number(r.total) > 0 ? (Number(r.ok_count) / Number(r.total)) * 100 : 0;
                    return <CompBar key={i} pct={pct} label={r.category || "Sin dato"} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {data.radiationSemaphore.map((s, i) => (
                    <span key={i} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${semTextColor(s.semaphore)} bg-gray-100`}>
                      <span className={`w-2 h-2 rounded-full ${semColor(s.semaphore)}`} />
                      {s.semaphore}: {s.count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Maintenance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-yellow-500" /> Mantenimiento
                </h2>
                <div className="space-y-2 text-sm">
                  {data.maintenanceStats.map((m, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-700 capitalize">{m.maintenance_type}</span>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{m.count} reg.</span>
                        <span>{Number(m.total_hours).toFixed(0)} h</span>
                        <span>${Number(m.total_cost).toLocaleString("es-CL")}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {data.maintenanceSemaphore.map((s, i) => (
                    <span key={i} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${semTextColor(s.semaphore)} bg-gray-100`}>
                      <span className={`w-2 h-2 rounded-full ${semColor(s.semaphore)}`} />
                      {s.semaphore}: {s.count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Monthly trend */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-400" /> Pacientes por Mes (12 meses)
                </h2>
                {data.monthlyOps.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {data.monthlyOps.map((m, i) => {
                      const pts = Number(m.patients) || 0;
                      const h = Math.round((pts / maxMonthPatients) * 100);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-gray-400">{pts > 0 ? pts : ""}</span>
                          <div className="w-full bg-violet-500 rounded-t" style={{ height: `${Math.max(h, pts > 0 ? 2 : 0)}px` }} />
                          <span className="text-[9px] text-gray-400">{m.month.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Authorizations */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-3">Autorizaciones Vigentes</h2>
                {data.authorizations.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin autorizaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {data.authorizations.map((a, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div>
                          <div className="font-medium text-gray-800">{a.auth_type}</div>
                          <div className="text-xs text-gray-400">{a.issuer}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{a.expiry_date ? new Date(a.expiry_date).toLocaleDateString("es-CL") : "—"}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${vigColor(a.vigencyLevel)}`}>{a.vigencyLevel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top risks */}
              {data.topRisks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 col-span-full">
                  <h2 className="font-semibold text-gray-800 mb-3">Riesgos Prioritarios</h2>
                  <div className="space-y-1">
                    {data.topRisks.slice(0, 8).map((r, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm border-b border-gray-100 pb-1 last:border-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${r.risk_level === "alto" ? "bg-red-500" : r.risk_level === "medio" ? "bg-yellow-400" : "bg-green-500"}`} />
                        <span className="flex-1 text-gray-700">{r.risk}</span>
                        <span className="text-xs text-gray-400">{r.responsible}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Regulatory footer */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°12/2010 MINSAL — Reglamento de protección radiológica de instalaciones radiactivas.
                DS N°133/1984 Ministerio de Minería — Reglamento de Seguridad Radiológica.
                IAEA Safety Standards Series SSR-6 (Rev.1) — Regulations for the Safe Transport of Radioactive Material.
                IAEA Safety Reports Series No. 47 — Radiation Protection in the Design of Radiotherapy Facilities.
                CCHEN ORD. sobre control de calidad en equipos de radioterapia externa.
                DS N°594/1999 MINSAL Art. 103-108 — Medidas de seguridad en instalaciones con radiaciones ionizantes.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
