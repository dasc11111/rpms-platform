"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, X, Edit2, Trash2,
  User, Calendar, Zap, Eye
} from "lucide-react";

// Gestión de Riesgos Radiológicos — Matriz de Riesgo
// DS 3/1985 Art. 4 — Identificación y control de riesgos
// IAEA GSR Part 3 Req. 5 — Justificación y optimización ALARA
// Escala: Probabilidad 1-5 × Consecuencia 1-5 → Puntuación 1-25

interface Risk {
  id: number;
  risk_code: string;
  title: string;
  area: string | null;
  category: string;
  source: string | null;
  scenario: string;
  hazard_type: string;
  affected: string | null;
  probability: number;
  consequence: number;
  risk_score: number;
  risk_level: string;
  existing_controls: string | null;
  additional_controls: string | null;
  residual_prob: number;
  residual_cons: number;
  residual_score: number;
  residual_level: string;
  responsible: string | null;
  due_date: string | null;
  completion_date: string | null;
  status: string;
  review_date: string | null;
  references_norm: string | null;
  notes: string | null;
}

interface Stats {
  total: string; critical: string; high: string; medium: string; low: string;
  identified: string; in_control: string; completed: string;
}

const LEVEL_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "Crítico",  color: "text-red-800",    bg: "bg-red-100",    border: "border-red-400"   },
  high:     { label: "Alto",     color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-300"},
  medium:   { label: "Medio",    color: "text-yellow-700", bg: "bg-yellow-100", border: "border-yellow-300"},
  low:      { label: "Bajo",     color: "text-green-700",  bg: "bg-green-100",  border: "border-green-300" },
};

const CAT_CFG: Record<string, string> = {
  occupational: "Laboral",
  public:       "Público",
  environmental:"Ambiental",
  patient:      "Paciente",
};

const HAZARD_CFG: Record<string, string> = {
  external_exposure: "Exposición externa",
  internal_exposure: "Exposición interna",
  contamination:     "Contaminación",
  accident:          "Accidente",
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  identified: { label: "Identificado",  color: "text-blue-600",   icon: <Eye size={13} />         },
  in_control: { label: "En control",    color: "text-amber-600",  icon: <Clock size={13} />       },
  completed:  { label: "Mitigado",      color: "text-green-700",  icon: <CheckCircle2 size={13} />},
};

const PROB_LABELS = ["", "Muy raro (1)", "Raro (2)", "Posible (3)", "Probable (4)", "Casi cierto (5)"];
const CONS_LABELS = ["", "Insignificante (1)", "Menor (2)", "Moderada (3)", "Mayor (4)", "Catastrófica (5)"];

