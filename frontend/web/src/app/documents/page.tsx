"use client";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, X,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface PRDocument {
  id: number; doc_code: string; title: string; doc_type: string; category: string | null;
  description: string | null; responsible: string | null; reviewer: string | null;
  approver: string | null; version: string; status: string;
  effective_date: string | null; next_review_date: string | null; last_review_date: string | null;
  cchen_required: boolean; cchen_approved: boolean; cchen_ref: string | null;
  scope: string | null; references_docs: string | null; observations: string | null;
  is_overdue: boolean; cchen_pending: boolean;
}
interface Stats {
  total:number; approved:number; draft:number; under_review:number; obsolete:number;
  overdue_review:number; cchen_required:number; cchen_approved:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = {
  procedure:"Procedimiento", instructive:"Instructivo", protocol:"Protocolo",
  form:"Formulario", manual:"Manual", record:"Registro", other:"Otro",
};
const TYPE_COLOR: Record<string,string> = {
  procedure:"bg-blue-100 text-blue-700", instructive:"bg-indigo-100 text-indigo-700",
  protocol:"bg-purple-100 text-purple-700", form:"bg-teal-100 text-teal-700",
  manual:"bg-amber-100 text-amber-700", record:"bg-gray-100 text-gray-700",
};
const STATUS_LABEL: Record<string,string> = {
  draft:"Borrador", under_review:"En revisión", approved:"Vigente",
  obsolete:"Obsoleto", superseded:"Reemplazado",
};
const STATUS_COLOR: Record<string,string> = {
  draft:"bg-gray-100 text-gray-600", under_review:"bg-amber-100 text-amber-700",
  approved:"bg-emerald-100 text-emerald-700", obsolete:"bg-red-100 text-red-600",
  superseded:"bg-orange-100 text-orange-700",
};
const CAT_LABEL: Record<string,string> = {
  dosimetria:"Dosimetría", zonas:"Zonas clasificadas", residuos:"Residuos",
  emergencias:"Emergencias", medicina_nuclear:"Medicina Nuclear", instrumentos:"Instrumentos",
  contaminacion:"Contaminación", calidad:"Control de calidad", alara:"ALARA",
  comite:"Comité PR", programa:"Programa PR", incidentes:"Incidentes", transporte:"Transporte",
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}

// ── DocumentCard ───────────────────────────────────────────────────────────
function DocumentCard({ doc, onEdit }: { doc: PRDocument; onEdit:(d:PRDocument)=>void }) {
  const [open, setOpen] = useState(false);
  const tc = TYPE_COLOR[doc.doc_type] ?? TYPE_COLOR.other;
  const sc = STATUS_COLOR[doc.status] ?? STATUS_COLOR.draft;
  const hasIssue = doc.is_overdue || doc.cchen_pending;

  return (
    <div className={`rounded-lg border ${hasIssue?"border-orange-300":doc.status==="approved"?"border-emerald-200":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${doc.status==="approved"?"text-emerald-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{doc.doc_code}</span>
              <span className="text-sm font-semibold">{doc.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tc}`}>{TYPE_LABEL[doc.doc_type]??doc.doc_type}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc}`}>{STATUS_LABEL[doc.status]??doc.status}</span>
              {doc.is_overdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">⚠ Revisión vencida</span>}
              {doc.cchen_pending && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">CCHEN pendiente</span>}
              {doc.cchen_approved && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">✓ CCHEN</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground flex-wrap">
              <span>v{doc.version}</span>
              {doc.category && <span>📁 {CAT_LABEL[doc.category]??doc.category}</span>}
              {doc.responsible && <span>👤 {doc.responsible}</span>}
              {doc.effective_date && <span>Vigente: {fmtDate(doc.effective_date)}</span>}
              {doc.next_review_date && <span className={doc.is_overdue?"text-orange-600 font-semibold":""}>Revisión: {fmtDate(doc.next_review_date)}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {doc.description && (
            <div>
              <p className="text-xs font-semibold mb-1">Descripción:</p>
              <p className="text-xs text-muted-foreground">{doc.description}</p>
            </div>
          )}
          {doc.scope && (
            <div>
              <p className="text-xs font-semibold mb-1">Alcance:</p>
              <p className="text-xs text-muted-foreground">{doc.scope}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {doc.reviewer && <div><span className="text-muted-foreground">Revisor: </span>{doc.reviewer}</div>}
            {doc.approver && <div><span className="text-muted-foreground">Aprobador: </span>{doc.approver}</div>}
            {doc.cchen_ref && <div><span className="text-muted-foreground">Ref. CCHEN: </span>{doc.cchen_ref}</div>}
            {doc.last_review_date && <div><span className="text-muted-foreground">Última revisión: </span>{fmtDate(doc.last_review_date)}</div>}
          </div>
          {doc.references_docs && (
            <div>
              <p className="text-xs font-semibold mb-1">Documentos relacionados:</p>
              <p className="text-xs text-muted-foreground">{doc.references_docs}</p>
            </div>
          )}
          {doc.observations && <p className="text-xs text-muted-foreground italic">{doc.observations}</p>}
          <div className="flex gap-2 pt-1 border-t border-border/40">
            <button onClick={()=>onEdit(doc)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function DocumentModal({ doc, onClose, onSave }: { doc:Partial<PRDocument>|null; onClose:()=>void; onSave:(d:Partial<PRDocument>)=>void }) {
  const [form, setForm] = useState<Partial<PRDocument>>({
    doc_type:"procedure", status:"draft", version:"1.0", cchen_required:false, cchen_approved:false, ...doc,
  });
  const set = (k: keyof PRDocument, val: string|boolean) => setForm(f=>({...f,[k]:val}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{doc?.id?"Editar documento":"Registrar documento"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Título *
              <input value={form.title??""} onChange={e=>set("title",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Tipo
              <select value={form.doc_type??""} onChange={e=>set("doc_type",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Estado
              <select value={form.status??""} onChange={e=>set("status",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Versión
              <input value={form.version??""} onChange={e=>set("version",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="1.0"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Categoría
              <select value={form.category??""} onChange={e=>set("category",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                <option value="">— Seleccionar —</option>
                {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Responsable
              <input value={form.responsible??""} onChange={e=>set("responsible",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Revisor
              <input value={form.reviewer??""} onChange={e=>set("reviewer",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha vigencia
              <input type="date" value={form.effective_date??""} onChange={e=>set("effective_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Próxima revisión
              <input type="date" value={form.next_review_date??""} onChange={e=>set("next_review_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Descripción
              <textarea value={form.description??""} onChange={e=>set("description",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.cchen_required} onChange={e=>set("cchen_required",e.target.checked)} className="h-4 w-4"/>
              Requiere aprobación CCHEN
            </label>
            {form.cchen_required && (<>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!form.cchen_approved} onChange={e=>set("cchen_approved",e.target.checked)} className="h-4 w-4"/>
                Aprobado por CCHEN
              </label>
              <label className="flex flex-col gap-1 text-xs">Ref. resolución CCHEN
                <input value={form.cchen_ref??""} onChange={e=>set("cchen_ref",e.target.value)}
                  className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
              </label>
            </>)}
            <label className="col-span-2 flex flex-col gap-1 text-xs">Observaciones
              <textarea value={form.observations??""} onChange={e=>set("observations",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted/40">Cancelar</button>
          <button onClick={()=>onSave(form)} className="text-sm px-3 py-1.5 rounded bg-accent text-accent-foreground hover:opacity-90">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [data, setData] = useState<{ rows:PRDocument[]; stats:Stats }|null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<PRDocument>|null|false>(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCchen, setFilterCchen] = useState("");

  const load = useCallback(async (t=filterType, s=filterStatus, c=filterCchen) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (t) p.set("type",t);
    if (s) p.set("status",s);
    if (c) p.set("cchen",c);
    const res = await fetch(`/api/documents?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterType, filterStatus, filterCchen]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<PRDocument>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/documents", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const rows = data?.rows ?? [];
  const pctApproved = st && st.total ? Math.round(st.approved/st.total*100) : 0;

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <DocumentModal doc={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-accent"/>Control de Documentos y Procedimientos PR</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Sistema de gestión documental del Programa de Protección Radiológica · Códigos PR-PO/IN/PT/FO/MN/RG</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Agregar documento
        </button>
      </div>

      {/* Alertas */}
      {st && (Number(st.overdue_review)>0 || (Number(st.cchen_required) > Number(st.cchen_approved))) && (
        <div className="flex flex-col gap-2">
          {Number(st.overdue_review)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
              <p className="text-sm text-orange-700"><strong>{st.overdue_review} documento(s)</strong> con fecha de revisión periódica vencida</p>
            </div>
          )}
          {Number(st.cchen_required) > Number(st.cchen_approved) && (
            <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-purple-600 shrink-0"/>
              <p className="text-sm text-purple-700"><strong>{Number(st.cchen_required) - Number(st.cchen_approved)} documento(s)</strong> requieren aprobación CCHEN y no la tienen</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:"Total documentos",     value:st.total },
            { label:"Vigentes (aprobados)", value:st.approved,      color:"text-emerald-600" },
            { label:"En revisión",          value:st.under_review,  color:"text-amber-600" },
            { label:"Borradores",           value:st.draft,         color:"text-gray-500" },
            { label:"Revisión vencida",     value:st.overdue_review,color: st.overdue_review>0?"text-orange-600":"" },
            { label:"Obsoletos",            value:st.obsolete,      color:"text-red-500" },
            { label:"Req. CCHEN",           value:st.cchen_required,color:"text-blue-600" },
            { label:"Aprobados CCHEN",      value:st.cchen_approved, color:"text-blue-700" },
          ].map(k=>(
            <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
              <p className={`text-2xl font-bold ${k.color??""}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Barra de progreso */}
      {st && st.total > 0 && (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Documentación aprobada</span>
            <span className={`font-bold ${pctApproved>=80?"text-emerald-600":pctApproved>=60?"text-amber-600":"text-red-600"}`}>{pctApproved}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all" style={{width:`${(st.approved/st.total*100).toFixed(1)}%`}}/>
            <div className="bg-amber-400 h-full transition-all" style={{width:`${(st.under_review/st.total*100).toFixed(1)}%`}}/>
            <div className="bg-gray-300 h-full transition-all" style={{width:`${(st.draft/st.total*100).toFixed(1)}%`}}/>
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"/>Vigentes</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"/>En revisión</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1"/>Borradores</span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);load(e.target.value,filterStatus,filterCchen);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(filterType,e.target.value,filterCchen);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterCchen} onChange={e=>{setFilterCchen(e.target.value);load(filterType,filterStatus,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">CCHEN: todos</option>
          <option value="true">Solo req. CCHEN</option>
          <option value="false">Sin req. CCHEN</option>
        </select>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin documentos registrados</p>
          </div>
        ) : rows.map(doc=><DocumentCard key={doc.id} doc={doc} onEdit={d=>setModal(d)}/>)}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500"/>
        <p className="text-[10px] text-muted-foreground">
          Normativa: CCHEN NS-06.0 §4.3 (Sistema documental) · Revisión periódica mínimo cada 2 años · Aprobación CCHEN para documentos de gestión de dosis
        </p>
      </div>
    </div>
  );
}
