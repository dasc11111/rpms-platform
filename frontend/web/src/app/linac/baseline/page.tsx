"use client";

import { useEffect, useState } from "react";
import { Target, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Plus } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const CATEGORIES = ["dosimetria", "geometria", "dosis_profundidad", "perfiles", "mlc", "imrt", "sbrt", "verificacion_independiente", "otro"];

interface Baseline {
  id: number;
  linac_id: number;
  category: string;
  measurement_type: string;
  version: number;
  is_current: boolean;
  created_at: string;
  created_by: string;
  notes: string;
  dataset_id: number;
  measurement_date: string;
  measured_by: string;
  instrument_used: string;
  data: Record<string, unknown>;
  dataset_notes: string;
  dataset_status: string;
}

export default function LinacBaselinePage() {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [category, setCategory] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ linacId: "1", datasetId: "", category: "dosimetria", measurementType: "", notes: "" });

  async function fetchBaselines() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (linacId) params.set("linacId", linacId);
      if (category) params.set("category", category);
      if (showHistory) params.set("history", "1");
      const res = await fetch(`/api/linac/baseline?${params}`);
      const data = await res.json();
      setBaselines(data.baselines ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBaselines(); }, [linacId, category, showHistory]);

  async function handlePromote() {
    if (!form.datasetId || !form.category || !form.measurementType) { setMsg("Dataset ID, categoría y tipo son requeridos"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/linac/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linacId: Number(form.linacId), datasetId: Number(form.datasetId),
          category: form.category, measurementType: form.measurementType, notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg("✓ Dataset promovido a baseline");
      setShowForm(false);
      fetchBaselines();
    } finally {
      setSaving(false);
    }
  }

  const stats = {
    total: baselines.length,
    current: baselines.filter(b => b.is_current).length,
    categories: new Set(baselines.map(b => b.category)).size,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Baselines LINAC</h1>
          <p className="text-sm text-gray-500 mt-1">Medidas de referencia gold standard del equipo — IAEA TRS-430</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus size={16} /> Promover dataset
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Baselines vigentes</p>
          <p className="text-2xl font-bold text-green-600">{stats.current}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total (incl. históricos)</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Categorías cubiertas</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.categories}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-gray-500 mb-1">LINAC ID</label>
          <input value={linacId} onChange={e => setLinacId(e.target.value)} placeholder="1" className={inp} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Categoría</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
            <option value="">Todas</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-4">
          <input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} className="rounded" />
          Incluir históricos
        </label>
      </div>

      {/* Promote form */}
      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-green-800">Promover dataset a baseline</h2>
          <p className="text-xs text-green-700">Seleccione un dataset de commissioning existente para elevarlo como nuevo baseline de referencia.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Dataset ID *</label>
              <input value={form.datasetId} onChange={e => setForm(f => ({ ...f, datasetId: e.target.value }))}
                placeholder="ID del dataset de commissioning" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Categoría *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de medición *</label>
              <input value={form.measurementType} onChange={e => setForm(f => ({ ...f, measurementType: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Notas</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
            </div>
          </div>
          {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handlePromote} disabled={saving}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">{saving ? "Promoviendo…" : "Promover a baseline"}</button>
            <button onClick={() => setShowForm(false)} className="bg-white border border-gray-200 px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Baselines list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : baselines.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Sin baselines para los filtros seleccionados</div>
        ) : baselines.map(b => (
          <div key={b.id}>
            <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition"
              onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
              <Target size={18} className={b.is_current ? "text-green-500" : "text-gray-300"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{b.measurement_type}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{b.category?.replace(/_/g, " ")}</span>
                  <span className="text-xs text-gray-500">v{b.version}</span>
                  {b.is_current
                    ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={12} /> vigente</span>
                    : <span className="text-xs text-gray-400">histórico</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dataset #{b.dataset_id} · {b.measurement_date ? new Date(b.measurement_date).toLocaleDateString("es-CL") : ""}
                  {b.measured_by && ` · ${b.measured_by}`}
                </p>
              </div>
              {expanded === b.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
            </div>
            {expanded === b.id && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {b.instrument_used && <div><span className="text-xs text-gray-500">Instrumento</span><p className="font-medium">{b.instrument_used}</p></div>}
                  {b.dataset_status && <div><span className="text-xs text-gray-500">Estado dataset</span><p className="font-medium">{b.dataset_status}</p></div>}
                  {b.notes && <div><span className="text-xs text-gray-500">Notas</span><p className="font-medium">{b.notes}</p></div>}
                </div>
                {b.data && Object.keys(b.data).length > 0 && (
                  <pre className="text-xs font-mono bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-40">
                    {JSON.stringify(b.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — IAEA TRS-430 · AAPM TG-142</p>
        <p className="text-xs text-blue-600">Los baselines son la referencia para todos los controles de calidad periódicos. Deben actualizarse tras mantenimientos mayores o cambios de haz.</p>
      </div>
    </div>
  );
}
