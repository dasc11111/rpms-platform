"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Users, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp
} from "lucide-react";

type Record_ = {
  id: number; year: number; quarter: number | null; group_name: string;
  location: string; dose_msv: string; dose_basis: string;
  calculation_method: string; notes: string; reviewed_by: string;
};

type GroupRow = {
  group_name: string; year: number; total_dose_msv: string;
  quarters_reported: string; location: string;
};

type Stats = {
  groups: string; total_dose: string; max_quarterly: string;
};

type Data = {
  records: Record_[]; byGroup: GroupRow[]; stats: Stats;
  compliant: boolean; maxAnnual: number; years: number[];
};

const LIMIT_MSV = 1.0; // DS 3/1985 Art. 10 — 1 mSv/año para público

const METHOD_CFG: Record<string, { label: string; color: string }> = {
  measurement:  { label: "Medición directa",   color: "text-blue-700"  },
  calculation:  { label: "Cálculo",             color: "text-purple-700" },
  model:        { label: "Modelación",          color: "text-teal-700"  },
  conservative: { label: "Estimación conserv.", color: "text-amber-700" },
};

type FormState = {
  year: string; quarter: string; group_name: string; location: string;
  dose_msv: string; dose_basis: string; calculation_method: string;
  notes: string; reviewed_by: string;
};

const BLANK: FormState = {
  year: String(new Date().getFullYear()), quarter: String(Math.ceil((new Date().getMonth() + 1) / 3)),
  group_name: "", location: "", dose_msv: "", dose_basis: "",
  calculation_method: "measurement", notes: "", reviewed_by: "",
};

