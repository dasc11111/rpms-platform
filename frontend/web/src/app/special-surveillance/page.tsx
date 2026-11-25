"use client";


// §153 — Vigilancia Radiológica Especial POE
// DS 3/1985 Arts. 16-19 · CCHEN NS-05.0 §7 · ICRP 103 · IAEA GSR Part 3 Req. 30
// Embarazadas: 1 mSv durante gestación · Menores/estudiantes: 6 mSv/año

import { useState, useEffect, useCallback } from "react";
import {
  Baby, Shield, AlertTriangle, CheckCircle2, Clock,
  Plus, X, ChevronDown, ChevronUp, RefreshCw,
  User, Bell, BellOff, FileText, AlertCircle,
  GraduationCap, Heart, Users, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SurveillanceRecord {
  id: number;
  worker_rut: string;
  worker_name: string;
  service: string | null;
  surveillance_type: string;
  declared_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  dose_at_declaration_msv: number | null;
  dose_limit_msv: number | null;
  current_period_dose_msv: number | null;
  dosimeter_type: string | null;
  restrictions: string | null;
  notes: string | null;
  status: string;
  notified_cchen: boolean;
  notified_cchen_date: string | null;
  created_at: string;
  latest_cumulative: number | null;
  latest_pct: number | null;
  alarm_level: string | null;
}

interface Stats {
  total: string;
  active: string;
  pregnant: string;
  nursing: string;
  students: string;
  minors: string;
  pending_cchen: string;
}

interface AlarmRecord {
  id: number;
  worker_name: string;
  service: string | null;
  surveillance_type: string;
  cumulative_dose_msv: number;
  limit_percent_used: number;
  alarm_level: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  limit: string;
  norm: string;
}> = {
  pregnant: {
    label: "Embarazo",
    icon: Baby,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    limit: "1 mSv durante gestación",
    norm: "DS 3/1985 Art. 16",
  },
  nursing: {
    label: "Lactancia",
    icon: Heart,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    limit: "1 mSv (restricción voluntaria)",
    norm: "DS 3/1985 Art. 17",
  },
  minor: {
    label: "Menor de 18",
    icon: Shield,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    limit: "6 mSv/año",
    norm: "DS 3/1985 Art. 19",
  },
  student: {
    label: "Estudiante",
    icon: GraduationCap,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    limit: "6 mSv/año",
    norm: "DS 3/1985 Art. 19",
  },
  external_visitor: {
    label: "Visitante externo",
    icon: Users,
    color: "text-teal-600 bg-teal-50 border-teal-200",
    limit: "2 mSv/año",
    norm: "DS 3/1985 Art. 10",
  },
  medical_condition: {
    label: "Cond. médica",
    icon: Eye,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    limit: "Según prescripción",
    norm: "IAEA GSR Part 3",
  },
};

const ALARM_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  green: { label: "Normal",    cls: "bg-green-100 text-green-800 border-green-300",  icon: CheckCircle2 },
  amber: { label: "Alerta 75%",cls: "bg-amber-100 text-amber-800 border-amber-300", icon: AlertTriangle },
  red:   { label: "Crítico 90%",cls: "bg-red-100  text-red-800   border-red-300",   icon: AlertCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function DoseBar({ pct, limit }: { pct: number | null; limit: number | null }) {
  if (pct === null) return <div className="text-xs text-muted-foreground">Sin lecturas</div>;
  const color = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={pct >= 75 ? "font-semibold text-red-700" : "text-muted-foreground"}>{pct.toFixed(1)}% del límite</span>
        {limit && <span className="text-muted-foreground">Límite: {limit} mSv</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ─── SurveillanceCard ─────────────────────────────────────────────────────────

function SurveillanceCard({ rec, onStatusChange }: {
  rec: SurveillanceRecord;
  onStatusChange: () => void;
}) {
  const [open, setOpen] = useState(rec.alarm_level === "red" || rec.alarm_level === "amber");
  const [closing, setClosing] = useState(false);

  const cfg = TYPE_CONFIG[rec.surveillance_type] ?? TYPE_CONFIG.external_visitor;
  const Icon = cfg.icon;
  const alarm = rec.alarm_level ?? "green";
  const alarmCfg = ALARM_CONFIG[alarm] ?? ALARM_CONFIG.green;
  const AlarmIcon = alarmCfg.icon;

  const daysRemaining = rec.expected_end_date
    ? Math.floor((new Date(rec.expected_end_date).getTime() - Date.now()) / 86400000)
    : null;

  const handleClose = async () => {
    if (!confirm(`¿Cerrar vigilancia especial de ${rec.worker_name}?`)) return;
    setClosing(true);
    await fetch(`/api/special-surveillance?id=${rec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", actual_end_date: new Date().toISOString().split("T")[0] }),
    });
    setClosing(false);
    onStatusChange();
  };

  const handleNotifyCchen = async () => {
    setClosing(true);
    await fetch(`/api/special-surveillance?id=${rec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notified_cchen: true,
        notified_cchen_date: new Date().toISOString().split("T")[0],
      }),
    });
    setClosing(false);
    onStatusChange();
  };

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden",
      alarm === "red" ? "border-red-300" : alarm === "amber" ? "border-amber-300" : ""
    )}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className={cn("rounded-lg border p-2 flex-shrink-0", cfg.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{rec.worker_name}</p>
              <p className="text-xs text-muted-foreground">{rec.service ?? "—"} · {rec.worker_rut}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.color)}>
                {cfg.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", alarmCfg.cls)}>
                <AlarmIcon className="w-3 h-3" /> {alarmCfg.label}
              </span>
            </div>
          </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="special-surveillance"
        ownerType="module"
        title="Documentos del módulo"
      />

          {/* Dose bar */}
          <div className="mt-2">
            <DoseBar pct={rec.latest_pct} limit={rec.dose_limit_msv} />
          </div>

          {/* Quick info */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Declarado: {fmtDate(rec.declared_date)}</span>
            {rec.expected_end_date && (
              <span className={daysRemaining !== null && daysRemaining < 30 ? "text-amber-600 font-medium" : ""}>
                Fin esperado: {fmtDate(rec.expected_end_date)}
                {daysRemaining !== null && ` (${daysRemaining}d)`}
              </span>
            )}
            {rec.notified_cchen ? (
              <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />CCHEN notificado</span>
            ) : (
              <span className="text-amber-600 flex items-center gap-1"><BellOff className="w-3 h-3" />Sin notif. CCHEN</span>
            )}
          </div>
        </div>

        <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground ml-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Regulatory limit info */}
          <div className="bg-muted/40 rounded-lg p-3 text-xs">
            <p className="font-semibold mb-1">Límite dosimétrico aplicable</p>
            <p>{cfg.limit} <span className="text-muted-foreground">— {cfg.norm}</span></p>
          </div>

          {/* Dose detail */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Dosis al declarar</p>
              <p className="font-medium">
                {rec.dose_at_declaration_msv != null ? `${Number(rec.dose_at_declaration_msv).toFixed(2)} mSv` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acumulado período</p>
              <p className={cn("font-medium", (rec.latest_pct ?? 0) >= 75 ? "text-red-600 font-bold" : "")}>
                {rec.latest_cumulative != null ? `${Number(rec.latest_cumulative).toFixed(2)} mSv` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remanente</p>
              <p className="font-medium text-green-700">
                {rec.dose_limit_msv != null && rec.latest_cumulative != null
                  ? `${(Number(rec.dose_limit_msv) - Number(rec.latest_cumulative)).toFixed(2)} mSv`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Dosimeter + restrictions */}
          {rec.dosimeter_type && (
            <div>
              <p className="text-xs text-muted-foreground">Dosímetro asignado</p>
              <p className="text-sm font-medium">{rec.dosimeter_type}</p>
            </div>
          )}

          {rec.restrictions && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Restricciones activas
              </p>
              <p className="text-xs text-amber-900 whitespace-pre-line">{rec.restrictions}</p>
            </div>
          )}

          {rec.notes && (
            <div>
              <p className="text-xs text-muted-foreground">Observaciones</p>
              <p className="text-xs text-foreground mt-0.5">{rec.notes}</p>
            </div>
          )}

          {/* Critical alarm */}
          {alarm === "red" && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-800">ALERTA CRÍTICA — Dosis superior al 90% del límite</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Revisar inmediatamente condiciones de trabajo. Considerar reasignación de tareas.
                  Notificar a Encargado PR y registrar en bitácora de vigilancia.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!rec.notified_cchen && (
              <button
                onClick={handleNotifyCchen}
                disabled={closing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
              >
                <Bell className="w-3 h-3" /> Marcar notif. CCHEN
              </button>
            )}
            {rec.status === "active" && (
              <button
                onClick={handleClose}
                disabled={closing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" /> Cerrar vigilancia
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Record Form ──────────────────────────────────────────────────────────

interface FormState {
  worker_rut: string;
  worker_name: string;
  service: string;
  surveillance_type: string;
  declared_date: string;
  expected_end_date: string;
  dose_at_declaration_msv: string;
  dosimeter_type: string;
  restrictions: string;
  notes: string;
}

function NewSurveillanceForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>({
    worker_rut: "", worker_name: "", service: "",
    surveillance_type: "pregnant",
    declared_date: new Date().toISOString().split("T")[0],
    expected_end_date: "", dose_at_declaration_msv: "",
    dosimeter_type: "", restrictions: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const cfg = TYPE_CONFIG[form.surveillance_type];

  const save = async () => {
    if (!form.worker_rut.trim() || !form.worker_name.trim()) return;
    setSaving(true);
    await fetch("/api/special-surveillance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        dose_at_declaration_msv: form.dose_at_declaration_msv ? Number(form.dose_at_declaration_msv) : null,
        expected_end_date: form.expected_end_date || null,
        service: form.service || null,
        dosimeter_type: form.dosimeter_type || null,
        restrictions: form.restrictions || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-16 overflow-y-auto">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-10 border">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Nueva Vigilancia Especial POE</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">RUT trabajador *</label>
            <input className="w-full border rounded px-3 py-2" placeholder="12.345.678-9" value={form.worker_rut} onChange={e => f("worker_rut", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Nombre completo *</label>
            <input className="w-full border rounded px-3 py-2" value={form.worker_name} onChange={e => f("worker_name", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Servicio / Unidad</label>
            <input className="w-full border rounded px-3 py-2" value={form.service} onChange={e => f("service", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tipo de vigilancia especial *</label>
            <select className="w-full border rounded px-3 py-2" value={form.surveillance_type} onChange={e => f("surveillance_type", e.target.value)}>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Regulatory info banner */}
          {cfg && (
            <div className={cn("col-span-2 rounded-lg border p-3 text-xs", cfg.color)}>
              <p className="font-semibold">Límite aplicable: {cfg.limit}</p>
              <p className="mt-0.5 opacity-80">Normativa: {cfg.norm}</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fecha de declaración *</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.declared_date} onChange={e => f("declared_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fecha probable de término</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.expected_end_date} onChange={e => f("expected_end_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Dosis acumulada al declarar (mSv)</label>
            <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={form.dose_at_declaration_msv} onChange={e => f("dose_at_declaration_msv", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tipo dosímetro asignado</label>
            <input className="w-full border rounded px-3 py-2" placeholder="TLD mensual abdominal" value={form.dosimeter_type} onChange={e => f("dosimeter_type", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Restricciones de tareas / zonas</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.restrictions} onChange={e => f("restrictions", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Observaciones</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.notes} onChange={e => f("notes", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={save} disabled={saving || !form.worker_rut || !form.worker_name} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium">
            {saving ? "Guardando…" : "Registrar vigilancia"}
          </button>
          <button onClick={onCancel} className="border px-5 py-2 rounded-lg hover:bg-muted text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SpecialSurveillancePage() {
  const [records, setRecords] = useState<SurveillanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    const r = await fetch(`/api/special-surveillance?${params}`);
    const d = await r.json();
    setRecords(d.records ?? []);
    setStats(d.stats ?? null);
    setAlarms(d.alarms ?? []);
    setLoading(false);
  }, [filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const activeCount  = records.filter(r => r.status === "active").length;
  const alarmCount   = records.filter(r => r.alarm_level === "red" || r.alarm_level === "amber").length;
  const cchPending   = records.filter(r => !r.notified_cchen && r.status === "active").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Baby className="w-6 h-6 text-pink-600" />
            Vigilancia Radiológica Especial POE
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §153 — Embarazadas · Lactantes · Menores · Estudiantes · DS 3/1985 Arts. 16-19 · IAEA GSR Part 3
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border hover:bg-muted text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nueva vigilancia
          </button>
        </div>
      </div>

      {/* Critical alarms */}
      {alarms.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="font-semibold text-red-800 text-sm flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" /> {alarms.length} trabajador(es) con dosis en zona de alerta
          </p>
          <div className="space-y-1">
            {alarms.map(a => (
              <div key={a.id} className="flex items-center justify-between text-xs text-red-800 bg-red-100/50 rounded px-3 py-1.5">
                <span className="font-medium">{a.worker_name}</span>
                <span>{a.service}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full border text-xs font-medium",
                  a.alarm_level === "red" ? "bg-red-200 text-red-800 border-red-400" : "bg-amber-100 text-amber-800 border-amber-300"
                )}>
                  {a.limit_percent_used.toFixed(1)}% del límite
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Activos",        value: stats?.active ?? "—",       icon: User,       color: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Embarazadas",    value: stats?.pregnant ?? "—",     icon: Baby,       color: "text-pink-700 bg-pink-50 border-pink-200" },
          { label: "Con alertas",    value: alarmCount,                  icon: AlertTriangle, color: alarmCount > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200" },
          { label: "Pend. notif. CCHEN", value: cchPending,             icon: BellOff,    color: cchPending > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200" },
        ].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <div key={i} className={cn("rounded-xl border p-4 flex items-center gap-3", tile.color)}>
              <Icon className="w-5 h-5 opacity-70 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium opacity-70">{tile.label}</p>
                <p className="text-2xl font-bold leading-tight">{loading ? "…" : tile.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select className="border rounded-lg px-3 py-2 text-sm bg-background"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="active">Activos</option>
          <option value="closed">Cerrados</option>
          <option value="all">Todos</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm bg-background"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Records list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-10 text-center">
          <Baby className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay registros de vigilancia especial</p>
          <p className="text-xs text-muted-foreground mt-1">Registre cuando un POE declare embarazo, lactancia, o se incorpore un menor/estudiante.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <SurveillanceCard key={r.id} rec={r} onStatusChange={load} />
          ))}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="rounded-xl border bg-blue-50/50 p-5 text-xs text-blue-900 space-y-2">
        <p className="font-semibold flex items-center gap-1.5 text-sm">
          <FileText className="w-4 h-4" /> Marco Regulatorio — Protección Especial POE
        </p>
        <p><strong>DS 3/1985 Art. 16:</strong> Mujer embarazada que trabaje con radiaciones: límite de 1 mSv durante todo el embarazo. Empleador debe redistribuir tareas para garantir cumplimiento.</p>
        <p><strong>DS 3/1985 Art. 17:</strong> Período de lactancia: aplicar misma precaución que embarazo para evitar contaminación interna.</p>
        <p><strong>DS 3/1985 Art. 19:</strong> Menores de 18 años y estudiantes: límite anual reducido al 30% del límite adulto (6 mSv/año). Sin acceso a zonas controladas sin supervisión directa.</p>
        <p><strong>IAEA GSR Part 3 Req. 30:</strong> Protección especial de trabajadoras embarazadas y mujeres en período de lactancia — evaluación mensual de dosis.</p>
        <p><strong>ICRP 103 §5.9:</strong> Las restricciones de dosis para mujeres embarazadas deben garantizar una dosis al embrión/feto no mayor a ~1 mSv durante todo el embarazo.</p>
      </div>

      {showForm && (
        <NewSurveillanceForm
          onSave={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
