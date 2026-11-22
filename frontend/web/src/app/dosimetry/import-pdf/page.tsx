"use client";

import { useRef, useState } from "react";
import { Upload, Eye, CheckCircle, AlertTriangle, FileText } from "lucide-react";

interface PreviewRow { worker_rut: string; worker_name: string; period_label: string; dose_body: number; dose_lens: number; dose_skin: number; matched: boolean; }
interface PreviewResult { rows: PreviewRow[]; unmatched: number; documentId?: number; }
interface ConfirmResult { inserted: number; updated: number; }

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

export default function DosimetryImportPdfPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState("1");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doPreview = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { setError("Selecciona un archivo PDF."); return; }
    setFile(f); setLoading(true); setError(""); setPreview(null); setConfirmResult(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("provider", provider);
    fd.append("year", year);
    fd.append("quarter", quarter);
    const r = await fetch("/api/dosimetry/import-pdf/preview", { method: "POST", body: fd });
    const d = await r.json();
    setLoading(false);
    if (d.error) setError(d.error);
    else setPreview(d);
  };

  const doConfirm = async () => {
    if (!preview?.documentId) return;
    setLoading(true); setError("");
    const r = await fetch("/api/dosimetry/import-pdf/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: preview.documentId }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.error) setError(d.error);
    else setConfirmResult(d);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><FileText className="h-6 w-6 text-blue-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importar Informe PDF</h1>
            <p className="text-sm text-gray-500">Importación de informes PDF de dosis desde dosimetría externa</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-700 space-y-1">
          <p className="font-semibold">Proceso de importación</p>
          <ol className="list-decimal ml-4 space-y-1 text-xs">
            <li>Selecciona el PDF del informe trimestral de dosis del proveedor.</li>
            <li>Indica el proveedor, año y trimestre correspondiente.</li>
            <li>Presiona "Vista previa" para verificar los datos extraídos.</li>
            <li>Si la vista previa es correcta, confirma la importación.</li>
          </ol>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

        {confirmResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-3"><CheckCircle className="h-5 w-5" /> Importación confirmada</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-green-100 p-3 text-center"><div className="text-xl font-bold text-gray-700">{confirmResult.inserted}</div><div className="text-xs text-gray-400">Nuevos registros</div></div>
              <div className="bg-white rounded-lg border border-green-100 p-3 text-center"><div className="text-xl font-bold text-gray-700">{confirmResult.updated}</div><div className="text-xs text-gray-400">Actualizados</div></div>
            </div>
          </div>
        )}

        {/* Upload form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Configuración de importación</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Proveedor de dosimetría</label><input className={inp} value={provider} onChange={e => setProvider(e.target.value)} placeholder="Ej: CCHEN, Dosimetría Sur, etc." /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Año</label>
              <select className={inp} value={year} onChange={e => setYear(e.target.value)}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Trimestre</label>
              <select className={inp} value={quarter} onChange={e => setQuarter(e.target.value)}>
                {[1, 2, 3, 4].map(q => <option key={q} value={q}>T{q}</option>)}
              </select>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center space-y-2">
            <Upload className="h-8 w-8 text-gray-300 mx-auto" />
            <div className="text-sm text-gray-500">{file ? file.name : "Selecciona el PDF del informe de dosis"}</div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
            <button onClick={() => fileRef.current?.click()} className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm px-4 py-2 rounded-lg border border-blue-200">Seleccionar PDF</button>
          </div>

          <button onClick={doPreview} disabled={loading || !file} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg">
            <Eye className="h-4 w-4" />{loading && !preview ? "Procesando…" : "Vista previa"}
          </button>
        </div>

        {/* Preview */}
        {preview && !confirmResult && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Vista previa — {preview.rows.length} filas detectadas</h2>
              {preview.unmatched > 0 && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{preview.unmatched} sin coincidencia</span>}
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b">
                <th className="text-left pb-1 pr-3">RUT</th>
                <th className="text-left pb-1 pr-3">Nombre</th>
                <th className="text-left pb-1 pr-3">Período</th>
                <th className="text-right pb-1 pr-3">Hp(10)</th>
                <th className="text-right pb-1">Coincide</th>
              </tr></thead>
              <tbody>
                {preview.rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 pr-3 font-mono">{r.worker_rut}</td>
                    <td className="py-1 pr-3 max-w-32 truncate">{r.worker_name}</td>
                    <td className="py-1 pr-3">{r.period_label}</td>
                    <td className="py-1 pr-3 text-right font-mono">{r.dose_body.toFixed(2)}</td>
                    <td className="py-1 text-right">{r.matched ? <span className="text-green-500">✓</span> : <span className="text-orange-500">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 10 && <div className="text-xs text-gray-400">… y {preview.rows.length - 10} filas más</div>}
            <button onClick={doConfirm} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />{loading ? "Importando…" : "Confirmar importación"}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>DS N°133/1984 y DS N°95/2005 MINSAL — Obligatoriedad de registro individual de dosis. CCHEN ORD sobre archivo histórico de dosimetría personal. OCR habilitado para PDFs escaneados de dosimetría externa.</p>
        </div>
      </div>
    </div>
  );
}
