"use client";

import * as React from "react";
import {
  Activity,
      AlertTriangle,
      ShieldCheck,
      ClipboardCheck,
      FileText,
      CalendarClock,
      History,
      Gauge,
      Settings2,
      FileSpreadsheet,
      FileDown,
      ChevronRight,
    } from "lucide-react";
import {
  Card,
      CardHeader,
      CardTitle,
      CardContent,
      KpiCard,
      Badge,
      StatusBadge,
      SemaphoreDot,
      Modal,
      Button,
      Alert,
      EmptyState,
      LineChartCard,
      DonutChartCard,
      GaugeChartCard,
    } from "@/components/ui";
import { SEMAPHORE } from "@/lib/design-system";
  import type { SemaphoreLevel } from "@/lib/design-system";

const ZONES: { key: string; label: string }[] = [
  { key: "estadoGeneral", label: "1. Estado General" },
  { key: "alertas", label: "2. Alertas Criticas" },
{ key: "kpis", label: "3. Indicadores Operacionales" },
{ key: "proteccion", label: "4. Proteccion Radiologica" },
{ key: "calidad", label: "5. Control de Calidad" },
{ key: "documental", label: "6. Gestion Documental" },
{ key: "calendario", label: "7. Calendario Inteligente" },
{ key: "actividad", label: "8. Actividad Reciente" },
{ key: "ejecutivo", label: "9. Panel Ejecutivo" },
  ];

const STORAGE_KEY = "rpms-sigr-centro-operaciones-zones";

function levelOrUnknown(level?: string | null): SemaphoreLevel {
  const valid = ["ok", "warning", "urgent", "critical", "unknown", "disabled"];
return (valid.includes(level as string) ? level : "unknown") as SemaphoreLevel;
}

function LevelPill({ level, text }: { level?: string | null; text: string }) {
const lv = levelOrUnknown(level);
const cfg = SEMAPHORE[lv];
return (
<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
<span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
{text}
</span>
);
}

function pctLevel(p: number | null | undefined): SemaphoreLevel {
if (p === null || p === undefined) return "unknown";
if (p >= 90) return "ok";
if (p >= 70) return "warning";
if (p >= 40) return "urgent";
return "critical";
}

function fmtPct(p: number | null | undefined): string {
return p === null || p === undefined ? "S/D" : `${p}%`;
}

function alertTone(level: string): "info" | "success" | "warning" | "danger" {
if (level === "critical") return "danger";
if (level === "urgent" || level === "warning") return "warning";
return "info";
}

