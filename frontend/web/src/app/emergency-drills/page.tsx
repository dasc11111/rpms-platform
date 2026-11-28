"use client";


import { useState, useEffect, useCallback } from "react";
import {
  Flame, ChevronDown, ChevronUp, Plus, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, Calendar, User,
  Users, Star, FileText, Shield, Trophy, XCircle
} from "lucide-react";

// §81 — Gestión de Simulacros de Emergencia Radiológica
// DS 3/1985 Art. 17 — NS-06.0 §9.1

interface Drill {
  id: number;
  drill_code: string;
  drill_date: string;
  drill_type: string;
  scenario: string;
  location: string;
  coordinator: string;
  participants: number;
  participants_list: string;
  observers: string;
  cchen_notified: boolean;
  duration_minutes: number;
  overall_score: number;
  overall_rating: string;
  objectives: string;
  achievements: string;
  deficiencies: string;
  corrective_actions: string;
  next_drill_date: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  notes: string;
  eval_criteria_count: number;
  eval_avg_score: number;
}

interface EvalCriterion {
  id: number;
  criterion: string;
  score: number;
  max_score: number;
  observations: string;
}

interface Stats {
  total: number;
  completed: number;
  planned: number;
  avg_score: number;
  last_drill_date: string;
  next_drill_date: string;
  below_acceptable: number;
  days_to_next: number;
}

const TYPE_LABELS: Record<string, string> = {
  full: "Simulacro Completo",
  partial: "Simulacro Parcial",
  tabletop: "Ejercicio de Escritorio",
  evacuation: "Evacuación",
  spill_response: "Respuesta a Derrame",
  equipment_failure: "Falla de Equipo",
  fire_radiation: "Incendio + Radiación",
};

const RATING_LABELS: Record<string, string> = {
  excellent: "Excelente", good: "Bueno", acceptable: "Aceptable",
  needs_improvement: "Necesita Mejora", failed: "Insuficiente"
};

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    excellent: "bg-emerald-100 text-emerald-800",
    good: "bg-green-100 text-green-800",
    acceptable: "bg-yellow-100 text-yellow-800",
    needs_improvement: "bg-orange-100 text-orange-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[rating] ?? "bg-muted text-foreground/80"}`}>
      {RATING_LABELS[rating] ?? rating}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    planned: { label: "Planificado", color: "bg-blue-100 text-blue-800" },
    in_progress: { label: "En Curso", color: "bg-yellow-100 text-yellow-800" },
    completed: { label: "Completado", color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, color: "bg-muted text-foreground/80" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = max === 0 ? 0 : Math.min(100, (score / max) * 100);
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-green-500" : pct >= 55 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-foreground/80 w-10 text-right">{score?.toFixed(1)}/{max}</span>
    </div>
  );
}

