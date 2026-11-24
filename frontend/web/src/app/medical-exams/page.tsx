"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  Stethoscope, Plus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Clock, XCircle, User, Calendar, X,
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

// ── types ──────────────────────────────────────────────────────────────────
interface Exam {
  id: number; worker_name: string; worker_rut: string | null;
  worker_category: string; service: string | null; exam_type: string;
  exam_date: string; next_exam_date: string | null;
  result: string | null; result_details: string | null;
  examiner: string | null; institution: string | null;
  observations: string | null; status: string; computed_status: string;
  days_until_next: number | null;
}
interface Stats {
  total:number; completed:number; scheduled:number; overdue:number;
  upcoming_30d:number; with_observations:number; not_fit:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = {
  pre_ocupacional:"Pre-ocupacional", periodico_anual:"Periódico anual",
  periodico_semestral:"Periódico semestral", egreso:"Egreso", especial:"Especial",
};
const RESULT_CFG: Record<string,{label:string;color:string;icon:React.ComponentType<{className?:string}>}> = {
  apto:         { label:"Apto",          color:"bg-emerald-100 text-emerald-700 border-emerald-200", icon:CheckCircle2 },
  apto_con_obs: { label:"Apto c/ obs.",  color:"bg-amber-100  text-amber-700  border-amber-200",    icon:AlertTriangle },
  no_apto:      { label:"No apto",       color:"bg-red-100    text-red-700    border-red-200",      icon:XCircle },
  pending:      { label:"Pendiente",     color:"bg-gray-100   text-gray-500   border-gray-200",     icon:Clock },
};
const STATUS_CFG: Record<string,{label:string;color:string}> = {
  completed:{ label:"Completado", color:"bg-emerald-100 text-emerald-700" },
  scheduled:{ label:"Programado", color:"bg-blue-100   text-blue-700"    },
  overdue:  { label:"Atrasado",   color:"bg-red-100    text-red-700"     },
  upcoming: { label:"Próximo",    color:"bg-amber-100  text-amber-700"   },
  cancelled:{ label:"Cancelado",  color:"bg-gray-100   text-gray-500"    },
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}
function isPast(d: string | null) { return d ? new Date(d) < new Date() : false; }

// ── ExamCard ───────────────────────────────────────────────────────────────
function ExamCard({ e, onEdit, onDelete }: { e:Exam; onEdit:(e:Exam)=>void; onDelete:(id:number)=>void }) {
  const [open, setOpen] = useState(false);
  const st = e.computed_status || e.status;
  const sc = STATUS_CFG[st] ?? STATUS_CFG.scheduled;
  const rc = e.result ? (RESULT_CFG[e.result] ?? RESULT_CFG.pending) : RESULT_CFG.pending;
  const ResultIcon = rc.icon;
  const nextOverdue = isPast(e.next_exam_date) && e.status === "completed";

  return (
    <div className={`rounded-lg border ${st==="overdue"||nextOverdue?"border-red-300":st==="upcoming"?"border-amber-300":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <User className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground"/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{e.worker_name}</span>
              {e.worker_rut && <span className="text-[10px] font-mono text-muted-foreground">{e.worker_rut}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${rc.color}`}>{rc.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Cat. {e.worker_category}</span>
              {nextOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Próx. vencido</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              <span>{TYPE_LABEL[e.exam_type]??e.exam_type}</span>
              <span>📅 {fmtDate(e.exam_date)}</span>
              {e.service && <span>🏥 {e.service}</span>}
              {e.next_exam_date && (
                <span className={nextOverdue?"text-red-600":Number(e.days_until_next)<=30?"text-amber-600":""}>
                  Próx: {fmtDate(e.next_exam_date)}
                  {e.days_until_next !== null && e.days_until_next <= 60 ? ` (${e.days_until_next}d)` : ""}
                </span>
              )}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {e.examiner && <div><span className="text-muted-foreground">Médico: </span>{e.examiner}</div>}
            {e.institution && <div><span className="text-muted-foreground">Institución: </span>{e.institution}</div>}
          </div>
          {e.result_details && (
            <div className={`rounded-md p-2.5 text-xs border ${e.result==="no_apto"?"bg-red-50 border-red-200 text-red-700":e.result==="apto_con_obs"?"bg-amber-50 border-amber-200 text-amber-700":"bg-muted/40 border-border/40"}`}>
              <strong>Resultado: </strong>{e.result_details}
            </div>
          )}
          {e.observations && <p className="text-xs text-muted-foreground italic">{e.observations}</p>}
          <div className="flex gap-2 pt-1 border-t border-border/40">
            <button onClick={()=>onEdit(e)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
            <button onClick={()=>onDelete(e.id)} className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded hover:bg-destructive/20">Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
const EXAM_TYPES = ["pre_ocupacional","periodico_anual","periodico_semestral","egreso","especial"];
const RESULTS    = ["pending","apto","apto_con_obs","no_apto"];
const STATUSES   = ["scheduled","completed","cancelled"];

function ExamModal({ exam, onClose, onSave }: { exam:Partial<Exam>|null; onClose:()=>void; onSave:(data:Partial<Exam>)=>void }) {
  const [form, setForm] = useState<Partial<Exam>>({
    worker_name:"", worker_category:"A", exam_type:"periodico_anual",
    exam_date: new Date().toISOString().split("T")[0],
    result:"pending", status:"scheduled", ...exam,
  });
  const set = (k: keyof Exam, v: string) => setForm(f=>({...f,[k]:v}));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{exam?.id?"Editar examen":"Registrar examen médico"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Nombre trabajador *
              <input value={form.worker_name??""} onChange={e=>set("worker_name",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="Nombre completo"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">RUT
              <input value={form.worker_rut??""} onChange={e=>set("worker_rut",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="12.345.678-9"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Categoría
              <select value={form.worker_category??""} onChange={e=>set("worker_category",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                <option value="A">A — Control trimestral</option>
                <option value="B">B — Control anual</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Servicio
              <input value={form.service??""} onChange={e=>set("service",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="Medicina Nuclear..."/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Tipo de examen
              <select value={form.exam_type??""} onChange={e=>set("exam_type",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {EXAM_TYPES.map(t=><option key={t} value={t}>{TYPE_LABEL[t]??t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha del examen *
              <input type="date" value={form.exam_date??""} onChange={e=>set("exam_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha próximo examen
              <input type="date" value={form.next_exam_date??""} onChange={e=>set("next_exam_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Resultado
              <select value={form.result??""} onChange={e=>set("result",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {RESULTS.map(r=><option key={r} value={r}>{RESULT_CFG[r]?.label??r}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Estado
              <select value={form.status??""} onChange={e=>set("status",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {STATUSES.map(s=><option key={s} value={s}>{STATUS_CFG[s]?.label??s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Médico examinador
              <input value={form.examiner??""} onChange={e=>set("examiner",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Institución
              <input value={form.institution??""} onChange={e=>set("institution",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="Mutual, IST..."/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Detalles resultado
              <textarea value={form.result_details??""} onChange={e=>set("result_details",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
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
export default function MedicalExamsPage() {
  const [data, setData] = useState<{ rows:Exam[]; stats:Stats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Exam>|null|false>(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const load = useCallback(async (s=filterStatus, c=filterCat) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (s) p.set("status",s);
    if (c) p.set("category",c);
    const r = await fetch(`/api/medical-exams?${p}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [filterStatus, filterCat]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form: Partial<Exam>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/medical-exams", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };
  const handleDelete = async (id: number) => {
    await fetch("/api/medical-exams", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id}) });
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
        <ExamModal exam={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Stethoscope className="h-5 w-5 text-accent"/>Exámenes Médicos Ocupacionales</h1>
          <p className="text-sm text-muted-foreground">DS 594/1999 Arts. 68–71 — Vigilancia médica POE</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Registrar examen
        </button>
      </div>

      {/* Alertas */}
      {st && (Number(st.overdue)>0 || Number(st.not_fit)>0) && (
        <div className="flex flex-col gap-2">
          {Number(st.overdue)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <XCircle className="h-4 w-4 text-red-600 shrink-0"/>
              <p className="text-sm text-red-700"><strong>{st.overdue} trabajador(es)</strong> con examen médico vencido o próximo a vencerse</p>
            </div>
          )}
          {Number(st.not_fit)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
              <p className="text-sm text-orange-700"><strong>{st.not_fit} trabajador(es)</strong> con resultado "No apto" — Requiere revisión</p>
            </div>
          )}
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="medical-exams"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:"Total exámenes", value:st.total },
            { label:"Completados", value:st.completed, color:"text-emerald-600" },
            { label:"Programados", value:st.scheduled, color:"text-blue-600" },
            { label:"Atrasados", value:st.overdue, color: st.overdue>0?"text-red-600":"" },
            { label:"Próx. 30 días", value:st.upcoming_30d, color: st.upcoming_30d>0?"text-amber-600":"" },
            { label:"Apto c/ observaciones", value:st.with_observations, color: st.with_observations>0?"text-amber-600":"" },
            { label:"No apto", value:st.not_fit, color: st.not_fit>0?"text-red-600":"" },
            { label:"Categoría A: control", value:"Trimestral", color:"text-muted-foreground" },
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
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value,filterCat);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          <option value="overdue">Atrasados</option>
          <option value="scheduled">Programados</option>
          <option value="completed">Completados</option>
        </select>
        <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);load(filterStatus,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todas las categorías</option>
          <option value="A">Categoría A</option>
          <option value="B">Categoría B</option>
        </select>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Stethoscope className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin exámenes registrados</p>
          </div>
        ) : rows.map(e=><ExamCard key={e.id} e={e} onEdit={e=>setModal(e)} onDelete={handleDelete}/>)}
      </div>

      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: DS 594/1999 Arts. 68–71 (Control Médico POE) · CCHEN NS-06.0 (Programa de Vigilancia Médica) · DS 3/1985 Art. 15 (Categorías A y B)
      </div>
    </div>
  );
}
