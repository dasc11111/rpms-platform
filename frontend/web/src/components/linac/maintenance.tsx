"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Download, AlertTriangle, CheckCircle2, FileDown, Bell } from "lucide-react";

const MAINTENANCE_TYPES: { value: string; label: string }[] = [
{ value: "preventivo", label: "Preventivo" },
{ value: "correctivo", label: "Correctivo" },
{ value: "predictivo", label: "Predictivo" },
];

const MAINTENANCE_RESULTS = ["exitoso", "parcial", "fallido"];
const MAINTENANCE_STATUSES = ["completado", "pendiente", "en_proceso"];

const SEMAPHORE_COLORS: Record<string, string> = {
verde: "text-success",
amarillo: "text-warning",
rojo: "text-danger",
};
const SEMAPHORE_DOT: Record<string, string> = {
verde: "bg-success",
amarillo: "bg-warning",
rojo: "bg-danger",
};

function exportCsv(rows: any[], filename: string) {
if (!rows.length) return;
const headers = Object.keys(rows[0]);
const lines = [headers.join(",")].concat(
rows.map((r: any) => headers.map((h: string) => JSON.stringify(r[h] ?? "")).join(","))
);
const blob = new Blob([lines.join("\n")], { type: "text/csv" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
}

function KpiBox({ label, value }: any) {
return (
<div className="rounded-lg border border-border bg-surface p-3">
<p className="text-xs text-muted-foreground">{label}</p>
<p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
</div>
);
}

export function MaintenanceTab({ unitId, actorEmail }: any) {
const [maintenanceType, setMaintenanceType] = useState("preventivo");
const [list, setList] = useState<any[]>([]);
const [alerts, setAlerts] = useState<any[]>([]);
const [workers, setWorkers] = useState<any[]>([]);
const [dashboard, setDashboard] = useState<any>(null);
const [form, setForm] = useState<any>({ status: "completado" });
const [file, setFile] = useState<File | null>(null);
const [photoFile, setPhotoFile] = useState<File | null>(null);
const [documentFile, setDocumentFile] = useState<File | null>(null);
const [saving, setSaving] = useState(false);
const [lastResult, setLastResult] = useState<any>(null);

const load = useCallback(async () => {
const res = await fetch("/api/linac/maintenance?linacId=" + unitId + "&maintenanceType=" + maintenanceType);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId, maintenanceType]);

const loadAlerts = useCallback(async () => {
const res = await fetch("/api/linac/maintenance/alerts?linacId=" + unitId + "&status=abierta");
const data = await res.json();
if (data.ok) setAlerts(data.alerts);
}, [unitId]);

const loadWorkers = useCallback(async () => {
const res = await fetch("/api/workers");
const data = await res.json();
if (data.workers) setWorkers(data.workers);
}, []);

const loadDashboard = useCallback(async () => {
const res = await fetch("/api/linac/dashboard");
const data = await res.json();
if (data.ok) setDashboard(data);
}, []);

useEffect(() => { load(); }, [load]);
useEffect(() => { loadAlerts(); }, [loadAlerts]);
useEffect(() => { loadWorkers(); loadDashboard(); }, [loadWorkers, loadDashboard]);

function set(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); }

async function handleSave() {
if (!form.maintenanceDate) return;
setSaving(true);
try {
const fd = new FormData();
fd.set("linacId", String(unitId));
fd.set("maintenanceType", maintenanceType);
fd.set("actorEmail", actorEmail || "");
Object.entries(form).forEach(([k, v]: [string, any]) => fd.set(k, v ?? ""));
if (file) fd.set("file", file);
if (photoFile) fd.set("photoFile", photoFile);
if (documentFile) fd.set("documentFile", documentFile);
const res = await fetch("/api/linac/maintenance", { method: "POST", body: fd });
const data = await res.json();
if (data.ok) setLastResult(data);
setForm({ status: "completado" }); setFile(null); setPhotoFile(null); setDocumentFile(null);
load();
loadAlerts();
loadDashboard();
} finally {
setSaving(false);
}
}

async function resolveAlert(id: number) {
await fetch("/api/linac/maintenance/alerts", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id, status: "resuelta", actorEmail }),
});
loadAlerts();
}

function selectEngineer(rut: string) {
const w = workers.find((x: any) => x.rut === rut);
set("engineerRut", rut);
set("engineer", w ? w.name : "");
}

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const typeLabel = (MAINTENANCE_TYPES.find((t) => t.value === maintenanceType) || { label: maintenanceType }).label;
const k = dashboard?.kpis || {};