function GroupCard({ group, pct }: { group: GroupRow; pct: number }) {
  const [open, setOpen] = useState(false);
  const dose = parseFloat(group.total_dose_msv);
  const isOver = dose >= LIMIT_MSV;
  const isNear = dose >= LIMIT_MSV * 0.75 && !isOver;
  const barColor = isOver ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-green-500";
  const textColor = isOver ? "text-red-700" : isNear ? "text-amber-700" : "text-green-700";

  return (
    <div className={`bg-white rounded-xl border shadow-sm border-l-4 ${isOver ? "border-red-400" : isNear ? "border-amber-400" : "border-green-400"}`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900 truncate">{group.group_name}</span>
            {isOver && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">EXCEDE LÍMITE</span>}
          </div>
          {group.location && <p className="text-xs text-gray-500 mb-2">{group.location}</p>}
          <div className="flex items-center gap-4">
            <span className={`text-sm font-bold ${textColor}`}>
              {dose.toFixed(4)} mSv / {LIMIT_MSV} mSv ({pct.toFixed(0)}%)
            </span>
            <span className="text-xs text-gray-500">{group.quarters_reported} trimestre(s)</span>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 mt-1" />}
      </div>
    </div>
  );
}

function RecordRow({ rec, onDelete }: { rec: Record_; onDelete: () => void }) {
  const mcfg = METHOD_CFG[rec.calculation_method] ?? { label: rec.calculation_method, color: "text-gray-600" };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {rec.quarter && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">T{rec.quarter}</span>}
          <span className="text-sm font-medium text-gray-900">{rec.group_name}</span>
          <span className={`text-xs ${mcfg.color}`}>{mcfg.label}</span>
        </div>
        {rec.location && <p className="text-xs text-gray-500 mt-0.5">{rec.location}</p>}
        {rec.dose_basis && <p className="text-xs text-gray-400 mt-0.5 italic">{rec.dose_basis}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-gray-900">{parseFloat(rec.dose_msv).toFixed(4)} mSv</p>
        {rec.reviewed_by && <p className="text-xs text-gray-400">{rec.reviewed_by}</p>}
      </div>
      <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-1">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PublicDosePage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/public-dose?year=${year}`).then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.year || !form.group_name || !form.dose_msv) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public-dose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: parseInt(form.year), quarter: form.quarter ? parseInt(form.quarter) : null,
          dose_msv: parseFloat(form.dose_msv),
        }),
      });
      if (res.ok) { setShowForm(false); setForm(BLANK); load(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await fetch(`/api/public-dose?id=${id}`, { method: "DELETE" });
    load();
  };

  const years = data?.years?.length
    ? data.years
    : [new Date().getFullYear(), new Date().getFullYear() - 1];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-xl">
            <Users className="h-6 w-6 text-cyan-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dosis a Miembros del Público</h1>
            <p className="text-sm text-gray-500">Estimación anual de dosis efectiva a grupos críticos — DS 3/1985 Art. 10 (límite: 1 mSv/año)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700">
            <Plus className="h-4 w-4" /> Registrar Dosis
          </button>
        </div>
      </div>

      {/* Compliance status */}
      {data && (
        <div className={`rounded-xl p-4 flex items-start gap-3 border ${data.compliant ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {data.compliant
            ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          }
          <div>
            <p className={`text-sm font-semibold ${data.compliant ? "text-green-800" : "text-red-800"}`}>
              {data.compliant
                ? `✓ CONFORME — Dosis máxima anual al público: ${data.maxAnnual.toFixed(4)} mSv (límite: ${LIMIT_MSV} mSv/año)`
                : `⚠ NO CONFORME — Dosis máxima anual: ${data.maxAnnual.toFixed(4)} mSv excede límite de ${LIMIT_MSV} mSv/año`
              }
            </p>
            <p className={`text-xs mt-1 ${data.compliant ? "text-green-700" : "text-red-700"}`}>
              Año {year} · {data.stats?.groups ?? 0} grupo(s) crítico(s) evaluado(s)
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {data?.stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Grupos evaluados",    value: data.stats.groups },
            { label: "Dosis más alta (anual)", value: `${data.maxAnnual.toFixed(4)} mSv`, color: data.maxAnnual >= LIMIT_MSV ? "text-red-700" : data.maxAnnual >= LIMIT_MSV * 0.75 ? "text-amber-700" : "text-green-700" },
            { label: "Límite normativo",    value: `${LIMIT_MSV} mSv/año`, color: "text-gray-600" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color ?? "text-gray-900"}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Year selector + Group summary */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Año:</label>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <span className="text-xs text-gray-500 ml-auto">Resumen por grupo crítico</span>
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-6">Cargando…</p>
          ) : !data?.byGroup?.length ? (
            <p className="text-sm text-gray-500 text-center py-6">Sin datos para el año {year}.</p>
          ) : (
            data.byGroup.map(g => {
              const pct = (parseFloat(g.total_dose_msv) / LIMIT_MSV) * 100;
              return <GroupCard key={g.group_name} group={g} pct={pct} />;
            })
          )}
        </div>
      </div>

      {/* Detailed records */}
      {data?.records && data.records.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Registros Trimestrales — {year}</h2>
          <div>
            {data.records.map(r => (
              <RecordRow key={r.id} rec={r} onDelete={() => handleDelete(r.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Registrar Estimación de Dosis al Público</h2>
              <button onClick={() => { setShowForm(false); setForm(BLANK); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                ["Año *", "year", "number"],
                ["Trimestre", "quarter", "number"],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={form[key as keyof FormState] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    min={type === "number" ? 1 : undefined}
                    max={key === "quarter" ? 4 : undefined}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Grupo Crítico *</label>
                <input value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                  placeholder="Ej: Pacientes en sala de espera MN"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Ubicación</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dosis (mSv) *</label>
                <input type="number" step="0.0001" min="0" value={form.dose_msv}
                  onChange={e => setForm(f => ({ ...f, dose_msv: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="0.0000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Método</label>
                <select value={form.calculation_method} onChange={e => setForm(f => ({ ...f, calculation_method: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  {Object.entries(METHOD_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Base del cálculo / medición</label>
                <textarea value={form.dose_basis} onChange={e => setForm(f => ({ ...f, dose_basis: e.target.value }))} rows={2}
                  placeholder="Describe cómo se obtuvo la estimación de dosis"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Revisado por</label>
                <input value={form.reviewed_by} onChange={e => setForm(f => ({ ...f, reviewed_by: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setForm(BLANK); }}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">
                {saving ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
