"use client";


import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardCheck, Clock, Edit3, ExternalLink, Loader2, Plus,
  RefreshCw, Shield, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Inspection {
  id: number;
  inspection_type: "cchen" | "internal" | "regional" | "minsal";
  inspection_date: string;
  inspector_name: string | null;
  inspector_org: string | null;
  areas_inspected: string | null;
  findings: string | null;
  observations: string | null;
  non_conformities: string | null;
  corrective_actions: string | null;
  follow_up_date: string | null;
  follow_up_done: boolean;
  result: "approved" | "conditional" | "failed" | "pending";
  report_ref: string | null;
  notes: string | null;
  created_at: string;
}

interface Stats {
  total: string; approved: string; conditional: string; failed: string; pending: string;
  cchen: string; internal: string; overdue_followup: string; this_year: string;
  last_inspection: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  cchen:    { label: "Fiscalización CCHEN",   bg: "bg-blue-100",   text: "text-blue-800"   },
  internal: { label: "Auditoría Interna",     bg: "bg-purple-100", text: "text-purple-800" },
  regional: { label: "Seremi Salud",          bg: "bg-teal-100",   text: "text-teal-800"   },
  minsal:   { label: "MINSAL",                bg: "bg-orange-100", text: "text-orange-800" },
} as const;

