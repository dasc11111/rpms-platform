"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, Shield, ChevronDown, ChevronUp } from "lucide-react";

interface Auth { id: number; linac_id: number; doc_type: string; document_number: string | null; issue_date: string | null; expiry_date: string | null; file_name: string | null; blob_url: string | null; version: number; is_current: boolean; uploaded_by: string | null; uploaded_at: string; vigencyLevel?: string; }

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
const DOC_TYPES = ["licencia_operacion", "certificado_cchen", "habilitacion_personal", "autorizacion_fuentes", "certificado_blindaje", "permiso_transporte", "otro"];

function fmtDate(d: string | null) { if (!d) return "—"; return new Date(d).toLocaleDateString("es-CL"); }
function daysUntil(d: string | null) { if (!d) return null; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

function VigencyBadge({ expiry }: { expiry: string | null }) {
  const days = daysUntil(expiry);
  if (days === null) return <span className="text-xs text-gray-400">Sin vencimiento</span>;
  if (days < 0) return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Vencido</span>;
  if (days <= 30) return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Crítico ({days}d)</span>;
  if (days <= 90) return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Próximo ({days}d)</span>;
  return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Vigente ({days}d)</span>;
}

export default function LinacAuthorizationsPage() {
  const [auths, setAuths] = useState<Auth[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ docType: "licencia_operacion", documentNumber: "", issueDate: "", expiryDate: "" });

  const load = () => {
    setLoading(true);
    fetch(`/api/linac/authorizations?linacId=${linacId}`)
      .then(r => r.json())
      .then(d => setAuths(d.authorizations ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [linacId]);

  const upload = async () => {
    setUploading(true); setMsg("");
    const fd = new FormData();
    fd.append("linacId", linacId);
    fd.append("docType", form.docType);
    if (form.documentNumber) fd.append("documentNumber", form.documentNumber);
    if (form.issueDate) fd.append("issueDate", form.issueDate);
    if (form.expiryDate) fd.append("expiryDate", form.expiryDate);
    fd.append("uploadedBy", "usuario");
    if (fileRef.current?.files?.[0]) fd.append("file", fileRef.current.files[0]);
    const r = await fetch("/api/linac/authorizations", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (d.ok) { setMsg("Autorización registrada."); setShowForm(false); load(); }
    else setMsg(d.error ?? "Error");
  };

  const expired = auths.filter(a => { const d = daysUntil(a.expiry_date); return d !== null && d < 0; }).length;
  const critical = auths.filter(a => { const d = daysUntil(a.expiry_date); return d !== null && d >= 0 && d <= 30; }).length;
  const groups = auths.reduce<Record<string, Auth[]>>((acc, a) => { (acc[a.doc_type] ??= []).push(a); return acc; }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100"><Shield className="h-6 w-6 text-indigo-700" /></div>
            <div><h1 className="text-2xl font-bold text-gray-900">Autorizaciones LINAC</h1><p className="text-sm text-gray-500">Licencias CCHEN y habilitaciones del equipo</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
            <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2 rounded-lg"><Upload className="h-4 w-4" /> Registrar</button>
          </div>
        </div>

        {(expired > 0 || critical > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">
            {expired > 0 && <span className="font-semibold">{expired} vencida{expired > 1 ? "s" : ""}. </span>}
            {critical > 0 && <span>{critical} venc{critical > 1 ? "en" : "e"} en ≤30 días.</span>}
          </div>
        )}

        {msg && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>}

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">Nueva autorización</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">ID LINAC</label><input className={inp} type="number" min="1" value={linacId} onChange={e => setLinacId(e.target.value)} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                <select className={inp} value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">N° documento</label><input className={inp} value={form.documentNumber} onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))} placeholder="ORD-123/2024" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Fecha emisión</label><input className={inp} type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Fecha vencimiento</label><input className={inp} type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Archivo (opcional)</label><input ref={fileRef} type="file" className="text-sm text-gray-600" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={upload} disabled={uploading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">{uploading ? "Guardando…" : "Guardar"}</button>
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: auths.length },
            { label: "Tipos", value: Object.keys(groups).length },
            { label: "Vencidas", value: expired, color: expired > 0 ? "text-red-600" : "text-gray-700" },
            { label: "Críticas", value: critical, color: critical > 0 ? "text-orange-600" : "text-gray-700" },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${t.color ?? "text-gray-700"}`}>{t.value}</div>
              <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Groups */}
        {Object.entries(groups).map(([docType, items]) => (
          <div key={docType} className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 capitalize">{docType.replace(/_/g, " ")} <span className="text-xs text-gray-400 ml-1">({items.length})</span></div>
            <div className="divide-y divide-gray-50">
              {items.map(auth => (
                <div key={auth.id}>
                  <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50" onClick={() => setExpanded(expanded === auth.id ? null : auth.id)}>
                    <div className="flex items-center gap-3 text-left">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{auth.document_number ?? `ID ${auth.id}`}</div>
                        <div className="text-xs text-gray-400">v{auth.version} · {fmtDate(auth.uploaded_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <VigencyBadge expiry={auth.expiry_date} />
                      {expanded === auth.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>
                  {expanded === auth.id && (
                    <div className="px-5 pb-4 pt-1 bg-gray-50 text-sm grid grid-cols-2 gap-2">
                      <div className="text-gray-500">Emisión: <span className="text-gray-700">{fmtDate(auth.issue_date)}</span></div>
                      <div className="text-gray-500">Vencimiento: <span className="text-gray-700">{fmtDate(auth.expiry_date)}</span></div>
                      <div className="text-gray-500">Subido por: <span className="text-gray-700">{auth.uploaded_by ?? "—"}</span></div>
                      {auth.blob_url && <div><a href={auth.blob_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs">Descargar ↗</a></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {auths.length === 0 && !loading && <div className="text-center py-12 text-gray-400">No hay autorizaciones registradas</div>}

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>Ley N°18.302 — Seguridad Nuclear. DS N°133/1984 y DS N°95/2005 MINSAL — Reglamento de instalaciones radiactivas y autorización de operación. CCHEN ORD sobre licencias de operación y habilitación de personal para aceleradores lineales.</p>
        </div>
      </div>
    </div>
  );
}
