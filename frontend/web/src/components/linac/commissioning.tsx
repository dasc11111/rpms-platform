"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Upload, Download, Eye, Trash2, Star } from "lucide-react";

const CATEGORIES = [
  { value: "fotones", label: "Fotones" },
  { value: "electrones", label: "Electrones" },
  { value: "mlc", label: "MLC" },
  { value: "colimadores", label: "Colimadores" },
  { value: "epid", label: "EPID" },
  { value: "cbct", label: "CBCT" },
  { value: "mesa", label: "Mesa de tratamiento" },
  { value: "imagenes", label: "Sistemas de imagenes" },
];
const MEASUREMENT_TYPES = [
  { value: "factor_salida", label: "Factor de salida" },
  { value: "pdd", label: "PDD" },
  { value: "tpr", label: "TPR" },
  { value: "perfil", label: "Perfil de haz" },
  { value: "simetria", label: "Simetria" },
  { value: "planicidad", label: "Planicidad" },
  { value: "factor_cuna", label: "Factor de cuna" },
  { value: "factor_bandeja", label: "Factor de bandeja" },
  { value: "factor_campo_pequeno", label: "Factor de campo pequeno" },
  { value: "curva", label: "Curva" },
  { value: "matriz", label: "Matriz de datos" },
  { value: "otro", label: "Otro" },
];
const DOC_CATEGORIES = [
  { value: "informe", label: "Informe tecnico" },
  { value: "archivo_datos", label: "Archivo de datos" },
  { value: "grafico", label: "Grafico" },
  { value: "otro", label: "Otro" },
];

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const labelCls = "text-xs text-muted-foreground";

export function CommissioningTab({ unitId, unit, actorEmail }: any) {
  const [category, setCategory] = useState(CATEGORIES[0]!.value);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const loadDatasets = useCallback(async () => {
    if (!unitId) return;
    const res = await fetch("/api/linac/commissioning?linacId=" + unitId + "&category=" + category);
    const data = await res.json();
    if (data.ok) setDatasets(data.datasets);
  }, [unitId, category]);

  useEffect(() => { loadDatasets(); setSelected(null); }, [loadDatasets]);

  const loadDocuments = useCallback(async (datasetId: number) => {
    const res = await fetch("/api/linac/commissioning/documents?datasetId=" + datasetId);
    const data = await res.json();
    if (data.ok) setDocuments(data.documents);
  }, []);

  useEffect(() => {
    if (selected) loadDocuments(selected.id);
    else setDocuments([]);
  }, [selected, loadDocuments]);

  const visible = showHistory ? datasets : datasets.filter((d: any) => d.is_current);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)} className={"rounded px-2.5 py-1.5 text-xs " + (category === c.value ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}>
            {c.label}
          </button>
        ))}
      </div>

      <NewDatasetPanel unitId={unitId} category={category} actorEmail={actorEmail} onSaved={loadDatasets} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Datos de Commissioning - {CATEGORIES.find((c) => c.value === category)?.label}</p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          Mostrar versiones anteriores
        </label>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">Fecha</th><th className="p-1">Tipo de medicion</th><th className="p-1">Modalidad</th><th className="p-1">Energia</th>
              <th className="p-1">Version</th><th className="p-1">Baseline</th><th className="p-1">Estado</th><th className="p-1">Responsable</th><th className="p-1">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-1 text-foreground">{String(d.measurement_date).slice(0, 10)}</td>
                <td className="p-1 text-foreground">{MEASUREMENT_TYPES.find((m) => m.value === d.measurement_type)?.label || d.measurement_type}</td>
                <td className="p-1 text-foreground">{d.modality || "-"}</td>
                <td className="p-1 text-foreground">{d.energy || "-"}</td>
                <td className="p-1 text-foreground">v{d.version}{!d.is_current && " (historica)"}</td>
                <td className="p-1">{d.is_baseline ? <span className="flex items-center gap-1 text-warning"><Star className="h-3 w-3" /> Baseline</span> : "-"}</td>
                <td className="p-1 text-foreground">{d.status === "finalizado" ? <span className="text-success">Finalizado</span> : <span className="text-muted-foreground">Borrador</span>}</td>
                <td className="p-1 text-foreground">{d.measured_by || "-"}</td>
                <td className="p-1"><button onClick={() => setSelected(d)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">Ver</button></td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={9} className="p-2 text-center text-muted-foreground">Sin datos de commissioning para esta categoria</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <DatasetDetail dataset={selected} documents={documents} actorEmail={actorEmail} onClose={() => setSelected(null)} onUpdated={() => { loadDatasets(); loadDocuments(selected.id); }} />
      )}
    </div>
  );
}

