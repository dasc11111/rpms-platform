"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, FileText, Search, X, Edit2, Trash2,
  User, Calendar, AlertCircle, BookOpen
} from "lucide-react";

// Gestión de Auditorías Internas de Protección Radiológica
// DS 3/1985 — Verificación periódica del cumplimiento normativo
// IAEA GSR Part 3 Req. 11 — Self-assessment y auditorías independientes

interface Audit {
  id: number;
  audit_code: string;
  title: string;
  audit_type: string;
  scope: string | null;
  audit_date: string;
  lead_auditor: string | null;
  team_members: string | null;
  areas_audited: string | null;
  criteria: string | null;
  methodology: string | null;
  findings_total: number;
  nc_critical: number;
  nc_major: number;
  nc_minor: number;
  observations: number;
  opportunities: number;
  summary: string | null;
  conclusions: string | null;
  recommendations: string | null;
  status: string;
  report_date: string | null;
  next_audit: string | null;
  responsible: string | null;
  notes: string | null;
}

interface Finding {
  id: number;
  audit_id: number;
  finding_ref: string;
  finding_type: string;
  area: string | null;
  description: string;
  criteria_ref: string | null;
  evidence: string | null;
  risk_level: string;
  corrective_action: string | null;
  responsible: string | null;
  due_date: string | null;
  completion_date: string | null;
  status: string;
}

interface Stats {
  total: string; planned: string; in_progress: string; completed: string;
  nc_critical_total: string; nc_major_total: string; nc_minor_total: string; obs_total: string;
}

const TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  internal:   { label: "Interna",       color: "text-blue-700",   bg: "bg-blue-100"   },
  external:   { label: "Externa",       color: "text-purple-700", bg: "bg-purple-100" },
  followup:   { label: "Seguimiento",   color: "text-teal-700",   bg: "bg-teal-100"   },
  regulatory: { label: "Regulatoria",   color: "text-red-700",    bg: "bg-red-100"    },
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planned:     { label: "Planificada",   color: "text-blue-600",   icon: <Calendar size={13} />     },
  in_progress: { label: "En curso",      color: "text-amber-600",  icon: <Clock size={13} />        },
  completed:   { label: "Completada",    color: "text-green-700",  icon: <CheckCircle2 size={13} /> },
  cancelled:   { label: "Cancelada",     color: "text-gray-400",   icon: <X size={13} />            },
};

const FINDING_CFG: Record<string, { label: string; color: string; bg: string }> = {
  nc_critical: { label: "NC Crítica",    color: "text-red-800",    bg: "bg-red-100"    },
  nc_major:    { label: "NC Mayor",      color: "text-orange-700", bg: "bg-orange-100" },
  nc_minor:    { label: "NC Menor",      color: "text-yellow-700", bg: "bg-yellow-100" },
  observation: { label: "Observación",   color: "text-blue-700",   bg: "bg-blue-100"   },
  opportunity: { label: "Oportunidad",   color: "text-teal-700",   bg: "bg-teal-100"   },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function FindingBadge({ type, count }: { type: string; count: number }) {
  if (!count) return null;
  const cfg = FINDING_CFG[type] ?? FINDING_CFG.observation;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
      {count} {cfg.label}{count > 1 ? "s" : ""}
    </span>
  );
}

