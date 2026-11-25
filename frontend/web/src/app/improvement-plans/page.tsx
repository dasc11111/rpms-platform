"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, Plus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Clock, X, Target,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Action {
  id: number; plan_id: number; action_code: string; description: string;
  responsible: string | null; due_date: string | null; completion_date: string | null;
  status: string; evidence: string | null; observations: string | null;
}
interface Plan {
  id: number; plan_code: string; title: string; description: string | null;
  plan_type: string; source: string | null; priority: string; responsible: string | null;
  sponsor: string | null; start_date: string | null; target_date: string | null;
  completion_date: string | null; progress: number; status: string;
  success_criteria: string | null; kpi_description: string | null;
  kpi_baseline: string | null; kpi_target: string | null; kpi_current: string | null;
  budget: number | null; budget_used: number | null; related_nc: string | null;
  observations: string | null; is_overdue: boolean;
  action_count: number; actions_done: number; actions: Action[];
}
interface Stats {
  total:number; planned:number; in_progress:number; completed:number;
  high_priority:number; overdue:number; avg_progress:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string,{label:string;color:string}> = {
  improvement: { label:"Mejora",      color:"bg-blue-100   text-blue-700"    },
  corrective:  { label:"Correctiva",  color:"bg-red-100    text-red-700"     },
  preventive:  { label:"Preventiva",  color:"bg-purple-100 text-purple-700"  },
  innovation:  { label:"Innovación",  color:"bg-cyan-100   text-cyan-700"    },
};
const STATUS_CFG: Record<string,{label:string;color:string}> = {
  planned:     { label:"Planificado",   color:"bg-blue-100   text-blue-700"    },
  in_progress: { label:"En progreso",   color:"bg-amber-100  text-amber-700"   },
  completed:   { label:"Completado",    color:"bg-emerald-100 text-emerald-700" },
  cancelled:   { label:"Cancelado",     color:"bg-gray-100   text-gray-400"    },
  on_hold:     { label:"En espera",     color:"bg-orange-100 text-orange-700"  },
};
const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  low:      { label:"Bajo",     color:"bg-gray-100   text-gray-500"     },
  medium:   { label:"Medio",    color:"bg-amber-100  text-amber-700"    },
  high:     { label:"Alto",     color:"bg-red-100    text-red-700"      },
  critical: { label:"Crítico",  color:"bg-red-200    text-red-900"      },
};
const ACTION_STATUS: Record<string,{label:string;color:string}> = {
  pending:     { label:"Pendiente",   color:"bg-gray-100   text-gray-500"    },
  in_progress: { label:"En progreso", color:"bg-blue-100   text-blue-700"    },
  completed:   { label:"Completado",  color:"bg-emerald-100 text-emerald-700" },
  cancelled:   { label:"Cancelado",   color:"bg-red-100    text-red-700"     },
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}

