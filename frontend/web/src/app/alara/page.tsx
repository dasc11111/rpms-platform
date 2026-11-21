"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, Award, CheckCircle2, ChevronDown, ChevronUp, Clock,
  Download, Pencil, Plus, Shield, TrendingDown, TrendingUp, Trash2,
  Users, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CollectiveDose {
  service: string;
  yr: number;
  worker_count: number;
  collective_dose_msv: string;
  avg_dose_msv: string;
  max_dose_msv: string;
  above_constraint: number;
  above_limit: number;
  zero_dose: number;
}

interface DoseTrend {
  yr: number;
  workers: number;
  collective_dose_msv: string;
  avg_dose_msv: string;
  max_dose_msv: string;
  exceeded_limit: number;
}

interface AlaraAction {
  id: number;
  year: number;
  quarter: number | null;
  service: string | null;
  action_type: string;
  title: string;
  description: string | null;
  rationale: string | null;
  expected_benefit: string | null;
  dose_reduction_pct: string | null;
  responsible: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  completion_date: string | null;
  actual_reduction_pct: string | null;
  verified_by: string | null;
  notes: string | null;
}

// ─── Consts ───────────────────────────────────────────────────────────────────

const ACTION_TYPES = ["optimizacion", "procedimiento", "equipamiento", "formacion", "investigacion"];
const ACTION_TYPE_LABELS: Record<string, string> = {
  optimizacion: "Optimización técnica", procedimiento: "Revisión de procedimiento",
  equipamiento: "Mejora de equipamiento", formacion: "Formación / capacitación",
  investigacion: "Investigación",
};

const STATUSES = ["planificado", "en_progreso", "completado", "cancelado"];
const STATUS_LABELS: Record<string, string> = {
  planificado: "Planificado", en_progreso: "En progreso",
  completado: "Completado", cancelado: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  planificado: "bg-blue-50 text-blue-700 border-blue-200",
  en_progreso: "bg-yellow-50 text-yellow-700 border-yellow-200",
  completado:  "bg-green-50 text-green-700 border-green-200",
  cancelado:   "bg-muted text-muted-foreground border-border",
};