const RESULT_CFG = {
  approved:    { label: "Aprobado",     bg: "bg-green-100",  text: "text-green-800",  icon: CheckCircle2  },
  conditional: { label: "Condicional",  bg: "bg-amber-100",  text: "text-amber-800",  icon: AlertTriangle },
  failed:      { label: "No aprobado",  bg: "bg-red-100",    text: "text-red-800",    icon: AlertCircle   },
  pending:     { label: "Pendiente",    bg: "bg-muted",   text: "text-foreground/80",   icon: Clock         },
} as const;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function InspectionForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Inspection>;
  onSave: (data: Partial<Inspection>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Inspection>>({
    inspection_date: new Date().toISOString().slice(0, 10),
    inspection_type: "cchen",
    result: "pending",
    follow_up_done: false,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Inspection, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={async e => { e.preventDefault(); setSaving(true); try { await onSave(form); } finally { setSaving(false); } }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fecha de inspección *</label>
          <input type="date" required value={form.inspection_date?.slice(0, 10) ?? ""}
            onChange={e => set("inspection_date", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select value={form.inspection_type ?? "cchen"} onChange={e => set("inspection_type", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
            <option value="cchen">Fiscalización CCHEN</option>
            <option value="internal">Auditoría Interna</option>
            <option value="regional">Seremi de Salud</option>
            <option value="minsal">MINSAL</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Inspector/a</label>
          <input type="text" value={form.inspector_name ?? ""} onChange={e => set("inspector_name", e.target.value)}
            placeholder="Nombre del fiscalizador"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Organismo</label>
          <input type="text" value={form.inspector_org ?? ""} onChange={e => set("inspector_org", e.target.value)}
            placeholder="CCHEN, Seremi, etc."
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Áreas inspeccionadas</label>
          <input type="text" value={form.areas_inspected ?? ""} onChange={e => set("areas_inspected", e.target.value)}
            placeholder="Medicina Nuclear; Radiofísica; Almacén de fuentes..."
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Hallazgos positivos</label>
          <textarea rows={2} value={form.findings ?? ""} onChange={e => set("findings", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Observaciones / Requisitos</label>
          <textarea rows={2} value={form.observations ?? ""} onChange={e => set("observations", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">No conformidades</label>
          <textarea rows={2} value={form.non_conformities ?? ""} onChange={e => set("non_conformities", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Acciones correctivas propuestas</label>
          <textarea rows={2} value={form.corrective_actions ?? ""} onChange={e => set("corrective_actions", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fecha seguimiento</label>
          <input type="date" value={form.follow_up_date?.slice(0, 10) ?? ""}
            onChange={e => set("follow_up_date", e.target.value || null)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Resultado</label>
          <select value={form.result ?? "pending"} onChange={e => set("result", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="conditional">Condicional</option>
            <option value="failed">No aprobado</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">N° informe / referencia</label>
          <input type="text" value={form.report_ref ?? ""} onChange={e => set("report_ref", e.target.value)}
            placeholder="CCHEN-INS-2024-001"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" id="fu-done" checked={form.follow_up_done ?? false}
            onChange={e => set("follow_up_done", e.target.checked)} className="rounded" />
          <label htmlFor="fu-done" className="text-sm">Seguimiento completado</label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Observaciones adicionales</label>
          <textarea rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancelar</button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {initial?.id ? "Actualizar" : "Registrar inspección"}
        </button>
      </div>
    </form>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────
function InspCard({ ins, onEdit, onDelete }: { ins: Inspection; onEdit: (i: Inspection) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg = TYPE_CFG[ins.inspection_type] ?? TYPE_CFG.cchen;
  const resultCfg = RESULT_CFG[ins.result] ?? RESULT_CFG.pending;
  const ResultIcon = resultCfg.icon;

  const followupOverdue = ins.follow_up_date && !ins.follow_up_done &&
    new Date(ins.follow_up_date) < new Date();

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden",
      ins.result === "approved" ? "border-green-200" :
      ins.result === "failed"   ? "border-red-200"   :
      ins.result === "conditional" ? "border-amber-200" : "border-border"
    )}>
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(!expanded)}>
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{fmtDate(ins.inspection_date)}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded", typeCfg.bg, typeCfg.text)}>{typeCfg.label}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded flex items-center gap-1", resultCfg.bg, resultCfg.text)}>
              <ResultIcon className="w-3 h-3" /> {resultCfg.label}
            </span>
            {followupOverdue && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Seguimiento vencido
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {ins.inspector_name && <span>{ins.inspector_name}</span>}
            {ins.inspector_org && <span> · {ins.inspector_org}</span>}
            {ins.report_ref && <span> · Ref: {ins.report_ref}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(ins); }} className="p-1.5 hover:bg-muted rounded-lg">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); if (confirm("¿Eliminar inspección?")) onDelete(ins.id); }}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-sm bg-muted/20">
          {ins.areas_inspected && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">ÁREAS INSPECCIONADAS</div>
              <p className="text-xs">{ins.areas_inspected}</p>
            </div>
          )}
          {ins.findings && (
            <div>
              <div className="text-xs font-semibold text-green-700 mb-1">✓ HALLAZGOS POSITIVOS</div>
              <p className="text-xs whitespace-pre-wrap">{ins.findings}</p>
            </div>
          )}
          {ins.observations && (
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-1">⚠ OBSERVACIONES</div>
              <p className="text-xs whitespace-pre-wrap">{ins.observations}</p>
            </div>
          )}
          {ins.non_conformities && (
            <div>
              <div className="text-xs font-semibold text-red-700 mb-1">✗ NO CONFORMIDADES</div>
              <p className="text-xs whitespace-pre-wrap">{ins.non_conformities}</p>
            </div>
          )}
          {ins.corrective_actions && (
            <div>
              <div className="text-xs font-semibold text-blue-700 mb-1">→ ACCIONES CORRECTIVAS</div>
              <p className="text-xs whitespace-pre-wrap">{ins.corrective_actions}</p>
            </div>
          )}
          {ins.follow_up_date && (
            <div className={cn(
              "flex items-center gap-2 text-xs rounded-lg px-3 py-2",
              ins.follow_up_done ? "bg-green-50 text-green-700" :
              followupOverdue    ? "bg-red-50 text-red-700"      : "bg-amber-50 text-amber-700"
            )}>
              {ins.follow_up_done ? <CheckCircle2 className="w-4 h-4" /> :
               followupOverdue    ? <AlertCircle  className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              Seguimiento: {fmtDate(ins.follow_up_date)}
              {ins.follow_up_done ? " · Completado" : followupOverdue ? " · VENCIDO" : " · Pendiente"}
            </div>
          )}
          {ins.notes && <p className="text-xs text-muted-foreground italic">{ins.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterType, setFilterType] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Inspection | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear)   params.set("year",   filterYear);
      if (filterType)   params.set("type",   filterType);
      if (filterResult) params.set("result", filterResult);
      const res = await fetch(`/api/inspections?${params}`);
      const data = await res.json();
      setInspections(data.inspections ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterType, filterResult]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: Partial<Inspection>) => {
    await fetch("/api/inspections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setShowForm(false); fetchData();
  };
  const handleUpdate = async (data: Partial<Inspection>) => {
    if (!editTarget) return;
    await fetch("/api/inspections", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editTarget.id, ...data }) });
    setEditTarget(null); fetchData();
  };
  const handleDelete = async (id: number) => {
    await fetch(`/api/inspections?id=${id}`, { method: "DELETE" }); fetchData();
  };

  const overdueFollowups = parseInt(stats?.overdue_followup ?? "0");

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Inspecciones y Fiscalizaciones
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro de visitas CCHEN y auditorías internas · DS 3/1985
          </p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva inspección
        </button>
      </div>

      {/* KPI chips */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",         value: stats.total,       icon: ClipboardCheck, color: "text-blue-600" },
            { label: "Aprobadas",     value: stats.approved,    icon: CheckCircle2,   color: "text-green-600" },
            { label: "Condicionales", value: stats.conditional, icon: AlertTriangle,  color: "text-amber-600" },
            { label: "Seguim. venc.", value: stats.overdue_followup, icon: AlertCircle, color: overdueFollowups > 0 ? "text-red-600" : "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={cn("border rounded-xl p-3 flex items-center gap-3",
              label === "Seguim. venc." && overdueFollowups > 0 ? "border-red-200 bg-red-50/40" : "")}>
              <Icon className={cn("w-5 h-5 shrink-0", color)} />
              <div>
                <div className="text-lg font-bold leading-none">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overdue alert */}
      {overdueFollowups > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            <strong>{overdueFollowups}</strong> inspección{overdueFollowups > 1 ? "es tienen" : " tiene"} seguimiento vencido sin completar.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          <option value="cchen">CCHEN</option>
          <option value="internal">Auditoría Interna</option>
          <option value="regional">Seremi Salud</option>
          <option value="minsal">MINSAL</option>
        </select>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">Todos los resultados</option>
          <option value="approved">Aprobado</option>
          <option value="conditional">Condicional</option>
          <option value="failed">No aprobado</option>
          <option value="pending">Pendiente</option>
        </select>
        <button onClick={fetchData} className="p-2 border rounded-lg hover:bg-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Modal */}
      {(showForm || editTarget) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{editTarget ? "Editar inspección" : "Registrar inspección"}</h2>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <InspectionForm initial={editTarget ?? undefined}
                onSave={editTarget ? handleUpdate : handleCreate}
                onCancel={() => { setShowForm(false); setEditTarget(null); }} />
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando inspecciones…
        </div>
      ) : inspections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ClipboardCheck className="w-10 h-10 opacity-30" />
          <p className="text-sm">No hay inspecciones registradas con los filtros actuales.</p>
          <button onClick={() => setShowForm(true)} className="text-sm text-blue-600 hover:underline">
            Registrar primera inspección
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map(ins => (
            <InspCard key={ins.id} ins={ins}
              onEdit={i => { setEditTarget(i); setShowForm(false); }}
              onDelete={handleDelete} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center border-t pt-4">
        Registro de fiscalizaciones externas e internas · DS 3/1985 · NS-06.0 CCHEN
      </p>
    </div>
  );
}
