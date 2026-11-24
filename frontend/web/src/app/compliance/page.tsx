"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, CheckCircle2, AlertCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Plus, FileText, AlertTriangle, Shield, BarChart3,
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

// ── types ──────────────────────────────────────────────────────────────────
interface Requirement {
  id: number; regulation: string; article: string; section: string | null;
  requirement: string; description: string | null; category: string;
  status: string; evidence: string | null; last_verified: string | null;
  verified_by: string | null; next_review: string | null; notes: string | null;
  nc_count: number; nc_open: number;
}
interface NC {
  id: number; requirement_id: number; code: string; title: string;
  description: string; severity: string; type: string;
  identified_date: string; identified_by: string | null;
  root_cause: string | null; corrective_action: string | null;
  responsible: string | null; due_date: string | null;
  completion_date: string | null; status: string;
  article: string; req_title: string; regulation: string;
}
interface ComplianceData {
  requirements: Requirement[];
  nonconformities: NC[];
  stats: { total:number; compliant:number; partial:number; non_compliant:number; not_applicable:number; review_overdue:number; compliance_pct:number };
  nc_stats: { total:number; open:number; critical_open:number; overdue:number };
}

// ── config ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label:string; color:string; icon: React.ComponentType<{className?:string}> }> = {
  compliant:       { label:"Cumple",          color:"bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  partial:         { label:"Cumpl. parcial",  color:"bg-amber-100  text-amber-700  border-amber-200",    icon: AlertCircle  },
  non_compliant:   { label:"No cumple",       color:"bg-red-100    text-red-700    border-red-200",      icon: XCircle      },
  not_applicable:  { label:"No aplica",       color:"bg-gray-100   text-gray-500   border-gray-200",     icon: Shield       },
  pending_review:  { label:"Pend. revisión",  color:"bg-blue-100   text-blue-700   border-blue-200",     icon: Clock        },
};
const SEVERITY_CFG: Record<string, { label:string; color:string }> = {
  minor:    { label:"Menor",   color:"bg-amber-100  text-amber-700"  },
  major:    { label:"Mayor",   color:"bg-orange-100 text-orange-700" },
  critical: { label:"Crítica", color:"bg-red-100    text-red-700"    },
};
const NC_STATUS_CFG: Record<string, { label:string; color:string }> = {
  open:        { label:"Abierta",    color:"bg-red-100    text-red-700"    },
  in_progress: { label:"En proceso", color:"bg-amber-100  text-amber-700"  },
  closed:      { label:"Cerrada",    color:"bg-emerald-100 text-emerald-700" },
  verified:    { label:"Verificada", color:"bg-blue-100   text-blue-700"   },
};
const CATEGORY_LABEL: Record<string, string> = {
  program:"Programa PR", dosimetry:"Dosimetría", sources:"Fuentes", waste:"Residuos",
  training:"Capacitación", incident:"Incidentes", personnel:"Personal",
  facility:"Instalaciones", equipment:"Equipos", reports:"Reportes",
};
const REGULATION_COLOR: Record<string, string> = {
  "NS-06.0":"bg-blue-100 text-blue-700", "DS 3/1985":"bg-purple-100 text-purple-700",
  "IAEA":"bg-teal-100 text-teal-700", "DS 594/1999":"bg-gray-100 text-gray-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}
function isPast(d: string | null) { return d ? new Date(d) < new Date() : false; }

// ── RequirementRow ─────────────────────────────────────────────────────────
function RequirementRow({ r, onStatusChange }: { r: Requirement; onStatusChange:(id:number, status:string)=>void }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CFG[r.status] ?? STATUS_CFG.pending_review;
  const StatusIcon = sc.icon;
  const reviewOverdue = isPast(r.next_review) && r.status !== "not_applicable";

  return (
    <div className={`rounded-lg border ${r.status==="non_compliant"?"border-red-300":r.status==="partial"?"border-amber-300":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${r.status==="compliant"?"text-emerald-500":r.status==="non_compliant"?"text-red-500":r.status==="partial"?"text-amber-500":"text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${REGULATION_COLOR[r.regulation]??REGULATION_COLOR["DS 594/1999"]}`}>{r.regulation}</span>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{r.article}{r.section?` §${r.section}`:""}</span>
              <span className="text-sm font-semibold flex-1">{r.requirement}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{CATEGORY_LABEL[r.category]??r.category}</span>
              {r.nc_open > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{r.nc_open} NC abiertas</span>}
              {reviewOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">Rev. vencida</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              {r.last_verified && <span>✓ {fmtDate(r.last_verified)}</span>}
              {r.verified_by && <span>👤 {r.verified_by}</span>}
              {r.next_review && <span className={reviewOverdue?"text-orange-600":""}>📅 Próx. {fmtDate(r.next_review)}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
          {r.evidence && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-700 mb-1">📎 Evidencia de cumplimiento:</p>
              <p className="text-xs text-emerald-700">{r.evidence}</p>
            </div>
          )}
          {r.notes && <p className="text-xs text-muted-foreground italic">Notas: {r.notes}</p>}
          {/* quick status change */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Cambiar estado:</span>
            {Object.entries(STATUS_CFG).filter(([k])=>k!==r.status).map(([k,v])=>(
              <button key={k} onClick={()=>onStatusChange(r.id,k)}
                className={`text-[10px] px-2 py-0.5 rounded-full border hover:opacity-80 ${v.color}`}>{v.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NCCard ─────────────────────────────────────────────────────────────────
function NCCard({ nc, onClose }: { nc: NC; onClose:(id:number)=>void }) {
  const [open, setOpen] = useState(false);
  const sc = SEVERITY_CFG[nc.severity] ?? SEVERITY_CFG.minor;
  const ss = NC_STATUS_CFG[nc.status] ?? NC_STATUS_CFG.open;
  const isOverdue = isPast(nc.due_date) && !["closed","verified"].includes(nc.status);
  return (
    <div className={`rounded-lg border ${isOverdue?"border-red-400 bg-red-50/40":nc.severity==="critical"?"border-red-300":nc.severity==="major"?"border-orange-300":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${nc.severity==="critical"?"text-red-500":nc.severity==="major"?"text-orange-500":"text-amber-500"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{nc.code}</span>
              <span className="text-sm font-semibold">{nc.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ss.color}`}>{ss.label}</span>
              {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">Atrasada</span>}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              <span>{nc.regulation} {nc.article}</span>
              {nc.responsible && <span>👤 {nc.responsible}</span>}
              {nc.due_date && <span className={isOverdue?"text-red-600":""}>📅 {fmtDate(nc.due_date)}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          <p className="text-sm text-muted-foreground">{nc.description}</p>
          {nc.root_cause && <div><p className="text-xs font-semibold mb-0.5">Causa raíz:</p><p className="text-xs">{nc.root_cause}</p></div>}
          {nc.corrective_action && <div><p className="text-xs font-semibold mb-0.5">Acción correctiva:</p><p className="text-xs">{nc.corrective_action}</p></div>}
          {!["closed","verified"].includes(nc.status) && (
            <button onClick={()=>onClose(nc.id)} className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700">
              Marcar como cerrada
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requirements"|"ncs">("requirements");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const load = useCallback(async (s = filterStatus, c = filterCat) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (c) params.set("category", c);
    const r = await fetch(`/api/compliance?${params}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [filterStatus, filterCat]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: number, status: string) => {
    await fetch("/api/compliance", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, status, last_verified: new Date().toISOString().split("T")[0] }) });
    load();
  };
  const handleCloseNC = async (id: number) => {
    await fetch("/api/compliance", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, _table:"nc", status:"closed", completion_date: new Date().toISOString().split("T")[0] }) });
    load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="p-8 text-muted-foreground">Error.</p>;

  const { requirements, nonconformities, stats, nc_stats } = data;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-accent"/>Cumplimiento Normativo</h1>
        <p className="text-sm text-muted-foreground">NS-06.0 · DS 3/1985 · IAEA · DS 594/1999 — Estado de requisitos regulatorios</p>
      </div>

      {/* Alertas críticas */}
      {(nc_stats.critical_open > 0 || nc_stats.overdue > 0 || stats.review_overdue > 0) && (
        <div className="flex flex-col gap-2">
          {nc_stats.critical_open > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <XCircle className="h-4 w-4 text-red-600 shrink-0"/>
              <p className="text-sm text-red-700">{nc_stats.critical_open} no-conformidad(es) crítica(s) sin cerrar</p>
            </div>
          )}
          {nc_stats.overdue > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0"/>
              <p className="text-sm text-amber-700">{nc_stats.overdue} no-conformidad(es) vencida(s) sin cerrar</p>
            </div>
          )}
          {stats.review_overdue > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
              <Clock className="h-4 w-4 text-blue-600 shrink-0"/>
              <p className="text-sm text-blue-700">{stats.review_overdue} requisito(s) con revisión vencida</p>
            </div>
          )}
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="compliance"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Compliance pct */}
        <div className="sm:col-span-1 flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Cumplimiento</p>
          <p className={`text-4xl font-bold ${stats.compliance_pct>=90?"text-emerald-600":stats.compliance_pct>=70?"text-amber-600":"text-red-600"}`}>
            {stats.compliance_pct}%
          </p>
          <p className="text-xs text-muted-foreground">{stats.compliant} de {stats.total - stats.not_applicable} requisitos</p>
        </div>
        {/* Status breakdown */}
        {[
          { label:"Cumple",        value: stats.compliant,     color:"text-emerald-600" },
          { label:"Cumpl. parcial",value: stats.partial,       color: stats.partial>0?"text-amber-600":"" },
          { label:"No cumple",     value: stats.non_compliant, color: stats.non_compliant>0?"text-red-600":"" },
          { label:"NC abiertas",   value: nc_stats.open,       color: nc_stats.open>0?"text-orange-600":"" },
          { label:"NC atrasadas",  value: nc_stats.overdue,    color: nc_stats.overdue>0?"text-red-600":"" },
          { label:"Rev. vencidas", value: stats.review_overdue,color: stats.review_overdue>0?"text-blue-600":"" },
        ].map(k=>(
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([["requirements","Requisitos","FileText"],["ncs","No-conformidades","AlertTriangle"]] as const).map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===t?"border-accent text-accent":"border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
            <span className="rounded-full bg-muted px-1.5 text-[10px]">
              {t==="requirements" ? requirements.length : nonconformities.length}
            </span>
          </button>
        ))}
      </div>

      {/* Requirements */}
      {tab === "requirements" && (
        <>
          <div className="flex gap-2 flex-wrap">
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);load(e.target.value,filterCat);}}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <option value="">Todos los estados</option>
              <option value="compliant">Cumple</option>
              <option value="partial">Cumpl. parcial</option>
              <option value="non_compliant">No cumple</option>
              <option value="pending_review">Pend. revisión</option>
            </select>
            <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);load(filterStatus,e.target.value);}}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORY_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {/* Compliance bar */}
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Estado del Cumplimiento</span>
              <span className="font-medium">{stats.compliance_pct}%</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.compliant/Math.max(stats.total,1))*100}%` }} title={`Cumple: ${stats.compliant}`} />
              <div className="bg-amber-400 transition-all" style={{ width: `${(stats.partial/Math.max(stats.total,1))*100}%` }} title={`Parcial: ${stats.partial}`} />
              <div className="bg-red-500 transition-all" style={{ width: `${(stats.non_compliant/Math.max(stats.total,1))*100}%` }} title={`No cumple: ${stats.non_compliant}`} />
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-3 bg-emerald-500 rounded-sm inline-block"/>Cumple ({stats.compliant})</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 bg-amber-400 rounded-sm inline-block"/>Parcial ({stats.partial})</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 bg-red-500 rounded-sm inline-block"/>No cumple ({stats.non_compliant})</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {requirements.map(r=><RequirementRow key={r.id} r={r} onStatusChange={handleStatusChange}/>)}
          </div>
        </>
      )}

      {/* NCs */}
      {tab === "ncs" && (
        <div className="flex flex-col gap-2">
          {nonconformities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2"/>
              <p className="text-sm text-muted-foreground">Sin no-conformidades activas — ¡Excelente!</p>
            </div>
          ) : nonconformities.map(nc=><NCCard key={nc.id} nc={nc} onClose={handleCloseNC}/>)}
        </div>
      )}

      {/* Normativa */}
      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: CCHEN NS-06.0 — Protección Radiológica (última revisión) · DS 3/1985 · IAEA Safety Standards GSR Part 3 (2014) · DS 594/1999 (Ambientes Ocupacionales) · IAEA GS-R-3 (Gestión de la Seguridad)
      </div>
    </div>
  );
}
