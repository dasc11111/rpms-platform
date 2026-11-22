"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, ChevronDown, ChevronUp, Plus, X,
  CheckCircle, Clock, Shield, Activity, Bell, FileText,
  Flame, AlertCircle, Info
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
interface Incident {
  id: number;
  incident_code: string;
  title: string;
  description: string;
  incident_date: string;
  incident_time: string;
  location: string;
  area: string;
  incident_type: string;
  ines_level: number;
  severity: string;
  persons_involved: number;
  estimated_dose_msv: number;
  contamination_detected: boolean;
  immediate_actions: string;
  reported_internally: boolean;
  cchen_notified: boolean;
  cchen_notification_date: string;
  cchen_notification_number: string;
  investigation_status: string;
  root_cause: string;
  corrective_actions: string;
  closure_date: string;
  reported_by: string;
  investigated_by: string;
  approved_by: string;
}

interface IncidentAction {
  id: number;
  incident_id: number;
  action_type: string;
  description: string;
  responsible: string;
  due_date: string;
  completion_date: string;
  status: string;
  notes: string;
}

interface Stats {
  total: string;
  open_count: string;
  in_progress_count: string;
  closed_count: string;
  ines_1_plus: string;
  cchen_pending: string;
  this_year: string;
}

// ── Config ─────────────────────────────────────────────────────────────
const INES_CFG: Record<number, { label: string; color: string; bg: string; border: string }> = {
  0: { label: "INES 0 — Por debajo de escala", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
  1: { label: "INES 1 — Anomalía", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  2: { label: "INES 2 — Incidente", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  3: { label: "INES 3 — Incidente grave", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  4: { label: "INES 4 — Accidente sin riesgo significativo", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  5: { label: "INES 5 — Accidente con riesgo externo", color: "text-red-800", bg: "bg-red-100", border: "border-red-300" },
  6: { label: "INES 6 — Accidente grave", color: "text-red-900", bg: "bg-red-200", border: "border-red-400" },
  7: { label: "INES 7 — Accidente mayor", color: "text-purple-900", bg: "bg-purple-100", border: "border-purple-400" },
};

const INCIDENT_TYPES: Record<string, { label: string; icon: JSX.Element }> = {
  spill:          { label: "Derrame radiofármaco", icon: <AlertTriangle size={13} /> },
  loss_device:    { label: "Pérdida dispositivo/dosímetro", icon: <Bell size={13} /> },
  overexposure:   { label: "Sobreexposición", icon: <Activity size={13} /> },
  near_miss:      { label: "Cuasi-accidente", icon: <AlertCircle size={13} /> },
  contamination:  { label: "Contaminación", icon: <Flame size={13} /> },
  equipment_fail: { label: "Falla equipamiento", icon: <Shield size={13} /> },
  dose_error:     { label: "Error en dosis a paciente", icon: <AlertTriangle size={13} /> },
  transport:      { label: "Incidente transporte", icon: <AlertTriangle size={13} /> },
  other:          { label: "Otro", icon: <Info size={13} /> },
};

const INV_STATUS_CFG: Record<string, { label: string; color: string }> = {
  open:        { label: "Abierto", color: "bg-red-100 text-red-700" },
  in_progress: { label: "Investigando", color: "bg-amber-100 text-amber-700" },
  closed:      { label: "Cerrado", color: "bg-green-100 text-green-700" },
  cancelled:   { label: "Cancelado", color: "bg-gray-100 text-gray-600" },
};

const ACTION_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pendiente", color: "text-gray-500" },
  in_progress: { label: "En curso", color: "text-blue-600" },
  completed:   { label: "Completada", color: "text-green-600" },
  cancelled:   { label: "Cancelada", color: "text-gray-400" },
};

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const daysAgo = (d: string): number =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 3600 * 24)) : 0;

// ── ActionRow ───────────────────────────────────────────────────────────
function ActionRow({ action, onUpdate }: { action: IncidentAction; onUpdate: () => void }) {
  const st = ACTION_STATUS[action.status] || ACTION_STATUS.pending;
  const overdue = action.due_date && !action.completion_date && new Date(action.due_date) < new Date();

  const complete = async () => {
    await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _type: "action_update",
        action_id: action.id,
        status: "completed",
        completion_date: new Date().toISOString().split("T")[0]
      })
    });
    onUpdate();
  };

  return (
    <tr className={`border-b border-gray-50 ${overdue ? "bg-red-50" : ""}`}>
      <td className="px-2 py-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${action.action_type === "corrective" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
          {action.action_type === "corrective" ? "Correctiva" : "Preventiva"}
        </span>
      </td>
      <td className="px-2 py-2 text-xs">{action.description}</td>
      <td className="px-2 py-2 text-xs">{action.responsible || "—"}</td>
      <td className={`px-2 py-2 text-xs ${overdue ? "text-red-600 font-medium" : ""}`}>{fmtDate(action.due_date)}</td>
      <td className={`px-2 py-2 text-xs font-medium ${st.color}`}>{st.label}</td>
      <td className="px-2 py-2">
        {action.status !== "completed" && action.status !== "cancelled" && (
          <button onClick={complete} className="text-xs text-green-600 hover:text-green-800">
            ✓
          </button>
        )}
      </td>
    </tr>
  );
}