return (
<div className="space-y-4">
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
<KpiBox label="Disponibilidad" value={(k.maintenanceAvailability ?? k.availability ?? "-") + "%"} />
<KpiBox label="MTBF (horas)" value={k.mtbf ?? "-"} />
<KpiBox label="MTTR (horas)" value={k.mttr ?? "-"} />
<KpiBox label="Alertas abiertas" value={k.maintenanceAlertsOpen ?? 0} />
</div>

{alerts.length > 0 && (
<div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
<p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
<Bell className="h-4 w-4" /> Alertas de Mantenimiento abiertas ({alerts.length})
</p>
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Tipo</th>
<th className="p-1">Semaforo</th><th className="p-1">Mensaje</th><th className="p-1">Accion</th>
</tr></thead>
<tbody>
{alerts.map((a: any) => (
<tr key={a.id} className="border-t border-border">
<td className="p-1 text-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
<td className="p-1 text-foreground capitalize">{a.maintenance_type}</td>
<td className={"p-1 font-medium " + (SEMAPHORE_COLORS[a.semaphore] || "text-foreground")}>{a.semaphore}</td>
<td className="p-1 text-muted-foreground">{a.message}</td>
<td className="p-1">
<button onClick={() => resolveAlert(a.id)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">
Resolver
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}

<div className="flex flex-wrap gap-1">
{MAINTENANCE_TYPES.map((t) => (
<button
key={t.value}
onClick={() => setMaintenanceType(t.value)}
className={
"rounded px-2 py-1 text-xs " +
(maintenanceType === t.value ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")
}
>
{t.label}
</button>
))}
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Registrar mantenimiento: {typeLabel}</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<input type="date" className={inputCls} value={form.maintenanceDate || ""} onChange={(e) => set("maintenanceDate", e.target.value)} />
<input type="time" className={inputCls} value={form.maintenanceTime || ""} onChange={(e) => set("maintenanceTime", e.target.value)} />
<input className={inputCls} placeholder="Empresa" value={form.company || ""} onChange={(e) => set("company", e.target.value)} />
<select className={inputCls} value={form.engineerRut || ""} onChange={(e) => selectEngineer(e.target.value)}>
<option value="">Ingeniero / Tecnico...</option>
{workers.map((w: any) => (<option key={w.rut} value={w.rut}>{w.name}</option>))}
</select>
<input className={inputCls} placeholder="Repuestos utilizados" value={form.spareParts || ""} onChange={(e) => set("spareParts", e.target.value)} />
<input type="number" className={inputCls} placeholder="Horas de trabajo" value={form.hours || ""} onChange={(e) => set("hours", e.target.value)} />
<input type="number" className={inputCls} placeholder="Tiempo fuera de servicio (h)" value={form.downtimeHours || ""} onChange={(e) => set("downtimeHours", e.target.value)} />
<input type="number" className={inputCls} placeholder="Costo" value={form.cost || ""} onChange={(e) => set("cost", e.target.value)} />
<select className={inputCls} value={form.result || ""} onChange={(e) => set("result", e.target.value)}>
<option value="">Resultado...</option>
{MAINTENANCE_RESULTS.map((r: string) => (<option key={r} value={r}>{r}</option>))}
</select>
<select className={inputCls} value={form.status || "completado"} onChange={(e) => set("status", e.target.value)}>
{MAINTENANCE_STATUSES.map((s: string) => (<option key={s} value={s}>{s}</option>))}
</select>
<input type="date" className={inputCls} value={form.nextMaintenanceDate || ""} onChange={(e) => set("nextMaintenanceDate", e.target.value)} title="Proximo mantenimiento programado" />
</div>
<input className={inputCls + " mt-2"} placeholder="Observaciones" value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} />
<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
<div>
<label className="text-xs text-muted-foreground">Informe</label>
<input type="file" className="block text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
</div>
<div>
<label className="text-xs text-muted-foreground">Fotografias</label>
<input type="file" className="block text-xs text-foreground" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
</div>
<div>
<label className="text-xs text-muted-foreground">Documentos</label>
<input type="file" className="block text-xs text-foreground" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />
</div>
</div>
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar"}
</button>
{lastResult && (
<p className={"mt-2 flex items-center gap-1.5 text-xs font-medium " + (SEMAPHORE_COLORS[lastResult.semaphore] || "text-foreground")}>
{lastResult.semaphore === "verde" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
Resultado: semaforo {lastResult.semaphore}
</p>
)}
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<div className="mb-2 flex items-center justify-between">
<p className="text-sm font-semibold text-foreground">Registros ({typeLabel})</p>
<button onClick={() => exportCsv(list, "maintenance_" + maintenanceType + ".csv")} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">
<FileDown className="h-3.5 w-3.5" /> Exportar CSV
</button>
</div>
<table className="w-full text-xs">
<thead>
<tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Hora</th><th className="p-1">Empresa</th><th className="p-1">Ingeniero</th>
<th className="p-1">Repuestos</th><th className="p-1">Horas</th><th className="p-1">T. Fuera Serv.</th><th className="p-1">Costo</th>
<th className="p-1">Resultado</th><th className="p-1">Estado</th><th className="p-1">Proximo</th><th className="p-1">Semaforo</th><th className="p-1">Archivos</th>
</tr>
</thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.maintenance_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.maintenance_time || "-"}</td>
<td className="p-1 text-foreground">{r.company || "-"}</td>
<td className="p-1 text-foreground">{r.engineer_name || r.engineer || "-"}</td>
<td className="p-1 text-foreground">{r.spare_parts || "-"}</td>
<td className="p-1 text-foreground">{r.hours || "-"}</td>
<td className="p-1 text-foreground">{r.downtime_hours || "-"}</td>
<td className="p-1 text-foreground">{r.cost || "-"}</td>
<td className="p-1 text-foreground">{r.result || "-"}</td>
<td className="p-1 text-foreground">{r.status}</td>
<td className="p-1 text-foreground">{r.next_maintenance_date ? String(r.next_maintenance_date).slice(0, 10) : "-"}</td>
<td className="p-1">
<span className={"inline-block h-2.5 w-2.5 rounded-full " + (SEMAPHORE_DOT[r.semaphore] || "bg-muted")} title={r.semaphore} />
</td>
<td className="p-1">
<div className="flex gap-1">
{r.blob_url && (
<a href={"/api/linac/download?table=maintenance&id=" + r.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Informe"><Eye className="h-3 w-3" /></a>
)}
{r.photo_blob_url && (
<a href={"/api/linac/download?table=maintenance_photo&id=" + r.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Fotografia"><Eye className="h-3 w-3" /></a>
)}
{r.document_blob_url && (
<a href={"/api/linac/download?table=maintenance_document&id=" + r.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Documento"><Download className="h-3 w-3" /></a>
)}
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
