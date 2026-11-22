"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import {
  Atom, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  Clock, MapPin, Shield, FileText, Activity, Calendar, Package
} from "lucide-react";

type SourceType = "sealed" | "unsealed" | "generator" | "device";
type SourceStatus = "active" | "in_use" | "storage" | "maintenance" | "transfer" | "decommissioned" | "lost";

interface Source {
  id: number;
  source_code: string;
  name: string;
  radionuclide: string;
  source_type: SourceType;
  physical_form: string;
  activity_bq: number;
  activity_unit: string;
  activity_date: string;
  half_life_days: number;
  manufacturer: string;
  serial_number: string;
  model: string;
  use_category: string;
  location: string;
  storage_location: string;
  custodian: string;
  cchen_registration: string;
  cchen_registration_expiry: string;
  license_number: string;
  status: SourceStatus;
  condition_status: string;
  last_inventory_date: string;
  next_inventory_date: string;
  last_leak_test_date: string;
  next_leak_test_date: string;
  leak_test_result: string;
  notes: string;
  current_activity_bq: number | null;
  days_to_cchen_expiry: number | null;
  days_to_next_inventory: number | null;
  days_to_next_leak_test: number | null;
}

interface Movement {
  id: number;
  source_id: number;
  movement_type: string;
  from_location: string;
  to_location: string;
  movement_date: string;
  performed_by: string;
  purpose: string;
  notes: string;
}

interface Stats {
  total: number;
  in_use: number;
  in_storage: number;
  decommissioned: number;
  sealed_count: number;
  unsealed_count: number;
  generators: number;
  expiring_soon: number;
  overdue_inventory: number;
  overdue_leak_test: number;
}

function formatActivity(bq: number | null): string {
  if (!bq) return "—";
  if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
  if (bq >= 1e9) return `${(bq / 1e9).toFixed(2)} GBq`;
  if (bq >= 1e6) return `${(bq / 1e6).toFixed(2)} MBq`;
  if (bq >= 1e3) return `${(bq / 1e3).toFixed(2)} kBq`;
  return `${bq.toFixed(2)} Bq`;
}