// ── IncidentCard ─────────────────────────────────────────────────────────
function IncidentCard({ incident, onRefresh }: { incident: Incident; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [newAction, setNewAction] = useState({ action_type: "corrective", description: "", responsible: "", due_date: "" });
  const [savingAction, setSavingAction] = useState(false);

  const loadActions = async () => {
    if (!loaded) {
      const r = await fetch(`/api/incidents?id=${incident.id}`);
      const d = await r.json();
      setActions(d.actions || []);
      setLoaded(true);
    }
    setOpen(true);
  };

  const toggle = () => { if (!open) loadActions(); else setOpen(false); };

  const addAction = async () => {
    setSavingAction(true);
    await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "action", incident_id: incident.id, ...newAction })
    });
    setSavingAction(false);
    setShowActionForm(false);
    setNewAction({ action_type: "corrective", description: "", responsible: "", due_date: "" });
    setLoaded(false);
    loadActions();
  };

  const ines = INES_CFG[incident.ines_level] || INES_CFG[0];
  const itype = INCIDENT_TYPES[incident.incident_type] || INCIDENT_TYPES.other;
  const invStatus = INV_STATUS_CFG[incident.investigation_status] || INV_STATUS_CFG.open;
  const isOpen = incident.investigation_status !== "closed" && incident.investigation_status !== "cancelled";

  const pendingActions = actions.filter(a => a.status !== "completed" && a.status !== "cancelled").length;

  return (
    <div className={`bg-white border-2 ${ines.border} rounded-xl shadow-sm overflow-hidden`}>
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{incident.incident_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ines.bg} ${ines.color}`}>{ines.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${invStatus.color}`}>{invStatus.label}</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              {itype.icon} {itype.label}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{incident.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDate(incident.incident_date)}
            {incident.incident_time && ` ${incident.incident_time.substring(0, 5)}`}
            {incident.location && ` · ${incident.location}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {incident.contamination_detected && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              ☢ Contaminación
            </span>
          )}
          {!incident.cchen_notified && incident.ines_level >= 1 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              ⚠ CCHEN pendiente
            </span>
          )}
          <button onClick={toggle} className="text-gray-400 hover:text-gray-600">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Action badge */}
      {pendingActions > 0 && (
        <div className="px-4 pb-3">
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            {pendingActions} acción(es) pendiente(s)
          </span>
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {/* Description */}
          {incident.description && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 font-medium mb-1">Descripción del evento</p>
              <p className="text-sm text-gray-800">{incident.description}</p>
            </div>
          )}

          {/* Facts grid */}
          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Personas involucradas</p>
              <p className="font-semibold text-lg">{incident.persons_involved ?? 0}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Dosis estimada</p>
              <p className="font-semibold text-lg">
                {incident.estimated_dose_msv ? `${incident.estimated_dose_msv} mSv` : "N/D"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Días desde evento</p>
              <p className="font-semibold text-lg">{daysAgo(incident.incident_date)}</p>
            </div>
          </div>

          {/* Immediate actions */}
          {incident.immediate_actions && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-blue-900 mb-1">Acciones inmediatas tomadas</p>
              <p className="text-xs text-blue-800">{incident.immediate_actions}</p>
            </div>
          )}

          {/* Root cause */}
          {incident.root_cause && (
            <div className="bg-amber-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-amber-900 mb-1">Causa raíz identificada</p>
              <p className="text-xs text-amber-800">{incident.root_cause}</p>
            </div>
          )}

          {/* CCHEN notification */}
          <div className={`rounded-lg p-3 mb-4 ${incident.cchen_notified ? "bg-green-50" : incident.ines_level >= 1 ? "bg-red-50" : "bg-gray-50"}`}>
            <p className="text-xs font-semibold mb-1">
              Notificación CCHEN: {incident.cchen_notified ? "✓ Notificado" : incident.ines_level >= 1 ? "✗ Pendiente (obligatorio INES ≥1)" : "No requerida"}
            </p>
            {incident.cchen_notification_number && (
              <p className="text-xs">N° notificación: {incident.cchen_notification_number} · {fmtDate(incident.cchen_notification_date)}</p>
            )}
          </div>

          {/* Responsibles */}
          <div className="grid grid-cols-3 gap-3 text-xs mb-4 text-gray-600">
            {incident.reported_by && <div><span className="font-medium">Reportado por:</span> {incident.reported_by}</div>}
            {incident.investigated_by && <div><span className="font-medium">Investigado por:</span> {incident.investigated_by}</div>}
            {incident.approved_by && <div><span className="font-medium">Aprobado por:</span> {incident.approved_by}</div>}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">Acciones correctivas / preventivas</p>
              {isOpen && (
                <button onClick={() => setShowActionForm(!showActionForm)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <Plus size={12} /> Agregar acción
                </button>
              )}
            </div>

            {showActionForm && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <select className="border rounded px-2 py-1.5" value={newAction.action_type} onChange={e => setNewAction(p => ({ ...p, action_type: e.target.value }))}>
                    <option value="corrective">Correctiva</option>
                    <option value="preventive">Preventiva</option>
                  </select>
                  <input type="date" className="border rounded px-2 py-1.5" value={newAction.due_date} onChange={e => setNewAction(p => ({ ...p, due_date: e.target.value }))} />
                  <input className="col-span-2 border rounded px-2 py-1.5" placeholder="Descripción de la acción *" value={newAction.description} onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))} />
                  <input className="col-span-2 border rounded px-2 py-1.5" placeholder="Responsable" value={newAction.responsible} onChange={e => setNewAction(p => ({ ...p, responsible: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={addAction} disabled={savingAction || !newAction.description} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                    {savingAction ? "Guardando…" : "Agregar"}
                  </button>
                  <button onClick={() => setShowActionForm(false)} className="border px-3 py-1 rounded text-xs hover:bg-gray-50">Cancelar</button>
                </div>
              </div>
            )}

            {actions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin acciones registradas</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Tipo</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Descripción</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Responsable</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Plazo</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Estado</th>
                    <th className="px-2 py-1.5 border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map(a => (
                    <ActionRow key={a.id} action={a} onUpdate={() => { setLoaded(false); loadActions(); }} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Closure info */}
          {incident.investigation_status === "closed" && incident.closure_date && (
            <div className="bg-green-50 rounded-lg p-3 mt-3">
              <p className="text-xs font-semibold text-green-900">✓ Incidente cerrado — {fmtDate(incident.closure_date)}</p>
              {incident.closure_notes && <p className="text-xs text-green-800 mt-0.5">{incident.closure_notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── IncidentForm ─────────────────────────────────────────────────────────
function IncidentForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: "", description: "", incident_date: today, incident_time: "",
    location: "", area: "", incident_type: "near_miss", ines_level: "0",
    severity: "low", persons_involved: "0", estimated_dose_msv: "",
    contamination_detected: false, immediate_actions: "",
    reported_internally: true, internal_report_date: today,
    cchen_notified: false, reported_by: ""
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ines_level: parseInt(form.ines_level),
        persons_involved: parseInt(form.persons_involved),
        estimated_dose_msv: form.estimated_dose_msv ? parseFloat(form.estimated_dose_msv) : null
      })
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-10">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" /> Registrar Incidente Radiológico
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm max-h-[75vh] overflow-y-auto">
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Título del incidente *</label>
            <input className="w-full border rounded px-3 py-2" value={form.title} onChange={e => f("title", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha *</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.incident_date} onChange={e => f("incident_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hora</label>
            <input type="time" className="w-full border rounded px-3 py-2" value={form.incident_time} onChange={e => f("incident_time", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tipo de incidente *</label>
            <select className="w-full border rounded px-3 py-2" value={form.incident_type} onChange={e => f("incident_type", e.target.value)}>
              {Object.entries(INCIDENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nivel INES</label>
            <select className="w-full border rounded px-3 py-2" value={form.ines_level} onChange={e => f("ines_level", e.target.value)}>
              {Object.entries(INES_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ubicación</label>
            <input className="w-full border rounded px-3 py-2" value={form.location} onChange={e => f("location", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Área específica</label>
            <input className="w-full border rounded px-3 py-2" value={form.area} onChange={e => f("area", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Personas involucradas</label>
            <input type="number" min="0" className="w-full border rounded px-3 py-2" value={form.persons_involved} onChange={e => f("persons_involved", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Dosis estimada (mSv)</label>
            <input type="number" step="any" className="w-full border rounded px-3 py-2" placeholder="opcional" value={form.estimated_dose_msv} onChange={e => f("estimated_dose_msv", e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.contamination_detected} onChange={e => f("contamination_detected", e.target.checked)} />
              <span className="text-sm">Contaminación radiactiva detectada</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.reported_internally} onChange={e => f("reported_internally", e.target.checked)} />
              <span className="text-sm">Reportado internamente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.cchen_notified} onChange={e => f("cchen_notified", e.target.checked)} />
              <span className="text-sm">Notificado a CCHEN</span>
            </label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Descripción del evento *</label>
            <textarea className="w-full border rounded px-3 py-2" rows={3} value={form.description} onChange={e => f("description", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Acciones inmediatas tomadas</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.immediate_actions} onChange={e => f("immediate_actions", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Reportado por</label>
            <input className="w-full border rounded px-3 py-2" value={form.reported_by} onChange={e => f("reported_by", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={save} disabled={saving || !form.title || !form.incident_date} className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar incidente"}
          </button>
          <button onClick={onCancel} className="border px-5 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterYear) params.set("year", filterYear);
    const r = await fetch(`/api/incidents?${params}`);
    const d = await r.json();
    setIncidents(d.incidents || []);
    setStats(d.stats || null);
    setYears(d.years || []);
    setLoading(false);
  }, [filterStatus, filterYear]);

  useEffect(() => { load(); }, [load]);

  const openCount = parseInt(stats?.open_count || "0");
  const cchen = parseInt(stats?.cchen_pending || "0");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={24} className="text-red-500" />
            Incidentes Radiológicos
          </h1>
          <p className="text-sm text-gray-500 mt-1">Clasificación INES · DS 3/1985 Arts. 46-50 · IAEA GSR Part 7</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
        >
          <Plus size={16} /> Registrar Incidente
        </button>
      </div>

      {/* Alert banners */}
      {openCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800">
            <strong>{openCount} incidente(s) abierto(s)</strong> pendientes de investigación.
            {cchen > 0 && ` Además, ${cchen} requiere(n) notificación a CCHEN (INES ≥1).`}
          </p>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Este año", value: stats?.this_year, color: "text-gray-700", bg: "bg-gray-50", icon: <FileText size={18} /> },
          { label: "Abiertos", value: stats?.open_count, color: "text-red-700", bg: "bg-red-50", icon: <AlertTriangle size={18} /> },
          { label: "Investigando", value: stats?.in_progress_count, color: "text-amber-700", bg: "bg-amber-50", icon: <Clock size={18} /> },
          { label: "Cerrados", value: stats?.closed_count, color: "text-green-700", bg: "bg-green-50", icon: <CheckCircle size={18} /> },
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className={kpi.color}>{kpi.icon}</span>
            <div>
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{loading ? "…" : (kpi.value || "0")}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(INV_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Incidents list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando incidentes…</div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto text-green-300 mb-3" />
          <p>No se registran incidentes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map(inc => <IncidentCard key={inc.id} incident={inc} onRefresh={load} />)}
        </div>
      )}

      {/* INES scale legend */}
      <div className="mt-8 bg-gray-50 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-800 mb-3">Escala INES (Escala Internacional de Eventos Nucleares y Radiológicos)</p>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(INES_CFG).map(([level, cfg]) => (
            <div key={level} className={`${cfg.bg} border ${cfg.border} rounded-lg p-2`}>
              <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Normativa footer */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Marco Regulatorio</p>
        <p>DS 3/1985 Arts. 46-50 (notificación de accidentes) · IAEA GSR Part 7 (preparación y respuesta) · IAEA INES User Manual 2008 · Obligación CCHEN: notificación inmediata eventos INES ≥1</p>
      </div>

      {showForm && <IncidentForm onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
