"use client";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import {
  Activity, Plus, Pencil, Trash2, X, Save, Search, RefreshCw,
  AlertTriangle, CheckCircle2, TrendingUp, Users, ShieldCheck,
  BarChart3, Calendar, type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Reading {
  id: number;
  worker_rut: string | null;
  worker_name: string;
  dosimeter_type: string;
  period: string;
  dose: number;
  dose_unit: string;
  status: string;
  body_region: string;
  badge_number: string | null;
  lab_report_id: string | null;
  measured_at: string | null;
  notes: string | null;
  category?: string;
  service?: string;
}

interface WorkerSummary {
  worker_rut: string | null;
  worker_name: string;
  category: string | null;
  total_dose_wb: number;
  total_dose_ext: number | null;
  periods_measured: number;
  max_single_dose: number;
  first_period: string;
  last_period: string;
  annual_limit: number;
  limit_pct: number;
  alert: "ok" | "warning" | "exceeded";
}

const BODY_REGIONS: Record<string, string> = {
  whole_body: "Cuerpo completo",
  extremities: "Extremidades",
  lens: "Cristalino",
  skin: "Piel",
};

const DOSIMETER_TYPES = ["TLD", "OSL", "Film", "MOSFET", "Electrónico", "Dedo", "Muñeca"];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ComponentType<LucideProps> }> = {
  read:         { label: "Leído",       color: "bg-green-100 text-green-800",  icon: CheckCircle2 },
  pending:      { label: "Pendiente",   color: "bg-amber-100 text-amber-800",  icon: AlertTriangle },
  lost:         { label: "Extraviado",  color: "bg-red-100 text-red-800",      icon: X },
  not_worn:     { label: "No portado",  color: "bg-gray-100 text-gray-600",    icon: X },
  damaged:      { label: "Dañado",      color: "bg-orange-100 text-orange-800",icon: AlertTriangle },
};

const DEFAULT_FORM = {
  worker_rut: "", worker_name: "", dosimeter_type: "TLD", period: "",
  dose: "0", dose_unit: "mSv", status: "read", body_region: "whole_body",
  badge_number: "", lab_report_id: "", measured_at: "", notes: "",
};

// Genera lista de períodos (últimos 24 meses en formato YYYY-MM)
function generatePeriods() {
  const periods = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return periods;
}

