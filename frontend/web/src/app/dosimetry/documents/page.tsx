"use client";


import { useEffect, useState } from "react";
import { RefreshCw, FileText, Upload } from "lucide-react";

interface DosDoc { id: number; filename: string; blob_url: string | null; mime_type: string | null; size_bytes: number | null; source_type: string; provider: string | null; period_label: string | null; year: number | null; uploaded_by: string | null; uploaded_at: string; used_ocr: boolean; records_count: number; status: string; }
interface Stats { pdfCount: number; excelCount: number; recordsExtracted: number; pendingValidation: number; totalDocuments: number; }

function fmtDate(d: string) { return new Date(d).toLocaleDateString("es-CL"); }
function fmtSize(b: number | null) { if (!b) return "—"; if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`; return `${(b / 1048576).toFixed(1)} MB`; }

const STATUS_STYLE: Record<string, string> = { processed: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", error: "bg-red-100 text-red-700" };

export default function DosimetryDocumentsPage() {
  const [docs, setDocs] = useState<DosDoc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/dosimetry/documents")
      .then(r => r.json())
      .then(d => { setDocs(d.documents ?? []); setStats(d.stats ?? null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><FileText className="h-6 w-6 text-blue-700" /></div>
            <div><h1 className="text-2xl font-bold text-gray-900">Documentos de Dosimetría</h1><p className="text-sm text-gray-500">PDFs y planillas importadas desde CCHEN</p></div>
          </div>
          <button onClick={load} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Total", value: stats.totalDocuments },
              { label: "PDFs", value: stats.pdfCount },
              { label: "Excel/CSV", value: stats.excelCount },
              { label: "Registros extraídos", value: stats.recordsExtracted },
              { label: "Pend. validación", value: stats.pendingValidation, color: stats.pendingValidation > 0 ? "text-yellow-600" : "text-gray-700" },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
                <div className={`text-xl font-bold ${t.color ?? "text-gray-700"}`}>{t.value}</div>
                <div className="text-xs text-gray-400 mt-1">{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700">
          <p className="font-medium mb-1">Importación de documentos</p>
          <p className="text-xs">Para importar nuevos documentos PDF use <strong>/dosimetry/import-pdf</strong>. Para importar planillas trimestrales CCHEN use <strong>/dosimetry/import-quarterly</strong>.</p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-400">
                <th className="text-left px-5 py-3">Archivo</th>
                <th className="text-left px-5 py-3">Período</th>
                <th className="text-left px-5 py-3">Proveedor</th>
                <th className="text-right px-5 py-3">Registros</th>
                <th className="text-right px-5 py-3">Tamaño</th>
                <th className="text-right px-5 py-3">Estado</th>
                <th className="text-right px-5 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="text-sm text-gray-800 max-w-48 truncate">{doc.filename}</div>
                        <div className="text-xs text-gray-400">{doc.source_type}{doc.used_ocr ? " · OCR" : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{doc.period_label ?? (doc.year ? String(doc.year) : "—")}</td>
                  <td className="px-5 py-3 text-gray-500">{doc.provider ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-mono text-gray-700">{doc.records_count}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{fmtSize(doc.size_bytes)}</td>
                  <td className="px-5 py-3 text-right"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[doc.status] ?? "bg-gray-100 text-gray-600"}`}>{doc.status}</span></td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">{fmtDate(doc.uploaded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {docs.length === 0 && !loading && <div className="text-center py-12 text-gray-400">No hay documentos importados</div>}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>DS N°133/1984 MINSAL — Obligatoriedad de registro histórico de dosis individuales. CCHEN — Planilla oficial "Resumen - 908.xlsm" para declaración trimestral de dosis. Resolución CCHEN sobre archivo de registros dosimétricos por 50 años.</p>
        </div>
      </div>
    </div>
  );
}