function NewDatasetPanel({ unitId, category, actorEmail, onSaved }: any) {
  const [measurementType, setMeasurementType] = useState(MEASUREMENT_TYPES[0]!.value);
  const [modality, setModality] = useState("");
  const [energy, setEnergy] = useState("");
  const [measurementDate, setMeasurementDate] = useState("");
  const [measuredBy, setMeasuredBy] = useState("");
  const [instrumentUsed, setInstrumentUsed] = useState("");
  const [points, setPoints] = useState<any[]>([{ x: "", y: "", unit: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function setPoint(idx: number, key: string, value: string) {
    setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }
  function addPoint() { setPoints((prev) => [...prev, { x: "", y: "", unit: "" }]); }
  function removePoint(idx: number) { setPoints((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleSave() {
    if (!unitId || !measurementDate) return;
    setSaving(true);
    try {
      await fetch("/api/linac/commissioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linacId: unitId, category, measurementType, modality, energy, measurementDate, measuredBy, instrumentUsed,
          data: { points: points.filter((p) => p.x !== "" || p.y !== "") }, notes, actorEmail,
        }),
      });
      setMeasurementDate(""); setMeasuredBy(""); setInstrumentUsed(""); setPoints([{ x: "", y: "", unit: "" }]); setNotes("");
      onSaved && onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-sm font-semibold text-foreground">Registrar dataset de Commissioning</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <select className={inputCls} value={measurementType} onChange={(e) => setMeasurementType(e.target.value)}>
          {MEASUREMENT_TYPES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
        </select>
        <input className={inputCls} placeholder="Modalidad (FFF, VMAT, etc)" value={modality} onChange={(e) => setModality(e.target.value)} />
        <input className={inputCls} placeholder="Energia (6MV, 6MeV...)" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        <input type="date" className={inputCls} value={measurementDate} onChange={(e) => setMeasurementDate(e.target.value)} />
        <input className={inputCls} placeholder="Responsable" value={measuredBy} onChange={(e) => setMeasuredBy(e.target.value)} />
        <input className={inputCls} placeholder="Instrumento utilizado" value={instrumentUsed} onChange={(e) => setInstrumentUsed(e.target.value)} />
      </div>

      <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Puntos de datos (posicion/campo vs valor medido)</p>
      <div className="space-y-2">
        {points.map((p, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input className={inputCls} placeholder="X (profundidad/campo/posicion)" value={p.x} onChange={(e) => setPoint(idx, "x", e.target.value)} />
            <input className={inputCls} placeholder="Y (valor medido)" value={p.y} onChange={(e) => setPoint(idx, "y", e.target.value)} />
            <input className={inputCls} placeholder="Unidad" value={p.unit} onChange={(e) => setPoint(idx, "unit", e.target.value)} />
            <button onClick={() => removePoint(idx)} className="flex items-center justify-center gap-1 rounded border border-border text-xs text-danger hover:bg-background"><Trash2 className="h-3.5 w-3.5" /> Quitar</button>
          </div>
        ))}
      </div>
      <button onClick={addPoint} className="mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"><Plus className="h-3.5 w-3.5" /> Agregar punto</button>

      <textarea className={inputCls + " mt-2"} rows={2} placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button onClick={handleSave} disabled={saving || !unitId} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
        {saving ? "Guardando..." : "Registrar dataset"}
      </button>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada dataset finalizado podra marcarse como Linea Base Oficial en el modulo de Baseline. La informacion original nunca se sobrescribe: los cambios generan una nueva version.
      </p>
    </div>
  );
}

function DatasetDetail({ dataset, documents, actorEmail, onClose, onUpdated }: any) {
  const [category, setCategory] = useState(DOC_CATEGORIES[0]!.value);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const points = Array.isArray(dataset.data?.points) ? dataset.data.points : [];

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("datasetId", String(dataset.id));
      form.set("category", category);
      form.set("title", title || file.name);
      form.set("uploadedBy", actorEmail || "");
      form.set("file", file);
      await fetch("/api/linac/commissioning/documents", { method: "POST", body: form });
      setTitle(""); setFile(null);
      onUpdated && onUpdated();
    } finally { setUploading(false); }
  }

  async function handleAction(action: string) {
    setBusy(true);
    try {
      await fetch("/api/linac/commissioning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dataset.id, action, actorEmail }),
      });
      onUpdated && onUpdated();
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Detalle - {MEASUREMENT_TYPES.find((m) => m.value === dataset.measurement_type)?.label} ({String(dataset.measurement_date).slice(0, 10)}, v{dataset.version})
        </p>
        <div className="flex gap-1">
          {dataset.status !== "finalizado" && (
            <button onClick={() => handleAction("finalize")} disabled={busy} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background disabled:opacity-50">Finalizar</button>
          )}
          {!dataset.is_baseline && (
            <button onClick={() => handleAction("mark_baseline")} disabled={busy} className="rounded border border-border px-2 py-1 text-xs text-warning hover:bg-background disabled:opacity-50">Marcar como Linea Base</button>
          )}
          <button onClick={onClose} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">Cerrar</button>
        </div>
      </div>

      <table className="mt-2 w-full text-xs">
        <thead><tr className="text-left text-muted-foreground"><th className="p-1">X</th><th className="p-1">Y</th><th className="p-1">Unidad</th></tr></thead>
        <tbody>
          {points.map((p: any, idx: number) => (
            <tr key={idx} className="border-t border-border">
              <td className="p-1 text-foreground">{p.x}</td><td className="p-1 text-foreground">{p.y}</td><td className="p-1 text-foreground">{p.unit || "-"}</td>
            </tr>
          ))}
          {points.length === 0 && (<tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Sin puntos registrados</td></tr>)}
        </tbody>
      </table>

      {dataset.notes && (<p className="mt-2 text-xs text-foreground"><span className="text-muted-foreground">Notas: </span>{dataset.notes}</p>)}

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Documentos (informes, archivos de datos originales, graficos)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOC_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </select>
          <input className={inputCls} placeholder="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button onClick={handleUpload} disabled={uploading || !file} className="flex items-center justify-center gap-1 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Subiendo..." : "Cargar"}
          </button>
        </div>
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="p-1">Categoria</th><th className="p-1">Titulo</th><th className="p-1">Archivo</th></tr></thead>
          <tbody>
            {documents.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-1 text-foreground">{DOC_CATEGORIES.find((c) => c.value === d.category)?.label || d.category}</td>
                <td className="p-1 text-foreground">{d.title || d.file_name}</td>
                <td className="p-1">
                  <div className="flex gap-1">
                    <a href={"/api/linac/download?table=commissioning_documents&id=" + d.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Vista previa"><Eye className="h-3 w-3" /></a>
                    <a href={"/api/linac/download?table=commissioning_documents&id=" + d.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Descargar"><Download className="h-3 w-3" /></a>
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (<tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Sin documentos adjuntos</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
