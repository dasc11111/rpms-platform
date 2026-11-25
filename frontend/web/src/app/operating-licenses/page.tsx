"use client";


import { useState, useEffect, useCallback } from "react";
import {
  FileCheck, ChevronDown, ChevronUp, Plus, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Calendar, User,
  Shield, Zap, Radio, Atom, Trash2, Building2
} from "lucide-react";

// §80 — Gestión de Licencias de Operación CCHEN por Equipo/Área
// DS 3/1985 Art. 6-7 — NS-06.0 §3.1

interface License {
  id: number;
  license_code: string;
  license_type: string;
  equipment_name: string;
  equipment_model: string;
  equipment_serial: string;
  manufacturer: string;
  cchen_license_number: string;
  area: string;
  location: string;
  radiation_type: string;
  activity_or_kvp: string;
  issue_date: string;
  expiry_date: string;
  renewal_lead_days: number;
  status: "active" | "expired" | "suspended" | "cancelled" | "pending_renewal" | "in_process";
  responsible: string;
  cchen_contact: string;
  renewal_submitted_date: string;
  renewal_notes: string;
  conditions: string;
  last_inspection_date: string;
  notes: string;
  days_to_expiry: number;
}

interface Stats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  pending_renewal: number;
  expiring_90d: number;
  expiring_30d: number;
}

interface Renewal {
  id: number;
  renewal_date: string;
  previous_expiry: string;
  new_expiry: string;
  submitted_by: string;
  cchen_reference: string;
  notes: string;
}

const TYPE_LABELS: Record<string, string> = {
  radiation_source: "Fuente Radiactiva",
  xray_equipment: "Equipo RX",
  nuclear_medicine: "Medicina Nuclear",
  irradiator: "Irradiador",
  radioactive_waste: "Residuos Radiactivos",
  area_authorization: "Autorización de Área",
  other: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Vigente", expired: "Vencida", suspended: "Suspendida",
  cancelled: "Cancelada", pending_renewal: "Renovación Pendiente", in_process: "En Trámite"
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  radiation_source: <Atom size={14} />,
  xray_equipment: <Zap size={14} />,
  nuclear_medicine: <Radio size={14} />,
  irradiator: <Zap size={14} />,
  radioactive_waste: <Trash2 size={14} />,
  area_authorization: <Building2 size={14} />,
  other: <Shield size={14} />,
};

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    expired: "bg-red-100 text-red-800",
    suspended: "bg-orange-100 text-orange-800",
    cancelled: "bg-gray-200 text-gray-700",
    pending_renewal: "bg-yellow-100 text-yellow-800",
    in_process: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ExpiryBadge({ days, status }: { days: number; status: string }) {
  if (status === "expired") return (
    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
      <XCircle size={13} />VENCIDA
    </span>
  );
  if (status === "suspended") return (
    <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
      <AlertTriangle size={13} />Suspendida
    </span>
  );
  if (status === "pending_renewal") return (
    <span className="flex items-center gap-1 text-xs text-yellow-700">
      <AlertTriangle size={13} />Renovación enviada
    </span>
  );
  if (days <= 0) return (
    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
      <XCircle size={13} />Vencida hace {Math.abs(days)}d
    </span>
  );
  if (days <= 30) return (
    <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
      <AlertTriangle size={13} />Vence en {days}d
    </span>
  );
  if (days <= 90) return (
    <span className="flex items-center gap-1 text-xs text-orange-600">
      <AlertTriangle size={13} />Vence en {days}d
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 size={13} />Vence en {days}d
    </span>
  );
}

