"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Wrench, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, X, Edit2, Trash2,
  Calendar, Radio, Zap, Settings, Tool
} from "lucide-react";

// §54 — Gestión de Equipos y Mantenimiento
// DS 3/1985 Art. 18 — equipos bajo norma técnica
// IAEA TECDOC-1040 — control calidad equipos medicina nuclear

interface Equipment {
  id: number;
  equipment_code: string;
  name: string;
  category: string;
  model: string | null;
  brand: string | null;
  serial_number: string | null;
  acquisition_date: string | null;
  installation_date: string | null;
  location: string | null;
  responsible: string | null;
  maintenance_freq_months: number;
  last_maintenance: string | null;
  next_maintenance: string | null;
  calibration_freq_months: number;
  last_calibration: string | null;
  next_calibration: string | null;
  qa_freq_months: number;
  last_qa: string | null;
  next_qa: string | null;
  warranty_expiry: string | null;
  status: string;
  observations: string | null;
  references_norm: string | null;
  notes: string | null;
}

interface EquipmentEvent {
  id: number;
  equipment_id: number;
  event_type: string;
  event_date: string;
  performed_by: string | null;
  entity: string | null;
  description: string | null;
  findings: string | null;
  result: string;
  next_due: string | null;
  cost: number | null;
  notes: string | null;
}

interface Stats {
  total: string; operational: string; maintenance: string;
  out_of_service: string; maintenance_due: string; calibration_due: string; qa_overdue: string;
}

const CAT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  gamma_camera:    { label: "Gammacámara",         color: "text-blue-700",   bg: "bg-blue-100"   },
  pet_ct:          { label: "PET/CT",              color: "text-purple-700", bg: "bg-purple-100" },
  dose_calibrator: { label: "Calibrador de dosis", color: "text-orange-700", bg: "bg-orange-100" },
  survey_meter:    { label: "Monitor/Contador",    color: "text-green-700",  bg: "bg-green-100"  },
  radiation_source:{ label: "Fuente radiactiva",   color: "text-red-700",    bg: "bg-red-100"    },
  it_equipment:    { label: "Equipo informático",  color: "text-gray-700",   bg: "bg-gray-100"   },
  other:           { label: "Otro",                color: "text-gray-600",   bg: "bg-gray-100"   },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  operational:    { label: "Operativo",       color: "text-green-700",  bg: "bg-green-100", icon: <CheckCircle2 size={13} />  },
  maintenance:    { label: "En mantención",   color: "text-amber-700",  bg: "bg-amber-100", icon: <Wrench size={13} />        },
  out_of_service: { label: "Fuera de servicio", color: "text-red-700", bg: "bg-red-100",   icon: <X size={13} />             },
  retired:        { label: "Dado de baja",    color: "text-gray-500",   bg: "bg-gray-100",  icon: <Trash2 size={13} />        },
};

const EVENT_CFG: Record<string, { label: string; color: string }> = {
  maintenance:  { label: "Mantención",  color: "text-amber-700"  },
  calibration:  { label: "Calibración", color: "text-blue-700"   },
  qa:           { label: "Control QA",  color: "text-purple-700" },
  repair:       { label: "Reparación",  color: "text-red-700"    },
  inspection:   { label: "Inspección",  color: "text-indigo-700" },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DueChip({ date, label }: { date: string | null; label: string }) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0)   return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{label} venc. {-days}d</span>;
  if (days <= 30) return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{label} en {days}d</span>;
  return null;
}

