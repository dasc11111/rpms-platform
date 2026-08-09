"use client";

import { useCallback, useEffect, useState } from "react";
import {
Plus, Upload, Download, Eye, FileText, AlertTriangle, ShieldCheck, Activity,
Wrench, Siren, ClipboardList, FolderOpen, History, LayoutDashboard, Radiation,
ShieldAlert, CalendarClock, Settings2, Lock, Database,
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
</div>

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

function DashboardTab({ dashboard }: any) {
if (!dashboard) return <p className="text-sm text-muted-foreground">Cargando dashboard...</p>;
const k = dashboard.kpis || {};
return (
<div className="space-y-4">
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
<KpiBox label="Disponibilidad" value={k.availability + "%"} />
<KpiBox label="Cumplimiento QC" value={k.qcCompliance + "%"} />
<KpiBox label="Incidentes abiertos" value={k.incidentsOpen} />
<KpiBox label="Documentos" value={k.documentsTotal} />
<KpiBox label="Pacientes tratados" value={k.totalPatients} />
<KpiBox label="Horas de funcionamiento" value={k.totalOperatingHours} />
</div>

<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-xs font-medium text-muted-foreground">Pacientes tratados por mes (12 meses)</p>
<ResponsiveContainer width="100%" height={220}>
<BarChart data={dashboard.monthlyOps || []}>
<CartesianGrid strokeDasharray="3 3" stroke="#333" />
<XAxis dataKey="month" tick={{ fontSize: 10 }} />
<YAxis tick={{ fontSize: 10 }} />
<Tooltip />
<Bar dataKey="patients" fill="#3b82f6" />
</BarChart>
</ResponsiveContainer>
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-xs font-medium text-muted-foreground">Horas operativas vs. tiempo detenido</p>
<ResponsiveContainer width="100%" height={220}>
<LineChart data={dashboard.monthlyOps || []}>
<CartesianGrid strokeDasharray="3 3" stroke="#333" />
<XAxis dataKey="month" tick={{ fontSize: 10 }} />
<YAxis tick={{ fontSize: 10 }} />
<Tooltip />
<Line type="monotone" dataKey="operating_hours" stroke="#22c55e" name="Operativas" />
<Line type="monotone" dataKey="downtime_hours" stroke="#ef4444" name="Detenido" />
</LineChart>
</ResponsiveContainer>
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-xs font-medium text-muted-foreground">Distribucion por tipo de tratamiento</p>
<ResponsiveContainer width="100%" height={220}>
<PieChart>
<Pie data={dashboard.treatmentTypes || []} dataKey="count" nameKey="treatment_type" outerRadius={80} label>
{(dashboard.treatmentTypes || []).map((_: any, i: number) => (
<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
))}
</Pie>
<Tooltip />
</PieChart>
</ResponsiveContainer>
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-xs font-medium text-muted-foreground">Cumplimiento QC por periodicidad</p>
<ResponsiveContainer width="100%" height={220}>
<BarChart data={dashboard.qcStats || []}>
<CartesianGrid strokeDasharray="3 3" stroke="#333" />
<XAxis dataKey="periodicity" tick={{ fontSize: 10 }} />
<YAxis tick={{ fontSize: 10 }} />
<Tooltip />
<Bar dataKey="total" fill="#a855f7" name="Total" />
<Bar dataKey="ok_count" fill="#22c55e" name="Cumple" />
</BarChart>
</ResponsiveContainer>
</div>
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-xs font-medium text-muted-foreground">Autorizaciones vigentes</p>
<table className="w-full text-xs">
<thead>
<tr className="text-left text-muted-foreground">
<th className="p-1">Tipo</th>
<th className="p-1">Vencimiento</th>
<th className="p-1">Estado</th>
</tr>
</thead>
<tbody>
{(dashboard.authorizations || []).map((a: any) => (
<tr key={a.id} className="border-t border-border">
<td className="p-1 text-foreground">{a.doc_type}</td>
<td className="p-1 text-foreground">{a.expiry_date ? String(a.expiry_date).slice(0, 10) : "-"}</td>
<td className={"p-1 font-medium " + (VIGENCY_COLORS[a.vigencyLevel as keyof typeof VIGENCY_COLORS] || "text-foreground")}>{a.vigencyLevel}</td>
</tr>
))}
</tbody>
</table>
</div>
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

function RadiationTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({});
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/records?type=radiation&linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.measurementDate) return;
setSaving(true);
try {
await fetch("/api/linac/records", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "radiation", linacId: unitId, actorEmail, ...form }),
});
setForm({});
load();
} finally { setSaving(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Levantamiento radiometrico / interlocks</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<input type="date" className={inputCls} value={form.measurementDate || ""} onChange={(e) => set("measurementDate", e.target.value)} />
<input type="time" className={inputCls} value={form.measurementTime || ""} onChange={(e) => set("measurementTime", e.target.value)} />
<select className={inputCls} value={form.measurementType || ""} onChange={(e) => set("measurementType", e.target.value)}>
<option value="">Tipo de medicion</option>
{RADIATION_TYPES.map((t: any) => (<option key={t} value={t}>{t}</option>))}
</select>
<input className={inputCls} placeholder="Ubicacion" value={form.location || ""} onChange={(e) => set("location", e.target.value)} />
<input className={inputCls} placeholder="Valor" value={form.value || ""} onChange={(e) => set("value", e.target.value)} />
<input className={inputCls} placeholder="Unidad" value={form.unit || ""} onChange={(e) => set("unit", e.target.value)} />
<input className={inputCls} placeholder="Instrumento utilizado" value={form.instrumentRef || ""} onChange={(e) => set("instrumentRef", e.target.value)} />
<input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
</div>
<input className={inputCls + " mt-2"} placeholder="Notas" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar medicion"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Tipo</th><th className="p-1">Ubicacion</th>
<th className="p-1">Valor</th><th className="p-1">Instrumento</th><th className="p-1">Responsable</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.measurement_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.measurement_type || "-"}</td>
<td className="p-1 text-foreground">{r.location || "-"}</td>
<td className="p-1 text-foreground">{r.value} {r.unit}</td>
<td className="p-1 text-foreground">{r.instrument_ref || "-"}</td>
<td className="p-1 text-foreground">{r.responsible || "-"}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function MaintenanceTab({ unitId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({});
const [file, setFile] = useState<File | null>(null);
const [saving, setSaving] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const load = useCallback(async () => {
const res = await fetch("/api/linac/maintenance?linacId=" + unitId);
const data = await res.json();
if (data.ok) setList(data.records);
}, [unitId]);
useEffect(() => { load(); }, [load]);
function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
async function handleSave() {
if (!form.maintenanceType || !form.maintenanceDate) return;
setSaving(true);
try {
const fd = new FormData();
fd.set("linacId", String(unitId));
fd.set("actorEmail", actorEmail || "");
Object.entries(form).forEach(([k, v]: [string, any]) => fd.set(k, v ?? ""));
if (file) fd.set("file", file);
await fetch("/api/linac/maintenance", { method: "POST", body: fd });
setForm({}); setFile(null);
load();
} finally { setSaving(false); }
}
return (
<div className="space-y-4">
<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Registrar mantenimiento</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<select className={inputCls} value={form.maintenanceType || ""} onChange={(e) => set("maintenanceType", e.target.value)}>
<option value="">Tipo</option>
{MAINTENANCE_TYPES.map((t: any) => (<option key={t} value={t}>{t}</option>))}
</select>
<input type="date" className={inputCls} value={form.maintenanceDate || ""} onChange={(e) => set("maintenanceDate", e.target.value)} />
<input className={inputCls} placeholder="Empresa" value={form.company || ""} onChange={(e) => set("company", e.target.value)} />
<input type="number" className={inputCls} placeholder="Horas" value={form.hours || ""} onChange={(e) => set("hours", e.target.value)} />
<input type="number" className={inputCls} placeholder="Costo" value={form.cost || ""} onChange={(e) => set("cost", e.target.value)} />
<input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
</div>
<input className={inputCls + " mt-2"} placeholder="Observaciones" value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Tipo</th><th className="p-1">Empresa</th>
<th className="p-1">Horas</th><th className="p-1">Costo</th><th className="p-1">Archivo</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.maintenance_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{r.maintenance_type}</td>
<td className="p-1 text-foreground">{r.company || "-"}</td>
<td className="p-1 text-foreground">{r.hours || "-"}</td>
<td className="p-1 text-foreground">{r.cost || "-"}</td>
<td className="p-1">
{r.blob_url && (
<div className="flex gap-1">
<a href={"/api/linac/download?table=maintenance&id=" + r.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Eye className="h-3 w-3" /></a>
<a href={"/api/linac/download?table=maintenance&id=" + r.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Download className="h-3 w-3" /></a>
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
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
<input className={inputCls} placeholder="Riesgo" value={form.risk || ""} onChange={(e) => set("risk", e.target.value)} />
<input type="number" min="1" max="5" className={inputCls} placeholder="Frecuencia (1-5)" value={form.frequency || ""} onChange={(e) => set("frequency", e.target.value)} />
<input type="number" min="1" max="5" className={inputCls} placeholder="Consecuencia (1-5)" value={form.consequence || ""} onChange={(e) => set("consequence", e.target.value)} />
<input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
<input className={inputCls} placeholder="Medidas de mitigacion" value={form.mitigation || ""} onChange={(e) => set("mitigation", e.target.value)} />
</div>
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Agregar riesgo"}
</button>
</div>
<div className="rounded-lg border border-border bg-surface p-3">
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Riesgo</th><th className="p-1">Frecuencia</th><th className="p-1">Consecuencia</th>
<th className="p-1">Nivel</th><th className="p-1">Responsable</th><th className="p-1">Mitigacion</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{r.risk}</td>
<td className="p-1 text-foreground">{r.frequency}</td>
<td className="p-1 text-foreground">{r.consequence}</td>
<td className={"p-1 font-medium " + (r.risk_level >= 15 ? "text-danger" : r.risk_level >= 8 ? "text-warning" : "text-success")}>{r.risk_level}</td>
<td className="p-1 text-foreground">{r.responsible || "-"}</td>
<td className="p-1 text-foreground">{r.mitigation || "-"}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

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
