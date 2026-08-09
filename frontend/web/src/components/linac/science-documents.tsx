"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, UploadCloud, ExternalLink, RefreshCw, Link2, History, CheckCircle2, XCircle } from "lucide-react";

const DOC_TYPES: string[] = [
  "Normativa",
  "Protocolo institucional",
  "Guia",
  "Informe",
  "Publicacion cientifica",
  "Documento institucional",
  "Documentacion del fabricante",
  "Otro",
];

const ORGANISM_SUGGESTIONS: string[] = [
  "ARPANSA", "IAEA", "IEC", "AAPM", "ICRU", "CCHEN", "SEREMI", "ISP", "Fabricante", "Institucional", "Otro",
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  vigente: { label: "Vigente", cls: "text-success" },
  proxima_revision: { label: "Proxima a revision", cls: "text-warning" },
  requiere_revision: { label: "Requiere actualizacion", cls: "text-warning" },
  obsoleto: { label: "Obsoleto", cls: "text-danger" },
  historico: { label: "Historico", cls: "text-muted-foreground" },
};

const RELATION_TYPES: { value: string; label: string }[] = [
  { value: "relacionado", label: "Relacionado" },
  { value: "anexo", label: "Anexo" },
  { value: "addendum", label: "Addendum" },
  { value: "correccion", label: "Correccion" },
  { value: "circular", label: "Circular" },
  { value: "guia", label: "Guia" },
  { value: "interpretacion", label: "Interpretacion" },
  { value: "protocolo", label: "Protocolo" },
];

const EMPTY_UPLOAD: any = {
  docType: "Normativa",
  subcategory: "",
  sourceOrganism: "ARPANSA",
  docCode: "",
  docVersion: "1",
  publicationDate: "",
  validityDate: "",
  description: "",
  keywords: "",
  responsible: "",
  observations: "",
};

