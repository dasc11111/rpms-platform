"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Atom, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  ClipboardList, Calendar, Shield, Activity, FileText,
  CheckCircle, Clock, Zap, Radiation
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
interface Source {
  id: number;
  cchen_registration: string;
  source_name: string;
  radionuclide: string;
  half_life_days: number;
  category: string;
  source_type: string;
  manufacturer: string;
  serial_number: string;
  model: string;
  initial_activity_gbq: number;
  reference_date: string;
  calibration_date: string;
  acquisition_date: string;
  location: string;
  use_description: string;
  authorized_use: string;
  cchen_auth_number: string;
  cchen_auth_expiry: string;
  last_cchen_report: string;
  next_cchen_report: string;
  leak_test_date: string;
  leak_test_result: string;
  next_leak_test: string;
  status: string;
  notes: string;
  current_activity_gbq: number;
  half_lives_elapsed: number;
}

interface SourceEvent {
  id: number;
  source_id: number;
  event_type: string;
  event_date: string;
  performed_by: string;
  entity: string;
  result: string;
  activity_measured_gbq: number;
  notes: string;
  document_ref: string;
}

interface Stats {
  total_active: string;
  total_stored: string;
  total_transferred: string;
  total_disposed: string;
  auth_expiring_90d: string;
  auth_expired: string;
  report_due_30d: string;
  leak_test_overdue: string;
  leak_test_failed: string;
}

// ── Config ─────────────────────────────────────────────────────────────
const CAT_CFG: Record<string, { label: string; color: string }> = {
  "1": { label: "Cat. 1 (Crítica)", color: "bg-red-100 text-red-800" },
  "2": { label: "Cat. 2 (Alta)", color: "bg-orange-100 text-orange-800" },
  "3": { label: "Cat. 3 (Media)", color: "bg-yellow-100 text-yellow-800" },
  "4": { label: "Cat. 4 (Baja)", color: "bg-green-100 text-green-800" },
  "5": { label: "Cat. 5 (Mínima)", color: "bg-gray-100 text-gray-700" },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  active: { label: "En uso", color: "bg-green-100 text-green-800" },
  stored: { label: "Almacenada", color: "bg-blue-100 text-blue-800" },
  maintenance: { label: "Mantención", color: "bg-yellow-100 text-yellow-800" },
  transferred: { label: "Transferida", color: "bg-purple-100 text-purple-700" },
  disposed: { label: "Dispuesta", color: "bg-gray-100 text-gray-600" },
};

const SOURCE_TYPES: Record<string, string> = {
  sealed: "Sellada",
  unsealed: "No sellada",
  generator: "Generador",
  device: "Dispositivo",
};

const EVENT_TYPES = [
  { value: "leak_test", label: "Prueba de estanqueidad" },
  { value: "cchen_report", label: "Declaración CCHEN" },
  { value: "calibration", label: "Calibración" },
  { value: "inventory", label: "Verificación inventario" },
  { value: "transfer", label: "Transferencia" },
  { value: "incident", label: "Incidente" },
  { value: "maintenance", label: "Mantención" },
  { value: "other", label: "Otro" },
];

const KNOWN_HL: Record<string, number> = {
  "F-18": 0.076, "Tc-99m": 0.251, "Ga-67": 3.26, "In-111": 2.80,
  "I-131": 8.02, "I-123": 0.546, "Lu-177": 6.73, "Y-90": 2.67,
  "Tl-201": 3.04, "Co-57": 271.74, "Co-60": 1925.5, "Cs-137": 10956.5,
  "Ba-133": 3845.0, "Ge-68": 270.95, "Ga-68": 0.047, "Sr-90": 10519.2,
  "Am-241": 157788.0, "Ir-192": 73.83, "Se-75": 119.78,
};

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fmtGbq = (v: number) => {
  if (!v && v !== 0) return "—";
  if (v < 0.000001) return `${(v * 1e9).toFixed(1)} Bq`;
  if (v < 0.001) return `${(v * 1e6).toFixed(2)} kBq`;
  if (v < 1) return `${(v * 1000).toFixed(2)} MBq`;
  return `${v.toFixed(4)} GBq`;
};

