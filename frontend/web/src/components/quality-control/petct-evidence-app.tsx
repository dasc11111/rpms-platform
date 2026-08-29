"use client";

import { useState } from "react";

/**
* MODULO 4 - PET/CT - FASE J
* Evidencia grafica asociada a un control o al equipo (seccion 23 del
* prompt de mejora). El archivo en si se administra fuera de este modulo
* (almacenamiento externo de blobs); aqui solo se registra la
* referencia/URL del archivo y sus metadatos. No se realiza carga de
* archivos desde esta pantalla.
*
* FASE O: se agregaron los tipos imagen_pet / imagen_ct / imagen_fusion
* para que la evidencia pueda clasificarse por modalidad y alimentar la
* vista integrada de comparacion PET+CT+Fusion (seccion 24 del prompt de
* mejora, pagina /quality-control/petct/comparison). Es una extension
* aditiva del vocabulario existente; no cambia el modelo de datos ni el
* comportamiento de los tipos ya existentes.
*/

type Equipment = {
id: number;
manufacturer: string | null;
model: string | null;
internal_code: string | null;
};

type CatalogEntry = {
test_code: string;
test_name: string;
};

type EvidenceRecord = {
id: number;
test_id: number | null;
equipment_id: number | null;
evidence_type: string;
file_name: string | null;
file_url: string | null;
description: string | null;
uploaded_by: string | null;
uploaded_at: string;
};

const EVIDENCE_TYPES = [
{ value: "foto_equipo", label: "Fotografia del equipo" },
{ value: "captura_pantalla", label: "Captura de pantalla / consola" },
{ value: "imagen_pet", label: "Imagen PET (para comparacion Fase O)" },
{ value: "imagen_ct", label: "Imagen CT (para comparacion Fase O)" },
{ value: "imagen_fusion", label: "Imagen Fusion PET/CT (para comparacion Fase O)" },
{ value: "informe_maniqui", label: "Imagen o informe del maniqui/fantoma" },
{ value: "orden_trabajo", label: "Orden de trabajo / servicio tecnico" },
{ value: "otro", label: "Otro" },
];

function equipmentLabel(eq: Equipment | undefined): string {
if (!eq) return "General (sin equipo especifico)";
return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

const emptyForm = {
test_id: "",
evidence_type: "foto_equipo",
file_name: "",
file_url: "",
description: "",
uploaded_by: "",
};
export default function PetCtEvidenceApp({ equipment, catalog }: { equipment: Equipment[]; catalog: CatalogEntry[] }) {
const [equipmentId, setEquipmentId] = useState<number | "">("");
const [filterTestId, setFilterTestId] = useState("");
const [records, setRecords] = useState<EvidenceRecord[]>([]);
const [queried, setQueried] = useState(false);
const [showForm, setShowForm] = useState(false);
const [form, setForm] = useState(emptyForm);
const [loading, setLoading] = useState(false);
const [message, setMessage] = useState<string | null>(null);

function updateField<K extends keyof typeof emptyForm>(key: K, value: string) {
setForm((prev) => ({ ...prev, [key]: value }));
}

async function loadEvidence() {
setLoading(true);
setMessage(null);
try {
const params = new URLSearchParams();
if (equipmentId) params.set("equipmentId", String(equipmentId));
if (filterTestId) params.set("testId", filterTestId);
const res = await fetch(`/api/quality-control/petct/evidence?${params.toString()}`);
const data = await res.json();
setRecords(Array.isArray(data) ? data : []);
setQueried(true);
} finally {
setLoading(false);
}
}
async function handleSubmit(e: React.FormEvent) {
e.preventDefault();
if (!form.file_url) {
setMessage("Se requiere la URL de referencia del archivo (almacenado externamente).");
return;
}
setLoading(true);
setMessage(null);
try {
const res = await fetch("/api/quality-control/petct/evidence", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
equipment_id: equipmentId || null,
test_id: form.test_id === "" ? null : Number(form.test_id),
evidence_type: form.evidence_type,
file_name: form.file_name || null,
file_url: form.file_url,
description: form.description || null,
uploaded_by: form.uploaded_by || null,
}),
});
if (!res.ok) throw new Error("Error al guardar");
setMessage("Evidencia registrada correctamente.");
setForm(emptyForm);
setShowForm(false);
await loadEvidence();
} catch {
setMessage("Ocurrio un error al registrar la evidencia.");
} finally {
setLoading(false);
}
}

