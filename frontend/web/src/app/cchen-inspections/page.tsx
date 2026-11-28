"use client";


import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, ChevronDown, ChevronUp, Plus, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, XCircle, Shield,
  Calendar, User, FileText, ExternalLink, Printer, Flag
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

// §79 — Seguimiento de Recomendaciones de Inspecciones CCHEN
// DS 3/1985 Art. 15 + NS-06.0 §8.2

interface Finding {
  id: number;
  inspection_id: number;
  finding_code: string;
  finding_type: "critical" | "major" | "minor" | "recommendation" | "observation";
  description: string;
  area: string;
  ns_reference: string;
  responsible: string;
  due_date: string;
  completion_date: string;
  status: "pending" | "in_progress" | "completed" | "verified" | "cancelled";
  action_taken: string;
  evidence: string;
  notes: string;
}

interface Inspection {
  id: number;
  inspection_code: string;
  inspection_date: string;
  inspection_type: string;
  inspectors: string;
  cchen_report_number: string;
  areas_inspected: string;
  overall_rating: "satisfactory" | "conditional" | "unsatisfactory" | "critical";
  total_findings: number;
  critical_findings: number;
  status: "open" | "in_progress" | "closed" | "verified_cchen";
  next_inspection_date: string;
  notes: string;
  findings_total: number;
  findings_done: number;
  findings_overdue: number;
}

interface Stats {
  total_inspections: number;
  open_inspections: number;
  total_findings: number;
  pending_findings: number;
  inprogress_findings: number;
  closed_findings: number;
  open_critical: number;
  overdue_findings: number;
}

const TYPE_LABELS: Record<string, string> = {
  routine: "Rutinaria", announced: "Anunciada", unannounced: "No anunciada",
  follow_up: "Seguimiento", licensing: "Licencia"
};
const RATING_LABELS: Record<string, string> = {
  satisfactory: "Satisfactoria", conditional: "Condicional",
  unsatisfactory: "No satisfactoria", critical: "Crítica"
};
const FINDING_LABELS: Record<string, string> = {
  critical: "Crítico", major: "Mayor", minor: "Menor",
  recommendation: "Recomendación", observation: "Observación"
};
const STATUS_LABELS: Record<string, string> = {
  open: "Abierta", in_progress: "En Progreso", closed: "Cerrada", verified_cchen: "Verificada CCHEN",
  pending: "Pendiente", completed: "Completado", verified: "Verificado", cancelled: "Anulado"
};

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLeft(d: string): number {
  if (!d) return Infinity;
  return Math.ceil((new Date(d + "T12:00:00").getTime() - Date.now()) / 86400000);
}

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    satisfactory: "bg-green-100 text-green-800",
    conditional: "bg-yellow-100 text-yellow-800",
    unsatisfactory: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[rating] ?? "bg-muted text-foreground/80"}`}>
      {RATING_LABELS[rating] ?? rating}
    </span>
  );
}

function FindingTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-600 text-white", major: "bg-orange-500 text-white",
    minor: "bg-yellow-500 text-white", recommendation: "bg-blue-500 text-white",
    observation: "bg-gray-500 text-white"
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${colors[type] ?? "bg-muted text-foreground/80"}`}>
      {FINDING_LABELS[type] ?? type}
    </span>
  );
}

function FindingStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-muted text-foreground/80",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    verified: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-700"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] ?? "bg-muted text-foreground/80"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DueDateChip({ due_date, completion_date, status }: { due_date: string; completion_date: string; status: string }) {
  if (!due_date) return null;
  if (completion_date || status === "completed" || status === "verified") {
    return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} />Completado {fmtDate(completion_date)}</span>;
  }
  const days = daysLeft(due_date);
  if (days < 0) return <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><XCircle size={12} />Vencido hace {Math.abs(days)}d</span>;
  if (days <= 30) return <span className="text-xs text-orange-600 flex items-center gap-1"><AlertTriangle size={12} />Vence en {days}d ({fmtDate(due_date)})</span>;
  return <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={12} />Plazo: {fmtDate(due_date)}</span>;
}

function ComplianceBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);
  const color = pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-semibold text-foreground/80 w-14 text-right">{done}/{total} ({pct}%)</span>
    </div>
  );
}

