"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, Bell, BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  Clock, FileText, Flame, Pencil, Phone, Plus, Shield, ShieldAlert,
  Trash2, Users, X, Zap, type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmergencyPlan {
  id: number;
  plan_code: string;
  title: string;
  category: string;
  ines_level: number;
  description: string | null;
  trigger_criteria: string | null;
  immediate_actions: string | null;
  notification_chain: string | null;
  evacuation_zones: string | null;
  equipment_required: string | null;
  responsible_officer: string | null;
  backup_officer: string | null;
  cchen_notification: boolean;
  minsal_notification: boolean;
  last_drill_date: string | null;
  next_drill_date: string | null;
  drill_frequency_months: number;
  status: string;
  notes: string | null;
  contacts_count: number;
  drills_count: number;
  last_drill_actual: string | null;
}

interface EmergencyDrill {
  id: number;
  plan_id: number | null;
  plan_title: string | null;
  plan_code: string | null;
  drill_date: string;
  drill_type: string;
  scenario: string;
  participants: number | null;
  duration_min: number | null;
  coordinator: string | null;
  outcome: string;
  findings: string | null;
  corrective_actions: string | null;
  next_drill_date: string | null;
}

interface Stats {
  total_plans: number;
  active_plans: number;
  overdue_drills: number;
  upcoming_drills: number;
  drills_last_year: number;
}

// ─── INES Scale config ────────────────────────────────────────────────────────

const INES: Record<number, { label: string; color: string; bg: string; text: string; icon: ComponentType<LucideProps> }> = {
  0: { label: "0 — Desviación (sin importancia)", color: "text-gray-500",  bg: "bg-gray-100",  text: "text-gray-700",  icon: Shield },
  1: { label: "1 — Anomalía",                      color: "text-blue-500",  bg: "bg-blue-50",   text: "text-blue-700",  icon: Bell },
  2: { label: "2 — Incidente",                     color: "text-yellow-500",bg: "bg-yellow-50", text: "text-yellow-700",icon: AlertTriangle },
  3: { label: "3 — Incidente grave",               color: "text-orange-500",bg: "bg-orange-50", text: "text-orange-700",icon: AlertTriangle },
  4: { label: "4 — Accidente (consecuencias locales)",color:"text-red-400", bg: "bg-red-50",    text: "text-red-700",   icon: Flame },
  5: { label: "5 — Accidente (consecuencias amplias)",color:"text-red-500", bg: "bg-red-100",   text: "text-red-800",   icon: Flame },
  6: { label: "6 — Accidente grave",               color: "text-red-600",  bg: "bg-red-200",   text: "text-red-900",   icon: ShieldAlert },
  7: { label: "7 — Accidente mayor",               color: "text-purple-700",bg:"bg-purple-100", text: "text-purple-900",icon: ShieldAlert },
};

const CATEGORIES = ["radiologica", "nuclear", "contaminacion", "perdida_fuente", "incendio", "derrame"];
const CATEGORY_LABELS: Record<string, string> = {
  radiologica: "Radiológica", nuclear: "Nuclear", contaminacion: "Contaminación",
  perdida_fuente: "Pérdida de fuente", incendio: "Incendio / Explosión", derrame: "Derrame",
};

const OUTCOMES = ["exitoso", "parcial", "fallido"];
const OUTCOME_LABELS: Record<string, string> = { exitoso: "Exitoso", parcial: "Parcial", fallido: "Fallido" };
const OUTCOME_COLORS: Record<string, string> = {
  exitoso: "bg-green-100 text-green-800 border-green-300",
  parcial: "bg-yellow-100 text-yellow-800 border-yellow-300",
  fallido: "bg-red-100 text-red-800 border-red-300",
};

const DRILL_TYPES = ["simulacro", "ejercicio_mesa", "prueba_notificacion", "evacuacion", "respuesta_real"];
const DRILL_TYPE_LABELS: Record<string, string> = {
  simulacro: "Simulacro completo", ejercicio_mesa: "Ejercicio de mesa",
  prueba_notificacion: "Prueba de notificación", evacuacion: "Evacuación",
  respuesta_real: "Respuesta real",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CL");
}

