"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, Calendar, X, Edit2, Trash2,
  Users, BookOpen, Award, Video, Monitor, Building2
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

// §53 — Capacitación y Competencias en Protección Radiológica
// DS 3/1985 Art. 25 — capacitación anual obligatoria TOE
// IAEA GSG-7 — Radiation Protection in Occupational Activities

interface Session {
  id: number;
  session_code: string;
  title: string;
  category: string;
  modality: string;
  trainer: string | null;
  trainer_entity: string | null;
  scope: string | null;
  objectives: string | null;
  content_summary: string | null;
  session_date: string | null;
  end_date: string | null;
  duration_hours: number | null;
  location: string | null;
  max_capacity: number | null;
  attendees_count: number | null;
  pass_score: number;
  status: string;
  certification: boolean;
  cert_valid_months: number | null;
  references_norm: string | null;
  notes: string | null;
}

interface Participant {
  id: number;
  session_id: number;
  worker_name: string;
  rut: string | null;
  role: string | null;
  area: string | null;
  attended: boolean;
  score: number | null;
  passed: boolean | null;
  cert_issued: boolean;
  cert_expiry: string | null;
  notes: string | null;
}

interface Stats {
  total: string; completed: string; planned: string;
  in_progress: string; cancelled: string;
  total_attendees: string; total_hours: string; upcoming_30d: string;
}

const CAT_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  radiation_protection: { label: "Protección Radiológica", color: "text-blue-700",   bg: "bg-blue-100",   icon: <Award size={13} />     },
  radiopharmacy:        { label: "Radiofarmacia",          color: "text-purple-700", bg: "bg-purple-100", icon: <BookOpen size={13} />  },
  emergency:            { label: "Emergencias",            color: "text-red-700",    bg: "bg-red-100",    icon: <AlertTriangle size={13} /> },
  quality:              { label: "Gestión de Calidad",     color: "text-green-700",  bg: "bg-green-100",  icon: <CheckCircle2 size={13} /> },
  regulatory:           { label: "Normativa",              color: "text-indigo-700", bg: "bg-indigo-100", icon: <Building2 size={13} /> },
  clinical:             { label: "Clínico",                color: "text-teal-700",   bg: "bg-teal-100",   icon: <Users size={13} />     },
};

const MODALITY_CFG: Record<string, { label: string; icon: React.ReactNode }> = {
  presential: { label: "Presencial",    icon: <Building2 size={13} /> },
  virtual:    { label: "Virtual",       icon: <Monitor size={13} />  },
  mixed:      { label: "Mixta",         icon: <Video size={13} />    },
  e_learning: { label: "E-learning",    icon: <Monitor size={13} />  },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  planned:     { label: "Planificada",   color: "text-blue-600",   bg: "bg-blue-50",   icon: <Calendar size={13} />     },
  in_progress: { label: "En curso",      color: "text-amber-600",  bg: "bg-amber-50",  icon: <Clock size={13} />        },
  completed:   { label: "Completada",    color: "text-green-700",  bg: "bg-green-50",  icon: <CheckCircle2 size={13} /> },
  cancelled:   { label: "Cancelada",     color: "text-gray-500",   bg: "bg-gray-50",   icon: <X size={13} />            },
};