function FindingCard({ f, onUpdate }: { f: Finding; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState(f.action_taken ?? "");
  const [evidence, setEvidence] = useState(f.evidence ?? "");
  const [status, setStatus] = useState(f.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/cchen-inspections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "finding", id: f.id, status, action_taken: action, evidence,
        ...(status === "completed" && !f.completion_date ? { completion_date: new Date().toISOString().slice(0, 10) } : {}) }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  const borderColor = { critical: "border-red-500", major: "border-orange-400", minor: "border-yellow-400", recommendation: "border-blue-400", observation: "border-gray-400" }[f.finding_type] ?? "border-border";

  return (
    <div className={`border-l-4 ${borderColor} bg-background rounded-r-lg p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{f.finding_code}</span>
          <FindingTypeBadge type={f.finding_type} />
          <FindingStatusBadge status={f.status} />
        </div>
        <button onClick={() => setEditing(!editing)}
          className="text-xs text-blue-600 hover:underline">
          {editing ? "Cancelar" : "Actualizar"}
        </button>
      </div>
      <p className="mt-2 text-sm text-foreground">{f.description}</p>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {f.area && <span className="flex items-center gap-1"><Shield size={12} />{f.area}</span>}
        {f.responsible && <span className="flex items-center gap-1"><User size={12} />{f.responsible}</span>}
        {f.ns_reference && <span className="flex items-center gap-1"><FileText size={12} />{f.ns_reference}</span>}
      </div>
      <div className="mt-2">
        <DueDateChip due_date={f.due_date} completion_date={f.completion_date} status={f.status} />
      </div>
      {f.action_taken && !editing && (
        <div className="mt-2 p-2 bg-green-50 rounded text-xs text-foreground/80">
          <strong>Acción:</strong> {f.action_taken}
        </div>
      )}
      {f.evidence && !editing && (
        <div className="mt-1 text-xs text-muted-foreground"><strong>Evidencia:</strong> {f.evidence}</div>
      )}
      {editing && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value as Finding["status"])}
              className="mt-1 w-full border rounded px-2 py-1.5 text-sm">
              <option value="pending">Pendiente</option>
              <option value="in_progress">En Progreso</option>
              <option value="completed">Completado</option>
              <option value="verified">Verificado CCHEN</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Acción tomada</label>
            <textarea value={action} onChange={e => setAction(e.target.value)} rows={3}
              className="mt-1 w-full border rounded px-2 py-1.5 text-sm resize-none"
              placeholder="Describe la acción tomada para subsanar el hallazgo..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Evidencia (documentos, certificados)</label>
            <input value={evidence} onChange={e => setEvidence(e.target.value)}
              className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
              placeholder="Ej: Certificado CAL-2024-089, Procedimiento PR-005 Rev.3" />
          </div>
          <button onClick={save} disabled={saving}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

function InspectionCard({ insp, onUpdate }: { insp: Inspection; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingF, setLoadingF] = useState(false);
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [newFinding, setNewFinding] = useState({ finding_type: "minor", description: "", area: "", responsible: "", due_date: "", ns_reference: "" });
  const [savingF, setSavingF] = useState(false);

  async function loadFindings() {
    setLoadingF(true);
    const r = await fetch(`/api/cchen-inspections?insp_id=${insp.id}`);
    const d = await r.json();
    setFindings(d.findings ?? []);
    setLoadingF(false);
  }

  async function addFinding() {
    setSavingF(true);
    await fetch("/api/cchen-inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "finding", inspection_id: insp.id,
        finding_code: `HALL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        ...newFinding }),
    });
    setSavingF(false);
    setShowAddFinding(false);
    setNewFinding({ finding_type: "minor", description: "", area: "", responsible: "", due_date: "", ns_reference: "" });
    loadFindings();
    onUpdate();
  }

  async function quickStatus(status: string) {
    await fetch("/api/cchen-inspections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: insp.id, status }),
    });
    onUpdate();
  }

  useEffect(() => { if (expanded) loadFindings(); }, [expanded]);

  const borderColor = {
    satisfactory: "border-green-500", conditional: "border-yellow-500",
    unsatisfactory: "border-orange-500", critical: "border-red-600"
  }[insp.overall_rating] ?? "border-border";

  const statusColor = {
    open: "bg-blue-50 text-blue-800", in_progress: "bg-yellow-50 text-yellow-800",
    closed: "bg-green-50 text-green-800", verified_cchen: "bg-emerald-50 text-emerald-800"
  }[insp.status] ?? "bg-muted/50 text-foreground/80";

  const pct = insp.findings_total === 0 ? 100 : Math.round((insp.findings_done / insp.findings_total) * 100);

  return (
    <div className={`border-l-4 ${borderColor} bg-background rounded-r-xl shadow p-5`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{insp.inspection_code}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{STATUS_LABELS[insp.status]}</span>
            {insp.cchen_report_number && (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText size={12} />{insp.cchen_report_number}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-foreground">{TYPE_LABELS[insp.inspection_type] ?? insp.inspection_type}</span>
            <RatingBadge rating={insp.overall_rating} />
            <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar size={13} />{fmtDate(insp.inspection_date)}</span>
          </div>
          {insp.inspectors && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><User size={12} />{insp.inspectors}</p>}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground/80">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="cchen-inspections"
        ownerType="module"
        title="Documentos del módulo"
      />

      {/* Hallazgos summary */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-muted/50 rounded p-2">
          <div className="font-bold text-lg text-foreground">{insp.findings_total}</div>
          <div className="text-muted-foreground">Hallazgos</div>
        </div>
        <div className={`rounded p-2 ${insp.critical_findings > 0 ? "bg-red-50" : "bg-muted/50"}`}>
          <div className={`font-bold text-lg ${insp.critical_findings > 0 ? "text-red-600" : "text-foreground"}`}>{insp.critical_findings}</div>
          <div className="text-muted-foreground">Críticos</div>
        </div>
        <div className={`rounded p-2 ${insp.findings_overdue > 0 ? "bg-orange-50" : "bg-muted/50"}`}>
          <div className={`font-bold text-lg ${insp.findings_overdue > 0 ? "text-orange-600" : "text-foreground"}`}>{insp.findings_overdue}</div>
          <div className="text-muted-foreground">Vencidos</div>
        </div>
      </div>

      {/* Compliance bar */}
      {insp.findings_total > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1">Avance de subsanación</p>
          <ComplianceBar done={insp.findings_done} total={insp.findings_total} />
        </div>
      )}

      {insp.next_inspection_date && (
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={12} />Próxima inspección estimada: {fmtDate(insp.next_inspection_date)}
        </p>
      )}

      {/* Quick actions */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <RowPdfActions module="cchen-inspections" ownerType="cchen_inspection" ownerId={String(insp.id)} size="xs" />
        {insp.status === "open" && (
          <button onClick={() => quickStatus("in_progress")}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Iniciar Seguimiento</button>
        )}
        {insp.status === "in_progress" && pct === 100 && (
          <button onClick={() => quickStatus("closed")}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Marcar Cerrada</button>
        )}
        {insp.status === "closed" && (
          <button onClick={() => quickStatus("verified_cchen")}
            className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700">Verificado por CCHEN</button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 border-t pt-4 space-y-3">
          {insp.areas_inspected && (
            <div className="text-xs text-muted-foreground">
              <strong>Áreas inspeccionadas:</strong> {insp.areas_inspected}
            </div>
          )}
          {insp.notes && (
            <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
              <strong>Notas:</strong> {insp.notes}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground/80 text-sm">Hallazgos y Recomendaciones</h4>
            <button onClick={() => setShowAddFinding(!showAddFinding)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Plus size={12} />Agregar
            </button>
          </div>

          {showAddFinding && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-200">
              <h5 className="text-xs font-semibold text-blue-800">Nuevo Hallazgo / Recomendación</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <select value={newFinding.finding_type}
                    onChange={e => setNewFinding(p => ({ ...p, finding_type: e.target.value }))}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm">
                    <option value="critical">Crítico</option>
                    <option value="major">Mayor</option>
                    <option value="minor">Menor</option>
                    <option value="recommendation">Recomendación</option>
                    <option value="observation">Observación</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Área</label>
                  <input value={newFinding.area}
                    onChange={e => setNewFinding(p => ({ ...p, area: e.target.value }))}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm" placeholder="Ej: Medicina Nuclear" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descripción del hallazgo *</label>
                <textarea value={newFinding.description}
                  onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="mt-1 w-full border rounded px-2 py-1.5 text-sm resize-none"
                  placeholder="Describa el hallazgo o recomendación emitida por CCHEN..." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Responsable</label>
                  <input value={newFinding.responsible}
                    onChange={e => setNewFinding(p => ({ ...p, responsible: e.target.value }))}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm" placeholder="Encargado PR" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Plazo</label>
                  <input type="date" value={newFinding.due_date}
                    onChange={e => setNewFinding(p => ({ ...p, due_date: e.target.value }))}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Referencia NS</label>
                  <input value={newFinding.ns_reference}
                    onChange={e => setNewFinding(p => ({ ...p, ns_reference: e.target.value }))}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm" placeholder="NS-06.0 §..." />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addFinding} disabled={savingF || !newFinding.description}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {savingF ? "Guardando…" : "Agregar Hallazgo"}
                </button>
                <button onClick={() => setShowAddFinding(false)}
                  className="text-sm text-muted-foreground hover:underline">Cancelar</button>
              </div>
            </div>
          )}

          {loadingF ? (
            <div className="text-center text-muted-foreground py-4">Cargando hallazgos…</div>
          ) : findings.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 text-sm">Sin hallazgos registrados</div>
          ) : (
            <div className="space-y-3">
              {findings.map(f => <FindingCard key={f.id} f={f} onUpdate={() => { loadFindings(); onUpdate(); }} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InspectionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().slice(0, 10),
    inspection_type: "routine",
    inspectors: "",
    cchen_report_number: "",
    areas_inspected: "",
    overall_rating: "satisfactory",
    total_findings: 0,
    critical_findings: 0,
    next_inspection_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/cchen-inspections", {
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
        <input type={type} value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
          className="mt-1 w-full border rounded px-2 py-1.5 text-sm" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-foreground">Registrar Inspección CCHEN</h2>
          <p className="text-xs text-muted-foreground mt-1">DS 3/1985 Art. 15 — NS-06.0 §8.2</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {F("Fecha de inspección", "inspection_date", "date")}
            {F("Tipo de inspección", "inspection_type", "select", TYPE_LABELS)}
            {F("N° Informe CCHEN", "cchen_report_number")}
            {F("Calificación general", "overall_rating", "select", RATING_LABELS)}
            {F("Total hallazgos", "total_findings", "number")}
            {F("Hallazgos críticos", "critical_findings", "number")}
            {F("Próxima inspección (estimada)", "next_inspection_date", "date")}
          </div>
          {F("Inspectores", "inspectors")}
          {F("Áreas inspeccionadas", "areas_inspected", "textarea")}
          {F("Observaciones generales", "notes", "textarea")}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar Inspección"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CCHENInspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/cchen-inspections");
    const d = await r.json();
    setInspections(d.inspections ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = inspections.filter(i =>
    (!filterStatus || i.status === filterStatus) &&
    (!filterType || i.inspection_type === filterType)
  );

  const hasOpenCritical = stats && stats.open_critical > 0;
  const hasOverdue = stats && stats.overdue_findings > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="text-blue-600" size={28} />
            Inspecciones CCHEN
          </h1>
          <p className="text-sm text-muted-foreground mt-1">DS 3/1985 Art. 15 · NS-06.0 §8.2 — Seguimiento de hallazgos y recomendaciones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" title="Actualizar">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Plus size={16} />Nueva Inspección
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {hasOpenCritical && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-red-800">Hallazgos críticos pendientes</p>
            <p className="text-xs text-red-700 mt-0.5">
              Hay {stats?.open_critical} hallazgo(s) crítico(s) sin subsanar. Requieren acción inmediata según DS 3/1985 Art. 15.
            </p>
          </div>
        </div>
      )}
      {hasOverdue && !hasOpenCritical && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <Clock className="text-orange-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-orange-800">Hallazgos con plazo vencido</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {stats?.overdue_findings} hallazgo(s) tienen fecha límite superada. Actualice el estado o coordine con CCHEN.
            </p>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Inspecciones", value: stats.total_inspections, sub: `${stats.open_inspections} abiertas`, icon: <ClipboardList size={18} />, color: "text-blue-600" },
            { label: "Total Hallazgos", value: stats.total_findings, sub: `${stats.pending_findings} pendientes`, icon: <Flag size={18} />, color: "text-foreground/80" },
            { label: "Subsanados", value: stats.closed_findings, sub: `de ${stats.total_findings}`, icon: <CheckCircle2 size={18} />, color: "text-green-600" },
            { label: "Vencidos", value: stats.overdue_findings, sub: stats.overdue_findings > 0 ? "⚠ Requieren acción" : "Sin vencidos", icon: <XCircle size={18} />, color: stats.overdue_findings > 0 ? "text-red-600" : "text-muted-foreground" },
          ].map((tile, i) => (
            <div key={i} className="bg-background rounded-xl shadow p-4">
              <div className={`flex items-center gap-2 ${tile.color}`}>
                {tile.icon}
                <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
              </div>
              <div className={`text-3xl font-bold mt-2 ${tile.color}`}>{tile.value ?? "—"}</div>
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
          <option value="open">Abierta</option>
          <option value="in_progress">En Progreso</option>
          <option value="closed">Cerrada</option>
          <option value="verified_cchen">Verificada CCHEN</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          <option value="routine">Rutinaria</option>
          <option value="announced">Anunciada</option>
          <option value="unannounced">No anunciada</option>
          <option value="follow_up">Seguimiento</option>
          <option value="licensing">Licencia</option>
        </select>
      </div>

      {/* Inspection cards */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando inspecciones…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay inspecciones registradas</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-blue-600 hover:underline text-sm">
            Registrar primera inspección
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(insp => (
            <InspectionCard key={insp.id} insp={insp} onUpdate={load} />
          ))}
        </div>
      )}

      {showModal && <InspectionModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