// ── PlanCard ────────────────────────────────────────────────────────────────
function PlanCard({ p, onStatusChange, onEdit, onCompleteAction }: {
  p:Plan; onStatusChange:(id:number,s:string)=>void;
  onEdit:(p:Plan)=>void; onCompleteAction:(id:number)=>void
}) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CFG[p.status] ?? STATUS_CFG.planned;
  const pc = PRIORITY_CFG[p.priority] ?? PRIORITY_CFG.medium;
  const tc = TYPE_CFG[p.plan_type] ?? TYPE_CFG.improvement;
  const pct = Number(p.progress);

  return (
    <div className={`rounded-lg border ${p.is_overdue?"border-orange-300":p.priority==="high"||p.priority==="critical"?"border-red-200":p.status==="in_progress"?"border-blue-200":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <Target className={`h-4 w-4 mt-0.5 shrink-0 ${p.status==="completed"?"text-emerald-500":p.status==="in_progress"?"text-blue-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{p.plan_code}</span>
              <span className="text-sm font-semibold">{p.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pc.color}`}>{pc.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tc.color}`}>{tc.label}</span>
              {p.is_overdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">⚠ Atrasado</span>}
            </div>
            {/* Progress bar */}
            {p.status==="in_progress" && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${pct>=80?"bg-emerald-500":pct>=40?"bg-blue-500":"bg-amber-500"}`} style={{width:`${pct}%`}}/>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{p.actions_done}/{p.action_count} acciones</span>
              </div>
            )}
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              {p.responsible && <span>👤 {p.responsible}</span>}
              {p.target_date && <span>🎯 {fmtDate(p.target_date)}</span>}
              {p.related_nc && <span>🔗 {p.related_nc}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
          {p.success_criteria && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
              <p className="text-xs font-semibold text-blue-700 mb-1">✓ Criterio de éxito:</p>
              <p className="text-xs text-blue-700">{p.success_criteria}</p>
            </div>
          )}
          {p.kpi_description && (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label:"KPI", value:p.kpi_description },
                { label:"Basal", value:p.kpi_baseline??"—" },
                { label:"Meta", value:p.kpi_target??"—" },
                { label:"Actual", value:p.kpi_current??"—" },
              ].map(k=>(
                <div key={k.label} className="rounded-md bg-muted/30 py-1.5 px-1">
                  <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  <p className="text-xs font-semibold truncate">{k.value}</p>
                </div>
              ))}
            </div>
          )}
          {p.actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5">Acciones ({p.actions_done}/{p.action_count} completadas):</p>
              <div className="flex flex-col gap-1.5">
                {(p.actions as Action[]).map(a=>{
                  const asc = ACTION_STATUS[a.status] ?? ACTION_STATUS.pending;
                  const isLate = a.due_date && new Date(a.due_date)<new Date() && !["completed","cancelled"].includes(a.status);
                  return (
                    <div key={a.id} className={`flex items-start gap-2 rounded px-2 py-1.5 ${isLate?"bg-orange-50 border border-orange-200":a.status==="completed"?"bg-emerald-50/50":"bg-muted/20"}`}>
                      {a.status==="completed" ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5"/> : <Clock className={`h-3 w-3 shrink-0 mt-0.5 ${isLate?"text-orange-500":"text-muted-foreground"}`}/>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[9px] text-muted-foreground">{a.action_code}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${asc.color}`}>{asc.label}</span>
                        </div>
                        <p className="text-xs">{a.description}</p>
                        <div className="flex gap-2 text-[9px] text-muted-foreground mt-0.5">
                          {a.responsible && <span>{a.responsible}</span>}
                          <span>Plazo: {fmtDate(a.due_date)}</span>
                          {a.evidence && <span className="text-emerald-600">✓ {a.evidence}</span>}
                        </div>
                      </div>
                      {!["completed","cancelled"].includes(a.status) && (
                        <button onClick={()=>onCompleteAction(a.id)} className="text-[9px] px-1 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0">✓</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {p.observations && <p className="text-xs text-muted-foreground italic">{p.observations}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            <button onClick={()=>onEdit(p)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
            {p.status==="planned" && <button onClick={()=>onStatusChange(p.id,"in_progress")} className="text-xs px-2 py-1 rounded border bg-blue-100 text-blue-700 hover:opacity-80">→ Iniciar</button>}
            {p.status==="in_progress" && <button onClick={()=>onStatusChange(p.id,"completed")} className="text-xs px-2 py-1 rounded border bg-emerald-100 text-emerald-700 hover:opacity-80">✓ Completar</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function PlanModal({ p, onClose, onSave }: { p:Partial<Plan>|null; onClose:()=>void; onSave:(d:Partial<Plan>)=>void }) {
  const [form, setForm] = useState<Partial<Plan>>({
    plan_type:"improvement", priority:"medium", status:"planned", progress:0, ...p,
  });
  const set = (k: keyof Plan, v: string|number) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{p?.id?"Editar plan":"Nuevo plan de mejora"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Título *
              <input value={form.title??""} onChange={e=>set("title",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Tipo
              <select value={form.plan_type??""} onChange={e=>set("plan_type",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Prioridad
              <select value={form.priority??""} onChange={e=>set("priority",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Responsable
              <input value={form.responsible??""} onChange={e=>set("responsible",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fuente / origen
              <input value={form.source??""} onChange={e=>set("source",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="Auditoría 2025, NC-..."/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha inicio
              <input type="date" value={form.start_date??""} onChange={e=>set("start_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha meta
              <input type="date" value={form.target_date??""} onChange={e=>set("target_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Descripción
              <textarea value={form.description??""} onChange={e=>set("description",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Criterio de éxito
              <input value={form.success_criteria??""} onChange={e=>set("success_criteria",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Avance (%)
              <input type="number" min={0} max={100} value={form.progress??0} onChange={e=>set("progress",Number(e.target.value))}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Estado
              <select value={form.status??""} onChange={e=>set("status",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
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
export default function ImprovementPlansPage() {
  const [data, setData] = useState<{ rows:Plan[]; stats:Stats }|null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Plan>|null|false>(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const load = useCallback(async (s=filterStatus, t=filterType, pr=filterPriority) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (s) p.set("status",s);
    if (t) p.set("type",t);
    if (pr) p.set("priority",pr);
    const res = await fetch(`/api/improvement-plans?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterStatus, filterType, filterPriority]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Plan>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/improvement-plans", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };
  const handleStatusChange = async (id:number, status:string) => {
    const extra: Record<string,string|number> = {};
    if (status==="in_progress") extra.progress = 10;
    if (status==="completed")   { extra.progress = 100; extra.completion_date = new Date().toISOString().split("T")[0]; }
    await fetch("/api/improvement-plans", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status,...extra}) });
    load();
  };
  const handleCompleteAction = async (id:number) => {
    await fetch("/api/improvement-plans", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id,_type:"action",status:"completed",completion_date:new Date().toISOString().split("T")[0]}) });
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
        <PlanModal p={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent"/>Planes de Mejora y Acción PR</h1>
          <p className="text-sm text-muted-foreground">IAEA GSG-13 / CCHEN NS-06.0 — Mejora continua del Programa de Protección Radiológica · Código MJ-YYYY-NNN</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Nuevo plan
        </button>
      </div>

      {/* Alertas */}
      {st && (Number(st.overdue)>0 || Number(st.high_priority)>0) && (
        <div className="flex flex-col gap-2">
          {Number(st.overdue)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
              <p className="text-sm text-orange-700"><strong>{st.overdue} plan(es)</strong> con fecha meta vencida sin completar</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:"Total planes",     value:st.total },
            { label:"Planificados",     value:st.planned,       color: st.planned>0?"text-blue-600":"" },
            { label:"En progreso",      value:st.in_progress,   color: st.in_progress>0?"text-amber-600":"" },
            { label:"Completados",      value:st.completed,     color:"text-emerald-600" },
            { label:"Alta prioridad",   value:st.high_priority, color: st.high_priority>0?"text-red-600":"" },
            { label:"Atrasados",        value:st.overdue,       color: st.overdue>0?"text-orange-600":"" },
            { label:"Avance promedio",  value:`${st.avg_progress??0}%`, color:"text-blue-600" },
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
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value,filterType,filterPriority);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);load(filterStatus,e.target.value,filterPriority);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e=>{setFilterPriority(e.target.value);load(filterStatus,filterType,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todas las prioridades</option>
          {Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin planes de mejora registrados</p>
          </div>
        ) : rows.map(p=><PlanCard key={p.id} p={p} onStatusChange={handleStatusChange} onEdit={p=>setModal(p)} onCompleteAction={handleCompleteAction}/>)}
      </div>

      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: IAEA GSG-13 (Mejora continua) · CCHEN NS-06.0 (Gestión de calidad) · ISO 9001 (mejora continua) · DS 3/1985 · Código MJ-YYYY-NNN
      </div>
    </div>
  );
}
