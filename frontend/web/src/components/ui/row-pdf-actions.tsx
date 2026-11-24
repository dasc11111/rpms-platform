"use client";

/**
 * RowPdfActions — Compact Edit / Preview / Delete buttons for a table row.
 *
 * Usage:
 *   <RowPdfActions module="equipment" ownerType="equipment" ownerId={String(eq.id)} />
 *
 * Props:
 *   module    — module slug, e.g. "equipment", "workers", "training"
 *   ownerType — entity type string, e.g. "equipment", "worker", "license"
 *   ownerId   — string identifier for the row (id, rut, code, etc.)
 *   uploadedBy— optional display name for uploaded docs
 *   size      — "sm" (default) or "xs" for even more compact
 */

import { useState, useEffect, useCallback } from "react";
import {
  Pencil, Eye, Trash2, FileText, Upload, X, Check, ZoomIn, ZoomOut,
  RotateCw, Download, Printer, ChevronDown, ChevronUp,
} from "lucide-react";

interface Doc {
  id: number;
  original_name: string;
  blob_url: string;
  size_bytes: number;
  mime_type: string;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

interface RowPdfActionsProps {
  module: string;
  ownerType: string;
  ownerId: string;
  uploadedBy?: string;
  size?: "sm" | "xs";
}

// ─── tiny helpers ────────────────────────────────────────────────────────────
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function isPreviewable(mime: string) {
  return mime.startsWith("image/") || mime === "application/pdf";
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isImage = doc.mime_type.startsWith("image/");
  const previewUrl = `/api/module-pdfs/${doc.id}/download`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-blue-600 shrink-0" />
            <span className="text-sm font-medium truncate">{doc.original_name}</span>
            <span className="text-xs text-gray-400 shrink-0">{fmtSize(doc.size_bytes)}</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {isImage && (
              <>
                <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 rounded hover:bg-gray-200" title="Alejar"><ZoomOut size={15} /></button>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 rounded hover:bg-gray-200" title="Acercar"><ZoomIn size={15} /></button>
                <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded hover:bg-gray-200" title="Rotar"><RotateCw size={15} /></button>
              </>
            )}
            <a href={`${previewUrl}?dl=1`} className="p-1.5 rounded hover:bg-gray-200" title="Descargar" download><Download size={15} /></a>
            <button onClick={() => window.open(previewUrl, "_blank")} className="p-1.5 rounded hover:bg-gray-200" title="Imprimir"><Printer size={15} /></button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-red-100 text-red-500 ml-1" title="Cerrar"><X size={15} /></button>
          </div>
        </div>
        {/* content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
          {isImage ? (
            <img
              src={previewUrl}
              alt={doc.original_name}
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: "transform 0.2s" }}
              className="max-w-full max-h-full object-contain rounded shadow"
            />
          ) : (
            <iframe
              src={previewUrl}
              title={doc.original_name}
              className="w-full rounded shadow bg-white"
              style={{ height: "70vh" }}
            />
          )}
        </div>
        {doc.description && (
          <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50 truncate">
            {doc.description}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  doc,
  onClose,
  onSaved,
}: {
  doc: Doc;
  onClose: () => void;
  onSaved: (updated: Doc) => void;
}) {
  const [desc, setDesc] = useState(doc.description ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/module-pdfs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, description: desc }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      onSaved({ ...doc, description: desc });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-800">Editar descripción</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={14} /></button>
        </div>
        <p className="text-xs text-gray-500 truncate">{doc.original_name}</p>
        <textarea
          className="border border-gray-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Descripción del documento…"
          autoFocus
        />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"
          >
            {saving ? "Guardando…" : <><Check size={12} /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({
  module,
  ownerType,
  ownerId,
  uploadedBy,
  onClose,
  onUploaded,
}: {
  module: string;
  ownerType: string;
  ownerId: string;
  uploadedBy: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [desc, setDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleUpload() {
    if (!files || files.length === 0) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("module", module);
      form.append("ownerType", ownerType);
      form.append("ownerId", ownerId);
      form.append("description", desc);
      form.append("uploadedBy", uploadedBy);
      Array.from(files).forEach(f => form.append("files", f));
      const res = await fetch("/api/module-pdfs", { method: "POST", body: form });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      onUploaded();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-800">Subir documento</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={14} /></button>
        </div>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={e => setFiles(e.target.files)}
          className="text-xs"
        />
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleUpload}
            disabled={uploading || !files || files.length === 0}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"
          >
            {uploading ? "Subiendo…" : <><Upload size={12} /> Subir</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RowPdfActions({
  module,
  ownerType,
  ownerId,
  uploadedBy = "Usuario RPMS",
  size = "sm",
}: RowPdfActionsProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showList, setShowList] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ module, ownerType, ownerId });
      const res = await fetch(`/api/module-pdfs?${params}`);
      const json = await res.json();
      setDocs(json.documents ?? []);
    } catch {
      /* silent */
    } finally {
      setLoaded(true);
    }
  }, [module, ownerType, ownerId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  async function handleDelete(doc: Doc) {
    if (!confirm(`¿Eliminar "${doc.original_name}"?`)) return;
    setDeleting(doc.id);
    try {
      await fetch(`/api/module-pdfs?id=${doc.id}`, { method: "DELETE" });
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } finally {
      setDeleting(null);
    }
  }

  const btnBase =
    size === "xs"
      ? "p-1 rounded hover:bg-gray-100 transition-colors"
      : "p-1.5 rounded hover:bg-gray-100 transition-colors";
  const iconSz = size === "xs" ? 13 : 14;

  const previewable = docs.filter(d => isPreviewable(d.mime_type));
  const hasDoc = docs.length > 0;

  return (
    <>
      <div className="flex items-center gap-0.5">
        {/* count badge */}
        {loaded && hasDoc && (
          <button
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors mr-1"
            title="Ver documentos"
          >
            <FileText size={11} />
            <span className="font-medium">{docs.length}</span>
            {showList ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}

        {/* upload */}
        <button
          onClick={() => setShowUpload(true)}
          className={`${btnBase} text-gray-400 hover:text-blue-600`}
          title="Subir documento"
        >
          <Upload size={iconSz} />
        </button>

        {/* preview — only if has previewable doc */}
        {previewable.length > 0 && (
          <button
            onClick={() => setPreviewDoc(previewable[0])}
            className={`${btnBase} text-gray-400 hover:text-emerald-600`}
            title="Previsualizar"
          >
            <Eye size={iconSz} />
          </button>
        )}

        {/* edit description of first doc */}
        {hasDoc && (
          <button
            onClick={() => setEditDoc(docs[0])}
            className={`${btnBase} text-gray-400 hover:text-amber-600`}
            title="Editar descripción"
          >
            <Pencil size={iconSz} />
          </button>
        )}

        {/* delete first doc */}
        {hasDoc && (
          <button
            onClick={() => handleDelete(docs[0])}
            disabled={deleting === docs[0].id}
            className={`${btnBase} text-gray-400 hover:text-red-600 disabled:opacity-50`}
            title="Eliminar documento"
          >
            <Trash2 size={iconSz} />
          </button>
        )}
      </div>

      {/* expandable doc list */}
      {showList && docs.length > 0 && (
        <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm text-xs divide-y divide-gray-100 max-w-xs">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-1 px-2 py-1.5">
              <FileText size={12} className="text-gray-400 shrink-0" />
              <span className="truncate flex-1 text-gray-700">{doc.description || doc.original_name}</span>
              <div className="flex items-center gap-0.5 ml-1 shrink-0">
                {isPreviewable(doc.mime_type) && (
                  <button onClick={() => { setPreviewDoc(doc); setShowList(false); }} className="p-0.5 rounded hover:bg-gray-100" title="Previsualizar"><Eye size={11} className="text-emerald-600" /></button>
                )}
                <button onClick={() => { setEditDoc(doc); setShowList(false); }} className="p-0.5 rounded hover:bg-gray-100" title="Editar"><Pencil size={11} className="text-amber-600" /></button>
                <button onClick={() => handleDelete(doc)} disabled={deleting === doc.id} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-50" title="Eliminar"><Trash2 size={11} className="text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modals */}
      {previewDoc && (
        <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {editDoc && (
        <EditModal
          doc={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={updated => {
            setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
            setEditDoc(null);
          }}
        />
      )}
      {showUpload && (
        <UploadModal
          module={module}
          ownerType={ownerType}
          ownerId={ownerId}
          uploadedBy={uploadedBy}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); fetchDocs(); }}
        />
      )}
    </>
  );
}
