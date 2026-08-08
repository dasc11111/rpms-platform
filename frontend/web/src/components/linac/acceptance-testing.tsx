"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Upload, Download, Eye, Trash2 } from "lucide-react";

const DOC_CATEGORIES = [
  { value: "informe", label: "Informe tecnico" },
  { value: "certificado", label: "Certificado" },
  { value: "fotografia", label: "Fotografia" },
  { value: "otro", label: "Otro" },
];
const RESULT_OPTIONS = [
  { value: "cumple", label: "Cumple" },
  { value: "cumple_observaciones", label: "Cumple con observaciones" },
  { value: "no_cumple", label: "No cumple" },
];
const RESULT_COLORS: Record<string, string> = {
  cumple: "text-success",
  cumple_observaciones: "text-warning",
  no_cumple: "text-danger",
};

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const labelCls = "text-xs text-muted-foreground";

export function AcceptanceTestingTab({ unitId, unit, actorEmail }: any) {
  const [view, setView] = useState("tests");
  const [protocols, setProtocols] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const loadProtocols = useCallback(async () => {
    const res = await fetch("/api/linac/acceptance/protocols");
    const data = await res.json();
    if (data.ok) setProtocols(data.protocols);
  }, []);

  const loadTests = useCallback(async () => {
    if (!unitId) return;
    const res = await fetch("/api/linac/acceptance?linacId=" + unitId);
    const data = await res.json();
    if (data.ok) setTests(data.tests);
  }, [unitId]);

  useEffect(() => { loadProtocols(); }, [loadProtocols]);
  useEffect(() => { loadTests(); setSelectedTest(null); }, [loadTests]);

  const loadDocuments = useCallback(async (testId: number) => {
    const res = await fetch("/api/linac/acceptance/documents?acceptanceTestId=" + testId);
    const data = await res.json();
    if (data.ok) setDocuments(data.documents);
  }, []);

  useEffect(() => {
    if (selectedTest) loadDocuments(selectedTest.id);
    else setDocuments([]);
  }, [selectedTest, loadDocuments]);

  const visibleTests = showHistory ? tests : tests.filter((t: any) => t.is_current);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-2">
        <button onClick={() => setView("tests")} className={"rounded px-2.5 py-1.5 text-xs " + (view === "tests" ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}>Pruebas de Aceptacion</button>
        <button onClick={() => setView("protocols")} className={"rounded px-2.5 py-1.5 text-xs " + (view === "protocols" ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}>Protocolos por Fabricante/Modelo</button>
      </div>

      {view === "protocols" && (
        <ProtocolsPanel protocols={protocols} actorEmail={actorEmail} unit={unit} onSaved={loadProtocols} />
      )}

      {view === "tests" && (
        <div className="space-y-4">
          <NewTestPanel unitId={unitId} protocols={protocols} actorEmail={actorEmail} onSaved={loadTests} />

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Historial de Acceptance Testing</p>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
              Mostrar versiones anteriores
            </label>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1">Fecha</th><th className="p-1">Protocolo</th><th className="p-1">Version</th>
                  <th className="p-1">Empresa</th><th className="p-1">Responsable</th><th className="p-1">Resultado</th><th className="p-1">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibleTests.map((t: any) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-1 text-foreground">{String(t.test_date).slice(0, 10)}</td>
                    <td className="p-1 text-foreground">{t.protocol_name || "-"}</td>
                    <td className="p-1 text-foreground">v{t.version}{!t.is_current && " (historica)"}</td>
                    <td className="p-1 text-foreground">{t.company || "-"}</td>
                    <td className="p-1 text-foreground">{t.performed_by || "-"}</td>
                    <td className={"p-1 font-medium " + (RESULT_COLORS[t.overall_result] || "text-foreground")}>
                      {RESULT_OPTIONS.find((r) => r.value === t.overall_result)?.label || t.overall_result}
                    </td>
                    <td className="p-1">
                      <button onClick={() => setSelectedTest(t)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">Ver</button>
                    </td>
                  </tr>
                ))}
                {visibleTests.length === 0 && (
                  <tr><td colSpan={7} className="p-2 text-center text-muted-foreground">Sin registros de Acceptance Testing</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedTest && (
            <TestDetail test={selectedTest} documents={documents} actorEmail={actorEmail} onClose={() => setSelectedTest(null)} onUploaded={() => loadDocuments(selectedTest.id)} />
          )}
        </div>
      )}
    </div>
  );
}

function NewTestPanel({ unitId, protocols, actorEmail, onSaved }: any) {
  const [protocolId, setProtocolId] = useState("");
  const [testDate, setTestDate] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [company, setCompany] = useState("");
  const [observations, setObservations] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  function selectProtocol(id: string) {
    setProtocolId(id);
    const proto = protocols.find((p: any) => String(p.id) === id);
    const items = proto?.items || [];
    setResults(items.map((it: any) => ({ item: it.item, specification: it.specification, tolerance: it.tolerance, norm: it.norm, measuredValue: "", result: "", comment: "" })));
  }

  function setResultField(idx: number, key: string, value: string) {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  async function handleSave() {
    if (!unitId || !testDate) return;
    setSaving(true);
    try {
      await fetch("/api/linac/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linacId: unitId, protocolId: protocolId || null, testDate, performedBy, company, observations, results, actorEmail,
        }),
      });
      setTestDate(""); setPerformedBy(""); setCompany(""); setObservations(""); setResults([]); setProtocolId("");
      onSaved && onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-sm font-semibold text-foreground">Registrar Acceptance Testing</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className={inputCls} value={protocolId} onChange={(e) => selectProtocol(e.target.value)}>
          <option value="">Sin protocolo (libre)</option>
          {protocols.map((p: any) => (
            <option key={p.id} value={p.id}>{p.manufacturer} {p.model} - {p.protocol_name}</option>
          ))}
        </select>
        <input type="date" className={inputCls} value={testDate} onChange={(e) => setTestDate(e.target.value)} />
        <input className={inputCls} placeholder="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className={inputCls} placeholder="Responsable" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
      </div>

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Resultados por item (comparacion automatica con especificacion/tolerancia)</p>
          {results.map((r, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-6 rounded border border-border p-2">
              <div className="text-xs text-foreground sm:col-span-2">
                <p className="font-medium">{r.item}</p>
                <p className="text-muted-foreground">Spec: {r.specification || "-"} | Tol: {r.tolerance || "-"} | Norma: {r.norm || "-"}</p>
              </div>
              <input className={inputCls} placeholder="Valor medido" value={r.measuredValue} onChange={(e) => setResultField(idx, "measuredValue", e.target.value)} />
              <select className={inputCls} value={r.result || ""} onChange={(e) => setResultField(idx, "result", e.target.value)}>
                <option value="">Sugerir automaticamente</option>
                {RESULT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              <input className={inputCls + " sm:col-span-2"} placeholder="Comentario / observacion" value={r.comment} onChange={(e) => setResultField(idx, "comment", e.target.value)} />
            </div>
          ))}
        </div>
      )}

      <input className={inputCls + " mt-2"} placeholder="Observaciones generales" value={observations} onChange={(e) => setObservations(e.target.value)} />
      <button onClick={handleSave} disabled={saving || !unitId} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
        {saving ? "Guardando..." : "Registrar Acceptance Testing"}
      </button>
      <p className="mt-1 text-xs text-muted-foreground">
        El resultado final (Cumple / Cumple con observaciones / No cumple) se calcula automaticamente segun los items y puede complementarse con firma electronica en una fase futura.
      </p>
    </div>
  );
}

