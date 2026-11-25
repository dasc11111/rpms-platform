"use client";


import { useEffect, useRef, useState } from "react";
import { RefreshCw, FileText, Upload, AlertTriangle } from "lucide-react";

interface DispDoc {
  id: number; transport_date: string; file_name: string; mime_type: string | null;
  size_bytes: number | null; version: number; is_current: boolean;
  uploaded_by: string | null; uploaded_at: string;
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtSize(b: number | null) {
  if (!b) return "—";
  return b < 1024 ? b + " B" : b < 1_048_576 ? (b / 1024).toFixed(0) + " KB" : (b / 1_048_576).toFixed(1) + " MB";
}
function today() { return new Date().toISOString().slice(0, 10); }

export default function DispatchDocumentsPage() {
  const [date, setDate] = useState(today());
  const [docs, setDocs] = useState<DispDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedBy, setUploadedBy] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = (d = date) => {
    if (!d) return;
    setLoading(true);
    fetch(`/api/transport/dispatch-documents?date=${d}`)
      .then(r => r.json())
      .then(j => setDocs(j.documents ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast("Selecciona un archivo."); return; }
    if (!date) { toast("Indica la fecha de transporte."); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("transportDate", date);
    if (uploadedBy) fd.append("uploadedBy", uploadedBy);
    const r = await fetch("/api/transport/dispatch-documents", { method: "POST", body: fd });
    setUploading(false);
    if (r.ok) { fetchData(date); toast("Documento cargado correctamente."); if (fileRef.current) fileRef.current.value = ""; }
    else { const e = await r.json(); toast(e.error || "Error al subir."); }
  };

  const current = docs.find(d => d.is_current);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100"><FileText className="h-6 w-6 text-orange-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documentos de Despacho</h1>
              <p className="text-sm text-gray-500">Manifiestos de transporte radiactivo por fecha — DS 12/2010 · IAEA SSR-6</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 hover:text-gray-600 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {msg && <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm text-orange-700">{msg}</div>}

        {/* Date selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <label className="text-xs text-gray-500 mb-1 block">Fecha de transporte</label>
          <div className="flex gap-3">
            <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
            <button onClick={() => fetchData(date)} disabled={loading || !date} className="shrink-0 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
              Buscar
            </button>
          </div>
        </div>

        {/* Current document */}
        {current ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" /> Documento vigente — {fmtDate(current.transport_date)}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><div className="text-xs text-gray-400 mb-0.5">Archivo</div><div className="font-medium text-orange-600">{current.file_name}</div></div>
              <div><div className="text-xs text-gray-400 mb-0.5">Tamaño</div><div>{fmtSize(current.size_bytes)}</div></div>
              <div><div className="text-xs text-gray-400 mb-0.5">Versión</div><div className="font-semibold">v{current.version}</div></div>
              <div><div className="text-xs text-gray-400 mb-0.5">Subido por</div><div>{current.uploaded_by || "—"}</div></div>
              <div><div className="text-xs text-gray-400 mb-0.5">Fecha de carga</div><div>{fmtDate(current.uploaded_at)}</div></div>
            </div>
          </div>
        ) : date ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 flex items-center gap-3 text-yellow-700 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>No hay documento de despacho para <strong>{fmtDate(date)}</strong>.</span>
          </div>
        ) : null}

        {/* Upload */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4 text-orange-500" /> {current ? "Actualizar documento" : "Cargar documento"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha de transporte *</label>
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Subido por</label>
              <input className={inp} value={uploadedBy} onChange={e => setUploadedBy(e.target.value)} placeholder="Nombre del responsable" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Archivo (PDF, imagen) *</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
          </div>
          <button onClick={handleUpload} disabled={uploading} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
            <Upload className="h-4 w-4" /> {uploading ? "Subiendo…" : "Subir documento"}
          </button>
        </div>

        {/* History */}
        {docs.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Versiones anteriores — {fmtDate(date)}</h2>
            <div className="space-y-1">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 pb-1 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">v{d.version}</span>
                    <span className="text-gray-700">{d.file_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{fmtDate(d.uploaded_at)}</span>
                    {d.is_current && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Vigente</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>DS N°12/2010 MINSAL — Artículo 24: documentos requeridos para el transporte de material radiactivo. IAEA SSR-6 (Rev.1) — Capítulo 5: requisitos de documentación para bultos radiactivos. DS N°1.439/2015 MTC — Manifiestos de transporte de mercancías peligrosas. CCHEN ORD sobre registros de operaciones de transporte.</p>
        </div>
      </div>
    </div>
  );
}
