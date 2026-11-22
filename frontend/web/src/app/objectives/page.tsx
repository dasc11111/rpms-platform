"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  Target, Plus, ChevronDown, ChevronUp, CheckCircle2,
  AlertTriangle, XCircle, Clock, TrendingUp, TrendingDown,
  Minus, RefreshCw, Edit2, Trash2, ListChecks, BarChart2,
  Flag, Calendar, User
} from "lucide-react";

// §76 — Objetivos PR y Plan de Trabajo Anual
// NS-06.0 §8.1: Planificación del Programa de Protección Radiológica

interface WorkItem {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  responsible?: string;
  due_date?: string;
  quarter?: number;
  status: string;
  notes?: string;
}

interface Objective {
  id: number;
  year: number;
  obj_code: string;
  title: string;
  description?: string;
  category: string;
  responsible?: string;
  responsible_dept?: string;
  target_value?: number;
  target_unit?: string;
  target_direction?: string;
  q1_progress?: number;
  q2_progress?: number;
  q3_progress?: number;
  q4_progress?: number;
  q1_notes?: string;
  q2_notes?: string;
  q3_notes?: string;
  q4_notes?: string;
  current_value?: number;
  status: string;
  priority: string;
  ns_reference?: string;
  evidence?: string;
  work_items_total: number;
  work_items_done: number;
}

interface Stats {
  total: number;
  achieved: number;
  in_progress: number;
  planned: number;
  partial: number;
  not_achieved: number;
  critical: number;
  avg_progress: number;
}

const CATEGORIES: Record<string, string> = {
  dosimetry: "Dosimetría",
  training: "Capacitación",
  instruments: "Instrumentos",
  documents: "Documentos",
  safety: "Seguridad",
  audits: "Auditorías",
  committee: "Comité PR",
  alara: "ALARA",
  other: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificado",
  in_progress: "En Progreso",
  achieved: "Logrado",
  partial: "Parcial",
  not_achieved: "No Logrado",
  cancelled: "Cancelado",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "achieved") return <CheckCircle2 size={16} className="text-green-600" />;
  if (status === "in_progress") return <Clock size={16} className="text-blue-600" />;
  if (status === "partial") return <AlertTriangle size={16} className="text-yellow-600" />;
  if (status === "not_achieved") return <XCircle size={16} className="text-red-600" />;
  return <Minus size={16} className="text-gray-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planned: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    achieved: "bg-green-100 text-green-700",
    partial: "bg-yellow-100 text-yellow-700",
    not_achieved: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
      <StatusIcon status={status} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border border-red-300",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority] ?? "bg-gray-100"}`}>
      <Flag size={10} className="inline mr-1" />
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function ProgressBar({ value, status }: { value?: number; status: string }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color =
    status === "achieved" ? "bg-green-500" :
    status === "partial" ? "bg-yellow-500" :
    status === "not_achieved" ? "bg-red-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600 w-10 text-right">{pct}%</span>
    </div>
  );
}

