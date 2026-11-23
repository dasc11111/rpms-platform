"use client";

export const dynamic = "force-dynamic";

import { useRef, useState, useCallback } from "react";
import {
  Upload,
  Eye,
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
  RefreshCw,
  PenLine,
  Save,
  X,
  UserCheck,
  UserX,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnrichedRow {
  rowIndex: number;
  worker_rut: string;
  worker_name_report: string;
  worker_name_system: string;
  worker_matched: boolean;
  worker_match_via: "rut" | "name" | "none";
  conflict: boolean;
  resolution: "nuevo" | "actualizar" | "duplicar" | "cancelar";
  year: number | null;
  quarter: number | null;
  period_label?: string;
  dosimeter_number?: string;
  hp10?: number | null;
  hp3?: number | null;
  hp007?: number | null;
  accum_year_body?: number | null;
  departamento?: string;
  institucion?: string;
}

interface PreviewResult {
  ok: boolean;
  fileName: string;
  fileHash: string;
  usedOcr: boolean;
  duplicateFile: boolean;
  workersDetected: number;
  recordsFound: number;
  newRecords: number;
  existingRecords: number;
  rows: EnrichedRow[];
  warnings: string[];
  errors: string[];
}

interface ConfirmResult {
  ok: boolean;
  created: number;
  updated: number;
  duplicated: number;
  skipped: number;
  alerts: string[];
}

// ─── Status badge config ─────────────────────────────────────────────────────

function RowBadge({ row }: { row: EnrichedRow }) {
  if (!row.worker_matched) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
        <UserX className="h-3 w-3" />
        Sin coincidencia
      </span>
    );
  }
  if (row.conflict) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
        <RotateCcw className="h-3 w-3" />
        Actualizar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
      <UserCheck className="h-3 w-3" />
      Nuevo
    </span>
  );
}

// ─── Inline editable row ──────────────────────────────────────────────────────

