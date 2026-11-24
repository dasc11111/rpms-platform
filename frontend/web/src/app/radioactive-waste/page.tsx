"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import {
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
  Trash2, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  Clock, Package, FileText, Activity, Shield, CheckCircle
} from "lucide-react";

type WasteStatus = "in_storage" | "pending_clearance" | "cleared" | "transferred_cchen" | "disposed" | "lost";
type WasteType = "solid" | "liquid" | "gaseous" | "mixed" | "biological" | "sharps";

interface Waste {
  id: number;
  waste_code: string;
  description: string;
  origin_service: string;
  waste_type: WasteType;
  physical_state: string;
  radionuclide: string;
  estimated_activity_bq: number;
  activity_date: string;
  half_life_days: number;
  volume_liters: number;
  mass_kg: number;
  container_type: string;
  container_id: string;
  location: string;
  storage_start_date: string;
  projected_clearance_date: string;
  status: WasteStatus;
  clearance_basis: string;
  clearance_date: string;
  dose_rate_usvh: number;
  generated_by: string;
  responsible: string;
  notes: string;
  current_activity_bq: number;
  half_lives_elapsed: number | null;
  days_in_storage: number | null;
  days_to_clearance: number | null;
}

interface WasteEvent {
  id: number;
  event_type: string;
  event_date: string;
  performed_by: string;
  activity_bq: number;
  dose_rate_usvh: number;
  notes: string;
}

interface Stats {
  total: number;
  in_storage: number;
  pending_clearance: number;
  cleared: number;
  transferred: number;
  overdue_clearance: number;
}

function formatActivity(bq: number | null): string {
  if (!bq || bq <= 0) return "<LOD";
  if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
  if (bq >= 1e9) return `${(bq / 1e9).toFixed(2)} GBq`;
  if (bq >= 1e6) return `${(bq / 1e6).toFixed(2)} MBq`;
  if (bq >= 1e3) return `${(bq / 1e3).toFixed(2)} kBq`;
  return `${bq.toFixed(2)} Bq`;
}

