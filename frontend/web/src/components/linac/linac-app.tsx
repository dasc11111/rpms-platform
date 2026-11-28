"use client";

import { useCallback, useEffect, useState } from "react";
import {
Plus, Upload, Download, Eye, FileText, AlertTriangle, ShieldCheck, Activity,
Wrench, Siren, ClipboardList, FolderOpen, History, LayoutDashboard, Radiation,
ShieldAlert, CalendarClock, Settings2, Lock, Database, FlaskConical,
} from "lucide-react";
import {
BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAuth } from "@/components/auth/auth-provider";
import { AcceptanceTestingTab } from "./acceptance-testing";
import { CommissioningTab } from "./commissioning";
import { BaselineTab } from "./baseline";
import { BeamDataTab } from "./beamdata";
import { QcTab } from "./qc";
import { RadiationTab } from "./radiation";
import { MaintenanceTab } from "./maintenance";
import { ScienceTab } from "./science";

const TABS = [
{ id: "dashboard", label: "Dashboard Ejecutivo", icon: LayoutDashboard },
{ id: "info", label: "Informacion General", icon: ClipboardList },
{ id: "auth", label: "Autorizaciones", icon: ShieldCheck },
{ id: "acceptance", label: "Acceptance Testing", icon: ClipboardList },
{ id: "commissioning", label: "Commissioning", icon: Settings2 },
{ id: "baseline", label: "Baseline Oficial", icon: Lock },
{ id: "beamdata", label: "Beam Data", icon: Database },
{ id: "qc", label: "Control de Calidad", icon: Activity },
{ id: "clinical", label: "Operacion Clinica", icon: FileText },
{ id: "radiation", label: "Proteccion Radiologica", icon: Radiation },
{ id: "maintenance", label: "Mantenimiento", icon: Wrench },
{ id: "science", label: "Motor Cientifico", icon: FlaskConical },
{ id: "incidents", label: "Incidentes", icon: AlertTriangle },
{ id: "risks", label: "Gestion de Riesgos", icon: ShieldAlert },
{ id: "emergencies", label: "Emergencias", icon: Siren },
{ id: "audits", label: "Auditorias", icon: CalendarClock },
{ id: "documents", label: "Documentacion", icon: FolderOpen },
{ id: "history", label: "Historial", icon: History },
];

const OPERATIONAL_STATUSES = ["activo", "en_mantencion", "en_reparacion", "fuera_de_servicio", "baja"];
const STATUS_LABELS = {
activo: "Activo",
en_mantencion: "En Mantencion",
en_reparacion: "En Reparacion",
fuera_de_servicio: "Fuera de Servicio",
baja: "Baja",
};
const AUTH_TYPES = [
{ value: "seremi", label: "Autorizacion SEREMI" },
{ value: "cchen", label: "Autorizacion CCHEN" },
{ value: "resolucion", label: "Resolucion" },
{ value: "informe_seguridad", label: "Informe de Seguridad" },
{ value: "licencia", label: "Licencia" },
];
const QC_PERIODICITIES = ["diario", "semanal", "mensual", "trimestral", "semestral", "anual"];
const TREATMENT_TYPES = ["IMRT", "VMAT", "3DCRT", "SRS", "SBRT", "TBI"];
const MAINTENANCE_TYPES = ["preventivo", "correctivo", "predictivo"];
const RADIATION_TYPES = ["fuga", "blindaje", "monitor_area", "interlock", "puerta", "boton_emergencia"];
const AUDIT_TYPES = ["interna", "externa", "seremi", "cchen", "iaea"];
const VIGENCY_COLORS: Record<string, string> = {
verde: "text-success",
amarillo: "text-warning",
naranjo: "text-orange-500",
rojo: "text-danger",
vencido: "text-danger",
sin_vigencia: "text-muted-foreground",
};
const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#a855f7", "#06b6d4"];

