"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Plus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Clock, X, Calendar,
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

// ── types ──────────────────────────────────────────────────────────────────
interface Meeting {
  id: number; meeting_code: string; meeting_type: string; meeting_date: string;
  location: string | null; chair: string | null; secretary: string | null;
  attendees: string | null; quorum: boolean; agenda: string | null;
  summary: string | null; agreements: string | null; pending_items: string | null;
  next_meeting_date: string | null; status: string; document_path: string | null;
  agreement_count: number; pending_agreements: number; overdue_agreements: number;
}
interface Agreement {
  id: number; meeting_id: number; agreement_code: string; description: string;
  responsible: string | null; deadline: string | null; priority: string;
  status: string; completion_date: string | null; observations: string | null;
  meeting_code: string; meeting_date: string;
}
interface Stats {
  total_meetings:number; completed:number; scheduled:number;
  total_agreements:number; pending_agreements:number; completed_agreements:number; overdue_agreements:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = { ordinary:"Ordinaria", extraordinary:"Extraordinaria", emergency:"Emergencia" };
const STATUS_CFG: Record<string,{label:string;color:string}> = {
  scheduled: { label:"Programada",  color:"bg-blue-100   text-blue-700"    },
  completed:  { label:"Realizada",   color:"bg-emerald-100 text-emerald-700" },
  cancelled:  { label:"Cancelada",   color:"bg-red-100    text-red-700"     },
};
const AGMT_STATUS: Record<string,{label:string;color:string}> = {
  pending:     { label:"Pendiente",    color:"bg-amber-100  text-amber-700"   },
  in_progress: { label:"En progreso",  color:"bg-blue-100   text-blue-700"    },
  completed:   { label:"Completado",   color:"bg-emerald-100 text-emerald-700" },
  cancelled:   { label:"Cancelado",    color:"bg-muted   text-muted-foreground"    },
};
const PRIORITY_CFG: Record<string,string> = {
  low:"bg-muted text-muted-foreground", medium:"bg-amber-100 text-amber-700", high:"bg-red-100 text-red-700",
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}

// ── MeetingCard ────────────────────────────────────────────────────────────
function MeetingCard({ m, onStatusChange, onEdit }: { m:Meeting; onStatusChange:(id:number,s:string)=>void; onEdit:(m:Meeting)=>void }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CFG[m.status] ?? STATUS_CFG.scheduled;
  const hasIssues = Number(m.overdue_agreements) > 0;

  return (
    <div className={`rounded-lg border ${hasIssues?"border-orange-300":m.status==="scheduled"?"border-blue-200":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <Calendar className={`h-4 w-4 mt-0.5 shrink-0 ${m.status==="completed"?"text-emerald-500":m.status==="scheduled"?"text-blue-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{m.meeting_code}</span>
              <span className="text-sm font-semibold">Sesión {TYPE_LABEL[m.meeting_type]??m.meeting_type}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              {!m.quorum && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">Sin quórum</span>}
              {Number(m.pending_agreements) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">{m.pending_agreements} acuerdos pendientes</span>}
              {hasIssues && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">⚠ {m.overdue_agreements} acuerdos atrasados</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              <span>📅 {fmtDate(m.meeting_date)}</span>
              {m.chair && <span>👤 {m.chair}</span>}
              {m.location && <span>📍 {m.location}</span>}
              {m.next_meeting_date && <span>Próxima: {fmtDate(m.next_meeting_date)}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {m.attendees && (
            <div>
              <p className="text-xs font-semibold mb-1">Asistentes:</p>
              <p className="text-xs text-muted-foreground">{m.attendees}</p>
            </div>
          )}
          {m.agenda && (
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold mb-1">Tabla:</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{m.agenda}</p>
            </div>
          )}
          {m.summary && (
            <div>
              <p className="text-xs font-semibold mb-1">Resumen:</p>
              <p className="text-xs text-muted-foreground">{m.summary}</p>
            </div>
          )}
          {m.agreements && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
              <p className="text-xs font-semibold text-blue-700 mb-1">Acuerdos:</p>
              <p className="text-xs text-blue-700 whitespace-pre-line">{m.agreements}</p>
            </div>
          )}
          {m.pending_items && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">Pendientes para próxima sesión:</p>
              <p className="text-xs text-amber-700 whitespace-pre-line">{m.pending_items}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            <RowPdfActions module="committee" ownerType="meeting" ownerId={String(m.id)} size="xs" />
            <button onClick={()=>onEdit(m)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
            {m.status==="scheduled" && (
              <button onClick={()=>onStatusChange(m.id,"completed")} className="text-xs px-2 py-1 rounded border bg-emerald-100 text-emerald-700 hover:opacity-80">✓ Marcar realizada</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AgreementRow ───────────────────────────────────────────────────────────
function AgreementRow({ a, onComplete }: { a:Agreement; onComplete:(id:number)=>void }) {
  const sc = AGMT_STATUS[a.status] ?? AGMT_STATUS.pending;
  const isOverdue = a.deadline && new Date(a.deadline) < new Date() && !["completed","cancelled"].includes(a.status);
  return (
    <div className={`flex items-start gap-3 rounded-lg border ${isOverdue?"border-orange-300 bg-orange-50/30":a.status==="completed"?"border-emerald-200 bg-emerald-50/20":"border-border"} p-3`}>
      {a.status==="completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"/> : <Clock className={`h-4 w-4 shrink-0 mt-0.5 ${isOverdue?"text-orange-500":"text-muted-foreground"}`}/>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground">{a.agreement_code}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_CFG[a.priority]??""}`}>{a.priority}</span>
          {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Atrasado</span>}
        </div>
        <p className="text-sm mt-0.5">{a.description}</p>
        <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
          {a.responsible && <span>👤 {a.responsible}</span>}
          <span>📅 Plazo: {fmtDate(a.deadline)}</span>
          <span className="text-muted-foreground/70">({a.meeting_code})</span>
        </div>
      </div>
      {!["completed","cancelled"].includes(a.status) && (
        <button onClick={()=>onComplete(a.id)} className="text-[10px] px-1.5 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0">✓</button>
      )}
    </div>
  );
}

// ── Modal Sesión ───────────────────────────────────────────────────────────
function MeetingModal({ m, onClose, onSave }: { m:Partial<Meeting>|null; onClose:()=>void; onSave:(d:Partial<Meeting>)=>void }) {
  const [form, setForm] = useState<Partial<Meeting>>({
    meeting_type:"ordinary", status:"scheduled", quorum:true,
    location:"Sala de Reuniones Dpto. PR", ...m,
  });
  const set = (k: keyof Meeting, v: string|boolean) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{m?.id?"Editar sesión":"Programar sesión Comité PR"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">Tipo
              <select value={form.meeting_type??""} onChange={e=>set("meeting_type",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha *
              <input type="date" value={form.meeting_date??""} onChange={e=>set("meeting_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Lugar
              <input value={form.location??""} onChange={e=>set("location",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Presidente
              <input value={form.chair??""} onChange={e=>set("chair",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Secretario
              <input value={form.secretary??""} onChange={e=>set("secretary",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Asistentes
              <textarea value={form.attendees??""} onChange={e=>set("attendees",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Tabla (agenda)
              <textarea value={form.agenda??""} onChange={e=>set("agenda",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={3}/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Resumen / acta
              <textarea value={form.summary??""} onChange={e=>set("summary",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={3}/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Próxima sesión
              <input type="date" value={form.next_meeting_date??""} onChange={e=>set("next_meeting_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Estado
              <select value={form.status??""} onChange={e=>set("status",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.quorum} onChange={e=>set("quorum",e.target.checked)} className="h-4 w-4"/>
              Quórum alcanzado
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
export default function CommitteePage() {
  const [data, setData] = useState<{ rows:Meeting[]; agreements:Agreement[]; stats:Stats }|null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Meeting>|null|false>(false);
  const [tab, setTab] = useState<"meetings"|"agreements">("meetings");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async (s=filterStatus) => {
    setLoading(true);
    const p = new URLSearchParams({ agreements:"1" });
    if (s) p.set("status",s);
    const res = await fetch(`/api/committee?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterStatus]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Meeting>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/committee", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };
  const handleStatusChange = async (id:number, status:string) => {
    await fetch("/api/committee", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status}) });
    load();
  };
  const handleCompleteAgreement = async (id:number) => {
    await fetch("/api/committee", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id,_type:"agreement",status:"completed",completion_date:new Date().toISOString().split("T")[0]}) });
    load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const meetings  = data?.rows ?? [];
  const agreements = data?.agreements ?? [];
  const pendingAgreements = agreements.filter(a=>!["completed","cancelled"].includes(a.status));

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <MeetingModal m={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-accent"/>Comité de Protección Radiológica</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Actas de sesiones y seguimiento de acuerdos · Periodicidad trimestral mínima</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Nueva sesión
        </button>
      </div>

      {/* Alertas */}
      {st && Number(st.overdue_agreements) > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
          <p className="text-sm text-orange-700"><strong>{st.overdue_agreements} acuerdo(s)</strong> con plazo vencido sin completar</p>
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="committee"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:"Total sesiones",    value:st.total_meetings },
            { label:"Realizadas",        value:st.completed,           color:"text-emerald-600" },
            { label:"Programadas",       value:st.scheduled,           color: st.scheduled>0?"text-blue-600":"" },
            { label:"Total acuerdos",    value:st.total_agreements },
            { label:"Acuerdos pendientes",value:st.pending_agreements, color: st.pending_agreements>0?"text-amber-600":"" },
            { label:"Acuerdos completados",value:st.completed_agreements,color:"text-emerald-600" },
            { label:"Acuerdos atrasados",value:st.overdue_agreements,  color: st.overdue_agreements>0?"text-orange-600":"" },
          ].map(k=>(
            <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
              <p className={`text-2xl font-bold ${k.color??""}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([["meetings","Sesiones"],["agreements","Seguimiento de acuerdos"]] as [string,string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as "meetings"|"agreements")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab===k?"border-accent text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}{k==="agreements"&&pendingAgreements.length>0&&<span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingAgreements.length}</span>}
          </button>
        ))}
      </div>

      {tab === "meetings" && (
        <>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value);}}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            {meetings.length===0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
                <p className="text-sm text-muted-foreground">Sin sesiones registradas</p>
              </div>
            ) : meetings.map(m=><MeetingCard key={m.id} m={m} onStatusChange={handleStatusChange} onEdit={m=>setModal(m)}/>)}
          </div>
        </>
      )}

      {tab === "agreements" && (
        <div className="flex flex-col gap-2">
          {agreements.length===0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
              <p className="text-sm text-muted-foreground">Sin acuerdos registrados</p>
            </div>
          ) : agreements.map(a=><AgreementRow key={a.id} a={a} onComplete={handleCompleteAgreement}/>)}
        </div>
      )}

      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: CCHEN NS-06.0 (Comité de Protección Radiológica) · DS 3/1985 Art. 15 · Sesiones ordinarias: mínimo trimestral · Código CPR-YYYY-NNN
      </div>
    </div>
  );
}
