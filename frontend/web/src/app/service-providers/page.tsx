"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, ChevronDown, ChevronUp, CheckCircle2,
  AlertTriangle, XCircle, RefreshCw, Edit2, Trash2,
  Star, Phone, Mail, MapPin, Calendar, Award, Shield,
  FileText, Wrench, GraduationCap, Recycle, Atom, Users
} from "lucide-react";

// §77 — Proveedores de Servicios de Dosimetría y Calibración Externa
// NS-06.0 §5.3: Acreditación y supervisión de proveedores externos del programa PR

interface Provider {
  id: number;
  provider_code: string;
  name: string;
  rut?: string;
  service_type: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  city?: string;
  region?: string;
  accreditation_body?: string;
  accreditation_number?: string;
  accreditation_start?: string;
  accreditation_expiry?: string;
  cchen_authorization?: string;
  cchen_auth_expiry?: string;
  iso_certification?: string;
  iso_cert_expiry?: string;
  contract_start?: string;
  contract_expiry?: string;
  contract_number?: string;
  last_service_date?: string;
  next_service_date?: string;
  service_frequency?: string;
  status: string;
  evaluation_score?: number;
  evaluation_date?: string;
  notes?: string;
  eval_count: number;
}

interface Stats {
  total: number;
  active: number;
  critical: number;
  accreditation_expiring: number;
  cchen_expiring: number;
  contract_expiring: number;
  avg_score: number;
}