function StatusBadge({ status }: { status: SourceStatus }) {
  const cfg: Record<SourceStatus, { cls: string; label: string }> = {
    active: { cls: "bg-green-100 text-green-800 border border-green-200", label: "Activa" },
    in_use: { cls: "bg-blue-100 text-blue-800 border border-blue-200", label: "En uso" },
    storage: { cls: "bg-gray-100 text-gray-700 border border-gray-200", label: "Almacenada" },
    maintenance: { cls: "bg-yellow-100 text-yellow-800 border border-yellow-200", label: "Mantención" },
    transfer: { cls: "bg-purple-100 text-purple-800 border border-purple-200", label: "En traslado" },
    decommissioned: { cls: "bg-orange-100 text-orange-800 border border-orange-200", label: "Descomisionada" },
    lost: { cls: "bg-red-100 text-red-800 border border-red-200", label: "Extraviada" },
  };
  const c = cfg[status] || cfg.active;
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.cls}`}>{c.label}</span>;
}

function TypeBadge({ type }: { type: SourceType }) {
  const cfg: Record<SourceType, { cls: string; label: string }> = {
    sealed: { cls: "bg-teal-100 text-teal-800", label: "Sellada" },
    unsealed: { cls: "bg-orange-100 text-orange-800", label: "No sellada" },
    generator: { cls: "bg-purple-100 text-purple-800", label: "Generador" },
    device: { cls: "bg-blue-100 text-blue-800", label: "Dispositivo" },
  };
  const c = cfg[type] || cfg.sealed;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>{c.label}</span>;
}

function ExpiryChip({ days, label }: { days: number | null; label: string }) {
  if (days === null) return null;
  const cls = days < 0 ? "bg-red-100 text-red-700" : days <= 30 ? "bg-orange-100 text-orange-700" : days <= 90 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>
      {label}: {days < 0 ? `vencido ${-days}d` : `${days}d`}
    </span>
  );
}

function borderColor(s: Source) {
  if (s.status === "lost") return "border-l-red-500";
  if (s.status === "decommissioned") return "border-l-orange-400";
  if ((s.days_to_cchen_expiry !== null && s.days_to_cchen_expiry <= 30) || (s.days_to_next_leak_test !== null && s.days_to_next_leak_test < 0)) return "border-l-red-400";
  if (s.status === "in_use") return "border-l-blue-500";
  if (s.status === "storage") return "border-l-green-400";
  return "border-l-gray-300";
}

function SourceCard({ s, onEdit }: { s: Source; onEdit: (s: Source) => void }) {
  const [open, setOpen] = useState(s.status === "in_use" || (s.days_to_cchen_expiry !== null && s.days_to_cchen_expiry <= 30));
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showMovements, setShowMovements] = useState(false);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [moveForm, setMoveForm] = useState({ movement_type: "inventory", from_location: s.location || "", to_location: "", performed_by: "", authorized_by: "", purpose: "", notes: "" });

  const loadMovements = useCallback(async () => {
    const r = await fetch(`/api/radioactive-sources?source_id=${s.id}`);
    const data = await r.json();
    setMovements(data.movements || []);
  }, [s.id]);

  const toggleMovements = async () => {
    if (!showMovements && movements.length === 0) await loadMovements();
    setShowMovements(v => !v);
  };

  const saveMovement = async () => {
    await fetch("/api/radioactive-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "movement", source_id: s.id, ...moveForm }),
    });
    setShowMoveForm(false);
    await loadMovements();
  };

  const mvTypeLabel: Record<string, string> = {
    inventory: "Inventario", leak_test: "Prueba de estanqueidad", use: "Uso",
    return: "Retorno", transfer_in: "Ingreso", transfer_out: "Traslado salida",
    maintenance: "Mantención", disposal: "Disposición"
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(s)} shadow-sm mb-3 overflow-hidden`}>
      <div className="px-4 py-3 flex items-start justify-between cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{s.source_code}</span>
            <span className="font-semibold text-gray-900 text-sm">{s.name}</span>
            <StatusBadge status={s.status} />
            <TypeBadge type={s.source_type} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="font-semibold text-purple-700">{s.radionuclide}</span>
            {s.location && <><span className="text-gray-300">|</span><MapPin className="w-3 h-3" /><span>{s.location}</span></>}
            {s.custodian && <><span className="text-gray-300">|</span><span>{s.custodian}</span></>}
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {s.days_to_cchen_expiry !== null && s.days_to_cchen_expiry <= 90 && (
              <ExpiryChip days={s.days_to_cchen_expiry} label="Reg. CCHEN" />
            )}
            {s.days_to_next_inventory !== null && s.days_to_next_inventory <= 7 && (
              <ExpiryChip days={s.days_to_next_inventory} label="Inventario" />
            )}
            {s.source_type === "sealed" && s.days_to_next_leak_test !== null && s.days_to_next_leak_test <= 90 && (
              <ExpiryChip days={s.days_to_next_leak_test} label="Estanqueidad" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <div className="text-right">
            <div className="text-xs text-gray-500">Actividad actual</div>
            <div className="text-sm font-bold font-mono text-purple-700">{formatActivity(s.current_activity_bq)}</div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
            <div className="bg-purple-50 rounded p-2">
              <div className="text-gray-500">Actividad ref.</div>
              <div className="font-mono font-semibold">{formatActivity(parseFloat(String(s.activity_bq)))}</div>
              <div className="text-gray-400">{s.activity_date ? new Date(s.activity_date).toLocaleDateString("es-CL") : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Vida media</div>
              <div className="font-semibold">{s.half_life_days ? `${parseFloat(String(s.half_life_days)).toFixed(1)} días` : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Fabricante</div>
              <div className="font-semibold">{s.manufacturer || "—"}</div>
              <div className="text-gray-400">{s.serial_number || ""}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Reg. CCHEN</div>
              <div className={`font-semibold ${s.days_to_cchen_expiry !== null && s.days_to_cchen_expiry <= 30 ? "text-red-600" : "text-gray-800"}`}>{s.cchen_registration || "—"}</div>
              <div className="text-gray-400">{s.cchen_registration_expiry ? new Date(s.cchen_registration_expiry).toLocaleDateString("es-CL") : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Almacenamiento</div>
              <div className="font-semibold">{s.storage_location || "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Uso autorizado</div>
              <div className="font-semibold">{s.use_category || "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Último inventario</div>
              <div className={`font-semibold ${s.days_to_next_inventory !== null && s.days_to_next_inventory < 0 ? "text-red-600" : "text-gray-800"}`}>
                {s.last_inventory_date ? new Date(s.last_inventory_date).toLocaleDateString("es-CL") : "—"}
              </div>
            </div>
            {s.source_type === "sealed" && (
              <div className={`rounded p-2 ${s.leak_test_result === "No detectada" ? "bg-green-50" : "bg-red-50"}`}>
                <div className="text-gray-500">Estanqueidad</div>
                <div className="font-semibold">{s.leak_test_result || "—"}</div>
                <div className="text-gray-400">{s.last_leak_test_date ? new Date(s.last_leak_test_date).toLocaleDateString("es-CL") : "No realizada"}</div>
              </div>
            )}
          </div>

          {s.notes && (
            <div className="mt-2 bg-yellow-50 border border-yellow-100 rounded p-2 text-xs text-yellow-800">{s.notes}</div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={toggleMovements} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium">
              {showMovements ? "Ocultar movimientos" : "Ver movimientos"}
            </button>
            <button onClick={() => setShowMoveForm(v => !v)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Registrar movimiento
            </button>
            <button onClick={() => onEdit(s)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 font-medium">
              Editar fuente
            </button>
          </div>

          {showMoveForm && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-green-800 mb-2">Registrar movimiento / evento</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2">
                  <label className="text-gray-600">Tipo</label>
                  <select className="w-full border rounded p-1 mt-0.5" value={moveForm.movement_type} onChange={e => setMoveForm(f => ({ ...f, movement_type: e.target.value }))}>
                    <option value="inventory">Inventario físico</option>
                    <option value="leak_test">Prueba de estanqueidad</option>
                    <option value="use">Uso clínico</option>
                    <option value="return">Retorno a almacén</option>
                    <option value="transfer_out">Traslado salida</option>
                    <option value="transfer_in">Recepción / ingreso</option>
                    <option value="maintenance">Mantención</option>
                    <option value="disposal">Disposición residuos</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-600">Desde</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={moveForm.from_location} onChange={e => setMoveForm(f => ({ ...f, from_location: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Hacia</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={moveForm.to_location} onChange={e => setMoveForm(f => ({ ...f, to_location: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Realizado por</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={moveForm.performed_by} onChange={e => setMoveForm(f => ({ ...f, performed_by: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Autorizado por</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={moveForm.authorized_by} onChange={e => setMoveForm(f => ({ ...f, authorized_by: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-600">Propósito / resultado</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={saveMovement} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">Guardar</button>
                <button onClick={() => setShowMoveForm(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded">Cancelar</button>
              </div>
            </div>
          )}

          {showMovements && (
            <div className="mt-3">
              {movements.length === 0 ? (
                <div className="text-xs text-gray-400 italic">Sin movimientos registrados</div>
              ) : (
                <div className="space-y-1">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-100">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">{mvTypeLabel[m.movement_type] || m.movement_type}</span>
                      <span className="text-gray-500">{new Date(m.movement_date).toLocaleDateString("es-CL")}</span>
                      {m.to_location && <span className="text-blue-600">→ {m.to_location}</span>}
                      {m.performed_by && <span className="text-gray-500">({m.performed_by})</span>}
                      {m.notes && <span className="text-gray-600 italic">{m.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourceModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: "", radionuclide: "", source_type: "sealed", physical_form: "", activity_bq: "", activity_unit: "GBq", activity_date: "", half_life_days: "", manufacturer: "", serial_number: "", location: "", storage_location: "", custodian: "", cchen_registration: "", cchen_registration_expiry: "", license_number: "", use_category: "", status: "storage", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/radioactive-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Registrar fuente radiactiva</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-gray-600 font-medium mb-1">Nombre *</label>
              <input className="w-full border rounded-lg p-2" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Radionúclido *</label>
              <input className="w-full border rounded-lg p-2 font-mono" placeholder="Tc-99m / Am-241 / Co-57..." value={form.radionuclide} onChange={e => setForm(f => ({ ...f, radionuclide: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Tipo de fuente</label>
              <select className="w-full border rounded-lg p-2" value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}>
                <option value="sealed">Sellada</option>
                <option value="unsealed">No sellada</option>
                <option value="generator">Generador</option>
                <option value="device">Dispositivo</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Actividad</label>
              <div className="flex gap-1">
                <input type="number" className="flex-1 border rounded-lg p-2 font-mono" placeholder="0.000" value={form.activity_bq} onChange={e => setForm(f => ({ ...f, activity_bq: e.target.value }))} />
                <select className="border rounded-lg p-2 text-sm" value={form.activity_unit} onChange={e => setForm(f => ({ ...f, activity_unit: e.target.value }))}>
                  <option value="GBq">GBq</option>
                  <option value="MBq">MBq</option>
                  <option value="kBq">kBq</option>
                  <option value="TBq">TBq</option>
                  <option value="Bq">Bq</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Fecha actividad ref.</label>
              <input type="date" className="w-full border rounded-lg p-2" value={form.activity_date} onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Vida media (días)</label>
              <input type="number" step="0.01" className="w-full border rounded-lg p-2 font-mono" value={form.half_life_days} onChange={e => setForm(f => ({ ...f, half_life_days: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Fabricante</label>
              <input className="w-full border rounded-lg p-2" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">N° Serie</label>
              <input className="w-full border rounded-lg p-2 font-mono" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Ubicación actual</label>
              <input className="w-full border rounded-lg p-2" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Custodio</label>
              <input className="w-full border rounded-lg p-2" value={form.custodian} onChange={e => setForm(f => ({ ...f, custodian: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Reg. CCHEN</label>
              <input className="w-full border rounded-lg p-2 font-mono" value={form.cchen_registration} onChange={e => setForm(f => ({ ...f, cchen_registration: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Vencimiento reg.</label>
              <input type="date" className="w-full border rounded-lg p-2" value={form.cchen_registration_expiry} onChange={e => setForm(f => ({ ...f, cchen_registration_expiry: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">N° Licencia</label>
              <input className="w-full border rounded-lg p-2 font-mono" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Estado</label>
              <select className="w-full border rounded-lg p-2" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="storage">Almacenada</option>
                <option value="active">Activa</option>
                <option value="in_use">En uso</option>
                <option value="maintenance">Mantención</option>
                <option value="decommissioned">Descomisionada</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-gray-600 font-medium mb-1">Notas</label>
              <textarea className="w-full border rounded-lg p-2" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button onClick={save} disabled={saving || !form.name || !form.radionuclide} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar fuente"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RadioactiveSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterType) params.set("source_type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    const r = await fetch(`/api/radioactive-sources?${params}`);
    const data = await r.json();
    setSources(data.sources || []);
    setStats(data.stats || null);
    setLoading(false);
  }, [search, filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const expiring = sources.filter(s => s.days_to_cchen_expiry !== null && s.days_to_cchen_expiry <= 30);
  const overdueInventory = sources.filter(s => s.days_to_next_inventory !== null && s.days_to_next_inventory < 0);
  const overdueLeakTest = sources.filter(s => s.source_type === "sealed" && s.days_to_next_leak_test !== null && s.days_to_next_leak_test < 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Atom className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Fuentes Radiactivas</h1>
          </div>
          <p className="text-sm text-gray-500">Inventario y control de fuentes · NS-06.0 §5 · DS 3/1985 — IAEA Safety Standards</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva fuente
        </button>
      </div>

      {/* Alert banners */}
      {expiring.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-red-800">Registros CCHEN por vencer: </span>
            <span className="text-red-700">{expiring.map(s => `${s.name} (${s.cchen_registration})`).join(", ")}. Gestionar renovación urgente.</span>
          </div>
        </div>
      )}
      {overdueInventory.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <Package className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-orange-800">Inventario vencido: </span>
            <span className="text-orange-700">{overdueInventory.map(s => s.name).join(", ")}. NS-06.0 §5.3: inventario semestral obligatorio.</span>
          </div>
        </div>
      )}
      {overdueLeakTest.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <Shield className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-yellow-800">Prueba de estanqueidad vencida: </span>
            <span className="text-yellow-700">{overdueLeakTest.map(s => s.name).join(", ")}. IAEA SS GSR Part 3 §4.26.</span>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Atom className="w-4 h-4 text-purple-500" /><span className="text-xs text-gray-500 font-medium uppercase">Total fuentes</span></div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-400">{stats.sealed_count} selladas · {stats.unsealed_count} no selladas · {stats.generators} gen.</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-blue-500" /><span className="text-xs text-gray-500 font-medium uppercase">En uso</span></div>
            <div className="text-2xl font-bold text-blue-700">{stats.in_use}</div>
            <div className="text-xs text-gray-400">{stats.in_storage} almacenadas</div>
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${Number(stats.expiring_soon) > 0 ? "border-red-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1"><Calendar className={`w-4 h-4 ${Number(stats.expiring_soon) > 0 ? "text-red-500" : "text-gray-400"}`} /><span className="text-xs text-gray-500 font-medium uppercase">Por vencer 90d</span></div>
            <div className={`text-2xl font-bold ${Number(stats.expiring_soon) > 0 ? "text-red-600" : "text-gray-900"}`}>{stats.expiring_soon}</div>
            <div className="text-xs text-gray-400">registros CCHEN</div>
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${Number(stats.overdue_inventory) > 0 ? "border-orange-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1"><Clock className={`w-4 h-4 ${Number(stats.overdue_inventory) > 0 ? "text-orange-500" : "text-gray-400"}`} /><span className="text-xs text-gray-500 font-medium uppercase">Inv. vencidos</span></div>
            <div className={`text-2xl font-bold ${Number(stats.overdue_inventory) > 0 ? "text-orange-600" : "text-gray-900"}`}>{stats.overdue_inventory}</div>
            <div className="text-xs text-gray-400">{stats.overdue_leak_test} prueba estanqueidad</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="Buscar fuente / radionúclido..." className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="sealed">Selladas</option>
          <option value="unsealed">No selladas</option>
          <option value="generator">Generadores</option>
          <option value="device">Dispositivos</option>
        </select>
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="in_use">En uso</option>
          <option value="storage">Almacenada</option>
          <option value="active">Activa</option>
          <option value="decommissioned">Descomisionada</option>
          <option value="lost">Extraviada</option>
        </select>
      </div>

      {/* Sources list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando inventario de fuentes...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No se encontraron fuentes radiactivas</div>
      ) : (
        <div>
          {sources.map(s => <SourceCard key={s.id} s={s} onEdit={() => {}} />)}
        </div>
      )}

      {/* Regulatory footer */}
      <div className="mt-6 p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
        <div className="flex items-center gap-1 font-semibold mb-1">
          <FileText className="w-3.5 h-3.5" />
          NS-06.0 §5 · DS N°3/1985 · IAEA Safety Standards GSR Part 3
        </div>
        <div className="space-y-0.5 text-purple-600">
          <div>• Inventario físico: mínimo semestral para fuentes selladas y anuales para equipos generadores</div>
          <div>• Prueba de estanqueidad (wipe test): fuentes selladas ≥ 1 TBq según actividad, cada 2 años o según fabricante</div>
          <div>• Todo movimiento de fuente debe registrarse en el Libro de Control de Fuentes CCHEN (Art. 25 DS 3/1985)</div>
          <div>• Fuentes no selladas: registro de manipulación, dosis dispensadas y residuos generados (NS-06.0 §5.6)</div>
        </div>
      </div>

      {showModal && <SourceModal onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  );
}