function flattenCategories(categories: any[]) {
  const byParent: Record<string, any[]> = {};
  categories.forEach((c) => {
    const key = String(c.parent_id || 0);
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(c);
  });
  const result: any[] = [];
  function walk(parentKey: string, depth: number) {
    const kids = (byParent[parentKey] || []).sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
    kids.forEach((k) => {
      result.push({ ...k, depth });
      walk(String(k.id), depth + 1);
    });
  }
  walk("0", 0);
  return result;
}
export function ScienceDocuments({ unitId, actorEmail }: any) {
  const actor = actorEmail || "Usuario RPMS";

  const [categories, setCategories] = useState<any[]>([]);
  const [medicinaNuclearId, setMedicinaNuclearId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");

  const [docs, setDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [search, setSearch] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("");
  const [uploadForm, setUploadForm] = useState<any>(EMPTY_UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [versionPrompt, setVersionPrompt] = useState<any>(null);
  const [chosenPreviousId, setChosenPreviousId] = useState<number | null>(null);

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [relateToId, setRelateToId] = useState("");
  const [relationType, setRelationType] = useState("relacionado");

  const [pendingAnalyses, setPendingAnalyses] = useState<any[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [analysisNotes, setAnalysisNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/document-categories");
      const data = await res.json();
      const cats = data.categories || [];
      setCategories(cats);
      const mn = cats.find((c: any) => c.name === "Medicina Nuclear" && !c.parent_id);
      if (mn) {
        setMedicinaNuclearId(mn.id);
        setUploadCategoryId(String(mn.id));
      }
    })();
  }, []);

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const params = new URLSearchParams();
      if (categoryId) {
        params.set("categoryId", categoryId);
      } else if (medicinaNuclearId) {
        params.set("categoryRootId", String(medicinaNuclearId));
      }
      if (docStatusFilter) params.set("docStatus", docStatusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch("/api/linac/science-documents?" + params.toString());
      const data = await res.json();
      setDocs(data.documents || []);
    } finally {
      setLoadingDocs(false);
    }
  }, [categoryId, medicinaNuclearId, docStatusFilter, search]);

  useEffect(() => {
    if (medicinaNuclearId !== null) loadDocs();
  }, [medicinaNuclearId, loadDocs]);

  const loadPendingAnalyses = useCallback(async () => {
    setLoadingAnalyses(true);
    try {
      const res = await fetch("/api/linac/document-version-analysis?status=pendiente");
      const data = await res.json();
      setPendingAnalyses(data.analyses || []);
    } finally {
      setLoadingAnalyses(false);
    }
  }, []);

  useEffect(() => { loadPendingAnalyses(); }, [loadPendingAnalyses]);

  function setU(key: string, value: any) {
    setUploadForm((f: any) => ({ ...f, [key]: value }));
  }

  async function onFileChosen(f: File | null) {
    setFile(f);
    setVersionPrompt(null);
    setChosenPreviousId(null);
    if (!f || !uploadCategoryId) return;
    const params = new URLSearchParams();
    params.set("categoryId", uploadCategoryId);
    params.set("checkName", f.name.replace(/\.[^.]+$/, ""));
    const res = await fetch("/api/linac/science-documents?" + params.toString());
    const data = await res.json();
    if ((data.candidates || []).length > 0) {
      setVersionPrompt({ candidates: data.candidates });
    }
  }

  async function submitUpload() {
    if (!file || !uploadCategoryId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("categoryId", uploadCategoryId);
      fd.append("uploadedBy", actor);
      Object.keys(uploadForm).forEach((k) => fd.append(k, uploadForm[k] ?? ""));
      if (chosenPreviousId) fd.append("previousVersionId", String(chosenPreviousId));
      await fetch("/api/linac/science-documents", { method: "POST", body: fd });
      setUploadForm(EMPTY_UPLOAD);
      setFile(null);
      setVersionPrompt(null);
      setChosenPreviousId(null);
      setShowUpload(false);
      loadDocs();
      loadPendingAnalyses();
    } finally {
      setUploading(false);
    }
  }

  async function openDetail(id: number) {
    setSelectedDocId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch("/api/linac/science-documents/" + id);
      const data = await res.json();
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function addRelation() {
    if (!selectedDocId || !relateToId) return;
    await fetch("/api/linac/document-relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: selectedDocId, relatedDocumentId: Number(relateToId), relationType }),
    });
    setRelateToId("");
    openDetail(selectedDocId);
  }

  async function changeDocStatus(id: number, docStatus: string) {
    await fetch("/api/linac/science-documents/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cambiar_estado", docStatus }),
    });
    loadDocs();
    if (selectedDocId === id) openDetail(id);
  }

  async function reviewAnalysis(id: number, decision: string) {
    await fetch("/api/linac/document-version-analysis/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, changesSummary: analysisNotes[id] ?? null, reviewedBy: actor }),
    });
    loadPendingAnalyses();
  }

  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
  const labelCls = "text-xs text-muted-foreground";
  const flatCategories = flattenCategories(
    categories.filter((c: any) => c.id === medicinaNuclearId || c.parent_id === medicinaNuclearId)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FolderOpen className="h-4 w-4" /> Gestion Documental (Documentos - Medicina Nuclear)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input className={inputCls} placeholder="Buscar documento..." value={search} onChange={(e: any) => setSearch(e.target.value)} />
            <select className={inputCls} value={categoryId} onChange={(e: any) => setCategoryId(e.target.value)}>
              <option value="">Todas las subcategorias</option>
              {flatCategories.map((c: any) => (
                <option key={c.id} value={c.id}>{"\u00A0".repeat(c.depth * 2)}{c.name}</option>
              ))}
            </select>
            <select className={inputCls} value={docStatusFilter} onChange={(e: any) => setDocStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="vigente">Vigente</option>
              <option value="proxima_revision">Proxima a revision</option>
              <option value="requiere_revision">Requiere actualizacion</option>
              <option value="obsoleto">Obsoleto</option>
              <option value="historico">Historico</option>
            </select>
            <button onClick={loadDocs} className="rounded border border-border p-1.5" title="Actualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowUpload((s) => !s)}
              className="flex items-center gap-1 rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <UploadCloud className="h-3.5 w-3.5" /> Agregar documento
            </button>
          </div>
        </div>

        {showUpload && (
          <div className="mb-4 rounded border border-border p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">AGREGAR DOCUMENTO</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="col-span-2 md:col-span-4">
                <label className={labelCls}>Archivo (PDF u otro)</label>
                <input type="file" className={inputCls} onChange={(e: any) => onFileChosen(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className={labelCls}>Subcategoria (Medicina Nuclear)</label>
                <select className={inputCls} value={uploadCategoryId} onChange={(e: any) => setUploadCategoryId(e.target.value)}>
                  {flatCategories.map((c: any) => (
                    <option key={c.id} value={c.id}>{"\u00A0".repeat(c.depth * 2)}{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo de documento</label>
                <select className={inputCls} value={uploadForm.docType} onChange={(e: any) => setU("docType", e.target.value)}>
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Organismo emisor</label>
                <input className={inputCls} list="organism-suggestions" value={uploadForm.sourceOrganism} onChange={(e: any) => setU("sourceOrganism", e.target.value)} />
                <datalist id="organism-suggestions">
                  {ORGANISM_SUGGESTIONS.map((o) => <option key={o} value={o} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Numero / Codigo</label>
                <input className={inputCls} value={uploadForm.docCode} onChange={(e: any) => setU("docCode", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Version</label>
                <input className={inputCls} value={uploadForm.docVersion} onChange={(e: any) => setU("docVersion", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fecha de publicacion</label>
                <input type="date" className={inputCls} value={uploadForm.publicationDate} onChange={(e: any) => setU("publicationDate", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fecha de vigencia</label>
                <input type="date" className={inputCls} value={uploadForm.validityDate} onChange={(e: any) => setU("validityDate", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={uploadForm.responsible} onChange={(e: any) => setU("responsible", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Palabras clave</label>
                <input className={inputCls} value={uploadForm.keywords} onChange={(e: any) => setU("keywords", e.target.value)} />
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className={labelCls}>Descripcion</label>
                <textarea className={inputCls} rows={2} value={uploadForm.description} onChange={(e: any) => setU("description", e.target.value)} />
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className={labelCls}>Observaciones</label>
                <textarea className={inputCls} rows={2} value={uploadForm.observations} onChange={(e: any) => setU("observations", e.target.value)} />
              </div>
            </div>

            {versionPrompt && (
              <div className="mt-3 rounded border border-warning/40 p-2 text-xs">
                <p className="mb-2 font-semibold text-foreground">
                  Este documento corresponde a una nueva version de un documento existente?
                </p>
                <div className="mb-2 space-y-1">
                  {versionPrompt.candidates.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="prevversion"
                        checked={chosenPreviousId === c.id}
                        onChange={() => setChosenPreviousId(c.id)}
                      />
                      {c.original_name} (v{c.doc_version}, {c.doc_status})
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChosenPreviousId(versionPrompt.candidates[0]?.id ?? null)}
                    className="rounded bg-warning px-2 py-1 text-xs font-medium text-warning-foreground"
                  >
                    SI, CREAR NUEVA VERSION
                  </button>
                  <button
                    onClick={() => { setVersionPrompt(null); setChosenPreviousId(null); }}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    NO, DOCUMENTO INDEPENDIENTE
                  </button>
                </div>
                {chosenPreviousId && (
                  <p className="mt-1 text-success">Se creara como nueva version del documento seleccionado.</p>
                )}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                disabled={uploading || !file}
                onClick={submitUpload}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : "Guardar documento"}
              </button>
              <button onClick={() => setShowUpload(false)} className="rounded border border-border px-3 py-1.5 text-xs">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingDocs ? (
          <p className="text-xs text-muted-foreground">Cargando documentos...</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin documentos para este filtro.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1">Nombre</th>
                  <th className="pb-1">Tipo / Organismo</th>
                  <th className="pb-1">Codigo / Version</th>
                  <th className="pb-1">Estado</th>
                  <th className="pb-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d: any) => {
                  const info = STATUS_LABELS[d.doc_status] || { label: d.doc_status, cls: "text-muted-foreground" };
                  return (
                    <tr key={d.id} className="border-t border-border">
                      <td className="py-1.5 font-medium text-foreground">{d.original_name}</td>
                      <td className="py-1.5">{[d.doc_type, d.source_organism].filter(Boolean).join(" / ") || "-"}</td>
                      <td className="py-1.5">{[d.doc_code, d.doc_version ? "v" + d.doc_version : null].filter(Boolean).join(" / ") || "-"}</td>
                      <td className="py-1.5">
                        <span className={info.cls}>{info.label}</span>
                        {d.newer_version_id && <span className="ml-1 text-muted-foreground">(hay version mas nueva)</span>}
                        {d.previous_version_id && <span className="ml-1 text-muted-foreground">(tiene version anterior)</span>}
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {d.blob_url && (
                            <a href={d.blob_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary">
                              <ExternalLink className="h-3 w-3" /> Ver fuente
                            </a>
                          )}
                          <button onClick={() => openDetail(d.id)} className="rounded border border-border px-2 py-0.5 text-xs">
                            Detalle
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedDocId && (
          <div className="mt-4 rounded border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Link2 className="h-3.5 w-3.5" /> Detalle documento #{selectedDocId}
              </p>
              <button onClick={() => { setSelectedDocId(null); setDetail(null); }} className="text-xs text-muted-foreground">
                Cerrar
              </button>
            </div>
            {loadingDetail ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : detail ? (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{detail.document.original_name}</span>
                  <span className={(STATUS_LABELS[detail.document.doc_status] || {}).cls}>
                    {(STATUS_LABELS[detail.document.doc_status] || {}).label || detail.document.doc_status}
                  </span>
                  {detail.document.doc_status !== "historico" && detail.document.doc_status !== "obsoleto" && (
                    <button onClick={() => changeDocStatus(detail.document.id, "requiere_revision")} className="rounded border border-warning/40 px-2 py-0.5 text-warning">
                      Marcar requiere revision
                    </button>
                  )}
                  {detail.document.doc_status !== "obsoleto" && (
                    <button onClick={() => changeDocStatus(detail.document.id, "obsoleto")} className="rounded border border-danger/40 px-2 py-0.5 text-danger">
                      Marcar obsoleto
                    </button>
                  )}
                </div>

                <div>
                  <p className="mb-1 flex items-center gap-1 font-semibold text-foreground"><History className="h-3.5 w-3.5" /> Cadena de versiones</p>
                  {detail.versionChain.length === 0 ? (
                    <p className="text-muted-foreground">Sin otras versiones registradas.</p>
                  ) : (
                    <ul className="list-disc pl-4">
                      {detail.versionChain.map((v: any) => (
                        <li key={v.id}>{v.original_name} - v{v.doc_version} - {v.doc_status}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 font-semibold text-foreground">Documentos relacionados</p>
                  {detail.relations.length === 0 ? (
                    <p className="text-muted-foreground">Sin documentos relacionados.</p>
                  ) : (
                    <ul className="list-disc pl-4">
                      {detail.relations.map((r: any) => (
                        <li key={r.id}>
                          {r.relation_type}: {r.document_id === selectedDocId ? r.related_document_name : r.document_name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <input className={inputCls} placeholder="ID del documento relacionado" value={relateToId} onChange={(e: any) => setRelateToId(e.target.value)} />
                    <select className={inputCls} value={relationType} onChange={(e: any) => setRelationType(e.target.value)}>
                      {RELATION_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button onClick={addRelation} className="rounded border border-border px-2 py-1 text-xs">
                      Vincular
                    </button>
                  </div>
                </div>

                {detail.versionAnalysis.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-foreground">Analisis de cambios documentales</p>
                    <ul className="list-disc pl-4">
                      {detail.versionAnalysis.map((a: any) => (
                        <li key={a.id}>
                          {a.previous_document_name} vs {a.document_name} - estado: {a.status}{a.decision ? " - decision: " + a.decision : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <History className="h-4 w-4" /> Analisis de Cambios Documentales Pendientes
          </p>
          <button onClick={loadPendingAnalyses} className="rounded border border-border p-1.5" title="Actualizar">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {loadingAnalyses ? (
          <p className="text-xs text-muted-foreground">Cargando...</p>
        ) : pendingAnalyses.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin analisis pendientes de revision.</p>
        ) : (
          <div className="space-y-3">
            {pendingAnalyses.map((a: any) => (
              <div key={a.id} className="rounded border border-warning/40 p-2 text-xs">
                <p className="mb-1 font-semibold text-foreground">SE DETECTO POSIBLE ACTUALIZACION DE DOCUMENTO</p>
                <p className="text-muted-foreground">
                  Version anterior: {a.previous_document_name || "-"}{" "}
                  {a.previous_document_url && (
                    <a href={a.previous_document_url} target="_blank" rel="noreferrer" className="text-primary">[ver]</a>
                  )}
                </p>
                <p className="text-muted-foreground">
                  Nueva version: {a.document_name || "-"}{" "}
                  {a.document_url && (
                    <a href={a.document_url} target="_blank" rel="noreferrer" className="text-primary">[ver]</a>
                  )}
                </p>
                <p className="mt-1 text-warning">Estado: REQUIERE REVISION HUMANA</p>
                <textarea
                  className={inputCls + " mt-2"}
                  rows={2}
                  placeholder="Resumen de cambios detectados (limites, tolerancias, frecuencias, parametros...)"
                  value={analysisNotes[a.id] ?? ""}
                  onChange={(e: any) => setAnalysisNotes((m) => ({ ...m, [a.id]: e.target.value }))}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => reviewAnalysis(a.id, "aprobar_actualizacion")} className="flex items-center gap-1 rounded border border-success/40 px-2 py-1 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar actualizacion
                  </button>
                  <button onClick={() => reviewAnalysis(a.id, "rechazar")} className="flex items-center gap-1 rounded border border-danger/40 px-2 py-1 text-danger">
                    <XCircle className="h-3.5 w-3.5" /> Rechazar
                  </button>
                  <button onClick={() => reviewAnalysis(a.id, "mantener_actual")} className="rounded border border-border px-2 py-1">
                    Mantener criterio actual
                  </button>
                  <button onClick={() => reviewAnalysis(a.id, "revisar_manual")} className="rounded border border-border px-2 py-1">
                    Revisar manualmente
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
