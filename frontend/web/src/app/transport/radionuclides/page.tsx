"use client";
import { useEffect, useState } from "react";
import { Plus, Atom, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

interface Radionuclide {
  code: string;
  label: string;
  activityLabel: string;
  allowsMultiple: boolean;
}

export default function TransportRadionuclidesPage() {
  const [list, setList] = useState<Radionuclide[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // new form state
  const [form, setForm] = useState({ code: "", label: "", activityLabel: "", allowsMultiple: false });
  // edit state
  const [editForm, setEditForm] = useState<Partial<Radionuclide>>({});

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch("/api/transport/radionuclides");
      const data = await res.json();
      setList(data.radionuclides ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleCreate() {
    if (!form.code || !form.label) { setMsg("Código y nombre son requeridos"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/transport/radionuclides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.code, label: form.label, activityLabel: form.activityLabel, allowsMultiple: form.allowsMultiple }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg("✓ Radionúclido creado");
      setForm({ code: "", label: "", activityLabel: "", allowsMultiple: false });
      setShowForm(false);
      fetchList();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(code: string) {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/transport/radionuclides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg("✓ Actualizado");
      setEditing(null);
      fetchList();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Radionúclidos</h1>
          <p className="text-sm text-gray-500 mt-1">Radionúclidos autorizados para transporte — RESESQ / DS 3/1985 MINSAL</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus size={16} /> Nuevo radionúclido
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total radionúclidos</p>
          <p className="text-2xl font-bold text-gray-900">{list.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Permiten múltiples despachos</p>
          <p className="text-2xl font-bold text-indigo-600">{list.filter(r => r.allowsMultiple).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Solo despacho único</p>
          <p className="text-2xl font-bold text-gray-700">{list.filter(r => !r.allowsMultiple).length}</p>
        </div>
      </div>

      {/* New form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-indigo-800">Agregar radionúclido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Código *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="TC99M" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nombre *</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Tecnecio-99m" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Etiqueta de actividad</label>
              <input value={form.activityLabel} onChange={e => setForm(f => ({ ...f, activityLabel: e.target.value }))}
                placeholder="Actividad transportada (mCi)" className={inp} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="allowsMultiple" checked={form.allowsMultiple}
                onChange={e => setForm(f => ({ ...f, allowsMultiple: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600" />
              <label htmlFor="allowsMultiple" className="text-sm text-gray-700">Permite múltiples despachos</label>
            </div>
          </div>
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-white border border-gray-200 px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Sin radionúclidos registrados</div>
        ) : list.map(rn => (
          <div key={rn.code}>
            <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition"
              onClick={() => setExpanded(expanded === rn.code ? null : rn.code)}>
              <div className="bg-indigo-100 rounded-full p-2">
                <Atom size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{rn.label}</p>
                <p className="text-xs text-gray-500">Código: {rn.code} · {rn.allowsMultiple ? "Múltiples despachos" : "Despacho único"}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rn.allowsMultiple ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {rn.allowsMultiple ? "múltiple" : "único"}
              </span>
              {expanded === rn.code ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>

            {expanded === rn.code && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                {editing === rn.code ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                        <input value={editForm.label ?? rn.label}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          className={inp} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Etiqueta de actividad</label>
                        <input value={editForm.activityLabel ?? rn.activityLabel}
                          onChange={e => setEditForm(f => ({ ...f, activityLabel: e.target.value }))}
                          className={inp} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id={`em-${rn.code}`}
                        checked={editForm.allowsMultiple ?? rn.allowsMultiple}
                        onChange={e => setEditForm(f => ({ ...f, allowsMultiple: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600" />
                      <label htmlFor={`em-${rn.code}`} className="text-sm text-gray-700">Permite múltiples despachos</label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(rn.code)} disabled={saving}
                        className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                        <Check size={14} /> Guardar
                      </button>
                      <button onClick={() => { setEditing(null); setEditForm({}); }}
                        className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                    {msg && <p className="text-xs text-green-700">{msg}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500 text-xs">Etiqueta actividad</span><p className="font-medium">{rn.activityLabel || "—"}</p></div>
                      <div><span className="text-gray-500 text-xs">Despachos</span><p className="font-medium">{rn.allowsMultiple ? "Múltiples permitidos" : "Solo despacho único"}</p></div>
                    </div>
                    <button onClick={() => { setEditing(rn.code); setEditForm({ label: rn.label, activityLabel: rn.activityLabel, allowsMultiple: rn.allowsMultiple }); setMsg(""); }}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-2">
                      <Pencil size={12} /> Editar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — RESESQ / DS 3/1985 MINSAL / IAEA SSR-6</p>
        <p className="text-xs text-blue-600">Este catálogo define los radionúclidos autorizados para transporte en el sistema. Administrado por usuario super_admin o admin.</p>
      </div>
    </div>
  );
}
