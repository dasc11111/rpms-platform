"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, FileText, RefreshCw, User, Calendar,
  BookOpen, Edit2, Trash2, X
} from "lucide-react";

// DS 3/1985 — Artículo 15: Los procedimientos de trabajo con radiaciones ionizantes
// deben estar documentados, aprobados y accesibles para los trabajadores ocupacionalmente expuestos.
// Control de versiones y revisión periódica obligatorios.

interface Procedure {
  id: number;
  code: string;
  title: string;
  category: string;
  service: string | null;
  version: string;
  status: string;
  description: string | null;
  scope: string | null;
  responsible: string | null;
  reviewer: string | null;
  approver: string | null;
  effective_date: string | null;
  review_date: string | null;
  next_review: string | null;
  frequency_months: number;
  location: string | null;
  references_norm: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: string;
  approved: string;
  draft: string;
  review: string;
  overdue_review: string;
  upcoming_review: string;
}

const CATEGORY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  clinical:      { label: "Clínico",           color: "text-blue-700",   bg: "bg-blue-100"   },
  radiopharmacy: { label: "Radiofarmacia",      color: "text-purple-700", bg: "bg-purple-100" },
  emergency:     { label: "Emergencia",         color: "text-red-700",    bg: "bg-red-100"    },
  monitoring:    { label: "Monitoreo",          color: "text-teal-700",   bg: "bg-teal-100"   },
  waste:         { label: "Residuos",           color: "text-orange-700", bg: "bg-orange-100" },
  transport:     { label: "Transporte",         color: "text-yellow-700", bg: "bg-yellow-100" },
  equipment:     { label: "Equipos",            color: "text-indigo-700", bg: "bg-indigo-100" },
  general:       { label: "General",            color: "text-gray-700",   bg: "bg-gray-100"   },
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  approved: { label: "Aprobado",   color: "text-green-700",  icon: <CheckCircle2 size={14} /> },
  draft:    { label: "Borrador",   color: "text-gray-500",   icon: <FileText size={14} />     },
  review:   { label: "En revisión",color: "text-amber-600",  icon: <RefreshCw size={14} />    },
  retired:  { label: "Retirado",   color: "text-red-500",    icon: <X size={14} />            },
};

const CATEGORIES = Object.entries(CATEGORY_CFG).map(([v, c]) => ({ value: v, label: c.label }));
const STATUSES   = Object.entries(STATUS_CFG).map(([v, s]) => ({ value: v, label: s.label }));
const FREQ_OPTS  = [{ v: 12, l: "Anual" }, { v: 24, l: "Bianual" }, { v: 36, l: "Trianual" }, { v: 6, l: "Semestral" }];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function isOverdue(d: string | null) {
  return !!d && new Date(d) < new Date();
}
function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
}

