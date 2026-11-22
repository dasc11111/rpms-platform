"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Truck, Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface Driver { id: number; name: string; company: string | null; }

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

export default function TransportDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const fetchData = (q = search) => {
    setLoading(true);
    const url = q ? `/api/transport/drivers?search=${encodeURIComponent(q)}` : "/api/transport/drivers";
    fetch(url).then(r => r.json()).then(d => setDrivers(d.drivers ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const handleAdd = async () => {
    if (!newName.trim()) { toast("El nombre es obligatorio."); return; }
    setAdding(true);
    const r = await fetch("/api/transport/drivers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), company: newCompany.trim() || null }),
    });
    setAdding(false);
    if (r.ok) { fetchData(); setNewName(""); setNewCompany(""); toast("Conductor registrado."); }
    else { const e = await r.json(); toast(e.error || "Error al registrar."); }
  };

  const startEdit = (d: Driver) => { setEditId(d.id); setEditName(d.name); setEditCompany(d.company ?? ""); };
  const cancelEdit = () => { setEditId(null); setEditName(""); setEditCompany(""); };

  const handleEdit = async (id: number) => {
    const r = await fetch("/api/transport/drivers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim(), company: editCompany.trim() || null }),
    });
    if (r.ok) { fetchData(); cancelEdit(); toast("Conductor actualizado."); }
    else { const e = await r.json(); toast(e.error || "Error al actualizar."); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar conductor "${name}"?`)) return;
    const r = await fetch(`/api/transport/drivers?id=${id}`, { method: "DELETE" });
    if (r.ok) { fetchData(); toast("Conductor eliminado."); }
    else { const e = await r.json(); toast(e.error || "Error al eliminar."); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Truck className="h-6 w-6 text-blue-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Conductores de Transporte Radiactivo</h1>
              <p className="text-sm text-gray-500">Registro de conductores autorizados DS 12/2010 · IAEA SSR-6</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 hover:text-gray-600 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {msg && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>}

        {/* Add form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-green-500" /> Nuevo conductor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
              <input className={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Empresa / Transportista</label>
              <input className={inp} value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Empresa (opcional)" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={adding} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
            {adding ? "Registrando…" : "Registrar conductor"}
          </button>
        </div>

        {/* Search & list */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="mb-4">
            <input className={inp} value={search} onChange={e => { setSearch(e.target.value); fetchData(e.target.value); }} placeholder="Buscar por nombre…" />
          </div>
          {loading && drivers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando…</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Sin conductores registrados.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b"><th className="text-left pb-2">Nombre</th><th className="text-left pb-2">Empresa</th><th className="text-right pb-2">Acciones</th></tr></thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-4">
                      {editId === d.id ? <input className={inp} value={editName} onChange={e => setEditName(e.target.value)} /> : <span className="font-medium text-gray-800">{d.name}</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {editId === d.id ? <input className={inp} value={editCompany} onChange={e => setEditCompany(e.target.value)} placeholder="Empresa" /> : (d.company || "—")}
                    </td>
                    <td className="py-2 text-right">
                      {editId === d.id ? (
                        <span className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(d.id)} className="text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                        </span>
                      ) : (
                        <span className="flex justify-end gap-2">
                          <button onClick={() => startEdit(d)} className="text-blue-500 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(d.id, d.name)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>DS N°12/2010 MINSAL — Requisitos de idoneidad para conductores de vehículos que transporten material radiactivo. IAEA Safety Standards SSR-6 (Rev.1) — Calificación del personal de transporte. DS N°133/1984 — Reglamento de Seguridad Radiológica. CCHEN ORD sobre habilitación de conductores para transporte de materiales radiactivos.</p>
        </div>
      </div>
    </div>
  );
}
