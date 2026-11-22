"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, FileText, Search, X, ChevronDown, ChevronUp } from "lucide-react";

interface Doc { id: number; linac_id: number; category: string; title: string; file_name: string; blob_url: string; mime_type: string | null; size_bytes: number | null; version: number; is_current: boolean; uploaded_by: string | null; uploaded_at: string; }

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
const CATS = ["protocolo", "procedimiento", "manual", "formulario", "informe", "certificado", "normativa", "general"];

function fmtDate(d: string) { return new Date(d).toLocaleDateString("es-CL"); }
function fmtSize(b: number | null) { if (!b) return "—"; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`; return `${(b / 1048576).toFixed(1)} MB`; }

export default function LinacDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [linacId, setLinacId] = useState("1");
  const [catFilter, setCatFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", category: "general" });
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ linacId, q: q.trim() });
    fetch(`/api/linac/documents?${params}`)
      .then(r => r.json())
      .then(d => setDocs(d.documents ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [linacId]);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !form.title.trim()) { setMsg("Completa título y selecciona archivo."); return; }
    setUploading(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("linacId", linacId);
    fd.append("title", form.title.trim());
    fd.append("category", form.category);
    fd.append("uploadedBy", "usuario");
    const r = await fetch("/api/linac/documents", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (d.ok) { setMsg("Documento subido."); setShowForm(false); setForm({ title: "", category: "general" }); if (fileRef.current) fileRef.current.value = ""; load(); }
    else setMsg(d.error ?? "Error");
  };

  const catDocs = docs.filter(d => !catFilter || d.category === catFilter);
  const groups = catDocs.reduce<Record<string, Doc[]>>((acc, d) => { (acc[d.category] ??= []).push(d); return acc; }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100"><FileText className="h-6 w-6 text-indigo-700" /></div>
            <div><h1 className="text-2xl font-bold text-gray-900">Documentos LINAC</h1><p className="text-sm text-gray-500">Protocolos, procedimientos y certificados</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
            <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2 rounded-lg"><Upload className="h-4 w-4" /> Subir</button>
          </div>
        </div>

        {msg && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>}

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">Subir documento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">ID LINAC</label><input className={inp} type="number" min="1" value={linacId} onChange={e => setLinacId(e.target.value)} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className="text-xs text-gray-500 mb-1 block">Título *</label><input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nombre del documento" /></div>
              <div className="sm:col-span-2"><label className="text-xs text-gray-500 mb-1 block">Archivo *</label><input ref={fileRef} type="file" className="text-sm text-gray-600" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={upload} disabled={uploading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">{uploading ? "Subiendo…" : "Subir"}</button>
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
          </div>
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas categorías</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-24" type="number" min="1" placeholder="LINAC ID" value={linacId} onChange={e => { setLinacId(e.target.value); }} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total docs", value: docs.length },
            { label: "Categorías", value: Object.keys(groups).length },
            { label: "Protocolos", value: docs.filter(d => d.category === "protocolo").length },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-gray-700">{t.value}</div>
              <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Groups */}
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 capitalize">{cat} <span className="text-xs text-gray-400 ml-1">({items.length})</span></div>
            <div className="divide-y divide-gray-50">
              {items.map(doc => (
                <div key={doc.id}>
                  <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 text-left" onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{doc.title}</div>
                        <div className="text-xs text-gray-400">{doc.file_name} · v{doc.version} · {fmtDate(doc.uploaded_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{fmtSize(doc.size_bytes)}</span>
                      {expanded === doc.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>
                  {expanded === doc.id && (
                    <div className="px-5 pb-4 pt-1 bg-gray-50 text-sm space-y-1">
                      <div className="text-gray-600">Subido por: <span className="font-medium">{doc.uploaded_by ?? "—"}</span></div>
                      <div className="text-gray-600">Tipo MIME: <span className="font-mono text-xs">{doc.mime_type ?? "—"}</span></div>
                      <a href={doc.blob_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-indigo-600 hover:underline text-xs">Descargar archivo ↗</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {catDocs.length === 0 && !loading && <div className="text-center py-12 text-gray-400">No hay documentos para los filtros seleccionados</div>}

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>IAEA Safety Standards Series No. SSG-30 — Control documental en instalaciones de radioterapia. DS N°12/2010 MINSAL — Requisitos de documentación técnica. CCHEN ORD sobre archivo técnico de aceleradores lineales.</p>
        </div>
      </div>
    </div>
  );
}
