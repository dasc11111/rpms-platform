"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ClipboardCheck, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, X,
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

// ── types ──────────────────────────────────────────────────────────────────
interface AuditFinding {
  id:number; audit_id:number; finding_code:string; finding_type:string; area:string|null;
  description:string; criteria_ref:string|null; severity:string; responsible:string|null;
  due_date:string|null; corrective_action:string|null; status:string; closure_date:string|null;
  audit_code?:string; audit_title?:string;
}
interface Audit {
  id:number; audit_code:string; title:string; audit_type:string; scope:string|null;
  auditor:string|null; auditee:string|null; planned_date:string|null;
  start_date:string|null; end_date:string|null; status:string;
  overall_result:string|null; summary:string|null; observations:string|null;
  finding_count:number; nc_count:number; open_findings:number; overdue_findings:number;
}
interface Stats {
  total_audits:number; completed:number; planned:number; in_progress:number;
  total_findings:number; nc_total:number; open_findings:number; overdue_findings:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = {
  internal:"Interna", cchen:"CCHEN", external:"Externa", surveillance:"Vigilancia",
};
const STATUS_LABEL: Record<string,string> = {
  planned:"Planificada", in_progress:"En curso", closed:"Cerrada", cancelled:"Cancelada",
};
const STATUS_COLOR: Record<string,string> = {
  planned:"bg-blue-100 text-blue-700", in_progress:"bg-amber-100 text-amber-700",
  closed:"bg-emerald-100 text-emerald-700", cancelled:"bg-muted text-muted-foreground",
};
const RESULT_LABEL: Record<string,string> = {
  satisfactory:"Satisfactorio", minor_nc:"NC Menor", major_nc:"NC Mayor", critical:"Crítico",
};
const RESULT_COLOR: Record<string,string> = {
  satisfactory:"text-emerald-600", minor_nc:"text-amber-600", major_nc:"text-orange-600", critical:"text-red-600",
};
const FINDING_LABEL: Record<string,string> = {
  non_conformance:"No conformidad", observation:"Observación", opportunity:"Oportunidad mejora",
};
const SEV_COLOR: Record<string,string> = {
  critical:"bg-red-100 text-red-700", major:"bg-orange-100 text-orange-700",
  minor:"bg-amber-100 text-amber-700", low:"bg-muted text-muted-foreground",
};
function fmtDate(d:string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"});
}

// ── FindingRow ──────────────────────────────────────────────────────────────
function FindingRow({ f, onClose }: { f:AuditFinding; onClose:()=>void }) {
  const isOverdue = f.due_date && new Date(f.due_date)<new Date() && f.status==="open";
  return (
    <div className={`rounded px-3 py-2 text-xs ${isOverdue?"bg-red-50 border border-red-200":"bg-muted/30"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[9px] text-muted-foreground">{f.finding_code}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${SEV_COLOR[f.severity]??SEV_COLOR.low}`}>{f.severity}</span>
        <span className="font-medium">{FINDING_LABEL[f.finding_type]??f.finding_type}</span>
        {f.area && <span className="text-muted-foreground">— {f.area}</span>}
        {isOverdue && <span className="text-red-600 font-semibold">⚠ VENCIDA</span>}
        {f.status==="closed" && <span className="text-emerald-600">✓ Cerrada {fmtDate(f.closure_date)}</span>}
      </div>
      <p className="mt-0.5 text-muted-foreground">{f.description}</p>
      {f.corrective_action && <p className="mt-0.5">→ {f.corrective_action}</p>}
      {f.due_date && <p className="text-muted-foreground mt-0.5">Plazo: {fmtDate(f.due_date)} · Resp.: {f.responsible??"-"}</p>}
      {f.status==="open" && (
        <button onClick={onClose} className="mt-1 text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
          ✓ Cerrar hallazgo
        </button>
      )}
    </div>
  );
}

// ── AuditCard ───────────────────────────────────────────────────────────────
function AuditCard({ audit, findings, onEdit, onCloseFinding }: {
  audit:Audit; findings:AuditFinding[];
  onEdit:(a:Audit)=>void; onCloseFinding:(id:number)=>void;
}) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_COLOR[audit.status] ?? STATUS_COLOR.planned;
  const rc = RESULT_COLOR[audit.overall_result??""] ?? "";
  const mine = findings.filter(f=>f.audit_id===audit.id);
  const hasIssue = audit.overdue_findings > 0;

