"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GitBranch, Plus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Clock, XCircle, AlertCircle, X,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Change {
  id: number; change_code: string; title: string; description: string | null;
  change_type: string; scope: string | null; requester: string | null;
  responsible: string | null; reviewer: string | null;
  request_date: string; evaluation_date: string | null;
  approval_date: string | null; implementation_date: string | null;
  closure_date: string | null; radiation_assessment: string | null;
  risk_level: string; requires_cchen_notification: boolean;
  cchen_notification_date: string | null; cchen_ref: string | null;
  status: string; rejection_reason: string | null;
  corrective_actions: string | null; notes: string | null;
  is_delayed: boolean;
}
interface Stats {
  total:number; pending_review:number; under_review:number; approved:number;
  implementing:number; closed:number; rejected:number;
  pending_cchen_notif:number; high_risk:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = {
  equipment:"Equipos", facility:"Instalaciones", procedure:"Procedimientos",
  personnel:"Personal", sources:"Fuentes", waste:"Residuos", emergency:"Emergencia", other:"Otro",
};
const RISK_CFG: Record<string,{label:string;color:string}> = {
  low:    { label:"Bajo",   color:"bg-emerald-100 text-emerald-700" },
  medium: { label:"Medio",  color:"bg-amber-100  text-amber-700"   },
  high:   { label:"Alto",   color:"bg-red-100    text-red-700"     },
  critical:{ label:"Crítico",color:"bg-red-200   text-red-900"     },
};
const STATUS_CFG: Record<string,{label:string;color:string;icon:React.ComponentType<{className?:string}>}> = {
  submitted:    { label:"Enviado",      color:"bg-blue-100   text-blue-700",   icon:Clock },
  under_review: { label:"En revisión",  color:"bg-amber-100  text-amber-700",  icon:AlertCircle },
  approved:     { label:"Aprobado",     color:"bg-emerald-100 text-emerald-700",icon:CheckCircle2 },
  implementing: { label:"Implementando",color:"bg-blue-100   text-blue-700",   icon:Clock },
  closed:       { label:"Cerrado",      color:"bg-gray-100   text-gray-500",   icon:CheckCircle2 },
  rejected:     { label:"Rechazado",    color:"bg-red-100    text-red-700",    icon:XCircle },
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}
const NEXT_STATUS: Record<string,string[]> = {
  submitted:    ["under_review","rejected"],
  under_review: ["approved","rejected"],
  approved:     ["implementing"],
  implementing: ["closed"],
};

// ── ChangeCard ──────────────────────────────────────────────────────────────
function ChangeCard({ c, onStatusChange, onEdit }: { c:Change; onStatusChange:(id:number,s:string)=>void; onEdit:(c:Change)=>void }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CFG[c.status] ?? STATUS_CFG.submitted;
  const StatusIcon = sc.icon;
  const rc = RISK_CFG[c.risk_level] ?? RISK_CFG.low;
  const needsCchenNotif = c.requires_cchen_notification && !c.cchen_notification_date && !["closed","rejected"].includes(c.status);

  return (
    <div className={`rounded-lg border ${c.is_delayed?"border-orange-300":c.risk_level==="high"?"border-red-300":c.status==="under_review"?"border-amber-300":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${c.status==="approved"?"text-emerald-500":c.status==="rejected"?"text-red-500":c.status==="under_review"?"text-amber-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{c.change_code}</span>
              <span className="text-sm font-semibold">{c.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${rc.color}`}>{rc.label} riesgo</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{TYPE_LABEL[c.change_type]??c.change_type}</span>
              {needsCchenNotif && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">⚠ Notif. CCHEN pendiente</span>}
              {c.is_delayed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">Atrasado</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              {c.requester && <span>👤 {c.requester}</span>}
              <span>📅 Solicitud: {fmtDate(c.request_date)}</span>
              {c.approval_date && <span>✓ Aprobado: {fmtDate(c.approval_date)}</span>}
              {c.implementation_date && <span>🔧 Impl.: {fmtDate(c.implementation_date)}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
          {c.radiation_assessment && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
              <p className="text-xs font-semibold text-blue-700 mb-1">☢ Evaluación radiológica:</p>
              <p className="text-xs text-blue-700">{c.radiation_assessment}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {c.responsible && <div><span className="text-muted-foreground">Responsable: </span>{c.responsible}</div>}
            {c.reviewer && <div><span className="text-muted-foreground">Revisor: </span>{c.reviewer}</div>}
            {c.scope && <div><span className="text-muted-foreground">Alcance: </span>{c.scope}</div>}
            {c.cchen_ref && <div><span className="text-muted-foreground">Ref. CCHEN: </span>{c.cchen_ref}</div>}
          </div>
          {c.rejection_reason && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <strong>Motivo rechazo:</strong> {c.rejection_reason}
            </div>
          )}
          {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            <button onClick={()=>onEdit(c)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
            {NEXT_STATUS[c.status]?.map(ns=>(
              <button key={ns} onClick={()=>onStatusChange(c.id,ns)}
                className={`text-xs px-2 py-1 rounded border ${STATUS_CFG[ns]?.color??""} hover:opacity-80`}>
                → {STATUS_CFG[ns]?.label??ns}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function ChangeModal({ c, onClose, onSave }: { c:Partial<Change>|null; onClose:()=>void; onSave:(d:Partial<Change>)=>void }) {
  const [form, setForm] = useState<Partial<Change>>({
    change_type:"equipment", scope:"local", risk_level:"low",
    request_date: new Date().toISOString().split("T")[0],
    requires_cchen_notification:false, status:"submitted", ...c,
  });
  const set = (k: keyof Change, v: string|boolean) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{c?.id?"Editar cambio":"Registrar cambio al programa PR"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Título *
              <input value={form.title??""} onChange={e=>set("title",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Tipo de cambio
              <select value={form.change_type??""} onChange={e=>set("change_type",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Nivel de riesgo
              <select value={form.risk_level??""} onChange={e=>set("risk_level",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(RISK_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Solicitante
              <input value={form.requester??""} onChange={e=>set("requester",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Responsable PR
              <input value={form.responsible??""} onChange={e=>set("responsible",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha solicitud *
              <input type="date" value={form.request_date??""} onChange={e=>set("request_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha implementación planificada
              <input type="date" value={form.implementation_date??""} onChange={e=>set("implementation_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Descripción del cambio
              <textarea value={form.description??""} onChange={e=>set("description",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={3}/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Evaluación radiológica previa
              <textarea value={form.radiation_assessment??""} onChange={e=>set("radiation_assessment",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={3}
                placeholder="Impacto dosimétrico estimado, medidas de control requeridas..."/>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.requires_cchen_notification}
                onChange={e=>set("requires_cchen_notification",e.target.checked)}
                className="h-4 w-4"/>
              Requiere notificación a CCHEN (NS-06.0 / DS 3/1985)
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
export default function ChangesPage() {
  const [data, setData] = useState<{ rows:Change[]; stats:Stats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Change>|null|false>(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterRisk, setFilterRisk] = useState("");

  const load = useCallback(async (s=filterStatus, t=filterType, r=filterRisk) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (s) p.set("status",s);
    if (t) p.set("type",t);
    if (r) p.set("risk",r);
    const res = await fetch(`/api/changes?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterStatus, filterType, filterRisk]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Change>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/changes", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };
  const handleStatusChange = async (id:number, status:string) => {
    const extra: Record<string,string> = {};
    if (status==="approved") extra.approval_date = new Date().toISOString().split("T")[0];
    if (status==="closed")   extra.closure_date  = new Date().toISOString().split("T")[0];
    await fetch("/api/changes", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status,...extra}) });
    load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <ChangeModal c={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><GitBranch className="h-5 w-5 text-accent"/>Gestión de Cambios al Programa PR</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Evaluación radiológica previa a modificaciones en instalaciones y procesos</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Registrar cambio
        </button>
      </div>

      {/* Alertas */}
      {st && (Number(st.pending_cchen_notif)>0 || Number(st.high_risk)>0) && (
        <div className="flex flex-col gap-2">
          {Number(st.pending_cchen_notif)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
              <p className="text-sm text-orange-700"><strong>{st.pending_cchen_notif} cambio(s)</strong> requieren notificación a CCHEN pendiente</p>
            </div>
          )}
          {Number(st.high_risk)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0"/>
              <p className="text-sm text-red-700"><strong>{st.high_risk} cambio(s) de alto riesgo</strong> requieren evaluación radiológica detallada</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:"Total cambios", value:st.total },
            { label:"En revisión", value:st.under_review, color: st.under_review>0?"text-amber-600":"" },
            { label:"Enviados",     value:st.pending_review, color: st.pending_review>0?"text-blue-600":"" },
            { label:"Aprobados",    value:st.approved,  color:"text-emerald-600" },
            { label:"Implementando",value:st.implementing },
            { label:"Cerrados",     value:st.closed,    color:"text-gray-500" },
            { label:"Rechazados",   value:st.rejected,  color: st.rejected>0?"text-red-600":"" },
            { label:"Notif. CCHEN pendientes", value:st.pending_cchen_notif, color: st.pending_cchen_notif>0?"text-orange-600":"" },
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
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value,filterType,filterRisk);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);load(filterStatus,e.target.value,filterRisk);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterRisk} onChange={e=>{setFilterRisk(e.target.value);load(filterStatus,filterType,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los riesgos</option>
          {Object.entries(RISK_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin cambios registrados</p>
          </div>
        ) : rows.map(c=><ChangeCard key={c.id} c={c} onStatusChange={handleStatusChange} onEdit={c=>setModal(c)}/>)}
      </div>

      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: CCHEN NS-06.0 (Gestión de cambios) · DS 3/1985 (Notificación CCHEN) · IAEA GS-R-3 (Management System for Facilities and Activities) · Código MC-YYYY-NNN
      </div>
    </div>
  );
}