const QUARTERS = [1, 2, 3, 4];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const ACTION_DEFAULT = {
  year: CURRENT_YEAR, quarter: "", service: "", action_type: "optimizacion",
  title: "", description: "", rationale: "", expected_benefit: "",
  dose_reduction_pct: "", responsible: "", status: "planificado",
  start_date: "", end_date: "", completion_date: "", actual_reduction_pct: "",
  verified_by: "", notes: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL");
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "blue", icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ComponentType<{ className?: string }>;
}) {
  const C: Record<string, string> = {
    blue:   "bg-blue-50   border-blue-200   text-blue-700",
    green:  "bg-green-50  border-green-200  text-green-700",
    red:    "bg-red-50    border-red-200    text-red-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    gray:   "bg-muted     border-border     text-foreground",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };
  return (
    <div className={`rounded-lg border p-4 ${C[color] ?? C.blue}`}>
      {Icon && <Icon className="w-5 h-5 mb-2 opacity-70" />}
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type TabKey = "collective" | "trend" | "actions";

export default function AlaraPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [tab, setTab] = useState<TabKey>("collective");
  const [collective, setCollective] = useState<CollectiveDose[]>([]);
  const [trend, setTrend] = useState<DoseTrend[]>([]);
  const [actions, setActions] = useState<AlaraAction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AlaraAction | null>(null);
  const [form, setForm] = useState({ ...ACTION_DEFAULT });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alara?year=${year}`);
      const data = await res.json();
      setCollective(data.collective ?? []);
      setTrend(data.trend ?? []);
      setActions(data.actions ?? []);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => { setEditing(null); setForm({ ...ACTION_DEFAULT, year }); setShowModal(true); };
  const openEdit = (a: AlaraAction) => {
    setEditing(a);
    setForm({
      year: a.year, quarter: a.quarter != null ? String(a.quarter) : "",
      service: a.service ?? "", action_type: a.action_type, title: a.title,
      description: a.description ?? "", rationale: a.rationale ?? "",
      expected_benefit: a.expected_benefit ?? "",
      dose_reduction_pct: a.dose_reduction_pct ?? "",
      responsible: a.responsible ?? "", status: a.status,
      start_date: a.start_date ? a.start_date.slice(0, 10) : "",
      end_date: a.end_date ? a.end_date.slice(0, 10) : "",
      completion_date: a.completion_date ? a.completion_date.slice(0, 10) : "",
      actual_reduction_pct: a.actual_reduction_pct ?? "",
      verified_by: a.verified_by ?? "", notes: a.notes ?? "",
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      year: Number(form.year),
      quarter: form.quarter ? parseInt(String(form.quarter)) : null,
      service: form.service || null,
      description: form.description || null,
      rationale: form.rationale || null,
      expected_benefit: form.expected_benefit || null,
      dose_reduction_pct: form.dose_reduction_pct ? parseFloat(form.dose_reduction_pct) : null,
      responsible: form.responsible || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      completion_date: form.completion_date || null,
      actual_reduction_pct: form.actual_reduction_pct ? parseFloat(form.actual_reduction_pct) : null,
      verified_by: form.verified_by || null,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await fetch(`/api/alara?resource=action&id=${editing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/alara?resource=action", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      closeModal(); fetchData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta acción ALARA?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/alara?resource=action&id=${id}`, { method: "DELETE" });
      fetchData();
    } finally { setDeleting(null); }
  };

  // Summary stats for selected year
  const totalCollective = collective.reduce((s, r) => s + parseFloat(r.collective_dose_msv ?? "0"), 0);
  const totalWorkers    = collective.reduce((s, r) => s + r.worker_count, 0);
  const avgDose         = totalWorkers > 0 ? totalCollective / totalWorkers : 0;
  const aboveLimit      = collective.reduce((s, r) => s + r.above_limit, 0);
  const completedActions = actions.filter(a => a.status === "completado").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" />
            Programa ALARA — Optimización de Dosis
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            DS 3/1985 MINSAL Art. 7 · NS-06.0 CCHEN · ICRP Pub. 103 (Principio de Optimización)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background">
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {tab === "actions" && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <Plus className="w-4 h-4" /> Nueva acción ALARA
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={`Dosis colectiva ${year}`} value={`${totalCollective.toFixed(1)} mSv`} color="blue"   icon={Activity} />
        <KPI label="Trabajadores monitorizados" value={totalWorkers}                        color="gray"   icon={Users} />
        <KPI label="Dosis media individual"     value={`${avgDose.toFixed(2)} mSv`}         color="purple" icon={Shield} />
        <KPI label="Dosis > límite 20 mSv"      value={aboveLimit}                           color={aboveLimit > 0 ? "red" : "green"} icon={Zap} />
        <KPI label={`Acciones completadas ${year}`} value={`${completedActions}/${actions.length}`} color="green" icon={CheckCircle2} />
      </div>

      {/* ALARA principle reminder */}
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
        <p className="font-semibold mb-1">Principio ALARA — As Low As Reasonably Achievable</p>
        <p className="text-xs">
          DS 3/1985 Art. 7: Las dosis de radiación deben mantenerse tan bajas como sea razonablemente posible.
          Límite anual trabajadores expuestos: <strong>20 mSv/año</strong> (promedio 5 años, máx 50 mSv en un año).
          Restricción de dosis recomendada CCHEN: <strong>6 mSv/año</strong> (30% del límite).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["collective", "trend", "actions"] as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === t ? "border-green-500 text-green-700" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "collective" ? `Dosis colectiva ${year}` : t === "trend" ? "Tendencia histórica" : `Acciones ALARA (${actions.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Cargando datos ALARA…</div>
      ) : (
        <>
          {/* ── Collective dose by service ── */}
          {tab === "collective" && (
            <div className="rounded-lg border bg-card overflow-hidden">
              {collective.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  No hay datos dosimétricos para {year}. Registre lecturas en el módulo Dosimetría.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Servicio</th>
                      <th className="text-center p-3">TOE</th>
                      <th className="text-right p-3">Dosis colectiva (mSv)</th>
                      <th className="text-right p-3">Dosis media (mSv)</th>
                      <th className="text-right p-3">Dosis máx (mSv)</th>
                      <th className="text-center p-3">&gt;6 mSv</th>
                      <th className="text-center p-3">&gt;20 mSv</th>
                      <th className="text-center p-3">Dosis 0</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {collective.map((r, i) => {
                      const avg = parseFloat(r.avg_dose_msv ?? "0");
                      const max = parseFloat(r.max_dose_msv ?? "0");
                      const col = parseFloat(r.collective_dose_msv ?? "0");
                      const hasIssue = r.above_limit > 0;
                      const hasConstraint = r.above_constraint > 0;
                      return (
                        <tr key={i} className={cn("hover:bg-muted/30", hasIssue && "bg-red-50/50")}>
                          <td className="p-3 font-medium">{r.service}</td>
                          <td className="p-3 text-center">{r.worker_count}</td>
                          <td className="p-3 text-right font-mono font-medium">{col.toFixed(1)}</td>
                          <td className={cn("p-3 text-right font-mono", avg > 6 ? "text-red-600 font-semibold" : avg > 3 ? "text-yellow-600" : "")}>
                            {avg.toFixed(2)}
                          </td>
                          <td className={cn("p-3 text-right font-mono", max > 20 ? "text-red-700 font-bold" : max > 6 ? "text-orange-600" : "")}>
                            {max.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {r.above_constraint > 0
                              ? <span className="text-orange-600 font-semibold">{r.above_constraint}</span>
                              : <span className="text-green-600">0</span>}
                          </td>
                          <td className="p-3 text-center">
                            {r.above_limit > 0
                              ? <span className="text-red-700 font-bold">{r.above_limit}</span>
                              : <span className="text-green-600">0</span>}
                          </td>
                          <td className="p-3 text-center text-muted-foreground">{r.zero_dose}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 font-semibold text-sm border-t">
                    <tr>
                      <td className="p-3">Total</td>
                      <td className="p-3 text-center">{totalWorkers}</td>
                      <td className="p-3 text-right font-mono">{totalCollective.toFixed(1)}</td>
                      <td className="p-3 text-right font-mono">{avgDose.toFixed(2)}</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-center">{collective.reduce((s,r) => s+r.above_constraint, 0)}</td>
                      <td className={cn("p-3 text-center", aboveLimit > 0 ? "text-red-700" : "text-green-600")}>{aboveLimit}</td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* ── Historical trend ── */}
          {tab === "trend" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Año</th>
                      <th className="text-center p-3">TOE</th>
                      <th className="text-right p-3">Dosis colectiva (mSv)</th>
                      <th className="text-right p-3">Media (mSv)</th>
                      <th className="text-right p-3">Máxima (mSv)</th>
                      <th className="text-center p-3">Superaron límite</th>
                      <th className="text-center p-3">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trend.map((r, i) => {
                      const prev = trend[i - 1];
                      const col = parseFloat(r.collective_dose_msv ?? "0");
                      const prevCol = prev ? parseFloat(prev.collective_dose_msv ?? "0") : null;
                      const improving = prevCol !== null && col < prevCol;
                      const worsening = prevCol !== null && col > prevCol;
                      return (
                        <tr key={r.yr} className={cn("hover:bg-muted/30", r.yr === year && "bg-blue-50/40")}>
                          <td className="p-3 font-semibold">{r.yr}{r.yr === year && <span className="ml-2 text-xs text-blue-600 font-normal">(actual)</span>}</td>
                          <td className="p-3 text-center">{r.workers}</td>
                          <td className="p-3 text-right font-mono font-medium">{col.toFixed(1)}</td>
                          <td className="p-3 text-right font-mono">{parseFloat(r.avg_dose_msv ?? "0").toFixed(2)}</td>
                          <td className={cn("p-3 text-right font-mono", parseFloat(r.max_dose_msv ?? "0") > 20 ? "text-red-600 font-semibold" : "")}>
                            {parseFloat(r.max_dose_msv ?? "0").toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {r.exceeded_limit > 0
                              ? <span className="text-red-700 font-bold">{r.exceeded_limit}</span>
                              : <span className="text-green-600">0</span>}
                          </td>
                          <td className="p-3 text-center">
                            {improving && <TrendingDown className="w-4 h-4 text-green-600 inline" />}
                            {worsening && <TrendingUp className="w-4 h-4 text-red-500 inline" />}
                            {!improving && !worsening && <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Datos tomados de registros dosimétricos. ↓ verde = mejora ALARA · ↑ rojo = incremento.
              </p>
            </div>
          )}

          {/* ── ALARA Actions ── */}
          {tab === "actions" && (
            <div className="space-y-3">
              {actions.length === 0 && (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  No hay acciones ALARA registradas para {year}.
                </div>
              )}
              {actions.map(a => {
                const isExp = expandedAction === a.id;
                return (
                  <div key={a.id} className="rounded-lg border bg-card overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <div className="rounded-lg bg-green-50 p-2 flex-shrink-0">
                        <TrendingDown className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{a.year}{a.quarter ? ` T${a.quarter}` : ""}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {ACTION_TYPE_LABELS[a.action_type] ?? a.action_type}
                          </span>
                          {a.service && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.service}</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[a.status] ?? ""}`}>
                            {STATUS_LABELS[a.status] ?? a.status}
                          </span>
                        </div>
                        <p className="font-medium text-sm mt-0.5">{a.title}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                          {a.responsible && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.responsible}</span>}
                          {a.dose_reduction_pct && <span className="text-green-600 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Reducción esperada: {a.dose_reduction_pct}%</span>}
                          {a.actual_reduction_pct && <span className="text-green-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Real: {a.actual_reduction_pct}%</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setExpandedAction(isExp ? null : a.id)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded">
                          {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openEdit(a)} className="p-1 text-muted-foreground hover:text-blue-600 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                          className="p-1 text-muted-foreground hover:text-red-600 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {isExp && (
                      <div className="border-t px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {a.description && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Descripción</p><p>{a.description}</p></div>}
                        {a.rationale    && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Justificación</p><p>{a.rationale}</p></div>}
                        {a.expected_benefit && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Beneficio esperado</p><p>{a.expected_benefit}</p></div>}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Fechas</p>
                          <p>Inicio: {formatDate(a.start_date)} · Fin: {formatDate(a.end_date)}</p>
                          {a.completion_date && <p>Completado: {formatDate(a.completion_date)}</p>}
                        </div>
                        {a.verified_by && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Verificado por</p><p>{a.verified_by}</p></div>}
                        {a.notes && <div className="md:col-span-2"><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</p><p>{a.notes}</p></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-sm">
                {editing ? "Editar acción ALARA" : "Nueva acción ALARA"}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Año *</label>
                  <select value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Trimestre</label>
                  <select value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">— Anual —</option>
                    {QUARTERS.map(q => <option key={q} value={q}>T{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tipo</label>
                  <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{ACTION_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Título *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Descripción breve de la acción" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Servicio / Área</label>
                  <input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                    placeholder="Medicina Nuclear, Radioterapia…" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Responsable</label>
                  <input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Descripción</label>
                <textarea value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Justificación (por qué es ALARA)</label>
                <textarea value={form.rationale} rows={2}
                  onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Beneficio esperado</label>
                <textarea value={form.expected_benefit} rows={2}
                  onChange={e => setForm(f => ({ ...f, expected_benefit: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Reducción esperada (%)</label>
                  <input type="number" min={0} max={100} step={0.1} value={form.dose_reduction_pct}
                    onChange={e => setForm(f => ({ ...f, dose_reduction_pct: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Reducción real (%)</label>
                  <input type="number" min={0} max={100} step={0.1} value={form.actual_reduction_pct}
                    onChange={e => setForm(f => ({ ...f, actual_reduction_pct: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Estado</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Verificado por</label>
                  <input value={form.verified_by} onChange={e => setForm(f => ({ ...f, verified_by: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Fecha inicio</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Fecha fin</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Fecha completado</label>
                  <input type="date" value={form.completion_date} onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notas</label>
                <textarea value={form.notes} rows={2}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                  {saving ? "Guardando…" : editing ? "Actualizar" : "Crear acción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
