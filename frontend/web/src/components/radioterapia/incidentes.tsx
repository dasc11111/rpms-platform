"use client";

import { useCallback, useEffect, useState } from "react";

const CATEGORIES = [
{ value: "radiologico", label: "Radiologico" },
{ value: "operacional", label: "Operacional" },
{ value: "tecnico", label: "Tecnico" },
{ value: "dosimetrico", label: "Dosimetrico" },
{ value: "instrumental", label: "Instrumental" },
{ value: "mantenimiento", label: "Mantenimiento" },
{ value: "documental", label: "Documental" },
{ value: "seguridad", label: "Seguridad" },
{ value: "emergencia", label: "Emergencia" },
{ value: "otro", label: "Otro" },
];

const SEVERITIES = ["menor", "moderado", "grave"];
const SEVERITY_COLORS: Record<string, string> = { menor: "text-success", moderado: "text-warning", grave: "text-danger" };

const STAGES = [
{ value: "registrado", label: "Registrado" },
{ value: "evaluacion_inicial", label: "Evaluacion inicial" },
{ value: "investigacion", label: "Investigacion" },
{ value: "causa", label: "Causa" },
{ value: "accion_correctiva", label: "Accion correctiva" },
{ value: "verificacion", label: "Verificacion" },
{ value: "cierre", label: "Cierre" },
];
const STAGE_MAP: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));

const ROOT_CAUSE_METHODS = [
{ value: "ninguno", label: "Ninguno / no requiere" },
{ value: "5_porques", label: "5 Por que (5 Whys)" },
{ value: "ishikawa", label: "Ishikawa (causa-efecto)" },
{ value: "simple", label: "Analisis simple" },
{ value: "personalizado", label: "Analisis personalizado" },
];

const ISHIKAWA_KEYS = [
{ key: "mano_obra", label: "Mano de obra" },
{ key: "metodo", label: "Metodo" },
{ key: "maquina", label: "Maquina" },
{ key: "material", label: "Material" },
{ key: "medicion", label: "Medicion" },
{ key: "medio_ambiente", label: "Medio ambiente" },
];

export function IncidentesTab({ facilityId, actorEmail }: any) {
const [list, setList] = useState<any[]>([]);
const [form, setForm] = useState<any>({ severity: "menor", isNearMiss: false, category: "otro" });
const [saving, setSaving] = useState(false);
const [selectedId, setSelectedId] = useState<number | null>(null);
const [history, setHistory] = useState<any[]>([]);
const [stageForm, setStageForm] = useState<any>({ stage: "evaluacion_inicial" });
const [rootCauseForm, setRootCauseForm] = useState<any>({ method: "ninguno", data: {} });
const [savingStage, setSavingStage] = useState(false);
const [savingCause, setSavingCause] = useState(false);
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

const load = useCallback(async () => {
if (!facilityId) return;
const res = await fetch("/api/radioterapia/incidents?facilityId=" + facilityId);
const data = await res.json();
if (data.ok) setList(data.incidents);
}, [facilityId]);

const loadHistory = useCallback(async () => {
if (!selectedId) return;
const res = await fetch("/api/radioterapia/incidents?historyOf=" + selectedId);
const data = await res.json();
if (data.ok) setHistory(data.history);
}, [selectedId]);

useEffect(() => { load(); }, [load]);
useEffect(() => { loadHistory(); }, [loadHistory]);

function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
function setStage(k: string, v: any) { setStageForm((f: any) => ({ ...f, [k]: v })); }

const selected = list.find((r: any) => r.id === selectedId) || null;

useEffect(() => {
if (selected) {
setRootCauseForm({ method: selected.root_cause_method || "ninguno", data: selected.root_cause_data || {} });
}
}, [selectedId]);

async function handleSave() {
if (!form.event || !form.incidentDate) return;
setSaving(true);
try {
await fetch("/api/radioterapia/incidents", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ facilityId, actorEmail, ...form }),
});
setForm({ severity: "menor", isNearMiss: false, category: "otro" });
load();
} finally { setSaving(false); }
}

async function toggleStatus(id: number, status: string) {
await fetch("/api/radioterapia/incidents", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id, status, actorEmail }),
});
load();
}

async function handleStageSave() {
if (!selectedId || !stageForm.stage) return;
setSavingStage(true);
try {
await fetch("/api/radioterapia/incidents", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ kind: "stage", incidentId: selectedId, actorEmail, ...stageForm }),
});
setStageForm({ stage: stageForm.stage });
load();
loadHistory();
} finally { setSavingStage(false); }
}

function setCauseData(k: string, v: any) {
setRootCauseForm((f: any) => ({ ...f, data: { ...f.data, [k]: v } }));
}

async function handleCauseSave() {
if (!selectedId) return;
setSavingCause(true);
try {
await fetch("/api/radioterapia/incidents", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id: selectedId, field: "root_cause", actorEmail, rootCauseMethod: rootCauseForm.method, rootCauseData: rootCauseForm.data }),
});
load();
} finally { setSavingCause(false); }
}