function ProcedureCard({ p, onEdit, onDelete }: { p: Procedure; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_CFG[p.category] ?? CATEGORY_CFG.general;
  const st  = STATUS_CFG[p.status]    ?? STATUS_CFG.draft;
  const overdue  = p.status === "approved" && isOverdue(p.next_review);
  const days     = daysUntil(p.next_review);
  const upcoming = !overdue && days !== null && days <= 90 && days >= 0;

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${overdue ? "border-red-300" : "border-gray-200"}`}>
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-600">{p.code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>{cat.label}</span>
            <span className={`text-xs flex items-center gap-1 ${st.color}`}>{st.icon}{st.label}</span>
            <span className="text-xs text-gray-400">v{p.version}</span>
          </div>
          <p className="font-medium text-gray-900 truncate">{p.title}</p>
          <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
            {p.service && <span>Servicio: {p.service}</span>}
            {p.responsible && <span><User size={11} className="inline mr-1" />{p.responsible}</span>}
            {p.next_review && (
              <span className={overdue ? "text-red-600 font-medium" : upcoming ? "text-amber-600" : ""}>
                <Calendar size={11} className="inline mr-1" />
                {overdue ? "Revisión vencida" : upcoming ? `Revisión en ${days}d` : `Próx. revisión: ${fmtDate(p.next_review)}`}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 mt-1 shrink-0" />
               : <ChevronDown size={18} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3 text-sm">
          {p.description && <p className="text-gray-700">{p.description}</p>}
          {p.scope && (
            <div><span className="font-medium text-gray-600">Alcance: </span><span className="text-gray-700">{p.scope}</span></div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
            <div><span className="font-medium">Responsable:</span><br/>{p.responsible ?? "—"}</div>
            <div><span className="font-medium">Revisor:</span><br/>{p.reviewer ?? "—"}</div>
            <div><span className="font-medium">Aprobador:</span><br/>{p.approver ?? "—"}</div>
            <div><span className="font-medium">Fecha vigencia:</span><br/>{fmtDate(p.effective_date)}</div>
            <div><span className="font-medium">Próxima revisión:</span><br/>
              <span className={overdue ? "text-red-600 font-semibold" : upcoming ? "text-amber-600" : ""}>
                {fmtDate(p.next_review)}
              </span>
            </div>
            <div><span className="font-medium">Frecuencia revisión:</span><br/>{p.frequency_months} meses</div>
            {p.location && <div><span className="font-medium">Ubicación:</span><br/>{p.location}</div>}
          </div>
          {p.references_norm && (
            <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 rounded p-2">
              <BookOpen size={13} className="shrink-0 mt-0.5" />
              <span>{p.references_norm}</span>
            </div>
          )}
          {p.notes && <p className="text-xs text-gray-500 italic">{p.notes}</p>}
          <div className="flex gap-2 pt-2">
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

const EMPTY: Partial<Procedure> = {
  code: "", title: "", category: "general", service: "", version: "1.0",
  status: "draft", description: "", scope: "", responsible: "", reviewer: "",
  approver: "", effective_date: "", review_date: "", next_review: "",
  frequency_months: 24, location: "", references_norm: "", notes: ""
};

function ProcedureForm({ initial, onSave, onClose }: {
  initial: Partial<Procedure>; onSave: (d: Partial<Procedure>) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Procedure>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Procedure, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const lbl = "block text-xs font-medium text-gray-600 mb-1";
  const inp = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const sel = inp;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            {initial.id ? "Editar procedimiento" : "Nuevo procedimiento"}
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input required className={inp} value={form.code ?? ""} onChange={e => set("code", e.target.value)} placeholder="PRP-XX-001" />
            </div>
            <div>
              <label className={lbl}>Versión</label>
              <input className={inp} value={form.version ?? "1.0"} onChange={e => set("version", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Título *</label>
            <input required className={inp} value={form.title ?? ""} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Categoría</label>
              <select className={sel} value={form.category ?? "general"} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={sel} value={form.status ?? "draft"} onChange={e => set("status", e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Servicio / Área</label>
            <input className={inp} value={form.service ?? ""} onChange={e => set("service", e.target.value)} placeholder="Medicina Nuclear, Radiofarmacia, etc." />
          </div>
          <div>
            <label className={lbl}>Descripción</label>
            <textarea className={inp} rows={3} value={form.description ?? ""} onChange={e => set("description", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Alcance</label>
            <input className={inp} value={form.scope ?? ""} onChange={e => set("scope", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Responsable</label>
              <input className={inp} value={form.responsible ?? ""} onChange={e => set("responsible", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Revisor</label>
              <input className={inp} value={form.reviewer ?? ""} onChange={e => set("reviewer", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Aprobador</label>
              <input className={inp} value={form.approver ?? ""} onChange={e => set("approver", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Fecha de vigencia</label>
              <input type="date" className={inp} value={form.effective_date?.slice(0,10) ?? ""} onChange={e => set("effective_date", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Próxima revisión</label>
              <input type="date" className={inp} value={form.next_review?.slice(0,10) ?? ""} onChange={e => set("next_review", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Frecuencia revisión</label>
              <select className={sel} value={form.frequency_months ?? 24} onChange={e => set("frequency_months", parseInt(e.target.value))}>
                {FREQ_OPTS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Ubicación del documento</label>
            <input className={inp} value={form.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="Carpeta física o ruta digital" />
          </div>
          <div>
            <label className={lbl}>Referencias normativas</label>
            <input className={inp} value={form.references_norm ?? ""} onChange={e => set("references_norm", e.target.value)} placeholder="DS 3/1985 Art. 15; IAEA Safety Reports..." />
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

export default function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filterCat, setFilterCat]   = useState("");
  const [filterSt, setFilterSt]     = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Procedure | null>(null);
  const [error, setError]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat) params.set("category", filterCat);
    if (filterSt)  params.set("status", filterSt);
    try {
      const r = await fetch(`/api/procedures?${params}`);
      const d = await r.json();
      setProcedures(d.procedures ?? []);
      setStats(d.stats ?? null);
    } catch { setError("Error cargando procedimientos"); }
    setLoading(false);
  }, [filterCat, filterSt]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: Partial<Procedure>) {
    const isNew = !form.id;
    const method = isNew ? "POST" : "PATCH";
    const r = await fetch("/api/procedures", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) {
      const d = await r.json();
      alert(d.error ?? "Error al guardar");
      return;
    }
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Dar de baja este procedimiento?")) return;
    await fetch(`/api/procedures?id=${id}`, { method: "DELETE" });
    load();
  }

  const overdueCount = parseInt(stats?.overdue_review ?? "0");
  const upcomingCount = parseInt(stats?.upcoming_review ?? "0");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Procedimientos de Trabajo</h1>
            <p className="text-sm text-gray-500">DS 3/1985 Art. 15 — Control documental de procedimientos radiológicos</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />Nuevo procedimiento
        </button>
      </div>

      {/* Alertas */}
      {(overdueCount > 0 || upcomingCount > 0) && (
        <div className="mb-5 space-y-2">
          {overdueCount > 0 && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-800">
                  {overdueCount} procedimiento{overdueCount > 1 ? "s" : ""} con revisión vencida
                </p>
                <p className="text-sm text-red-700">DS 3/1985 requiere revisión periódica. Actualizar o retirar.</p>
              </div>
            </div>
          )}
          {upcomingCount > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <Clock size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                {upcomingCount} procedimiento{upcomingCount > 1 ? "s" : ""} con revisión próxima (90 días)
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total",         value: stats.total,           color: "text-gray-700"  },
            { label: "Aprobados",     value: stats.approved,        color: "text-green-700" },
            { label: "En revisión",   value: stats.review,          color: "text-amber-600" },
            { label: "Borradores",    value: stats.draft,           color: "text-gray-500"  },
            { label: "Revisión venc.",value: stats.overdue_review,  color: "text-red-600"   },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
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
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(filterCat || filterSt) && (
          <button onClick={() => { setFilterCat(""); setFilterSt(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpiar filtros</button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando procedimientos…</div>
      ) : procedures.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay procedimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {procedures.map(p => (
            <ProcedureCard
              key={p.id}
              p={p}
              onEdit={() => { setEditing(p); setShowForm(true); }}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <ProcedureForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
