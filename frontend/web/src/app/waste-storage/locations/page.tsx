"use client";


import { useEffect, useState } from "react";
import { RefreshCw, MapPin, Plus, Pencil, Check, X, Eye, EyeOff } from "lucide-react";

interface Location { id: number; name: string; description: string | null; capacity: number | null; sort_order: number; active: boolean; current_count: number; }

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300";

export default function WasteStorageLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCap, setNewCap] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCap, setEditCap] = useState("");

  const fetchData = (all = showAll) => {
    setLoading(true);
    fetch(`/api/waste-storage/locations${all ? "?all=1" : ""}`)
      .then(r => r.json())
      .then(d => setLocations(d.rows ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const handleAdd = async () => {
    if (!newName.trim()) { toast("El nombre es obligatorio."); return; }
    setAdding(true);
    const r = await fetch("/api/waste-storage/locations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, capacity: newCap ? Number(newCap) : null }),
    });
    setAdding(false);
    if (r.ok) { fetchData(); setNewName(""); setNewDesc(""); setNewCap(""); toast("Ubicación creada."); }
    else { const e = await r.json(); toast(e.error || "Error."); }
  };

  const startEdit = (l: Location) => { setEditId(l.id); setEditName(l.name); setEditDesc(l.description ?? ""); setEditCap(l.capacity != null ? String(l.capacity) : ""); };
  const cancelEdit = () => setEditId(null);

  const handleEdit = async (id: number) => {
    const r = await fetch("/api/waste-storage/locations", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim(), description: editDesc.trim() || null, capacity: editCap ? Number(editCap) : null }),
    });
    if (r.ok) { fetchData(); cancelEdit(); toast("Actualizada."); }
    else { const e = await r.json(); toast(e.error || "Error."); }
  };

  const toggleActive = async (id: number, active: boolean) => {
    const r = await fetch("/api/waste-storage/locations", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    if (r.ok) { fetchData(); toast(!active ? "Ubicación activada." : "Ubicación desactivada."); }
    else toast("Error al actualizar estado.");
  };

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100"><MapPin className="h-6 w-6 text-teal-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ubicaciones de Almacenamiento</h1>
              <p className="text-sm text-muted-foreground">Salas, estantes y contenedores de almacenamiento temporal</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {msg && <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-sm text-teal-700">{msg}</div>}

        {/* Add form */}
        <div className="bg-background rounded-xl border border-border shadow-sm p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-green-500" /> Nueva ubicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
              <input className={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Contenedor A" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
              <input className={inp} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción opcional" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capacidad (unidades)</label>
              <input className={inp} type="number" min="1" value={newCap} onChange={e => setNewCap(e.target.value)} placeholder="Sin límite" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={adding} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
            {adding ? "Creando…" : "Crear ubicación"}
          </button>
        </div>

        {/* List */}
        <div className="bg-background rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">{locations.length} ubicacion{locations.length !== 1 ? "es" : ""}</span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={e => { setShowAll(e.target.checked); fetchData(e.target.checked); }} className="rounded" />
              Mostrar inactivas
            </label>
          </div>
          {loading && locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando…</div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin ubicaciones registradas.</div>
          ) : (
            <div className="space-y-2">
              {locations.map(l => (
                <div key={l.id} className={`rounded-lg border p-4 ${l.active ? "border-border bg-background" : "border-border/50 bg-muted/50 opacity-60"}`}>
                  {editId === l.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input className={inp} value={editName} onChange={e => setEditName(e.target.value)} />
                      <input className={inp} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción" />
                      <input className={inp} type="number" value={editCap} onChange={e => setEditCap(e.target.value)} placeholder="Capacidad" />
                      <div className="flex gap-2 sm:col-span-3">
                        <button onClick={() => handleEdit(l.id)} className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm"><Check className="h-4 w-4" /> Guardar</button>
                        <button onClick={cancelEdit} className="text-muted-foreground hover:text-muted-foreground flex items-center gap-1 text-sm"><X className="h-4 w-4" /> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{l.name}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{l.current_count} activos</span>
                          {l.capacity && <span className="text-xs text-muted-foreground">cap. {l.capacity}</span>}
                        </div>
                        {l.description && <div className="text-sm text-muted-foreground mt-0.5">{l.description}</div>}
                      </div>
                      <div className="flex gap-2 items-center">
                        <button onClick={() => startEdit(l)} className="text-blue-500 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => toggleActive(l.id, l.active)} className={l.active ? "text-muted-foreground hover:text-orange-500" : "text-muted-foreground hover:text-green-500"} title={l.active ? "Desactivar" : "Activar"}>
                          {l.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regulatory footer */}
        <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-muted-foreground mb-1">Marco normativo aplicable</p>
          <p>DS N°133/1984 — Requisitos de las instalaciones de almacenamiento temporal de residuos radiactivos. DS N°12/2010 MINSAL — Condiciones físicas de los contenedores de almacenamiento. IAEA GSG-1 — Gestión de residuos radiactivos de baja actividad. CCHEN ORD sobre requisitos mínimos de las instalaciones de almacenamiento.</p>
        </div>
      </div>
    </div>
  );
}
