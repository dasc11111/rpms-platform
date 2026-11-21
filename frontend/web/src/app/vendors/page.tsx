"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Plus, X, AlertTriangle, Building2, CheckCircle } from "lucide-react";

type Vendor = {
  id: number;
  name: string;
  rut?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  services?: string[];
  cchen_authorized?: boolean;
  cchen_auth_number?: string;
  cchen_expiry?: string;
  quality_cert?: string;
  cert_expiry?: string;
  active?: boolean;
  notes?: string;
};

type Stats = {
  total: string; active: string; cchen_auth: string;
  cchen_expired: string; cert_expired: string;
};

const SERVICE_OPTS = [
  { value: "calibracion_instrumentos", label: "Calibración de instrumentos" },
  { value: "mantenimiento_equipos",    label: "Mantenimiento de equipos" },
  { value: "suministro_fuentes",       label: "Suministro de fuentes radiactivas" },
  { value: "transporte_radiactivo",    label: "Transporte de materiales radiactivos" },
  { value: "dosimetria_personal",      label: "Servicio de dosimetría personal" },
  { value: "diseño_blindaje",          label: "Diseño de blindajes" },
  { value: "construccion_blindaje",    label: "Construcción de blindajes" },
  { value: "capacitacion",             label: "Capacitación especializada" },
  { value: "asesoria_rp",              label: "Asesoría en protección radiológica" },
  { value: "gestion_residuos",         label: "Gestión de residuos radiactivos" },
  { value: "otro",                     label: "Otro" },
];

function serviceLabel(v: string) {
  return SERVICE_OPTS.find(o => o.value === v)?.label ?? v;
}

function fDate(d?: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpired(d?: string) {
  if (!d) return false;
  return new Date(d) < new Date();
}

function VendorCard({ vendor, onEdit }: { vendor: Vendor; onEdit: (v: Vendor) => void }) {
  const [open, setOpen] = useState(false);
  const cchenExp = isExpired(vendor.cchen_expiry);
  const certExp  = isExpired(vendor.cert_expiry);

  return (
    <div className={`rounded-xl border ${!vendor.active ? "opacity-60 border-gray-200" : vendor.cchen_authorized ? "border-blue-200" : "border-gray-200"} bg-white shadow-sm mb-3`}>
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        <Building2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${vendor.cchen_authorized ? "text-blue-500" : "text-gray-400"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-900">{vendor.name}</span>
            {vendor.cchen_authorized && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cchenExp ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                <CheckCircle className="w-3 h-3" />
                CCHEN{cchenExp ? " (vencida)" : ""}
              </span>
            )}
            {!vendor.active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>}
          </div>
          {vendor.rut && <div className="text-xs text-gray-400">RUT: {vendor.rut}</div>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(vendor.services ?? []).map(s => (
              <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{serviceLabel(s)}</span>
            ))}
          </div>
        </div>
        <div className="ml-2 flex-shrink-0 text-gray-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {vendor.contact_name && <div><span className="text-gray-500">Contacto:</span> <span>{vendor.contact_name}</span></div>}
            {vendor.contact_email && <div><span className="text-gray-500">Email:</span> <a href={`mailto:${vendor.contact_email}`} className="text-blue-600">{vendor.contact_email}</a></div>}
            {vendor.contact_phone && <div><span className="text-gray-500">Teléfono:</span> <span>{vendor.contact_phone}</span></div>}
            {(vendor.address || vendor.city) && (
              <div><span className="text-gray-500">Dirección:</span> <span>{[vendor.address, vendor.city].filter(Boolean).join(", ")}</span></div>
            )}
          </div>
          {vendor.cchen_authorized && (
            <div className={`rounded-lg p-3 text-xs ${cchenExp ? "bg-red-50" : "bg-blue-50"}`}>
              <div className="font-semibold mb-1">Autorización CCHEN</div>
              {vendor.cchen_auth_number && <div>N° autorización: {vendor.cchen_auth_number}</div>}
              {vendor.cchen_expiry && (
                <div className={cchenExp ? "text-red-700 font-semibold" : ""}>
                  Vencimiento: {fDate(vendor.cchen_expiry)}{cchenExp ? " — VENCIDA" : ""}
                </div>
              )}
            </div>
          )}
          {vendor.quality_cert && (
            <div className={`rounded-lg p-3 text-xs ${certExp ? "bg-red-50" : "bg-green-50"}`}>
              <div className="font-semibold mb-1">Certificación de calidad</div>
              <div>{vendor.quality_cert}</div>
              {vendor.cert_expiry && (
                <div className={certExp ? "text-red-700 font-semibold" : ""}>
                  Vencimiento: {fDate(vendor.cert_expiry)}{certExp ? " — VENCIDA" : ""}
                </div>
              )}
            </div>
          )}
          {vendor.notes && <div className="text-xs italic text-gray-500">{vendor.notes}</div>}
          <button onClick={() => onEdit(vendor)} className="text-xs text-blue-600 hover:text-blue-800 underline">Editar proveedor</button>
        </div>
      )}
    </div>
  );
}