const daysUntil = (dateStr: string): number => {
  if (!dateStr) return Infinity;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 3600 * 24));
};

function DueChip({ dateStr, label }: { dateStr: string; label: string }) {
  const d = daysUntil(dateStr);
  if (!dateStr) return null;
  if (d < 0) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
      <AlertTriangle size={11} /> {label} vencido {Math.abs(d)}d
    </span>
  );
  if (d <= 90) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
      <Clock size={11} /> {label} en {d}d
    </span>
  );
  return null;
}

// ── EventForm ───────────────────────────────────────────────────────────
function EventForm({ sourceId, onSave, onCancel }: {
  sourceId: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    event_type: "leak_test", event_date: today, performed_by: "",
    entity: "", result: "pass", activity_measured_gbq: "", notes: "", document_ref: ""
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "event", source_id: sourceId, ...form,
        activity_measured_gbq: form.activity_measured_gbq ? parseFloat(form.activity_measured_gbq) : null })
    });
    setSaving(false);
    onSave();
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
      <p className="text-sm font-semibold text-blue-900 mb-3">Registrar Evento</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Tipo de evento</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.event_type} onChange={e => f("event_type", e.target.value)}>
            {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Fecha</label>
          <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.event_date} onChange={e => f("event_date", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Realizado por</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Nombre" value={form.performed_by} onChange={e => f("performed_by", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Entidad/Organismo</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="CCHEN / Laboratorio..." value={form.entity} onChange={e => f("entity", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Resultado</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.result} onChange={e => f("result", e.target.value)}>
            <option value="pass">Aprobado / Conforme</option>
            <option value="fail">No conforme</option>
            <option value="accepted">Aceptado (CCHEN)</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Actividad medida (GBq)</label>
          <input type="number" step="any" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="opcional" value={form.activity_measured_gbq} onChange={e => f("activity_measured_gbq", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Ref. documento</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="N° certificado / informe" value={form.document_ref} onChange={e => f("document_ref", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Observaciones</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="..." value={form.notes} onChange={e => f("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onCancel} className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  );
}

// ── SourceCard ──────────────────────────────────────────────────────────
function SourceCard({ src, onRefresh }: { src: Source; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<SourceEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  const loadEvents = async () => {
    if (!loaded) {
      const r = await fetch(`/api/sources?id=${src.id}`);
      const d = await r.json();
      setEvents(d.events || []);
      setLoaded(true);
    }
    setOpen(true);
  };

  const toggle = () => {
    if (!open) loadEvents();
    else setOpen(false);
  };

  const cat = CAT_CFG[src.category] || CAT_CFG["4"];
  const status = STATUS_CFG[src.status] || STATUS_CFG["active"];
  const isActive = !["transferred", "disposed"].includes(src.status);

  const decayPct = Math.min(100, (src.half_lives_elapsed / 10) * 100);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{src.cchen_registration}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
          </div>
          <h3 className="mt-1.5 font-semibold text-gray-900 text-sm leading-tight">{src.source_name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{src.location || "Sin ubicación"}</p>
        </div>
        <button onClick={toggle} className="text-gray-400 hover:text-gray-600 mt-1 flex-shrink-0">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Activity row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-3 border-t border-gray-50">
        <div className="pt-3">
          <p className="text-xs text-gray-500">Radionucleido</p>
          <p className="text-sm font-bold text-purple-700">{src.radionuclide}</p>
          <p className="text-xs text-gray-400">T½ = {src.half_life_days < 1 ? `${(src.half_life_days * 24).toFixed(1)}h` : `${src.half_life_days.toFixed(1)}d`}</p>
        </div>
        <div className="pt-3">
          <p className="text-xs text-gray-500">Act. inicial (ref.)</p>
          <p className="text-sm font-semibold text-gray-800">{fmtGbq(src.initial_activity_gbq)}</p>
          <p className="text-xs text-gray-400">{fmtDate(src.reference_date)}</p>
        </div>
        <div className="pt-3">
          <p className="text-xs text-gray-500">Act. actual (calc.)</p>
          <p className="text-sm font-bold text-blue-700">{fmtGbq(src.current_activity_gbq)}</p>
          <p className="text-xs text-gray-400">{src.half_lives_elapsed.toFixed(1)} T½ transcurridas</p>
        </div>
      </div>

      {/* Decay bar */}
      {isActive && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Decaimiento acumulado</span>
            <span>{Math.min(100, (1 - src.current_activity_gbq / src.initial_activity_gbq) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${decayPct > 80 ? "bg-green-500" : decayPct > 50 ? "bg-blue-500" : "bg-purple-500"}`}
              style={{ width: `${Math.min(100, (1 - src.current_activity_gbq / src.initial_activity_gbq) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Due chips */}
      {isActive && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <DueChip dateStr={src.cchen_auth_expiry} label="Autorización CCHEN" />
          <DueChip dateStr={src.next_cchen_report} label="Declaración CCHEN" />
          <DueChip dateStr={src.next_leak_test} label="Prueba estanqueidad" />
          {src.leak_test_result === "fail" && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
              <AlertTriangle size={11} /> Prueba estanqueidad FALLIDA
            </span>
          )}
          {src.notes && src.notes.includes("PRÓXIMO VENCIMIENTO") && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
              <AlertTriangle size={11} /> Renovación pendiente
            </span>
          )}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <div>
              <span className="text-xs text-gray-500">Tipo fuente</span>
              <p>{SOURCE_TYPES[src.source_type] || src.source_type}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Fabricante / Modelo</span>
              <p>{[src.manufacturer, src.model].filter(Boolean).join(" — ") || "—"}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">N° serie</span>
              <p>{src.serial_number || "—"}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Adquisición</span>
              <p>{fmtDate(src.acquisition_date)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-gray-500">Uso autorizado</span>
              <p>{src.use_description || src.authorized_use || "—"}</p>
            </div>
          </div>

          {/* CCHEN auth block */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
              <Shield size={13} /> Autorización CCHEN
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-blue-700">N° Autorización</p>
                <p className="font-medium">{src.cchen_auth_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Vigencia</p>
                <p className={`font-medium ${daysUntil(src.cchen_auth_expiry) < 0 ? "text-red-600" : daysUntil(src.cchen_auth_expiry) < 90 ? "text-amber-600" : ""}`}>
                  {fmtDate(src.cchen_auth_expiry)}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Próxima declaración</p>
                <p className={`font-medium ${daysUntil(src.next_cchen_report) < 30 ? "text-amber-600" : ""}`}>
                  {fmtDate(src.next_cchen_report)}
                </p>
              </div>
            </div>
          </div>

          {/* Leak test block */}
          <div className="bg-green-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1.5">
              <CheckCircle size={13} /> Prueba de Estanqueidad
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-green-700">Última prueba</p>
                <p className="font-medium">{fmtDate(src.leak_test_date)}</p>
              </div>
              <div>
                <p className="text-xs text-green-700">Resultado</p>
                <p className={`font-medium ${src.leak_test_result === "fail" ? "text-red-600" : "text-green-700"}`}>
                  {src.leak_test_result === "pass" ? "✓ Conforme" : src.leak_test_result === "fail" ? "✗ No conforme" : src.leak_test_result || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-green-700">Próxima prueba</p>
                <p className={`font-medium ${daysUntil(src.next_leak_test) < 0 ? "text-red-600" : ""}`}>
                  {fmtDate(src.next_leak_test)}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {src.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-xs text-yellow-900">
              <strong>Observación:</strong> {src.notes}
            </div>
          )}

          {/* Events */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText size={13} /> Historial de eventos
              </p>
              {isActive && (
                <button
                  onClick={() => setShowEventForm(!showEventForm)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Plus size={13} /> Registrar evento
                </button>
              )}
            </div>
            {showEventForm && (
              <EventForm sourceId={src.id} onCancel={() => setShowEventForm(false)} onSave={() => {
                setShowEventForm(false); setLoaded(false); loadEvents(); onRefresh();
              }} />
            )}
            {events.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin eventos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Tipo</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Fecha</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Realizado por</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Resultado</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600 border-b">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice(0, 8).map(ev => (
                      <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1.5">{EVENT_TYPES.find(e => e.value === ev.event_type)?.label || ev.event_type}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(ev.event_date)}</td>
                        <td className="px-2 py-1.5">{ev.performed_by || "—"}</td>
                        <td className={`px-2 py-1.5 font-medium ${ev.result === "fail" ? "text-red-600" : ev.result === "pass" || ev.result === "accepted" ? "text-green-700" : "text-gray-600"}`}>
                          {ev.result || "—"}
                        </td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate">{ev.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SourceForm ──────────────────────────────────────────────────────────
function SourceForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    cchen_registration: "", source_name: "", radionuclide: "", half_life_days: "",
    category: "4", source_type: "sealed", manufacturer: "", serial_number: "",
    model: "", initial_activity_gbq: "", reference_date: today,
    calibration_date: "", acquisition_date: today, location: "",
    use_description: "", authorized_use: "", cchen_auth_number: "",
    cchen_auth_expiry: "", next_cchen_report: "",
    leak_test_date: today, leak_test_result: "pass", next_leak_test: "",
    status: "active", notes: ""
  });
  const [saving, setSaving] = useState(false);

  const f = (k: string, v: string) => {
    setForm(p => {
      const updated: any = { ...p, [k]: v };
      if (k === "radionuclide" && KNOWN_HL[v]) {
        updated.half_life_days = String(KNOWN_HL[v]);
      }
      return updated;
    });
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, half_life_days: parseFloat(form.half_life_days), initial_activity_gbq: parseFloat(form.initial_activity_gbq) })
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-10">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-900">Nueva Fuente Radiactiva</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm max-h-[75vh] overflow-y-auto">
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">N° Registro CCHEN *</label>
            <input className="w-full border rounded px-3 py-2" placeholder="CCHEN-MN-YYYY-NNNN" value={form.cchen_registration} onChange={e => f("cchen_registration", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Nombre de la fuente *</label>
            <input className="w-full border rounded px-3 py-2" placeholder="Descripción identificatoria" value={form.source_name} onChange={e => f("source_name", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Radionucleido *</label>
            <select className="w-full border rounded px-3 py-2" value={form.radionuclide} onChange={e => f("radionuclide", e.target.value)}>
              <option value="">Seleccionar…</option>
              {Object.keys(KNOWN_HL).map(rl => <option key={rl} value={rl}>{rl}</option>)}
              <option value="otro">Otro</option>
            </select>
            {form.radionuclide === "otro" && (
              <input className="w-full border rounded px-3 py-2 mt-1" placeholder="Ej: Ra-226" onChange={e => f("radionuclide", e.target.value)} />
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Semivida (días) *</label>
            <input type="number" step="any" className="w-full border rounded px-3 py-2" value={form.half_life_days} onChange={e => f("half_life_days", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Categoría IAEA</label>
            <select className="w-full border rounded px-3 py-2" value={form.category} onChange={e => f("category", e.target.value)}>
              {Object.entries(CAT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tipo de fuente</label>
            <select className="w-full border rounded px-3 py-2" value={form.source_type} onChange={e => f("source_type", e.target.value)}>
              {Object.entries(SOURCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Actividad inicial (GBq) *</label>
            <input type="number" step="any" className="w-full border rounded px-3 py-2" placeholder="En GBq" value={form.initial_activity_gbq} onChange={e => f("initial_activity_gbq", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha de referencia *</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.reference_date} onChange={e => f("reference_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fabricante</label>
            <input className="w-full border rounded px-3 py-2" value={form.manufacturer} onChange={e => f("manufacturer", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">N° serie</label>
            <input className="w-full border rounded px-3 py-2" value={form.serial_number} onChange={e => f("serial_number", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Ubicación</label>
            <input className="w-full border rounded px-3 py-2" value={form.location} onChange={e => f("location", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Descripción de uso autorizado</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.use_description} onChange={e => f("use_description", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">N° Autorización CCHEN</label>
            <input className="w-full border rounded px-3 py-2" value={form.cchen_auth_number} onChange={e => f("cchen_auth_number", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vencimiento autorización</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.cchen_auth_expiry} onChange={e => f("cchen_auth_expiry", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Próxima declaración CCHEN</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.next_cchen_report} onChange={e => f("next_cchen_report", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Estado</label>
            <select className="w-full border rounded px-3 py-2" value={form.status} onChange={e => f("status", e.target.value)}>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Observaciones</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.notes} onChange={e => f("notes", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={save} disabled={saving || !form.cchen_registration || !form.source_name || !form.radionuclide} className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar fuente"}
          </button>
          <button onClick={onCancel} className="border px-5 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterCategory) params.set("category", filterCategory);
    const r = await fetch(`/api/sources?${params}`);
    const d = await r.json();
    setSources(d.sources || []);
    setStats(d.stats || null);
    setLoading(false);
  }, [filterStatus, filterCategory]);

  useEffect(() => { load(); }, [load]);

  const alertCount = stats
    ? parseInt(stats.auth_expired || "0") + parseInt(stats.leak_test_failed || "0")
    : 0;

  const expiringSoon = stats
    ? parseInt(stats.auth_expiring_90d || "0") + parseInt(stats.report_due_30d || "0") + parseInt(stats.leak_test_overdue || "0")
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Atom size={24} className="text-purple-600" />
            Gestión de Fuentes Radiactivas
          </h1>
          <p className="text-sm text-gray-500 mt-1">Inventario CCHEN · DS 3/1985 Arts. 3-15 · IAEA RS-G-1.9</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          <Plus size={16} /> Nueva Fuente
        </button>
      </div>

      {/* Alert banners */}
      {alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">⚠ Atención requerida: {alertCount} alerta{alertCount > 1 ? "s" : ""} critica{alertCount > 1 ? "s" : ""}</p>
            <p className="text-xs text-red-700 mt-0.5">
              {parseInt(stats?.auth_expired || "0") > 0 && `${stats!.auth_expired} autorización(es) CCHEN vencida(s). `}
              {parseInt(stats?.leak_test_failed || "0") > 0 && `${stats!.leak_test_failed} prueba(s) de estanqueidad no conforme(s).`}
            </p>
          </div>
        </div>
      )}
      {expiringSoon > 0 && alertCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <Clock size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {expiringSoon} documentación(es) por vencer: {stats?.auth_expiring_90d} autorización(es) ≤90 días · {stats?.report_due_30d} declaración(es) ≤30 días · {stats?.leak_test_overdue} prueba(s) estanqueidad vencida(s)
          </p>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "En uso", value: stats?.total_active, color: "text-green-700", bg: "bg-green-50", icon: <Activity size={18} /> },
          { label: "Almacenadas", value: stats?.total_stored, color: "text-blue-700", bg: "bg-blue-50", icon: <ClipboardList size={18} /> },
          { label: "Autorizaciones exp.", value: stats?.auth_expiring_90d, color: "text-amber-700", bg: "bg-amber-50", icon: <Shield size={18} /> },
          { label: "Dec. CCHEN próx.", value: stats?.report_due_30d, color: "text-purple-700", bg: "bg-purple-50", icon: <Calendar size={18} /> },
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
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Sources list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando inventario…</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay fuentes registradas</div>
      ) : (
        <div className="space-y-4">
          {sources.map(src => <SourceCard key={src.id} src={src} onRefresh={load} />)}
        </div>
      )}

      {/* Normativa footer */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Marco Regulatorio</p>
        <p>DS 3/1985 Arts. 3-15 (registro y control de fuentes) · IAEA RS-G-1.9 (categorización de fuentes) · IAEA SSG-15 (seguridad fuentes selladas) · CCHEN: declaración anual inventario fuentes radiactivas</p>
      </div>

      {showForm && <SourceForm onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