function EquipmentCard({ eq, onEdit, onDelete }: { eq: Equipment; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen]       = useState(false);
  const [events, setEvents]   = useState<EquipmentEvent[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [eForm, setEForm]     = useState({ event_type: "maintenance", event_date: "", performed_by: "", entity: "", description: "", result: "approved", next_due: "", cost: "" });

  const cat = CAT_CFG[eq.category] ?? CAT_CFG.other!;
  const st  = STATUS_CFG[eq.status] ?? STATUS_CFG.operational!;

  async function loadEvents() {
    if (loaded) return;
    const r = await fetch(`/api/equipment?id=${eq.id}`);
    const d = await r.json();
    setEvents(d.events ?? []);
    setLoaded(true);
  }

  async function addEvent() {
    await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "event", equipment_id: eq.id, ...eForm, cost: eForm.cost ? parseFloat(eForm.cost) : undefined })
    });
    setLoaded(false);
    loadEvents();
    setShowEvent(false);
    setEForm({ event_type: "maintenance", event_date: "", performed_by: "", entity: "", description: "", result: "approved", next_due: "", cost: "" });
  }

  const handleOpen = () => { setOpen(o => !o); if (!open) loadEvents(); };
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-CL") : "—";

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={handleOpen}>
        <div className={`mt-1 p-1.5 rounded-md ${cat.bg} shrink-0`}>
          <Wrench size={14} className={cat.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-600">{eq.equipment_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>{cat.label}</span>
            <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.icon}{st.label}</span>
          </div>
          <p className="font-medium text-gray-900 truncate">{eq.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{eq.brand} {eq.model} {eq.serial_number ? `· S/N: ${eq.serial_number}` : ""}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <DueChip date={eq.next_maintenance} label="Mantención" />
            <DueChip date={eq.next_calibration} label="Calibración" />
            <DueChip date={eq.next_qa} label="QA" />
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 mt-1 shrink-0" />
               : <ChevronDown size={18} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
            {eq.location && <div><span className="font-medium">Ubicación:</span> {eq.location}</div>}
            {eq.responsible && <div><span className="font-medium">Responsable:</span> {eq.responsible}</div>}
            {eq.acquisition_date && <div><span className="font-medium">Adquisición:</span> {fmtDate(eq.acquisition_date)}</div>}
            {eq.installation_date && <div><span className="font-medium">Instalación:</span> {fmtDate(eq.installation_date)}</div>}
            {eq.warranty_expiry && <div><span className="font-medium">Garantía:</span> {fmtDate(eq.warranty_expiry)}</div>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Mantención", last: eq.last_maintenance, next: eq.next_maintenance, freq: eq.maintenance_freq_months, color: "amber" },
              { label: "Calibración", last: eq.last_calibration, next: eq.next_calibration, freq: eq.calibration_freq_months, color: "blue" },
              { label: "Control QA", last: eq.last_qa, next: eq.next_qa, freq: eq.qa_freq_months, color: "purple" },
            ].map(item => {
              const days = daysUntil(item.next);
              const overdue = days !== null && days < 0;
              const warn    = days !== null && days <= 30 && !overdue;
              return (
                <div key={item.label} className={`rounded-lg p-3 text-xs border ${overdue ? "bg-red-50 border-red-200" : warn ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
                  <p className="font-semibold text-gray-700 mb-1">{item.label}</p>
                  <p className="text-gray-500">Último: {fmtDate(item.last)}</p>
                  <p className={overdue ? "text-red-700 font-medium" : warn ? "text-amber-700 font-medium" : "text-gray-500"}>
                    Próximo: {fmtDate(item.next)}
                  </p>
                  <p className="text-gray-400">Freq: {item.freq}m</p>
                </div>
              );
            })}
          </div>

          {/* Historial de eventos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">Historial de eventos ({events.length})</p>
              <button onClick={() => setShowEvent(!showEvent)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={12} />Registrar evento
              </button>
            </div>

            {showEvent && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select className="border rounded px-2 py-1 w-full text-xs" value={eForm.event_type} onChange={e => setEForm(f => ({ ...f, event_type: e.target.value }))}>
                    {Object.entries(EVENT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                  <input type="date" className="border rounded px-2 py-1 w-full" value={eForm.event_date} onChange={e => setEForm(f => ({ ...f, event_date: e.target.value }))} />
                  <input placeholder="Realizado por" className="border rounded px-2 py-1 w-full" value={eForm.performed_by} onChange={e => setEForm(f => ({ ...f, performed_by: e.target.value }))} />
                  <input placeholder="Empresa / Entidad" className="border rounded px-2 py-1 w-full" value={eForm.entity} onChange={e => setEForm(f => ({ ...f, entity: e.target.value }))} />
                  <input placeholder="Descripción" className="border rounded px-2 py-1 w-full col-span-2" value={eForm.description} onChange={e => setEForm(f => ({ ...f, description: e.target.value }))} />
                  <input type="date" placeholder="Próxima fecha" className="border rounded px-2 py-1 w-full" value={eForm.next_due} onChange={e => setEForm(f => ({ ...f, next_due: e.target.value }))} />
                  <input type="number" placeholder="Costo ($)" className="border rounded px-2 py-1 w-full" value={eForm.cost} onChange={e => setEForm(f => ({ ...f, cost: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={addEvent} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                  <button onClick={() => setShowEvent(false)} className="text-xs px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                </div>
              </div>
            )}

            {events.length > 0 ? (
              <div className="space-y-2">
                {events.slice(0, 5).map(ev => {
                  const ec = EVENT_CFG[ev.event_type] ?? EVENT_CFG.maintenance!;
                  return (
                    <div key={ev.id} className="flex items-start gap-3 text-xs border border-gray-100 rounded p-2">
                      <div className="shrink-0">
                        <span className={`font-medium ${ec.color}`}>{ec.label}</span>
                        <p className="text-gray-400">{new Date(ev.event_date).toLocaleDateString("es-CL")}</p>
                      </div>
                      <div className="flex-1">
                        {ev.description && <p className="text-gray-600">{ev.description}</p>}
                        {ev.performed_by && <p className="text-gray-400">{ev.performed_by}{ev.entity ? ` · ${ev.entity}` : ""}</p>}
                        {ev.next_due && <p className="text-gray-400">Próx: {new Date(ev.next_due).toLocaleDateString("es-CL")}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-medium ${ev.result === "approved" ? "text-green-700" : ev.result === "rejected" ? "text-red-600" : "text-gray-500"}`}>
                        {ev.result === "approved" ? "Aprobado" : ev.result === "rejected" ? "Rechazado" : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Sin eventos registrados</p>
            )}
          </div>

          {eq.references_norm && (
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-3 py-2">{eq.references_norm}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700">
              <Edit2 size={12} />Editar
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded text-red-600">
              <Trash2 size={12} />Dar de baja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY: Partial<Equipment> = {
  equipment_code: "", name: "", category: "gamma_camera", model: "", brand: "", serial_number: "",
  location: "", responsible: "", maintenance_freq_months: 6, calibration_freq_months: 12, qa_freq_months: 3,
  status: "operational", references_norm: "", notes: ""
};

function EquipmentForm({ initial, onSave, onClose }: {
  initial: Partial<Equipment>; onSave: (d: Partial<Equipment>) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Equipment>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Equipment, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const lbl = "block text-xs font-medium text-gray-600 mb-1";
  const inp = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench size={18} className="text-amber-600" />
            {initial.id ? "Editar equipo" : "Nuevo equipo"}
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input required className={inp} value={form.equipment_code ?? ""} onChange={e => set("equipment_code", e.target.value)} placeholder="EQ-MN-001" />
            </div>
            <div>
              <label className={lbl}>Categoría</label>
              <select className={inp} value={form.category ?? "gamma_camera"} onChange={e => set("category", e.target.value)}>
                {Object.entries(CAT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Nombre del equipo *</label>
            <input required className={inp} value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Marca</label>
              <input className={inp} value={form.brand ?? ""} onChange={e => set("brand", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Modelo</label>
              <input className={inp} value={form.model ?? ""} onChange={e => set("model", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>N° Serie</label>
              <input className={inp} value={form.serial_number ?? ""} onChange={e => set("serial_number", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Ubicación</label>
              <input className={inp} value={form.location ?? ""} onChange={e => set("location", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Responsable</label>
              <input className={inp} value={form.responsible ?? ""} onChange={e => set("responsible", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Fecha adquisición</label>
              <input type="date" className={inp} value={form.acquisition_date?.slice(0,10) ?? ""} onChange={e => set("acquisition_date", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fecha instalación</label>
              <input type="date" className={inp} value={form.installation_date?.slice(0,10) ?? ""} onChange={e => set("installation_date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Frecuencia mant. (meses)</label>
              <input type="number" className={inp} value={form.maintenance_freq_months ?? 6} onChange={e => set("maintenance_freq_months", parseInt(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Frecuencia calib. (meses)</label>
              <input type="number" className={inp} value={form.calibration_freq_months ?? 12} onChange={e => set("calibration_freq_months", parseInt(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Frecuencia QA (meses)</label>
              <input type="number" className={inp} value={form.qa_freq_months ?? 3} onChange={e => set("qa_freq_months", parseInt(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status ?? "operational"} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Vencimiento garantía</label>
              <input type="date" className={inp} value={form.warranty_expiry?.slice(0,10) ?? ""} onChange={e => set("warranty_expiry", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Referencias normativas</label>
            <input className={inp} value={form.references_norm ?? ""} onChange={e => set("references_norm", e.target.value)} placeholder="DS 3/1985 Art. 18; IAEA TECDOC-1040..." />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [filterSt, setFilterSt]   = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Equipment | null>(null);
  const [error, setError]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat) params.set("category", filterCat);
    if (filterSt)  params.set("status", filterSt);
    try {
      const r = await fetch(`/api/equipment?${params}`);
      const d = await r.json();
      setEquipmentList(d.equipment ?? []);
      setStats(d.stats ?? null);
    } catch { setError("Error cargando equipos"); }
    setLoading(false);
  }, [filterCat, filterSt]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: Partial<Equipment>) {
    const r = await fetch("/api/equipment", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) { const d = await r.json(); alert(d.error ?? "Error"); return; }
    setShowForm(false); setEditing(null); load();
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Dar de baja este equipo?")) return;
    await fetch(`/api/equipment?id=${id}`, { method: "DELETE" });
    load();
  }

  const maintDue = parseInt(stats?.maintenance_due ?? "0");
  const calDue   = parseInt(stats?.calibration_due ?? "0");
  const qaOver   = parseInt(stats?.qa_overdue ?? "0");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench size={28} className="text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Equipos y Mantenimiento</h1>
            <p className="text-sm text-gray-500">DS 3/1985 Art. 18 — IAEA TECDOC-1040 — Control calidad equipos Medicina Nuclear</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 text-sm font-medium"
        >
          <Plus size={16} />Nuevo equipo
        </button>
      </div>

      {/* Alertas */}
      {(qaOver > 0 || maintDue > 0 || calDue > 0) && (
        <div className="mb-4 space-y-2">
          {qaOver > 0 && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-800">{qaOver} equipo{qaOver > 1 ? "s" : ""} con QA vencido — control de calidad requerido inmediato.</p>
            </div>
          )}
          {maintDue > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <Wrench size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{maintDue} equipo{maintDue > 1 ? "s" : ""} con mantención próxima (30 días).</p>
            </div>
          )}
          {calDue > 0 && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <Zap size={18} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-800">{calDue} equipo{calDue > 1 ? "s" : ""} con calibración próxima (30 días).</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total",         value: stats.total,         color: "text-gray-800"   },
            { label: "Operativos",    value: stats.operational,   color: "text-green-700"  },
            { label: "En mantención", value: stats.maintenance,   color: "text-amber-600"  },
            { label: "Fuera servicio",value: stats.out_of_service,color: "text-red-700"    },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        {(filterCat || filterSt) && (
          <button onClick={() => { setFilterCat(""); setFilterSt(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpiar filtros</button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando equipos…</div>
      ) : equipmentList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay equipos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {equipmentList.map(eq => (
            <EquipmentCard
              key={eq.id}
              eq={eq}
              onEdit={() => { setEditing(eq); setShowForm(true); }}
              onDelete={() => handleDelete(eq.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <EquipmentForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
