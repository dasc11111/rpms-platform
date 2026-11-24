"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";

interface ImportResult {
  inserted: number;
  updated: number;
  unmatched: number;
  unmatchedSamples?: string[];
  alertSummaries?: unknown[];
}

interface PreviewRow {
  raw: unknown[];
}

export default function DosimetryImportQuarterlyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Send file to server for parsing (avoids client-side xlsx dependency)
  const handleFile = async (f: File) => {
    setFile(f);
    setError("");
    setPreview(null);
    setResult(null);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("action", "preview");

      const res = await fetch("/api/dosimetry/import-quarterly", {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as {
        ok: boolean;
        error?: string;
        rows?: unknown[][];
        rowCount?: number;
      };

      if (!res.ok || data.ok === false) {
        setError(data.error ?? "Error al procesar el archivo en el servidor.");
      } else {
        const rows = data.rows ?? [];
        setPreview(rows.map((r) => ({ raw: r as unknown[] })));
      }
    } catch (e) {
      setError("Error al enviar el archivo: " + String(e));
    }

    setParsing(false);
  };

  const doImport = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", "import");

      const res = await fetch("/api/dosimetry/import-quarterly", {
        method: "POST",
        body: formData,
      });

      const d = await res.json() as {
        ok: boolean;
        error?: string;
        inserted?: number;
        updated?: number;
        unmatched?: number;
        unmatchedSamples?: string[];
        alertSummaries?: unknown[];
      };

      if (d.ok === false && d.error) {
        setError(d.error);
      } else {
        setResult({
          inserted: d.inserted ?? 0,
          updated: d.updated ?? 0,
          unmatched: d.unmatched ?? 0,
          unmatchedSamples: d.unmatchedSamples,
          alertSummaries: d.alertSummaries,
        });
      }
    } catch (e) {
      setError("Error al importar: " + String(e));
    }

    setImporting(false);
  };

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success-subtle">
            <FileSpreadsheet className="h-6 w-6 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Importar Planilla Trimestral</h1>
            <p className="text-sm text-muted-foreground">Importación desde planilla oficial CCHEN "Resumen - 908.xlsm"</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-info-subtle border border-info/20 rounded-xl px-5 py-4 text-sm text-foreground space-y-1">
          <p className="font-semibold">Instrucciones</p>
          <ol className="list-decimal ml-4 space-y-1 text-xs text-muted-foreground">
            <li>Abre la planilla oficial CCHEN "Resumen - 908.xlsm" con los datos del trimestre.</li>
            <li>Exporta o guarda la hoja "Reportes por trimestre" como archivo .xlsx o .csv.</li>
            <li>Carga el archivo aquí; el sistema detectará automáticamente las filas de datos.</li>
            <li>Revisa la vista previa y confirma la importación.</li>
          </ol>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-danger-subtle border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-success-subtle border border-success/20 rounded-xl px-5 py-4 space-y-1">
            <div className="flex items-center gap-2 text-success font-semibold text-sm">
              <CheckCircle className="h-5 w-5" /> Importación completada
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                { label: "Insertados", value: result.inserted },
                { label: "Actualizados", value: result.updated },
                { label: "Sin coincidencia", value: result.unmatched, warn: result.unmatched > 0 },
              ].map((t) => (
                <div key={t.label} className="bg-background rounded-lg border border-border p-3 text-center">
                  <div className={`text-xl font-bold ${t.warn ? "text-warning" : "text-foreground"}`}>{t.value}</div>
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                </div>
              ))}
            </div>
            {result.unmatched > 0 && result.unmatchedSamples?.length && (
              <div className="mt-2 text-xs text-warning">
                RUTs sin coincidencia (muestra): {result.unmatchedSamples.slice(0, 10).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Upload zone */}
        <div
          className="bg-background rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3 cursor-pointer hover:border-accent/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <div className="text-sm text-muted-foreground">
            Arrastra el archivo <span className="font-medium">.xlsx / .xls / .csv</span> aquí, o haz clic para seleccionar
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-sm px-4 py-2 rounded-lg"
          >
            Seleccionar archivo
          </button>
          {file && (
            <div className="text-xs text-muted-foreground mt-1">
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </div>
          )}
        </div>

        {parsing && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Procesando archivo en el servidor…
          </div>
        )}

        {/* Preview */}
        {preview !== null && !parsing && (
          <div className="bg-background rounded-xl border border-border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-foreground">Vista previa</div>
              <span className="text-sm text-muted-foreground">{preview.length} filas de datos detectadas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1 pr-3">Institución</th>
                    <th className="text-left pb-1 pr-3">Depto</th>
                    <th className="text-left pb-1 pr-3">Período</th>
                    <th className="text-left pb-1 pr-3">Nombre</th>
                    <th className="text-left pb-1">RUN</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1 pr-3 max-w-24 truncate">{String(r.raw[0] ?? "")}</td>
                      <td className="py-1 pr-3 max-w-24 truncate">{String(r.raw[1] ?? "")}</td>
                      <td className="py-1 pr-3">{String(r.raw[2] ?? "")}</td>
                      <td className="py-1 pr-3 max-w-32 truncate">{String(r.raw[3] ?? "")}</td>
                      <td className="py-1">{String(r.raw[4] ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 8 && (
                <div className="text-muted-foreground text-xs mt-1">… y {preview.length - 8} filas más</div>
              )}
            </div>
            <button
              onClick={doImport}
              disabled={importing || preview.length === 0}
              className="w-full bg-success hover:bg-success/90 disabled:opacity-50 text-success-foreground font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando…</>
              ) : (
                `Confirmar importación (${preview.length} filas)`
              )}
            </button>
          </div>
        )}

        {/* Legal note */}
        <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground/70 mb-1">Marco normativo</p>
          <p>CCHEN — Planilla oficial "Resumen - 908.xlsm". DS N°133/1984 y DS N°95/2005 MINSAL — Obligatoriedad de declaración trimestral. Formato de columnas: [0] INSTITUCIÓN [1] DEPARTAMENTO [2] PERÍODO [3] NOMBRE [4] RUN [5-7] códigos cualitativos [8-10] dosis cuantitativas [11-19] acumuladas.</p>
        </div>
      </div>
    </div>
  );
}