function TestDetail({ test, documents, actorEmail, onClose, onUploaded }: any) {
  const [category, setCategory] = useState(DOC_CATEGORIES[0].value);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const results = Array.isArray(test.results) ? test.results : [];

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("acceptanceTestId", String(test.id));
      form.set("category", category);
      form.set("title", title || file.name);
      form.set("uploadedBy", actorEmail || "");
      form.set("file", file);
      await fetch("/api/linac/acceptance/documents", { method: "POST", body: form });
      setTitle(""); setFile(null);
      onUploaded && onUploaded();
    } finally { setUploading(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Detalle Acceptance Testing - {String(test.test_date).slice(0, 10)} (v{test.version})
        </p>
        <button onClick={onClose} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">Cerrar</button>
      </div>

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="p-1">Item</th><th className="p-1">Especificacion</th><th className="p-1">Tolerancia</th>
            <th className="p-1">Norma</th><th className="p-1">Medido</th><th className="p-1">Resultado</th><th className="p-1">Comentario</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r: any, idx: number) => (
            <tr key={idx} className="border-t border-border">
              <td className="p-1 text-foreground">{r.item}</td>
              <td className="p-1 text-foreground">{r.specification || "-"}</td>
              <td className="p-1 text-foreground">{r.tolerance || "-"}</td>
              <td className="p-1 text-foreground">{r.norm || "-"}</td>
              <td className="p-1 text-foreground">{r.measuredValue || "-"}</td>
              <td className={"p-1 font-medium " + (RESULT_COLORS[r.result] || "text-muted-foreground")}>
                {RESULT_OPTIONS.find((o) => o.value === r.result)?.label || "Pendiente"}
              </td>
              <td className="p-1 text-foreground">{r.comment || "-"}</td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr><td colSpan={7} className="p-2 text-center text-muted-foreground">Sin items registrados</td></tr>
          )}
        </tbody>
      </table>

      {test.observations && (
        <p className="mt-2 text-xs text-foreground"><span className="text-muted-foreground">Observaciones: </span>{test.observations}</p>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Documentos (informes tecnicos, certificados, fotografias). Vista previa disponible al abrir el archivo. OCR: disponible en una fase futura, requiere un servicio de OCR configurado.
        </p>
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
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Categoria</th><th className="p-1">Titulo</th><th className="p-1">Archivo</th>
          </tr></thead>
          <tbody>
            {documents.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-1 text-foreground">{DOC_CATEGORIES.find((c) => c.value === d.category)?.label || d.category}</td>
                <td className="p-1 text-foreground">{d.title || d.file_name}</td>
                <td className="p-1">
                  <div className="flex gap-1">
                    <a href={"/api/linac/download?table=acceptance_documents&id=" + d.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Vista previa"><Eye className="h-3 w-3" /></a>
                    <a href={"/api/linac/download?table=acceptance_documents&id=" + d.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Descargar"><Download className="h-3 w-3" /></a>
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Sin documentos adjuntos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProtocolsPanel({ protocols, actorEmail, unit, onSaved }: any) {
  const [manufacturer, setManufacturer] = useState(unit?.manufacturer || "");
  const [model, setModel] = useState(unit?.model || "");
  const [protocolName, setProtocolName] = useState("");
  const [applicableNorms, setApplicableNorms] = useState("");
  const [items, setItems] = useState<any[]>([{ item: "", specification: "", tolerance: "", norm: "" }]);
  const [saving, setSaving] = useState(false);

  function setItem(idx: number, key: string, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }
  function addItem() { setItems((prev) => [...prev, { item: "", specification: "", tolerance: "", norm: "" }]); }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleSave() {
    if (!manufacturer || !model || !protocolName) return;
    setSaving(true);
    try {
      await fetch("/api/linac/acceptance/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturer, model, protocolName, applicableNorms, items: items.filter((it) => it.item.trim()), actorEmail }),
      });
      setProtocolName(""); setApplicableNorms(""); setItems([{ item: "", specification: "", tolerance: "", norm: "" }]);
      onSaved && onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Nuevo protocolo de Acceptance Testing</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={labelCls}>Fabricante</label><input className={inputCls} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></div>
          <div><label className={labelCls}>Modelo</label><input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} /></div>
          <div><label className={labelCls}>Nombre del protocolo</label><input className={inputCls} value={protocolName} onChange={(e) => setProtocolName(e.target.value)} placeholder="Acceptance Testing IEC 60601-2-1" /></div>
          <div><label className={labelCls}>Normas aplicables</label><input className={inputCls} value={applicableNorms} onChange={(e) => setApplicableNorms(e.target.value)} placeholder="IEC 60601-2-1, TG-142" /></div>
        </div>

        <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Items de prueba</p>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              <input className={inputCls} placeholder="Item / parametro" value={it.item} onChange={(e) => setItem(idx, "item", e.target.value)} />
              <input className={inputCls} placeholder="Especificacion fabricante" value={it.specification} onChange={(e) => setItem(idx, "specification", e.target.value)} />
              <input className={inputCls} placeholder="Tolerancia (ej: +/-2, 2-5, >=0.9)" value={it.tolerance} onChange={(e) => setItem(idx, "tolerance", e.target.value)} />
              <input className={inputCls} placeholder="Norma aplicable" value={it.norm} onChange={(e) => setItem(idx, "norm", e.target.value)} />
              <button onClick={() => removeItem(idx)} className="flex items-center justify-center gap-1 rounded border border-border text-xs text-danger hover:bg-background"><Trash2 className="h-3.5 w-3.5" /> Quitar</button>
            </div>
          ))}
        </div>
        <button onClick={addItem} className="mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"><Plus className="h-3.5 w-3.5" /> Agregar item</button>
        <div>
          <button onClick={handleSave} disabled={saving} className="mt-3 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar protocolo"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Protocolos registrados</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Fabricante</th><th className="p-1">Modelo</th><th className="p-1">Protocolo</th><th className="p-1">Normas</th><th className="p-1">Items</th>
          </tr></thead>
          <tbody>
            {protocols.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-1 text-foreground">{p.manufacturer}</td>
                <td className="p-1 text-foreground">{p.model}</td>
                <td className="p-1 text-foreground">{p.protocol_name}</td>
                <td className="p-1 text-foreground">{p.applicable_norms || "-"}</td>
                <td className="p-1 text-foreground">{Array.isArray(p.items) ? p.items.length : 0}</td>
              </tr>
            ))}
            {protocols.length === 0 && (
              <tr><td colSpan={5} className="p-2 text-center text-muted-foreground">Sin protocolos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
