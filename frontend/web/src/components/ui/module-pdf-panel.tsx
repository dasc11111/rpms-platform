"use client";

import { useState, useCallback } from "react";
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

export interface ModulePdfDoc {
  id: number;
  module: string;
  owner_type: string;
  owner_id: string | null;
  original_name: string;
  blob_url: string;
  size_bytes: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(mime: string | null): "image" | "pdf" | "text" | null {
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  return null;
}

function PreviewModal({ doc, onClose }: { doc: ModulePdfDoc; onClose: () => void }) {
  const kind = isPreviewable(doc.mime_type);
  const src = `/api/module-pdfs/${doc.id}/download`;
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  function handlePrint() {
    const w = window.open(src, "_blank");
    if (!w) return;
    w.onload = () => w.print();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
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
            <button
              type="button"
              title="Imprimir"
              onClick={handlePrint}
              className="rounded p-1.5 hover:bg-muted"
            >
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
            <button
              type="button"
              title="Cerrar"
              onClick={onClose}
              className="rounded p-1.5 hover:bg-muted"
            >
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
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.15s ease",
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : kind === "pdf" || kind === "text" ? (
            <iframe src={src} title={doc.original_name} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <p>La vista previa no está disponible para este tipo de archivo.</p>
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

interface ModulePdfPanelProps {
  /** Identificador del módulo, ej: "workers", "dosimetry", "equipment" */
  module: string;
  /** Tipo de propietario. "module" = nivel de página; otro valor = por fila */
  ownerType?: string;
  /** ID del elemento (fila) cuando ownerType !== "module" */
  ownerId?: string | number | null;
  /** Título a mostrar en el panel */
  title?: string;
  /** Documentos precargados desde el servidor (Server Component) */
  initialDocs?: ModulePdfDoc[];
  /** Nombre del usuario que sube (para auditoría) */
  uploadedBy?: string;
  /** Si es false, oculta el panel completo */
  visible?: boolean;
}

/**
 * Panel genérico de PDFs/documentos para cualquier módulo y cualquier fila.
 *
 * Uso a nivel de página (módulo general):
 *   <ModulePdfPanel module="workers" ownerType="module" title="Documentos del módulo" />
 *
 * Uso por fila (trabajador específico):
 *   <ModulePdfPanel module="workers" ownerType="worker" ownerId={worker.id} title="Documentos del trabajador" />
 */
export function ModulePdfPanel({
  module,
  ownerType = "module",
  ownerId = null,
  title = "Documentos",
  initialDocs = [],
  uploadedBy = "Usuario RPMS",
  visible = true,
}: ModulePdfPanelProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<ModulePdfDoc[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ModulePdfDoc | null>(null);
  const [description, setDescription] = useState("");

  if (!visible) return null;

  // Refresca lista desde la API
  const refreshDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ module, ownerType });
      if (ownerId != null) params.set("ownerId", String(ownerId));
      const res = await fetch(`/api/module-pdfs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
      /* silencioso */
    }
  }, [module, ownerType, ownerId]);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("module", module);
      form.append("ownerType", ownerType);
      if (ownerId != null) form.append("ownerId", String(ownerId));
      if (description.trim()) form.append("description", description.trim());
      form.append("uploadedBy", uploadedBy);
      Array.from(fileList).forEach((f) => form.append("files", f));
      const res = await fetch("/api/module-pdfs", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "upload_failed");
      }
      setDescription("");
      await refreshDocs();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/module-pdfs?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setDocs((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    } catch {
      setError("No se pudo eliminar el documento.");
    }
  }

  // Drag & drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    handleUpload(e.dataTransfer.files);
  }

  return (
    <>
      {previewDoc && (
        <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        {/* Cabecera */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {title}
            {docs.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {docs.length}
              </span>
            )}
          </h3>

          {/* Botón de subida */}
          <label
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:border-accent disabled:cursor-not-allowed"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Subiendo…" : "Subir PDF"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              multiple
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        </div>

        {/* Descripción opcional */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Descripción del documento (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-accent"
          />
        </div>

        {/* Zona de arrastrar */}
        <div
          className="mb-3 flex items-center justify-center rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground hover:border-accent"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          Arrastra archivos aquí para subirlos
        </div>

        {/* Error */}
        {error && (
          <p className="mb-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-600">
            {error}
          </p>
        )}

        {/* Lista de documentos */}
        {docs.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No hay documentos cargados.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((doc) => {
              const previewable = isPreviewable(doc.mime_type);
              const downloadSrc = `/api/module-pdfs/${doc.id}/download`;
              return (
                <li key={doc.id} className="flex items-center gap-2 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium"
                      title={doc.original_name}
                    >
                      {doc.original_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(doc.size_bytes)}
                      {doc.description && ` · ${doc.description}`}
                      {doc.uploaded_by && ` · ${doc.uploaded_by}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {previewable && (
                      <button
                        type="button"
                        title="Vista previa"
                        onClick={() => setPreviewDoc(doc)}
                        className="rounded p-1 hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <a
                      href={`${downloadSrc}?dl=1`}
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
                      onClick={() => handleDelete(doc.id, doc.original_name)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
