"use client";
import { useEffect, useState } from "react";
import { Zap, ChevronDown, ChevronUp, Plus } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const MODALITIES = ["photon", "electron", "proton", "neutron"];

interface BeamDataItem {
  id: number;
  linac_id: number;
  modality: string;
  energy: string;
  measurement_type: string;
  field_size: string;
  depth: number;
  value: number;
  unit: string;
  instrument: string;
  responsible: string;
  measurement_date: string;
  notes: string;
  source: string;
}

export default function LinacBeamdataPage() {
  const [items, setItems] = useState<BeamDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [modality, setModality] = useState("");
  const [energy, setEnergy] = useState("");
  const [measurementType, setMeasurementType] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    linacId: "1", modality: "photon", energy: "6MV", measurementType: "", fieldSize: "",
    depth: "", value: "", unit: "cGy", instrument: "", responsible: "",
    measurementDate: new Date().toISOString().slice(0, 10), notes: "",
  });

  async function fetchBeamData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (linacId) params.set("linacId", linacId);
      if (modality) params.set("modality", modality);
      if (energy) params.set("energy", energy);
      if (measurementType) params.set("measurementType", measurementType);
      const res = await fetch(`/api/linac/beamdata?${params}`);
      const data = await res.json();
      setItems(data.items ?? data.libraryRows ?? data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBeamData(); }, [linacId, modality, energy, measurementType]);

  async function handleCreate() {
    if (!form.measurementType || !form.energy || !form.value) { setMsg("Tipo, energía y valor son requeridos"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/linac/beamdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linacId: Number(form.linacId), modality: form.modality, energy: form.energy,
          measurementType: form.measurementType, fieldSize: form.fieldSize,
          depth: form.depth ? Number(form.depth) : null,
          value: Number(form.value), unit: form.unit,
          instrument: form.instrument, responsible: form.responsible,
          measurementDate: form.measurementDate, notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg("✓ Dato de haz guardado");
      setShowForm(false);
      fetchBeamData();
    } finally {
      setSaving(false);
    }
  }

  const energies = [...new Set(items.map(i => i.energy))].filter(Boolean);
  const stats = {
    total: items.length,
    modalidades: new Set(items.map(i => i.modality)).size,
    energias: energies.length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Datos de Haz LINAC</h1>
          <p className="text-sm text-gray-500 mt-1">Librería de datos de haz — PDDs, perfiles, factores de campo — IAEA TRS-398</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus size={16} /> Nuevo dato
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total datos de haz</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Modalidades</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.modalidades}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Energías</p>
          <p className="text-2xl font-bold text-gray-700">{stats.energias}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[100px]">
          <label className="block text-xs text-gray-500 mb-1">LINAC ID</label>
          <input value={linacId} onChange={e => setLinacId(e.target.value)} className={inp} />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Modalidad</label>
          <select value={modality} onChange={e => setModality(e.target.value)} className={inp}>
            <option value="">Todas</option>
            {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="block text-xs text-gray-500 mb-1">Energía</label>
          <input value={energy} onChange={e => setEnergy(e.target.value)} placeholder="6MV, 15MV…" className={inp} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Tipo medición</label>
          <input value={measurementType} onChange={e => setMeasurementType(e.target.value)} placeholder="PDD, perfil…" className={inp} />
        </div>
      </div>

      {/* New form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-indigo-800">Nuevo dato de haz</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: "linacId", label: "LINAC ID *", ph: "1" },
              { key: "energy", label: "Energía *", ph: "6MV" },
              { key: "measurementType", label: "Tipo medición *", ph: "PDD, factor campo…" },
              { key: "fieldSize", label: "Campo (cm²)", ph: "10x10" },
              { key: "depth", label: "Profundidad (cm)", ph: "5.0" },
              { key: "value", label: "Valor *", ph: "1.000" },
              { key: "unit", label: "Unidad", ph: "cGy, %…" },
              { key: "instrument", label: "Instrumento", ph: "" },
              { key: "responsible", label: "Responsable", ph: "" },
              { key: "measurementDate", label: "Fecha", ph: "", type: "date" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
                <input type={f.type ?? "text"} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.ph} className={inp} />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Modalidad</label>
              <select value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))} className={inp}>
                {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Notas</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
            </div>
          </div>
          {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setShowForm(false)} className="bg-white border border-gray-200 px-5 py-2 rounded-lg text-sm text-gray-600">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Modalidad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Energía</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Campo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin datos de haz para los filtros seleccionados</td></tr>
              ) : items.map(item => (
                <>
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.measurement_type}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-indigo-700"><Zap size={12} /> {item.modality}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{item.energy}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-700">{Number(item.value).toFixed(4)} {item.unit}</td>
                    <td className="px-4 py-3 text-gray-600">{item.field_size || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.measurement_date ? new Date(item.measurement_date).toLocaleDateString("es-CL") : "—"}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {expanded === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  </tr>
                  {expanded === item.id && (
                    <tr key={`exp-${item.id}`} className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {item.depth != null && <div><span className="text-xs text-gray-500">Profundidad</span><p className="font-medium">{item.depth} cm</p></div>}
                          {item.instrument && <div><span className="text-xs text-gray-500">Instrumento</span><p className="font-medium">{item.instrument}</p></div>}
                          {item.responsible && <div><span className="text-xs text-gray-500">Responsable</span><p className="font-medium">{item.responsible}</p></div>}
                          {item.notes && <div className="col-span-2"><span className="text-xs text-gray-500">Notas</span><p className="font-medium">{item.notes}</p></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — IAEA TRS-398 · AAPM TG-51 · IAEA TRS-430</p>
        <p className="text-xs text-blue-600">Los datos de haz son la base del sistema de planificación. Deben ser verificados independientemente antes de su uso clínico.</p>
      </div>
    </div>
  );
}
