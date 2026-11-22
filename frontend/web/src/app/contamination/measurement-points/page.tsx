"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { RefreshCw, Plus, MapPin, ToggleLeft, ToggleRight, Edit2, Check, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Categoria = "LABORATORIO" | "SALA_PACIENTES" | "OTRO";

interface MeasurementPoint {
  id: number; categoria: Categoria; nombre: string;
  orden: number; notas: string | null; activo: boolean;
}

const CAT_LABELS: Record<Categoria, string> = {
  LABORATORIO:    "Laboratorio",
  SALA_PACIENTES: "Sala de Pacientes",
  OTRO:           "Otro",
};
const CATEGORIES: Categoria[] = ["LABORATORIO", "SALA_PACIENTES", "OTRO"];
const CAT_COLOR: Record<Categoria, string> = {
  LABORATORIO:    "bg-teal-100 text-teal-700",
  SALA_PACIENTES: "bg-blue-100 text-blue-700",
  OTRO:           "bg-gray-100 text-gray-700",
};
const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MeasurementPointsPage() {
  const [rows, setRows] = useState<MeasurementPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [filterCat, setFilterCat] = useState<Categoria | "">("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<MeasurementPoint>>({});
  const [newForm, setNewForm] = useState({ categoria: "LABORATORIO" as Categoria, nombre: "", orden: "", notas: "" });
  const [newOpen, setNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/contamination/measurement-points?activo=${showInactive ? "false" : "true"}`)
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [showInactive]); // eslint-disable-line

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleToggleActive = async (p: MeasurementPoint) => {
    await fetch("/api/contamination/measurement-points", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    });
    fetchData();
    toast(p.activo ? "Punto desactivado." : "Punto activado.");
  };

  const handleEditSave = async () => {
    if (!editId) return;
    setSaving(true);
    const r = await fetch("/api/contamination/measurement-points", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, ...editForm }),
    });
    setSaving(false);
    if (r.ok) { setEditId(null); fetchData(); toast("Punto actualizado."); }
    else { const e = await r.json(); toast(e.error || "Error al guardar."); }
  };

  const handleNew = async () => {
    if (!newForm.nombre.trim()) return;
    setSaving(true);
    const r = await fetch("/api/contamination/measurement-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: newForm.categoria,
        nombre: newForm.nombre.trim(),
        orden: newForm.orden ? Number(newForm.orden) : undefined,
        notas: newForm.notas || null,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setNewForm({ categoria: "LABORATORIO", nombre: "", orden: "", notas: "" });
      setNewOpen(false);
      fetchData();
      toast("Punto creado.");
    } else {
      const e = await r.json(); toast(e.error || "Error al crear.");
    }
  };

  const displayed = rows.filter(p =>
    (!filterCat || p.categoria === filterCat) &&
    (showInactive || p.activo)
  );

  const grouped = CATEGORIES.reduce<Record<Categoria, MeasurementPoint[]>>((acc, cat) => {
    acc[cat] = displayed.filter(p => p.categoria === cat);
    return acc;
  }, { LABORATORIO: [], SALA_PACIENTES: [], OTRO: [] });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <MapPin className="h-6 w-6 text-teal-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Puntos de Medición de Contaminación</h1>
              <p className="text-sm text-gray-500">Lista editable de puntos de monitoreo — laboratorio y sala de pacientes MN</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setNewOpen(v => !v)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-3 py-1.5 rounded-lg"
            >
              <Plus className="h-4 w-4" /> Nuevo punto
            </button>
          </div>
        </div>

        {msg && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-sm text-teal-700">{msg}</div>
        )}

        {/* New form */}
        {newOpen && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">Nuevo Punto de Medición</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select className={inp} value={newForm.categoria} onChange={e => setNewForm(f => ({ ...f, categoria: e.target.value as Categoria }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre del punto *</label>
                <input className={inp} value={newForm.nombre} onChange={e => setNewForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Mesa central lab" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Orden (opcional)</label>
                <input className={inp} type="number" value={newForm.orden} onChange={e => setNewForm(f => ({ ...f, orden: e.target.value }))} placeholder="1, 2, 3…" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notas</label>
              <input className={inp} value={newForm.notas} onChange={e => setNewForm(f => ({ ...f, notas: e.target.value }))} placeholder="Descripción opcional" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleNew}
                disabled={saving || !newForm.nombre.trim()}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={() => setNewOpen(false)} className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1.5">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setFilterCat("")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filterCat ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
          >
            Todas ({displayed.length})
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(fc => fc === c ? "" : c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterCat === c ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
            >
              {CAT_LABELS[c]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => setShowInactive(v => !v)} className="flex items-center gap-1.5">
              {showInactive ? <ToggleRight className="h-4 w-4 text-teal-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
              Mostrar inactivos
            </button>
          </div>
        </div>

        {/* Table by category */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : (
          <>
            {(filterCat ? [filterCat] : CATEGORIES).map(cat => {
              const pts = grouped[cat];
              if (pts.length === 0 && !filterCat) return null;
              return (
                <div key={cat} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[cat]}`}>{CAT_LABELS[cat]}</span>
                    <span className="text-xs text-gray-400">{pts.length} puntos</span>
                  </div>
                  {pts.length === 0 ? (
                    <div className="px-5 py-6 text-xs text-gray-400 text-center">Sin puntos registrados en esta categoría.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                          <th className="py-2 px-5 text-left w-12">Ord.</th>
                          <th className="py-2 px-5 text-left">Nombre</th>
                          <th className="py-2 px-5 text-left hidden sm:table-cell">Notas</th>
                          <th className="py-2 px-5 text-left">Estado</th>
                          <th className="py-2 px-5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pts.map(p => (
                          <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!p.activo ? "opacity-50" : ""}`}>
                            {editId === p.id ? (
                              <>
                                <td className="py-2 px-5">
                                  <input className={inp + " w-16"} type="number" value={editForm.orden ?? p.orden} onChange={e => setEditForm(f => ({ ...f, orden: Number(e.target.value) }))} />
                                </td>
                                <td className="py-2 px-5">
                                  <input className={inp} value={editForm.nombre ?? p.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
                                </td>
                                <td className="py-2 px-5 hidden sm:table-cell">
                                  <input className={inp} value={editForm.notas ?? p.notas ?? ""} onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} />
                                </td>
                                <td className="py-2 px-5" />
                                <td className="py-2 px-5 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={handleEditSave} disabled={saving} className="text-teal-600 hover:text-teal-800">
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 px-5 text-gray-400">{p.orden}</td>
                                <td className="py-2 px-5 font-medium text-gray-800">{p.nombre}</td>
                                <td className="py-2 px-5 text-gray-400 hidden sm:table-cell">{p.notas || "—"}</td>
                                <td className="py-2 px-5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                    {p.activo ? "Activo" : "Inactivo"}
                                  </span>
                                </td>
                                <td className="py-2 px-5 text-right">
                                  <div className="flex justify-end gap-3">
                                    <button
                                      onClick={() => { setEditId(p.id); setEditForm({ nombre: p.nombre, orden: p.orden, notas: p.notas ?? "" }); }}
                                      className="text-gray-400 hover:text-teal-600"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleToggleActive(p)} className="text-gray-400 hover:text-gray-600">
                                      {p.activo ? <ToggleRight className="h-4 w-4 text-teal-500" /> : <ToggleLeft className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>
            Decreto Supremo N°3/1985 MINSAL Art. 60-64 — Monitoreo de contaminación superficial en instalaciones radiactivas.
            DS N°594/1999 MINSAL — Límites de contaminación superficial en lugares de trabajo.
            IAEA Safety Standards Series GSG-7 — Ocupational radiation protection.
            CCHEN ORD. sobre procedimientos de monitoreo en áreas controladas de Medicina Nuclear.
          </p>
        </div>
      </div>
    </div>
  );
}
