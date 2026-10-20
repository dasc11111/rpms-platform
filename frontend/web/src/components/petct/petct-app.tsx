"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
PetctExam,
PetctQc,
calcPetctDerived,
PETCT_RADIONUCLIDES,
PETCT_RADIOPHARMACEUTICALS,
PETCT_EXAM_STATES,
PETCT_EXAM_STATE_LABELS,
} from "@/lib/petct";

// ─── Schemas ────────────────────────────────────────────────────────────────

const examSchema = z.object({
patient_id: z.string().min(1, "RUT requerido"),
patient_name: z.string().optional(),
radiopharmaceutical: z.string().min(1, "Radiofármaco requerido"),
radionuclide: z.string().min(1, "Radionucleido requerido"),
administered_mbq: z.coerce.number().positive("MBq debe ser positivo"),
patient_weight_kg: z.coerce.number().positive().optional(),
injection_datetime: z.string().min(1, "Fecha/hora de inyección requerida"),
uptake_minutes: z.coerce.number().int().min(1).default(60),
operator: z.string().min(1, "Operador requerido"),
prescribing_physician: z.string().min(1, "Médico prescriptor requerido"),
notes: z.string().optional(),
});

const qcSchema = z.object({
qc_date: z.string().min(1, "Fecha requerida"),
phantom_type: z.string().default("Ge-68/Ga-68"),
uniformity_pass: z.boolean(),
count_rate_mcps: z.coerce.number().optional(),
image_quality_pass: z.boolean(),
comments: z.string().optional(),
performed_by: z.string().min(1, "Operador requerido"),
});

type ExamForm = z.infer<typeof examSchema>;
type QcForm = z.infer<typeof qcSchema>;

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchExams(state?: string, date?: string): Promise<{ data: PetctExam[]; total: number }> {
const params = new URLSearchParams({ type: "exams", limit: "100" });
if (state) params.set("state", state);
if (date) params.set("date", date);
const res = await fetch(`/api/petct?${params}`);
if (!res.ok) throw new Error("Error al cargar exámenes PET/CT");
return res.json();
}

async function fetchQc(): Promise<{ data: PetctQc[]; total: number }> {
const res = await fetch("/api/petct?type=qc&limit=30");
if (!res.ok) throw new Error("Error al cargar QC");
return res.json();
}