export function CentroOperaciones({ dashboard, facilityName }: { dashboard: any; facilityName?: string }) {
const [auditorOpen, setAuditorOpen] = React.useState(false);
const [settingsOpen, setSettingsOpen] = React.useState(false);
const [visibleZones, setVisibleZones] = React.useState<Record<string, boolean>>({});

React.useEffect(() => {
try {
const raw = window.localStorage.getItem(STORAGE_KEY);
if (raw) setVisibleZones(JSON.parse(raw));
} catch {}
}, []);

const isVisible = (key: string) => visibleZones[key] !== false;

function toggleZone(key: string) {
setVisibleZones((prev) => {
const next = { ...prev, [key]: !isVisible(key) };
try {
window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
} catch {}
return next;
});
}

async function exportExcel() {
const XLSX: any = await import("xlsx");
const rows = [
{ indicador: "Disponibilidad %", valor: dashboard?.kpis?.availabilityPct ?? "S/D" },
{ indicador: "MTBF (h)", valor: dashboard?.kpis?.mtbfHours ?? "S/D" },
{ indicador: "MTTR (h)", valor: dashboard?.kpis?.mttrHours ?? "S/D" },
{ indicador: "Fallas 30d", valor: dashboard?.kpis?.fallas30d ?? 0 },
{ indicador: "QC ejecutados 90d", valor: dashboard?.kpis?.qcEjecutados90d ?? 0 },
{ indicador: "QC no conformes 90d", valor: dashboard?.kpis?.qcNoCumple90d ?? 0 },
{ indicador: "Mantenimientos 90d", valor: dashboard?.kpis?.mantenimientos90d ?? 0 },
{ indicador: "Cumplimiento documental %", valor: dashboard?.kpis?.cumplimientoDocumental ?? "S/D" },
{ indicador: "Cumplimiento capacitacion %", valor: dashboard?.kpis?.cumplimientoCapacitacion ?? "S/D" },
{ indicador: "Cumplimiento auditorias %", valor: dashboard?.kpis?.cumplimientoAuditorias ?? "S/D" },
{ indicador: "Cumplimiento autorizaciones %", valor: dashboard?.kpis?.cumplimientoAutorizaciones ?? "S/D" },
{ indicador: "Cumplimiento general %", valor: dashboard?.panelEjecutivo?.cumplimientoGeneral ?? "S/D" },
{ indicador: "Indicador global %", valor: dashboard?.panelEjecutivo?.indicadorGlobal ?? "S/D" },
  ];
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Resumen Ejecutivo");
XLSX.writeFile(wb, "sigr-centro-operaciones.xlsx");
}

async function exportPdf() {
const jsPDFMod: any = await import("jspdf");
const jsPDF = jsPDFMod.default || jsPDFMod.jsPDF;
const autoTableMod: any = await import("jspdf-autotable");
const autoTable = autoTableMod.default || autoTableMod;
const doc = new jsPDF();
doc.setFontSize(14);
doc.text(`Centro de Operaciones - ${facilityName || "Servicio de Radioterapia"}`, 14, 16);
doc.setFontSize(9);
doc.text(`Generado: ${new Date().toLocaleString("es-CL")}`, 14, 22);
autoTable(doc, {
startY: 28,
  head: [["Indicador", "Valor"]],
  body: [
  ["Disponibilidad", fmtPct(dashboard?.kpis?.availabilityPct)],
  ["Cumplimiento general", fmtPct(dashboard?.panelEjecutivo?.cumplimientoGeneral)],
  ["Indicador global", fmtPct(dashboard?.panelEjecutivo?.indicadorGlobal)],
  ["Nivel de riesgo", dashboard?.panelEjecutivo?.nivelRiesgo ?? "S/D"],
  ["Alertas criticas activas", String((dashboard?.alertasCriticas || []).length)],
  ],
  });
doc.save("sigr-centro-operaciones.pdf");
}

if (!dashboard) {
return <EmptyState title="Sin datos" description="Seleccione una instalacion para ver el Centro de Operaciones." />;
}

const alerts: any[] = dashboard.alertasCriticas || [];
const linacs: any[] = dashboard.estadoGeneral?.linacs || [];
const controlCalidad: any[] = dashboard.controlCalidad || [];
const docsByCategory: any[] = dashboard.gestionDocumental?.documentsByCategory || [];
const authsExpiring: any[] = dashboard.gestionDocumental?.authorizationsExpiring || [];
const calendario: any[] = dashboard.calendario || [];
const actividad: any[] = dashboard.actividadReciente || [];
const surveys: any[] = dashboard.proteccionRadiologica?.recentSurveys || [];
const modoAuditor: any[] = dashboard.modoAuditor || [];
const tendencias: any = dashboard.tendencias || {};

const surveyChartData = surveys
.slice()
.reverse()
.map((s: any) => ({
fecha: String(s.survey_date).slice(0, 10),
dosis: Number(s.dose_rate ?? s.value ?? 0),
}));

return (
<div className="space-y-6">
<div className="flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<LevelPill
level={dashboard.estadoGeneral?.servicioLevel}
text={`Servicio: ${SEMAPHORE[levelOrUnknown(dashboard.estadoGeneral?.servicioLevel)].label}`}
/>
{tendencias.incidentsTrendUp ? <Badge tone="danger">Incidentes en alza (30d)</Badge> : null}
{tendencias.availabilityTrendDown ? <Badge tone="warning">Disponibilidad en baja</Badge> : null}
</div>
<div className="flex flex-wrap items-center gap-2">
<Button variant="outline" size="sm" icon={<Settings2 className="h-4 w-4" />} onClick={() => setSettingsOpen(true)}>
Personalizar
</Button>
<Button variant="outline" size="sm" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setAuditorOpen(true)}>
Modo Auditor
</Button>
<Button variant="secondary" size="sm" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportExcel}>
Excel
</Button>
<Button variant="secondary" size="sm" icon={<FileDown className="h-4 w-4" />} onClick={exportPdf}>
PDF
</Button>
</div>
</div>

