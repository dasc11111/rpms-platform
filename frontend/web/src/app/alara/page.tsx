"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown, ChevronUp, Plus, TrendingDown, Target, ClipboardCheck,
  AlertCircle, CheckCircle2, Clock, XCircle, BarChart3, Wrench, BookOpen,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Objective {
  id: number; year: number; title: string; description: string | null;
  category: string; target_metric: string | null;
  baseline_value: number | null; target_value: number | null;
  current_value: number | null; unit: string | null;
  status: string; priority: string;
  responsible: string | null; due_date: string | null;
  completion_date: string | null; notes: string | null;
  measures_count: number; measures_done: number;
  progress_pct: number | null;
}
interface Measure {
  id: number; objective_id: number; title: string; description: string | null;
  measure_type: string; area: string | null; status: string;
  estimated_reduction_pct: number | null; actual_reduction_pct: number | null;
  cost_clp: number | null; responsible: string | null;
  implementation_date: string | null; verification_result: string | null;
  doc_ref: string | null;
}
interface Review {
  id: number; year: number; quarter: number; review_date: string;
  conducted_by: string | null; overall_assessment: string | null;
  collective_dose_msv: number | null; max_individual_msv: number | null;
  avg_individual_msv: number | null; incidents_count: number;
  objectives_achieved: number; objectives_total: number;
  findings: string | null; actions_required: string | null;
  next_review_date: string | null;
}
interface AlaraData {
  year: number;
  objectives: Objective[];
  reviews: Review[];
  stats: { total:number; achieved:number; active:number; not_achieved:number; high_priority_pending:number; overdue:number };
}

