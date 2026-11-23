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
  Tag,
  UserCheck,
  UserX,
  RotateCcw,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DosimetersSubnav } from "@/components/dosimeters/dosimeters-subnav";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow {
  rowIndex: number;
  raw_code: string;
  raw_rut: string;
  raw_name: string;
  raw_service: string;
  raw_type: string;
  code_normalized: string;
  rut_normalized: string;
  worker_matched: boolean;
  worker_id: number | null;
  worker_name_system: string | null;
  worker_name_report: string;
  service_system: string | null;
  dosimeter_exists: boolean;
  dosimeter_id: number | null;
  dosimeter_status: string | null;
  conflict: boolean;
  conflict_reason: string;
  resolution: "asignar" | "reasignar" | "crear_y_asignar" | "ya_asignado" | "sin_trabajador";
}

interface PreviewResult {
  ok: boolean;
  fileName: string;
  fileHash: string;
  usedOcr: boolean;
  duplicateFile: boolean;
  totalDetected: number;
  newDosimeters: number;
  existingDosimeters: number;
  rows: ParsedRow[];
  warnings: string[];
  errors: string[];
}

interface ConfirmResult {
  ok: boolean;
  created: number;
  assigned: number;
  skipped: number;
  errors: number;
  alerts: string[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function RowBadge({ row }: { row: ParsedRow }) {
  if (row.resolution === "ya_asignado") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
        <CheckCircle className="h-3 w-3" />
        Ya asignado
      </span>
    );
  }
  if (row.resolution === "sin_trabajador") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
        <UserX className="h-3 w-3" />
        Sin trabajador
      </span>
    );
  }
  if (row.resolution === "reasignar") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
        <ArrowRightLeft className="h-3 w-3" />
        Reasignar
      </span>
    );
  }
  if (row.resolution === "crear_y_asignar") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
        <Tag className="h-3 w-3" />
        Crear y asignar
      </span>
    );
  }
  // asignar
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
      <UserCheck className="h-3 w-3" />
      Asignar
    </span>
  );
}

// ─── Editable row ─────────────────────────────────────────────────────────────