{isVisible("estadoGeneral") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<Activity className="h-4 w-4" />
1. Estado General
</CardTitle>
</CardHeader>
<CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
<KpiCard
label="Disponibilidad"
value={fmtPct(dashboard.estadoGeneral?.availabilityPct)}
level={pctLevel(dashboard.estadoGeneral?.availabilityPct)}
icon={<Gauge className="h-5 w-5" />}
/>
<KpiCard label="Horas operativas (30d)" value={dashboard.estadoGeneral?.operatingHours30d ?? 0} />
<KpiCard label="Horas fuera de servicio (30d)" value={dashboard.estadoGeneral?.downtimeHours30d ?? 0} />
<KpiCard label="Pacientes tratados (30d)" value={dashboard.estadoGeneral?.patients30d ?? 0} />
<KpiCard label="Aceleradores vinculados" value={linacs.length} />
<div className="sm:col-span-2 lg:col-span-5 flex flex-wrap gap-2">
{linacs.length === 0 ? (
<EmptyState
title="Sin acelerador vinculado"
description="Vincule un bunker a un acelerador lineal (modulo Acelerador Lineal) para integrar su operacion, QC y mantenimiento en este Centro de Operaciones."
/>
) : (
linacs.map((l: any) => <StatusBadge key={l.id} status={l.operationalStatus} />)
)}
</div>
</CardContent>
</Card>
)}

{isVisible("alertas") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<AlertTriangle className="h-4 w-4" />
2. Alertas Criticas ({alerts.length})
</CardTitle>
</CardHeader>
<CardContent className="space-y-2">
{alerts.length === 0 ? (
<Alert tone="success" title="Sin alertas criticas activas">
El servicio no registra alertas prioritarias en este momento.
</Alert>
) : (
alerts.map((a: any, i: number) => (
<Alert key={i} tone={alertTone(a.level)} title={a.message}>
Modulo: {a.module}
</Alert>
))
)}
</CardContent>
</Card>
)}

{isVisible("kpis") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<Gauge className="h-4 w-4" />
3. Indicadores Operacionales
</CardTitle>
</CardHeader>
<CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
<KpiCard label="MTBF" value={dashboard.kpis?.mtbfHours != null ? `${dashboard.kpis.mtbfHours} h` : "S/D"} />
<KpiCard label="MTTR" value={dashboard.kpis?.mttrHours != null ? `${dashboard.kpis.mttrHours} h` : "S/D"} />
<KpiCard label="Fallas (30d)" value={dashboard.kpis?.fallas30d ?? 0} />
<KpiCard label="QC ejecutados (90d)" value={dashboard.kpis?.qcEjecutados90d ?? 0} />
<KpiCard
label="QC no conformes (90d)"
value={dashboard.kpis?.qcNoCumple90d ?? 0}
level={dashboard.kpis?.qcNoCumple90d > 0 ? "warning" : "ok"}
/>
<KpiCard label="Mantenimientos (90d)" value={dashboard.kpis?.mantenimientos90d ?? 0} />
<KpiCard
label="Cumplimiento documental"
value={fmtPct(dashboard.kpis?.cumplimientoDocumental)}
level={pctLevel(dashboard.kpis?.cumplimientoDocumental)}
/>
<KpiCard
label="Cumplimiento capacitacion"
value={fmtPct(dashboard.kpis?.cumplimientoCapacitacion)}
level={pctLevel(dashboard.kpis?.cumplimientoCapacitacion)}
/>
<KpiCard
label="Cumplimiento auditorias"
value={fmtPct(dashboard.kpis?.cumplimientoAuditorias)}
level={pctLevel(dashboard.kpis?.cumplimientoAuditorias)}
/>
<KpiCard
label="Cumplimiento autorizaciones"
value={fmtPct(dashboard.kpis?.cumplimientoAutorizaciones)}
level={pctLevel(dashboard.kpis?.cumplimientoAutorizaciones)}
/>
</CardContent>
</Card>
)}