const SERVICE_TYPES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  dosimetry:              { label: "Dosimetría Personal",        icon: Atom,          color: "text-blue-600 bg-blue-50" },
  calibration:            { label: "Calibración de Equipos",    icon: Award,         color: "text-purple-600 bg-purple-50" },
  radioactive_waste:      { label: "Residuos Radiactivos",       icon: Recycle,       color: "text-orange-600 bg-orange-50" },
  radiation_survey:       { label: "Levantamiento Radiológico",  icon: Shield,        color: "text-indigo-600 bg-indigo-50" },
  training:               { label: "Capacitación PR",            icon: GraduationCap, color: "text-green-600 bg-green-50" },
  equipment_maintenance:  { label: "Mantenimiento Equipos",      icon: Wrench,        color: "text-yellow-700 bg-yellow-50" },
  radiological_assessment:{ label: "Evaluación Radiológica",     icon: FileText,      color: "text-teal-600 bg-teal-50" },
  cchen_services:         { label: "Servicios CCHEN",            icon: Building2,     color: "text-red-600 bg-red-50" },
  other:                  { label: "Otro",                       icon: Building2,     color: "text-gray-600 bg-gray-50" },
};

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual", quarterly: "Trimestral", biannual: "Semestral",
  annual: "Anual", on_demand: "A demanda",
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(d?: string): number | null {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ date, label }: { date?: string; label: string }) {
  const days = daysUntil(date);
  if (!date) return null;
  const color =
    days == null ? "text-gray-400" :
    days < 0     ? "bg-red-100 text-red-800 font-semibold" :
    days < 30    ? "bg-red-100 text-red-700" :
    days < 90    ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-700";
  const icon = days != null && days < 0 ? <XCircle size={11} className="inline" /> :
               days != null && days < 90 ? <AlertTriangle size={11} className="inline" /> :
               <CheckCircle2 size={11} className="inline" />;
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${color}`}>
      {icon} {label}: {formatDate(date)}
      {days != null && days >= 0 && days < 180 && (
        <span className="ml-1 opacity-75">({days}d)</span>
      )}
      {days != null && days < 0 && (
        <span className="ml-1 font-bold">¡VENCIDO!</span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "Activo",    cls: "bg-green-100 text-green-700" },
    inactive:  { label: "Inactivo", cls: "bg-gray-100 text-gray-600" },
    expired:   { label: "Vencido",  cls: "bg-red-100 text-red-700 font-semibold" },
    suspended: { label: "Suspendido", cls: "bg-orange-100 text-orange-700" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{label}</span>;
}

function StarRating({ score }: { score?: number }) {
  if (!score) return <span className="text-xs text-gray-400">Sin eval.</span>;
  const full = Math.floor(score);
  const half = score - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          className={i <= full ? "text-yellow-400 fill-yellow-400" : (i === full + 1 && half) ? "text-yellow-300 fill-yellow-200" : "text-gray-300"} />
      ))}
      <span className="text-xs text-gray-600 ml-1">{score.toFixed(1)}</span>
    </span>
  );
}

function ProviderCard({
  p,
  onEdit,
  onDelete,
}: {
  p: Provider;
  onEdit: (p: Provider) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = SERVICE_TYPES[p.service_type] ?? SERVICE_TYPES.other;
  const TypeIcon = typeInfo.icon;

  const isExpired = p.status === "expired" || p.status === "suspended";
  const accDays = daysUntil(p.accreditation_expiry);
  const cchenDays = daysUntil(p.cchen_auth_expiry);
  const hasAlert = isExpired ||
    (accDays != null && accDays < 90) ||
    (cchenDays != null && cchenDays < 90);

  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 transition-all ${
      isExpired ? "border-red-500" :
      hasAlert  ? "border-yellow-400" : "border-green-400"
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${typeInfo.color}`}>
              <TypeIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-gray-400">{p.provider_code}</span>
                <StatusBadge status={p.status} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 leading-snug">{p.name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                {p.rut && <span>RUT: {p.rut}</span>}
                {p.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {p.city}
                  </span>
                )}
                <StarRating score={p.evaluation_score} />
                {p.service_frequency && (
                  <span className="text-gray-400">
                    Freq: {FREQ_LABELS[p.service_frequency] ?? p.service_frequency}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button onClick={() => onEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 size={15} />
            </button>
            <button onClick={() => onDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expiry badges row */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.accreditation_expiry && <ExpiryBadge date={p.accreditation_expiry} label="Acred." />}
          {p.cchen_auth_expiry && <ExpiryBadge date={p.cchen_auth_expiry} label="CCHEN" />}
          {p.contract_expiry && <ExpiryBadge date={p.contract_expiry} label="Contrato" />}
          {p.iso_cert_expiry && <ExpiryBadge date={p.iso_cert_expiry} label="ISO" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contacto</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700">
              {p.contact_name && (
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-gray-400" /> {p.contact_name}
                </span>
              )}
              {p.contact_phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-gray-400" /> {p.contact_phone}
                </span>
              )}
              {p.contact_email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-gray-400" /> {p.contact_email}
                </span>
              )}
            </div>
          </div>

          {/* Certifications */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Acreditaciones y Certificaciones</h4>
            <div className="space-y-2">
              {p.accreditation_body && (
                <div className="flex items-center gap-2 text-sm">
                  <Award size={14} className="text-purple-500 flex-shrink-0" />
                  <span className="text-gray-600">{p.accreditation_body}</span>
                  {p.accreditation_number && <span className="text-gray-400 text-xs">#{p.accreditation_number}</span>}
                  <ExpiryBadge date={p.accreditation_expiry} label="Vence" />
                </div>
              )}
              {p.cchen_authorization && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield size={14} className="text-red-500 flex-shrink-0" />
                  <span className="text-gray-600">Autorización CCHEN</span>
                  <span className="text-gray-400 text-xs">{p.cchen_authorization}</span>
                  <ExpiryBadge date={p.cchen_auth_expiry} label="Vence" />
                </div>
              )}
              {p.iso_certification && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                  <span className="text-gray-600">{p.iso_certification}</span>
                  <ExpiryBadge date={p.iso_cert_expiry} label="Vence" />
                </div>
              )}
              {p.contract_number && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-gray-600">Contrato {p.contract_number}</span>
                  <ExpiryBadge date={p.contract_expiry} label="Vence" />
                </div>
              )}
            </div>
          </div>

          {/* Service dates */}
          <div className="grid grid-cols-2 gap-3">
            {p.last_service_date && (
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-0.5">Último servicio</div>
                <div className="text-sm font-medium flex items-center gap-1">
                  <Calendar size={12} className="text-gray-400" />
                  {formatDate(p.last_service_date)}
                </div>
              </div>
            )}
            {p.next_service_date && (
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="text-xs text-blue-600 mb-0.5">Próximo servicio</div>
                <div className="text-sm font-medium flex items-center gap-1 text-blue-700">
                  <Calendar size={12} />
                  {formatDate(p.next_service_date)}
                </div>
              </div>
            )}
          </div>

          {p.notes && (
            <div className={`rounded-lg p-3 text-xs leading-relaxed ${
              p.status === "expired" ? "bg-red-50 text-red-800 border border-red-200" : "bg-yellow-50 text-yellow-800"
            }`}>
              {p.notes}
            </div>
          )}

          {p.eval_count > 0 && (
            <div className="text-xs text-gray-400 italic">
              {p.eval_count} evaluación(es) registrada(s) · Última: {formatDate(p.evaluation_date)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderModal({
  provider,
  onClose,
  onSave,
}: {
  provider: Partial<Provider> | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({
    name: provider?.name ?? "",
    rut: provider?.rut ?? "",
    service_type: provider?.service_type ?? "dosimetry",
    contact_name: provider?.contact_name ?? "",
    contact_phone: provider?.contact_phone ?? "",
    contact_email: provider?.contact_email ?? "",
    address: provider?.address ?? "",
    city: provider?.city ?? "",
    region: provider?.region ?? "",
    accreditation_body: provider?.accreditation_body ?? "",
    accreditation_number: provider?.accreditation_number ?? "",
    accreditation_start: provider?.accreditation_start?.split("T")[0] ?? "",
    accreditation_expiry: provider?.accreditation_expiry?.split("T")[0] ?? "",
    cchen_authorization: provider?.cchen_authorization ?? "",
    cchen_auth_expiry: provider?.cchen_auth_expiry?.split("T")[0] ?? "",
    iso_certification: provider?.iso_certification ?? "",
    iso_cert_expiry: provider?.iso_cert_expiry?.split("T")[0] ?? "",
    contract_number: provider?.contract_number ?? "",
    contract_start: provider?.contract_start?.split("T")[0] ?? "",
    contract_expiry: provider?.contract_expiry?.split("T")[0] ?? "",
    last_service_date: provider?.last_service_date?.split("T")[0] ?? "",
    next_service_date: provider?.next_service_date?.split("T")[0] ?? "",
    service_frequency: provider?.service_frequency ?? "annual",
    status: provider?.status ?? "active",
    notes: provider?.notes ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    Object.entries(form).forEach(([k, v]) => { if (v !== "") payload[k] = v; });

    if (provider?.id) {
      payload.id = provider.id;
      await fetch("/api/service-providers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/service-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {provider?.id ? "Editar Proveedor" : "Nuevo Proveedor de Servicio"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del Proveedor *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">RUT</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="12.345.678-9" value={form.rut} onChange={e => set("rut", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Servicio</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.service_type} onChange={e => set("service_type", e.target.value)}>
                {Object.entries(SERVICE_TYPES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Contacto</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ciudad</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.city} onChange={e => set("city", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Región</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.region} onChange={e => set("region", e.target.value)} />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Acreditación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Organismo Acreditador</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="CCHEN, INN, SAG…" value={form.accreditation_body} onChange={e => set("accreditation_body", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">N° Acreditación</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.accreditation_number} onChange={e => set("accreditation_number", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Inicio acreditación</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.accreditation_start} onChange={e => set("accreditation_start", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vencimiento acreditación</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.accreditation_expiry} onChange={e => set("accreditation_expiry", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Autorización CCHEN</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.cchen_authorization} onChange={e => set("cchen_authorization", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Venc. CCHEN</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.cchen_auth_expiry} onChange={e => set("cchen_auth_expiry", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Contrato N°</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contract_number} onChange={e => set("contract_number", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Venc. Contrato</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contract_expiry} onChange={e => set("contract_expiry", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Próximo servicio</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.next_service_date} onChange={e => set("next_service_date", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Frecuencia</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.service_frequency} onChange={e => set("service_frequency", e.target.value)}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="expired">Vencido</option>
                <option value="suspended">Suspendido</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas y observaciones</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              {provider?.id ? "Guardar Cambios" : "Registrar Proveedor"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [modalProvider, setModalProvider] = useState<Partial<Provider> | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter)   params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (expiringOnly) params.set("expiring", "1");
    const r = await fetch(`/api/service-providers?${params}`);
    const d = await r.json();
    setProviders(d.providers ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, [typeFilter, statusFilter, expiringOnly]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Desactivar este proveedor?")) return;
    await fetch("/api/service-providers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  const totalAlerts = (stats?.critical ?? 0) + (stats?.accreditation_expiring ?? 0) + (stats?.cchen_expiring ?? 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600" size={26} />
            Proveedores de Servicios PR
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">NS-06.0 §5.3 — Dosimetría, Calibración y Servicios Externos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Actualizar">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setModalProvider({})}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus size={16} />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Alerts */}
      {totalAlerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-800 text-sm">Atención requerida: {totalAlerts} alerta(s) de proveedores</p>
            <p className="text-xs text-red-700 mt-0.5">
              {stats?.critical ?? 0} vencidos/suspendidos · {stats?.accreditation_expiring ?? 0} acreditaciones por vencer (90d) · {stats?.cchen_expiring ?? 0} auth. CCHEN por vencer (90d)
            </p>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Total Proveedores</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-green-600 mt-1">{stats.active} activos</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <XCircle size={12} className="text-red-600" /> Vencidos/Suspendidos
            </div>
            <div className={`text-3xl font-bold ${stats.critical > 0 ? "text-red-600" : "text-gray-900"}`}>{stats.critical}</div>
            <div className="text-xs text-gray-400 mt-1">Requieren acción inmediata</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle size={12} className="text-yellow-600" /> Por Vencer (90d)
            </div>
            <div className={`text-3xl font-bold ${(stats.accreditation_expiring + stats.cchen_expiring) > 0 ? "text-yellow-600" : "text-gray-900"}`}>
              {stats.accreditation_expiring + stats.cchen_expiring}
            </div>
            <div className="text-xs text-gray-400 mt-1">{stats.contract_expiring} contratos</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
              <Star size={12} className="text-yellow-500" /> Calificación Prom.
            </div>
            <div className="text-3xl font-bold text-purple-600">{stats.avg_score?.toFixed(1) ?? "—"}</div>
            <div className="text-xs text-gray-400 mt-1">Escala 1–5</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(SERVICE_TYPES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="expired">Vencidos</option>
          <option value="suspended">Suspendidos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={expiringOnly}
            onChange={e => setExpiringOnly(e.target.checked)}
            className="rounded"
          />
          Solo por vencer (90d)
        </label>
        {(typeFilter || statusFilter || expiringOnly) && (
          <button onClick={() => { setTypeFilter(""); setStatusFilter(""); setExpiringOnly(false); }} className="text-xs text-gray-500 hover:text-red-600 px-2">
            × Limpiar filtros
          </button>
        )}
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <RefreshCw size={28} className="animate-spin" />
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay proveedores registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <ProviderCard
              key={p.id}
              p={p}
              onEdit={o => setModalProvider(o)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
        NS-06.0 §5.3 — Supervisión de Proveedores Externos de Servicios PR · CCHEN
      </div>

      {modalProvider !== undefined && (
        <ProviderModal
          provider={modalProvider}
          onClose={() => setModalProvider(undefined)}
          onSave={load}
        />
      )}
    </div>
  );
}