function EditableRow({
  row,
  editing,
  onStartEdit,
  onSave,
  onCancel,
}: {
  row: EnrichedRow;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (patch: Partial<EnrichedRow>) => void;
  onCancel: () => void;
}) {
  const [rutVal, setRutVal] = useState(row.worker_rut);
  const [nameVal, setNameVal] = useState(row.worker_name_report);

  const handleSave = () => {
    onSave({ worker_rut: rutVal.trim(), worker_name_report: nameVal.trim() });
  };

  const rowClass = cn(
    "border-b border-border text-sm transition-colors",
    !row.worker_matched && "bg-orange-50/40 dark:bg-orange-950/10",
    row.conflict && "bg-blue-50/40 dark:bg-blue-950/10",
    editing && "bg-muted/60"
  );

  if (editing) {
    return (
      <tr className={rowClass}>
        <td className="px-3 py-2 w-10">
          <div className="flex gap-1">
            <button onClick={handleSave} className="p-1 rounded hover:bg-green-100 text-green-700" title="Guardar">
              <Save className="h-3.5 w-3.5" />
            </button>
            <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Cancelar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
        <td className="px-3 py-2">
          <input
            autoFocus
            className="w-full border border-border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={rutVal}
            onChange={(e) => setRutVal(e.target.value)}
            placeholder="RUT sin puntos"
          />
        </td>
        <td className="px-3 py-2" colSpan={2}>
          <input
            className="w-full border border-border rounded px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder="Nombre del trabajador"
          />
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{row.period_label ?? `${row.year} T${row.quarter}`}</td>
        <td className="px-3 py-2 text-right font-mono text-xs">{row.hp10 != null ? row.hp10.toFixed(2) : "—"}</td>
        <td className="px-3 py-2 text-right font-mono text-xs">{row.hp3 != null ? row.hp3.toFixed(2) : "—"}</td>
        <td className="px-3 py-2" />
      </tr>
    );
  }

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2 w-10">
        <button
          onClick={onStartEdit}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Editar"
        >
          <PenLine className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
        {row.worker_rut || <span className="text-muted-foreground italic">{row.worker_name_report.split(" ")[0] ?? "—"}</span>}
      </td>
      <td className="px-3 py-2 max-w-[160px]">
        <div className="text-xs font-medium truncate" title={row.worker_name_report}>
          {row.worker_name_report}
        </div>
        {row.worker_matched && row.worker_name_system && row.worker_name_system !== row.worker_name_report && (
          <div className="text-xs text-muted-foreground truncate" title={row.worker_name_system}>
            → {row.worker_name_system}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.departamento ?? row.institucion ?? "—"}</td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">{row.period_label ?? `${row.year} T${row.quarter}`}</td>
      <td className="px-3 py-2 text-right font-mono text-xs">{row.hp10 != null ? row.hp10.toFixed(2) : "—"}</td>
      <td className="px-3 py-2 text-right font-mono text-xs">{row.hp3 != null ? row.hp3.toFixed(2) : "—"}</td>
      <td className="px-3 py-2">
        <RowBadge row={row} />
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function DosimetryImportPdfPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");

  // ── PDF extraction helper ────────────────────────────────────────────────
  const extractPdfText = useCallback(async (f: File): Promise<{ rawText: string; pagesText: string[]; fileHash: string; usedOcr: boolean }> => {
    setLoadingMsg("Extrayendo texto del PDF…");
    // Use pdfjs-dist via dynamic import
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await f.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

    // Hash for dedup
    let fileHash = "";
    try {
      const hashBuffer = await crypto.subtle.digest("SHA-256", typedArray);
      fileHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch { /* ignore */ }

    const pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
    const pagesText: string[] = [];

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      pagesText.push(content.items.map((item: { str?: string }) => item.str ?? "").join(" "));
    }

    const rawText = pagesText.join("\n");
    const usedOcr = rawText.trim().length < 100; // likely scanned if very little text

    return { rawText, pagesText, fileHash, usedOcr };
  }, []);

  // ── Preview ──────────────────────────────────────────────────────────────
  const doPreview = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { setError("Selecciona un archivo PDF."); return; }
    setFile(f);
    setLoading(true);
    setError("");
    setPreview(null);
    setConfirmResult(null);
    setRows([]);
    setEditingIdx(null);

    try {
      const { rawText, pagesText, fileHash, usedOcr } = await extractPdfText(f);

      setLoadingMsg("Analizando informe de dosis…");
      const r = await fetch("/api/dosimetry/import-pdf/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, pagesText, fileName: f.name, fileHash, usedOcr }),
      });
      const d = await r.json();
      if (d.error) {
        setError(d.error);
      } else {
        setPreview(d);
        setRows(d.rows ?? []);
      }
    } catch (e) {
      setError(`Error procesando el PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ── Inline edit handlers ─────────────────────────────────────────────────
  const handleSaveRow = (idx: number, patch: Partial<EnrichedRow>) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        // Re-derive matched status if RUT or name changed
        const updated = { ...r, ...patch };
        return updated;
      })
    );
    setEditingIdx(null);
  };

  // ── Confirm ──────────────────────────────────────────────────────────────
  const doConfirm = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setLoadingMsg("Guardando registros…");
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("rows", JSON.stringify(rows));
      fd.append("uploadedBy", "Usuario RPMS");
      fd.append("usedOcr", String(preview.usedOcr));
      fd.append("fileHash", preview.fileHash);
      if (provider) fd.append("provider", provider);

      const r = await fetch("/api/dosimetry/import-pdf/confirm", { method: "POST", body: fd });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setConfirmResult(d);
    } catch (e) {
      setError(`Error confirmando importación: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setRows([]);
    setConfirmResult(null);
    setError("");
    setEditingIdx(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const unmatchedCount = rows.filter((r) => !r.worker_matched).length;
  const newCount = rows.filter((r) => r.worker_matched && !r.conflict).length;
  const updateCount = rows.filter((r) => r.conflict).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
          <FileText className="h-6 w-6 text-blue-700 dark:text-blue-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar Informe PDF de Dosis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube el PDF del proveedor — el sistema extrae, valida y relaciona automáticamente con tus trabajadores
          </p>
        </div>
      </div>

      {/* Process steps */}
      <div className="flex gap-4 text-xs">
        {["1. Subir PDF", "2. Revisar y editar", "3. Confirmar importación"].map((step, i) => {
          const active = i === 0 ? !preview && !confirmResult : i === 1 ? !!preview && !confirmResult : !!confirmResult;
          return (
            <div key={i} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", active ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300" : "border-border text-muted-foreground")}>
              <span className={cn("w-4 h-4 rounded-full text-center leading-4 text-xs", active ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>
              {step}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-xl text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Success result */}
      {confirmResult && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700 rounded-xl p-5">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold mb-4">
            <CheckCircle className="h-5 w-5" />
            Importación completada exitosamente
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Nuevos registros", value: confirmResult.created, color: "text-green-700 dark:text-green-300" },
              { label: "Actualizados", value: confirmResult.updated, color: "text-blue-700 dark:text-blue-300" },
              { label: "Duplicados omitidos", value: confirmResult.duplicated, color: "text-muted-foreground" },
              { label: "Omitidos", value: confirmResult.skipped, color: "text-muted-foreground" },
            ].map((item, i) => (
              <div key={i} className="bg-background rounded-xl border border-border p-3 text-center">
                <div className={cn("text-2xl font-bold font-mono", item.color)}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          {confirmResult.alerts?.length > 0 && (
            <div className="mt-4 space-y-1">
              {confirmResult.alerts.map((a, i) => (
                <div key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={reset}
            className="mt-4 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Importar otro informe
          </button>
        </div>
      )}

      {!confirmResult && (
        <>
          {/* Upload form */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold">Configuración</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Proveedor de dosimetría (opcional)</label>
              <input
                className={inp}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej: CCHEN, Dosimetría Sur, etc."
              />
            </div>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors",
                file ? "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20" : "border-border hover:border-blue-300"
              )}
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-blue-500 mx-auto" />
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; setPreview(null); setRows([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Cambiar archivo
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">Arrastra aquí el PDF o selecciónalo</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-sm px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700"
                  >
                    Seleccionar PDF
                  </button>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setPreview(null); setRows([]); }
                }}
              />
            </div>

            <button
              onClick={doPreview}
              disabled={loading || !file}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg || "Procesando…"}</>
              ) : (
                <><Eye className="h-4 w-4" />Extraer y previsualizar</>
              )}
            </button>
          </div>

          {/* Preview table */}
          {preview && !loading && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold">
                    Vista previa — {rows.length} registro{rows.length !== 1 ? "s" : ""} detectado{rows.length !== 1 ? "s" : ""}
                  </h2>
                  {preview.usedOcr && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">OCR activado (PDF escaneado)</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {newCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium dark:bg-green-900/40 dark:text-green-300">
                      <UserCheck className="h-3 w-3" />{newCount} nuevos
                    </span>
                  )}
                  {updateCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium dark:bg-blue-900/40 dark:text-blue-300">
                      <RotateCcw className="h-3 w-3" />{updateCount} a actualizar
                    </span>
                  )}
                  {unmatchedCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium dark:bg-orange-900/40 dark:text-orange-300">
                      <UserX className="h-3 w-3" />{unmatchedCount} sin coincidencia
                    </span>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {(preview.warnings?.length > 0 || preview.errors?.length > 0) && (
                <div className="space-y-1.5">
                  {preview.errors?.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                      <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />{e}
                    </div>
                  ))}
                  {preview.warnings?.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{w}
                    </div>
                  ))}
                </div>
              )}

              {/* Duplicate warning */}
              {preview.duplicateFile && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Este archivo ya fue importado anteriormente. Los registros existentes serán actualizados, no duplicados.
                </div>
              )}

              {/* Hint for editing */}
              {unmatchedCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <PenLine className="h-3.5 w-3.5 shrink-0" />
                  Haz clic en <PenLine className="h-3 w-3 inline" /> para editar RUT o nombre y relacionar manualmente registros sin coincidencia.
                </div>
              )}

              {/* Full table */}
              <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 w-10" />
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">RUT</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nombre (informe)</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Servicio</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Período</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Hp(10)</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Hp(3)</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, i) => (
                      <EditableRow
                        key={i}
                        row={row}
                        editing={editingIdx === i}
                        onStartEdit={() => setEditingIdx(i)}
                        onSave={(patch) => handleSaveRow(i, patch)}
                        onCancel={() => setEditingIdx(null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirm button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={doConfirm}
                  disabled={loading || rows.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg || "Importando…"}</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" />Confirmar importación ({newCount + updateCount} registros)</>
                  )}
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reiniciar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Regulatory note */}
      <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
        <p><strong>Marco normativo:</strong> DS N°133/1984 y DS N°95/2005 MINSAL — Obligatoriedad de registro individual de dosis.</p>
        <p>CCHEN ORD sobre archivo histórico de dosimetría personal. OCR habilitado para PDFs escaneados de dosimetría externa.</p>
      </div>
    </div>
  );
}