function EditableRow({
  row,
  editing,
  onStartEdit,
  onSave,
  onCancel,
}: {
  row: ParsedRow;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (patch: Partial<ParsedRow>) => void;
  onCancel: () => void;
}) {
  const [codeVal, setCodeVal] = useState(row.raw_code);
  const [rutVal, setRutVal] = useState(row.raw_rut);
  const [nameVal, setNameVal] = useState(row.worker_name_report);

  const rowClass = cn(
    "border-b border-border text-sm transition-colors",
    row.resolution === "sin_trabajador" && "bg-orange-50/40 dark:bg-orange-950/10",
    row.resolution === "reasignar" && "bg-amber-50/40 dark:bg-amber-950/10",
    row.resolution === "ya_asignado" && "bg-muted/30",
    editing && "bg-muted/60"
  );

  if (editing) {
    return (
      <tr className={rowClass}>
        <td className="px-3 py-2 w-10">
          <div className="flex gap-1">
            <button onClick={() => onSave({ raw_code: codeVal.trim(), raw_rut: rutVal.trim(), worker_name_report: nameVal.trim() })}
              className="p-1 rounded hover:bg-green-100 text-green-700" title="Guardar">
              <Save className="h-3.5 w-3.5" />
            </button>
            <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Cancelar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
        <td className="px-3 py-2">
          <input autoFocus className="w-full border border-border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={codeVal} onChange={(e) => setCodeVal(e.target.value)} placeholder="Código XA" />
        </td>
        <td className="px-3 py-2">
          <input className="w-full border border-border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={rutVal} onChange={(e) => setRutVal(e.target.value)} placeholder="RUT" />
        </td>
        <td className="px-3 py-2" colSpan={2}>
          <input className="w-full border border-border rounded px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="Nombre trabajador" />
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{row.raw_type}</td>
        <td className="px-3 py-2" />
      </tr>
    );
  }

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2 w-10">
        <button onClick={onStartEdit} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
          <PenLine className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
        {row.code_normalized}
        {row.dosimeter_exists && (
          <span className="ml-1.5 text-[10px] text-muted-foreground">({row.dosimeter_status})</span>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
        {row.rut_normalized || <span className="text-muted-foreground italic">—</span>}
      </td>
      <td className="px-3 py-2 max-w-[160px]">
        <div className="text-xs font-medium truncate" title={row.worker_name_report}>{row.worker_name_report}</div>
        {row.worker_matched && row.worker_name_system && row.worker_name_system !== row.worker_name_report && (
          <div className="text-xs text-muted-foreground truncate" title={row.worker_name_system}>→ {row.worker_name_system}</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px] truncate">
        {row.service_system ?? row.raw_service || "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{row.raw_type.replace(/_/g, " ")}</td>
      <td className="px-3 py-2">
        <div className="space-y-0.5">
          <RowBadge row={row} />
          {row.conflict && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400">{row.conflict_reason}</div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function DosimetersImportPdfPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");

  const extractPdfText = useCallback(async (f: File) => {
    setLoadingMsg("Extrayendo texto del PDF…");
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await f.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

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
    const usedOcr = rawText.trim().length < 100;
    return { rawText, pagesText, fileHash, usedOcr };
  }, []);

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
      setLoadingMsg("Analizando informe de dosímetros…");
      const r = await fetch("/api/dosimeters/import-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, pagesText, fileName: f.name, fileHash, usedOcr, action: "preview" }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else { setPreview(d); setRows(d.rows ?? []); }
    } catch (e) {
      setError(`Error procesando el PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const doConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    setLoadingMsg("Guardando asignaciones…");
    setError("");
    try {
      const r = await fetch("/api/dosimeters/import-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          rows,
          uploadedBy: "Usuario RPMS",
          fileHash: preview.fileHash,
          fileName: preview.fileName,
          provider,
        }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setConfirmResult(d);
    } catch (e) {
      setError(`Error confirmando: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setRows([]); setConfirmResult(null); setError(""); setEditingIdx(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toAssign = rows.filter((r) => r.resolution === "asignar" || r.resolution === "crear_y_asignar" || r.resolution === "reasignar").length;
  const noWorkerCount = rows.filter((r) => r.resolution === "sin_trabajador").length;
  const conflictCount = rows.filter((r) => r.conflict).length;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
          <Tag className="h-6 w-6 text-indigo-700 dark:text-indigo-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Importar Dosímetros desde PDF</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sube el informe PDF del proveedor para asignar dosímetros automáticamente a trabajadores</p>
        </div>
      </div>

      <DosimetersSubnav active="importar" />

      {/* Steps */}
      <div className="flex gap-3 text-xs">
        {["1. Subir PDF", "2. Revisar y editar", "3. Confirmar asignación"].map((step, i) => {
          const active = i === 0 ? !preview && !confirmResult : i === 1 ? !!preview && !confirmResult : !!confirmResult;
          return (
            <div key={i} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", active ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-300" : "border-border text-muted-foreground")}>
              <span className={cn("w-4 h-4 rounded-full text-center leading-4 text-xs", active ? "bg-indigo-500 text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>
              {step}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {confirmResult && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-green-700 font-semibold mb-4">
            <CheckCircle className="h-5 w-5" />
            Importación completada
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Dosímetros creados", value: confirmResult.created, color: "text-blue-700" },
              { label: "Asignaciones actualizadas", value: confirmResult.assigned, color: "text-green-700" },
              { label: "Omitidos", value: confirmResult.skipped, color: "text-muted-foreground" },
              { label: "Errores", value: confirmResult.errors, color: "text-red-600" },
            ].map((item, i) => (
              <div key={i} className="bg-background rounded-xl border p-3 text-center">
                <div className={cn("text-2xl font-bold font-mono", item.color)}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          {confirmResult.alerts?.length > 0 && (
            <div className="mt-4 space-y-1">
              {confirmResult.alerts.map((a, i) => (
                <div key={i} className="text-xs text-amber-700 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />{a}
                </div>
              ))}
            </div>
          )}
          <button onClick={reset} className="mt-4 flex items-center gap-2 text-sm text-indigo-700 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" />Importar otro informe
          </button>
        </div>
      )}

      {!confirmResult && (
        <>
          {/* Upload form */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm">Configuración</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Proveedor (opcional)</label>
              <input className={inp} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Ej: CCHEN, Dosimetría Sur…" />
            </div>
            <div className={cn("border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors", file ? "border-indigo-400 bg-indigo-50/40" : "border-border hover:border-indigo-300")}>
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-indigo-500 mx-auto" />
                  <p className="text-sm font-medium text-indigo-700">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; setPreview(null); setRows([]); }} className="text-xs text-muted-foreground hover:text-foreground underline">Cambiar archivo</button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">Arrastra aquí el PDF o selecciónalo</p>
                  <button onClick={() => fileRef.current?.click()} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm px-4 py-2 rounded-lg border border-indigo-200">Seleccionar PDF</button>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(null); setRows([]); } }} />
            </div>
            <button onClick={doPreview} disabled={loading || !file} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg || "Procesando…"}</> : <><Eye className="h-4 w-4" />Extraer y previsualizar</>}
            </button>
          </div>

          {/* Preview */}
          {preview && !loading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <h2 className="font-semibold">Vista previa — {rows.length} dosímetro(s) detectado(s)</h2>
                  {preview.usedOcr && <p className="text-xs text-amber-600 mt-0.5">OCR activado</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {toAssign > 0 && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium"><UserCheck className="h-3 w-3" />{toAssign} a asignar</span>}
                  {conflictCount > 0 && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium"><RotateCcw className="h-3 w-3" />{conflictCount} conflictos</span>}
                  {noWorkerCount > 0 && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium"><UserX className="h-3 w-3" />{noWorkerCount} sin trabajador</span>}
                </div>
              </div>

              {(preview.warnings?.length > 0 || preview.errors?.length > 0) && (
                <div className="space-y-1.5">
                  {preview.errors?.map((e, i) => <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2"><X className="h-3.5 w-3.5 mt-0.5 shrink-0" />{e}</div>)}
                  {preview.warnings?.map((w, i) => <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{w}</div>)}
                </div>
              )}

              {noWorkerCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <PenLine className="h-3.5 w-3.5 shrink-0" />
                  Haz clic en <PenLine className="h-3 w-3 inline" /> para corregir código, RUT o nombre antes de importar.
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 w-10" />
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Código</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">RUT</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Nombre (informe)</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Servicio</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, i) => (
                      <EditableRow key={i} row={row} editing={editingIdx === i}
                        onStartEdit={() => setEditingIdx(i)}
                        onSave={(patch) => { setRows((prev) => prev.map((r, j) => j === i ? { ...r, ...patch } : r)); setEditingIdx(null); }}
                        onCancel={() => setEditingIdx(null)} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-4">
                <button onClick={doConfirm} disabled={loading || toAssign === 0} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg}</> : <><CheckCircle className="h-4 w-4" />Confirmar importación ({toAssign} registros)</>}
                </button>
                <button onClick={reset} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />Reiniciar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-muted-foreground border-t border-border pt-4">
        <strong>Formatos compatibles:</strong> Informes PDF de CCHEN, Dosimetría Sur, Dosimetría Chile y otros proveedores con código XA + RUT por fila.
        El sistema detecta automáticamente códigos en formato XA-NNNN y RUTs chilenos (XXXXXXXX-X).
      </div>
    </div>
  );
}