function StatusBadge({ status }: { status: WasteStatus }) {
  const cfg: Record<WasteStatus, { cls: string; label: string }> = {
    in_storage: { cls: "bg-blue-100 text-blue-800 border border-blue-200", label: "En almacenamiento" },
    pending_clearance: { cls: "bg-orange-100 text-orange-800 border border-orange-200", label: "Pend. liberación" },
    cleared: { cls: "bg-green-100 text-green-800 border border-green-200", label: "Liberado" },
    transferred_cchen: { cls: "bg-purple-100 text-purple-800 border border-purple-200", label: "Transferido CCHEN" },
    disposed: { cls: "bg-gray-100 text-gray-700 border border-gray-200", label: "Dispuesto" },
    lost: { cls: "bg-red-100 text-red-800 border border-red-200", label: "Extraviado" },
  };
  const c = cfg[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.cls}`}>{c.label}</span>;
}

function TypeBadge({ type }: { type: WasteType }) {
  const cfg: Record<WasteType, { cls: string; label: string }> = {
    solid: { cls: "bg-gray-100 text-gray-700", label: "Sólido" },
    liquid: { cls: "bg-blue-100 text-blue-700", label: "Líquido" },
    gaseous: { cls: "bg-teal-100 text-teal-700", label: "Gaseoso" },
    mixed: { cls: "bg-purple-100 text-purple-700", label: "Mixto" },
    biological: { cls: "bg-green-100 text-green-700", label: "Biológico" },
    sharps: { cls: "bg-red-100 text-red-700", label: "Cortopunzante" },
  };
  const c = cfg[type];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>{c.label}</span>;
}

function HalfLivesBar({ elapsed }: { elapsed: number | null }) {
  if (elapsed === null) return null;
  const pct = Math.min((elapsed / 10) * 100, 100);
  const color = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-orange-500";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-600">Vidas medias transcurridas</span>
        <span className={`font-mono font-semibold ${elapsed >= 10 ? "text-green-700" : "text-orange-600"}`}>{elapsed.toFixed(1)} T½ {elapsed >= 10 ? "✓ Liberable" : ""}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs text-gray-500 mt-0.5">Meta: ≥10 T½ para liberación</div>
    </div>
  );
}

function borderColor(w: Waste) {
  if (w.status === "lost") return "border-l-red-500";
  if (w.status === "pending_clearance") return "border-l-orange-400";
  if (w.days_to_clearance !== null && w.days_to_clearance < 0 && w.status === "in_storage") return "border-l-yellow-400";
  if (w.status === "cleared") return "border-l-green-500";
  if (w.status === "transferred_cchen") return "border-l-purple-500";
  return "border-l-blue-400";
}

function WasteCard({ w, onEdit }: { w: Waste; onEdit: (w: Waste) => void }) {
  const [open, setOpen] = useState(w.status === "in_storage" || w.status === "pending_clearance");
  const [events, setEvents] = useState<WasteEvent[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ event_type: "measurement", performed_by: "", activity_bq: "", dose_rate_usvh: "", notes: "" });

  const loadEvents = useCallback(async () => {
    const r = await fetch(`/api/radioactive-waste?waste_id=${w.id}`);
    const data = await r.json();
    setEvents(data.events || []);
  }, [w.id]);

  const saveEvent = async () => {
    await fetch("/api/radioactive-waste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "event", waste_id: w.id, ...eventForm, activity_bq: eventForm.activity_bq ? parseFloat(eventForm.activity_bq) : null, dose_rate_usvh: eventForm.dose_rate_usvh ? parseFloat(eventForm.dose_rate_usvh) : null }),
    });
    setShowEventForm(false);
    setEventForm(f => ({ ...f, activity_bq: "", dose_rate_usvh: "", notes: "" }));
    await loadEvents();
  };

  const eventTypeLabel: Record<string, string> = {
    created: "Creación", measurement: "Medición", container_change: "Cambio contenedor",
    location_change: "Cambio ubicación", clearance_check: "Verificación liberación",
    transferred: "Traslado", disposed: "Disposición", noted: "Anotación"
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(w)} shadow-sm mb-3 overflow-hidden`}>
      <div className="px-4 py-3 flex items-start justify-between cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{w.waste_code}</span>
            <span className="font-semibold text-gray-900 text-sm truncate max-w-xs">{w.description}</span>
            <StatusBadge status={w.status} />
            <TypeBadge type={w.waste_type} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="font-semibold text-purple-700">{w.radionuclide}</span>
            {w.origin_service && <><span className="text-gray-300">|</span><span>{w.origin_service}</span></>}
            {w.days_in_storage !== null && <><span className="text-gray-300">|</span><span>{w.days_in_storage}d almacenado</span></>}
            {w.half_lives_elapsed !== null && <span className={`${w.half_lives_elapsed >= 10 ? "text-green-600" : "text-orange-500"} font-medium`}>{w.half_lives_elapsed.toFixed(1)} T½</span>}
          </div>
          {w.days_to_clearance !== null && w.days_to_clearance <= 7 && w.status === "in_storage" && (
            <div className={`mt-1 text-xs ${w.days_to_clearance < 0 ? "text-green-600" : "text-orange-600"} font-medium`}>
              {w.days_to_clearance < 0 ? `Listo para liberación desde hace ${-w.days_to_clearance}d` : `Liberación en ${w.days_to_clearance}d`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <div className="text-right">
            <div className="text-xs text-gray-500">Actividad actual</div>
            <div className="text-sm font-bold font-mono text-orange-700">{formatActivity(w.current_activity_bq)}</div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </div>
      </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="radioactive-waste"
        ownerType="module"
        title="Documentos del módulo"
      />

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3">
            <HalfLivesBar elapsed={w.half_lives_elapsed} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
            <div className="bg-orange-50 rounded p-2">
              <div className="text-gray-500">Actividad ref.</div>
              <div className="font-mono font-semibold">{formatActivity(parseFloat(String(w.estimated_activity_bq)))}</div>
              <div className="text-gray-400">{w.activity_date ? new Date(w.activity_date).toLocaleDateString("es-CL") : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Vida media</div>
              <div className="font-semibold">{w.half_life_days ? `${parseFloat(String(w.half_life_days)).toFixed(2)}d` : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Volumen / Masa</div>
              <div className="font-semibold">{w.volume_liters ? `${w.volume_liters}L` : "—"} {w.mass_kg ? `/ ${w.mass_kg}kg` : ""}</div>
            </div>
            <div className={`rounded p-2 ${parseFloat(String(w.dose_rate_usvh)) > 100 ? "bg-red-50" : parseFloat(String(w.dose_rate_usvh)) > 10 ? "bg-orange-50" : "bg-green-50"}`}>
              <div className="text-gray-500">Tasa de dosis</div>
              <div className={`font-semibold font-mono ${parseFloat(String(w.dose_rate_usvh)) > 100 ? "text-red-600" : parseFloat(String(w.dose_rate_usvh)) > 10 ? "text-orange-600" : "text-green-700"}`}>
                {w.dose_rate_usvh ? `${parseFloat(String(w.dose_rate_usvh)).toFixed(1)} µSv/h` : "—"}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Contenedor</div>
              <div className="font-semibold">{w.container_type || "—"}</div>
              <div className="text-gray-400 font-mono text-xs">{w.container_id || ""}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Almacenamiento</div>
              <div className="font-semibold">{w.location || "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Inicio almac.</div>
              <div className="font-semibold">{w.storage_start_date ? new Date(w.storage_start_date).toLocaleDateString("es-CL") : "—"}</div>
            </div>
            <div className={`rounded p-2 ${w.days_to_clearance !== null && w.days_to_clearance < 0 ? "bg-green-50" : "bg-gray-50"}`}>
              <div className="text-gray-500">Liberación proyectada</div>
              <div className={`font-semibold ${w.days_to_clearance !== null && w.days_to_clearance < 0 ? "text-green-700" : "text-gray-800"}`}>
                {w.projected_clearance_date ? new Date(w.projected_clearance_date).toLocaleDateString("es-CL") : "—"}
              </div>
            </div>
          </div>

          {w.notes && (
            <div className="mt-2 bg-yellow-50 border border-yellow-100 rounded p-2 text-xs text-yellow-800">{w.notes}</div>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={async () => { if (!showEvents && events.length === 0) await loadEvents(); setShowEvents(v => !v); }} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium">
              {showEvents ? "Ocultar historial" : "Ver historial"}
            </button>
            <button onClick={() => setShowEventForm(v => !v)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Registrar evento
            </button>
            {w.status === "in_storage" && w.days_to_clearance !== null && w.days_to_clearance <= 0 && (
              <button onClick={async () => { await fetch("/api/radioactive-waste", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: w.id, status: "pending_clearance" }) }); }} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Marcar para liberación
              </button>
            )}
          </div>

          {showEventForm && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-green-800 mb-2">Registrar evento</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-gray-600">Tipo</label>
                  <select className="w-full border rounded p-1 mt-0.5" value={eventForm.event_type} onChange={e => setEventForm(f => ({ ...f, event_type: e.target.value }))}>
                    <option value="measurement">Medición radiométrica</option>
                    <option value="clearance_check">Verificación liberación</option>
                    <option value="container_change">Cambio de contenedor</option>
                    <option value="location_change">Cambio de ubicación</option>
                    <option value="transferred">Traslado</option>
                    <option value="disposed">Disposición</option>
                    <option value="noted">Anotación</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-600">Realizado por</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={eventForm.performed_by} onChange={e => setEventForm(f => ({ ...f, performed_by: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Actividad medida (Bq)</label>
                  <input type="number" className="w-full border rounded p-1 mt-0.5 font-mono" value={eventForm.activity_bq} onChange={e => setEventForm(f => ({ ...f, activity_bq: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Tasa dosis (µSv/h)</label>
                  <input type="number" step="0.1" className="w-full border rounded p-1 mt-0.5 font-mono" value={eventForm.dose_rate_usvh} onChange={e => setEventForm(f => ({ ...f, dose_rate_usvh: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-600">Notas / resultado</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={saveEvent} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">Guardar</button>
                <button onClick={() => setShowEventForm(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded">Cancelar</button>
              </div>
            </div>
          )}

          {showEvents && (
            <div className="mt-3">
              {events.length === 0 ? (
                <div className="text-xs text-gray-400 italic">Sin eventos registrados</div>
              ) : (
                <div className="space-y-1">
                  {events.map(e => (
                    <div key={e.id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-100">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">{eventTypeLabel[e.event_type] || e.event_type}</span>
                      <span className="text-gray-500">{new Date(e.event_date).toLocaleDateString("es-CL")}</span>
                      {e.dose_rate_usvh && <span className="font-mono text-orange-600">{parseFloat(String(e.dose_rate_usvh)).toFixed(1)} µSv/h</span>}
                      {e.performed_by && <span className="text-gray-500">({e.performed_by})</span>}
                      {e.notes && <span className="text-gray-600 italic">{e.notes}</span>}
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

function WasteModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ description: "", origin_service: "", waste_type: "solid", physical_state: "solid", radionuclide: "", estimated_activity_bq: "", activity_date: new Date().toISOString().split("T")[0], half_life_days: "", volume_liters: "", mass_kg: "", container_type: "", container_id: "", location: "", storage_start_date: new Date().toISOString().split("T")[0], projected_clearance_date: "", status: "in_storage", clearance_basis: "decay_in_storage", dose_rate_usvh: "", generated_by: "", responsible: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/radioactive-waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Registrar residuo radiactivo</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="block text-gray-600 font-medium mb-1">Descripción *</label>
            <input className="w-full border rounded-lg p-2" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1">Radionúclido</label>
              <input className="w-full border rounded-lg p-2 font-mono" placeholder="Tc-99m / I-131..." value={form.radionuclide} onChange={e => setForm(f => ({ ...f, radionuclide: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Tipo de residuo</label>
              <select className="w-full border rounded-lg p-2" value={form.waste_type} onChange={e => setForm(f => ({ ...f, waste_type: e.target.value }))}>
                <option value="solid">Sólido</option>
                <option value="liquid">Líquido</option>
                <option value="mixed">Mixto</option>
                <option value="sharps">Cortopunzante</option>
                <option value="biological">Biológico</option>
                <option value="gaseous">Gaseoso</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Actividad estimada (Bq)</label>
              <input type="number" className="w-full border rounded-lg p-2 font-mono" value={form.estimated_activity_bq} onChange={e => setForm(f => ({ ...f, estimated_activity_bq: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Vida media (días)</label>
              <input type="number" step="0.001" className="w-full border rounded-lg p-2 font-mono" value={form.half_life_days} onChange={e => setForm(f => ({ ...f, half_life_days: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Fecha de actividad ref.</label>
              <input type="date" className="w-full border rounded-lg p-2" value={form.activity_date} onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Tasa dosis (µSv/h)</label>
              <input type="number" step="0.1" className="w-full border rounded-lg p-2 font-mono" value={form.dose_rate_usvh} onChange={e => setForm(f => ({ ...f, dose_rate_usvh: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Volumen (L)</label>
              <input type="number" step="0.1" className="w-full border rounded-lg p-2 font-mono" value={form.volume_liters} onChange={e => setForm(f => ({ ...f, volume_liters: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Masa (kg)</label>
              <input type="number" step="0.1" className="w-full border rounded-lg p-2 font-mono" value={form.mass_kg} onChange={e => setForm(f => ({ ...f, mass_kg: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Tipo contenedor</label>
              <input className="w-full border rounded-lg p-2" value={form.container_type} onChange={e => setForm(f => ({ ...f, container_type: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Ubicación almacenamiento</label>
              <input className="w-full border rounded-lg p-2" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Inicio almacenamiento</label>
              <input type="date" className="w-full border rounded-lg p-2" value={form.storage_start_date} onChange={e => setForm(f => ({ ...f, storage_start_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Liberación proyectada</label>
              <input type="date" className="w-full border rounded-lg p-2" value={form.projected_clearance_date} onChange={e => setForm(f => ({ ...f, projected_clearance_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Base de liberación</label>
              <select className="w-full border rounded-lg p-2" value={form.clearance_basis} onChange={e => setForm(f => ({ ...f, clearance_basis: e.target.value }))}>
                <option value="decay_in_storage">Decaimiento en almacenamiento</option>
                <option value="transfer_cchen">Transferencia CCHEN</option>
                <option value="conditional">Liberación condicional</option>
                <option value="unconditional">Liberación incondicional</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Responsable</label>
              <input className="w-full border rounded-lg p-2" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-gray-600 font-medium mb-1">Servicio origen</label>
              <input className="w-full border rounded-lg p-2" value={form.origin_service} onChange={e => setForm(f => ({ ...f, origin_service: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-gray-600 font-medium mb-1">Notas</label>
              <textarea className="w-full border rounded-lg p-2" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button onClick={save} disabled={saving || !form.description} className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar residuo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RadioactiveWastePage() {
  const [wastes, setWastes] = useState<Waste[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("waste_type", filterType);
    const r = await fetch(`/api/radioactive-waste?${params}`);
    const data = await r.json();
    setWastes(data.wastes || []);
    setStats(data.stats || null);
    setLoading(false);
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const readyForClearance = wastes.filter(w => w.status === "in_storage" && w.days_to_clearance !== null && w.days_to_clearance <= 0);
  const overdueStorage = wastes.filter(w => w.status === "in_storage" && w.days_to_clearance !== null && w.days_to_clearance < -7);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-6 h-6 text-orange-600" />
            <h1 className="text-2xl font-bold text-gray-900">Residuos Radiactivos</h1>
          </div>
          <p className="text-sm text-gray-500">Gestión y trazabilidad de residuos · NS-06.0 §7 · DS 3/1985 — IAEA Safety Standards</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo residuo
        </button>
      </div>

      {/* Alert banners */}
      {readyForClearance.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-green-800">Listos para liberación: </span>
            <span className="text-green-700">{readyForClearance.map(w => `${w.waste_code} (${w.radionuclide})`).join(", ")}. Realizar verificación radiométrica final antes de disposición convencional.</span>
          </div>
        </div>
      )}
      {overdueStorage.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-orange-800">Liberación vencida: </span>
            <span className="text-orange-700">{overdueStorage.map(w => w.waste_code).join(", ")}. Revisar estado y gestionar disposición según NS-06.0 §7.</span>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-orange-500" /><span className="text-xs text-gray-500 font-medium uppercase">Total residuos</span></div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-400">{stats.in_storage} en almacenamiento</div>
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${Number(stats.overdue_clearance) > 0 ? "border-orange-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1"><Clock className={`w-4 h-4 ${Number(stats.overdue_clearance) > 0 ? "text-orange-500" : "text-gray-400"}`} /><span className="text-xs text-gray-500 font-medium uppercase">Lib. vencida</span></div>
            <div className={`text-2xl font-bold ${Number(stats.overdue_clearance) > 0 ? "text-orange-600" : "text-gray-900"}`}>{stats.overdue_clearance}</div>
            <div className="text-xs text-gray-400">{stats.pending_clearance} pend. verificación</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500 font-medium uppercase">Liberados</span></div>
            <div className="text-2xl font-bold text-green-700">{stats.cleared}</div>
            <div className="text-xs text-gray-400">{stats.transferred} transferidos CCHEN</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500 font-medium uppercase">Listos liberación</span></div>
            <div className="text-2xl font-bold text-green-700">{readyForClearance.length}</div>
            <div className="text-xs text-gray-400">verificación pendiente</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="Buscar residuo / radionúclido..." className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="in_storage">En almacenamiento</option>
          <option value="pending_clearance">Pend. liberación</option>
          <option value="cleared">Liberado</option>
          <option value="transferred_cchen">Transferido CCHEN</option>
          <option value="disposed">Dispuesto</option>
        </select>
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="solid">Sólido</option>
          <option value="liquid">Líquido</option>
          <option value="mixed">Mixto</option>
          <option value="sharps">Cortopunzante</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando residuos radiactivos...</div>
      ) : wastes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No se encontraron residuos</div>
      ) : (
        <div>{wastes.map(w => <WasteCard key={w.id} w={w} onEdit={() => {}} />)}</div>
      )}

      {/* Regulatory footer */}
      <div className="mt-6 p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700">
        <div className="flex items-center gap-1 font-semibold mb-1">
          <FileText className="w-3.5 h-3.5" />
          NS-06.0 §7 · DS N°3/1985 · IAEA Safety Standards GSR Part 3 · IAEA-TECDOC-1419
        </div>
        <div className="space-y-0.5 text-orange-600">
          <div>• Decaimiento en almacenamiento: ≥10 vidas medias antes de liberación como residuo convencional (NS-06.0 §7.4)</div>
          <div>• Verificación radiométrica final obligatoria: actividad específica ≤ niveles de exención CCHEN antes de disposición</div>
          <div>• Residuos T½ &gt;100 días (I-131, Lu-177, etc.): almacenamiento supervisado; transferencia CCHEN si no factible</div>
          <div>• Libro de residuos radiactivos obligatorio per DS 3/1985 Art. 25 — toda entrada/salida documentada</div>
          <div>• Ra-226 y fuentes selladas descomisionadas: gestión exclusiva CCHEN, no disposición convencional</div>
        </div>
      </div>

      {showModal && <WasteModal onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  );
}
