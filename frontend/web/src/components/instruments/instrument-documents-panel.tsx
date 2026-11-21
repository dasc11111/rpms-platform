"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  Printer,
  RotateCw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { DOCUMENT_CATEGORY_LABELS, formatBytes } from "@/lib/instruments";
import type { InstrumentDocumentRow } from "@/lib/instruments";

const OWNER_TYPE_LABELS: Record<string, string> = {
  instrument: "Instrumento",
  calibration: "Calibraci\u00f3n",
  failure: "Falla",
  maintenance: "Mantenimiento",
};

function isPreviewable(mime: string | null): "image" | "pdf" | "text" | null {
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  return null;
}

function PreviewModal({ doc, onClose }: { doc: InstrumentDocumentRow; onClose: () => void }) {
  const kind = isPreviewable(doc.mime_type);
  const src = `/api/instruments/documents/${doc.id}/download`;
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  function handlePrint() {
    const w = window.open(src, "_blank");
    if (!w) return;
    w.onload = () => {
      w.print();
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="truncate text-sm font-semibold" title={doc.original_name}>
            {doc.original_name}
          </h3>
          <div className="flex items-center gap-1.5">
            {kind === "image" && (
              <>
                <button
                  type="button"
                  title="Alejar"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                  className="rounded p-1.5 hover:bg-muted"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Acercar"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  className="rounded p-1.5 hover:bg-muted"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Rotar"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="rounded p-1.5 hover:bg-muted"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </>
            )}
            <button type="button" title="Imprimir" onClick={handlePrint} className="rounded p-1.5 hover:bg-muted">
              <Printer className="h-4 w-4" />
            </button>
            <a
              href={`${src}?dl=1`}
              target="_blank"
              rel="noopener noreferrer"
              title="Descargar"
              className="rounded p-1.5 hover:bg-muted"
            >
              <Download className="h-4 w-4" />
            </a>
            <button type="button" title="Cerrar" onClick={onClose} className="rounded p-1.5 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-muted/20">
          {kind === "image" ? (
            <div className="flex h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={doc.original_name}
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: "transform 0.15s ease" }}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : kind === "pdf" || kind === "text" ? (
            <iframe src={src} title={doc.original_name} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <p>La vista previa no est\u00e1 disponible para este tipo de archivo.</p>
              <a
                href={`${src}?dl=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
              >
                Descargar para ver el archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InstrumentDocumentsPanel({
  instrumentId,
  documents,
}: {
  instrumentId: number;
  documents: InstrumentDocumentRow[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState("otro");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<InstrumentDocumentRow | null>(null);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("ownerType", "instrument");
      form.append("ownerId", String(instrumentId));
      form.append("category", category);
      Array.from(fileList).forEach((f) => form.append("files", f));
      const res = await fetch("/api/instruments/documents", { method: "POST", body: form });
      if (!res.ok) throw new Error("upload_failed");
      router.refresh();
    } catch {
      setError("No se pudo subir uno o m\u00e1s archivos.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`\u00bfEliminar "${name}"? Esta acci\u00f3n no se puede deshacer.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/instruments/documents/${id}/download`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      router.refresh();
    } catch {
      setError("No se pudo eliminar el documento.");
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Documentos</h2>
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-accent"
          >
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:border-accent">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Subiendo..." : "Adjuntar documento"}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {documents.length > 0 ? (
        <ul className="divide-y divide-border text-xs">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-1.5">
              <button
                type="button"
                onClick={() => setPreviewDoc(d)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-accent"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.original_name}</span>
              </button>
              <span className="shrink-0 text-muted-foreground">
                {DOCUMENT_CATEGORY_LABELS[d.category ?? "otro"] ?? d.category} · {OWNER_TYPE_LABELS[d.owner_type] ?? d.owner_type} ·{" "}
                {formatBytes(Number(d.size_bytes))}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" title="Vista previa" onClick={() => setPreviewDoc(d)} className="rounded p-1 hover:bg-muted">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <a
                  href={`/api/instruments/documents/${d.id}/download?dl=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Descargar"
                  className="rounded p-1 hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => handleDelete(d.id, d.original_name)}
                  className="rounded p-1 text-danger hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin documentos adjuntos.</p>
      )}

      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}