function ScoreMatrix({ prob, cons, label }: { prob: number; cons: number; label: string }) {
  const score = prob * cons;
  const level = score >= 15 ? "critical" : score >= 9 ? "high" : score >= 4 ? "medium" : "low";
  const cfg = LEVEL_CFG[level]!;
  return (
    <div className={`rounded p-2 text-center ${cfg.bg} ${cfg.border} border`}>
      <div className={`text-lg font-bold ${cfg.color}`}>{score}</div>
      <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function RiskCard({ risk, onEdit, onDelete }: { risk: Risk; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const lv  = LEVEL_CFG[risk.risk_level]  ?? LEVEL_CFG.medium!;
  const rlv = LEVEL_CFG[risk.residual_level ?? "low"] ?? LEVEL_CFG.low!;
  const st  = STATUS_CFG[risk.status] ?? STATUS_CFG.identified!;

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${lv.border}`}>
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={() => setOpen(!open)}>
        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${risk.risk_level === "critical" ? "bg-red-600" : risk.risk_level === "high" ? "bg-orange-500" : risk.risk_level === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-600">{risk.risk_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lv.bg} ${lv.color}`}>{lv.label}</span>
            <span className={`text-xs flex items-center gap-1 ${st.color}`}>{st.icon}{st.label}</span>
            <span className="text-xs text-gray-400">{CAT_CFG[risk.category] ?? risk.category}</span>
            {risk.area && <span className="text-xs text-gray-400">· {risk.area}</span>}
          </div>
          <p className="font-medium text-gray-900 truncate">{risk.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{risk.scenario}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            <span>Puntuación: {risk.probability}×{risk.consequence}={risk.risk_score}</span>
            {risk.residual_score && (
              <span className="flex items-center gap-1">
                <ArrowRight size={11} />Residual: {risk.residual_prob}×{risk.residual_cons}={risk.residual_score}
                <span className={`px-1.5 rounded-full ${rlv.bg} ${rlv.color}`}>{rlv.label}</span>
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 mt-1 shrink-0" />
               : <ChevronDown size={18} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <ScoreMatrix prob={risk.probability}  cons={risk.consequence}  label="Riesgo inherente" />
            <div className="flex items-center justify-center"><ArrowRight size={20} className="text-gray-300" /></div>
            <ScoreMatrix prob={risk.residual_prob} cons={risk.residual_cons} label="Riesgo residual" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
            <div><span className="font-medium">Probabilidad:</span> {PROB_LABELS[risk.probability]}</div>
            <div><span className="font-medium">Consecuencia:</span> {CONS_LABELS[risk.consequence]}</div>
            <div><span className="font-medium">Tipo de peligro:</span> {HAZARD_CFG[risk.hazard_type] ?? risk.hazard_type}</div>
            {risk.source && <div><span className="font-medium">Fuente:</span> {risk.source}</div>}
            {risk.affected && <div className="col-span-2"><span className="font-medium">Afectados:</span> {risk.affected}</div>}
          </div>

          {risk.existing_controls && (
            <div className="bg-green-50 rounded p-3 text-xs">
              <p className="font-medium text-green-800 mb-1">Controles existentes</p>
              <p className="text-green-700">{risk.existing_controls}</p>
            </div>
          )}
          {risk.additional_controls && (
            <div className="bg-blue-50 rounded p-3 text-xs">
              <p className="font-medium text-blue-800 mb-1">Controles adicionales requeridos</p>
              <p className="text-blue-700">{risk.additional_controls}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
            {risk.responsible && <div><span className="font-medium">Responsable:</span><br/>{risk.responsible}</div>}
            {risk.due_date && <div><span className="font-medium">Plazo:</span><br/>{new Date(risk.due_date).toLocaleDateString("es-CL")}</div>}
            {risk.review_date && <div><span className="font-medium">Revisión:</span><br/>{new Date(risk.review_date).toLocaleDateString("es-CL")}</div>}
          </div>

          {risk.references_norm && (
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-3 py-2">{risk.references_norm}</p>
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

// 5×5 Risk Matrix mini-visualization
function RiskMatrix({ risks }: { risks: Risk[] }) {
  const cells: Record<string, number> = {};
  risks.forEach(r => {
    const k = `${r.probability}-${r.consequence}`;
    cells[k] = (cells[k] ?? 0) + 1;
  });
  const color = (p: number, c: number) => {
    const s = p * c;
    if (s >= 15) return "bg-red-200 text-red-800";
    if (s >= 9)  return "bg-orange-100 text-orange-700";
    if (s >= 4)  return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-600 mb-3">Matriz de Riesgo (Probabilidad × Consecuencia)</p>
      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-1 text-right pr-1">
          {[5,4,3,2,1].map(p => <div key={p} className="h-8 flex items-center justify-end text-xs text-gray-400 w-6">{p}</div>)}
          <div className="h-4 text-xs text-gray-400 w-6"></div>
        </div>
        <div className="flex-1">
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            {[5,4,3,2,1].flatMap(p =>
              [1,2,3,4,5].map(c => {
                const k = `${p}-${c}`;
                const n = cells[k] ?? 0;
                return (
                  <div key={k} className={`h-8 rounded flex items-center justify-center text-xs font-bold ${color(p,c)} ${n ? "ring-1 ring-gray-400" : ""}`}>
                    {n || ""}
                  </div>
                );
              })
            )}
          </div>
          <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            {[1,2,3,4,5].map(c => <div key={c} className="h-4 flex items-center justify-center text-xs text-gray-400">{c}</div>)}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-xs text-gray-500 justify-center">
        <span>↑ Probabilidad</span><span>→ Consecuencia</span>
      </div>
    </div>
  );
}

const EMPTY: Partial<Risk> = {
  risk_code: "", title: "", area: "", category: "occupational", source: "",
  scenario: "", hazard_type: "external_exposure", affected: "",
  probability: 3, consequence: 3, risk_level: "medium",
  existing_controls: "", additional_controls: "",
  residual_prob: 2, residual_cons: 2, residual_level: "low",
  status: "identified", responsible: "", references_norm: "", notes: ""
};

function RiskForm({ initial, onSave, onClose }: {
  initial: Partial<Risk>; onSave: (d: Partial<Risk>) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Risk>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Risk, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const prob = Number(form.probability ?? 3);
  const cons = Number(form.consequence ?? 3);
  const rProb = Number(form.residual_prob ?? 2);
  const rCons = Number(form.residual_cons ?? 2);
  const previewScore = prob * cons;
  const previewResidual = rProb * rCons;

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
            <ShieldAlert size={18} className="text-orange-500" />
            {initial.id ? "Editar riesgo" : "Nuevo riesgo radiológico"}
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input required className={inp} value={form.risk_code ?? ""} onChange={e => set("risk_code", e.target.value)} placeholder="RSK-MN-001" />
            </div>
            <div>
              <label className={lbl}>Categoría</label>
              <select className={inp} value={form.category ?? "occupational"} onChange={e => set("category", e.target.value)}>
                {Object.entries(CAT_CFG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Título</label>
            <input className={inp} value={form.title ?? ""} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Área</label>
              <input className={inp} value={form.area ?? ""} onChange={e => set("area", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fuente / Agente</label>
              <input className={inp} value={form.source ?? ""} onChange={e => set("source", e.target.value)} placeholder="F-18 FDG 370 MBq" />
            </div>
          </div>
          <div>
            <label className={lbl}>Escenario de riesgo *</label>
            <textarea required className={inp} rows={3} value={form.scenario ?? ""} onChange={e => set("scenario", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tipo de peligro</label>
              <select className={inp} value={form.hazard_type ?? "external_exposure"} onChange={e => set("hazard_type", e.target.value)}>
                {Object.entries(HAZARD_CFG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status ?? "identified"} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Afectados</label>
            <input className={inp} value={form.affected ?? ""} onChange={e => set("affected", e.target.value)} placeholder="TOE, público, pacientes" />
          </div>

          <div className="border rounded-lg p-4 space-y-3 bg-orange-50">
            <p className="text-xs font-semibold text-orange-800">Riesgo inherente — Puntuación: {previewScore} ({previewScore >= 15 ? "Crítico" : previewScore >= 9 ? "Alto" : previewScore >= 4 ? "Medio" : "Bajo"})</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Probabilidad (1-5)</label>
                <input type="range" min={1} max={5} className="w-full" value={prob} onChange={e => set("probability", parseInt(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">{PROB_LABELS[prob]}</p>
              </div>
              <div>
                <label className={lbl}>Consecuencia (1-5)</label>
                <input type="range" min={1} max={5} className="w-full" value={cons} onChange={e => set("consequence", parseInt(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">{CONS_LABELS[cons]}</p>
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Controles existentes</label>
            <textarea className={inp} rows={2} value={form.existing_controls ?? ""} onChange={e => set("existing_controls", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Controles adicionales requeridos</label>
            <textarea className={inp} rows={2} value={form.additional_controls ?? ""} onChange={e => set("additional_controls", e.target.value)} />
          </div>

          <div className="border rounded-lg p-4 space-y-3 bg-green-50">
            <p className="text-xs font-semibold text-green-800">Riesgo residual — Puntuación: {previewResidual} ({previewResidual >= 15 ? "Crítico" : previewResidual >= 9 ? "Alto" : previewResidual >= 4 ? "Medio" : "Bajo"})</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Prob. residual (1-5)</label>
                <input type="range" min={1} max={5} className="w-full" value={rProb} onChange={e => set("residual_prob", parseInt(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">{PROB_LABELS[rProb]}</p>
              </div>
              <div>
                <label className={lbl}>Cons. residual (1-5)</label>
                <input type="range" min={1} max={5} className="w-full" value={rCons} onChange={e => set("residual_cons", parseInt(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">{CONS_LABELS[rCons]}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Responsable</label>
              <input className={inp} value={form.responsible ?? ""} onChange={e => set("responsible", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fecha límite</label>
              <input type="date" className={inp} value={form.due_date?.slice(0,10) ?? ""} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Referencias normativas</label>
            <input className={inp} value={form.references_norm ?? ""} onChange={e => set("references_norm", e.target.value)} placeholder="DS 3/1985 Art. 4; IAEA GSR Part 3..." />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RisksPage() {
  const [risks, setRisks]       = useState<Risk[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [areas, setAreas]       = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [filterCat, setFilterCat]     = useState("");
  const [filterSt, setFilterSt]       = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Risk | null>(null);
  const [error, setError]       = useState("");
  const [showMatrix, setShowMatrix] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterLevel) params.set("level", filterLevel);
    if (filterCat)   params.set("category", filterCat);
    if (filterSt)    params.set("status", filterSt);
    try {
      const r = await fetch(`/api/risks?${params}`);
      const d = await r.json();
      setRisks(d.risks ?? []);
      setStats(d.stats ?? null);
      setAreas(d.areas ?? []);
    } catch { setError("Error cargando riesgos"); }
    setLoading(false);
  }, [filterLevel, filterCat, filterSt]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: Partial<Risk>) {
    const r = await fetch("/api/risks", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) { const d = await r.json(); alert(d.error ?? "Error"); return; }
    setShowForm(false); setEditing(null); load();
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Dar de baja este riesgo?")) return;
    await fetch(`/api/risks?id=${id}`, { method: "DELETE" });
    load();
  }

  const criticalCount = parseInt(stats?.critical ?? "0");
  const highCount     = parseInt(stats?.high     ?? "0");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert size={28} className="text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Riesgos Radiológicos</h1>
            <p className="text-sm text-gray-500">DS 3/1985 Art. 4 — IAEA GSR Part 3 Req. 5 — Matriz probabilidad × consecuencia</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Plus size={16} />Nuevo riesgo
        </button>
      </div>

      {/* Alertas */}
      {criticalCount > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">{criticalCount} riesgo{criticalCount > 1 ? "s" : ""} crítico{criticalCount > 1 ? "s" : ""} activo{criticalCount > 1 ? "s" : ""}</p>
            <p className="text-sm text-red-700">Requieren controles inmediatos. DS 3/1985 — ALARA obligatorio.</p>
          </div>
        </div>
      )}
      {!criticalCount && highCount > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
          <Zap size={18} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-800">{highCount} riesgo{highCount > 1 ? "s" : ""} alto{highCount > 1 ? "s" : ""} — implementar controles adicionales.</p>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Críticos", value: stats.critical, color: "text-red-700"    },
            { label: "Altos",    value: stats.high,     color: "text-orange-600" },
            { label: "Medios",   value: stats.medium,   color: "text-yellow-600" },
            { label: "Bajos",    value: stats.low,      color: "text-green-700"  },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Matriz de riesgo */}
      <div className="mb-5">
        <button onClick={() => setShowMatrix(!showMatrix)} className="text-xs text-blue-600 hover:underline mb-2">
          {showMatrix ? "Ocultar" : "Mostrar"} matriz de riesgo
        </button>
        {showMatrix && risks.length > 0 && <RiskMatrix risks={risks} />}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los niveles</option>
          {Object.entries(LEVEL_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_CFG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        {(filterLevel || filterCat || filterSt) && (
          <button onClick={() => { setFilterLevel(""); setFilterCat(""); setFilterSt(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpiar filtros</button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando riesgos…</div>
      ) : risks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay riesgos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {risks.map(r => (
            <RiskCard
              key={r.id}
              risk={r}
              onEdit={() => { setEditing(r); setShowForm(true); }}
              onDelete={() => handleDelete(r.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <RiskForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
