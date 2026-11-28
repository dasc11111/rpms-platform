"use client";


import { useEffect, useState, useCallback } from "react";
import {
  FileText, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  CheckCircle, Clock, Send, Eye, Download, Calendar,
  Shield, ClipboardList, Paperclip, RefreshCw, BarChart3
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
interface Report {
  id: number;
  report_type: string;
  title: string;
  year: number;
  period_start: string;
  period_end: string;
  status: string;
  submitted_date: string;
  cchen_reception_number: string;
  cchen_resolution: string;
  preparer: string;
  reviewer: string;
  approver: string;
  submission_method: string;
  notes: string;
  sections: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface Stats {
  draft_count: string;
  in_progress_count: string;
  review_count: string;
  submitted_count: string;
  approved_count: string;
  annual_count: string;
  latest_year: string;
}

// ── Config ─────────────────────────────────────────────────────────────
const REPORT_TYPES: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  informe_anual:        { label: "Informe Anual PR", color: "bg-blue-100 text-blue-800", icon: <FileText size={14} /> },
  declaracion_inventario: { label: "Declaración Inventario", color: "bg-purple-100 text-purple-800", icon: <ClipboardList size={14} /> },
  notificacion_incidente: { label: "Notificación Incidente", color: "bg-red-100 text-red-800", icon: <AlertTriangle size={14} /> },
  informe_trimestral:   { label: "Informe Trimestral", color: "bg-green-100 text-green-800", icon: <BarChart3 size={14} /> },
  solicitud_autorizacion: { label: "Solicitud Autorización", color: "bg-amber-100 text-amber-800", icon: <Shield size={14} /> },
  otro:                 { label: "Otro", color: "bg-muted text-foreground/80", icon: <FileText size={14} /> },
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  draft:        { label: "Borrador", color: "bg-muted text-muted-foreground", icon: <Clock size={12} /> },
  in_progress:  { label: "En elaboración", color: "bg-blue-100 text-blue-700", icon: <RefreshCw size={12} /> },
  review:       { label: "En revisión", color: "bg-amber-100 text-amber-700", icon: <Eye size={12} /> },
  submitted:    { label: "Enviado CCHEN", color: "bg-green-100 text-green-700", icon: <Send size={12} /> },
  approved:     { label: "Aprobado", color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle size={12} /> },
  rejected:     { label: "Rechazado", color: "bg-red-100 text-red-700", icon: <AlertTriangle size={12} /> },
};

const SUBMISSION_METHODS = [
  { value: "sistema_cchen", label: "Sistema CCHEN en línea" },
  { value: "correo_certificado", label: "Correo certificado" },
  { value: "presencial", label: "Presencial en CCHEN" },
  { value: "email_oficial", label: "Correo electrónico oficial" },
];

// ── Section definitions for annual report ──────────────────────────────
const ANNUAL_SECTIONS = [
  { key: "identificacion", label: "Identificación del Establecimiento" },
  { key: "personal_ocupacionalmente_expuesto", label: "Personal Ocupacionalmente Expuesto (POE)" },
  { key: "dosimetria", label: "Dosimetría y Resultados de Dosis" },
  { key: "fuentes_radiactivas", label: "Inventario de Fuentes Radiactivas" },
  { key: "residuos_radiactivos", label: "Gestión de Residuos Radiactivos" },
  { key: "incidentes", label: "Incidentes y Eventos Radiológicos" },
  { key: "capacitacion", label: "Capacitación del Personal" },
  { key: "declaracion_jurada", label: "Declaración Jurada y Firma" },
];

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function completionPct(sections: Record<string, any>): number {
  const keys = ANNUAL_SECTIONS.map(s => s.key);
  const done = keys.filter(k => sections[k]?.completo).length;
  return Math.round((done / keys.length) * 100);
}

// ── SectionProgress ─────────────────────────────────────────────────────
function SectionProgress({ sections, reportId, onUpdate }: {
  sections: Record<string, any>;
  reportId: number;
  onUpdate: () => void;
}) {
  const toggle = async (key: string) => {
    const updated = { ...sections, [key]: { ...sections[key], completo: !sections[key]?.completo } };
    await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reportId, sections: updated })
    });
    onUpdate();
  };

  return (
    <div className="space-y-2 mt-3">
      {ANNUAL_SECTIONS.map(sec => (
        <div
          key={sec.key}
          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${sections[sec.key]?.completo ? "bg-green-50 hover:bg-green-100" : "bg-muted/50 hover:bg-muted"}`}
          onClick={() => toggle(sec.key)}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${sections[sec.key]?.completo ? "bg-green-500" : "border-2 border-border"}`}>
            {sections[sec.key]?.completo && <CheckCircle size={12} className="text-white" />}
          </div>
          <span className={`text-sm ${sections[sec.key]?.completo ? "text-green-800 line-through decoration-green-400" : "text-foreground/80"}`}>
            {sec.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── ReportCard ──────────────────────────────────────────────────────────
function ReportCard({ report, onRefresh }: { report: Report; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const type = REPORT_TYPES[report.report_type] || REPORT_TYPES.otro;
  const status = STATUS_CFG[report.status] || STATUS_CFG.draft;
  const pct = report.report_type === "informe_anual" ? completionPct(report.sections) : null;
  const isAnnual = report.report_type === "informe_anual";
  const isActive = !["submitted", "approved", "rejected"].includes(report.status);

  const advanceStatus = async () => {
    const nextStatus: Record<string, string> = {
      draft: "in_progress", in_progress: "review", review: "submitted", submitted: "approved"
    };
    const next = nextStatus[report.status];
    if (!next) return;
    setUpdatingStatus(true);
    const extra: any = {};
    if (next === "submitted") extra.submitted_date = new Date().toISOString().split("T")[0];
    await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: report.id, status: next, ...extra })
    });
    setUpdatingStatus(false);
    onRefresh();
  };

  const nextStatusLabel: Record<string, string> = {
    draft: "→ Iniciar elaboración",
    in_progress: "→ Enviar a revisión",
    review: "→ Marcar como enviado",
    submitted: "→ Marcar como aprobado"
  };

  return (
    <div className="bg-background border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
              {type.icon} {type.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
              {status.icon} {status.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Año {report.year}</span>
          </div>
          <h3 className="font-semibold text-foreground text-sm leading-tight">{report.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.preparer && `Preparado por: ${report.preparer}`}
            {report.submitted_date && ` · Enviado: ${fmtDate(report.submitted_date)}`}
            {report.cchen_reception_number && ` · Rec. CCHEN: ${report.cchen_reception_number}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActive && nextStatusLabel[report.status] && (
            <button
              onClick={advanceStatus}
              disabled={updatingStatus}
              className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
            >
              {updatingStatus ? "…" : nextStatusLabel[report.status]}
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-muted-foreground">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Progress bar for annual reports */}
      {isAnnual && pct !== null && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progreso de completitud</span>
            <span className={pct === 100 ? "text-green-600 font-medium" : ""}>{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct > 60 ? "bg-blue-500" : pct > 30 ? "bg-amber-500" : "bg-gray-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            {report.period_start && (
              <div>
                <span className="text-xs text-muted-foreground">Período</span>
                <p>{fmtDate(report.period_start)} — {fmtDate(report.period_end)}</p>
              </div>
            )}
            {report.reviewer && (
              <div>
                <span className="text-xs text-muted-foreground">Revisado por</span>
                <p>{report.reviewer}</p>
              </div>
            )}
            {report.approver && (
              <div>
                <span className="text-xs text-muted-foreground">Aprobado por</span>
                <p>{report.approver}</p>
              </div>
            )}
            {report.submission_method && (
              <div>
                <span className="text-xs text-muted-foreground">Método de envío</span>
                <p>{SUBMISSION_METHODS.find(m => m.value === report.submission_method)?.label || report.submission_method}</p>
              </div>
            )}
            {report.cchen_resolution && (
              <div>
                <span className="text-xs text-muted-foreground">Resolución CCHEN</span>
                <p className="font-medium text-green-700">{report.cchen_resolution}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {report.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-xs text-yellow-900">
              <strong>Observaciones:</strong> {report.notes}
            </div>
          )}

          {/* Sections checklist for annual reports */}
          {isAnnual && (
            <div>
              <p className="text-xs font-semibold text-foreground/80 mb-1">Secciones del informe</p>
              <p className="text-xs text-muted-foreground mb-2">Haga clic para marcar una sección como completada</p>
              <SectionProgress sections={report.sections} reportId={report.id} onUpdate={onRefresh} />
            </div>
          )}

          {/* Summary of other section types */}
          {!isAnnual && Object.keys(report.sections).length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-foreground/80">
              <p className="font-medium mb-1">Contenido</p>
              {Object.entries(report.sections).map(([k, v]) => (
                <p key={k}>{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ReportForm ───────────────────────────────────────────────────────────
function ReportForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState({
    report_type: "informe_anual",
    title: "",
    year: String(thisYear),
    period_start: `${thisYear}-01-01`,
    period_end: `${thisYear}-12-31`,
    preparer: "",
    reviewer: "",
    approver: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Auto-generate title
  const autoTitle = () => {
    const type = REPORT_TYPES[form.report_type]?.label || "Informe";
    return `${type} ${form.year} — Hospital Hernán Henríquez Aravena`;
  };

  const save = async () => {
    setSaving(true);
    const sections = form.report_type === "informe_anual"
      ? Object.fromEntries(ANNUAL_SECTIONS.map(s => [s.key, { completo: false }]))
      : {};
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, year: parseInt(form.year), title: form.title || autoTitle(), sections })
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 pt-16 overflow-y-auto">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-xl mx-4 mb-10">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-foreground">Nuevo Reporte Regulatorio</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tipo de reporte *</label>
            <select className="w-full border rounded px-3 py-2" value={form.report_type} onChange={e => f("report_type", e.target.value)}>
              {Object.entries(REPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Año *</label>
            <input type="number" className="w-full border rounded px-3 py-2" value={form.year} onChange={e => f("year", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Título (opcional — se genera automático)</label>
            <input className="w-full border rounded px-3 py-2" placeholder={autoTitle()} value={form.title} onChange={e => f("title", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Período inicio</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.period_start} onChange={e => f("period_start", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Período fin</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.period_end} onChange={e => f("period_end", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Preparado por</label>
            <input className="w-full border rounded px-3 py-2" value={form.preparer} onChange={e => f("preparer", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Revisado por</label>
            <input className="w-full border rounded px-3 py-2" value={form.reviewer} onChange={e => f("reviewer", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Observaciones</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.notes} onChange={e => f("notes", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creando…" : "Crear reporte"}
          </button>
          <button onClick={onCancel} className="border px-5 py-2 rounded-lg hover:bg-muted/50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Deadline banner ─────────────────────────────────────────────────────
function DeadlineBanner() {
  const now = new Date();
  const year = now.getFullYear();
  // CCHEN: informe anual debe presentarse antes del 31 de marzo del año siguiente
  const deadline = new Date(year, 2, 31); // 31 marzo del año en curso
  const daysToDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24));

  if (daysToDeadline < 0) {
    // Ya pasó → próximo año
    const next = new Date(year + 1, 2, 31);
    const d2 = Math.floor((next.getTime() - now.getTime()) / (1000 * 3600 * 24));
    if (d2 <= 90) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Calendar size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Plazo informe anual {year}:</strong> 31 de marzo {year + 1} ({d2} días restantes). Iniciar preparación del informe.
          </p>
        </div>
      );
    }
    return null;
  }

  if (daysToDeadline <= 90) {
    const color = daysToDeadline <= 30 ? "red" : "amber";
    return (
      <div className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 mb-4 flex items-center gap-3`}>
        <Calendar size={18} className={`text-${color}-500 flex-shrink-0`} />
        <p className={`text-sm text-${color}-800`}>
          <strong>⚠ Plazo informe anual {year - 1}:</strong> 31 de marzo {year} ({daysToDeadline} días restantes). Completar y enviar a CCHEN.
        </p>
      </div>
    );
  }
  return null;
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function RegulatoryReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterYear) params.set("year", filterYear);
    const r = await fetch(`/api/reports?${params}`);
    const d = await r.json();
    setReports(d.reports || []);
    setStats(d.stats || null);
    setYears(d.years || []);
    setLoading(false);
  }, [filterYear]);

  useEffect(() => { load(); }, [load]);

  const pending = stats
    ? parseInt(stats.draft_count || "0") + parseInt(stats.in_progress_count || "0") + parseInt(stats.review_count || "0")
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText size={24} className="text-blue-600" />
            Reportes Regulatorios CCHEN
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Informe Anual PR · Declaraciones · DS 3/1985 Art. 25 · IAEA GSR Part 3</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Nuevo Reporte
        </button>
      </div>

      {/* Deadline banner */}
      <DeadlineBanner />

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "En elaboración", value: stats ? parseInt(stats.in_progress_count || "0") + parseInt(stats.draft_count || "0") : 0, color: "text-blue-700", bg: "bg-blue-50", icon: <RefreshCw size={18} /> },
          { label: "En revisión", value: stats?.review_count, color: "text-amber-700", bg: "bg-amber-50", icon: <Eye size={18} /> },
          { label: "Enviados CCHEN", value: stats?.submitted_count, color: "text-green-700", bg: "bg-green-50", icon: <Send size={18} /> },
          { label: "Aprobados", value: stats?.approved_count, color: "text-emerald-700", bg: "bg-emerald-50", icon: <CheckCircle size={18} /> },
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className={kpi.color}>{kpi.icon}</span>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{loading ? "…" : (kpi.value || "0")}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
        >
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando reportes…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No hay reportes registrados</div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => <ReportCard key={r.id} report={r} onRefresh={load} />)}
        </div>
      )}

      {/* Checklist resumen */}
      <div className="mt-8 bg-blue-50 rounded-xl p-5">
        <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Shield size={16} /> Obligaciones regulatorias anuales CCHEN
        </p>
        <ul className="text-xs text-blue-800 space-y-1.5">
          <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 flex-shrink-0" /> Informe Anual Protección Radiológica (plazo: 31 marzo siguiente)</li>
          <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 flex-shrink-0" /> Declaración semestral inventario fuentes radiactivas selladas</li>
          <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 flex-shrink-0" /> Notificación de incidentes radiológicos (plazo: 24h para eventos graves)</li>
          <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 flex-shrink-0" /> Renovación anual de licencias y autorizaciones</li>
          <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 flex-shrink-0" /> Mantención y actualización del Programa de Protección Radiológica</li>
        </ul>
      </div>

      {/* Normativa footer */}
      <div className="mt-4 p-4 bg-muted/50 rounded-xl text-xs text-muted-foreground">
        <p className="font-medium text-foreground/80 mb-1">Marco Regulatorio</p>
        <p>DS 3/1985 Arts. 25-30 (obligaciones de reporte) · CCHEN: Reglamento de Licencias e Informe Anual · IAEA GSR Part 3 Req. 11 (registro y notificación) · Ley 20.936 (Sistema de Calidad en Salud)</p>
      </div>

      {showForm && <ReportForm onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
