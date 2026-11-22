"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Plus, Pencil, ClipboardCheck, CalendarClock, List
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface CapaRecord {
  id: number; capa_code: string; title: string; description?: string;
  capa_type: "corrective"|"preventive"|"improvement"|"observation";
  source: string; source_ref?: string;
  severity: "critical"|"major"|"minor"|"observation";
  status: "open"|"in_progress"|"pending_verification"|"closed"|"cancelled";
  responsible?: string; responsible_dept?: string;
  detected_date: string; due_date?: string; closed_date?: string;
  root_cause?: string; root_cause_category?: string;
  immediate_action?: string; corrective_action?: string; preventive_action?: string;
  effectiveness_criteria?: string; verification_date?: string; verified_by?: string;
  effectiveness_ok?: boolean; evidence?: string; notes?: string;
  cchen_notified?: boolean; overdue?: boolean;
  total_actions?: number; completed_actions?: number;
}
interface CapaAction {
  id: number; capa_id: number; action_type: string; description: string;
  responsible?: string; due_date?: string; completed_date?: string;
  status: "pending"|"in_progress"|"completed"|"cancelled"; evidence?: string;
}
interface Stats {
  total:number; open:number; in_progress:number; pending_verification:number;
  closed:number; corrective:number; preventive:number; critical:number; major:number;
  overdue:number; effective_closed:number; verified_total:number;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  major:    "bg-orange-100 text-orange-700 border-orange-300",
  minor:    "bg-amber-100 text-amber-700 border-amber-300",
  observation: "bg-sky-100 text-sky-700 border-sky-300",
};
const STATUS_COLOR: Record<string, string> = {
  open:                 "bg-red-100 text-red-700",
  in_progress:          "bg-amber-100 text-amber-700",
  pending_verification: "bg-purple-100 text-purple-700",
  closed:               "bg-emerald-100 text-emerald-700",
  cancelled:            "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Abierta", in_progress: "En Proceso",
  pending_verification: "Pendiente Verif.", closed: "Cerrada", cancelled: "Cancelada",
};
const TYPE_LABEL: Record<string, string> = {
  corrective: "Correctiva", preventive: "Preventiva",
  improvement: "Mejora", observation: "Observación",
};
const SOURCE_LABEL: Record<string, string> = {
  audit: "Auditoría", incident: "Incidente", inspection: "Inspección CCHEN",
  "self-detection": "Autodetección", measurement: "Medición", complaint: "Reclamación", other: "Otro",
};
const ROOT_CAT: Record<string, string> = {
  human: "Factor humano", process: "Proceso", equipment: "Equipo",
  environment: "Ambiente", management: "Gestión", other: "Otro",
};

function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", {day:"2-digit",month:"short",year:"numeric"});
}

