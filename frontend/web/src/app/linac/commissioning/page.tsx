"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { Plus, ChevronDown, ChevronUp, CheckCircle, Clock } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const CATEGORIES = ["dosimetria", "geometria", "dosis_profundidad", "perfiles", "mlc", "imrt", "sbrt", "verificacion_independiente", "otro"];

interface Dataset {
  id: number;
  linac_id: number;
  category: string;
  measurement_type: string;
  measurement_date: string;
  measured_by: string;
  instrument_used: string;
  status: string;
  is_current: boolean;
  version: number;
  notes: string;
  data: Record<string, unknown>;
}

const SEM: Record<string, string> = {
  aprobado:  "bg-green-100 text-green-700",
  pendiente: "bg-yellow-100 text-yellow-700",
  revisado:  "bg-blue-100 text-blue-700",
  rechazado: "bg-red-100 text-red-700",
};

export default function LinacCommissioningPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [category, setCategory] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    linacId: "1", category: "dosimetria", measurementType: "", measurementDate: new Date().toISOString().slice(0, 10),
    measuredBy: "", instrumentUsed: "", notes: "", data: "{}",
  });

  async function fetchDatasets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (linacId) params.set("linacId", linacId);
      if (category) params.set("category", category);
      const res = await fetch(`/api/linac/commissioning?${params}`);
      const data = await res.json();
      setDatasets(data.datasets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDatasets(); }, [linacId, category]);

  async function handleCreate() {
    if (!form.measurementType || !form.measurementDate) { setMsg("Tipo y fecha son requeridos"); return; }
    setSaving(true); setMsg("");
    let parsedData: unknown;
    try { parsedData = JSON.parse(form.data || "{}"); } catch { setMsg("JSON de datos inválido"); setSaving(false); return; }
    try {
      const res = await fetch("/api/linac/commissioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linacId: Number(form.linacId), category: form.category, measurementType: form.measurementType,
          measurementDate: form.measurementDate, measuredBy: form.measuredBy, instrumentUsed: form.instrumentUsed,
          notes: form.notes, data: parsedData,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg("✓ Dataset de commissioning creado");
      setShowForm(false);
      fetchDatasets();
    } finally {
      setSaving(false);
    }
  }

  const stats = {
    total: datasets.length,
    aprobados: datasets.filter(d => d.status === "aprobado").length,
    corrientes: datasets.filter(d => d.is_current).length,
    categorias: new Set(datasets.map(d => d.category)).size,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissioning LINAC</h1>
          <p className="text-sm text-gray-500 mt-1">Datasets de puesta en marcha y medidas de referencia — IAEA TRS-398 / AAPM TG-51</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus size={16} /> Nuevo dataset
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Datasets totales", val: stats.total, color: "text-gray-900" },
          { label: "Aprobados", val: stats.aprobados, color: "text-green-600" },
          { label: "Vigentes (is_current)", val: stats.corrientes, color: "text-indigo-600" },
          { label: "Categorías", val: stats.categorias, color: "text-gray-700" },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{t.label}</p>
            <p className={`text-2xl font-bold ${t.color}`}>{t.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
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
      </div>

      {/* New form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-indigo-800">Nuevo dataset de commissioning</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">LINAC ID *</label>
              <input value={form.linacId} onChange={e => setForm(f => ({ ...f, linacId: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Categoría *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de medición *</label>
              <input value={form.measurementType} onChange={e => setForm(f => ({ ...f, measurementType: e.target.value }))}
                placeholder="PDD 6MV, Output factor, PDDs…" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Fecha de medición *</label>
              <input type="date" value={form.measurementDate} onChange={e => setForm(f => ({ ...f, measurementDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Medido por</label>
              <input value={form.measuredBy} onChange={e => setForm(f => ({ ...f, measuredBy: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Instrumento</label>
              <input value={form.instrumentUsed} onChange={e => setForm(f => ({ ...f, instrumentUsed: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Notas</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Datos (JSON)</label>
              <textarea value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                rows={3} placeholder='{"energia":"6MV","valor":1.000}' className={inp + " font-mono text-xs"} />
            </div>
          </div>
          {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setShowForm(false)} className="bg-white border border-gray-200 px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Dataset list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : datasets.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Sin datasets para los filtros seleccionados</div>
        ) : datasets.map(d => (
          <div key={d.id}>
            <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition"
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{d.measurement_type}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{d.category?.replace(/_/g, " ")}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEM[d.status] ?? "bg-gray-100 text-gray-600"}`}>{d.status}</span>
                  {d.is_current && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> vigente</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(d.measurement_date).toLocaleDateString("es-CL")} · v{d.version}
                  {d.measured_by && ` · ${d.measured_by}`}
                  {d.instrument_used && ` · ${d.instrument_used}`}
                </p>
              </div>
              {expanded === d.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
            </div>
            {expanded === d.id && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
                {d.notes && <p className="text-sm text-gray-700"><span className="font-medium">Notas:</span> {d.notes}</p>}
                {d.data && Object.keys(d.data).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Datos:</p>
                    <pre className="text-xs font-mono bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-40">
                      {JSON.stringify(d.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — IAEA TRS-398 · AAPM TG-51 · DS 3/1985 MINSAL</p>
        <p className="text-xs text-blue-600">Los datos de commissioning son la referencia de oro del equipo. Deben ser archivados, versionados y accesibles para auditoría en todo momento.</p>
      </div>
    </div>
  );
}
