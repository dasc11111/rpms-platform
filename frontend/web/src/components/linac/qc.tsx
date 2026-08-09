"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, AlertTriangle, CheckCircle2, FileDown, Bell } from "lucide-react";
import {
LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
ReferenceLine, Legend,
} from "recharts";

const QC_PERIODICITIES = [
{ value: "diario", label: "Diario" },
{ value: "semanal", label: "Semanal" },
{ value: "mensual", label: "Mensual" },
{ value: "trimestral", label: "Trimestral" },
{ value: "semestral", label: "Semestral" },
{ value: "anual", label: "Anual" },
];

const QC_TEST_TEMPLATES: Record<string, any[]> = {
diario: [
{ name: "Constancia de salida (output)", procedure: "Medicion diaria de dosis relativa con camara/diodo en condiciones de referencia, comparar con linea base.", regulation: "ARPANSA RPS 14.3 / TG-142", tolerance: "3", unit: "%" },
{ name: "Alineacion de lasers", procedure: "Verificar coincidencia de lasers sagital y lateral con isocentro mecanico.", regulation: "ARPANSA RPS 14.3 / TG-142", tolerance: "2", unit: "mm" },
{ name: "Distancia fuente-superficie (ODI)", procedure: "Verificar indicador optico de distancia contra distancia mecanica conocida.", regulation: "ARPANSA RPS 14.3 / TG-142", tolerance: "2", unit: "mm" },
{ name: "Interlocks de puerta y emergencia", procedure: "Verificacion funcional de interlocks de puerta, boton de parada y senalizacion.", regulation: "ARPANSA RPS 14.3", tolerance: "0", unit: "funcional" },
],
semanal: [
{ name: "Constancia de salida por energia", procedure: "Medicion de salida para cada energia disponible, comparar contra baseline.", regulation: "ARPANSA RPS 14.3 / TG-142", tolerance: "2", unit: "%" },
{ name: "Simetria del haz", procedure: "Adquisicion de perfil de haz y calculo de simetria respecto a baseline.", regulation: "TG-142", tolerance: "2", unit: "%" },
{ name: "Planicidad del haz", procedure: "Adquisicion de perfil de haz y calculo de planicidad respecto a baseline.", regulation: "TG-142", tolerance: "3", unit: "%" },
],
mensual: [
{ name: "Factor de salida (output factor)", procedure: "Medicion de factores de salida para campos representativos, comparar con Beam Data.", regulation: "TG-142", tolerance: "2", unit: "%" },
{ name: "Congruencia luz-radiacion", procedure: "Comparacion de campo luminoso vs campo de radiacion.", regulation: "TG-142", tolerance: "2", unit: "mm" },
{ name: "Posicionamiento de MLC", procedure: "Verificacion de posicionamiento de laminas mediante patron de prueba.", regulation: "TG-142", tolerance: "1", unit: "mm" },
{ name: "Isocentro mecanico", procedure: "Verificacion de coincidencia de isocentros de gantry, colimador y mesa.", regulation: "TG-142", tolerance: "2", unit: "mm" },
],
trimestral: [
{ name: "PDD / TPR", procedure: "Adquisicion de curva de PDD o TPR y comparacion contra baseline de commissioning.", regulation: "TG-142", tolerance: "2", unit: "%" },
{ name: "Perfil de haz completo", procedure: "Adquisicion de perfiles completos en profundidades de referencia.", regulation: "TG-142", tolerance: "2", unit: "%" },
{ name: "Factor de cuna / bandeja", procedure: "Medicion de factores de cuna y bandeja, comparacion contra baseline.", regulation: "TG-142", tolerance: "2", unit: "%" },
],
semestral: [
{ name: "Isocentro de radiacion (esfera)", procedure: "Verificacion de isocentro de radiacion mediante tecnica de esfera/pelicula.", regulation: "TG-142", tolerance: "2", unit: "mm" },
{ name: "Verificacion TPS vs medicion", procedure: "Comparacion de dosis calculada por TPS contra medicion directa en fantoma.", regulation: "TG-142 / IAEA TRS-430", tolerance: "3", unit: "%" },
],
anual: [
{ name: "Commissioning comparativo completo", procedure: "Repeticion de mediciones de commissioning y comparacion integral contra baseline oficial.", regulation: "ARPANSA RPS 14.3 / TG-142", tolerance: "2", unit: "%" },
{ name: "Auditoria dosimetrica externa", procedure: "Auditoria dosimetrica independiente de la unidad de tratamiento.", regulation: "IAEA TRS-430", tolerance: "3", unit: "%" },
],
};

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
rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
);
const blob = new Blob([lines.join("\n")], { type: "text/csv" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
}

export function QcTab({ unitId, actorEmail }: any) {
const [periodicity, setPeriodicity] = useState("diario");
const [list, setList] = useState<any[]>([]);
const [alerts, setAlerts] = useState<any[]>([]);
const [form, setForm] = useState<any>({ status: "cumple" });
const [file, setFile] = useState<File | null>(null);
const [saving, setSaving] = useState(false);
const [lastResult, setLastResult] = useState<any>(null);
const [trendTest, setTrendTest] = useState<string>("");

const load = useCallback(async () => {
const res = await fetch("/api/linac/qc?linacId=" + unitId + "&periodicity=" + periodicity);
const data = await res.json();
if (data.ok) setList(data.tests);
}, [unitId, periodicity]);

const loadAlerts = useCallback(async () => {
const res = await fetch("/api/linac/qc/alerts?linacId=" + unitId + "&status=abierta");
const data = await res.json();
if (data.ok) setAlerts(data.alerts);
}, [unitId]);

useEffect(() => { load(); }, [load]);
useEffect(() => { loadAlerts(); }, [loadAlerts]);

function set(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); }

function applyTemplate(name: string) {
const templates = QC_TEST_TEMPLATES[periodicity] || [];
const t = templates.find((x: any) => x.name === name);
if (!t) { set("testName", name); return; }
setForm((f: any) => ({
...f,
testName: t.name,
procedure: t.procedure,
applicableRegulation: t.regulation,
tolerance: t.tolerance,
unit: t.unit,
}));
}

async function handleSave() {
if (!form.testName || !form.testDate) return;
setSaving(true);
try {
const fd = new FormData();
fd.set("linacId", String(unitId));
fd.set("periodicity", periodicity);
Object.entries(form).forEach(([k, v]: [string, any]) => fd.set(k, v ?? ""));
if (file) fd.set("file", file);
const res = await fetch("/api/linac/qc", { method: "POST", body: fd });
const data = await res.json();
if (data.ok) setLastResult(data);
setForm({ status: "cumple" }); setFile(null);
load();
loadAlerts();
} finally {
setSaving(false);
}
}

async function resolveAlert(id: number) {
await fetch("/api/linac/qc/alerts", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id, status: "resuelta", actorEmail }),
});
loadAlerts();
}

