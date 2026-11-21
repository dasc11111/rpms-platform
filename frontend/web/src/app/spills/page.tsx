"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Plus, X, AlertTriangle, Biohazard } from "lucide-react";

// DS 3/1985 Art. 42 — Registro de incidentes radiológicos y derrames
// Todo derrame de material radiactivo debe documentarse, investigarse y
// gestionarse según protocolos de respuesta a emergencias radiológicas.

type SpillEvent = {
  id: number;
  event_date: string;
  event_time?: string;
  location: string;
  service_area?: string;
  radionuclide?: string;
  activity_mbq?: number;
  volume_ml?: number;
  description?: string;
  severity: string;
  detected_by?: string;
  immediate_actions?: string;
  decontamination_steps?: string;
  clearance_survey?: string;
  clearance_date?: string;
  persons_exposed?: string;
  dose_estimate_msv?: number;
  reported_to?: string;
  report_date?: string;
  investigation_findings?: string;
  corrective_actions?: string;
  status: string;
  notes?: string;
  created_at: string;
};

type Stats = {
  total: string; minor: string; moderate: string; major: string;
  open_count: string; closed_count: string; this_year: string; last_event?: string;
};

const SEVERITY_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  minor:    { label: "Menor",     bg: "bg-yellow-100",  text: "text-yellow-800",  border: "border-yellow-300" },
  moderate: { label: "Moderado",  bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-300" },
  major:    { label: "Mayor",     bg: "bg-red-100",     text: "text-red-800",     border: "border-red-300" },
};

const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  open:            { label: "Abierto",         dot: "bg-red-500" },
  under_response:  { label: "En respuesta",    dot: "bg-orange-500" },
  investigating:   { label: "Investigando",    dot: "bg-blue-500" },
  closed:          { label: "Cerrado",         dot: "bg-green-500" },
  escalated:       { label: "Escalado",        dot: "bg-purple-500" },
};

const EMPTY_FORM = {
  event_date: "", event_time: "", location: "", service_area: "",
  radionuclide: "", activity_mbq: "", volume_ml: "",
  description: "", severity: "minor", detected_by: "",
  immediate_actions: "", decontamination_steps: "", clearance_survey: "",
  clearance_date: "", persons_exposed: "", dose_estimate_msv: "",
  reported_to: "", report_date: "", status: "open", notes: "",
};

