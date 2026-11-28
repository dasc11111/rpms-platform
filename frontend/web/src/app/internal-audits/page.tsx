"use client";

// §158 — Auditorías Internas de Protección Radiológica
// DS 3/1985 Arts. 55-57 · CCHEN NS-05.0 §11 · IAEA GSR Part 3 Req. 31

import { useEffect, useState, useCallback } from "react";
import {
  ClipboardCheck, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp,
  Plus, X, FileText, Calendar, User, Flag, TrendingUp
} from "lucide-react";

interface AuditPlan {
  id: number;
  audit_code: string;
  audit_type: string;
  title: string;
  scope: string;
  area_audited: string;
  lead_auditor: string;
  team_members: string;
  planned_date: string;
  actual_date: string;
  status: string;
  overall_result: string;
  summary: string;
  cchen_notified: boolean;
  total_findings: number;
  open_findings: number;
  critical_major_open: number;
}

interface Finding {
  id: number;
  audit_id: number;
  finding_code: string;
  severity: string;
  category: string;
  description: string;
  reference_norm: string;
  corrective_action: string;
  responsible: string;
  due_date: string;
  completion_date: string;
  status: string;
  notes: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned:     { label: "Planificada",   color: "text-blue-700",   bg: "bg-blue-100" },
  in_progress: { label: "En curso",      color: "text-yellow-700", bg: "bg-yellow-100" },
  completed:   { label: "Completada",    color: "text-green-700",  bg: "bg-green-100" },
  cancelled:   { label: "Cancelada",     color: "text-foreground/80",   bg: "bg-muted" },
};

const RESULT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  satisfactory:    { label: "Satisfactoria",         color: "text-green-700",  icon: <CheckCircle className="w-4 h-4" /> },
  minor_findings:  { label: "Hallazgos menores",     color: "text-yellow-700", icon: <Flag className="w-4 h-4" /> },
  major_findings:  { label: "Hallazgos mayores",     color: "text-orange-700", icon: <AlertTriangle className="w-4 h-4" /> },
  critical:        { label: "Hallazgo crítico",      color: "text-red-700",    icon: <AlertTriangle className="w-4 h-4" /> },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical:    { label: "Crítico",      color: "text-red-800",    bg: "bg-red-100" },
  major:       { label: "Mayor",        color: "text-orange-800", bg: "bg-orange-100" },
  minor:       { label: "Menor",        color: "text-yellow-800", bg: "bg-yellow-100" },
  observation: { label: "Observación",  color: "text-blue-800",   bg: "bg-blue-100" },
};

const FINDING_STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: "Abierto",      color: "text-red-600" },
  in_progress: { label: "En progreso",  color: "text-yellow-600" },
  overdue:     { label: "Vencido",      color: "text-red-800" },
  closed:      { label: "Cerrado",      color: "text-green-600" },
  verified:    { label: "Verificado",   color: "text-green-800" },
};

