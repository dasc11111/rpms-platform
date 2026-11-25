"use client";


import { useEffect, useRef, useState } from "react";
import { RefreshCw, FileCheck, Upload, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthDoc {
  id: number; number: string | null; issued_date: string | null; expiry_date: string | null;
  file_name: string; mime_type: string | null; size_bytes: number | null;
  version: number; is_current: boolean; uploaded_by: string | null; uploaded_at: string;
}
interface AuthData { ok: boolean; current: AuthDoc | null; history: AuthDoc[]; }

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtSize(b: number | null) {
  if (!b) return "—";
  return b < 1024 ? b + " B" : b < 1_048_576 ? (b / 1024).toFixed(0) + " KB" : (b / 1_048_576).toFixed(1) + " MB";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransportAuthorizationPage() {
  const [data, setData] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ number: "", issuedDate: "", expiryDate: "", uploadedBy: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/transport/authorization")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast("Selecciona un archivo."); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    if (form.number) fd.append("number", form.number);
    if (form.issuedDate) fd.append("issuedDate", form.issuedDate);
    if (form.expiryDate) fd.append("expiryDate", form.expiryDate);
    if (form.uploadedBy) fd.append("uploadedBy", form.uploadedBy);
    const r = await fetch("/api/transport/authorization", { method: "POST", body: fd });
    setUploading(false);
    if (r.ok) { fetchData(); toast("Autorización actualizada correctamente."); setForm({ number: "", issuedDate: "", expiryDate: "", uploadedBy: "" }); if (fileRef.current) fileRef.current.value = ""; }
    else { const e = await r.json(); toast(e.error || "Error al subir archivo."); }
  };

  const current = data?.current;
  const days = daysUntil(current?.expiry_date ?? null);
  const alertLevel = days == null ? "none" : days < 0 ? "expired" : days <= 30 ? "critical" : days <= 90 ? "warning" : "ok";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileCheck className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Autorización de Transporte Radiactivo</h1>
              <p className="text-sm text-gray-500">Gestión del documento de autorización vigente — CCHEN / MINSAL</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {msg && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>
        )}

        {loading && !data ? (
          <div className="text-center py-16 text-gray-400">Cargando autorización...</div>
        ) : (
          <>
            {/* Expiry alert */}
            {alertLevel === "expired" && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3 text-red-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span><strong>Autorización vencida</strong> hace {Math.abs(days!)} días — actualizar de inmediato.</span>
              </div>
            )}
            {alertLevel === "critical" && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3 text-orange-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>La autorización vence en <strong>{days}</strong> días. Iniciar proceso de renovación.</span>
              </div>
            )}
            {alertLevel === "warning" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 flex items-center gap-3 text-yellow-700 text-sm">
                <Clock className="h-5 w-5 shrink-0" />
                <span>La autorización vence en <strong>{days}</strong> días. Planificar renovación.</span>
              </div>
            )}

            {/* Current auth */}
            {current ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <h2 className="font-semibold text-gray-800">Autorización Vigente</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">N° Autorización</div>
                    <div className="font-semibold text-gray-800">{current.number || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Fecha de emisión</div>
                    <div className="font-semibold text-gray-800">{fmtDate(current.issued_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Fecha de vencimiento</div>
                    <div className={`font-semibold ${alertLevel === "expired" ? "text-red-600" : alertLevel === "critical" ? "text-orange-600" : "text-gray-800"}`}>
                      {fmtDate(current.expiry_date)}
                      {days != null && <span className="text-xs font-normal ml-1 text-gray-400">({days > 0 ? `en ${days} días` : `vencida hace ${Math.abs(days)} días`})</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Versión</div>
                    <div className="font-semibold text-gray-800">v{current.version}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Archivo</div>
                    <div className="font-medium text-blue-600 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {current.file_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Tamaño</div>
                    <div className="text-gray-700">{fmtSize(current.size_bytes)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Subido por</div>
                    <div className="text-gray-700">{current.uploaded_by || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Fecha de carga</div>
                    <div className="text-gray-700">{fmtDate(current.uploaded_at)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-6 text-center text-red-600 text-sm">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">Sin autorización registrada</p>
                <p className="text-xs mt-1">Cargar el documento de autorización vigente.</p>
              </div>
            )}

            {/* Upload form */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-500" /> {current ? "Actualizar Autorización" : "Cargar Autorización"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">N° de autorización</label>
                  <input className={inp} value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="Ej: 2024-TR-001" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subido por</label>
                  <input className={inp} value={form.uploadedBy} onChange={e => setForm(f => ({ ...f, uploadedBy: e.target.value }))} placeholder="Nombre del responsable" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha de emisión</label>
                  <input className={inp} type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha de vencimiento</label>
                  <input className={inp} type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Archivo (PDF, imagen) *</label>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Subiendo…" : "Subir autorización"}
              </button>
            </div>

            {/* History */}
            {(data?.history?.length ?? 0) > 1 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-3">Historial de versiones</h2>
                <div className="space-y-1">
                  {data!.history.slice(0, 20).map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 pb-1 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">v{h.version}</span>
                        <span className="text-gray-700">{h.file_name}</span>
                        {h.number && <span className="text-xs text-gray-400">{h.number}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{fmtDate(h.uploaded_at)}</span>
                        {h.is_current && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Vigente</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regulatory footer */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°12/2010 MINSAL — Reglamento de protección radiológica; requisitos de autorización para transporte.
                DS N°133/1984 Ministerio de Minería — Reglamento de Seguridad Radiológica, transporte de material radiactivo.
                IAEA Safety Standards Series SSR-6 (Rev.1) — Regulations for the Safe Transport of Radioactive Material.
                DS N°1.439/2015 MTC — Reglamento de transporte de mercancías peligrosas por carretera.
                CCHEN ORD. sobre procedimientos de autorización para transporte de materiales radiactivos.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
