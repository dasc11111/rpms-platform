"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { Save, AlertTriangle, Info, Pencil, X, Check } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

interface Limit {
  id: number;
  radionuclido: string;
  limite_bq_m2: number;
  pct_registro: number;
  pct_investigacion: number;
  pct_intervencion: number;
  unidad: string;
  notas: string;
  updated_at: string;
}

function fmtBq(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GBq/m²`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MBq/m²`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kBq/m²`;
  return `${v.toFixed(0)} Bq/m²`;
}

export default function ContaminationLimitsPage() {
  const [limits, setLimits] = useState<Limit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Limit>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ radionuclido: "", limite_bq_m2: "", pct_registro: "5", pct_investigacion: "30", pct_intervencion: "50", unidad: "Bq/m²", notas: "" });

  async function fetchLimits() {
    setLoading(true);
    try {
      const res = await fetch("/api/contamination/limits");
      const data = await res.json();
      setLimits(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLimits(); }, []);

  async function handleUpdate(id: number) {
    const lim = limits.find(l => l.id === id);
    if (!lim) return;
    setSaving(true); setMsg("");
    try {
      const payload = { radionuclido: lim.radionuclido, ...editForm };
      const res = await fetch("/api/contamination/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg(`✓ Límite de ${lim.radionuclido} actualizado`);
      setEditing(null);
      fetchLimits();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newForm.radionuclido || !newForm.limite_bq_m2) { setMsg("Radionúclido y límite son requeridos"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/contamination/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radionuclido: newForm.radionuclido.toUpperCase(),
          limite_bq_m2: Number(newForm.limite_bq_m2),
          pct_registro: Number(newForm.pct_registro),
          pct_investigacion: Number(newForm.pct_investigacion),
          pct_intervencion: Number(newForm.pct_intervencion),
          unidad: newForm.unidad,
          notas: newForm.notas,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error al crear"); return; }
      setMsg(`✓ Límite para ${newForm.radionuclido.toUpperCase()} guardado`);
      setNewForm({ radionuclido: "", limite_bq_m2: "", pct_registro: "5", pct_investigacion: "30", pct_intervencion: "50", unidad: "Bq/m²", notas: "" });
      setShowAdd(false);
      fetchLimits();
    } finally {
      setSaving(false);
    }
  }

  const thresholdLevels = (l: Limit) => [
    { label: "Registro", pct: l.pct_registro, bq: l.limite_bq_m2 * l.pct_registro / 100, color: "text-green-700 bg-green-50 border-green-200" },
    { label: "Investigación", pct: l.pct_investigacion, bq: l.limite_bq_m2 * l.pct_investigacion / 100, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
    { label: "Intervención", pct: l.pct_intervencion, bq: l.limite_bq_m2 * l.pct_intervencion / 100, color: "text-red-700 bg-red-50 border-red-200" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Límites de Contaminación Superficial</h1>
          <p className="text-sm text-gray-500 mt-1">Configuración de límites Bq/m² por radionúclido — DS 3/1985 MINSAL / IAEA GSR Part 3</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition">
          + Agregar límite
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Umbral de acción</p>
          <p>Los límites aquí configurados determinan los niveles de acción del semáforo en el módulo de control de contaminación. <strong>% Registro</strong> = primer registro, <strong>% Investigación</strong> = requiere investigación, <strong>% Intervención</strong> = acción inmediata.</p>
        </div>
      </div>

      {/* Alert message */}
      {msg && (
        <div className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-orange-800">Nuevo radionúclido</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Radionúclido *</label>
              <input value={newForm.radionuclido} onChange={e => setNewForm(f => ({ ...f, radionuclido: e.target.value.toUpperCase() }))}
                placeholder="I131" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Límite Bq/m² *</label>
              <input type="number" value={newForm.limite_bq_m2} onChange={e => setNewForm(f => ({ ...f, limite_bq_m2: e.target.value }))}
                placeholder="1000000" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Unidad</label>
              <input value={newForm.unidad} onChange={e => setNewForm(f => ({ ...f, unidad: e.target.value }))}
                placeholder="Bq/m²" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">% Registro</label>
              <input type="number" value={newForm.pct_registro} onChange={e => setNewForm(f => ({ ...f, pct_registro: e.target.value }))}
                className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">% Investigación</label>
              <input type="number" value={newForm.pct_investigacion} onChange={e => setNewForm(f => ({ ...f, pct_investigacion: e.target.value }))}
                className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">% Intervención</label>
              <input type="number" value={newForm.pct_intervencion} onChange={e => setNewForm(f => ({ ...f, pct_intervencion: e.target.value }))}
                className={inp} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">Notas</label>
              <input value={newForm.notas} onChange={e => setNewForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Referencia normativa…" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => setShowAdd(false)} className="bg-white border border-gray-200 px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Limits list */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
        ) : limits.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Sin límites configurados</div>
        ) : limits.map(l => (
          <div key={l.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{l.radionuclido}</h3>
                <p className="text-sm text-gray-500">Límite máximo: {fmtBq(l.limite_bq_m2)} · {l.unidad}</p>
                {l.notas && <p className="text-xs text-gray-400 mt-0.5">{l.notas}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {l.updated_at ? `Actualizado ${new Date(l.updated_at).toLocaleDateString("es-CL")}` : ""}
                </span>
                {editing === l.id ? (
                  <button onClick={() => { setEditing(null); setEditForm({}); }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    <X size={16} />
                  </button>
                ) : (
                  <button onClick={() => { setEditing(l.id); setEditForm({ limite_bq_m2: l.limite_bq_m2, pct_registro: l.pct_registro, pct_investigacion: l.pct_investigacion, pct_intervencion: l.pct_intervencion, notas: l.notas }); setMsg(""); }}
                    className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50">
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            </div>

            {editing === l.id ? (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Límite Bq/m²</label>
                    <input type="number" value={editForm.limite_bq_m2 ?? l.limite_bq_m2}
                      onChange={e => setEditForm(f => ({ ...f, limite_bq_m2: Number(e.target.value) }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">% Registro</label>
                    <input type="number" value={editForm.pct_registro ?? l.pct_registro}
                      onChange={e => setEditForm(f => ({ ...f, pct_registro: Number(e.target.value) }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">% Investigación</label>
                    <input type="number" value={editForm.pct_investigacion ?? l.pct_investigacion}
                      onChange={e => setEditForm(f => ({ ...f, pct_investigacion: Number(e.target.value) }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">% Intervención</label>
                    <input type="number" value={editForm.pct_intervencion ?? l.pct_intervencion}
                      onChange={e => setEditForm(f => ({ ...f, pct_intervencion: Number(e.target.value) }))}
                      className={inp} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notas</label>
                  <input value={editForm.notas ?? l.notas ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))}
                    className={inp} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleUpdate(l.id)} disabled={saving}
                    className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                    <Save size={14} /> {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button onClick={() => { setEditing(null); setEditForm({}); }}
                    className="flex items-center gap-1 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    <X size={14} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {thresholdLevels(l).map(t => (
                    <div key={t.label} className={`rounded-lg border p-3 ${t.color}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide">{t.label}</span>
                        <span className="text-xs font-bold">{t.pct}%</span>
                      </div>
                      <p className="text-sm font-bold">{fmtBq(t.bq)}</p>
                      <p className="text-xs opacity-75">del límite máximo</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — DS 3/1985 MINSAL · IAEA GSR Part 3 · IAEA Safety Reports Series No. 65</p>
        <p className="text-xs text-blue-600">Los límites de contaminación superficial deben actualizarse según la normativa vigente y las recomendaciones del organismo competente (CCHEN/MINSAL).</p>
      </div>
    </div>
  );
}
