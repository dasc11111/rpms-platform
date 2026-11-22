"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";

interface ImportResult { inserted: number; updated: number; unmatched: number; unmatchedSamples?: string[]; alertSummaries?: unknown[]; }

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

export default function DosimetryImportQuarterlyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Parse XLSX client-side using SheetJS (if available) or show JSON instructions
  const handleFile = async (f: File) => {
    setFile(f); setError(""); setRows(null); setResult(null);
    setParsing(true);
    try {
      // Try dynamic import of xlsx
      const XLSX = await import("xlsx").catch(() => null);
      if (!XLSX) { setError("Librería xlsx no disponible. Usa la importación JSON manual."); setParsing(false); return; }
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes("trimestre")) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName!];
      const data = XLSX.utils.sheet_to_json<unknown[]>(ws!, { header: 1, defval: "" });
      // Skip header row(s): look for first row where col[4] looks like a RUT
      const dataRows = (data as unknown[][]).filter(r => {
        const val = String(r[4] ?? "").trim();
        return /^\d{7,8}-[\dkK]$|^\d{7,8}$/.test(val.replace(/[.\-]/g, "").slice(0, 9)) && val.length > 4;
      });
      setRows(dataRows);
    } catch (e) {
      setError("Error al parsear el archivo: " + String(e));
    }
    setParsing(false);
  };

  const doImport = async () => {
    if (!rows?.length) return;
    setImporting(true); setError(""); setResult(null);
    const r = await fetch("/api/dosimetry/import-quarterly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const d = await r.json();
    setImporting(false);
    if (d.ok === false && d.error) setError(d.error);
    else setResult({ inserted: d.inserted ?? 0, updated: d.updated ?? 0, unmatched: d.unmatched ?? 0, unmatchedSamples: d.unmatchedSamples, alertSummaries: d.alertSummaries });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100"><FileSpreadsheet className="h-6 w-6 text-green-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importar Planilla Trimestral</h1>
            <p className="text-sm text-gray-500">Importación desde planilla oficial CCHEN "Resumen - 908.xlsm"</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-700 space-y-1">
          <p className="font-semibold">Instrucciones</p>
          <ol className="list-decimal ml-4 space-y-1 text-xs">
            <li>Abre la planilla oficial CCHEN "Resumen - 908.xlsm" con los datos del trimestre.</li>
            <li>Exporta o guarda la hoja "Reportes por trimestre" como archivo .xlsx o .csv.</li>
            <li>Carga el archivo aquí; el sistema detectará automáticamente las filas de datos.</li>
            <li>Revisa la vista previa y confirma la importación.</li>
          </ol>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4 inline mr-2" />{error}</div>}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-1">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-sm"><CheckCircle className="h-5 w-5" /> Importación completada</div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[{ label: "Insertados", value: result.inserted }, { label: "Actualizados", value: result.updated }, { label: "Sin coincidencia", value: result.unmatched, color: result.unmatched > 0 ? "text-orange-600" : "text-gray-700" }].map(t => (
                <div key={t.label} className="bg-white rounded-lg border border-green-100 p-3 text-center">
                  <div className={`text-xl font-bold ${t.color ?? "text-gray-700"}`}>{t.value}</div>
                  <div className="text-xs text-gray-400">{t.label}</div>
                </div>
              ))}
            </div>
            {result.unmatched > 0 && result.unmatchedSamples?.length && (
              <div className="mt-2 text-xs text-orange-600">RUTs sin coincidencia (muestra): {result.unmatchedSamples.slice(0, 10).join(", ")}</div>
            )}
          </div>
        )}

        {/* Upload zone */}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-3">
          <Upload className="h-10 w-10 text-gray-300 mx-auto" />
          <div className="text-sm text-gray-500">Arrastra el archivo .xlsx / .csv aquí</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => fileRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">Seleccionar archivo</button>
          {file && <div className="text-xs text-gray-400 mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</div>}
        </div>

        {parsing && <div className="text-center text-sm text-gray-400 animate-pulse">Analizando archivo…</div>}

        {rows !== null && !parsing && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-800">Vista previa</div>
              <span className="text-sm text-gray-500">{rows.length} filas de datos detectadas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead><tr className="text-gray-400 border-b">
                  <th className="text-left pb-1 pr-3">Institución</th>
                  <th className="text-left pb-1 pr-3">Depto</th>
                  <th className="text-left pb-1 pr-3">Período</th>
                  <th className="text-left pb-1 pr-3">Nombre</th>
                  <th className="text-left pb-1">RUN</th>
                </tr></thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1 pr-3 max-w-24 truncate">{String(r[0] ?? "")}</td>
                      <td className="py-1 pr-3 max-w-24 truncate">{String(r[1] ?? "")}</td>
                      <td className="py-1 pr-3">{String(r[2] ?? "")}</td>
                      <td className="py-1 pr-3 max-w-32 truncate">{String(r[3] ?? "")}</td>
                      <td className="py-1">{String(r[4] ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && <div className="text-gray-400 text-xs mt-1">… y {rows.length - 8} filas más</div>}
            </div>
            <button onClick={doImport} disabled={importing || rows.length === 0} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg">
              {importing ? "Importando…" : `Confirmar importación (${rows.length} filas)`}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>CCHEN — Planilla oficial "Resumen - 908.xlsm". DS N°133/1984 y DS N°95/2005 MINSAL — Obligatoriedad de declaración trimestral. Formato de columnas: [0] INSTITUCIÓN [1] DEPARTAMENTO [2] PERÍODO [3] NOMBRE [4] RUN [5-7] códigos cualitativos [8-10] dosis cuantitativas [11-19] acumuladas.</p>
        </div>
      </div>
    </div>
  );
}