// ── config ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label:string; color:string; icon: React.ComponentType<{className?:string}> }> = {
  planned:       { label:"Planificado",   color:"bg-gray-100   text-gray-700",   icon: Clock         },
  in_progress:   { label:"En Progreso",   color:"bg-blue-100   text-blue-700",   icon: BarChart3     },
  achieved:      { label:"Logrado",       color:"bg-emerald-100 text-emerald-700",icon: CheckCircle2  },
  not_achieved:  { label:"No Logrado",    color:"bg-red-100    text-red-700",    icon: XCircle       },
  cancelled:     { label:"Cancelado",     color:"bg-gray-100   text-gray-500",   icon: XCircle       },
};
const PRIORITY_CFG: Record<string, string> = {
  high:   "bg-red-100    text-red-700",
  medium: "bg-amber-100  text-amber-700",
  low:    "bg-gray-100   text-gray-600",
};
const PRIORITY_LABEL: Record<string, string> = { high:"Alta", medium:"Media", low:"Baja" };
const CATEGORY_LABEL: Record<string, string> = {
  optimization:"Optimización", dose_reduction:"Reducción Dosis",
  technical:"Técnica", administrative:"Administrativa",
};
const MEASURE_STATUS_CFG: Record<string, { label:string; color:string }> = {
  proposed:     { label:"Propuesta",    color:"bg-gray-100  text-gray-700"   },
  approved:     { label:"Aprobada",     color:"bg-blue-100  text-blue-700"   },
  implementing: { label:"Implementando",color:"bg-amber-100 text-amber-700"  },
  completed:    { label:"Completada",   color:"bg-emerald-100 text-emerald-700" },
  rejected:     { label:"Rechazada",    color:"bg-red-100   text-red-700"    },
};
const ASSESSMENT_CFG: Record<string, { label:string; color:string }> = {
  satisfactory:    { label:"Satisfactorio",   color:"bg-emerald-100 text-emerald-700 border-emerald-200" },
  needs_improvement:{ label:"Mejora necesaria",color:"bg-amber-100 text-amber-700 border-amber-200"     },
  critical:        { label:"Crítico",          color:"bg-red-100 text-red-700 border-red-200"            },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function isPast(d: string | null) {
  return d ? new Date(d) < new Date() : false;
}

// ── ObjectiveCard ──────────────────────────────────────────────────────────
function ObjectiveCard({ obj }: { obj: Objective }) {
  const [open, setOpen] = useState(false);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showMForm, setShowMForm] = useState(false);
  const [mForm, setMForm] = useState({ title:"", description:"", measure_type:"technical", area:"", status:"proposed", estimated_reduction_pct:"", responsible:"", implementation_date:"" });

  const toggle = async () => {
    setOpen(o => !o);
    if (!loaded) {
      const r = await fetch(`/api/alara/measures?objective_id=${obj.id}`);
      if (r.ok) setMeasures(await r.json());
      setLoaded(true);
    }
  };

  const addMeasure = async () => {
    const res = await fetch("/api/alara", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ _type:"measure", objective_id: obj.id, ...mForm,
        estimated_reduction_pct: mForm.estimated_reduction_pct ? Number(mForm.estimated_reduction_pct) : null,
        implementation_date: mForm.implementation_date || null }),
    });
    if (res.ok) {
      const m = await res.json();
      setMeasures(ms => [...ms, m]);
      setShowMForm(false);
      setMForm({ title:"", description:"", measure_type:"technical", area:"", status:"proposed", estimated_reduction_pct:"", responsible:"", implementation_date:"" });
    }
  };

  const sc = STATUS_CFG[obj.status] ?? STATUS_CFG.planned;
  const StatusIcon = sc.icon;
  const pct = obj.progress_pct ?? 0;
  const isOverdue = isPast(obj.due_date) && !["achieved","cancelled","not_achieved"].includes(obj.status);

  return (
    <div className={`rounded-lg border ${isOverdue ? "border-red-300" : "border-border"} bg-surface overflow-hidden`}>
      {/* header */}
      <button onClick={toggle} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <TrendingDown className="h-4 w-4 mt-0.5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{obj.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc.color}`}>
                <StatusIcon className="inline h-2.5 w-2.5 mr-0.5" />{sc.label}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_CFG[obj.priority]}`}>
                {PRIORITY_LABEL[obj.priority]}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {CATEGORY_LABEL[obj.category]}
              </span>
              {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">Atrasado</span>}
            </div>
            {/* progress bar */}
            {obj.target_value !== null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-accent" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {obj.current_value ?? "—"} / {obj.target_value} {obj.unit}
                </span>
              </div>
            )}
            <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
              {obj.responsible && <span>👤 {obj.responsible}</span>}
              {obj.due_date && <span className={isOverdue ? "text-red-600" : ""}>📅 {fmtDate(obj.due_date)}</span>}
              <span>📋 {obj.measures_done}/{obj.measures_count} medidas</span>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </div>
      </button>

      {/* expanded */}
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          {obj.description && <p className="text-sm text-muted-foreground">{obj.description}</p>}

          {/* measures */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medidas de Optimización</h4>
              <button onClick={() => setShowMForm(f=>!f)}
                className="flex items-center gap-1 text-xs text-accent hover:underline">
                <Plus className="h-3 w-3" />Nueva medida
              </button>
            </div>
            {measures.length === 0 ? <p className="text-xs text-muted-foreground">Sin medidas registradas.</p> : (
              <div className="space-y-2">
                {measures.map(m => {
                  const mc = MEASURE_STATUS_CFG[m.status] ?? MEASURE_STATUS_CFG.proposed;
                  return (
                    <div key={m.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium flex-1">{m.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mc.color}`}>{mc.label}</span>
                        {m.measure_type && <span className="text-[10px] text-muted-foreground capitalize">{m.measure_type}</span>}
                        {m.estimated_reduction_pct && <span className="text-[10px] text-emerald-600">-{m.estimated_reduction_pct}%</span>}
                      </div>
                      {m.description && <p className="mt-1 text-[11px] text-muted-foreground pl-5">{m.description}</p>}
                      {(m.area || m.responsible || m.implementation_date) && (
                        <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground pl-5">
                          {m.area && <span>📍 {m.area}</span>}
                          {m.responsible && <span>👤 {m.responsible}</span>}
                          {m.implementation_date && <span>📅 {fmtDate(m.implementation_date)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {showMForm && (
              <div className="mt-3 rounded-md border border-border bg-muted/10 p-3 space-y-2">
                <input value={mForm.title} onChange={e=>setMForm(f=>({...f,title:e.target.value}))}
                  placeholder="Título de la medida *" className="w-full rounded border px-2 py-1 text-xs" />
                <textarea value={mForm.description} onChange={e=>setMForm(f=>({...f,description:e.target.value}))}
                  placeholder="Descripción" rows={2} className="w-full rounded border px-2 py-1 text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={mForm.measure_type} onChange={e=>setMForm(f=>({...f,measure_type:e.target.value}))}
                    className="rounded border px-2 py-1 text-xs">
                    <option value="technical">Técnica</option>
                    <option value="administrative">Administrativa</option>
                    <option value="ppe">EPP</option>
                    <option value="training">Capacitación</option>
                    <option value="procedure">Procedimiento</option>
                  </select>
                  <input value={mForm.area} onChange={e=>setMForm(f=>({...f,area:e.target.value}))}
                    placeholder="Área" className="rounded border px-2 py-1 text-xs" />
                  <input value={mForm.estimated_reduction_pct} onChange={e=>setMForm(f=>({...f,estimated_reduction_pct:e.target.value}))}
                    placeholder="Red. estimada (%)" type="number" className="rounded border px-2 py-1 text-xs" />
                  <input value={mForm.responsible} onChange={e=>setMForm(f=>({...f,responsible:e.target.value}))}
                    placeholder="Responsable" className="rounded border px-2 py-1 text-xs" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={()=>setShowMForm(false)} className="px-3 py-1 text-xs border rounded hover:bg-muted">Cancelar</button>
                  <button onClick={addMeasure} disabled={!mForm.title}
                    className="px-3 py-1 text-xs bg-accent text-white rounded disabled:opacity-50">Agregar</button>
                </div>
              </div>
            )}
          </div>
          {obj.notes && <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-2">Notas: {obj.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── ReviewCard ─────────────────────────────────────────────────────────────
function ReviewCard({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  const cfg = r.overall_assessment ? ASSESSMENT_CFG[r.overall_assessment] : ASSESSMENT_CFG.satisfactory;
  const quarterLabel = ["I","II","III","IV"][r.quarter-1] ?? r.quarter;
  const pct = r.objectives_total > 0 ? Math.round((r.objectives_achieved/r.objectives_total)*100) : 0;
  return (
    <div className={`rounded-lg border ${cfg.color} overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-black/5 transition-colors">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">Revisión Trimestral {quarterLabel} — {r.year}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] opacity-70">
              <span>📅 {fmtDate(r.review_date)}</span>
              {r.conducted_by && <span>👤 {r.conducted_by}</span>}
              <span>🎯 {r.objectives_achieved}/{r.objectives_total} objetivos ({pct}%)</span>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-current/20 px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Dosis colectiva",  value: r.collective_dose_msv ? `${r.collective_dose_msv} mSv` : "—" },
              { label:"Dosis individual máx.", value: r.max_individual_msv ? `${r.max_individual_msv} mSv` : "—" },
              { label:"Dosis individual prom.", value: r.avg_individual_msv ? `${r.avg_individual_msv} mSv` : "—" },
            ].map(k=>(
              <div key={k.label} className="text-center">
                <p className="text-base font-bold">{k.value}</p>
                <p className="text-[10px] opacity-70">{k.label}</p>
              </div>
            ))}
          </div>
          {r.findings && (
            <div>
              <p className="text-xs font-semibold mb-1">Hallazgos:</p>
              <p className="text-xs opacity-80">{r.findings}</p>
            </div>
          )}
          {r.actions_required && (
            <div>
              <p className="text-xs font-semibold mb-1">Acciones requeridas:</p>
              <p className="text-xs opacity-80">{r.actions_required}</p>
            </div>
          )}
          {r.next_review_date && (
            <p className="text-xs opacity-70">Próxima revisión: {fmtDate(r.next_review_date)}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ObjectiveForm modal ────────────────────────────────────────────────────
const BLANK_OBJ = { title:"", description:"", category:"optimization", target_metric:"", baseline_value:"", target_value:"", unit:"", status:"planned", priority:"medium", responsible:"", due_date:"", notes:"" };

function ObjectiveModal({ year, onClose, onSaved }: { year:number; onClose:()=>void; onSaved:(o:Objective)=>void }) {
  const [form, setForm] = useState({...BLANK_OBJ, year: String(year)});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/alara", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, year:Number(form.year),
        baseline_value: form.baseline_value ? Number(form.baseline_value) : null,
        target_value: form.target_value ? Number(form.target_value) : null,
        due_date: form.due_date || null }),
    });
    setSaving(false);
    if (res.ok) onSaved(await res.json());
  };
  const F = (label:string, key:keyof typeof form, type="text", opts?: string[][]) => (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {opts ? (
        <select value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} className="mt-0.5 w-full rounded border px-2 py-1 text-sm">
          {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
          className="mt-0.5 w-full rounded border px-2 py-1 text-sm" />
      )}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Target className="h-4 w-4 text-accent"/>Nuevo Objetivo ALARA</h3>
        {F("Título *","title")} {F("Descripción","description")}
        <div className="grid grid-cols-2 gap-3">
          {F("Categoría","category","text",[["optimization","Optimización"],["dose_reduction","Reducción Dosis"],["technical","Técnica"],["administrative","Administrativa"]])}
          {F("Prioridad","priority","text",[["high","Alta"],["medium","Media"],["low","Baja"]])}
          {F("Estado","status","text",[["planned","Planificado"],["in_progress","En Progreso"],["achieved","Logrado"]])}
          {F("Responsable","responsible")}
          {F("Valor base","baseline_value","number")} {F("Valor objetivo","target_value","number")}
          {F("Unidad","unit")} {F("Fecha límite","due_date","date")}
        </div>
        <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
          placeholder="Notas adicionales" rows={2} className="w-full rounded border px-2 py-1 text-sm" />
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-muted">Cancelar</button>
          <button onClick={save} disabled={!form.title||saving}
            className="px-4 py-1.5 text-sm bg-accent text-white rounded disabled:opacity-50">
            {saving?"Guardando...":"Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AlaraPage() {
  const year = new Date().getFullYear();
  const [data, setData] = useState<AlaraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [tab, setTab] = useState<"objectives"|"reviews">("objectives");

  const load = useCallback(async (s = filterStatus) => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (s) params.set("status", s);
    const r = await fetch(`/api/alara?${params}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [year, filterStatus]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="p-8 text-muted-foreground">Error cargando datos.</p>;

  const { objectives, reviews, stats } = data;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><TrendingDown className="h-5 w-5 text-accent"/>Programa ALARA {year}</h1>
          <p className="text-sm text-muted-foreground">As Low As Reasonably Achievable — Optimización de dosis · DS 3/1985 Art. 32</p>
        </div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90">
          <Plus className="h-4 w-4"/>Nuevo Objetivo
        </button>
      </div>

      {/* KPIs */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">{stats.overdue} objetivo(s) ALARA vencido(s) sin lograr</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label:"Total objetivos",   value: stats.total,                color:"" },
          { label:"En progreso",       value: stats.active,               color: stats.active > 0 ? "text-blue-600" : "" },
          { label:"Logrados",          value: stats.achieved,             color: stats.achieved > 0 ? "text-emerald-600" : "" },
          { label:"Alta prioridad pend.", value: stats.high_priority_pending, color: stats.high_priority_pending > 0 ? "text-red-600" : "" },
          { label:"Atrasados",         value: stats.overdue,              color: stats.overdue > 0 ? "text-amber-600" : "" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([["objectives","Objetivos","Target"],["reviews","Revisiones Trimestrales","ClipboardCheck"]] as const).map(([t, label]) => (
          <button key={t} onClick={()=>setTab(t as "objectives"|"reviews")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===t?"border-accent text-accent":"border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "objectives" && (
        <>
          {/* filter */}
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value);}}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <option value="">Todos los estados</option>
              <option value="planned">Planificado</option>
              <option value="in_progress">En Progreso</option>
              <option value="achieved">Logrado</option>
              <option value="not_achieved">No Logrado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="flex flex-col gap-3">
            {objectives.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin objetivos registrados para {year}</p>
            ) : objectives.map(o => <ObjectiveCard key={o.id} obj={o} />)}
          </div>
        </>
      )}

      {tab === "reviews" && (
        <div className="flex flex-col gap-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin revisiones registradas para {year}</p>
          ) : reviews.map(r => <ReviewCard key={r.id} r={r} />)}
        </div>
      )}

      {/* Principio ALARA */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent"/>Marco Normativo ALARA
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div><p className="font-medium text-foreground mb-1">Principio de Optimización</p><p>IAEA GSR Part 3 Principio 5: Las exposiciones deben mantenerse tan bajas como sea razonablemente posible</p></div>
          <div><p className="font-medium text-foreground mb-1">DS 3/1985 Artículo 32</p><p>Todo titular de instalación radiactiva debe establecer un programa de protección radiológica que incluya medidas de optimización</p></div>
          <div><p className="font-medium text-foreground mb-1">Revisiones ALARA</p><p>Revisiones trimestrales para evaluar cumplimiento de objetivos y efectividad de medidas implementadas</p></div>
        </div>
      </div>

      {showForm && <ObjectiveModal year={year} onClose={()=>setShowForm(false)} onSaved={o=>{setData(d=>d?({...d,objectives:[o,...d.objectives]}):d);setShowForm(false);}} />}
    </div>
  );
}
