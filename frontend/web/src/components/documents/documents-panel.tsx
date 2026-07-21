"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Trash2, Upload, Search, ArrowUpDown } from "lucide-react";
import { formatBytes } from "@/lib/documents";
import type { DocumentSortField, SortDir } from "@/lib/documents";

type DocumentRow = {
  id: number;
  original_name: string;
  blob_url: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export function DocumentsPanel({
  categoryId,
  categoryName,
  onChanged,
}: {
  categoryId: number | null;
  categoryName: string | null;
  onChanged?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DocumentSortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        categoryId: String(categoryId),
        sortBy,
        sortDir,
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      setError("No se pudo cargar la lista de documentos.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, sortBy, sortDir, search]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(field: DocumentSortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !categoryId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("categoryId", String(categoryId));
        const res = await fetch("/api/documents", { method: "POST", body: form });
        if (!res.ok) throw new Error("upload_failed");
      }
      await load();
      onChanged?.();
    } catch {
      setError("No se pudo subir uno o mas archivos.");
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(id: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", files[0]);
      const res = await fetch(`/api/documents/${id}`, { method: "PUT", body: form });
      if (!res.ok) throw new Error("replace_failed");
      await load();
      onChanged?.();
    } catch {
      setError("No se pudo reemplazar el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      await load();
      onChanged?.();
    } catch {
      setError("No se pudo eliminar el archivo.");
    }
  }

  if (!categoryId) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Selecciona una subcategoria para ver sus documentos.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{categoryName}</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento..."
              className="h-8 w-52 rounded-md border border-border bg-surface pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-muted/60">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Subiendo..." : "Subir archivo"}
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

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <Th label="Documento" field="name" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Tamaño" field="size" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2">Subido por</th>
              <Th label="Fecha de carga" field="created_at" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Última modificación" field="updated_at" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-xs text-muted-foreground" colSpan={6}>Cargando...</td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-xs text-muted-foreground" colSpan={6}>No hay documentos en esta carpeta todavía.</td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">
                    <a href={d.blob_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {d.original_name}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatBytes(d.size_bytes)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.uploaded_by || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{new Date(d.created_at).toLocaleString("es-CL")}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{new Date(d.updated_at).toLocaleString("es-CL")}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <a href={d.blob_url} download target="_blank" rel="noopener noreferrer" title="Descargar" className="rounded p-1 hover:bg-muted">
                        <Download className="h-4 w-4" />
                      </a>
                      <label title="Reemplazar" className="cursor-pointer rounded p-1 hover:bg-muted">
                        <RefreshCw className="h-4 w-4" />
                        <input type="file" className="hidden" onChange={(e) => handleReplace(d.id, e.target.files)} />
                      </label>
                      <button title="Eliminar" onClick={() => handleDelete(d.id, d.original_name)} className="rounded p-1 text-danger hover:bg-muted">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  field,
  sortBy,
  sortDir,
  onClick,
}: {
  label: string;
  field: DocumentSortField;
  sortBy: DocumentSortField;
  sortDir: SortDir;
  onClick: (field: DocumentSortField) => void;
}) {
  const active = sortBy === field;
  return (
    <th className="px-3 py-2">
      <button type="button" onClick={() => onClick(field)} className={`flex items-center gap-1 ${active ? "text-foreground" : ""}`}>
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}