function VendorForm({ initial, onClose, onSaved }: {
  initial?: Vendor; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    rut: initial?.rut ?? "",
    contact_name: initial?.contact_name ?? "",
    contact_email: initial?.contact_email ?? "",
    contact_phone: initial?.contact_phone ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    cchen_authorized: initial?.cchen_authorized ?? false,
    cchen_auth_number: initial?.cchen_auth_number ?? "",
    cchen_expiry: initial?.cchen_expiry ?? "",
    quality_cert: initial?.quality_cert ?? "",
    cert_expiry: initial?.cert_expiry ?? "",
    active: initial?.active ?? true,
    notes: initial?.notes ?? "",
    services: initial?.services ?? [] as string[],
  });
  const [saving, setSaving] = useState(false);

  function toggleService(v: string) {
    setForm(f => ({
      ...f,
      services: f.services.includes(v) ? f.services.filter(s => s !== v) : [...f.services, v],
    }));
  }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const payload = {
      ...form,
      cchen_expiry: form.cchen_expiry || null,
      cert_expiry: form.cert_expiry || null,
      cchen_auth_number: form.cchen_auth_number || null,
      quality_cert: form.quality_cert || null,
    };
    if (initial) {
      await fetch("/api/vendors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id, ...payload }),
      });
    } else {
      await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSaved();
  }

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
  const lbl = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">{initial ? "Editar proveedor" : "Nuevo proveedor"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Nombre *</label>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>RUT empresa</label>
              <input className={inp} placeholder="76.123.456-7" value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Ciudad</label>
              <input className={inp} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Dirección</label>
              <input className={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Nombre contacto</label>
              <input className={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Email</label>
              <input type="email" className={inp} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={lbl}>Servicios que presta</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {SERVICE_OPTS.map(o => (
                <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.services.includes(o.value)}
                    onChange={() => toggleService(o.value)} className="rounded" />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.cchen_authorized}
                onChange={e => setForm(f => ({ ...f, cchen_authorized: e.target.checked }))} className="rounded" />
              <span>Autorizado por CCHEN</span>
            </label>
          </div>
          {form.cchen_authorized && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <label className={lbl}>N° autorización CCHEN</label>
                <input className={inp} value={form.cchen_auth_number} onChange={e => setForm(f => ({ ...f, cchen_auth_number: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Vencimiento autorización</label>
                <input type="date" className={inp} value={form.cchen_expiry} onChange={e => setForm(f => ({ ...f, cchen_expiry: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Certificación calidad</label>
              <input className={inp} placeholder="ISO 17025, ISO 9001…" value={form.quality_cert} onChange={e => setForm(f => ({ ...f, quality_cert: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Vencimiento certificado</label>
              <input type="date" className={inp} value={form.cert_expiry} onChange={e => setForm(f => ({ ...f, cert_expiry: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <span>Proveedor activo</span>
          </label>
        </div>
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex gap-3 justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving || !form.name}
            className="px-5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Agregar proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [service, setService]   = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Vendor | undefined>(undefined);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (showInactive) params.set("active", "false");
    const r = await fetch(`/api/vendors?${params}`);
    const d = await r.json();
    setVendors(d.vendors ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, [service, showInactive]);

  useEffect(() => { load(); }, [load]);

  const expiredCount = parseInt(stats?.cchen_expired ?? "0") + parseInt(stats?.cert_expired ?? "0");

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-1">Empresas de servicios autorizadas para protección radiológica</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:bg-blue-800"
        >
          <Plus className="w-4 h-4" /> Nuevo proveedor
        </button>
      </div>

      {expiredCount > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <span className="font-semibold">{expiredCount} autorización{expiredCount > 1 ? "es" : ""} vencida{expiredCount > 1 ? "s" : ""}</span>.
            Revise los proveedores con certificaciones o autorizaciones CCHEN expiradas.
          </div>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Proveedores activos", val: stats.active, sub: `Total: ${stats.total}` },
            { label: "Autorizados CCHEN", val: stats.cchen_auth, sub: "activos" },
            { label: "Auth. CCHEN vencidas", val: stats.cchen_expired, sub: "" },
            { label: "Certif. calidad vencidas", val: stats.cert_expired, sub: "" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">{k.label}</div>
              <div className="text-xl font-bold text-gray-900">{k.val}</div>
              {k.sub && <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={service} onChange={e => setService(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Todos los servicios</option>
          {SERVICE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Mostrar inactivos
        </label>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">Sin proveedores registrados</div>
        </div>
      ) : (
        vendors.map(v => (
          <VendorCard key={v.id} vendor={v} onEdit={e => { setEditing(e); setShowForm(true); }} />
        ))
      )}

      {showForm && (
        <VendorForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={() => { setShowForm(false); setEditing(undefined); load(); }}
        />
      )}
    </div>
  );
}