function DrillStatus({ plan }: { plan: EmergencyPlan }) {
  const days = daysUntil(plan.next_drill_date);
  if (days === null) return <span className="text-muted-foreground text-xs">Sin programar</span>;
  if (days < 0)  return <span className="text-xs font-medium text-red-600">Vencido hace {-days}d</span>;
  if (days <= 30) return <span className="text-xs font-medium text-orange-500">En {days}d</span>;
  if (days <= 90) return <span className="text-xs font-medium text-yellow-600">En {days}d</span>;
  return <span className="text-xs text-muted-foreground">En {days}d</span>;
}

// ─── Default form values ──────────────────────────────────────────────────────

const PLAN_DEFAULT = {
  plan_code: "", title: "", category: "radiologica", ines_level: 0,
  description: "", trigger_criteria: "", immediate_actions: "", notification_chain: "",
  evacuation_zones: "", equipment_required: "", responsible_officer: "", backup_officer: "",
  cchen_notification: false, minsal_notification: false,
  last_drill_date: "", next_drill_date: "", drill_frequency_months: 12,
  status: "vigente", notes: "",
};

const DRILL_DEFAULT = {
  plan_id: "", drill_date: "", drill_type: "simulacro", scenario: "",
  participants: "", duration_min: "", coordinator: "", outcome: "exitoso",
  findings: "", corrective_actions: "", next_drill_date: "",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "blue" }: { label: string; value: number | string; sub?: string; color?: "blue" | "green" | "red" | "yellow" | "gray" }) {
  const C: Record<string, string> = {
    blue:   "bg-blue-50   border-blue-200   text-blue-700",
    green:  "bg-green-50  border-green-200  text-green-700",
    red:    "bg-red-50    border-red-200    text-red-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    gray:   "bg-muted     border-border     text-foreground",
  };
  return (
    <div className={`rounded-lg border p-4 ${C[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabKey = "plans" | "drills";

export default function EmergencyPage() {
  const [tab, setTab] = useState<TabKey>("plans");
  const [plans, setPlans] = useState<EmergencyPlan[]>([]);
  const [drills, setDrills] = useState<EmergencyDrill[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Plan modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EmergencyPlan | null>(null);
  const [planForm, setPlanForm] = useState({ ...PLAN_DEFAULT });
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<number | null>(null);

  // Drill modal
  const [showDrillModal, setShowDrillModal] = useState(false);
  const [editingDrill, setEditingDrill] = useState<EmergencyDrill | null>(null);
  const [drillForm, setDrillForm] = useState({ ...DRILL_DEFAULT });
  const [savingDrill, setSavingDrill] = useState(false);
  const [deletingDrill, setDeletingDrill] = useState<number | null>(null);

  // Expanded plan detail
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, drillRes] = await Promise.all([
        fetch("/api/emergency"),
        fetch("/api/emergency?resource=drills"),
      ]);
      const [pd, dd] = await Promise.all([planRes.json(), drillRes.json()]);
      setPlans(pd.plans ?? []);
      setStats(pd.stats ?? null);
      setDrills(dd.drills ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Plan handlers ─────────────────────────────────────────────────────────

  const openNewPlan = () => { setEditingPlan(null); setPlanForm({ ...PLAN_DEFAULT }); setShowPlanModal(true); };
  const openEditPlan = (p: EmergencyPlan) => {
    setEditingPlan(p);
    setPlanForm({
      plan_code: p.plan_code, title: p.title, category: p.category,
      ines_level: p.ines_level, description: p.description ?? "",
      trigger_criteria: p.trigger_criteria ?? "",
      immediate_actions: p.immediate_actions ?? "",
      notification_chain: p.notification_chain ?? "",
      evacuation_zones: p.evacuation_zones ?? "",
      equipment_required: p.equipment_required ?? "",
      responsible_officer: p.responsible_officer ?? "",
      backup_officer: p.backup_officer ?? "",
      cchen_notification: p.cchen_notification,
      minsal_notification: p.minsal_notification,
      last_drill_date: p.last_drill_date ? p.last_drill_date.slice(0, 10) : "",
      next_drill_date: p.next_drill_date ? p.next_drill_date.slice(0, 10) : "",
      drill_frequency_months: p.drill_frequency_months,
      status: p.status, notes: p.notes ?? "",
    });
    setShowPlanModal(true);
  };
  const closePlanModal = () => { setShowPlanModal(false); setEditingPlan(null); };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    const payload = {
      ...planForm,
      ines_level: Number(planForm.ines_level),
      drill_frequency_months: Number(planForm.drill_frequency_months),
      last_drill_date: planForm.last_drill_date || null,
      next_drill_date: planForm.next_drill_date || null,
      description: planForm.description || null,
      trigger_criteria: planForm.trigger_criteria || null,
      immediate_actions: planForm.immediate_actions || null,
      notification_chain: planForm.notification_chain || null,
      evacuation_zones: planForm.evacuation_zones || null,
      equipment_required: planForm.equipment_required || null,
      responsible_officer: planForm.responsible_officer || null,
      backup_officer: planForm.backup_officer || null,
      notes: planForm.notes || null,
    };
    try {
      if (editingPlan) {
        await fetch(`/api/emergency?id=${editingPlan.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/emergency", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      closePlanModal();
      fetchData();
    } finally { setSavingPlan(false); }
  };

  const handleDeletePlan = async (id: number) => {
    if (!confirm("¿Eliminar este plan de contingencia?")) return;
    setDeletingPlan(id);
    try {
      await fetch(`/api/emergency?id=${id}`, { method: "DELETE" });
      fetchData();
    } finally { setDeletingPlan(null); }
  };

  // ─── Drill handlers ────────────────────────────────────────────────────────

  const openNewDrill = () => { setEditingDrill(null); setDrillForm({ ...DRILL_DEFAULT }); setShowDrillModal(true); };
  const openEditDrill = (d: EmergencyDrill) => {
    setEditingDrill(d);
    setDrillForm({
      plan_id: d.plan_id != null ? String(d.plan_id) : "",
      drill_date: d.drill_date ? d.drill_date.slice(0, 10) : "",
      drill_type: d.drill_type,
      scenario: d.scenario,
      participants: d.participants != null ? String(d.participants) : "",
      duration_min: d.duration_min != null ? String(d.duration_min) : "",
      coordinator: d.coordinator ?? "",
      outcome: d.outcome,
      findings: d.findings ?? "",
      corrective_actions: d.corrective_actions ?? "",
      next_drill_date: d.next_drill_date ? d.next_drill_date.slice(0, 10) : "",
    });
    setShowDrillModal(true);
  };
  const closeDrillModal = () => { setShowDrillModal(false); setEditingDrill(null); };

  const handleSaveDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDrill(true);
    const payload = {
      ...drillForm,
      plan_id: drillForm.plan_id ? parseInt(drillForm.plan_id) : null,
      participants: drillForm.participants ? parseInt(drillForm.participants) : null,
      duration_min: drillForm.duration_min ? parseInt(drillForm.duration_min) : null,
      coordinator: drillForm.coordinator || null,
      findings: drillForm.findings || null,
      corrective_actions: drillForm.corrective_actions || null,
      next_drill_date: drillForm.next_drill_date || null,
    };
    try {
      if (editingDrill) {
        await fetch(`/api/emergency?resource=drill&id=${editingDrill.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/emergency?resource=drill", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      closeDrillModal();
      fetchData();
    } finally { setSavingDrill(false); }
  };

  const handleDeleteDrill = async (id: number) => {
    if (!confirm("¿Eliminar este registro de simulacro?")) return;
    setDeletingDrill(id);
    try {
      await fetch(`/api/emergency?resource=drill&id=${id}`, { method: "DELETE" });
      fetchData();
    } finally { setDeletingDrill(null); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-sm">
      Cargando plan de contingencia…
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-500" />
            Plan de Contingencia y Respuesta a Emergencias
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            DS 3/1985 MINSAL Art. 36 · NS-06.0 CCHEN § Gestión de Emergencias · Escala INES (OIEA)
          </p>
        </div>
        <button
          onClick={tab === "plans" ? openNewPlan : openNewDrill}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          {tab === "plans" ? "Nuevo plan" : "Registrar simulacro"}
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Planes activos"       value={stats.active_plans}    color="blue" />
          <KPI label="Total planes"         value={stats.total_plans}     color="gray" />
          <KPI label="Simulacros vencidos"  value={stats.overdue_drills}  color={stats.overdue_drills > 0 ? "red" : "green"} />
          <KPI label="Próximos 90d"         value={stats.upcoming_drills} color="yellow" />
          <KPI label="Simulacros (12m)"     value={stats.drills_last_year}color="green" />
        </div>
      )}

      {/* INES quick reference */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Escala INES (OIEA) — Referencia rápida</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[0,1,2,3,4,5,6,7].map(n => {
            const cfg = INES[n];
            const Icon = cfg.icon;
            return (
              <div key={n} className={`flex items-center gap-2 rounded px-2 py-1.5 border text-xs ${cfg.bg} ${cfg.text}`}>
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color}`} />
                <span>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["plans", "drills"] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === t ? "border-red-500 text-red-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "plans" ? `Planes (${plans.length})` : `Simulacros (${drills.length})`}
          </button>
        ))}
      </div>

      {/* ── Plans tab ──────────────────────────────────────────────────────── */}
      {tab === "plans" && (
        <div className="space-y-3">
          {plans.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No hay planes de contingencia registrados.
            </div>
          )}
          {plans.map(p => {
            const ines = INES[p.ines_level] ?? INES[0];
            const InesIcon = ines.icon;
            const isExpanded = expandedPlan === p.id;
            const drillDays = daysUntil(p.next_drill_date);
            const drillOverdue = drillDays !== null && drillDays < 0;

            return (
              <div key={p.id} className={cn("rounded-lg border bg-card overflow-hidden", drillOverdue && "border-red-300")}>
                {/* Plan header row */}
                <div className="flex items-center gap-3 p-4">
                  <div className={`rounded-lg p-2 flex-shrink-0 ${ines.bg}`}>
                    <InesIcon className={`w-5 h-5 ${ines.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{p.plan_code}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${ines.bg} ${ines.text}`}>
                        INES {p.ines_level}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </span>
                      {p.status !== "vigente" && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.status}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm mt-0.5">{p.title}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {p.responsible_officer && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.responsible_officer}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Próx. simulacro: <DrillStatus plan={p} />
                      </span>
                      <span>{p.contacts_count} contactos · {p.drills_count} simulacros</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.cchen_notification && (
                      <span title="Notifica CCHEN" className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">CCHEN</span>
                    )}
                    {p.minsal_notification && (
                      <span title="Notifica MINSAL" className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">MINSAL</span>
                    )}
                    <button onClick={() => setExpandedPlan(isExpanded ? null : p.id)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEditPlan(p)} className="p-1 text-muted-foreground hover:text-blue-600 rounded">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePlan(p.id)} disabled={deletingPlan === p.id}
                      className="p-1 text-muted-foreground hover:text-red-600 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {p.trigger_criteria && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Criterios de activación</p>
                        <p className="text-sm whitespace-pre-wrap">{p.trigger_criteria}</p>
                      </div>
                    )}
                    {p.immediate_actions && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Acciones inmediatas</p>
                        <p className="text-sm whitespace-pre-wrap">{p.immediate_actions}</p>
                      </div>
                    )}
                    {p.notification_chain && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Cadena de notificación
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{p.notification_chain}</p>
                      </div>
                    )}
                    {p.evacuation_zones && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Zonas de evacuación</p>
                        <p className="text-sm whitespace-pre-wrap">{p.evacuation_zones}</p>
                      </div>
                    )}
                    {p.equipment_required && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Equipamiento requerido</p>
                        <p className="text-sm whitespace-pre-wrap">{p.equipment_required}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Simulacros</p>
                      <p className="text-sm">Frecuencia: {p.drill_frequency_months} meses</p>
                      <p className="text-sm">Último: {formatDate(p.last_drill_actual || p.last_drill_date)}</p>
                      <p className="text-sm">Próximo: {formatDate(p.next_drill_date)}</p>
                    </div>
                    {p.backup_officer && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Responsable suplente</p>
                        <p className="text-sm">{p.backup_officer}</p>
                      </div>
                    )}
                    {p.notes && (
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</p>
                        <p className="text-sm">{p.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drills tab ─────────────────────────────────────────────────────── */}
      {tab === "drills" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {drills.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No hay simulacros registrados.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Plan</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Escenario</th>
                  <th className="text-left p-3">Coord.</th>
                  <th className="text-center p-3">Partic.</th>
                  <th className="text-center p-3">Min</th>
                  <th className="text-left p-3">Resultado</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drills.map(d => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">{formatDate(d.drill_date)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{d.plan_code ?? "—"}</td>
                    <td className="p-3 text-xs">{DRILL_TYPE_LABELS[d.drill_type] ?? d.drill_type}</td>
                    <td className="p-3 max-w-xs truncate">{d.scenario}</td>
                    <td className="p-3 text-xs text-muted-foreground">{d.coordinator ?? "—"}</td>
                    <td className="p-3 text-center">{d.participants ?? "—"}</td>
                    <td className="p-3 text-center">{d.duration_min ?? "—"}</td>
                    <td className="p-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${OUTCOME_COLORS[d.outcome] ?? ""}`}>
                        {OUTCOME_LABELS[d.outcome] ?? d.outcome}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEditDrill(d)} className="p-1 text-muted-foreground hover:text-blue-600 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteDrill(d.id)} disabled={deletingDrill === d.id}
                          className="p-1 text-muted-foreground hover:text-red-600 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Plan Modal ─────────────────────────────────────────────────────── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-sm">
                {editingPlan ? "Editar plan de contingencia" : "Nuevo plan de contingencia"}
              </h2>
              <button onClick={closePlanModal} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePlan} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Código *</label>
                  <input required value={planForm.plan_code}
                    onChange={e => setPlanForm(f => ({ ...f, plan_code: e.target.value }))}
                    placeholder="PC-RAD-01" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Título *</label>
                  <input required value={planForm.title}
                    onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Plan de contingencia para..." className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Categoría</label>
                  <select value={planForm.category}
                    onChange={e => setPlanForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Nivel INES (0–7)</label>
                  <select value={planForm.ines_level}
                    onChange={e => setPlanForm(f => ({ ...f, ines_level: parseInt(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>INES {n} — {INES[n].label.split("—")[1]?.trim()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Estado</label>
                  <select value={planForm.status}
                    onChange={e => setPlanForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="vigente">Vigente</option>
                    <option value="revision">En revisión</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Descripción</label>
                <textarea value={planForm.description} rows={2}
                  onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Criterios de activación</label>
                <textarea value={planForm.trigger_criteria} rows={2}
                  onChange={e => setPlanForm(f => ({ ...f, trigger_criteria: e.target.value }))}
                  placeholder="¿Cuándo se activa este plan?" className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Acciones inmediatas</label>
                <textarea value={planForm.immediate_actions} rows={3}
                  onChange={e => setPlanForm(f => ({ ...f, immediate_actions: e.target.value }))}
                  placeholder="1. Evacuar el área&#10;2. Notificar al jefe de guardia&#10;…" className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Cadena de notificación</label>
                  <textarea value={planForm.notification_chain} rows={2}
                    onChange={e => setPlanForm(f => ({ ...f, notification_chain: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Zonas de evacuación</label>
                  <textarea value={planForm.evacuation_zones} rows={2}
                    onChange={e => setPlanForm(f => ({ ...f, evacuation_zones: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Equipamiento requerido</label>
                  <textarea value={planForm.equipment_required} rows={2}
                    onChange={e => setPlanForm(f => ({ ...f, equipment_required: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Responsable principal</label>
                    <input value={planForm.responsible_officer}
                      onChange={e => setPlanForm(f => ({ ...f, responsible_officer: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Responsable suplente</label>
                    <input value={planForm.backup_officer}
                      onChange={e => setPlanForm(f => ({ ...f, backup_officer: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Último simulacro</label>
                  <input type="date" value={planForm.last_drill_date}
                    onChange={e => setPlanForm(f => ({ ...f, last_drill_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Próximo simulacro</label>
                  <input type="date" value={planForm.next_drill_date}
                    onChange={e => setPlanForm(f => ({ ...f, next_drill_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Frecuencia (meses)</label>
                  <input type="number" min={1} max={36} value={planForm.drill_frequency_months}
                    onChange={e => setPlanForm(f => ({ ...f, drill_frequency_months: parseInt(e.target.value) || 12 }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={planForm.cchen_notification}
                    onChange={e => setPlanForm(f => ({ ...f, cchen_notification: e.target.checked }))}
                    className="rounded" />
                  Notificación CCHEN obligatoria
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={planForm.minsal_notification}
                    onChange={e => setPlanForm(f => ({ ...f, minsal_notification: e.target.checked }))}
                    className="rounded" />
                  Notificación MINSAL obligatoria
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Notas</label>
                <textarea value={planForm.notes} rows={2}
                  onChange={e => setPlanForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closePlanModal}
                  className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={savingPlan}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                  {savingPlan ? "Guardando…" : editingPlan ? "Actualizar" : "Crear plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Drill Modal ─────────────────────────────────────────────────────── */}
      {showDrillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-sm">
                {editingDrill ? "Editar simulacro" : "Registrar simulacro / ejercicio"}
              </h2>
              <button onClick={closeDrillModal} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDrill} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Fecha *</label>
                  <input type="date" required value={drillForm.drill_date}
                    onChange={e => setDrillForm(f => ({ ...f, drill_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Plan asociado</label>
                  <select value={drillForm.plan_id}
                    onChange={e => setDrillForm(f => ({ ...f, plan_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">— Sin plan específico —</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.plan_code} — {p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tipo</label>
                  <select value={drillForm.drill_type}
                    onChange={e => setDrillForm(f => ({ ...f, drill_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {DRILL_TYPES.map(t => <option key={t} value={t}>{DRILL_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Resultado</label>
                  <select value={drillForm.outcome}
                    onChange={e => setDrillForm(f => ({ ...f, outcome: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {OUTCOMES.map(o => <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Escenario / descripción *</label>
                <textarea required value={drillForm.scenario} rows={2}
                  onChange={e => setDrillForm(f => ({ ...f, scenario: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Coordinador</label>
                  <input value={drillForm.coordinator}
                    onChange={e => setDrillForm(f => ({ ...f, coordinator: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Participantes</label>
                  <input type="number" min={0} value={drillForm.participants}
                    onChange={e => setDrillForm(f => ({ ...f, participants: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Duración (min)</label>
                  <input type="number" min={0} value={drillForm.duration_min}
                    onChange={e => setDrillForm(f => ({ ...f, duration_min: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hallazgos / observaciones</label>
                <textarea value={drillForm.findings} rows={2}
                  onChange={e => setDrillForm(f => ({ ...f, findings: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Acciones correctivas</label>
                <textarea value={drillForm.corrective_actions} rows={2}
                  onChange={e => setDrillForm(f => ({ ...f, corrective_actions: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Fecha próximo simulacro</label>
                <input type="date" value={drillForm.next_drill_date}
                  onChange={e => setDrillForm(f => ({ ...f, next_drill_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeDrillModal}
                  className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={savingDrill}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                  {savingDrill ? "Guardando…" : editingDrill ? "Actualizar" : "Registrar simulacro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