function KpiTile({ label, value, sub, color="text-foreground" }: { label:string; value:number|string; sub?:string; color?:string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────
function CapaModal({ capa, onClose, onSaved }: {
  capa: CapaRecord | null; onClose: ()=>void; onSaved: ()=>void;
}) {
  const isEdit = !!capa;
  const [form, setForm] = useState<Record<string, string>>({
    title: capa?.title ?? "",
    capa_type: capa?.capa_type ?? "corrective",
    source: capa?.source ?? "audit",
    source_ref: capa?.source_ref ?? "",
    severity: capa?.severity ?? "minor",
    status: capa?.status ?? "open",
    responsible: capa?.responsible ?? "",
    responsible_dept: capa?.responsible_dept ?? "",
    detected_date: capa?.detected_date?.slice(0,10) ?? new Date().toISOString().slice(0,10),
    due_date: capa?.due_date?.slice(0,10) ?? "",
    closed_date: capa?.closed_date?.slice(0,10) ?? "",
    root_cause: capa?.root_cause ?? "",
    root_cause_category: capa?.root_cause_category ?? "",
    immediate_action: capa?.immediate_action ?? "",
    corrective_action: capa?.corrective_action ?? "",
    preventive_action: capa?.preventive_action ?? "",
    effectiveness_criteria: capa?.effectiveness_criteria ?? "",
    evidence: capa?.evidence ?? "",
    notes: capa?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f=>({...f,[k]:v}));

  async function save() {
    setSaving(true);
    const body = isEdit
      ? { id: capa!.id, ...form }
      : form;
    await fetch("/api/capa", {
      method: isEdit ? "PATCH" : "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold text-sm">{isEdit ? "Editar CAPA" : "Nueva CAPA"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3 text-sm flex-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <input value={form.title} onChange={e=>set("title",e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select value={form.capa_type} onChange={e=>set("capa_type",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm">
                <option value="corrective">Correctiva</option>
                <option value="preventive">Preventiva</option>
                <option value="improvement">Mejora</option>
                <option value="observation">Observación</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severidad</label>
              <select value={form.severity} onChange={e=>set("severity",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm">
                <option value="critical">Crítica</option>
                <option value="major">Mayor</option>
                <option value="minor">Menor</option>
                <option value="observation">Observación</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Origen</label>
              <select value={form.source} onChange={e=>set("source",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm">
                <option value="audit">Auditoría</option>
                <option value="incident">Incidente</option>
                <option value="inspection">Inspección CCHEN</option>
                <option value="self-detection">Autodetección</option>
                <option value="measurement">Medición</option>
                <option value="complaint">Reclamación</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Referencia origen</label>
              <input value={form.source_ref} onChange={e=>set("source_ref",e.target.value)}
                placeholder="AUD-2026-001" className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm">
                <option value="open">Abierta</option>
                <option value="in_progress">En Proceso</option>
                <option value="pending_verification">Pendiente Verificación</option>
                <option value="closed">Cerrada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Responsable</label>
              <input value={form.responsible} onChange={e=>set("responsible",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha detección</label>
              <input type="date" value={form.detected_date} onChange={e=>set("detected_date",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha límite</label>
              <input type="date" value={form.due_date} onChange={e=>set("due_date",e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Causa raíz</label>
            <textarea value={form.root_cause} onChange={e=>set("root_cause",e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm resize-none"/>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Acción inmediata</label>
            <textarea value={form.immediate_action} onChange={e=>set("immediate_action",e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm resize-none"/>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Acción correctiva</label>
            <textarea value={form.corrective_action} onChange={e=>set("corrective_action",e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm resize-none"/>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Acción preventiva</label>
            <textarea value={form.preventive_action} onChange={e=>set("preventive_action",e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm resize-none"/>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Criterios de efectividad</label>
            <textarea value={form.effectiveness_criteria} onChange={e=>set("effectiveness_criteria",e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm resize-none"/>
          </div>
          {form.status === "closed" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha cierre</label>
                <input type="date" value={form.closed_date} onChange={e=>set("closed_date",e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Evidencia de cierre</label>
                <input value={form.evidence} onChange={e=>set("evidence",e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm"/>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-border px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">Cancelar</button>
          <button onClick={save} disabled={saving || !form.title}
            className="rounded bg-accent text-accent-foreground px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando…" : isEdit ? "Actualizar" : "Crear CAPA"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
function CapaCard({ capa, onEdit, onStatusChange }: {
  capa: CapaRecord;
  onEdit: ()=>void;
  onStatusChange: (id:number, status:string)=>void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actions, setActions] = useState<CapaAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);

  async function loadActions() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (actions.length === 0) {
      setLoadingActions(true);
      const r = await fetch(`/api/capa?capa_id=${capa.id}`);
      const d = await r.json();
      setActions(d.actions ?? []);
      setLoadingActions(false);
    }
  }

  const pct = capa.total_actions ? Math.round((capa.completed_actions ?? 0) / capa.total_actions * 100) : 0;

  return (
    <div className={`rounded-lg border ${capa.overdue ? "border-red-300" : "border-border"} bg-surface`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{capa.capa_code}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${SEVERITY_COLOR[capa.severity]}`}>
                {capa.severity.toUpperCase()}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[capa.status]}`}>
                {STATUS_LABEL[capa.status]}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[10px] bg-muted text-muted-foreground">
                {TYPE_LABEL[capa.capa_type]}
              </span>
              {capa.overdue && (
                <span className="rounded-full px-2 py-0.5 text-[10px] bg-red-100 text-red-700 font-semibold">VENCIDA</span>
              )}
            </div>
            <p className="mt-1 font-medium text-sm leading-tight">{capa.title}</p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span>Origen: {SOURCE_LABEL[capa.source]}{capa.source_ref ? ` (${capa.source_ref})` : ""}</span>
              {capa.responsible && <span>Resp: {capa.responsible}</span>}
              {capa.due_date && <span className={capa.overdue ? "text-red-600 font-semibold" : ""}>
                Límite: {fmt(capa.due_date)}</span>}
            </div>
            {capa.total_actions && capa.total_actions > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{width:`${pct}%`}}/>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{capa.completed_actions}/{capa.total_actions} acciones</span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {capa.status !== "closed" && capa.status !== "cancelled" && (
              <button onClick={onEdit}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
                <Pencil className="h-3.5 w-3.5"/>
              </button>
            )}
            {capa.status === "in_progress" && (
              <button onClick={() => onStatusChange(capa.id, "pending_verification")}
                title="Marcar como pendiente verificación"
                className="rounded px-2 py-1 text-[10px] bg-purple-100 text-purple-700 hover:bg-purple-200">
                → Verificar
              </button>
            )}
            {capa.status === "pending_verification" && (
              <button onClick={() => onStatusChange(capa.id, "closed")}
                title="Cerrar CAPA"
                className="rounded px-2 py-1 text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                ✓ Cerrar
              </button>
            )}
            {capa.status === "open" && (
              <button onClick={() => onStatusChange(capa.id, "in_progress")}
                className="rounded px-2 py-1 text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-200">
                → Iniciar
              </button>
            )}
            <button onClick={loadActions} className="rounded p-1 text-muted-foreground hover:bg-muted">
              {expanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            {capa.root_cause && (
              <div><span className="font-semibold text-foreground">Causa raíz:</span>{" "}
                {capa.root_cause_category ? `[${ROOT_CAT[capa.root_cause_category]}] ` : ""}{capa.root_cause}
              </div>
            )}
            {capa.immediate_action && <div><span className="font-semibold text-foreground">Acción inmediata:</span> {capa.immediate_action}</div>}
            {capa.corrective_action && <div><span className="font-semibold text-foreground">Acción correctiva:</span> {capa.corrective_action}</div>}
            {capa.preventive_action && <div><span className="font-semibold text-foreground">Acción preventiva:</span> {capa.preventive_action}</div>}
            {capa.effectiveness_criteria && <div><span className="font-semibold text-foreground">Criterio efectividad:</span> {capa.effectiveness_criteria}</div>}
            {capa.closed_date && <div><span className="font-semibold text-foreground">Cierre:</span> {fmt(capa.closed_date)}
              {capa.effectiveness_ok !== undefined && (
                <span className={`ml-2 rounded px-1.5 py-0.5 ${capa.effectiveness_ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                  {capa.effectiveness_ok ? "Efectiva" : "No efectiva"}
                </span>
              )}
            </div>}
            {capa.evidence && <div><span className="font-semibold text-foreground">Evidencia:</span> {capa.evidence}</div>}
          </div>

          {loadingActions ? (
            <p className="text-xs text-muted-foreground">Cargando acciones…</p>
          ) : actions.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">TAREAS DE IMPLEMENTACIÓN</p>
              {actions.map(a => (
                <div key={a.id} className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                  a.status==="completed" ? "bg-emerald-50" : a.status==="cancelled" ? "bg-muted/50" : "bg-amber-50"}`}>
                  {a.status === "completed"
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5"/>
                    : <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5"/>}
                  <div className="flex-1">
                    <span className={a.status==="completed" ? "line-through text-muted-foreground" : ""}>{a.description}</span>
                    {a.responsible && <span className="text-muted-foreground"> — {a.responsible}</span>}
                    {a.due_date && <span className="text-muted-foreground"> · {fmt(a.due_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function CapaPage() {
  const [capas, setCapas]   = useState<CapaRecord[]>([]);
  const [stats, setStats]   = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<CapaRecord | null | "new">(null);
  const [filterType, setFilterType]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [tab, setTab]       = useState<"all"|"open"|"closed">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    if (filterSeverity) params.set("severity", filterSeverity);
    const r = await fetch(`/api/capa?${params}`);
    const d = await r.json();
    setCapas(d.capas ?? []);
    setStats(d.stats ?? {});
    setLoading(false);
  }, [filterType, filterStatus, filterSeverity]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: number, status: string) {
    const extra: Record<string,string> = {};
    if (status === "closed") extra.closed_date = new Date().toISOString().slice(0,10);
    await fetch("/api/capa", {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ id, status, ...extra }),
    });
    load();
  }

  const filtered = capas.filter(c => {
    if (tab === "open") return !["closed","cancelled"].includes(c.status);
    if (tab === "closed") return ["closed","cancelled"].includes(c.status);
    return true;
  });

  const effRate = stats.verified_total ? Math.round((stats.effective_closed ?? 0) / stats.verified_total * 100) : 0;

  return (
    <div className="flex flex-col gap-4 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-accent"/>No Conformidades y Acciones CAPA
          </h1>
          <p className="text-sm text-muted-foreground">Sistema de Acciones Correctivas y Preventivas PR — NS-06.0 §8.3</p>
        </div>
        <button onClick={() => setModal("new")}
          className="flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Nueva CAPA
        </button>
      </div>

      {/* Alertas */}
      {(stats.overdue ?? 0) > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0"/>
          <span className="text-red-700 font-medium">{stats.overdue} CAPA(s) vencidas — acción inmediata requerida</span>
        </div>
      )}
      {(stats.critical ?? 0) > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 flex items-center gap-2 text-sm">
          <XCircle className="h-4 w-4 text-orange-600 shrink-0"/>
          <span className="text-orange-700">{stats.critical} no conformidad(es) crítica(s) requieren seguimiento prioritario</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <KpiTile label="Total CAPA" value={stats.total ?? 0}/>
        <KpiTile label="Abiertas" value={stats.open ?? 0} color={(stats.open ?? 0) > 0 ? "text-red-600" : ""}/>
        <KpiTile label="En Proceso" value={stats.in_progress ?? 0} color={(stats.in_progress ?? 0) > 0 ? "text-amber-600" : ""}/>
        <KpiTile label="Pend. Verif." value={stats.pending_verification ?? 0} color={(stats.pending_verification ?? 0) > 0 ? "text-purple-600" : ""}/>
        <KpiTile label="Cerradas" value={stats.closed ?? 0} color="text-emerald-600"/>
        <KpiTile label="Correctivas" value={stats.corrective ?? 0}/>
        <KpiTile label="Preventivas" value={stats.preventive ?? 0}/>
        <KpiTile label="Críticas" value={stats.critical ?? 0} color={(stats.critical ?? 0) > 0 ? "text-red-600" : ""}/>
        <KpiTile label="Vencidas" value={stats.overdue ?? 0} color={(stats.overdue ?? 0) > 0 ? "text-red-600 font-bold" : ""}/>
        <KpiTile label="Tasa efectividad" value={`${effRate}%`}
          color={effRate >= 80 ? "text-emerald-600" : effRate >= 60 ? "text-amber-600" : "text-red-600"}
          sub={`${stats.effective_closed ?? 0}/${stats.verified_total ?? 0} verificadas`}/>
      </div>

      {/* Filtros + tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {(["all","open","closed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 ${tab===t ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
              {t==="all"?"Todas":t==="open"?"Abiertas":"Cerradas"}
              {t==="open" && (stats.open ?? 0) + (stats.in_progress ?? 0) + (stats.pending_verification ?? 0) > 0 &&
                <span className="ml-1 rounded-full bg-red-500 text-white px-1.5 text-[10px]">
                  {(stats.open ?? 0) + (stats.in_progress ?? 0) + (stats.pending_verification ?? 0)}
                </span>}
            </button>
          ))}
        </div>
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);}}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
          <option value="">Tipo: todos</option>
          <option value="corrective">Correctiva</option>
          <option value="preventive">Preventiva</option>
          <option value="improvement">Mejora</option>
          <option value="observation">Observación</option>
        </select>
        <select value={filterSeverity} onChange={e=>{setFilterSeverity(e.target.value);}}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
          <option value="">Severidad: todas</option>
          <option value="critical">Crítica</option>
          <option value="major">Mayor</option>
          <option value="minor">Menor</option>
        </select>
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);}}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
          <option value="">Estado: todos</option>
          <option value="open">Abierta</option>
          <option value="in_progress">En Proceso</option>
          <option value="pending_verification">Pendiente Verif.</option>
          <option value="closed">Cerrada</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} registro(s)</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <List className="h-8 w-8 mx-auto mb-2 opacity-30"/>
          No hay registros CAPA con los filtros actuales
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(c => (
            <CapaCard key={c.id} capa={c}
              onEdit={() => setModal(c)}
              onStatusChange={handleStatusChange}/>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
        <ClipboardCheck className="h-3 w-3 text-emerald-500"/>
        <p>CAPA — NS-06.0 §8.3 Mejora continua del Programa de Protección Radiológica · Hospital Dr. Hernán Henríquez Aravena</p>
      </div>

      {/* Modal */}
      {modal && (
        <CapaModal
          capa={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