const distinctTestNames = useMemo(() => {
const names = new Set<string>();
list.forEach((q: any) => names.add(q.test_name));
return Array.from(names);
}, [list]);

const trendData = useMemo(() => {
if (!trendTest) return [];
return list
.filter((q: any) => q.test_name === trendTest)
.slice()
.sort((a: any, b: any) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime())
.map((q: any) => ({
date: String(q.test_date).slice(0, 10),
obtained: parseFloat(q.obtained_value) || null,
expected: parseFloat(q.expected_value) || null,
}));
}, [list, trendTest]);

const trendExpected: number | null = trendData.length ? (trendData[trendData.length - 1] as any).expected : null;
const trendTolerance = useMemo(() => {
const row = list.find((q: any) => q.test_name === trendTest);
return row ? parseFloat(row.tolerance) : null;
}, [list, trendTest]);

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const templates = QC_TEST_TEMPLATES[periodicity] || [];

return (
<div className="space-y-4">
{alerts.length > 0 && (
<div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
<p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
<Bell className="h-4 w-4" /> Alertas de Control de Calidad abiertas ({alerts.length})
</p>
<table className="w-full text-xs">
<thead><tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Periodicidad</th><th className="p-1">Prueba</th>
<th className="p-1">Semaforo</th><th className="p-1">Mensaje</th><th className="p-1">Accion</th>
</tr></thead>
<tbody>
{alerts.map((a: any) => (
<tr key={a.id} className="border-t border-border">
<td className="p-1 text-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
<td className="p-1 text-foreground capitalize">{a.periodicity}</td>
<td className="p-1 text-foreground">{a.test_name}</td>
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

<div className="flex gap-1">
{QC_PERIODICITIES.map((p: any) => (
<button
key={p.value}
onClick={() => { setPeriodicity(p.value); setTrendTest(""); }}
className={
"rounded px-2 py-1 text-xs " +
(periodicity === p.value ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")
}
>
{p.label}
</button>
))}
</div>

<div className="rounded-lg border border-border bg-surface p-3">
<p className="mb-2 text-sm font-semibold text-foreground">Registrar prueba QC {periodicity}</p>
{templates.length > 0 && (
<div className="mb-2">
<label className="text-xs text-muted-foreground">Plantilla de prueba (ARPANSA RPS 14.3 / TG-142)</label>
<select className={inputCls} value="" onChange={(e) => applyTemplate(e.target.value)}>
<option value="">Seleccionar plantilla...</option>
{templates.map((t: any) => (<option key={t.name} value={t.name}>{t.name}</option>))}
</select>
</div>
)}
<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
<input className={inputCls} placeholder="Nombre de la prueba" value={form.testName || ""} onChange={(e) => set("testName", e.target.value)} />
<input type="date" className={inputCls} value={form.testDate || ""} onChange={(e) => set("testDate", e.target.value)} />
<input type="time" className={inputCls} value={form.testTime || ""} onChange={(e) => set("testTime", e.target.value)} />
<input className={inputCls} placeholder="Valor esperado" value={form.expectedValue || ""} onChange={(e) => set("expectedValue", e.target.value)} />
<input className={inputCls} placeholder="Valor obtenido" value={form.obtainedValue || ""} onChange={(e) => set("obtainedValue", e.target.value)} />
<input className={inputCls} placeholder="Tolerancia (%)" value={form.tolerance || ""} onChange={(e) => set("tolerance", e.target.value)} />
<input className={inputCls} placeholder="Unidad" value={form.unit || ""} onChange={(e) => set("unit", e.target.value)} />
<select className={inputCls} value={form.status || "cumple"} onChange={(e) => set("status", e.target.value)}>
<option value="cumple">Cumple</option>
<option value="no_cumple">No cumple</option>
</select>
<input className={inputCls} placeholder="Modalidad (ej. FFF)" value={form.modality || ""} onChange={(e) => set("modality", e.target.value)} />
<input className={inputCls} placeholder="Energia (ej. 6 MV)" value={form.energy || ""} onChange={(e) => set("energy", e.target.value)} />
<input className={inputCls} placeholder="Tipo medicion (Baseline, ej. factor_salida)" value={form.measurementType || ""} onChange={(e) => set("measurementType", e.target.value)} />
<input className={inputCls} placeholder="Instrumento utilizado" value={form.instrumentUsed || ""} onChange={(e) => set("instrumentUsed", e.target.value)} />
<input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
<input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
</div>
<textarea className={inputCls + " mt-2"} placeholder="Procedimiento" value={form.procedure || ""} onChange={(e) => set("procedure", e.target.value)} />
<input className={inputCls + " mt-2"} placeholder="Normativa aplicable" value={form.applicableRegulation || ""} onChange={(e) => set("applicableRegulation", e.target.value)} />
<input className={inputCls + " mt-2"} placeholder="Observaciones" value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} />
<button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
{saving ? "Guardando..." : "Registrar prueba"}
</button>
{lastResult && (
<p className={"mt-2 flex items-center gap-1.5 text-xs font-medium " + (SEMAPHORE_COLORS[lastResult.semaphore] || "text-foreground")}>
{lastResult.semaphore === "verde" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
Resultado: semaforo {lastResult.semaphore}
{lastResult.deviationPct !== null && lastResult.deviationPct !== undefined ? " - desviacion " + lastResult.deviationPct + "%" : ""}
{lastResult.baseline ? " - comparado con Baseline v" + lastResult.baseline.version : " - sin Baseline coincidente"}
</p>
)}
</div>

{distinctTestNames.length > 0 && (
<div className="rounded-lg border border-border bg-surface p-3">
<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
<p className="text-sm font-semibold text-foreground">Grafico SPC / Tendencia</p>
<select className={inputCls + " max-w-xs"} value={trendTest} onChange={(e) => setTrendTest(e.target.value)}>
<option value="">Seleccionar prueba...</option>
{distinctTestNames.map((n: string) => (<option key={n} value={n}>{n}</option>))}
</select>
</div>
{trendTest && trendData.length > 0 && (
<ResponsiveContainer width="100%" height={240}>
<LineChart data={trendData}>
<CartesianGrid strokeDasharray="3 3" stroke="#333" />
<XAxis dataKey="date" tick={{ fontSize: 10 }} />
<YAxis tick={{ fontSize: 10 }} />
<Tooltip />
<Legend />
{trendExpected !== null && Number.isFinite(trendExpected) && (
<ReferenceLine y={trendExpected} stroke="#3b82f6" strokeDasharray="4 4" label="Esperado" />
)}
{trendExpected !== null && Number.isFinite(trendExpected) && Number.isFinite(trendTolerance as any) && (
<>
<ReferenceLine y={(trendExpected as number) * (1 + (trendTolerance || 0) / 100)} stroke="#f59e0b" strokeDasharray="2 2" />
<ReferenceLine y={(trendExpected as number) * (1 - (trendTolerance || 0) / 100)} stroke="#f59e0b" strokeDasharray="2 2" />
</>
)}
<Line type="monotone" dataKey="obtained" stroke="#22c55e" name="Valor obtenido" />
</LineChart>
</ResponsiveContainer>
)}
</div>
)}

<div className="rounded-lg border border-border bg-surface p-3">
<div className="mb-2 flex items-center justify-between">
<p className="text-sm font-semibold text-foreground">Pruebas registradas ({periodicity})</p>
<button onClick={() => exportCsv(list, "qc_" + periodicity + ".csv")} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">
<FileDown className="h-3.5 w-3.5" /> Exportar CSV
</button>
</div>
<table className="w-full text-xs">
<thead>
<tr className="text-left text-muted-foreground">
<th className="p-1">Fecha</th><th className="p-1">Hora</th><th className="p-1">Prueba</th><th className="p-1">Esperado</th>
<th className="p-1">Obtenido</th><th className="p-1">Tolerancia</th><th className="p-1">Desviacion</th>
<th className="p-1">Semaforo</th><th className="p-1">Baseline</th><th className="p-1">Estado</th>
<th className="p-1">Responsable</th><th className="p-1">Archivo</th>
</tr>
</thead>
<tbody>
{list.map((q: any) => (
<tr key={q.id} className="border-t border-border">
<td className="p-1 text-foreground">{String(q.test_date).slice(0, 10)}</td>
<td className="p-1 text-foreground">{q.test_time || "-"}</td>
<td className="p-1 text-foreground">{q.test_name}</td>
<td className="p-1 text-foreground">{q.expected_value || "-"}</td>
<td className="p-1 text-foreground">{q.obtained_value || "-"}</td>
<td className="p-1 text-foreground">{q.tolerance || "-"}</td>
<td className="p-1 text-foreground">{q.deviation_pct !== null && q.deviation_pct !== undefined ? q.deviation_pct + "%" : "-"}</td>
<td className="p-1">
<span className={"inline-block h-2.5 w-2.5 rounded-full " + (SEMAPHORE_DOT[q.semaphore] || "bg-muted")} title={q.semaphore} />
</td>
<td className="p-1 text-foreground">{q.baseline_id ? "v" + q.baseline_version : "-"}</td>
<td className={"p-1 font-medium " + (q.status === "cumple" ? "text-success" : "text-danger")}>{q.status}</td>
<td className="p-1 text-foreground">{q.responsible || "-"}</td>
<td className="p-1">
{q.blob_url && (
<div className="flex gap-1">
<a href={"/api/linac/download?table=qc&id=" + q.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Eye className="h-3 w-3" /></a>
<a href={"/api/linac/download?table=qc&id=" + q.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Download className="h-3 w-3" /></a>
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