function EvalCriteriaPanel({ drillId }: { drillId: number }) {
  const [criteria, setCriteria] = useState<EvalCriterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/emergency-drills?drill_id=${drillId}`)
      .then(r => r.json())
      .then(d => { setCriteria(d.evaluations ?? []); setLoading(false); });
  }, [drillId]);

  if (loading) return <div className="text-xs text-muted-foreground">Cargando criterios…</div>;
  if (criteria.length === 0) return <div className="text-xs text-muted-foreground">Sin criterios de evaluación registrados.</div>;

  return (
    <div className="space-y-2">
      {criteria.map(c => (
        <div key={c.id} className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground/80 truncate">{c.criterion}</p>
            {c.observations && <p className="text-xs text-muted-foreground mt-0.5">{c.observations}</p>}
          </div>
          <div className="shrink-0 w-32">
            <ScoreBar score={c.score} max={c.max_score} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DrillCard({ drill, onUpdate }: { drill: Drill; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showEval, setShowEval] = useState(false);

  const borderColor = {
    completed: drill.overall_rating === "excellent" ? "border-emerald-500"
      : drill.overall_rating === "good" ? "border-green-500"
      : drill.overall_rating === "acceptable" ? "border-yellow-500"
      : "border-red-500",
    planned: "border-blue-400",
    in_progress: "border-yellow-500",
    cancelled: "border-border",
  }[drill.status] ?? "border-border";

  async function quickStatus(status: string, extra: Record<string, unknown> = {}) {
    await fetch("/api/emergency-drills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: drill.id, status, ...extra }),
    });
    onUpdate();
  }

  return (
    <div className={`border-l-4 ${borderColor} bg-background rounded-r-xl shadow p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{drill.drill_code}</span>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{TYPE_LABELS[drill.drill_type] ?? drill.drill_type}</span>
            <StatusBadge status={drill.status} />
            {drill.status === "completed" && drill.overall_rating && <RatingBadge rating={drill.overall_rating} />}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground leading-tight line-clamp-2">{drill.scenario}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar size={12} />{fmtDate(drill.drill_date)}</span>
            {drill.location && <span className="flex items-center gap-1"><Shield size={12} />{drill.location}</span>}
            {drill.coordinator && <span className="flex items-center gap-1"><User size={12} />{drill.coordinator}</span>}
            {drill.participants > 0 && <span className="flex items-center gap-1"><Users size={12} />{drill.participants} participantes</span>}
            {drill.duration_minutes && <span className="flex items-center gap-1"><Clock size={12} />{drill.duration_minutes} min</span>}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground/80">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Score row */}
      {drill.status === "completed" && drill.overall_score && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1">
            <Star size={13} className="text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground">Puntuación global</span>
            {drill.eval_criteria_count > 0 && (
              <button onClick={() => setShowEval(!showEval)} className="ml-auto text-xs text-blue-600 hover:underline">
                {showEval ? "Ocultar" : `Ver criterios (${drill.eval_criteria_count})`}
              </button>
            )}
          </div>
          <ScoreBar score={drill.overall_score} />
        </div>
      )}

      {showEval && drill.status === "completed" && (
        <div className="mt-3 bg-muted/50 rounded-lg p-3">
          <EvalCriteriaPanel drillId={drill.id} />
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {drill.status === "planned" && (
          <button onClick={() => quickStatus("in_progress")}
            className="text-xs bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">Iniciar Simulacro</button>
        )}
        {drill.status === "in_progress" && (
          <button onClick={() => quickStatus("completed", { overall_rating: "acceptable" })}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Completar</button>
        )}
        {drill.status === "planned" && (
          <button onClick={() => quickStatus("cancelled")}
            className="text-xs text-muted-foreground border px-3 py-1 rounded hover:bg-muted">Cancelar</button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 border-t pt-4 space-y-4">
          {drill.participants_list && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Participantes</h4>
              <p className="text-xs text-muted-foreground">{drill.participants_list}</p>
            </div>
          )}
          {drill.observers && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Observadores</h4>
              <p className="text-xs text-muted-foreground">{drill.observers}</p>
            </div>
          )}
          {drill.objectives && (
            <div>
              <h4 className="text-xs font-semibold text-foreground/80 mb-1 flex items-center gap-1"><FileText size={13} />Objetivos</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{drill.objectives}</p>
            </div>
          )}
          {drill.achievements && (
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1"><Trophy size={13} />Logros</h4>
              <p className="text-xs text-foreground/80 whitespace-pre-line">{drill.achievements}</p>
            </div>
          )}
          {drill.deficiencies && (
            <div className="bg-orange-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-orange-800 mb-1 flex items-center gap-1"><AlertTriangle size={13} />Deficiencias</h4>
              <p className="text-xs text-foreground/80 whitespace-pre-line">{drill.deficiencies}</p>
            </div>
          )}
          {drill.corrective_actions && (
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1"><CheckCircle2 size={13} />Acciones Correctivas</h4>
              <p className="text-xs text-foreground/80 whitespace-pre-line">{drill.corrective_actions}</p>
            </div>
          )}
          {drill.next_drill_date && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={12} />Próximo simulacro estimado: {fmtDate(drill.next_drill_date)}
            </div>
          )}
          {drill.notes && <div className="text-xs text-muted-foreground">{drill.notes}</div>}
        </div>
      )}
    </div>
  );
}

function DrillModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    drill_date: new Date().toISOString().slice(0, 10),
    drill_type: "full",
    scenario: "",
    location: "",
    coordinator: "TM. Diego Solís C.",
    participants: "",
    objectives: "",
    next_drill_date: "",
    notes: "",
    status: "planned",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/emergency-drills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  const F = (label: string, key: keyof typeof form, type: string = "text", options?: Record<string, string>) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {options ? (
        <select value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="mt-1 w-full border rounded px-2 py-1.5 text-sm">
          {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          rows={3} className="mt-1 w-full border rounded px-2 py-1.5 text-sm resize-none" />
      ) : (
        <input type={type} value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="mt-1 w-full border rounded px-2 py-1.5 text-sm" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-foreground">Registrar Simulacro de Emergencia</h2>
          <p className="text-xs text-muted-foreground mt-1">DS 3/1985 Art. 17 — NS-06.0 §9.1</p>
        </div>
        <div className="p-6 space-y-4">
          {F("Tipo de simulacro", "drill_type", "select", TYPE_LABELS)}
          {F("Estado inicial", "status", "select", { planned: "Planificado", in_progress: "En Curso", completed: "Completado" })}
          <div className="grid grid-cols-2 gap-4">
            {F("Fecha", "drill_date", "date")}
            {F("Próximo simulacro (estimado)", "next_drill_date", "date")}
          </div>
          {F("Descripción del escenario *", "scenario", "textarea")}
          {F("Lugar", "location")}
          {F("Coordinador", "coordinator")}
          {F("N° participantes", "participants", "number")}
          {F("Objetivos", "objectives", "textarea")}
          {F("Observaciones", "notes", "textarea")}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">Cancelar</button>
          <button onClick={save} disabled={saving || !form.scenario}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar Simulacro"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmergencyDrillsPage() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("type", filterType);
    const r = await fetch(`/api/emergency-drills?${params}`);
    const d = await r.json();
    setDrills(d.drills ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, [filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const daysToNext = stats?.days_to_next;
  const isOverdue = typeof daysToNext === "number" && daysToNext < 0;
  const isUpcoming = typeof daysToNext === "number" && daysToNext >= 0 && daysToNext <= 60;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="text-orange-500" size={28} />
            Simulacros de Emergencia Radiológica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">DS 3/1985 Art. 17 · NS-06.0 §9.1 — Plan de Respuesta a Emergencias</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-2">
            <Plus size={16} />Nuevo Simulacro
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {isOverdue && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <XCircle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-red-800">Simulacro anual vencido</p>
            <p className="text-xs text-red-700 mt-0.5">
              La fecha del próximo simulacro programado está vencida hace {Math.abs(daysToNext!)} días. NS-06.0 §9.1 exige al menos un simulacro anual.
            </p>
          </div>
        </div>
      )}
      {isUpcoming && !isOverdue && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <AlertTriangle className="text-yellow-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Simulacro próximo en {daysToNext} días</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Próximo simulacro programado para {fmtDate(stats?.next_drill_date ?? "")}. Coordine con los servicios involucrados.
            </p>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Simulacros", value: stats.total, sub: `${stats.completed} completados`, color: "text-orange-600", icon: <Flame size={18} /> },
            { label: "Puntaje Promedio", value: stats.avg_score ? `${stats.avg_score}/10` : "—", sub: "Global histórico", color: "text-yellow-600", icon: <Star size={18} /> },
            { label: "Último Simulacro", value: fmtDate(stats.last_drill_date), sub: "Fecha de ejecución", color: "text-blue-600", icon: <Calendar size={18} /> },
            { label: "Próximo Simulacro", value: fmtDate(stats.next_drill_date), sub: typeof daysToNext === "number" ? (daysToNext < 0 ? `Vencido hace ${Math.abs(daysToNext)}d` : `En ${daysToNext} días`) : "", color: isOverdue ? "text-red-600" : "text-green-600", icon: <Clock size={18} /> },
          ].map((tile, i) => (
            <div key={i} className="bg-background rounded-xl shadow p-4">
              <div className={`flex items-center gap-2 ${tile.color}`}>
                {tile.icon}
                <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
              </div>
              <div className={`text-lg font-bold mt-2 ${tile.color}`}>{tile.value ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">{tile.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          <option value="planned">Planificado</option>
          <option value="in_progress">En Curso</option>
          <option value="completed">Completado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando simulacros…</div>
      ) : drills.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flame size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay simulacros registrados</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-600 hover:underline text-sm">
            Registrar primer simulacro
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {drills.map(d => <DrillCard key={d.id} drill={d} onUpdate={load} />)}
        </div>
      )}

      {showModal && <DrillModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