const totalCount = list.length;
const abiertos = list.filter((r: any) => r.status === "abierto").length;
const enInvestigacion = list.filter((r: any) => r.status === "abierto" && !["registrado", "cierre"].includes(r.investigation_stage)).length;
const cerrados = list.filter((r: any) => r.status === "cerrado").length;

return (
<div className="space-y-4">
<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
<SummaryBox label="Total" value={totalCount} />
<SummaryBox label="Abiertos" value={abiertos} />
<SummaryBox label="En investigacion" value={enInvestigacion} />
<SummaryBox label="Cerrados" value={cerrados} />
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Registrar incidente / evento</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<input className={inputCls} placeholder="Evento" value={form.event || ""} onChange={(e) => set("event", e.target.value)} />
<input type="date" className={inputCls} value={form.incidentDate || ""} onChange={(e) => set("incidentDate", e.target.value)} />
<input type="time" className={inputCls} value={form.incidentTime || ""} onChange={(e) => set("incidentTime", e.target.value)} />
<select className={inputCls} value={form.category || "otro"} onChange={(e) => set("category", e.target.value)}>
{CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
</select>
<select className={inputCls} value={form.severity || "menor"} onChange={(e) => set("severity", e.target.value)}>
{SEVERITIES.map((s) => (<option key={s} value={s}>{s}</option>))}
</select>
<label className="flex items-center gap-2 text-sm text-foreground">
<input type="checkbox" checked={!!form.isNearMiss} onChange={(e) => set("isNearMiss", e.target.checked)} />
Quasi-incidente
</label>
</div>
<textarea className={inputCls + " mt-2"} placeholder="Descripcion" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
<input className={inputCls} placeholder="Persona involucrada" value={form.personInvolved || ""} onChange={(e) => set("personInvolved", e.target.value)} />
<input className={inputCls} placeholder="Dosis estimada" value={form.estimatedDose || ""} onChange={(e) => set("estimatedDose", e.target.value)} />
<input className={inputCls} placeholder="Impacto" value={form.impact || ""} onChange={(e) => set("impact", e.target.value)} />
</div>
<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
<input className={inputCls} placeholder="Causa inicial" value={form.cause || ""} onChange={(e) => set("cause", e.target.value)} />
<input className={inputCls} placeholder="Acciones inmediatas" value={form.immediateActions || ""} onChange={(e) => set("immediateActions", e.target.value)} />
</div>
<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
<input className={inputCls} placeholder="Acciones correctivas" value={form.correctiveActions || ""} onChange={(e) => set("correctiveActions", e.target.value)} />
<input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
<input className={inputCls} placeholder="Documentos (URL)" value={form.documentsUrl || ""} onChange={(e) => set("documentsUrl", e.target.value)} />
</div>
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar incidente"}
</button>
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Incidentes registrados</p>
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Categoria</th><th className="p-1">Evento</th><th className="p-1">Severidad</th><th className="p-1">Etapa</th><th className="p-1">Estado</th><th className="p-1">Detalle</th>
</tr></thead>
<tbody>
{list.map((r: any) => (
<tr key={r.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(r.incident_date).slice(0, 10)}{r.incident_time ? " " + r.incident_time : ""}</td>
<td className="p-1 text-foreground">{r.category || "-"}</td>
<td className="p-1 text-foreground">{r.event}</td>
<td className={"p-1 font-medium " + (SEVERITY_COLORS[r.severity] || "text-foreground")}>{r.severity}</td>
<td className="p-1 text-foreground">{STAGE_MAP[r.investigation_stage] || r.investigation_stage || "-"}</td>
<td className={"p-1 font-medium " + (r.status === "abierto" ? "text-danger" : "text-success")}>{r.status}</td>
<td className="p-1">
<div className="flex gap-1">
<button onClick={() => setSelectedId(r.id === selectedId ? null : r.id)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">
{selectedId === r.id ? "Ocultar" : "Ver"}
</button>
<button onClick={() => toggleStatus(r.id, r.status === "abierto" ? "cerrado" : "abierto")} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">
{r.status === "abierto" ? "Cerrar" : "Reabrir"}
</button>
</div>
</td>
</tr>
))}
{list.length === 0 && (<tr><td colSpan={7} className="p-2 text-center text-muted-foreground">Sin incidentes registrados.</td></tr>)}
</tbody>
</table>
</div>

{selected && (
<div className="rounded-lg border border-border bg-surface p-3 space-y-3">
<div className="flex items-center justify-between">
<p className="text-sm font-semibold text-foreground">Detalle: {selected.event}</p>
<button onClick={() => setSelectedId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cerrar detalle</button>
</div>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
<p><span className="text-muted-foreground">Persona involucrada: </span><span className="text-foreground">{selected.person_involved || "-"}</span></p>
<p><span className="text-muted-foreground">Dosis estimada: </span><span className="text-foreground">{selected.estimated_dose || "-"}</span></p>
<p><span className="text-muted-foreground">Impacto: </span><span className="text-foreground">{selected.impact || "-"}</span></p>
<p><span className="text-muted-foreground">Acciones inmediatas: </span><span className="text-foreground">{selected.immediate_actions || "-"}</span></p>
<p><span className="text-muted-foreground">Acciones correctivas: </span><span className="text-foreground">{selected.corrective_actions || "-"}</span></p>
<p><span className="text-muted-foreground">Responsable: </span><span className="text-foreground">{selected.responsible || "-"}</span></p>
{selected.documents_url && (<p className="sm:col-span-3"><span className="text-muted-foreground">Documentos: </span><a className="text-accent underline" href={selected.documents_url} target="_blank" rel="noreferrer">{selected.documents_url}</a></p>)}
</div>

<div className="rounded border border-border p-2">
<p className="mb-2 text-xs font-semibold text-foreground">Investigacion del incidente (flujo: Registrado - Evaluacion inicial - Investigacion - Causa - Accion correctiva - Verificacion - Cierre)</p>
<p className="mb-2 text-xs text-muted-foreground">Etapa actual: {STAGE_MAP[selected.investigation_stage] || selected.investigation_stage}</p>
<div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
<select className={inputCls} value={stageForm.stage || "evaluacion_inicial"} onChange={(e) => setStage("stage", e.target.value)}>
{STAGES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
</select>
<input type="date" className={inputCls} value={stageForm.stageDate || ""} onChange={(e) => setStage("stageDate", e.target.value)} />
<input className={inputCls} placeholder="Responsable de la etapa" value={stageForm.responsible || ""} onChange={(e) => setStage("responsible", e.target.value)} />
<input className={inputCls} placeholder="Notas" value={stageForm.notes || ""} onChange={(e) => setStage("notes", e.target.value)} />
</div>
<button onClick={handleStageSave} disabled={savingStage} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{savingStage ? "Guardando..." : "Registrar avance de etapa"}
</button>
<table className="mt-3 w-full text-xs">
<thead><tr className="text-left text-muted-foreground"><th className="p-1">Fecha</th><th className="p-1">Etapa</th><th className="p-1">Responsable</th><th className="p-1">Notas</th></tr></thead>
<tbody>
{history.map((h: any) => (
<tr key={h.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(h.stage_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{STAGE_MAP[h.stage] || h.stage}</td>
<td className="p-1 text-foreground">{h.responsible || "-"}</td>
<td className="p-1 text-foreground">{h.notes || "-"}</td>
</tr>
))}
{history.length === 0 && (<tr><td colSpan={4} className="p-2 text-center text-muted-foreground">Sin avances registrados.</td></tr>)}
</tbody>
</table>
</div>

<div className="rounded border border-border p-2">
<p className="mb-2 text-xs font-semibold text-foreground">Analisis de causa</p>
<select className={inputCls + " sm:w-64"} value={rootCauseForm.method || "ninguno"} onChange={(e) => setRootCauseForm((f: any) => ({ ...f, method: e.target.value }))}>
{ROOT_CAUSE_METHODS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
</select>

{rootCauseForm.method === "5_porques" && (
<div className="mt-2 space-y-1">
{[1, 2, 3, 4, 5].map((n) => (
<input key={n} className={inputCls} placeholder={"Por que " + n} value={rootCauseForm.data?.["why" + n] || ""} onChange={(e) => setCauseData("why" + n, e.target.value)} />
))}
</div>
)}

{rootCauseForm.method === "ishikawa" && (
<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
{ISHIKAWA_KEYS.map((k) => (
<div key={k.key}>
<label className="text-[11px] text-muted-foreground">{k.label}</label>
<input className={inputCls} value={rootCauseForm.data?.[k.key] || ""} onChange={(e) => setCauseData(k.key, e.target.value)} />
</div>
))}
</div>
)}

{(rootCauseForm.method === "simple" || rootCauseForm.method === "personalizado") && (
<textarea className={inputCls + " mt-2"} placeholder="Analisis" value={rootCauseForm.data?.texto || ""} onChange={(e) => setCauseData("texto", e.target.value)} />
)}

{rootCauseForm.method === "ninguno" && (
<p className="mt-2 text-xs text-muted-foreground">Este incidente no requiere un analisis de causa formal.</p>
)}

<button onClick={handleCauseSave} disabled={savingCause} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{savingCause ? "Guardando..." : "Guardar analisis de causa"}
</button>
</div>
</div>
)}
</div>
);
}

function SummaryBox({ label, value }: any) {
return (
<div className="rounded-lg border border-border bg-surface p-3">
<p className="text-lg font-semibold text-foreground">{value != null ? value : 0}</p>
<p className="text-[11px] text-muted-foreground">{label}</p>
</div>
);
}