function SessionCard({ session, onEdit, onDelete }: {
  session: Session; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen]               = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadedP, setLoadedP]         = useState(false);
  const [showAddP, setShowAddP]       = useState(false);
  const [pForm, setPForm]             = useState({ worker_name: "", rut: "", role: "", area: "", score: "" });

  const cat = CAT_CFG[session.category] ?? CAT_CFG.radiation_protection!;
  const st  = STATUS_CFG[session.status] ?? STATUS_CFG.planned!;
  const mod = MODALITY_CFG[session.modality] ?? MODALITY_CFG.presential!;

  async function loadParticipants() {
    if (loadedP) return;
    const r = await fetch(`/api/training?id=${session.id}`);
    const d = await r.json();
    setParticipants(d.participants ?? []);
    setLoadedP(true);
  }

  async function addParticipant() {
    const score = pForm.score ? parseFloat(pForm.score) : undefined;
    await fetch("/api/training", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, ...pForm, score })
    });
    setLoadedP(false);
    loadParticipants();
    setShowAddP(false);
    setPForm({ worker_name: "", rut: "", role: "", area: "", score: "" });
  }

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) loadParticipants();
  };

  const passedCount  = participants.filter(p => p.passed).length;
  const attendedCount = participants.filter(p => p.attended).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={handleOpen}>
        <div className={`mt-1 p-1.5 rounded-md ${cat.bg} shrink-0`}>
          <span className={cat.color}>{cat.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-600">{session.session_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>{cat.label}</span>
            <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.icon}{st.label}</span>
            <span className={`text-xs flex items-center gap-1 text-gray-500`}>{mod.icon}{mod.label}</span>
          </div>
          <p className="font-medium text-gray-900 truncate">{session.title}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            {session.session_date && <span><Calendar size={11} className="inline mr-1" />{new Date(session.session_date).toLocaleDateString("es-CL")}</span>}
            {session.duration_hours && <span>{session.duration_hours}h</span>}
            {session.attendees_count && <span><Users size={11} className="inline mr-1" />{session.attendees_count} asistentes</span>}
            {session.certification && <span className="flex items-center gap-1 text-green-700"><Award size={11} />Certificación</span>}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 mt-1 shrink-0" />
               : <ChevronDown size={18} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
            {session.trainer && <div><span className="font-medium">Relator:</span> {session.trainer}</div>}
            {session.trainer_entity && <div><span className="font-medium">Entidad:</span> {session.trainer_entity}</div>}
            {session.location && <div><span className="font-medium">Lugar:</span> {session.location}</div>}
            {session.max_capacity && <div><span className="font-medium">Cap. máx.:</span> {session.max_capacity}</div>}
            {session.pass_score && <div><span className="font-medium">Nota mín.:</span> {session.pass_score}%</div>}
            {session.cert_valid_months && <div><span className="font-medium">Vigencia cert.:</span> {session.cert_valid_months} meses</div>}
          </div>

          {session.objectives && (
            <div className="bg-blue-50 rounded p-3 text-xs">
              <p className="font-medium text-blue-800 mb-1">Objetivos</p>
              <p className="text-blue-700">{session.objectives}</p>
            </div>
          )}
          {session.content_summary && (
            <div className="bg-gray-50 rounded p-3 text-xs">
              <p className="font-medium text-gray-700 mb-1">Contenidos</p>
              <p className="text-gray-600">{session.content_summary}</p>
            </div>
          )}

          {/* Participantes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">
                Participantes ({attendedCount} asistieron{passedCount > 0 ? `, ${passedCount} aprobaron` : ""})
              </p>
              <button onClick={() => setShowAddP(!showAddP)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={12} />Agregar
              </button>
            </div>

            {showAddP && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Nombre*" className="border rounded px-2 py-1 w-full"
                    value={pForm.worker_name} onChange={e => setPForm(f => ({ ...f, worker_name: e.target.value }))} />
                  <input placeholder="RUT" className="border rounded px-2 py-1 w-full"
                    value={pForm.rut} onChange={e => setPForm(f => ({ ...f, rut: e.target.value }))} />
                  <input placeholder="Cargo" className="border rounded px-2 py-1 w-full"
                    value={pForm.role} onChange={e => setPForm(f => ({ ...f, role: e.target.value }))} />
                  <input placeholder="Área" className="border rounded px-2 py-1 w-full"
                    value={pForm.area} onChange={e => setPForm(f => ({ ...f, area: e.target.value }))} />
                  <input type="number" placeholder="Nota (0-100)" className="border rounded px-2 py-1 w-full"
                    value={pForm.score} onChange={e => setPForm(f => ({ ...f, score: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={addParticipant} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                  <button onClick={() => setShowAddP(false)} className="text-xs px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                </div>
              </div>
            )}

            {participants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-left pb-1 pr-3">Nombre</th>
                      <th className="text-left pb-1 pr-3">Cargo</th>
                      <th className="text-center pb-1 pr-3">Nota</th>
                      <th className="text-center pb-1 pr-3">Estado</th>
                      <th className="text-center pb-1">Cert.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-3">{p.worker_name}</td>
                        <td className="py-1 pr-3 text-gray-500">{p.role ?? "—"}</td>
                        <td className="py-1 pr-3 text-center">{p.score ?? "—"}</td>
                        <td className="py-1 pr-3 text-center">
                          {p.passed === true  ? <span className="text-green-700 font-medium">Aprobado</span>
                          : p.passed === false ? <span className="text-red-600">Reprobado</span>
                          : <span className="text-gray-400">S/E</span>}
                        </td>
                        <td className="py-1 text-center">{p.cert_issued ? <Award size={13} className="text-green-600 mx-auto" /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Sin participantes registrados</p>
            )}
          </div>

          {session.references_norm && (
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-3 py-2">{session.references_norm}</p>
          )}

          <div className="flex gap-2 pt-1 flex-wrap">
            <RowPdfActions module="training" ownerType="training_session" ownerId={String(session.id)} size="xs" />
            <button onClick={onEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700">
              <Edit2 size={12} />Editar
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded text-red-600">
              <Trash2 size={12} />Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY: Partial<Session> = {
  session_code: "", title: "", category: "radiation_protection", modality: "presential",
  trainer: "", trainer_entity: "", scope: "", objectives: "", content_summary: "",
  duration_hours: 8, location: "", max_capacity: 20, pass_score: 70,
  status: "planned", certification: false, cert_valid_months: undefined,
  references_norm: "", notes: ""
};

function SessionForm({ initial, onSave, onClose }: {
  initial: Partial<Session>; onSave: (d: Partial<Session>) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Session>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Session, v: unknown) => setForm(f => ({ ...f, [k]: v }));

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
            <GraduationCap size={18} className="text-blue-600" />
            {initial.id ? "Editar capacitación" : "Nueva capacitación"}
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input required className={inp} value={form.session_code ?? ""} onChange={e => set("session_code", e.target.value)} placeholder="CAP-PR-2026-001" />
            </div>
            <div>
              <label className={lbl}>Categoría</label>
              <select className={inp} value={form.category ?? "radiation_protection"} onChange={e => set("category", e.target.value)}>
                {Object.entries(CAT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Título *</label>
            <input required className={inp} value={form.title ?? ""} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Modalidad</label>
              <select className={inp} value={form.modality ?? "presential"} onChange={e => set("modality", e.target.value)}>
                {Object.entries(MODALITY_CFG).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status ?? "planned"} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Relator</label>
              <input className={inp} value={form.trainer ?? ""} onChange={e => set("trainer", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Entidad / Institución</label>
              <input className={inp} value={form.trainer_entity ?? ""} onChange={e => set("trainer_entity", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Alcance / Dirigido a</label>
            <input className={inp} value={form.scope ?? ""} onChange={e => set("scope", e.target.value)} placeholder="Personal TOE, médicos, tecnólogos..." />
          </div>
          <div>
            <label className={lbl}>Objetivos</label>
            <textarea className={inp} rows={2} value={form.objectives ?? ""} onChange={e => set("objectives", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Resumen de contenidos</label>
            <textarea className={inp} rows={3} value={form.content_summary ?? ""} onChange={e => set("content_summary", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" className={inp} value={form.session_date?.slice(0,10) ?? ""} onChange={e => set("session_date", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fecha término</label>
              <input type="date" className={inp} value={form.end_date?.slice(0,10) ?? ""} onChange={e => set("end_date", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Duración (horas)</label>
              <input type="number" step="0.5" className={inp} value={form.duration_hours ?? ""} onChange={e => set("duration_hours", parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Lugar</label>
              <input className={inp} value={form.location ?? ""} onChange={e => set("location", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Capacidad máxima</label>
              <input type="number" className={inp} value={form.max_capacity ?? ""} onChange={e => set("max_capacity", parseInt(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Nota mínima aprobación (%)</label>
              <input type="number" className={inp} value={form.pass_score ?? 70} onChange={e => set("pass_score", parseFloat(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>N° asistentes real</label>
              <input type="number" className={inp} value={form.attendees_count ?? ""} onChange={e => set("attendees_count", parseInt(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.certification ?? false} onChange={e => set("certification", e.target.checked)} className="rounded" />
              Otorga certificación
            </label>
            {form.certification && (
              <div>
                <input type="number" placeholder="Meses vigencia cert." className="border border-gray-300 rounded px-3 py-2 text-sm w-40"
                  value={form.cert_valid_months ?? ""} onChange={e => set("cert_valid_months", parseInt(e.target.value))} />
              </div>
            )}
          </div>
          <div>
            <label className={lbl}>Referencias normativas</label>
            <input className={inp} value={form.references_norm ?? ""} onChange={e => set("references_norm", e.target.value)} placeholder="DS 3/1985 Art. 25; IAEA GSG-7..." />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [years, setYears]       = useState<number[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterCat, setFilterCat]   = useState("");
  const [filterSt, setFilterSt]     = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Session | null>(null);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat)  params.set("category", filterCat);
    if (filterSt)   params.set("status", filterSt);
    if (filterYear) params.set("year", filterYear);
    try {
      const r = await fetch(`/api/training?${params}`);
      const d = await r.json();
      setSessions(d.sessions ?? []);
      setStats(d.stats ?? null);
      setYears(d.years ?? []);
    } catch { setError("Error cargando capacitaciones"); }
    setLoading(false);
  }, [filterCat, filterSt, filterYear]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: Partial<Session>) {
    const r = await fetch("/api/training", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) { const d = await r.json(); alert(d.error ?? "Error"); return; }
    setShowForm(false); setEditing(null); load();
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta capacitación?")) return;
    await fetch(`/api/training?id=${id}`, { method: "DELETE" });
    load();
  }

  const upcoming = parseInt(stats?.upcoming_30d ?? "0");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GraduationCap size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Capacitación y Competencias</h1>
            <p className="text-sm text-gray-500">DS 3/1985 Art. 25 — IAEA GSG-7 — Capacitación anual obligatoria TOE</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />Nueva capacitación
        </button>
      </div>

      {upcoming > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <Calendar size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">{upcoming} capacitación{upcoming > 1 ? "es" : ""} planificada{upcoming > 1 ? "s" : ""} en los próximos 30 días.</p>
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="training"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total",         value: stats.total,           sub: "capacitaciones",    color: "text-gray-800"   },
            { label: "Completadas",   value: stats.completed,       sub: "realizadas",         color: "text-green-700"  },
            { label: "Asistentes",    value: stats.total_attendees, sub: "participaciones",    color: "text-blue-700"   },
            { label: "Horas totales", value: `${parseFloat(stats.total_hours || "0").toFixed(0)}h`, sub: "formación", color: "text-purple-700" },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              <p className="text-xs text-gray-400">{k.sub}</p>
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
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(filterCat || filterSt || filterYear) && (
          <button onClick={() => { setFilterCat(""); setFilterSt(""); setFilterYear(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpiar filtros</button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando capacitaciones…</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay capacitaciones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onEdit={() => { setEditing(s); setShowForm(true); }}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <SessionForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