function RenewalModal({ license, onClose, onSaved }: { license: License; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    new_expiry: "",
    submitted_by: "",
    cchen_reference: "",
    documents: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/operating-licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "renewal", license_id: license.id, previous_expiry: license.expiry_date, ...form }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-5 border-b">
          <h2 className="font-bold text-gray-800">Registrar Renovación</h2>
          <p className="text-xs text-gray-500 mt-1">{license.equipment_name} — {license.license_code}</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nueva fecha de vencimiento *</label>
            <input type="date" value={form.new_expiry} onChange={e => setForm(p => ({ ...p, new_expiry: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Presentado por</label>
              <input value={form.submitted_by} onChange={e => setForm(p => ({ ...p, submitted_by: e.target.value }))}
                className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Nombre" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">N° Referencia CCHEN</label>
              <input value={form.cchen_reference} onChange={e => setForm(p => ({ ...p, cchen_reference: e.target.value }))}
                className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="CCH-REN-..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Documentos presentados</label>
            <input value={form.documents} onChange={e => setForm(p => ({ ...p, documents: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Lista de documentos adjuntos" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Observaciones</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} className="mt-1 w-full border rounded px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-600 hover:underline">Cancelar</button>
          <button onClick={save} disabled={saving || !form.new_expiry}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            {saving ? "Registrando…" : "Registrar Renovación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LicenseCard({ lic, onUpdate }: { lic: License; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [showRenewal, setShowRenewal] = useState(false);

  const days = lic.days_to_expiry ?? 999;
  const isUrgent = lic.status === "expired" || lic.status === "suspended" || days <= 30;
  const isWarning = lic.status === "pending_renewal" || (days > 30 && days <= 90);

  const borderColor = lic.status === "expired" || lic.status === "suspended"
    ? "border-red-500"
    : lic.status === "pending_renewal" || isWarning
    ? "border-yellow-500"
    : "border-green-500";

  async function loadRenewals() {
    const r = await fetch(`/api/operating-licenses?lic_id=${lic.id}`);
    const d = await r.json();
    setRenewals(d.renewals ?? []);
  }

  async function quickStatus(status: string) {
    await fetch("/api/operating-licenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lic.id, status }),
    });
    onUpdate();
  }

  useEffect(() => { if (expanded) loadRenewals(); }, [expanded]);

  return (
    <div className={`border-l-4 ${borderColor} bg-white rounded-r-xl shadow p-4`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500">{TYPE_ICONS[lic.license_type]}</span>
            <span className="text-xs font-mono text-gray-400">{lic.license_code}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{TYPE_LABELS[lic.license_type]}</span>
            <StatusBadge status={lic.status} />
          </div>
          <h3 className="mt-1 font-semibold text-gray-800 text-sm leading-tight">{lic.equipment_name}</h3>
          {lic.equipment_model && <p className="text-xs text-gray-500 mt-0.5">{lic.manufacturer ? `${lic.manufacturer} · ` : ""}{lic.equipment_model}{lic.equipment_serial ? ` · S/N: ${lic.equipment_serial}` : ""}</p>}
          {lic.area && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Building2 size={11} />{lic.area}{lic.location ? ` — ${lic.location}` : ""}</p>}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-700">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Expiry info row */}
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {lic.cchen_license_number && (
            <span className="text-xs text-gray-500 flex items-center gap-1"><Shield size={11} />{lic.cchen_license_number}</span>
          )}
          <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={11} />Vence: {fmtDate(lic.expiry_date)}</span>
          {lic.responsible && <span className="text-xs text-gray-500 flex items-center gap-1"><User size={11} />{lic.responsible}</span>}
        </div>
        <ExpiryBadge days={days} status={lic.status} />
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {(lic.status === "active" || lic.status === "pending_renewal") && (
          <button onClick={() => setShowRenewal(true)}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center gap-1">
            <CheckCircle2 size={12} />Registrar Renovación
          </button>
        )}
        {lic.status === "active" && days <= 90 && (
          <button onClick={() => quickStatus("pending_renewal")}
            className="text-xs bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">
            Marcar: Renovación enviada
          </button>
        )}
        {lic.status === "expired" && (
          <button onClick={() => quickStatus("in_process")}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
            Iniciar Trámite
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 border-t pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
            {lic.radiation_type && <div><strong>Radiación:</strong> {lic.radiation_type}</div>}
            {lic.activity_or_kvp && <div><strong>Actividad/kVp:</strong> {lic.activity_or_kvp}</div>}
            {lic.issue_date && <div><strong>Emisión:</strong> {fmtDate(lic.issue_date)}</div>}
            {lic.last_inspection_date && <div><strong>Última inspección:</strong> {fmtDate(lic.last_inspection_date)}</div>}
            {lic.cchen_contact && <div><strong>Contacto CCHEN:</strong> {lic.cchen_contact}</div>}
          </div>
          {lic.conditions && (
            <div className="bg-blue-50 rounded p-3 text-xs">
              <strong className="text-blue-800">Condiciones de licencia:</strong>
              <p className="mt-1 text-gray-700">{lic.conditions}</p>
            </div>
          )}
          {lic.renewal_notes && (
            <div className="bg-yellow-50 rounded p-3 text-xs">
              <strong className="text-yellow-800">Notas de renovación:</strong>
              <p className="mt-1 text-gray-700">{lic.renewal_notes}</p>
            </div>
          )}
          {lic.renewal_submitted_date && (
            <div className="text-xs text-yellow-700 flex items-center gap-1">
              <Calendar size={12} />Renovación presentada el {fmtDate(lic.renewal_submitted_date)}
            </div>
          )}
          {lic.notes && <div className="text-xs text-gray-500">{lic.notes}</div>}

          {/* Renewal history */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Historial de Renovaciones</h4>
            {renewals.length === 0 ? (
              <p className="text-xs text-gray-400">Sin renovaciones registradas</p>
            ) : (
              <div className="space-y-2">
                {renewals.map(r => (
                  <div key={r.id} className="bg-green-50 rounded p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-green-600" />
                      <span className="font-medium">Renovada el {fmtDate(r.renewal_date)}</span>
                      {r.cchen_reference && <span className="text-gray-500">— Ref: {r.cchen_reference}</span>}
                    </div>
                    <div className="mt-1 text-gray-500">
                      {r.previous_expiry && `Anterior: ${fmtDate(r.previous_expiry)} → `}Nueva: {fmtDate(r.new_expiry)}
                    </div>
                    {r.submitted_by && <div className="text-gray-500">Presentado por: {r.submitted_by}</div>}
                    {r.notes && <div className="text-gray-600 mt-1">{r.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRenewal && (
        <RenewalModal license={lic} onClose={() => setShowRenewal(false)} onSaved={() => { onUpdate(); loadRenewals(); }} />
      )}
    </div>
  );
}

function LicenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    license_type: "xray_equipment",
    equipment_name: "",
    equipment_model: "",
    equipment_serial: "",
    manufacturer: "",
    cchen_license_number: "",
    area: "",
    location: "",
    radiation_type: "",
    activity_or_kvp: "",
    issue_date: "",
    expiry_date: "",
    responsible: "",
    conditions: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/operating-licenses", {
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
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {options ? (
        <select value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="mt-1 w-full border rounded px-2 py-1.5 text-sm">
          {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          rows={2} className="mt-1 w-full border rounded px-2 py-1.5 text-sm resize-none" />
      ) : (
        <input type={type} value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          className="mt-1 w-full border rounded px-2 py-1.5 text-sm" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-gray-800">Nueva Licencia de Operación</h2>
          <p className="text-xs text-gray-500 mt-1">DS 3/1985 Art. 6-7 — NS-06.0 §3.1</p>
        </div>
        <div className="p-6 space-y-4">
          {F("Tipo de licencia", "license_type", "select", TYPE_LABELS)}
          {F("Nombre del equipo / fuente *", "equipment_name")}
          <div className="grid grid-cols-2 gap-4">
            {F("Modelo", "equipment_model")}
            {F("N° Serie", "equipment_serial")}
            {F("Fabricante", "manufacturer")}
            {F("N° Licencia CCHEN", "cchen_license_number")}
            {F("Área", "area")}
            {F("Ubicación", "location")}
            {F("Tipo de radiación", "radiation_type")}
            {F("Actividad / kVp", "activity_or_kvp")}
            {F("Fecha de emisión", "issue_date", "date")}
            {F("Fecha de vencimiento *", "expiry_date", "date")}
          </div>
          {F("Responsable", "responsible")}
          {F("Condiciones de licencia", "conditions", "textarea")}
          {F("Observaciones", "notes", "textarea")}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-600 hover:underline">Cancelar</button>
          <button onClick={save} disabled={saving || !form.equipment_name || !form.expiry_date}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar Licencia"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OperatingLicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    const r = await fetch(`/api/operating-licenses?${params}`);
    const d = await r.json();
    setLicenses(d.licenses ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, [filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const hasExpired = stats && (stats.expired > 0 || stats.suspended > 0);
  const hasUrgent = stats && stats.expiring_30d > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="text-blue-600" size={28} />
            Licencias de Operación CCHEN
          </h1>
          <p className="text-sm text-gray-500 mt-1">DS 3/1985 Art. 6-7 · NS-06.0 §3.1 — Por equipo, fuente y área</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Plus size={16} />Nueva Licencia
          </button>
        </div>
      </div>

      {hasExpired && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <XCircle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-red-800">Licencias vencidas o suspendidas</p>
            <p className="text-xs text-red-700 mt-0.5">
              Hay {(stats?.expired ?? 0) + (stats?.suspended ?? 0)} licencia(s) vencidas/suspendidas. No es legal operar sin autorización CCHEN vigente (DS 3/1985 Art. 6).
            </p>
          </div>
        </div>
      )}
      {hasUrgent && !hasExpired && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <AlertTriangle className="text-orange-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-orange-800">Licencias próximas a vencer (30 días)</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {stats?.expiring_30d} licencia(s) vencen dentro de 30 días. Inicie el proceso de renovación a tiempo.
            </p>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Licencias", value: stats.total, sub: `${stats.active} vigentes`, color: "text-blue-600", icon: <FileCheck size={18} /> },
            { label: "Vencidas / Susp.", value: (stats.expired ?? 0) + (stats.suspended ?? 0), sub: stats.expired + stats.suspended > 0 ? "⚠ Acción requerida" : "Sin vencidas", color: stats.expired + stats.suspended > 0 ? "text-red-600" : "text-gray-500", icon: <XCircle size={18} /> },
            { label: "Vencen en 90d", value: stats.expiring_90d, sub: `${stats.expiring_30d} en 30d`, color: stats.expiring_30d > 0 ? "text-orange-600" : "text-yellow-600", icon: <AlertTriangle size={18} /> },
            { label: "Renv. Pendiente", value: stats.pending_renewal, sub: "En proceso", color: "text-yellow-700", icon: <Calendar size={18} /> },
          ].map((tile, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-4">
              <div className={`flex items-center gap-2 ${tile.color}`}>
                {tile.icon}
                <span className="text-xs font-medium text-gray-600">{tile.label}</span>
              </div>
              <div className={`text-3xl font-bold mt-2 ${tile.color}`}>{tile.value ?? "—"}</div>
              <div className="text-xs text-gray-400 mt-1">{tile.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          <option value="active">Vigente</option>
          <option value="expired">Vencida</option>
          <option value="suspended">Suspendida</option>
          <option value="pending_renewal">Renovación Pendiente</option>
          <option value="in_process">En Trámite</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando licencias…</div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay licencias registradas</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-blue-600 hover:underline text-sm">
            Registrar primera licencia
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {licenses.map(lic => <LicenseCard key={lic.id} lic={lic} onUpdate={load} />)}
        </div>
      )}

      {showModal && <LicenseModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