async function createExam(body: ExamForm & { type: "exam" }) {
const res = await fetch("/api/petct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
if (!res.ok) throw new Error("Error al crear examen");
return res.json();
}

async function createQc(body: QcForm & { type: "qc" }) {
const res = await fetch("/api/petct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
if (!res.ok) throw new Error("Error al guardar QC");
return res.json();
}

async function patchExam(id: number, updates: Partial<PetctExam>) {
const res = await fetch("/api/petct", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
if (!res.ok) throw new Error("Error al actualizar examen");
return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stateColor(state: string) {
const map: Record<string, string> = {
pending: "bg-yellow-100 text-yellow-800",
preparing: "bg-blue-100 text-blue-800",
injected: "bg-purple-100 text-purple-800",
uptake: "bg-indigo-100 text-indigo-800",
scanning: "bg-teal-100 text-teal-800",
completed: "bg-green-100 text-green-800",
cancelled: "bg-red-100 text-red-800",
};
return map[state] ?? "bg-gray-100 text-gray-800";
}

function fmt(val: number | null | undefined, dec = 1): string {
if (val == null) return "—";
return val.toFixed(dec);
}

function fmtDate(dt: string | null | undefined): string {
if (!dt) return "—";
return new Date(dt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

// ─── Empty form defaults ──────────────────────────────────────────────────────

function emptyExam(): ExamForm {
const now = new Date();
now.setSeconds(0, 0);
return {
patient_id: "",
patient_name: "",
radiopharmaceutical: "FDG",
radionuclide: "F-18",
administered_mbq: 370,
patient_weight_kg: undefined,
injection_datetime: now.toISOString().slice(0, 16),
uptake_minutes: 60,
operator: "",
prescribing_physician: "",
notes: "",
};
}

function emptyQc(): QcForm {
return {
qc_date: new Date().toISOString().slice(0, 10),
phantom_type: "Ge-68/Ga-68",
uniformity_pass: true,
count_rate_mcps: undefined,
image_quality_pass: true,
comments: "",
performed_by: "",
};
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PetctApp() {
const qc = useQueryClient();
const [tab, setTab] = useState<"exams" | "new-exam" | "qc" | "new-qc">("exams");
const [filterState, setFilterState] = useState("");
const [filterDate, setFilterDate] = useState("");
const [examForm, setExamForm] = useState<ExamForm>(emptyExam);
const [qcForm, setQcForm] = useState<QcForm>(emptyQc);
const [errors, setErrors] = useState<Record<string, string>>({});

// Queries
const examsQ = useQuery({ queryKey: ["petct-exams", filterState, filterDate], queryFn: () => fetchExams(filterState, filterDate), enabled: tab === "exams" });
const qcQ = useQuery({ queryKey: ["petct-qc"], queryFn: fetchQc, enabled: tab === "qc" });

// Mutations
const createExamM = useMutation({ mutationFn: createExam, onSuccess: () => { qc.invalidateQueries({ queryKey: ["petct-exams"] }); setTab("exams"); setExamForm(emptyExam()); } });
const createQcM = useMutation({ mutationFn: createQc, onSuccess: () => { qc.invalidateQueries({ queryKey: ["petct-qc"] }); setTab("qc"); setQcForm(emptyQc()); } });
const patchM = useMutation({ mutationFn: ({ id, updates }: { id: number; updates: Partial<PetctExam> }) => patchExam(id, updates), onSuccess: () => qc.invalidateQueries({ queryKey: ["petct-exams"] }) });

// Form handlers
function handleExamSubmit(e: React.FormEvent) {
e.preventDefault();
const result = examSchema.safeParse(examForm);
if (!result.success) {
const errs: Record<string, string> = {};
result.error.errors.forEach(err => { if (err.path[0]) errs[String(err.path[0])] = err.message; });
setErrors(errs);
return;
}
setErrors({});
createExamM.mutate({ ...result.data, type: "exam" });
}

function handleQcSubmit(e: React.FormEvent) {
e.preventDefault();
const result = qcSchema.safeParse(qcForm);
if (!result.success) {
const errs: Record<string, string> = {};
result.error.errors.forEach(err => { if (err.path[0]) errs[String(err.path[0])] = err.message; });
setErrors(errs);
return;
}
setErrors({});
createQcM.mutate({ ...result.data, type: "qc" });
}

return (
<div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
{/* Header */}
<div className="flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-gray-900">PET/CT — Gestión de Exámenes</h1>
<p className="text-sm text-gray-500 mt-1">Registro, dosimetría y control de calidad PET/CT</p>
</div>
<div className="flex gap-2">
<button onClick={() => setTab("new-exam")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ Nuevo Examen</button>
<button onClick={() => setTab("new-qc")} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">+ QC Diario</button>
</div>
</div>

{/* Tabs */}
<div className="border-b border-gray-200">
<nav className="flex gap-4">
{(["exams", "qc"] as const).map(t => (
<button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
{t === "exams" ? "Exámenes" : "Control de Calidad"}
</button>
))}
</nav>
</div>

{/* ── EXAM LIST ── */}
{tab === "exams" && (
<div className="space-y-4">
{/* Filters */}
<div className="flex gap-3 items-center">
<select value={filterState} onChange={e => setFilterState(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
<option value="">Todos los estados</option>
{PETCT_EXAM_STATES.map(s => <option key={s} value={s}>{PETCT_EXAM_STATE_LABELS[s]}</option>)}
</select>
<input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
{(filterState || filterDate) && <button onClick={() => { setFilterState(""); setFilterDate(""); }} className="text-sm text-gray-500 hover:text-gray-700">Limpiar</button>}
</div>

{examsQ.isLoading && <p className="text-gray-500 text-sm">Cargando...</p>}
{examsQ.isError && <p className="text-red-600 text-sm">Error al cargar exámenes.</p>}

{examsQ.data && (
<div className="overflow-x-auto rounded-lg border">
<table className="min-w-full text-sm">
<thead className="bg-gray-50">
<tr>
{["Paciente", "Radiofármaco", "MBq administrados", "Inyección", "Captación (min)", "Tasa dosis 1m (µSv/h)", "Estado", "Acciones"].map(h => (
<th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
))}
</tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
{examsQ.data.data.map(exam => {
const d = calcPetctDerived(exam);
return (
<tr key={exam.id} className="hover:bg-gray-50">
<td className="px-4 py-3">
<div className="font-medium text-gray-900">{exam.patient_id}</div>
{exam.patient_name && <div className="text-gray-500 text-xs">{exam.patient_name}</div>}
</td>
<td className="px-4 py-3">
<div>{exam.radiopharmaceutical}</div>
<div className="text-gray-400 text-xs">{exam.radionuclide}</div>
</td>
<td className="px-4 py-3 font-mono">{fmt(exam.administered_mbq, 0)} MBq</td>
<td className="px-4 py-3">{fmtDate(exam.injection_datetime)}</td>
<td className="px-4 py-3 font-mono">{exam.uptake_minutes}</td>
<td className="px-4 py-3 font-mono text-orange-700">{fmt(d.dose_rate_1m_usvh, 2)}</td>
<td className="px-4 py-3">
<span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${stateColor(exam.state)}`}>
{PETCT_EXAM_STATE_LABELS[exam.state] ?? exam.state}
</span>
</td>
<td className="px-4 py-3">
<select
value={exam.state}
onChange={e => patchM.mutate({ id: exam.id!, updates: { state: e.target.value } })}
className="border rounded px-2 py-1 text-xs"
>
{PETCT_EXAM_STATES.map(s => <option key={s} value={s}>{PETCT_EXAM_STATE_LABELS[s]}</option>)}
</select>
</td>
</tr>
);
})}
{examsQ.data.data.length === 0 && (
<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No hay exámenes registrados</td></tr>
)}
</tbody>
</table>
</div>
)}
</div>
)}

{/* ── QC LIST ── */}
{tab === "qc" && (
<div>
{qcQ.isLoading && <p className="text-gray-500 text-sm">Cargando...</p>}
{qcQ.isError && <p className="text-red-600 text-sm">Error al cargar QC.</p>}
{qcQ.data && (
<div className="overflow-x-auto rounded-lg border">
<table className="min-w-full text-sm">
<thead className="bg-gray-50">
<tr>
{["Fecha", "Phantom", "Uniformidad", "Count Rate (Mcps)", "Calidad imagen", "Operador", "Comentarios"].map(h => (
<th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
))}
</tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
{qcQ.data.data.map(qcRow => (
<tr key={qcRow.id} className="hover:bg-gray-50">
<td className="px-4 py-3">{qcRow.qc_date}</td>
<td className="px-4 py-3">{qcRow.phantom_type}</td>
<td className="px-4 py-3"><span className={qcRow.uniformity_pass ? "text-green-700" : "text-red-700"}>{qcRow.uniformity_pass ? "✓ OK" : "✗ FALLA"}</span></td>
<td className="px-4 py-3 font-mono">{qcRow.count_rate_mcps != null ? qcRow.count_rate_mcps.toFixed(2) : "—"}</td>
<td className="px-4 py-3"><span className={qcRow.image_quality_pass ? "text-green-700" : "text-red-700"}>{qcRow.image_quality_pass ? "✓ OK" : "✗ FALLA"}</span></td>
<td className="px-4 py-3">{qcRow.performed_by}</td>
<td className="px-4 py-3 text-gray-500">{qcRow.comments ?? "—"}</td>
</tr>
))}
{qcQ.data.data.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin registros de QC</td></tr>}
</tbody>
</table>
</div>
)}
</div>
)}

{/* ── NEW EXAM FORM ── */}
{tab === "new-exam" && (
<div className="max-w-2xl">
<h2 className="text-lg font-semibold mb-4">Registrar Nuevo Examen PET/CT</h2>
<form onSubmit={handleExamSubmit} className="space-y-4">
{/* Row 1 */}
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-sm font-medium text-gray-700">RUT Paciente *</label>
<input type="text" value={examForm.patient_id} onChange={e => setExamForm(f => ({ ...f, patient_id: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="12.345.678-9" />
{errors.patient_id && <p className="text-red-600 text-xs mt-1">{errors.patient_id}</p>}
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Nombre Paciente</label>
<input type="text" value={examForm.patient_name ?? ""} onChange={e => setExamForm(f => ({ ...f, patient_name: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
</div>
{/* Row 2 */}
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-sm font-medium text-gray-700">Radiofármaco *</label>
<select value={examForm.radiopharmaceutical} onChange={e => { const pharma = PETCT_RADIOPHARMACEUTICALS.find(p => p.name === e.target.value); setExamForm(f => ({ ...f, radiopharmaceutical: e.target.value, radionuclide: pharma?.radionuclide ?? f.radionuclide, administered_mbq: pharma?.defaultMbq ?? f.administered_mbq })); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
{PETCT_RADIOPHARMACEUTICALS.map(p => <option key={p.name} value={p.name}>{p.name} ({p.radionuclide})</option>)}
</select>
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Radionucleido *</label>
<select value={examForm.radionuclide} onChange={e => setExamForm(f => ({ ...f, radionuclide: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
{PETCT_RADIONUCLIDES.map(r => <option key={r.symbol} value={r.symbol}>{r.symbol} (T½ {r.halfLifeMin}min)</option>)}
</select>
</div>
</div>
{/* Row 3 */}
<div className="grid grid-cols-3 gap-4">
<div>
<label className="block text-sm font-medium text-gray-700">Actividad (MBq) *</label>
<input type="number" step="0.1" value={examForm.administered_mbq} onChange={e => setExamForm(f => ({ ...f, administered_mbq: Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
{errors.administered_mbq && <p className="text-red-600 text-xs mt-1">{errors.administered_mbq}</p>}
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Peso (kg)</label>
<input type="number" step="0.1" value={examForm.patient_weight_kg ?? ""} onChange={e => setExamForm(f => ({ ...f, patient_weight_kg: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Captación (min) *</label>
<input type="number" value={examForm.uptake_minutes} onChange={e => setExamForm(f => ({ ...f, uptake_minutes: Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
</div>
{/* Row 4 */}
<div>
<label className="block text-sm font-medium text-gray-700">Fecha/Hora Inyección *</label>
<input type="datetime-local" value={examForm.injection_datetime} onChange={e => setExamForm(f => ({ ...f, injection_datetime: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
{errors.injection_datetime && <p className="text-red-600 text-xs mt-1">{errors.injection_datetime}</p>}
</div>
{/* Row 5 */}
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-sm font-medium text-gray-700">Operador *</label>
<input type="text" value={examForm.operator} onChange={e => setExamForm(f => ({ ...f, operator: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
{errors.operator && <p className="text-red-600 text-xs mt-1">{errors.operator}</p>}
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Médico Prescriptor *</label>
<input type="text" value={examForm.prescribing_physician} onChange={e => setExamForm(f => ({ ...f, prescribing_physician: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
{errors.prescribing_physician && <p className="text-red-600 text-xs mt-1">{errors.prescribing_physician}</p>}
</div>
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Notas</label>
<textarea value={examForm.notes ?? ""} onChange={e => setExamForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
<div className="flex gap-3">
<button type="submit" disabled={createExamM.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
{createExamM.isPending ? "Guardando..." : "Registrar Examen"}
</button>
<button type="button" onClick={() => setTab("exams")} className="px-6 py-2 border rounded-lg text-sm font-medium">Cancelar</button>
</div>
{createExamM.isError && <p className="text-red-600 text-sm">Error al guardar el examen.</p>}
</form>
</div>
)}

{/* ── NEW QC FORM ── */}
{tab === "new-qc" && (
<div className="max-w-lg">
<h2 className="text-lg font-semibold mb-4">Registro QC Diario PET/CT</h2>
<form onSubmit={handleQcSubmit} className="space-y-4">
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-sm font-medium text-gray-700">Fecha *</label>
<input type="date" value={qcForm.qc_date} onChange={e => setQcForm(f => ({ ...f, qc_date: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Phantom</label>
<input type="text" value={qcForm.phantom_type} onChange={e => setQcForm(f => ({ ...f, phantom_type: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="flex items-center gap-3 mt-4">
<input type="checkbox" id="uniformity" checked={qcForm.uniformity_pass} onChange={e => setQcForm(f => ({ ...f, uniformity_pass: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
<label htmlFor="uniformity" className="text-sm font-medium text-gray-700">Uniformidad OK</label>
</div>
<div className="flex items-center gap-3 mt-4">
<input type="checkbox" id="image_quality" checked={qcForm.image_quality_pass} onChange={e => setQcForm(f => ({ ...f, image_quality_pass: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
<label htmlFor="image_quality" className="text-sm font-medium text-gray-700">Calidad imagen OK</label>
</div>
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Count Rate (Mcps)</label>
<input type="number" step="0.01" value={qcForm.count_rate_mcps ?? ""} onChange={e => setQcForm(f => ({ ...f, count_rate_mcps: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Operador *</label>
<input type="text" value={qcForm.performed_by} onChange={e => setQcForm(f => ({ ...f, performed_by: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
{errors.performed_by && <p className="text-red-600 text-xs mt-1">{errors.performed_by}</p>}
</div>
<div>
<label className="block text-sm font-medium text-gray-700">Comentarios</label>
<textarea value={qcForm.comments ?? ""} onChange={e => setQcForm(f => ({ ...f, comments: e.target.value }))} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
</div>
<div className="flex gap-3">
<button type="submit" disabled={createQcM.isPending} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
{createQcM.isPending ? "Guardando..." : "Guardar QC"}
</button>
<button type="button" onClick={() => setTab("qc")} className="px-6 py-2 border rounded-lg text-sm font-medium">Cancelar</button>
</div>
{createQcM.isError && <p className="text-red-600 text-sm">Error al guardar el QC.</p>}
</form>
</div>
)}
</div>
);
  }