  return (
    <div className={`rounded-lg border ${hasIssue?"border-orange-300":audit.status==="closed"?"border-emerald-200":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <ClipboardCheck className={`h-4 w-4 mt-0.5 shrink-0 ${audit.status==="closed"?"text-emerald-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{audit.audit_code}</span>
              <span className="text-sm font-semibold">{audit.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${sc}`}>{STATUS_LABEL[audit.status]??audit.status}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 shrink-0">{TYPE_LABEL[audit.audit_type]??audit.audit_type}</span>
              {audit.overall_result && <span className={`text-[10px] font-semibold shrink-0 ${rc}`}>{RESULT_LABEL[audit.overall_result]??audit.overall_result}</span>}
              {audit.nc_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">{audit.nc_count} NC</span>}
              {audit.overdue_findings > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">⚠ {audit.overdue_findings} vencidas</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground flex-wrap">
              {audit.auditor && <span>🔍 {audit.auditor}</span>}
              {audit.auditee && <span>📋 {audit.auditee}</span>}
              {audit.planned_date && <span>Planif.: {fmtDate(audit.planned_date)}</span>}
              {audit.finding_count > 0 && <span>{audit.finding_count} hallazgos · {audit.open_findings} abiertos</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {audit.scope && <div><p className="text-xs font-semibold mb-1">Alcance:</p><p className="text-xs text-muted-foreground">{audit.scope}</p></div>}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {audit.start_date && <div><span className="text-muted-foreground">Inicio: </span>{fmtDate(audit.start_date)}</div>}
            {audit.end_date   && <div><span className="text-muted-foreground">Fin: </span>{fmtDate(audit.end_date)}</div>}
          </div>
          {audit.summary && <div><p className="text-xs font-semibold mb-1">Resumen:</p><p className="text-xs text-muted-foreground">{audit.summary}</p></div>}
          {mine.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5">Hallazgos y no conformidades:</p>
              <div className="flex flex-col gap-1.5">
                {mine.map(f=><FindingRow key={f.id} f={f} onClose={()=>onCloseFinding(f.id)}/>)}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1 border-t border-border/40 flex-wrap">
            <RowPdfActions module="audits" ownerType="audit" ownerId={String(audit.id)} size="xs" />
            <button onClick={()=>onEdit(audit)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar auditoría</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AuditModal ──────────────────────────────────────────────────────────────
function AuditModal({ audit, onClose, onSave }: { audit:Partial<Audit>|null; onClose:()=>void; onSave:(d:Partial<Audit>)=>void }) {
  const [form, setForm] = useState<Partial<Audit>>({ audit_type:"internal", status:"planned", ...audit });
  const set = (k:keyof Audit, v:string) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{audit?.id?"Editar auditoría":"Registrar auditoría"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Título *
              <input value={form.title??""} onChange={e=>set("title",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Tipo
              <select value={form.audit_type??""} onChange={e=>set("audit_type",e.target.value)}
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
            <label className="flex flex-col gap-1 text-xs">Auditor
              <input value={form.auditor??""} onChange={e=>set("auditor",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Auditado
              <input value={form.auditee??""} onChange={e=>set("auditee",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Fecha planificada
              <input type="date" value={form.planned_date??""} onChange={e=>set("planned_date",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Resultado global
              <select value={form.overall_result??""} onChange={e=>set("overall_result",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                <option value="">— Sin resultado aún —</option>
                {Object.entries(RESULT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Alcance
              <textarea value={form.scope??""} onChange={e=>set("scope",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Resumen ejecutivo
              <textarea value={form.summary??""} onChange={e=>set("summary",e.target.value)}
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

// ── Main page ───────────────────────────────────────────────────────────────
export default function AuditsPage() {
  const [data, setData]       = useState<{ rows:Audit[]; stats:Stats }|null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<Partial<Audit>|null|false>(false);
  const [tab, setTab]         = useState<"audits"|"findings">("audits");
  const [filterType, setFilterType]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async (t=filterType, s=filterStatus) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (t) p.set("type",t);
    if (s) p.set("status",s);
    const [r1,r2] = await Promise.all([
      fetch(`/api/audits?${p}`).then(r=>r.json()),
      fetch("/api/audits?findings=1").then(r=>r.json()),
    ]);
    if (r1.rows) setData(r1);
    if (r2.rows) setFindings(r2.rows);
    setLoading(false);
  }, [filterType, filterStatus]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Audit>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/audits", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };
  const closeFinding = async (id: number) => {
    await fetch("/api/audits", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ id, _type:"finding", status:"closed", closure_date: new Date().toISOString().slice(0,10) }) });
    load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const rows = data?.rows ?? [];
  const openFindings = findings.filter(f=>f.status==="open");

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <AuditModal audit={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-accent"/>Auditorías Internas PR</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Planificación, ejecución y seguimiento de auditorías del Programa de Protección Radiológica</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Nueva auditoría
        </button>
      </div>

      {/* Alertas */}
      {st && Number(st.overdue_findings)>0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0"/>
          <p className="text-sm text-red-700"><strong>{st.overdue_findings} hallazgo(s)</strong> con plazo de acción correctiva vencido — requieren atención inmediata</p>
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="audits"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:"Total auditorías",   value:st.total_audits },
            { label:"Completadas",        value:st.completed,       color:"text-emerald-600" },
            { label:"Planificadas",       value:st.planned,         color:"text-blue-600" },
            { label:"En curso",           value:st.in_progress,     color:"text-amber-600" },
            { label:"Total hallazgos",    value:st.total_findings },
            { label:"No conformidades",   value:st.nc_total,        color:"text-orange-600" },
            { label:"Hallazgos abiertos", value:st.open_findings,   color: st.open_findings>0?"text-amber-600":"text-muted-foreground" },
            { label:"Plazos vencidos",    value:st.overdue_findings,color: st.overdue_findings>0?"text-red-600":"" },
          ].map(k=>(
            <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
              <p className={`text-2xl font-bold ${k.color??""}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 border-b border-border">
          {([["audits","Auditorías"],["findings","Seguimiento de hallazgos"]] as const).map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k)}
              className={`text-sm px-4 py-2 font-medium transition-colors border-b-2 ${tab===k?"border-accent text-foreground":"-mb-px border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
              {k==="findings" && openFindings.length>0 && <span className="ml-1.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{openFindings.length}</span>}
            </button>
          ))}
        </div>
        {tab==="audits" && (
          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={e=>{setFilterType(e.target.value);load(e.target.value,filterStatus);}}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(filterType,e.target.value);}}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Contenido */}
      {tab==="audits" ? (
        <div className="flex flex-col gap-2">
          {rows.length===0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
              <p className="text-sm text-muted-foreground">Sin auditorías registradas</p>
            </div>
          ) : rows.map(a=>(
            <AuditCard key={a.id} audit={a} findings={findings}
              onEdit={a=>setModal(a)} onCloseFinding={closeFinding}/>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Todos los hallazgos y no conformidades de todas las auditorías</p>
          {findings.length===0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin hallazgos registrados</p>
            </div>
          ) : findings.map(f=>(
            <div key={f.id} className="rounded-lg border border-border bg-surface px-4 py-2">
              <p className="text-[10px] text-muted-foreground mb-1">{f.audit_code} — {f.audit_title}</p>
              <FindingRow f={f} onClose={()=>closeFinding(f.id)}/>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500"/>
        <p className="text-[10px] text-muted-foreground">
          Normativa: CCHEN NS-06.0 §4.4 (Auditorías internas) · Mínimo una auditoría interna anual · Hallazgos con plazo máximo 90 días · NC cerradas con evidencia
        </p>
      </div>
    </div>
  );
}