const CATEGORY_LABELS: Record<string, string> = {
  documentation: "Documentación",
  training:      "Capacitación",
  equipment:     "Equipos",
  procedures:    "Procedimientos",
  shielding:     "Blindajes",
  dosimetry:     "Dosimetría",
  sources:       "Fuentes",
  waste:         "Residuos",
  emergency:     "Emergencias",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function FindingRow({ finding, onUpdate }: { finding: Finding; onUpdate: () => void }) {
  const sev = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.observation;
  const st = FINDING_STATUS[finding.status] ?? { label: finding.status, color: "text-muted-foreground" };
  const isOverdue = finding.due_date && finding.status === "open" && new Date(finding.due_date) < new Date();

  async function closeFind() {
    await fetch(`/api/internal-audits?finding_id=${finding.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", completion_date: new Date().toISOString().split("T")[0] }),
    });
    onUpdate();
  }

  return (
    <div className={`bg-background rounded-lg border p-3 ${isOverdue ? "border-red-300" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${sev.bg} ${sev.color}`}>
          {sev.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-muted-foreground">{finding.finding_code}</span>
            {finding.category && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {CATEGORY_LABELS[finding.category] ?? finding.category}
              </span>
            )}
            <span className={`text-xs font-medium ${st.color} ${isOverdue ? "!text-red-700" : ""}`}>
              {isOverdue ? "⚠ Vencido" : st.label}
            </span>
          </div>
          <p className="text-sm text-foreground">{finding.description}</p>
          {finding.reference_norm && (
            <p className="text-xs text-muted-foreground mt-1">Ref: {finding.reference_norm}</p>
          )}
          {finding.corrective_action && (
            <p className="text-xs text-blue-700 mt-1 bg-blue-50 rounded px-2 py-1">
              <strong>AC:</strong> {finding.corrective_action}
            </p>
          )}
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            {finding.responsible && <span>👤 {finding.responsible}</span>}
            {finding.due_date && <span>📅 Plazo: {formatDate(finding.due_date)}</span>}
            {finding.completion_date && <span>✅ Cierre: {formatDate(finding.completion_date)}</span>}
          </div>
        </div>
        {(finding.status === "open" || finding.status === "in_progress") && (
          <button onClick={closeFind}
            className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded flex-shrink-0">
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}

function AuditCard({ audit, onRefresh }: { audit: AuditPlan; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const st = STATUS_CONFIG[audit.status] ?? STATUS_CONFIG.planned;
  const result = audit.overall_result ? RESULT_CONFIG[audit.overall_result] : null;
  const isCritical = Number(audit.critical_major_open) > 0;

  const daysToPlanned = audit.planned_date ? daysUntil(audit.planned_date) : null;

  async function loadFindings() {
    if (findings.length) return;
    setLoadingFindings(true);
    try {
      const r = await fetch(`/api/internal-audits?id=${audit.id}`);
      const d = await r.json();
      setFindings(d.findings ?? []);
    } finally {
      setLoadingFindings(false);
    }
  }

  async function startAudit() {
    await fetch(`/api/internal-audits?id=${audit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", actual_date: new Date().toISOString().split("T")[0] }),
    });
    onRefresh();
  }

  function toggleExpand() {
    if (!expanded) loadFindings();
    setExpanded(x => !x);
  }

  return (
    <div className={`bg-background rounded-xl border-2 shadow-sm ${isCritical ? "border-orange-300" : "border-border"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 flex-shrink-0">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-muted-foreground">{audit.audit_code}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>{st.label}</span>
              {result && (
                <span className={`text-xs flex items-center gap-1 font-medium ${result.color}`}>
                  {result.icon}{result.label}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-foreground text-sm">{audit.title}</h3>
            {audit.area_audited && (
              <p className="text-xs text-muted-foreground mt-0.5">{audit.area_audited}</p>
            )}
          </div>
          <button onClick={toggleExpand} className="text-muted-foreground hover:text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Key row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block">Auditor líder</span>
            <span className="text-foreground/80 font-medium">{audit.lead_auditor ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Fecha planificada</span>
            <span className={`font-medium ${daysToPlanned !== null && daysToPlanned < 7 && audit.status === "planned" ? "text-orange-600" : "text-foreground/80"}`}>
              {formatDate(audit.planned_date)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Hallazgos</span>
            <span className={`font-medium ${Number(audit.open_findings) > 0 ? "text-orange-600" : "text-foreground/80"}`}>
              {Number(audit.open_findings)} abiertos / {Number(audit.total_findings)} total
            </span>
          </div>
        </div>

        {/* Actions */}
        {audit.status === "planned" && (
          <button onClick={startAudit}
            className="mt-3 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg">
            Iniciar auditoría
          </button>
        )}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-3">
          {audit.scope && (
            <div>
              <span className="text-xs font-semibold text-foreground/80 block mb-1">Alcance</span>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{audit.scope}</p>
            </div>
          )}
          {audit.summary && (
            <div>
              <span className="text-xs font-semibold text-foreground/80 block mb-1">Resumen</span>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{audit.summary}</p>
            </div>
          )}
          <div>
            <span className="text-xs font-semibold text-foreground/80 block mb-2">Hallazgos</span>
            {loadingFindings ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : findings.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin hallazgos registrados</p>
            ) : (
              <div className="space-y-2">
                {findings.map(f => (
                  <FindingRow key={f.id} finding={f} onUpdate={() => {
                    setFindings([]);
                    loadFindings();
                    onRefresh();
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InternalAuditsPage() {
  const [audits, setAudits] = useState<AuditPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    audit_type: "annual_full",
    title: "",
    scope: "",
    area_audited: "",
    lead_auditor: "",
    planned_date: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/internal-audits");
      const d = await r.json();
      setAudits(d.audits ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createAudit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/internal-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      setShowNewModal(false);
      setNewForm({ audit_type: "annual_full", title: "", scope: "", area_audited: "", lead_auditor: "", planned_date: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  const filtered = audits.filter(a => filterStatus === "all" || a.status === filterStatus);

  const stats = {
    planned: audits.filter(a => a.status === "planned").length,
    inProgress: audits.filter(a => a.status === "in_progress").length,
    completed: audits.filter(a => a.status === "completed").length,
    openFindings: audits.reduce((acc, a) => acc + Number(a.open_findings), 0),
    criticalOpen: audits.reduce((acc, a) => acc + Number(a.critical_major_open), 0),
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-blue-600" />
            Auditorías Internas de PR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">DS 3/1985 Arts. 55–57 · CCHEN NS-05.0 §11 · IAEA GSR Part 3 Req. 31</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Nueva auditoría
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Planificadas", value: stats.planned, icon: <Calendar className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "En curso", value: stats.inProgress, icon: <TrendingUp className="w-5 h-5" />, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Completadas", value: stats.completed, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50" },
          { label: "Hallazgos abiertos", value: stats.openFindings, icon: <Flag className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Críticos/Mayores", value: stats.criticalOpen, icon: <AlertTriangle className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50" },
        ].map(t => (
          <div key={t.label} className={`${t.bg} rounded-xl p-3`}>
            <div className={`${t.color} mb-1`}>{t.icon}</div>
            <div className={`text-2xl font-bold ${t.color}`}>{t.value}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} auditoría(s)</span>
      </div>

      {/* Audit cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando auditorías...</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(a => (
            <AuditCard key={a.id} audit={a} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Marco regulatorio aplicable
        </p>
        <p>• <strong>DS 3/1985 Arts. 55–57:</strong> Obligación de auditorías periódicas del programa de PR</p>
        <p>• <strong>CCHEN NS-05.0 §11:</strong> Requisitos mínimos para auditorías internas — frecuencia, alcance y documentación</p>
        <p>• <strong>IAEA GSR Part 3 Req. 31:</strong> Mejora continua de la infraestructura de protección radiológica</p>
        <p>• <strong>IAEA Safety Reports Series N°37:</strong> Guía para auditorías de PR en instalaciones médicas</p>
        <p className="text-blue-700 mt-2">ℹ La frecuencia mínima exigida por CCHEN NS-05.0 es una auditoría completa cada 12 meses. Hallazgos críticos requieren notificación a CCHEN.</p>
      </div>

      {/* New audit modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-foreground">Nueva auditoría interna</h3>
              <button onClick={() => setShowNewModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={createAudit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground/80 mb-1">Tipo</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newForm.audit_type} onChange={e => setNewForm(f => ({ ...f, audit_type: e.target.value }))}>
                    <option value="annual_full">Anual completa</option>
                    <option value="targeted">Focalizada</option>
                    <option value="follow_up">Seguimiento</option>
                    <option value="surprise">Sorpresa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground/80 mb-1">Fecha planificada</label>
                  <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newForm.planned_date} onChange={e => setNewForm(f => ({ ...f, planned_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground/80 mb-1">Título *</label>
                <input type="text" required className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej. Auditoría Anual Protección Radiológica 2026"
                  value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground/80 mb-1">Área auditada</label>
                <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej. Medicina Nuclear, Radioterapia, PET-CT"
                  value={newForm.area_audited} onChange={e => setNewForm(f => ({ ...f, area_audited: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground/80 mb-1">Alcance</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2}
                  placeholder="Descripción del alcance de la auditoría..."
                  value={newForm.scope} onChange={e => setNewForm(f => ({ ...f, scope: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground/80 mb-1">Auditor líder</label>
                <input type="text" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del auditor líder"
                  value={newForm.lead_auditor} onChange={e => setNewForm(f => ({ ...f, lead_auditor: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-foreground/80 hover:bg-muted/50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Creando..." : "Crear auditoría"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
