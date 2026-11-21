"use client";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw,
  AlertTriangle, CheckCircle, Clock, XCircle, RotateCcw, Calendar
} from "lucide-react";

type License = {
  id: number; license_number: string; license_type: string; description: string;
  issuing_body: string; issue_date: string; expiry_date: string | null;
  indefinite: boolean; scope: string; conditions: string; status: string;
  document_ref: string; notes: string; days_left?: number;
};

type Renewal = {
  id: number; license_id: number; license_number: string;
  renewal_date: string; new_expiry: string; submitted_by: string; notes: string;
};

type Stats = {
  total: string; active: string; expiring: string; expired: string;
  suspended: string; indefinite_count: string; next_expiry: string | null;
};

type Data = { licenses: License[]; stats: Stats; renewals: Renewal[] };

const TYPE_CFG: Record<string, { label: string; bg: string; text: string }> = {
  operation:     { label: "Operación",        bg: "bg-blue-100",   text: "text-blue-800"   },
  sealed_source: { label: "Fuente Sellada",   bg: "bg-purple-100", text: "text-purple-800" },
  waste:         { label: "Residuos",          bg: "bg-orange-100", text: "text-orange-800" },
  personnel:     { label: "Personal",          bg: "bg-teal-100",   text: "text-teal-800"   },
  installation:  { label: "Instalación",       bg: "bg-indigo-100", text: "text-indigo-800" },
  transport:     { label: "Transporte",        bg: "bg-cyan-100",   text: "text-cyan-800"   },
  research:      { label: "Investigación",     bg: "bg-pink-100",   text: "text-pink-800"   },
  other:         { label: "Otra",              bg: "bg-gray-100",   text: "text-gray-800"   },
};

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  active:    { label: "VIGENTE",    bg: "bg-green-100",  text: "text-green-800",  icon: <CheckCircle className="h-3 w-3" /> },
  expiring:  { label: "POR VENCER", bg: "bg-amber-100",  text: "text-amber-800",  icon: <Clock       className="h-3 w-3" /> },
  expired:   { label: "VENCIDA",    bg: "bg-red-100",    text: "text-red-800",    icon: <XCircle     className="h-3 w-3" /> },
  suspended: { label: "SUSPENDIDA", bg: "bg-gray-100",   text: "text-gray-700",   icon: <AlertTriangle className="h-3 w-3" /> },
  revoked:   { label: "REVOCADA",   bg: "bg-red-200",    text: "text-red-900",    icon: <XCircle     className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.active;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

type LicForm = {
  license_number: string; license_type: string; description: string;
  issuing_body: string; issue_date: string; expiry_date: string;
  indefinite: boolean; scope: string; conditions: string; document_ref: string; notes: string;
};

const BLANK_LIC: LicForm = {
  license_number: "", license_type: "operation", description: "", issuing_body: "CCHEN",
  issue_date: new Date().toISOString().slice(0, 10), expiry_date: "",
  indefinite: false, scope: "", conditions: "", document_ref: "", notes: "",
};

type RenForm = { license_id: number; renewal_date: string; new_expiry: string; submitted_by: string; notes: string };

function LicenseForm({ form, onChange, onSubmit, onCancel, saving }: {
  form: LicForm;
  onChange: (k: keyof LicForm, v: string | boolean) => void;
  onSubmit: () => void; onCancel: () => void; saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Nueva Autorización / Licencia</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">N° Autorización *</label>
            <input value={form.license_number} onChange={e => onChange("license_number", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="RA-2024-00001" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
            <select value={form.license_type} onChange={e => onChange("license_type", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <input value={form.description} onChange={e => onChange("description", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Organismo *</label>
            <input value={form.issuing_body} onChange={e => onChange("issuing_body", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Emisión *</label>
            <input type="date" value={form.issue_date} onChange={e => onChange("issue_date", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
            <input type="date" value={form.expiry_date} onChange={e => onChange("expiry_date", e.target.value)}
              disabled={form.indefinite}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="indef" checked={form.indefinite} onChange={e => onChange("indefinite", e.target.checked)}
              className="rounded" />
            <label htmlFor="indef" className="text-xs text-gray-700">Sin vencimiento (indefinida)</label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Alcance</label>
            <textarea value={form.scope} onChange={e => onChange("scope", e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Condiciones especiales</label>
            <textarea value={form.conditions} onChange={e => onChange("conditions", e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Referencia Documento</label>
            <input value={form.document_ref} onChange={e => onChange("document_ref", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Folio o ruta del documento" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={onSubmit} disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar Licencia"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenewalModal({ lic, onSubmit, onCancel, saving }: {
  lic: License;
  onSubmit: (f: RenForm) => void; onCancel: () => void; saving: boolean;
}) {
  const [form, setForm] = useState<RenForm>({
    license_id: lic.id,
    renewal_date: new Date().toISOString().slice(0, 10),
    new_expiry: "", submitted_by: "", notes: "",
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900">Registrar Renovación</h2>
          <p className="text-xs text-gray-500 mt-1">{lic.license_number}</p>
        </div>
        <div className="p-5 space-y-3">
          {[
            ["Fecha Renovación *", "renewal_date", "date"],
            ["Nueva Fecha Vencimiento", "new_expiry", "date"],
            ["Presentado por", "submitted_by", "text"],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[key as keyof RenForm] as string}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onSubmit(form)} disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LicCard({ lic, onDelete, onRenew }: { lic: License; onDelete: () => void; onRenew: () => void }) {
  const [open, setOpen] = useState(false);
  const expDate = lic.expiry_date
    ? new Date(lic.expiry_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const issDate = new Date(lic.issue_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  const daysLeft = lic.days_left ?? null;

  const borderColor = lic.status === "expired"   ? "border-red-400"   :
                      lic.status === "expiring"  ? "border-amber-400" :
                      lic.status === "suspended" ? "border-gray-400"  : "border-green-400";

  return (
    <div className={`bg-white rounded-xl border-l-4 shadow-sm ${borderColor}`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-semibold text-gray-900">{lic.license_number}</span>
            <TypeBadge type={lic.license_type} />
            <StatusBadge status={lic.status} />
          </div>
          {lic.description && <p className="text-xs text-gray-600 mt-0.5">{lic.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span><Calendar className="inline h-3 w-3 mr-1" />Emitida: {issDate}</span>
            {lic.indefinite ? (
              <span className="text-green-700 font-medium">Sin vencimiento</span>
            ) : expDate ? (
              <span className={daysLeft !== null && daysLeft < 0 ? "text-red-600 font-medium" :
                              daysLeft !== null && daysLeft <= 90 ? "text-amber-600 font-medium" : ""}>
                Vence: {expDate}
                {daysLeft !== null && daysLeft >= 0 && ` (${daysLeft}d)`}
                {daysLeft !== null && daysLeft < 0 && ` (hace ${Math.abs(daysLeft)}d)`}
              </span>
            ) : null}
            <span>{lic.issuing_body}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onRenew(); }}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Renovar">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <Trash2 className="h-4 w-4" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-1 text-xs text-gray-700">
          {lic.scope      && <p><span className="font-medium">Alcance:</span> {lic.scope}</p>}
          {lic.conditions && <p><span className="font-medium">Condiciones:</span> {lic.conditions}</p>}
          {lic.document_ref && <p><span className="font-medium">Documento:</span> {lic.document_ref}</p>}
          {lic.notes      && <p><span className="font-medium">Notas:</span> {lic.notes}</p>}
        </div>
      )}
    </div>
  );
}

export default function LicensesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [renewTarget, setRenewTarget] = useState<License | null>(null);
  const [form, setForm] = useState<LicForm>(BLANK_LIC);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType)   params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      const d = await fetch(`/api/licenses?${params}`).then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, [filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.license_number || !form.license_type || !form.issue_date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expiry_date: form.expiry_date || null }),
      });
      if (res.ok) { setShowForm(false); setForm(BLANK_LIC); load(); }
    } finally { setSaving(false); }
  };

  const handleRenewal = async (rf: RenForm) => {
    setSaving(true);
    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewal_for: rf.license_id, ...rf }),
      });
      if (res.ok) { setRenewTarget(null); load(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta autorización?")) return;
    await fetch(`/api/licenses?id=${id}`, { method: "DELETE" });
    load();
  };

  const s = data?.stats;
  const hasAlerts = s && (parseInt(s.expiring) > 0 || parseInt(s.expired) > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-xl">
            <FileText className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Autorizaciones y Licencias CCHEN</h1>
            <p className="text-sm text-gray-500">Registro y control de autorizaciones radiológicas — DS 3/1985, DS 133/1984, Ley 18.302</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Plus className="h-4 w-4" /> Nueva Autorización
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {hasAlerts && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Autorizaciones requieren atención</p>
            <p className="text-xs text-amber-700 mt-1">
              {parseInt(s?.expired ?? "0") > 0 && `${s!.expired} autorización(es) VENCIDA(S). `}
              {parseInt(s?.expiring ?? "0") > 0 && `${s!.expiring} autorización(es) próximas a vencer (≤90 días). `}
              Gestionar renovación ante CCHEN con anticipación.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total autorizaciones", value: s.total,    color: "text-gray-900" },
            { label: "Vigentes",             value: s.active,   color: "text-green-700" },
            { label: "Por vencer (≤90d)",    value: s.expiring, color: parseInt(s.expiring) > 0 ? "text-amber-700" : "text-gray-500" },
            { label: "Vencidas",             value: s.expired,  color: parseInt(s.expired)  > 0 ? "text-red-700"   : "text-gray-500" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Next expiry notice */}
      {s?.next_expiry && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <Clock className="inline h-4 w-4 mr-2" />
          Próxima fecha de vencimiento:{" "}
          <strong>
            {new Date(s.next_expiry + "T12:00:00").toLocaleDateString("es-CL", {
              weekday: "long", day: "numeric", month: "long", year: "numeric"
            })}
          </strong>
        </div>
      )}

      {/* Filters + List */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-gray-500 ml-auto">{data?.licenses?.length ?? 0} autorización(es)</span>
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Cargando…</p>
          ) : !data?.licenses?.length ? (
            <p className="text-sm text-gray-500 text-center py-8">Sin autorizaciones registradas.</p>
          ) : (
            data.licenses.map(lic => (
              <LicCard key={lic.id} lic={lic}
                onDelete={() => handleDelete(lic.id)}
                onRenew={() => setRenewTarget(lic)}
              />
            ))
          )}
        </div>
      </div>

      {/* Renewal history */}
      {data?.renewals && data.renewals.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Historial de Renovaciones
          </h2>
          <div className="space-y-2">
            {data.renewals.map(r => (
              <div key={r.id} className="flex items-center gap-4 text-xs text-gray-700 py-1.5 border-b border-gray-50 last:border-0">
                <span className="font-mono font-semibold text-gray-900 w-36 shrink-0">{r.license_number}</span>
                <span>Renovada: {new Date(r.renewal_date + "T12:00:00").toLocaleDateString("es-CL", { day:"numeric",month:"short",year:"numeric" })}</span>
                {r.new_expiry && <span className="text-green-700">Nuevo venc.: {new Date(r.new_expiry + "T12:00:00").toLocaleDateString("es-CL", { day:"numeric",month:"short",year:"numeric" })}</span>}
                {r.submitted_by && <span className="text-gray-500">por {r.submitted_by}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <LicenseForm form={form}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setForm(BLANK_LIC); }}
          saving={saving}
        />
      )}

      {renewTarget && (
        <RenewalModal lic={renewTarget}
          onSubmit={handleRenewal} onCancel={() => setRenewTarget(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