function AuditCard({ audit, onEdit, onDelete }: { audit: Audit; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);

  const type = TYPE_CFG[audit.audit_type] ?? TYPE_CFG.internal;
  const st   = STATUS_CFG[audit.status]   ?? STATUS_CFG.planned;
  const hasCritical = audit.nc_critical > 0;

  async function toggleOpen() {
    if (!open && findings.length === 0) {
      setLoadingFindings(true);
      const r = await fetch(`/api/audits?id=${audit.id}`);
      const d = await r.json();
      setFindings(d.findings ?? []);
      setLoadingFindings(false);
    }
    setOpen(!open);
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${hasCritical ? "border-red-300" : "border-gray-200"}`}>
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={toggleOpen}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-600">{audit.audit_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.bg} ${type.color}`}>{type.label}</span>
            <span className={`text-xs flex items-center gap-1 ${st.color}`}>{st.icon}{st.label}</span>
          </div>
          <p className="font-medium text-gray-900 truncate">{audit.title}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="text-xs text-gray-500"><Calendar size={11} className="inline mr-1" />{fmtDate(audit.audit_date)}</span>
            {audit.lead_auditor && <span className="text-xs text-gray-500"><User size={11} className="inline mr-1" />{audit.lead_auditor}</span>}
            <FindingBadge type="nc_critical" count={audit.nc_critical} />
            <FindingBadge type="nc_major"    count={audit.nc_major} />
            <FindingBadge type="nc_minor"    count={audit.nc_minor} />
            <FindingBadge type="observation" count={audit.observations} />
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 mt-1 shrink-0" />
               : <ChevronDown size={18} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 text-sm">
          {audit.scope && <p className="text-gray-700"><span className="font-medium">Alcance:</span> {audit.scope}</p>}
          {audit.areas_audited && <p className="text-gray-700"><span className="font-medium">Áreas auditadas:</span> {audit.areas_audited}</p>}
          {audit.criteria && (
            <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 rounded p-2">
              <BookOpen size={13} className="shrink-0 mt-0.5" />
              <span>{audit.criteria}</span>
            </div>
          )}
          {audit.summary && <p className="text-gray-700"><span className="font-medium">Resumen:</span> {audit.summary}</p>}
          {audit.conclusions && <p className="text-gray-700"><span className="font-medium">Conclusiones:</span> {audit.conclusions}</p>}
          {audit.recommendations && <p className="text-amber-800 bg-amber-50 rounded p-2 text-xs"><span className="font-medium">Recomendaciones:</span> {audit.recommendations}</p>}

          {/* Hallazgos */}
          {findings.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium text-gray-700 text-xs uppercase tracking-wide">Hallazgos ({findings.length})</p>
              {findings.map(f => {
                const fcfg = FINDING_CFG[f.finding_type] ?? FINDING_CFG.observation;
                return (
                  <div key={f.id} className={`rounded p-3 border text-xs ${f.status === "closed" ? "opacity-60" : ""} ${f.finding_type === "nc_critical" ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-mono text-xs font-semibold ${fcfg.color}`}>{f.finding_ref}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${fcfg.bg} ${fcfg.color}`}>{fcfg.label}</span>
                      {f.area && <span className="text-gray-500">{f.area}</span>}
                      <span className={`ml-auto ${f.status === "closed" ? "text-green-600" : "text-amber-600"}`}>
                        {f.status === "closed" ? "✓ Cerrado" : "● Abierto"}
                      </span>
                    </div>
                    <p className="text-gray-700">{f.description}</p>
                    {f.corrective_action && <p className="text-teal-700 mt-1"><span className="font-medium">Acción:</span> {f.corrective_action}</p>}
                    {f.due_date && <p className="text-gray-500 mt-1">Plazo: {fmtDate(f.due_date)}</p>}
                  </div>
                );
              })}
            </div>
          )}
          {loadingFindings && <p className="text-gray-400 text-xs">Cargando hallazgos…</p>}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
            <div><span className="font-medium">Informe:</span> {fmtDate(audit.report_date)}</div>
            <div><span className="font-medium">Próxima auditoría:</span> {fmtDate(audit.next_audit)}</div>
            {audit.responsible && <div><span className="font-medium">Responsable:</span> {audit.responsible}</div>}
          </div>

          <div className="flex gap-2 pt-1">
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

const EMPTY: Partial<Audit> = {
  audit_code: "", title: "", audit_type: "internal", scope: "", audit_date: "",
  lead_auditor: "", team_members: "", areas_audited: "", criteria: "",
  status: "planned", responsible: "", notes: ""
};

function AuditForm({ initial, onSave, onClose }: {
  initial: Partial<Audit>; onSave: (d: Partial<Audit>) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Audit>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Audit, v: unknown) => setForm(f => ({ ...f, [k]: v }));

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
            <ClipboardCheck size={18} className="text-blue-600" />
            {initial.id ? "Editar auditoría" : "Nueva auditoría"}
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input required className={inp} value={form.audit_code ?? ""} onChange={e => set("audit_code", e.target.value)} placeholder="AUD-PR-001" />
            </div>
            <div>
              <label className={lbl}>Fecha de auditoría *</label>
              <input required type="date" className={inp} value={form.audit_date?.slice(0,10) ?? ""} onChange={e => set("audit_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Título *</label>
            <input required className={inp} value={form.title ?? ""} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tipo</label>
              <select className={inp} value={form.audit_type ?? "internal"} onChange={e => set("audit_type", e.target.value)}>
                {Object.entries(TYPE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status ?? "planned"} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Alcance</label>
            <textarea className={inp} rows={2} value={form.scope ?? ""} onChange={e => set("scope", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Áreas auditadas</label>
            <input className={inp} value={form.areas_audited ?? ""} onChange={e => set("areas_audited", e.target.value)} placeholder="Medicina Nuclear, Radiofarmacia, Almacén de residuos" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Auditor líder</label>
              <input className={inp} value={form.lead_auditor ?? ""} onChange={e => set("lead_auditor", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Equipo auditor</label>
              <input className={inp} value={form.team_members ?? ""} onChange={e => set("team_members", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Criterios de auditoría</label>
            <input className={inp} value={form.criteria ?? ""} onChange={e => set("criteria", e.target.value)} placeholder="DS 3/1985; IAEA GSR Part 3; ISO 19011:2018" />
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { key: "nc_critical" as keyof Audit, label: "NC Críticas" },
              { key: "nc_major"    as keyof Audit, label: "NC Mayores" },
              { key: "nc_minor"    as keyof Audit, label: "NC Menores" },
              { key: "observations"as keyof Audit, label: "Observ." },
              { key: "opportunities" as keyof Audit, label: "Oport." },
            ].map(f => (
              <div key={f.key}>
                <label className={lbl}>{f.label}</label>
                <input type="number" min="0" className={inp} value={String(form[f.key] ?? 0)} onChange={e => set(f.key, parseInt(e.target.value) || 0)} />
              </div>
            ))}
          </div>
          <div>
            <label className={lbl}>Resumen ejecutivo</label>
            <textarea className={inp} rows={3} value={form.summary ?? ""} onChange={e => set("summary", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Conclusiones</label>
            <textarea className={inp} rows={2} value={form.conclusions ?? ""} onChange={e => set("conclusions", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Recomendaciones</label>
            <textarea className={inp} rows={2} value={form.recommendations ?? ""} onChange={e => set("recommendations", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Fecha de informe</label>
              <input type="date" className={inp} value={form.report_date?.slice(0,10) ?? ""} onChange={e => set("report_date", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Próxima auditoría</label>
              <input type="date" className={inp} value={form.next_audit?.slice(0,10) ?? ""} onChange={e => set("next_audit", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Responsable seguimiento</label>
            <input className={inp} value={form.responsible ?? ""} onChange={e => set("responsible", e.target.value)} />
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

export default function AuditsPage() {
  const [audits, setAudits]     = useState<Audit[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [openFindings, setOpenFindings] = useState<{ total: string; critical: string; major: string } | null>(null);
  const [years, setYears]       = useState<number[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterYear, setFilterYear] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSt, setFilterSt]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Audit | null>(null);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterYear) params.set("year", filterYear);
    if (filterType) params.set("type", filterType);
    if (filterSt)   params.set("status", filterSt);
    try {
      const r = await fetch(`/api/audits?${params}`);
      const d = await r.json();
      setAudits(d.audits ?? []);
      setStats(d.stats ?? null);
      setOpenFindings(d.openFindings ?? null);
      setYears(d.years ?? []);
    } catch { setError("Error cargando auditorías"); }
    setLoading(false);
  }, [filterYear, filterType, filterSt]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: Partial<Audit>) {
    const isNew = !form.id;
    const r = await fetch("/api/audits", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) { const d = await r.json(); alert(d.error ?? "Error"); return; }
    setShowForm(false); setEditing(null); load();
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta auditoría y sus hallazgos?")) return;
    await fetch(`/api/audits?id=${id}`, { method: "DELETE" });
    load();
  }

  const critOpen = parseInt(openFindings?.critical ?? "0");
  const majOpen  = parseInt(openFindings?.major    ?? "0");
  const totalOpen= parseInt(openFindings?.total    ?? "0");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Auditorías Internas de PR</h1>
            <p className="text-sm text-gray-500">DS 3/1985 — IAEA GSR Part 3 Req. 11 — Verificación del sistema de protección radiológica</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />Nueva auditoría
        </button>
      </div>

      {/* Alertas hallazgos abiertos */}
      {critOpen > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">{critOpen} hallazgo{critOpen > 1 ? "s" : ""} crítico{critOpen > 1 ? "s" : ""} abierto{critOpen > 1 ? "s" : ""}</p>
            <p className="text-sm text-red-700">Requieren acción correctiva inmediata.</p>
          </div>
        </div>
      )}
      {!critOpen && majOpen > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
          <AlertTriangle size={18} className="text-orange-600 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-800">{majOpen} NC mayor{majOpen > 1 ? "es" : ""} abierta{majOpen > 1 ? "s" : ""} — {totalOpen} hallazgos pendientes en total</p>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total auditorías", value: stats.total,          color: "text-gray-700"  },
            { label: "Completadas",      value: stats.completed,      color: "text-green-700" },
            { label: "NC Mayores",       value: stats.nc_major_total, color: "text-orange-600"},
            { label: "NC Menores",       value: stats.nc_minor_total, color: "text-yellow-600"},
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
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        {(filterYear || filterType || filterSt) && (
          <button onClick={() => { setFilterYear(""); setFilterType(""); setFilterSt(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpiar filtros</button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando auditorías…</div>
      ) : audits.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay auditorías registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map(a => (
            <AuditCard
              key={a.id}
              audit={a}
              onEdit={() => { setEditing(a); setShowForm(true); }}
              onDelete={() => handleDelete(a.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AuditForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
