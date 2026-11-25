"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen, Plus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Clock, FileText, X, Shield,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Section {
  id: number; section_code: string; section_number: string; title: string;
  description: string | null; content: string | null; responsible: string | null;
  reviewer: string | null; version: string; status: string;
  approval_date: string | null; next_review_date: string | null;
  cchen_approved: boolean; cchen_ref: string | null;
  observations: string | null; document_path: string | null;
  is_overdue: boolean;
}
interface Stats {
  total:number; approved:number; under_review:number; draft:number;
  obsolete:number; cchen_approved:number; overdue_review:number; pending_cchen:number;
}

// ── helpers ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string,{label:string;color:string;icon:React.ComponentType<{className?:string}>}> = {
  approved:     { label:"Vigente",      color:"bg-emerald-100 text-emerald-700",  icon:CheckCircle2 },
  under_review: { label:"En revisión",  color:"bg-amber-100  text-amber-700",    icon:Clock },
  draft:        { label:"Borrador",     color:"bg-blue-100   text-blue-700",     icon:FileText },
  obsolete:     { label:"Obsoleto",     color:"bg-gray-100   text-gray-400",     icon:X },
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}

// ── SectionCard ────────────────────────────────────────────────────────────
function SectionCard({ s, onStatusChange, onEdit }: { s:Section; onStatusChange:(id:number,st:string)=>void; onEdit:(s:Section)=>void }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CFG[s.status] ?? STATUS_CFG.draft;
  const StatusIcon = sc.icon;

  return (
    <div className={`rounded-lg border ${s.is_overdue?"border-orange-300":s.status==="under_review"?"border-amber-300":s.cchen_approved?"border-emerald-200":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${s.status==="approved"?"text-emerald-500":s.status==="under_review"?"text-amber-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{s.section_code}</span>
              <span className="text-sm font-semibold">{s.section_number}. {s.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">v{s.version}</span>
              {s.cchen_approved && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">✓ CCHEN</span>}
              {s.is_overdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">⚠ Rev. vencida</span>}
              {!s.cchen_approved && s.status==="approved" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">Pendiente CCHEN</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              {s.responsible && <span>👤 {s.responsible}</span>}
              {s.approval_date && <span>Aprobado: {fmtDate(s.approval_date)}</span>}
              <span>Próx. revisión: {fmtDate(s.next_review_date)}</span>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
          {s.content && (
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold mb-1">Contenido:</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{s.content}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {s.reviewer && <div><span className="text-muted-foreground">Revisor: </span>{s.reviewer}</div>}
            {s.cchen_ref && <div><span className="text-muted-foreground">Ref. CCHEN: </span>{s.cchen_ref}</div>}
            {s.document_path && <div className="col-span-2"><span className="text-muted-foreground">Documento: </span><span className="font-mono text-[10px]">{s.document_path}</span></div>}
          </div>
          {s.observations && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <strong>Observaciones:</strong> {s.observations}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            <button onClick={()=>onEdit(s)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
            {s.status==="draft" && <button onClick={()=>onStatusChange(s.id,"under_review")} className="text-xs px-2 py-1 rounded border bg-amber-100 text-amber-700 hover:opacity-80">→ En revisión</button>}
            {s.status==="under_review" && <button onClick={()=>onStatusChange(s.id,"approved")} className="text-xs px-2 py-1 rounded border bg-emerald-100 text-emerald-700 hover:opacity-80">→ Aprobar</button>}
            {s.status==="approved" && <button onClick={()=>onStatusChange(s.id,"obsolete")} className="text-xs px-2 py-1 rounded border bg-gray-100 text-gray-500 hover:opacity-80">Marcar obsoleto</button>}
            {!s.cchen_approved && s.status==="approved" && <button onClick={()=>onStatusChange(s.id,"approved")} className="text-xs px-2 py-1 rounded border bg-blue-100 text-blue-700 hover:opacity-80">✓ Registrar aprobación CCHEN</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function SectionModal({ s, onClose, onSave }: { s:Partial<Section>|null; onClose:()=>void; onSave:(d:Partial<Section>)=>void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<Partial<Section>>({
    version:"1.0", status:"draft", cchen_approved:false, ...s,
  });
  const set = (k: keyof Section, v: string|boolean) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{s?.id?"Editar sección":"Nueva sección del Programa PR"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">N° sección
              <input value={form.section_number??""} onChange={e=>set("section_number",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="17"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Versión
              <input value={form.version??""} onChange={e=>set("version",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="1.0"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Título *
              <input value={form.title??""} onChange={e=>set("title",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Descripción
              <textarea value={form.description??""} onChange={e=>set("description",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Responsable
              <input value={form.responsible??""} onChange={e=>set("responsible",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Estado
              <select value={form.status??""} onChange={e=>set("status",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha aprobación
              <input type="date" value={form.approval_date??today} onChange={e=>set("approval_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Próxima revisión
              <input type="date" value={form.next_review_date??""} onChange={e=>set("next_review_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Ref. CCHEN
              <input value={form.cchen_ref??""} onChange={e=>set("cchen_ref",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="CCHEN-INS-2019-0847-P17"/>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.cchen_approved} onChange={e=>set("cchen_approved",e.target.checked)} className="h-4 w-4"/>
              Aprobado por CCHEN
            </label>
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
export default function RadiationProgramPage() {
  const [data, setData] = useState<{ rows:Section[]; stats:Stats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Section>|null|false>(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCchen, setFilterCchen] = useState("");

  const load = useCallback(async (s=filterStatus, c=filterCchen) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (s) p.set("status",s);
    if (c) p.set("cchen",c);
    const res = await fetch(`/api/radiation-program?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterStatus, filterCchen]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Section>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/radiation-program", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };
  const handleStatusChange = async (id:number, status:string) => {
    const extra: Record<string,string|boolean> = {};
    if (status==="approved") { extra.approval_date = new Date().toISOString().split("T")[0]; extra.cchen_approved = true; }
    await fetch("/api/radiation-program", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status,...extra}) });
    load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const rows = data?.rows ?? [];
  const pct = st && Number(st.total)>0 ? Math.round(Number(st.approved)/Number(st.total)*100) : 0;

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <SectionModal c={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-accent"/>Programa de Protección Radiológica</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Documento maestro del programa y estado de secciones · Licencia CCHEN-INS-2019-0847</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Nueva sección
        </button>
      </div>

      {/* Alertas */}
      {st && (Number(st.overdue_review)>0 || Number(st.pending_cchen)>0) && (
        <div className="flex flex-col gap-2">
          {Number(st.overdue_review)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
              <p className="text-sm text-orange-700"><strong>{st.overdue_review} sección(es)</strong> con revisión periódica vencida — actualizar antes de próxima inspección CCHEN</p>
            </div>
          )}
          {Number(st.pending_cchen)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5">
              <Shield className="h-4 w-4 text-purple-600 shrink-0"/>
              <p className="text-sm text-purple-700"><strong>{st.pending_cchen} sección(es) aprobada(s)</strong> pendientes de registro de aprobación CCHEN</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1 rounded-lg border border-border bg-surface p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-emerald-600">{pct}%</div>
            <div className="text-xs text-muted-foreground">Vigente / Total</div>
            <div className="mt-1 w-full bg-muted rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{width:`${pct}%`}}/>
            </div>
          </div>
          {[
            { label:"Total secciones", value:st.total },
            { label:"Vigentes",        value:st.approved,     color:"text-emerald-600" },
            { label:"En revisión",     value:st.under_review, color: st.under_review>0?"text-amber-600":"" },
            { label:"Borradores",      value:st.draft,        color: st.draft>0?"text-blue-600":"" },
            { label:"Aprobadas CCHEN", value:st.cchen_approved, color:"text-blue-600" },
            { label:"Rev. vencidas",   value:st.overdue_review, color: st.overdue_review>0?"text-orange-600":"" },
            { label:"Pend. CCHEN",     value:st.pending_cchen, color: st.pending_cchen>0?"text-purple-600":"" },
          ].map(k=>(
            <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
              <p className={`text-2xl font-bold ${k.color??""}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value,filterCchen);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterCchen} onChange={e=>{setFilterCchen(e.target.value);load(filterStatus,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Aprobación CCHEN: todos</option>
          <option value="true">Aprobadas CCHEN</option>
          <option value="false">Sin aprobación CCHEN</option>
        </select>
      </div>

      {/* Barra de progreso del programa */}
      {st && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">Estado global del Programa PR</span>
            <span className="text-xs text-muted-foreground">{st.approved}/{st.total} secciones vigentes</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-500 transition-all" style={{width:`${Number(st.total)?Number(st.approved)/Number(st.total)*100:0}%`}}/>
            <div className="bg-amber-400 transition-all" style={{width:`${Number(st.total)?Number(st.under_review)/Number(st.total)*100:0}%`}}/>
            <div className="bg-blue-400 transition-all"  style={{width:`${Number(st.total)?Number(st.draft)/Number(st.total)*100:0}%`}}/>
          </div>
          <div className="flex gap-4 mt-1.5 text-[10px] text-muted-foreground">
            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"/>Vigente</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"/>En revisión</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"/>Borrador</span>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin secciones registradas</p>
          </div>
        ) : rows.map(s=><SectionCard key={s.id} s={s} onStatusChange={handleStatusChange} onEdit={s=>setModal(s)}/>)}
      </div>

      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: CCHEN NS-06.0 (Programa de Protección Radiológica) · DS 3/1985 · IAEA GSG-13 (Content of the Safety Analysis Report for Nuclear Installations) · Revisión bianual requerida
      </div>
    </div>
  );
}