{isVisible("proteccion") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<ShieldCheck className="h-4 w-4" />
4. Proteccion Radiologica
</CardTitle>
</CardHeader>
<CardContent className="space-y-4">
<div className="grid gap-4 sm:grid-cols-3">
<KpiCard
label="Ultimo levantamiento"
value={dashboard.proteccionRadiologica?.lastSurvey ? String(dashboard.proteccionRadiologica.lastSurvey.survey_date).slice(0, 10) : "S/D"}
/>
<KpiCard
label="Incidentes radiologicos graves"
value={dashboard.proteccionRadiologica?.incidentesRadiologicos ?? 0}
level={dashboard.proteccionRadiologica?.incidentesRadiologicos > 0 ? "critical" : "ok"}
/>
<KpiCard label="Dispositivos operativos" value={`${dashboard.kpis?.devicesOperational ?? 0} / ${dashboard.kpis?.devicesTotal ?? 0}`} />
</div>
{surveyChartData.length > 0 ? (
<LineChartCard data={surveyChartData} xKey="fecha" yKeys={["dosis"]} height={220} />
) : (
<EmptyState title="Sin levantamientos registrados" description="Registre levantamientos radiometricos en el modulo de Seguridad Radiologica." />
)}
</CardContent>
</Card>
)}

{isVisible("calidad") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<ClipboardCheck className="h-4 w-4" />
5. Control de Calidad
</CardTitle>
</CardHeader>
<CardContent>
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead>
<tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
<th className="py-2 pr-4">Periodicidad</th>
<th className="py-2 pr-4">Ultimo resultado</th>
<th className="py-2 pr-4">Ultima fecha</th>
<th className="py-2 pr-4">Proximo QC</th>
<th className="py-2 pr-4">Estado</th>
</tr>
</thead>
<tbody>
{controlCalidad.map((c: any) => (
<tr key={c.periodicity} className="border-b border-border/50">
<td className="py-2 pr-4 font-medium">{c.label}</td>
<td className="py-2 pr-4">{c.lastStatus ?? "S/D"}</td>
<td className="py-2 pr-4">{c.lastDate ? String(c.lastDate).slice(0, 10) : "S/D"}</td>
<td className="py-2 pr-4">{c.nextDue ?? "S/D"}</td>
<td className="py-2 pr-4">
<LevelPill level={c.level} text={SEMAPHORE[levelOrUnknown(c.level)].label} />
</td>
</tr>
))}
</tbody>
</table>
</div>
</CardContent>
</Card>
)}

{isVisible("documental") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<FileText className="h-4 w-4" />
6. Gestion Documental
</CardTitle>
</CardHeader>
<CardContent className="grid gap-4 lg:grid-cols-2">
{docsByCategory.length > 0 ? (
<DonutChartCard data={docsByCategory} dataKey="count" nameKey="category" height={220} />
) : (
<EmptyState title="Sin documentos registrados" />
)}
<div className="space-y-2">
<p className="text-xs font-medium uppercase text-muted-foreground">Autorizaciones por vencer</p>
{authsExpiring.length === 0 ? (
<p className="text-sm text-muted-foreground">Sin autorizaciones proximas a vencer.</p>
) : (
authsExpiring.slice(0, 8).map((a: any, i: number) => (
<div key={i} className="flex items-center justify-between text-sm">
<span>{a.doc_type}</span>
<LevelPill
level={
a.daysRemaining == null
? "unknown"
: a.daysRemaining < 0
? "critical"
: a.daysRemaining <= 15
? "urgent"
: a.daysRemaining <= 30
? "warning"
: "ok"
}
text={a.daysRemaining != null ? `${a.daysRemaining} dias` : "S/D"}
/>
</div>
))
)}
</div>
</CardContent>
</Card>
)}