return (
<div className="max-w-4xl mx-auto p-6 space-y-6">
<div>
<h1 className="text-2xl font-bold">Evidencia Grafica PET/CT</h1>
<p className="text-sm text-gray-500">
Modulo 4 - Fase J (seccion 23 del prompt de mejora). Referencia y metadatos de evidencia
asociada a un control o al equipo. El archivo se administra en almacenamiento externo;
aqui solo se guarda su URL de referencia. Use los tipos Imagen PET / Imagen CT / Imagen
Fusion para que la evidencia aparezca en la vista de Comparacion PET+CT+Fusion (Fase O).
</p>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-4">
<div>
<label className="text-sm font-medium block mb-1">Equipo</label>
<select
className="w-full border rounded px-2 py-1 text-sm"
value={equipmentId}
onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
>
<option value="">Todos / General</option>
{equipment.map((eq) => (
<option key={eq.id} value={eq.id}>
{equipmentLabel(eq)}
</option>
))}
</select>
</div>
<div>
<label className="text-sm font-medium block mb-1">ID de prueba (opcional)</label>
<input
type="number"
className="w-full border rounded px-2 py-1 text-sm"
value={filterTestId}
onChange={(e) => setFilterTestId(e.target.value)}
/>
</div>
<div className="flex items-end gap-2">
<button type="button" onClick={loadEvidence} disabled={loading} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">
{loading ? "Consultando..." : "Consultar evidencia"}
</button>
<button type="button" onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm">
{showForm ? "Cancelar" : "Registrar evidencia"}
</button>
</div>
</div>

{message && <p className="text-sm text-gray-600">{message}</p>}

{showForm && (
<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4">
<div>
<label className="text-sm font-medium block mb-1">Tipo de evidencia</label>
<select
className="w-full border rounded px-2 py-1 text-sm"
value={form.evidence_type}
onChange={(e) => updateField("evidence_type", e.target.value)}
>
{EVIDENCE_TYPES.map((t) => (
<option key={t.value} value={t.value}>
{t.label}
</option>
))}
</select>
</div>
<div>
<label className="text-sm font-medium block mb-1">ID de prueba asociada (opcional)</label>
<input
type="number"
className="w-full border rounded px-2 py-1 text-sm"
value={form.test_id}
onChange={(e) => updateField("test_id", e.target.value)}
/>
</div>
<div>
<label className="text-sm font-medium block mb-1">Nombre del archivo</label>
<input
type="text"
className="w-full border rounded px-2 py-1 text-sm"
value={form.file_name}
onChange={(e) => updateField("file_name", e.target.value)}
/>
</div>
<div>
<label className="text-sm font-medium block mb-1">URL de referencia del archivo *</label>
<input
type="text"
placeholder="https://..."
className="w-full border rounded px-2 py-1 text-sm"
value={form.file_url}
onChange={(e) => updateField("file_url", e.target.value)}
/>
</div>
<div className="md:col-span-2">
<label className="text-sm font-medium block mb-1">Descripcion</label>
<textarea
className="w-full border rounded px-2 py-1 text-sm"
rows={2}
value={form.description}
onChange={(e) => updateField("description", e.target.value)}
/>
</div>
<div>
<label className="text-sm font-medium block mb-1">Registrado por</label>
<input
type="text"
className="w-full border rounded px-2 py-1 text-sm"
value={form.uploaded_by}
onChange={(e) => updateField("uploaded_by", e.target.value)}
/>
</div>
<div className="md:col-span-2">
<button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 text-white text-sm">
{loading ? "Guardando..." : "Guardar referencia de evidencia"}
</button>
</div>
</form>
)}

{queried && (
<div className="border rounded-lg p-4">
<h2 className="font-semibold text-sm mb-2">Evidencia registrada</h2>
{records.length === 0 && <p className="text-xs text-gray-500">No hay evidencia para el filtro seleccionado.</p>}
<div className="space-y-2">
{records.map((r) => {
const typeLabel = EVIDENCE_TYPES.find((t) => t.value === r.evidence_type)?.label ?? r.evidence_type;
const eq = equipment.find((e) => e.id === r.equipment_id);
return (
<div key={r.id} className="border rounded p-2 text-xs space-y-1">
<div className="flex flex-wrap items-center gap-2">
<span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
{typeLabel}
</span>
{r.file_url && (
<a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
{r.file_name || r.file_url}
</a>
)}
<span className="text-gray-500">{new Date(r.uploaded_at).toLocaleString()}</span>
</div>
<div className="text-gray-600">
{eq && <span className="mr-3">Equipo: {equipmentLabel(eq)}</span>}
{r.test_id && <span className="mr-3">ID de prueba: {r.test_id}</span>}
{r.uploaded_by && <span className="mr-3">Registrado por: {r.uploaded_by}</span>}
</div>
{r.description && <div className="text-gray-600">{r.description}</div>}
</div>
);
})}
</div>
</div>
)}
</div>
);
}