export function LinacApp() {
const { user } = useAuth();
const actorEmail = user?.email || null;
const [tab, setTab] = useState("dashboard");
const [units, setUnits] = useState<any[]>([]);
const [unitId, setUnitId] = useState<number | null>(null);
const [dashboard, setDashboard] = useState<any>(null);
const [loading, setLoading] = useState(false);

const loadUnits = useCallback(async () => {
const res = await fetch("/api/linac");
const data = await res.json();
if (data.ok) {
setUnits(data.units);
if (!unitId && data.units[0]) setUnitId(data.units[0]!.id);
}
}, [unitId]);

const loadDashboard = useCallback(async () => {
const res = await fetch("/api/linac/dashboard");
const data = await res.json();
if (data.ok) setDashboard(data);
}, []);

useEffect(() => {
loadUnits();
loadDashboard();
}, [loadUnits, loadDashboard]);

const selectedUnit = units.find((u: any) => u.id === unitId) || null;

return (
<div className="space-y-4">
<div className="flex flex-wrap items-center justify-between gap-3">
<div>
<h1 className="text-xl font-semibold text-foreground">Acelerador Lineal</h1>
<p className="text-sm text-muted-foreground">
Gestion integral: seguridad radiologica, control de calidad, operacion clinica y cumplimiento normativo (CCHEN, SEREMI de Salud)
</p>
</div>
<div className="flex items-center gap-2">
<select
value={unitId || ""}
onChange={(e) => setUnitId(Number(e.target.value))}
className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
>
{units.length === 0 && <option value="">Sin equipos registrados</option>}
{units.map((u: any) => (
<option key={u.id} value={u.id}>
{(u.brand || "Equipo") + " " + (u.model || "") + " - " + (u.room || "Sala s/n")}
</option>
))}
</select>
{unitId && (
<a
href={`/api/linac/export/pdf?linac_id=${unitId}`}
target="_blank"
rel="noopener noreferrer"
className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
title="Descargar informe técnico PDF"
>
<Download className="h-4 w-4" />
Informe PDF
</a>
)}
</div>
</div>

<GlobalSearchBar onNavigate={(t: string, id: number | null) => { setTab(t); if (id) setUnitId(id); }} />

<div className="flex flex-wrap gap-1 border-b border-border pb-2">
{TABS.map((t: any) => {
const Icon = t.icon;
const active = tab === t.id;
return (
<button
key={t.id}
onClick={() => setTab(t.id)}
className={
"flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs " +
(active ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")
}
>
<Icon className="h-3.5 w-3.5" strokeWidth={2} />
{t.label}
</button>
);
})}
</div>

{tab === "dashboard" && <DashboardTab dashboard={dashboard} />}
{tab === "info" && (
<InfoTab unit={selectedUnit} actorEmail={actorEmail} onSaved={loadUnits} onCreated={loadUnits} />
)}
{tab === "auth" && unitId && <AuthTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "acceptance" && unitId && <AcceptanceTestingTab unitId={unitId} unit={selectedUnit} actorEmail={actorEmail} />}
{tab === "commissioning" && unitId && <CommissioningTab unitId={unitId} unit={selectedUnit} actorEmail={actorEmail} />}
{tab === "baseline" && unitId && <BaselineTab unitId={unitId} />}
{tab === "beamdata" && unitId && <BeamDataTab unitId={unitId} unit={selectedUnit} actorEmail={actorEmail} />}
{tab === "qc" && unitId && <QcTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "clinical" && unitId && <ClinicalTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "radiation" && unitId && <RadiationTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "maintenance" && unitId && <MaintenanceTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "science" && unitId && <ScienceTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "incidents" && unitId && <IncidentsTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "risks" && unitId && <RisksTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "emergencies" && unitId && <EmergenciesTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "audits" && unitId && <AuditsTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "documents" && unitId && <DocumentsTab unitId={unitId} actorEmail={actorEmail} />}
{tab === "history" && <HistoryTab />}
{!unitId && tab !== "dashboard" && tab !== "info" && tab !== "history" && (
<p className="text-sm text-muted-foreground">
Primero registra un equipo en &quot;Informacion General&quot;.
</p>
)}
</div>
);
}

function KpiBox({ label, value, icon }: any) {
return (
<div className="rounded-lg border border-border bg-surface p-3">
<p className="text-xs text-muted-foreground">{label}</p>
<p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-foreground">
{icon}
{value}
</p>
</div>
);
}

function GlobalSearchBar({ onNavigate }: any) {
const [q, setQ] = useState("");
const [results, setResults] = useState<any[]>([]);
const [open, setOpen] = useState(false);
const [searching, setSearching] = useState(false);

useEffect(() => {
if (!q || q.trim().length < 2) { setResults([]); setOpen(false); return; }
const handle = setTimeout(() => {
setSearching(true);
fetch("/api/linac/search?q=" + encodeURIComponent(q.trim()))
.then((res) => res.json())
.then((data) => { if (data.ok) { setResults(data.results || []); setOpen(true); } })
.finally(() => setSearching(false));
}, 350);
return () => clearTimeout(handle);
}, [q]);

function pick(r: any) {
setOpen(false);
setQ("");
onNavigate && onNavigate(r.tab, r.linacId);
}

return (
<div className="relative w-full max-w-md">
<input
className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
placeholder="Buscar equipo, documento, procedimiento, instrumento, responsable..."
value={q}
onChange={(e) => setQ(e.target.value)}
onFocus={() => { if (results.length > 0) setOpen(true); }}
onBlur={() => setTimeout(() => setOpen(false), 150)}
/>
{open && (
<div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface shadow-lg max-h-80 overflow-y-auto">
{searching && <p className="p-2 text-xs text-muted-foreground">Buscando...</p>}
{!searching && results.length === 0 && <p className="p-2 text-xs text-muted-foreground">Sin resultados</p>}
{results.map((r: any, i: number) => (
<button
key={i}
onMouseDown={() => pick(r)}
className="flex w-full flex-col items-start gap-0.5 border-b border-border px-2 py-1.5 text-left text-xs last:border-0 hover:bg-background"
>
<span className="flex items-center gap-1.5">
<span className="rounded bg-accent-subtle px-1 py-0.5 text-[10px] font-medium text-foreground">{r.type}</span>
<span className="font-medium text-foreground">{r.label}</span>
</span>
{r.subtitle && <span className="text-muted-foreground">{r.subtitle}</span>}
</button>
))}
</div>
)}
</div>
);
}

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

function DashboardTab({ dashboard }: any) {
const [dashTab, setDashTab] = useState("resumen");
if (!dashboard) return <p className="text-sm text-muted-foreground">Cargando dashboard...</p>;
const k = dashboard.kpis || {};
const alerts = [
...(dashboard.qcAlerts || []).map((a: any) => ({ ...a, alertType: "QC" })),
...(dashboard.radiationAlerts || []).map((a: any) => ({ ...a, alertType: "Radiologica" })),
...(dashboard.maintenanceAlerts || []).map((a: any) => ({ ...a, alertType: "Mantenimiento" })),
].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
const alertColors: Record<string, string> = {
QC: "bg-purple-500/20 text-purple-300",
Radiologica: "bg-orange-500/20 text-orange-300",
Mantenimiento: "bg-blue-500/20 text-blue-300",
};
const totalAlerts = (k.qcAlertsOpen || 0) + (k.radiationAlertsOpen || 0) + (k.maintenanceAlertsOpen || 0);
return (
<div className="space-y-4">
{/* Sub-tab navigation */}
<div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
{[
{ id: "resumen", label: "Resumen" },
{ id: "equipo", label: "Equipo & QC" },
{ id: "operacion", label: "Operación" },
{ id: "tendencias", label: "Tendencias" },
].map((t) => (
<button
key={t.id}
onClick={() => setDashTab(t.id)}
className={"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors " + (dashTab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
>
{t.label}
</button>
))}
</div>

{/* RESUMEN TAB */}
{dashTab === "resumen" && (() => {
const kpis = [
{ label: "Disponibilidad", value: k.availability != null ? k.availability + "%" : "—", color: "green", pct: k.availability },
{ label: "Cumplimiento QC", value: k.qcCompliance != null ? k.qcCompliance + "%" : "—", color: "blue", pct: k.qcCompliance },
{ label: "MTBF", value: k.mtbf != null ? k.mtbf + " h" : "—", color: "teal", pct: null },
{ label: "MTTR", value: k.mttr != null ? k.mttr + " h" : "—", color: "orange", pct: null },
{ label: "Pacientes tratados", value: k.totalPatients ?? "—", color: "purple", pct: null },
{ label: "Horas operativas", value: k.totalOperatingHours ?? "—", color: "sky", pct: null },
];
return (
<div className="space-y-4">
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
{kpis.map((kpi) => {
const c = KPI_COLOR_MAP[kpi.color];
return (
<div key={kpi.label} className={"rounded-xl border-2 p-3 " + c.border + " " + c.bg}>
<p className="text-xs text-muted-foreground">{kpi.label}</p>
<p className={"mt-1 text-xl font-bold " + c.text}>{String(kpi.value)}</p>
{kpi.pct != null && (
<div className="mt-2 h-1.5 w-full rounded-full bg-white/60">
<div className={"h-1.5 rounded-full " + (kpi.pct >= 90 ? "bg-green-500" : kpi.pct >= 70 ? "bg-yellow-400" : "bg-red-400")} style={{ width: Math.min(kpi.pct, 100) + "%" }} />
</div>
)}
</div>
);
})}
</div>

{/* Alertas panel */}
{totalAlerts > 0 && (
<div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
<div className="mb-3 flex items-center justify-between">
<p className="text-sm font-semibold text-orange-800">Alertas Activas</p>
<span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">{totalAlerts}</span>
</div>
<div className="grid grid-cols-3 gap-3">
{[
{ label: "QC", count: k.qcAlertsOpen, color: "purple" },
{ label: "Radiológica", count: k.radiationAlertsOpen, color: "orange" },
{ label: "Mantenimiento", count: k.maintenanceAlertsOpen, color: "blue" },
].map((al) => {
const c = KPI_COLOR_MAP[al.color];
return (
<div key={al.label} className={"rounded-lg border p-3 text-center " + c.border + " " + c.bg}>
<p className={"text-2xl font-bold " + c.text}>{al.count ?? 0}</p>
<p className="mt-0.5 text-xs text-muted-foreground">{al.label}</p>
</div>
);
})}
</div>
</div>
)}

{/* Recent alerts list */}
{alerts.length > 0 && (
<div className="rounded-xl border border-border bg-background p-3">
<p className="mb-2 text-xs font-semibold text-foreground">Últimas alertas</p>
<div className="max-h-48 space-y-1 overflow-y-auto">
{alerts.slice(0, 20).map((a: any, i: number) => (
<div key={(a.alertType || "") + "-" + a.id + "-" + i} className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1 text-xs">
<div className="flex flex-wrap items-center gap-2">
<span className={"rounded px-1.5 py-0.5 text-[10px] font-medium " + (alertColors[a.alertType] || "bg-muted text-muted-foreground")}>{a.alertType}</span>
<span className={"font-medium " + (VIGENCY_COLORS[a.semaphore as keyof typeof VIGENCY_COLORS] || "text-foreground")}>{a.semaphore}</span>
<span className="text-foreground">{a.message}</span>
</div>
<span className="text-muted-foreground">{a.created_at ? String(a.created_at).slice(0, 10) : "-"}</span>
</div>
))}
</div>
</div>
)}
        </div>
        );
        })()} 



        {/* ── EQUIPO & QC ── */}
        {dashTab === "equipo" && (() => {
          const auths = dashboard.authorizations || [];
          const risks = dashboard.topRisks || [];
          const qc = dashboard.qcStats || [];
          const vigColor: Record<string, string> = {
            vigente: "text-green-600", proximo: "text-yellow-600", vencido: "text-red-600",
          };
          return (
            <div className="space-y-4">
              {/* QC Compliance bars */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cumplimiento QC por Periodicidad</p>
                <div className="space-y-3">
                  {qc.map((q: any, i: number) => {
                    const pct = q.total > 0 ? Math.round((q.ok_count / q.total) * 100) : 0;
                    const bar = pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
                    return (
                      <div key={i}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium capitalize">{q.periodicity}</span>
                          <span className="text-muted-foreground">{q.ok_count}/{q.total} — {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {qc.length === 0 && <p className="text-xs text-muted-foreground">Sin datos de QC</p>}
                </div>
              </div>
              {/* Authorizations table */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autorizaciones ({auths.length})</p>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border">
                      <th className="pb-1 text-left font-medium text-muted-foreground">Documento</th>
                      <th className="pb-1 text-left font-medium text-muted-foreground">Vencimiento</th>
                      <th className="pb-1 text-left font-medium text-muted-foreground">Estado</th>
                    </tr></thead>
                    <tbody>
                      {auths.map((a: any, i: number) => (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          <td className="py-1.5 pr-2 font-medium">{a.doc_type}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{a.expiry_date}</td>
                          <td className={`py-1.5 font-semibold capitalize ${vigColor[a.vigencyLevel] || "text-muted-foreground"}`}>{a.vigencyLevel}</td>
                        </tr>
                      ))}
                      {auths.length === 0 && <tr><td colSpan={3} className="py-2 text-muted-foreground">Sin autorizaciones</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Top risks */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riesgos Principales</p>
                <div className="space-y-2">
                  {risks.map((r: any, i: number) => {
                    const lvlColor: Record<string, string> = { alto: "bg-red-100 text-red-700", medio: "bg-yellow-100 text-yellow-700", bajo: "bg-green-100 text-green-700" };
                    const cls = lvlColor[r.risk_level?.toLowerCase()] || "bg-muted text-foreground/80";
                    return (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <span className="text-xs">{r.risk}</span>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{r.risk_level}</span>
                          {r.responsible && <span className="text-[10px] text-muted-foreground">{r.responsible}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {risks.length === 0 && <p className="text-xs text-muted-foreground">Sin riesgos registrados</p>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── OPERACIÓN ── */}
        {dashTab === "operacion" && (() => {
          const maint = dashboard.maintenanceStats || [];
          const monthly = dashboard.monthlyOps || [];
          const totalHrs = monthly.reduce((s: number, m: any) => s + (m.operating_hours || 0), 0);
          const totalDown = monthly.reduce((s: number, m: any) => s + (m.downtime_hours || 0), 0);
          const availPct = totalHrs + totalDown > 0 ? Math.round((totalHrs / (totalHrs + totalDown)) * 100) : 0;
          return (
            <div className="space-y-4">
              {/* Summary metrics */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Horas operativas", value: totalHrs.toFixed(0), color: "blue" },
                  { label: "Horas parada", value: totalDown.toFixed(0), color: "red" },
                  { label: "Disponibilidad", value: `${availPct}%`, color: availPct >= 85 ? "green" : availPct >= 70 ? "yellow" : "red" },
                ].map(({ label, value, color }) => {
                  const c = KPI_COLOR_MAP[color] || KPI_COLOR_MAP.gray;
                  return (
                    <div key={label} className={`rounded-lg border p-3 ${c.border} ${c.bg}`}>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className={`text-lg font-bold ${c.text}`}>{value}</p>
                    </div>
                  );
                })}
              </div>
              {/* Operating hours breakdown bar */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horas por Mes (Operativas vs Parada)</p>
                <div className="space-y-2">
                  {monthly.slice(-6).map((m: any, i: number) => {
                    const total = (m.operating_hours || 0) + (m.downtime_hours || 0);
                    const opPct = total > 0 ? Math.round(((m.operating_hours || 0) / total) * 100) : 0;
                    return (
                      <div key={i}>
                        <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                          <span>{m.month}</span>
                          <span>{m.operating_hours?.toFixed(0)}h op / {m.downtime_hours?.toFixed(0)}h parada</span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="bg-blue-500" style={{ width: `${opPct}%` }} />
                          <div className="bg-red-400" style={{ width: `${100 - opPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-blue-500" />Operativas</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-red-400" />Parada</span>
                </div>
              </div>
              {/* Maintenance stats */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mantenimientos por Tipo</p>
                <div className="space-y-2">
                  {maint.map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="capitalize">{m.maintenance_type}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{m.count} eventos</span>
                        {m.total_downtime_hours != null && <span>{Number(m.total_downtime_hours).toFixed(1)}h parada</span>}
                      </div>
                    </div>
                  ))}
                  {maint.length === 0 && <p className="text-xs text-muted-foreground">Sin datos de mantenimiento</p>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── TENDENCIAS ── */}
        {dashTab === "tendencias" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pacientes tratados por mes</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dashboard.monthlyOps || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11 }} />
                  <Bar dataKey="patients" fill="#3b82f6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horas operativas vs parada</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dashboard.monthlyOps || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11 }} />
                  <Line type="monotone" dataKey="operating_hours" stroke="#22c55e" dot={false} strokeWidth={2} name="Operativas" />
                  <Line type="monotone" dataKey="downtime_hours" stroke="#ef4444" dot={false} strokeWidth={2} name="Parada" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipos de tratamiento</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={dashboard.treatmentTypes || []} dataKey="count" nameKey="treatment_type" cx="50%" cy="50%" outerRadius={65} label={({ treatment_type, percent }: any) => `${treatment_type} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                      {(dashboard.treatmentTypes || []).map((_: any, idx: number) => (
                        <Cell key={idx} fill={PIE_COLORS_DASH[idx % PIE_COLORS_DASH.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eventos de mantenimiento</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dashboard.maintenanceStats || []} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="maintenance_type" tick={{ fontSize: 9 }} width={70} />
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11 }} />
                    <Bar dataKey="count" fill="#a855f7" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function InfoTab({ unit, actorEmail, onSaved, onCreated }: any) {
const [form, setForm] = useState<any>({});
const [saving, setSaving] = useState(false);
const [isNew, setIsNew] = useState(!unit);

useEffect(() => {
if (unit) {
setForm({
brand: unit.brand || "", model: unit.model || "", manufacturer: unit.manufacturer || "",
manufactureYear: unit.manufacture_year || "", installYear: unit.install_year || "",
serialNumber: unit.serial_number || "", inventoryNumber: unit.inventory_number || "",
photonEnergies: unit.photon_energies || "", electronEnergies: unit.electron_energies || "",
mlcType: unit.mlc_type || "", epid: unit.epid || false, cbct: unit.cbct || false,
recordVerifySystem: unit.record_verify_system || "", tpsAssociated: unit.tps_associated || "",
room: unit.room || "", operationalStatus: unit.operational_status || "activo",
});
setIsNew(false);
}
}, [unit]);

function set(key: string, value: any) {
setForm((f: any) => ({ ...f, [key]: value }));
}

async function handleSave() {
setSaving(true);
try {
if (isNew) {
await fetch("/api/linac", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ ...form, actorEmail }),
});
onCreated && onCreated();
} else {
await fetch("/api/linac/" + unit.id, {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ ...form, actorEmail }),
});
onSaved && onSaved();
}
} finally {
setSaving(false);
}
}

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const labelCls = "text-xs text-muted-foreground";

return (
<div className="space-y-4">
<div className="flex items-center justify-between">
<p className="text-sm font-semibold text-foreground">
{isNew ? "Registrar nuevo acelerador lineal" : "Editar informacion del equipo"}
</p>
<button
onClick={() => setIsNew(true)}
className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
>
<Plus className="h-3.5 w-3.5" /> Nuevo equipo
</button>
</div>
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
<div><label className={labelCls}>Marca</label><input className={inputCls} value={form.brand || ""} onChange={(e) => set("brand", e.target.value)} /></div>
<div><label className={labelCls}>Modelo</label><input className={inputCls} value={form.model || ""} onChange={(e) => set("model", e.target.value)} /></div>
<div><label className={labelCls}>Fabricante</label><input className={inputCls} value={form.manufacturer || ""} onChange={(e) => set("manufacturer", e.target.value)} /></div>
<div><label className={labelCls}>Año fabricacion</label><input type="number" className={inputCls} value={form.manufactureYear || ""} onChange={(e) => set("manufactureYear", e.target.value)} /></div>
<div><label className={labelCls}>Año instalacion</label><input type="number" className={inputCls} value={form.installYear || ""} onChange={(e) => set("installYear", e.target.value)} /></div>
<div><label className={labelCls}>Numero de serie</label><input className={inputCls} value={form.serialNumber || ""} onChange={(e) => set("serialNumber", e.target.value)} /></div>
<div><label className={labelCls}>Numero de inventario</label><input className={inputCls} value={form.inventoryNumber || ""} onChange={(e) => set("inventoryNumber", e.target.value)} /></div>
<div><label className={labelCls}>Energias fotones</label><input className={inputCls} value={form.photonEnergies || ""} onChange={(e) => set("photonEnergies", e.target.value)} placeholder="6 MV, 10 MV" /></div>
<div><label className={labelCls}>Energias electrones</label><input className={inputCls} value={form.electronEnergies || ""} onChange={(e) => set("electronEnergies", e.target.value)} placeholder="6, 9, 12 MeV" /></div>
<div><label className={labelCls}>Tipo de MLC</label><input className={inputCls} value={form.mlcType || ""} onChange={(e) => set("mlcType", e.target.value)} /></div>
<div><label className={labelCls}>Sistema Record and Verify</label><input className={inputCls} value={form.recordVerifySystem || ""} onChange={(e) => set("recordVerifySystem", e.target.value)} /></div>
<div><label className={labelCls}>TPS asociado</label><input className={inputCls} value={form.tpsAssociated || ""} onChange={(e) => set("tpsAssociated", e.target.value)} /></div>
<div><label className={labelCls}>Sala</label><input className={inputCls} value={form.room || ""} onChange={(e) => set("room", e.target.value)} /></div>
<div>
<label className={labelCls}>Estado operativo</label>
<select className={inputCls} value={form.operationalStatus || "activo"} onChange={(e) => set("operationalStatus", e.target.value)}>
{OPERATIONAL_STATUSES.map((s: any) => (<option key={s} value={s}>{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</option>))}
</select>
</div>
<div className="flex items-center gap-2 pt-5">
<input type="checkbox" checked={!!form.epid} onChange={(e) => set("epid", e.target.checked)} />
<span className="text-sm text-foreground">EPID</span>
</div>
<div className="flex items-center gap-2 pt-5">
<input type="checkbox" checked={!!form.cbct} onChange={(e) => set("cbct", e.target.checked)} />
<span className="text-sm text-foreground">CBCT</span>
</div>
</div>
<button
onClick={handleSave}
disabled={saving}
className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
>
{saving ? "Guardando..." : isNew ? "Crear equipo" : "Guardar cambios"}
</button>
</div>
);
}

function AuthTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [docType, setDocType] = useState(AUTH_TYPES[0]!.value);
const [documentNumber, setDocumentNumber] = useState("");
const [issueDate, setIssueDate] = useState("");
const [expiryDate, setExpiryDate] = useState("");
const [file, setFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);

const load = useCallback(async () => {
const res = await fetch("/api/linac/authorizations?linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.authorizations);
}, [unitId]);

useEffect(() => { load(); }, [load]);

async function handleUpload() {
if (!docType) return;
setUploading(true);
try {
const form = new FormData();
form.set("linacId", String(unitId));
form.set("docType", docType);
form.set("documentNumber", documentNumber);
form.set("issueDate", issueDate);
form.set("expiryDate", expiryDate);
form.set("uploadedBy", actorEmail || "");
if (file) form.set("file", file);
await fetch("/api/linac/authorizations", { method: "POST", body: form });
setDocumentNumber(""); setIssueDate(""); setExpiryDate(""); setFile(null);
load();
} finally {
setUploading(false);
}
}

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Cargar autorizacion / resolucion / licencia</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
<select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value)}>
{AUTH_TYPES.map((t: any) => (<option key={t.value} value={t.value}>{t.label}</option>))}
</select>
<input className={inputCls} placeholder="N documento" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
<input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
<input type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
<input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
</div>
<button
onClick={handleUpload}
disabled={uploading}
className="mt-2 flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
>
<Upload className="h-3.5 w-3.5" /> {uploading ? "Subiendo..." : "Cargar"}
</button>
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-muted-foreground">
<th className="p-1">Tipo</th><th className="p-1">N</th><th className="p-1">Emision</th>
<th className="p-1">Vence</th><th className="p-1">Estado</th><th className="p-1">Version</th><th className="p-1">Archivo</th>
</tr>
</thead>
<tbody>
{list.map((a: any) => (
<tr key={a.id} className="border-t border-border">
<td className="p-1 text-foreground">{a.doc_type}</td>
<td className="p-1 text-foreground">{a.document_number || "-"}</td>
<td className="p-1 text-foreground">{a.issue_date ? String(a.issue_date).slice(0, 10) : "-"}</td>
<td className="p-1 text-foreground">{a.expiry_date ? String(a.expiry_date).slice(0, 10) : "-"}</td>
<td className={"p-1 font-medium " + (VIGENCY_COLORS[a.vigencyLevel as keyof typeof VIGENCY_COLORS] || "text-foreground")}>{a.vigencyLevel}</td>
<td className="p-1 text-foreground">v{a.version}</td>
<td className="p-1">
{a.blob_url && (
<div className="flex gap-1">
<a href={"/api/linac/download?table=authorizations&id=" + a.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Vista previa"><Eye className="h-3 w-3" /></a>
<a href={"/api/linac/download?table=authorizations&id=" + a.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Descargar"><Download className="h-3 w-3" /></a>
</div>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function ClinicalTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({});
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

const load = useCallback(async () => {
const res = await fetch("/api/linac/records?type=clinical&linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.opDate) return;
setSaving(true);
try {
await fetch("/api/linac/records", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "clinical", linacId: unitId, actorEmail, ...form }),
});
setForm({});
load();
} finally { setSaving(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Registro diario de operacion clinica</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<input type="date" className={inputCls} value={form.opDate || ""} onChange={(e) => set("opDate", e.target.value)} />
<input type="number" className={inputCls} placeholder="Pacientes tratados" value={form.patientsTreated || ""} onChange={(e) => set("patientsTreated", e.target.value)} />
<input type="number" className={inputCls} placeholder="Horas operativas" value={form.operatingHours || ""} onChange={(e) => set("operatingHours", e.target.value)} />
<input type="number" className={inputCls} placeholder="Horas detenido" value={form.downtimeHours || ""} onChange={(e) => set("downtimeHours", e.target.value)} />
<input type="number" className={inputCls} placeholder="Interrupciones" value={form.interruptions || ""} onChange={(e) => set("interruptions", e.target.value)} />
<select className={inputCls} value={form.treatmentType || ""} onChange={(e) => set("treatmentType", e.target.value)}>
<option value="">Tipo tratamiento</option>
{TREATMENT_TYPES.map((t: any) => (<option key={t} value={t}>{t}</option>))}
</select>
</div>
<input className={inputCls + " mt-2"} placeholder="Notas" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Pacientes</th><th className="p-1">Horas op.</th>
<th className="p-1">Horas det.</th><th className="p-1">Interrup.</th><th className="p-1">Tipo</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.op_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.patients_treated}</td>
<td className="p-1 text-foreground">{r.operating_hours}</td>
<td className="p-1 text-foreground">{r.downtime_hours}</td>
<td className="p-1 text-foreground">{r.interruptions}</td>
<td className="p-1 text-foreground">{r.treatment_type || "-"}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function IncidentsTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({});
const [file, setFile] = useState<File | null>(null);
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/incidents?linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.incidents);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.event || !form.incidentDate) return;
setSaving(true);
try {
const fd = new FormData();
fd.set("linacId", String(unitId));
fd.set("actorEmail", actorEmail || "");
Object.entries(form).forEach(([k, v]: [string, any]) => fd.set(k, v ?? ""));
if (file) fd.set("file", file);
await fetch("/api/linac/incidents", { method: "POST", body: fd });
setForm({}); setFile(null);
load();
} finally { setSaving(false); }
}
async function toggleStatus(id: number, status: string) {
await fetch("/api/linac/incidents", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id, status, actorEmail }),
});
load();
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Registrar incidente</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<input className={inputCls} placeholder="Evento" value={form.event || ""} onChange={(e) => set("event", e.target.value)} />
<input type="date" className={inputCls} value={form.incidentDate || ""} onChange={(e) => set("incidentDate", e.target.value)} />
<input type="time" className={inputCls} value={form.incidentTime || ""} onChange={(e) => set("incidentTime", e.target.value)} />
<input type="number" className={inputCls} placeholder="Dosis" value={form.dose || ""} onChange={(e) => set("dose", e.target.value)} />
<input className={inputCls} placeholder="Nivel INES" value={form.inesLevel || ""} onChange={(e) => set("inesLevel", e.target.value)} />
<input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
</div>
<textarea className={inputCls + " mt-2"} placeholder="Descripcion" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
<input className={inputCls} placeholder="Causa" value={form.cause || ""} onChange={(e) => set("cause", e.target.value)} />
<input className={inputCls} placeholder="Consecuencia" value={form.consequence || ""} onChange={(e) => set("consequence", e.target.value)} />
<input className={inputCls} placeholder="Investigacion" value={form.investigation || ""} onChange={(e) => set("investigation", e.target.value)} />
</div>
<input className={inputCls + " mt-2"} placeholder="Acciones correctivas" value={form.correctiveActions || ""} onChange={(e) => set("correctiveActions", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar incidente"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Evento</th><th className="p-1">INES</th>
<th className="p-1">Estado</th><th className="p-1">Archivo</th><th className="p-1">Accion</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.incident_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.event}</td>
<td className="p-1 text-foreground">{r.ines_level || "-"}</td>
<td className={"p-1 font-medium " + (r.status === "abierto" ? "text-danger" : "text-success")}>{r.status}</td>
<td className="p-1">
{r.blob_url && (
<div className="flex gap-1">
<a href={"/api/linac/download?table=incidents&id=" + r.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Eye className="h-3 w-3" /></a>
<a href={"/api/linac/download?table=incidents&id=" + r.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Download className="h-3 w-3" /></a>
</div>
)}
</td>
<td className="p-1">
<button
onClick={() => toggleStatus(r.id, r.status === "abierto" ? "cerrado" : "abierto")}
className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"
>
{r.status === "abierto" ? "Cerrar" : "Reabrir"}
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function RisksTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({});
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/records?type=risk&linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.risk) return;
setSaving(true);
try {
await fetch("/api/linac/records", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "risk", linacId: unitId, actorEmail, ...form }),
});
setForm({});
load();
} finally { setSaving(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Matriz de riesgos</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
<input className={inputCls} placeholder="Riesgo / Evento" value={form.risk || ""} onChange={(e) => set("risk", e.target.value)} />
<input type="number" min="1" max="5" className={inputCls} placeholder="Probabilidad (1-5)" value={form.frequency || ""} onChange={(e) => set("frequency", e.target.value)} />
<input type="number" min="1" max="5" className={inputCls} placeholder="Impacto (1-5)" value={form.consequence || ""} onChange={(e) => set("consequence", e.target.value)} />
<input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
  <input className={inputCls} placeholder="Evidencia" value={form.evidence || ""} onChange={(e) => set("evidence", e.target.value)} />
  <input className={inputCls} placeholder="Controles existentes" value={form.controls || ""} onChange={(e) => set("controls", e.target.value)} />
<input className={inputCls + " sm:col-span-2 lg:col-span-2"} placeholder="Acciones correctivas" value={form.mitigation || ""} onChange={(e) => set("mitigation", e.target.value)} />
</div>
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Agregar riesgo"}
</button>
</div>
  <RiskMatrixGrid list={list} />
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Riesgo</th><th className="p-1">Probabilidad</th><th className="p-1">Impacto</th>
<th className="p-1">Nivel</th><th className="p-1">Clasificacion</th><th className="p-1">Responsable</th><th className="p-1">Evidencia</th><th className="p-1">Controles</th><th className="p-1">Acciones correctivas</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{r.risk}</td>
<td className="p-1 text-foreground">{r.frequency}</td>
<td className="p-1 text-foreground">{r.consequence}</td>
<td className={"p-1 font-medium " + (r.risk_level > 15 ? "text-danger" : r.risk_level > 9 ? "text-orange-500" : r.risk_level > 4 ? "text-warning" : "text-success")}>{r.risk_level ?? "-"}</td><td className={"p-1 font-medium " + (r.risk_level > 15 ? "text-danger" : r.risk_level > 9 ? "text-orange-500" : r.risk_level > 4 ? "text-warning" : "text-success")}>{r.classification || "-"}</td>
<td className="p-1 text-foreground">{r.responsible || "-"}</td>
  <td className="p-1 text-foreground">{r.evidence || "-"}</td><td className="p-1 text-foreground">{r.controls || "-"}</td>
<td className="p-1 text-foreground">{r.mitigation || "-"}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function RiskMatrixGrid({ list }: any) {const PROBS = [5,4,3,2,1];const IMPACTS = [1,2,3,4,5];function cellCls(level: number) {if (level <= 4) return "bg-success/70";if (level <= 9) return "bg-warning/70";if (level <= 15) return "bg-orange-500/70";return "bg-danger/70";}return (<div className="rounded-lg border border-border bg-surface p-3"><p className="mb-2 text-sm font-semibold text-foreground">Mapa de riesgo (Probabilidad x Impacto)</p><table className="w-full text-xs"><thead><tr><th className="p-1 text-muted-foreground">P / I</th>{IMPACTS.map((i) => (<th key={i} className="p-1 text-center text-muted-foreground">{i}</th>))}</tr></thead><tbody>{PROBS.map((p) => (<tr key={p}><td className="p-1 font-medium text-muted-foreground">{p}</td>{IMPACTS.map((i) => {const level = p * i;const count = (list || []).filter((r: any) => Number(r.frequency) === p && Number(r.consequence) === i).length;return (<td key={p + "-" + i} className={"p-2 text-center text-white " + cellCls(level)}>{count > 0 ? count : ""}</td>);})}</tr>))}</tbody></table><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/70" /> Bajo (1-4)</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-warning/70" /> Moderado (5-9)</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-500/70" /> Alto (10-15)</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-danger/70" /> Muy alto (16-25)</span></div></div>);}
  function EmergenciesTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({});
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/records?type=emergency&linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.eventDate) return;
setSaving(true);
try {
await fetch("/api/linac/records", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "emergency", linacId: unitId, actorEmail, ...form }),
});
setForm({});
load();
} finally { setSaving(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Simulacros e incidentes de emergencia</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
<select className={inputCls} value={form.emergencyType || ""} onChange={(e) => set("emergencyType", e.target.value)}>
<option value="">Tipo</option>
<option value="simulacro">Simulacro</option>
<option value="incidente">Incidente</option>
</select>
<input type="date" className={inputCls} value={form.eventDate || ""} onChange={(e) => set("eventDate", e.target.value)} />
<input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
</div>
<input className={inputCls + " mt-2"} placeholder="Descripcion" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Tipo</th><th className="p-1">Descripcion</th><th className="p-1">Responsable</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.event_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.emergency_type || "-"}</td>
<td className="p-1 text-foreground">{r.description || "-"}</td>
<td className="p-1 text-foreground">{r.responsible || "-"}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function AuditsTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({ status: "abierta" });
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/records?type=audit&linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.auditDate) return;
setSaving(true);
try {
await fetch("/api/linac/records", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "audit", linacId: unitId, actorEmail, ...form }),
});
setForm({ status: "abierta" });
load();
} finally { setSaving(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Auditorias e inspecciones</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
<select className={inputCls} value={form.auditType || ""} onChange={(e) => set("auditType", e.target.value)}>
<option value="">Tipo</option>
{AUDIT_TYPES.map((t: any) => (<option key={t} value={t}>{t}</option>))}
</select>
<input type="date" className={inputCls} value={form.auditDate || ""} onChange={(e) => set("auditDate", e.target.value)} />
<input className={inputCls} placeholder="Hallazgos" value={form.findings || ""} onChange={(e) => set("findings", e.target.value)} />
<input className={inputCls} placeholder="No conformidades" value={form.nonconformities || ""} onChange={(e) => set("nonconformities", e.target.value)} />
<input className={inputCls} placeholder="Acciones" value={form.actions || ""} onChange={(e) => set("actions", e.target.value)} />
</div>
<input className={inputCls + " mt-2"} placeholder="Seguimiento" value={form.followUp || ""} onChange={(e) => set("followUp", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar auditoria"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Tipo</th><th className="p-1">Hallazgos</th>
<th className="p-1">No conformidades</th><th className="p-1">Estado</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.audit_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.audit_type || "-"}</td>
<td className="p-1 text-foreground">{r.findings || "-"}</td>
<td className="p-1 text-foreground">{r.nonconformities || "-"}</td>
<td className="p-1 text-foreground">{r.status}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function DocumentsTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [q, setQ] = useState("");
const [title, setTitle] = useState("");
const [category, setCategory] = useState("general");
const [file, setFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/documents?linacId=" + unitId + "&q=" + encodeURIComponent(q));
const data = await res.json();
if (data.ok) setList(data.documents);
}, [unitId, q]);
useEffect(() => { load(); }, [load]);
async function handleUpload() {
if (!title || !file) return;
setUploading(true);
try {
const fd = new FormData();
fd.set("linacId", String(unitId));
fd.set("title", title);
fd.set("category", category);
fd.set("uploadedBy", actorEmail || "");
fd.set("file", file);
await fetch("/api/linac/documents", { method: "POST", body: fd });
setTitle(""); setFile(null);
load();
} finally { setUploading(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Cargar documento</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
<input className={inputCls} placeholder="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} />
<input className={inputCls} placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
<input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
<button onClick={handleUpload} disabled={uploading} className="flex items-center justify-center gap-1 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
<Upload className="h-3.5 w-3.5" /> {uploading ? "Subiendo..." : "Cargar"}
</button>
</div>
</div>
<input className={inputCls} placeholder="Buscar por titulo, categoria o archivo..." value={q} onChange={(e) => setQ(e.target.value)} />
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Titulo</th><th className="p-1">Categoria</th><th className="p-1">Version</th>
<th className="p-1">Fecha</th><th className="p-1">Archivo</th>
</tr></thead>
<tbody>
{list.map((d: any) => (
<tr key={d.id} className="border-t border-border">
<td className="p-1 text-foreground">{d.title}</td>
<td className="p-1 text-foreground">{d.category}</td>
<td className="p-1 text-foreground">v{d.version}</td>
<td className="p-1 text-foreground">{String(d.uploaded_at).slice(0, 10)}</td>
<td className="p-1">
<div className="flex gap-1">
<a href={"/api/linac/download?table=documents&id=" + d.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Eye className="h-3 w-3" /></a>
<a href={"/api/linac/download?table=documents&id=" + d.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Download className="h-3 w-3" /></a>
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function HistoryTab() {
const [history, setHistory] = useState<any[]>([]);
useEffect(() => {
fetch("/api/linac/history").then((r) => r.json()).then((data) => {
if (data.ok) setHistory(data.history);
});
}, []);
return (
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Historial de acciones</p>
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Usuario</th><th className="p-1">Accion</th><th className="p-1">Detalle</th>
</tr></thead>
<tbody>
{history.map((h: any) => (
<tr key={h.id} className="border-t border-border">
<td className="p-1 text-foreground">{new Date(h.created_at).toLocaleString()}</td>
<td className="p-1 text-foreground">{h.actor_email || "-"}</td>
<td className="p-1 text-foreground">{h.action}</td>
<td className="p-1 text-muted-foreground">{JSON.stringify(h.details)}</td>
</tr>
))}
</tbody>
</table>
</div>
);
}