{isVisible("calendario") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<CalendarClock className="h-4 w-4" />
7. Calendario Inteligente
</CardTitle>
</CardHeader>
<CardContent className="space-y-2">
{calendario.length === 0 ? (
<EmptyState title="Sin eventos proximos" />
) : (
calendario.map((e: any, i: number) => (
<div key={i} className="flex items-center gap-3 text-sm">
<SemaphoreDot level={levelOrUnknown(e.level)} />
<span className="w-24 shrink-0 text-muted-foreground">{String(e.date).slice(0, 10)}</span>
<span>{e.label}</span>
</div>
))
)}
</CardContent>
</Card>
)}

{isVisible("actividad") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<History className="h-4 w-4" />
8. Actividad Reciente
</CardTitle>
</CardHeader>
<CardContent className="space-y-2">
{actividad.length === 0 ? (
<EmptyState title="Sin actividad reciente" />
) : (
actividad.map((e: any, i: number) => (
<div key={i} className="flex flex-wrap items-center gap-2 text-sm">
<span className="text-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleString("es-CL") : ""}</span>
<ChevronRight className="h-3 w-3 text-muted-foreground" />
<span className="font-medium">{e.actor_email || "sistema"}</span>
<span>{e.action}</span>
</div>
))
)}
</CardContent>
</Card>
)}

{isVisible("ejecutivo") && (
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<Gauge className="h-4 w-4" />
9. Panel Ejecutivo
</CardTitle>
</CardHeader>
<CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
<KpiCard
label="Cumplimiento general"
value={fmtPct(dashboard.panelEjecutivo?.cumplimientoGeneral)}
level={pctLevel(dashboard.panelEjecutivo?.cumplimientoGeneral)}
/>
<KpiCard
label="Nivel de riesgo"
value={SEMAPHORE[levelOrUnknown(dashboard.panelEjecutivo?.nivelRiesgo)].label}
level={levelOrUnknown(dashboard.panelEjecutivo?.nivelRiesgo)}
/>
<KpiCard
label="Indice de calidad"
value={fmtPct(dashboard.panelEjecutivo?.indiceCalidad)}
level={pctLevel(dashboard.panelEjecutivo?.indiceCalidad)}
/>
<KpiCard
label="Indice de seguridad"
value={fmtPct(dashboard.panelEjecutivo?.indiceSeguridad)}
level={pctLevel(dashboard.panelEjecutivo?.indiceSeguridad)}
/>
<KpiCard
label="Cumplimiento normativo"
value={fmtPct(dashboard.panelEjecutivo?.cumplimientoNormativo)}
level={pctLevel(dashboard.panelEjecutivo?.cumplimientoNormativo)}
/>
<KpiCard
label="Preparacion para auditoria"
value={fmtPct(dashboard.panelEjecutivo?.preparacionAuditoria)}
level={pctLevel(dashboard.panelEjecutivo?.preparacionAuditoria)}
/>
<div className="sm:col-span-2 lg:col-span-2">
<GaugeChartCard value={dashboard.panelEjecutivo?.indicadorGlobal ?? 0} label={fmtPct(dashboard.panelEjecutivo?.indicadorGlobal)} />
</div>
</CardContent>
</Card>
)}

<Modal open={auditorOpen} onClose={() => setAuditorOpen(false)} title="Modo Auditor - Cumplimiento normativo" size="lg">
<div className="space-y-2">
{modoAuditor.map((f: any) => (
<div key={f.key} className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
<span className="font-medium">{f.label}</span>
<LevelPill level={f.level} text={f.pct != null ? `${f.pct}% (${f.evidenceCount} registros)` : "Sin evidencia registrada"} />
</div>
))}
</div>
</Modal>

<Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Personalizar Dashboard" size="sm">
<div className="space-y-2">
{ZONES.map((z) => (
<label key={z.key} className="flex items-center gap-2 text-sm">
<input type="checkbox" checked={isVisible(z.key)} onChange={() => toggleZone(z.key)} />
{z.label}
</label>
))}
</div>
</Modal>
</div>
);
}