export default function DosimetryPage() {
  const [view, setView] = useState<"summary" | "readings">("summary");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [summaries, setSummaries] = useState<WorkerSummary[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAlert, setFilterAlert] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reading | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, exceeded: 0, warning: 0 });
  const periods = generatePeriods();

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dosimetry?summary=1&year=${year}`);
      const data = await res.json();
      setSummaries(data.workers ?? []);
      setStats(data.stats ?? { total: 0, exceeded: 0, warning: 0 });
    } catch { /* silent */ } finally { setLoading(false); }
  }, [year]);

  const loadReadings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dosimetry?year=${year}`);
      const data = await res.json();
      setReadings(data.readings ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [year]);

  useEffect(() => {
    if (view === "summary") loadSummary();
    else loadReadings();
  }, [view, year, loadSummary, loadReadings]);

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setForm({
      ...DEFAULT_FORM,
      period: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`,
    });
    setError(null); setShowModal(true);
  };
  const openEdit = (r: Reading) => {
    setEditing(r);
    setForm({
      worker_rut: r.worker_rut ?? "",
      worker_name: r.worker_name,
      dosimeter_type: r.dosimeter_type,
      period: r.period,
      dose: String(r.dose),
      dose_unit: r.dose_unit ?? "mSv",
      status: r.status,
      body_region: r.body_region ?? "whole_body",
      badge_number: r.badge_number ?? "",
      lab_report_id: r.lab_report_id ?? "",
      measured_at: r.measured_at?.slice(0, 10) ?? "",
      notes: r.notes ?? "",
    });
    setError(null); setShowModal(true);
  };

  const handleSave = async (ev: { preventDefault: () => void }) => {
    ev.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        worker_rut: form.worker_rut || null,
        worker_name: form.worker_name,
        dosimeter_type: form.dosimeter_type,
        period: form.period,
        dose: parseFloat(form.dose) || 0,
        dose_unit: form.dose_unit,
        status: form.status,
        body_region: form.body_region,
        badge_number: form.badge_number || null,
        lab_report_id: form.lab_report_id || null,
        measured_at: form.measured_at || null,
        notes: form.notes || null,
      };
      let res: Response;
      if (editing) {
        res = await fetch("/api/dosimetry", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
      } else {
        res = await fetch("/api/dosimetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error"); }
      setShowModal(false);
      if (view === "summary") loadSummary(); else loadReadings();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const handleDelete = async (r: Reading) => {
    if (!confirm(`¿Eliminar lectura de ${r.worker_name} (${r.period})?`)) return;
    await fetch(`/api/dosimetry?id=${r.id}`, { method: "DELETE" });
    if (view === "summary") loadSummary(); else loadReadings();
  };

  const alertColor = (alert: string) =>
    alert === "exceeded" ? "text-red-600 font-bold" :
    alert === "warning"  ? "text-amber-600 font-semibold" :
    "text-green-700";

  const alertBadge = (alert: string) =>
    alert === "exceeded" ? "bg-red-100 text-red-800" :
    alert === "warning"  ? "bg-amber-100 text-amber-800" :
    "bg-green-100 text-green-800";

  const filteredSummaries = summaries.filter(w => {
    if (filterAlert !== "all" && w.alert !== filterAlert) return false;
    if (!search) return true;
    return w.worker_name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredReadings = readings.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.worker_name, r.worker_rut, r.period, r.badge_number].some(v => v?.toLowerCase().includes(q));
  });

  const availableYears = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dosimetría Individual</h1>
            <p className="text-sm text-muted-foreground">Dosis ocupacional TOE · DS 3/1985 MINSAL Art. 7</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={e => setYear(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { if (view === "summary") loadSummary(); else loadReadings(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
            <Plus className="h-4 w-4" /> Nueva lectura
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "TOE monitoreados", value: stats.total, icon: Users, color: "text-blue-500" },
          { label: "Dosis excedida", value: stats.exceeded, icon: AlertTriangle, color: stats.exceeded > 0 ? "text-red-500" : "text-muted-foreground" },
          { label: "En seguimiento", value: stats.warning, icon: ShieldCheck, color: stats.warning > 0 ? "text-amber-500" : "text-muted-foreground" },
          { label: "Año en curso", value: year, icon: Calendar, color: "text-purple-500" },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <k.icon className={cn("h-8 w-8", k.color)} />
            <div>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta DS 3/1985 */}
      {stats.exceeded > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">
              {stats.exceeded} trabajador{stats.exceeded > 1 ? "es" : ""} con dosis anual excedida
            </p>
            <p className="text-sm text-red-700 mt-0.5">
              DS 3/1985 Art. 7: Categoría A ≤ 50 mSv/año · Categoría B ≤ 15 mSv/año. Notificar SEREMI y CCHEN.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { key: "summary", label: "Resumen anual", icon: BarChart3 },
          { key: "readings", label: "Lecturas", icon: Activity },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key as "summary" | "readings")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              view === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar trabajador, RUT, período…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" />
        </div>
        {view === "summary" && (
          <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm">
            <option value="all">Todos</option>
            <option value="exceeded">Excedido</option>
            <option value="warning">En seguimiento</option>
            <option value="ok">Normal</option>
          </select>
        )}
      </div>

      {/* Summary Table */}
      {view === "summary" && (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trabajador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cat.</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Dosis WB (mSv)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Límite</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">% Límite</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Períodos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último per.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">Cargando…</td></tr>
              ) : filteredSummaries.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">Sin datos para {year}</td></tr>
              ) : filteredSummaries.map((w, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{w.worker_name}</div>
                    {w.worker_rut && <div className="text-xs text-muted-foreground font-mono">{w.worker_rut}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {w.category && (
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold",
                        w.category === "A" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800")}>
                        Cat. {w.category}
                      </span>
                    )}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-mono font-semibold", alertColor(w.alert))}>
                    {Number(w.total_dose_wb ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {w.annual_limit}
                  </td>
                  <td className="px-4 py-3 min-w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div className={cn("h-2 rounded-full transition-all",
                          w.alert === "exceeded" ? "bg-red-500" :
                          w.alert === "warning"  ? "bg-amber-500" : "bg-green-500")}
                          style={{ width: `${Math.min(100, w.limit_pct ?? 0)}%` }} />
                      </div>
                      <span className={cn("text-xs font-mono", alertColor(w.alert))}>
                        {(w.limit_pct ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{w.periods_measured}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{w.last_period}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", alertBadge(w.alert))}>
                      {w.alert === "exceeded" ? "⚠ Excedido" : w.alert === "warning" ? "Seguimiento" : "Normal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Readings Table */}
      {view === "readings" && (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trabajador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dosímetro</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Región</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Dosis</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">N° Badge</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">Cargando…</td></tr>
              ) : filteredReadings.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">Sin lecturas para {year}</td></tr>
              ) : filteredReadings.map(r => {
                const stCfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                const StIcon = stCfg.icon;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.worker_name}</div>
                      {r.worker_rut && <div className="text-xs text-muted-foreground font-mono">{r.worker_rut}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.period}</td>
                    <td className="px-4 py-3">{r.dosimeter_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {BODY_REGIONS[r.body_region] ?? r.body_region}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-mono font-semibold",
                        r.dose > 5 ? "text-red-600" : r.dose > 1 ? "text-amber-600" : "text-foreground")}>
                        {Number(r.dose).toFixed(3)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{r.dose_unit ?? "mSv"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit", stCfg.color)}>
                        <StIcon className="h-3 w-3" />{stCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.badge_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold">{editing ? "Editar lectura" : "Nueva lectura dosimétrica"}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              {/* Trabajador */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Trabajador</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">RUT</label>
                    <input value={form.worker_rut} onChange={e => setForm(f => ({ ...f, worker_rut: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono" placeholder="12.345.678-9" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <input required value={form.worker_name} onChange={e => setForm(f => ({ ...f, worker_name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
              </div>

              {/* Dosímetro */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dosímetro</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Período *</label>
                    <select required value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono">
                      <option value="">Seleccionar…</option>
                      {periods.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de dosímetro</label>
                    <select value={form.dosimeter_type} onChange={e => setForm(f => ({ ...f, dosimeter_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      {DOSIMETER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Región corporal</label>
                    <select value={form.body_region} onChange={e => setForm(f => ({ ...f, body_region: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      {Object.entries(BODY_REGIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">N° Badge / Código</label>
                    <input value={form.badge_number} onChange={e => setForm(f => ({ ...f, badge_number: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono" />
                  </div>
                </div>
              </div>

              {/* Medición */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Medición</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Dosis *</label>
                    <input required type="number" step="0.001" min="0" value={form.dose}
                      onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unidad</label>
                    <select value={form.dose_unit} onChange={e => setForm(f => ({ ...f, dose_unit: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      <option value="mSv">mSv</option>
                      <option value="µSv">µSv</option>
                      <option value="mGy">mGy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estado</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha medición</label>
                    <input type="date" value={form.measured_at} onChange={e => setForm(f => ({ ...f, measured_at: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">N° Informe laboratorio</label>
                    <input value={form.lab_report_id} onChange={e => setForm(f => ({ ...f, lab_report_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar lectura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