function QuarterGrid({ obj }: { obj: Objective }) {
  const quarters = [
    { q: "Q1", p: obj.q1_progress, n: obj.q1_notes },
    { q: "Q2", p: obj.q2_progress, n: obj.q2_notes },
    { q: "Q3", p: obj.q3_progress, n: obj.q3_notes },
    { q: "Q4", p: obj.q4_progress, n: obj.q4_notes },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {quarters.map(({ q, p, n }) => (
        <div key={q} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
          <div className="text-xs font-semibold text-gray-500 mb-1">{q}</div>
          {p != null ? (
            <>
              <div className="text-lg font-bold text-gray-800">{p}%</div>
              {n && <div className="text-xs text-gray-500 mt-1 leading-tight">{n}</div>}
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">—</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ObjectiveCard({
  obj,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  obj: Objective;
  onEdit: (o: Objective) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const latestProgress =
    obj.q4_progress ?? obj.q3_progress ?? obj.q2_progress ?? obj.q1_progress;

  const loadWorkItems = useCallback(async () => {
    if (loadingItems) return;
    setLoadingItems(true);
    const r = await fetch(`/api/objectives?obj_id=${obj.id}`);
    const d = await r.json();
    setWorkItems(d.work_items ?? []);
    setLoadingItems(false);
  }, [obj.id, loadingItems]);

  const toggleExpand = () => {
    if (!expanded) loadWorkItems();
    setExpanded(!expanded);
  };

  const workPct = obj.work_items_total > 0
    ? Math.round((obj.work_items_done / obj.work_items_total) * 100)
    : 0;

  return (
    <div className={`bg-white rounded-xl border-l-4 shadow-sm transition-all ${
      obj.priority === "critical" ? "border-red-500" :
      obj.priority === "high" ? "border-orange-400" :
      obj.priority === "medium" ? "border-yellow-400" : "border-gray-300"
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{obj.obj_code}</span>
              <StatusBadge status={obj.status} />
              <PriorityBadge priority={obj.priority} />
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {CATEGORIES[obj.category] ?? obj.category}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 leading-snug mb-1">{obj.title}</h3>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
              {obj.responsible && (
                <span className="flex items-center gap-1">
                  <User size={11} />
                  {obj.responsible}
                </span>
              )}
              {obj.target_value != null && (
                <span className="flex items-center gap-1">
                  <Target size={11} />
                  Meta: {obj.target_value} {obj.target_unit}
                </span>
              )}
            </div>
            <ProgressBar value={latestProgress} status={obj.status} />
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button onClick={() => onEdit(obj)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 size={15} />
            </button>
            <button onClick={() => onDelete(obj.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={toggleExpand} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Quick status transitions */}
        {obj.status !== "achieved" && obj.status !== "not_achieved" && obj.status !== "cancelled" && (
          <div className="mt-2 flex gap-1">
            {obj.status !== "in_progress" && (
              <button
                onClick={() => onStatusChange(obj.id, "in_progress")}
                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
              >
                Iniciar
              </button>
            )}
            <button
              onClick={() => onStatusChange(obj.id, "achieved")}
              className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors"
            >
              ✓ Logrado
            </button>
            <button
              onClick={() => onStatusChange(obj.id, "partial")}
              className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 transition-colors"
            >
              Parcial
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {obj.description && (
            <p className="text-sm text-gray-600">{obj.description}</p>
          )}

          <QuarterGrid obj={obj} />

          {obj.work_items_total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actividades del Plan ({obj.work_items_done}/{obj.work_items_total})
                </span>
                <span className="text-xs text-gray-500">{workPct}%</span>
              </div>
              <ProgressBar value={workPct} status={workPct >= 100 ? "achieved" : "in_progress"} />
              {workItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {workItems.map(wi => (
                    <div key={wi.id} className="flex items-start gap-2 text-xs py-1">
                      <div className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                        wi.status === "completed" ? "bg-green-500" :
                        wi.status === "in_progress" ? "bg-blue-500" :
                        wi.status === "cancelled" ? "bg-gray-300" : "bg-gray-200"
                      }`} />
                      <div className="flex-1">
                        <span className={wi.status === "completed" ? "line-through text-gray-400" : "text-gray-700"}>
                          {wi.title}
                        </span>
                        {wi.due_date && (
                          <span className="ml-2 text-gray-400">
                            <Calendar size={10} className="inline" /> {new Date(wi.due_date).toLocaleDateString("es-CL")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {obj.evidence && (
            <div className="bg-green-50 rounded-lg p-2 text-xs text-green-800">
              <strong>Evidencia:</strong> {obj.evidence}
            </div>
          )}

          {obj.ns_reference && (
            <div className="text-xs text-gray-400 italic">
              Referencia normativa: {obj.ns_reference}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ObjectiveModal({
  obj,
  onClose,
  onSave,
}: {
  obj: Partial<Objective> | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<Record<string, string | number>>({
    title: obj?.title ?? "",
    description: obj?.description ?? "",
    category: obj?.category ?? "dosimetry",
    responsible: obj?.responsible ?? "",
    responsible_dept: obj?.responsible_dept ?? "",
    target_value: obj?.target_value ?? "",
    target_unit: obj?.target_unit ?? "",
    target_direction: obj?.target_direction ?? "higher_better",
    status: obj?.status ?? "planned",
    priority: obj?.priority ?? "medium",
    ns_reference: obj?.ns_reference ?? "",
    q1_progress: obj?.q1_progress ?? "",
    q2_progress: obj?.q2_progress ?? "",
    q3_progress: obj?.q3_progress ?? "",
    q4_progress: obj?.q4_progress ?? "",
    q1_notes: obj?.q1_notes ?? "",
    q2_notes: obj?.q2_notes ?? "",
    q3_notes: obj?.q3_notes ?? "",
    q4_notes: obj?.q4_notes ?? "",
    evidence: obj?.evidence ?? "",
    current_value: obj?.current_value ?? "",
  });

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form, year: new Date().getFullYear() };
    // Convert numeric fields
    ["target_value", "q1_progress", "q2_progress", "q3_progress", "q4_progress", "current_value"].forEach(k => {
      if (payload[k] === "" || payload[k] == null) delete payload[k];
      else payload[k] = Number(payload[k]);
    });

    if (obj?.id) {
      payload.id = obj.id;
      await fetch("/api/objectives", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/objectives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {obj?.id ? "Editar Objetivo" : "Nuevo Objetivo PR"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Título del Objetivo *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.title as string} onChange={e => set("title", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.description as string} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.category as string} onChange={e => set("category", e.target.value)}>
                {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prioridad</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.priority as string} onChange={e => set("priority", e.target.value)}>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Responsable</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.responsible as string} onChange={e => set("responsible", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.status as string} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Meta (valor)</label>
              <input type="number" step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.target_value as string} onChange={e => set("target_value", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unidad</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="mSv, %, N°…" value={form.target_unit as string} onChange={e => set("target_unit", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección meta</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.target_direction as string} onChange={e => set("target_direction", e.target.value)}>
                <option value="higher_better">Mayor es mejor</option>
                <option value="lower_better">Menor es mejor</option>
                <option value="achieve">Lograr</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Progreso por trimestre (%)</label>
            <div className="grid grid-cols-4 gap-2">
              {["q1", "q2", "q3", "q4"].map(q => (
                <div key={q}>
                  <label className="block text-xs text-gray-400 mb-1 text-center">{q.toUpperCase()}</label>
                  <input type="number" min="0" max="100" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form[`${q}_progress`] as string} onChange={e => set(`${q}_progress`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Referencia NS-06.0</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="NS-06.0 §8.1" value={form.ns_reference as string} onChange={e => set("ns_reference", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Evidencia de cumplimiento</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.evidence as string} onChange={e => set("evidence", e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              {obj?.id ? "Guardar Cambios" : "Crear Objetivo"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalObj, setModalObj] = useState<Partial<Objective> | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    const r = await fetch(`/api/objectives?${params}`);
    const d = await r.json();
    setObjectives(d.objectives ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, [year, categoryFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Cancelar este objetivo?")) return;
    await fetch("/api/objectives", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch("/api/objectives", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load();
  };

  const achievedPct = stats && stats.total > 0
    ? Math.round((stats.achieved / stats.total) * 100)
    : 0;

  const scoreColor =
    achievedPct >= 80 ? "text-green-600" :
    achievedPct >= 50 ? "text-yellow-600" : "text-red-600";

  const years = [year - 1, year, year + 1];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="text-blue-600" size={26} />
            Objetivos PR — Plan de Trabajo Anual
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">NS-06.0 §8.1 — Planificación del Programa de Protección Radiológica</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Actualizar">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setModalObj({})}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus size={16} />
            Nuevo Objetivo
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <BarChart2 size={12} /> Total Objetivos
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-400 mt-1">Año {year}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-600" /> Logrados
            </div>
            <div className={`text-3xl font-bold ${scoreColor}`}>{stats.achieved}</div>
            <div className="text-xs text-gray-400 mt-1">{achievedPct}% del total</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <Clock size={12} className="text-blue-600" /> En Progreso
            </div>
            <div className="text-3xl font-bold text-blue-600">{stats.in_progress}</div>
            <div className="text-xs text-gray-400 mt-1">{stats.partial} parciales</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <TrendingUp size={12} /> Avance Prom.
            </div>
            <div className="text-3xl font-bold text-purple-600">{stats.avg_progress ?? 0}%</div>
            <div className="text-xs text-gray-400 mt-1">{stats.critical} críticos</div>
          </div>
        </div>
      )}

      {/* Progress bar overall */}
      {stats && stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Cumplimiento Global del Plan Anual</span>
            <span className={`text-lg font-bold ${scoreColor}`}>{achievedPct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${achievedPct >= 80 ? "bg-green-500" : achievedPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${achievedPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>Meta: 100% de objetivos logrados al cierre del año</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(categoryFilter || statusFilter) && (
          <button onClick={() => { setCategoryFilter(""); setStatusFilter(""); }} className="text-xs text-gray-500 hover:text-red-600 px-2">
            × Limpiar filtros
          </button>
        )}
      </div>

      {/* Objectives list */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <RefreshCw size={28} className="animate-spin" />
        </div>
      ) : objectives.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ListChecks size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay objetivos para {year}</p>
          <p className="text-sm mt-1">Crea el primer objetivo del plan de trabajo anual</p>
        </div>
      ) : (
        <div className="space-y-3">
          {objectives.map(obj => (
            <ObjectiveCard
              key={obj.id}
              obj={obj}
              onEdit={o => setModalObj(o)}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
        NS-06.0 §8.1 — Planificación del Programa PR · Hospital Hernán Henríquez Aravena · CCHEN
      </div>

      {modalObj !== undefined && (
        <ObjectiveModal
          obj={modalObj}
          onClose={() => setModalObj(undefined)}
          onSave={load}
        />
      )}
    </div>
  );
}