function fDate(d?: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function SpillCard({ ev, onEdit }: { ev: SpillEvent; onEdit: (e: SpillEvent) => void }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_CFG[ev.severity] ?? SEVERITY_CFG.minor;
  const st  = STATUS_CFG[ev.status] ?? STATUS_CFG.open;

  return (
    <div className={`rounded-xl border-2 ${sev.border} bg-white shadow-sm mb-3`}>
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="mt-0.5">
          <Biohazard className={`w-5 h-5 ${ev.severity === "major" ? "text-red-500" : ev.severity === "moderate" ? "text-orange-500" : "text-yellow-500"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>{sev.label}</span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`inline-block w-2 h-2 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {ev.radionuclide && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{ev.radionuclide}</span>
            )}
          </div>
          <div className="font-semibold text-gray-800 text-sm truncate">{ev.location}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {fDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time.slice(0,5)}` : ""}
            {ev.service_area ? ` · ${ev.service_area}` : ""}
          </div>
          {ev.description && (
            <div className="text-xs text-gray-600 mt-1 truncate">{ev.description}</div>
          )}
        </div>
        <div className="ml-2 text-gray-400 flex-shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {ev.radionuclide && (
              <div><span className="text-gray-500">Radionúclido:</span> <span className="font-medium">{ev.radionuclide}</span></div>
            )}
            {ev.activity_mbq != null && (
              <div><span className="text-gray-500">Actividad:</span> <span className="font-medium">{Number(ev.activity_mbq).toFixed(3)} MBq</span></div>
            )}
            {ev.volume_ml != null && (
              <div><span className="text-gray-500">Volumen:</span> <span className="font-medium">{ev.volume_ml} mL</span></div>
            )}
            {ev.detected_by && (
              <div><span className="text-gray-500">Detectado por:</span> <span className="font-medium">{ev.detected_by}</span></div>
            )}
          </div>

          {ev.immediate_actions && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Acciones inmediatas</div>
              <div className="text-xs text-gray-600 bg-blue-50 rounded p-2">{ev.immediate_actions}</div>
            </div>
          )}
          {ev.decontamination_steps && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Descontaminación</div>
              <div className="text-xs text-gray-600 bg-green-50 rounded p-2">{ev.decontamination_steps}</div>
            </div>
          )}
          {ev.clearance_survey && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Medición de liberación{ev.clearance_date ? ` — ${fDate(ev.clearance_date)}` : ""}</div>
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">{ev.clearance_survey}</div>
            </div>
          )}
          {(ev.persons_exposed || ev.dose_estimate_msv != null) && (
            <div className="bg-orange-50 rounded p-2 text-xs">
              {ev.persons_exposed && <div><span className="font-semibold">Personal involucrado:</span> {ev.persons_exposed}</div>}
              {ev.dose_estimate_msv != null && <div className="mt-0.5"><span className="font-semibold">Dosis estimada:</span> {ev.dose_estimate_msv} mSv</div>}
            </div>
          )}
          {(ev.reported_to || ev.report_date) && (
            <div className="text-xs text-gray-600">
              <span className="font-semibold">Notificado a:</span> {ev.reported_to ?? "—"} {ev.report_date ? `· ${fDate(ev.report_date)}` : ""}
            </div>
          )}
          {ev.investigation_findings && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Hallazgos investigación</div>
              <div className="text-xs text-gray-600">{ev.investigation_findings}</div>
            </div>
          )}
          {ev.corrective_actions && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Acciones correctivas</div>
              <div className="text-xs text-gray-600">{ev.corrective_actions}</div>
            </div>
          )}
          {ev.notes && <div className="text-xs italic text-gray-500">{ev.notes}</div>}
          <button
            onClick={() => onEdit(ev)}
            className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
          >Editar registro</button>
        </div>
      )}
    </div>
  );
}

function SpillForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: SpillEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(
    initial
      ? {
          event_date: initial.event_date ?? "",
          event_time: initial.event_time?.slice(0, 5) ?? "",
          location: initial.location ?? "",
          service_area: initial.service_area ?? "",
          radionuclide: initial.radionuclide ?? "",
          activity_mbq: initial.activity_mbq != null ? String(initial.activity_mbq) : "",
          volume_ml: initial.volume_ml != null ? String(initial.volume_ml) : "",
          description: initial.description ?? "",
          severity: initial.severity ?? "minor",
          detected_by: initial.detected_by ?? "",
          immediate_actions: initial.immediate_actions ?? "",
          decontamination_steps: initial.decontamination_steps ?? "",
          clearance_survey: initial.clearance_survey ?? "",
          clearance_date: initial.clearance_date ?? "",
          persons_exposed: initial.persons_exposed ?? "",
          dose_estimate_msv: initial.dose_estimate_msv != null ? String(initial.dose_estimate_msv) : "",
          reported_to: initial.reported_to ?? "",
          report_date: initial.report_date ?? "",
          status: initial.status ?? "open",
          notes: initial.notes ?? "",
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.event_date || !form.location) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    ["activity_mbq", "volume_ml", "dose_estimate_msv"].forEach(k => {
      payload[k] = form[k] ? parseFloat(form[k]) : null;
    });
    ["event_time", "service_area", "radionuclide", "description", "detected_by",
     "immediate_actions", "decontamination_steps", "clearance_survey", "clearance_date",
     "persons_exposed", "reported_to", "report_date", "investigation_findings",
     "corrective_actions", "notes"].forEach(k => {
      payload[k] = form[k] || null;
    });
    if (initial) {
      await fetch("/api/spills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id, ...payload }),
      });
    } else {
      await fetch("/api/spills", {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">
            {initial ? "Editar derrame" : "Registrar derrame / contaminación"}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha del evento *</label>
              <input type="date" className={inp} value={form.event_date} onChange={set("event_date")} />
            </div>
            <div>
              <label className={lbl}>Hora</label>
              <input type="time" className={inp} value={form.event_time} onChange={set("event_time")} />
            </div>
          </div>
          <div>
            <label className={lbl}>Ubicación *</label>
            <input className={inp} placeholder="Sala/área donde ocurrió el derrame" value={form.location} onChange={set("location")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Servicio / Unidad</label>
              <input className={inp} placeholder="Medicina Nuclear, Radioterapia…" value={form.service_area} onChange={set("service_area")} />
            </div>
            <div>
              <label className={lbl}>Severidad *</label>
              <select className={inp} value={form.severity} onChange={set("severity")}>
                <option value="minor">Menor</option>
                <option value="moderate">Moderado</option>
                <option value="major">Mayor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Radionúclido</label>
              <input className={inp} placeholder="F-18, Tc-99m…" value={form.radionuclide} onChange={set("radionuclide")} />
            </div>
            <div>
              <label className={lbl}>Actividad (MBq)</label>
              <input type="number" step="0.001" className={inp} value={form.activity_mbq} onChange={set("activity_mbq")} />
            </div>
            <div>
              <label className={lbl}>Volumen (mL)</label>
              <input type="number" step="0.01" className={inp} value={form.volume_ml} onChange={set("volume_ml")} />
            </div>
          </div>
          <div>
            <label className={lbl}>Descripción del incidente</label>
            <textarea className={inp} rows={3} value={form.description} onChange={set("description")} />
          </div>
          <div>
            <label className={lbl}>Detectado por</label>
            <input className={inp} value={form.detected_by} onChange={set("detected_by")} />
          </div>
          <div>
            <label className={lbl}>Acciones inmediatas tomadas</label>
            <textarea className={inp} rows={3} value={form.immediate_actions} onChange={set("immediate_actions")} />
          </div>
          <div>
            <label className={lbl}>Pasos de descontaminación</label>
            <textarea className={inp} rows={3} value={form.decontamination_steps} onChange={set("decontamination_steps")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Encuesta de liberación (resultado medición)</label>
              <textarea className={inp} rows={2} value={form.clearance_survey} onChange={set("clearance_survey")} />
            </div>
            <div>
              <label className={lbl}>Fecha de liberación</label>
              <input type="date" className={inp} value={form.clearance_date} onChange={set("clearance_date")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Personal expuesto</label>
              <input className={inp} value={form.persons_exposed} onChange={set("persons_exposed")} />
            </div>
            <div>
              <label className={lbl}>Dosis estimada (mSv)</label>
              <input type="number" step="0.0001" className={inp} value={form.dose_estimate_msv} onChange={set("dose_estimate_msv")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Notificado a (CCHEN u otro)</label>
              <input className={inp} value={form.reported_to} onChange={set("reported_to")} />
            </div>
            <div>
              <label className={lbl}>Fecha notificación</label>
              <input type="date" className={inp} value={form.report_date} onChange={set("report_date")} />
            </div>
          </div>
          <div>
            <label className={lbl}>Hallazgos de la investigación</label>
            <textarea className={inp} rows={2} value={form.investigation_findings} onChange={set("investigation_findings")} />
          </div>
          <div>
            <label className={lbl}>Acciones correctivas</label>
            <textarea className={inp} rows={2} value={form.corrective_actions} onChange={set("corrective_actions")} />
          </div>
          <div>
            <label className={lbl}>Estado</label>
            <select className={inp} value={form.status} onChange={set("status")}>
              <option value="open">Abierto</option>
              <option value="under_response">En respuesta</option>
              <option value="investigating">Investigando</option>
              <option value="closed">Cerrado</option>
              <option value="escalated">Escalado</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Notas adicionales</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex gap-3 justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !form.event_date || !form.location}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Registrar derrame"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SpillsPage() {
  const [events, setEvents]   = useState<SpillEvent[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [years, setYears]     = useState<number[]>([]);
  const [year, setYear]       = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState<SpillEvent | undefined>(undefined);
  const [loading, setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    const r = await fetch(`/api/spills?${params}`);
    const d = await r.json();
    setEvents(d.events ?? []);
    setStats(d.stats ?? null);
    setYears(d.years ?? []);
    setLoading(false);
  }, [year, severity, status]);

  useEffect(() => { load(); }, [load]);

  const openCount = parseInt(stats?.open_count ?? "0");
  const majorCount = parseInt(stats?.major ?? "0");
  const alert = openCount > 0 || majorCount > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Derrames Radiactivos</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de incidentes · DS 3/1985 Art. 42</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:bg-red-700"
        >
          <Plus className="w-4 h-4" /> Registrar derrame
        </button>
      </div>

      {alert && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            {openCount > 0 && <span className="font-semibold">{openCount} evento{openCount > 1 ? "s" : ""} abierto{openCount > 1 ? "s" : ""}</span>}
            {openCount > 0 && majorCount > 0 && " · "}
            {majorCount > 0 && <span className="font-semibold">{majorCount} evento{majorCount > 1 ? "s" : ""} de severidad mayor</span>}
            . Verificar estado y completar investigación.
          </div>
        </div>
      )}

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total eventos", val: stats.total, sub: `Año actual: ${stats.this_year}` },
            { label: "Mayores / Mod.", val: `${stats.major} / ${stats.moderate}`, sub: `Menores: ${stats.minor}` },
            { label: "Abiertos", val: stats.open_count, sub: `Cerrados: ${stats.closed_count}` },
            { label: "Último evento", val: stats.last_event ? fDate(stats.last_event) : "—", sub: "" },
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
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Toda severidad</option>
          <option value="minor">Menor</option>
          <option value="moderate">Moderado</option>
          <option value="major">Mayor</option>
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todo estado</option>
          <option value="open">Abierto</option>
          <option value="under_response">En respuesta</option>
          <option value="investigating">Investigando</option>
          <option value="closed">Cerrado</option>
          <option value="escalated">Escalado</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Biohazard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">Sin eventos registrados</div>
          <div className="text-sm mt-1">Use "Registrar derrame" para documentar un incidente.</div>
        </div>
      ) : (
        <div>
          {events.map(ev => (
            <SpillCard key={ev.id} ev={ev} onEdit={e => { setEditing(e); setShowForm(true); }} />
          ))}
        </div>
      )}

      {showForm && (
        <SpillForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={() => { setShowForm(false); setEditing(undefined); load(); }}
        />
      )}
    </div>
  );
}
