"use client";


import { useEffect, useState } from "react";
import { RefreshCw, Shield, Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface OPR { id: number; name: string; }

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";

export default function TransportOPRsPage() {
  const [oprs, setOprs] = useState<OPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const fetchData = (q = search) => {
    setLoading(true);
    const url = q ? `/api/transport/oprs?search=${encodeURIComponent(q)}` : "/api/transport/oprs";
    fetch(url).then(r => r.json()).then(d => setOprs(d.oprs ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const handleAdd = async () => {
    if (!newName.trim()) { toast("El nombre es obligatorio."); return; }
    setAdding(true);
    const r = await fetch("/api/transport/oprs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setAdding(false);
    if (r.ok) { fetchData(); setNewName(""); toast("OPR registrado."); }
    else { const e = await r.json(); toast(e.error || "Error al registrar."); }
  };

  const startEdit = (o: OPR) => { setEditId(o.id); setEditName(o.name); };
  const cancelEdit = () => { setEditId(null); setEditName(""); };

  const handleEdit = async (id: number) => {
    const r = await fetch("/api/transport/oprs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim() }),
    });
    if (r.ok) { fetchData(); cancelEdit(); toast("OPR actualizado."); }
    else { const e = await r.json(); toast(e.error || "Error al actualizar."); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar OPR "${name}"?`)) return;
    const r = await fetch(`/api/transport/oprs?id=${id}`, { method: "DELETE" });
    if (r.ok) { fetchData(); toast("OPR eliminado."); }
    else { const e = await r.json(); toast(e.error || "Error al eliminar."); }
  };

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><Shield className="h-6 w-6 text-purple-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">OPRs de Transporte Radiactivo</h1>
              <p className="text-sm text-muted-foreground">Oficiales de Protección Radiológica autorizados para transporte</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-muted-foreground hover:text-muted-foreground ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {msg && <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">{msg}</div>}

        {/* Info banner */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs text-purple-700">
          <strong>OPR (Oficial de Protección Radiológica):</strong> Persona calificada responsable de supervisar la protección radiológica durante el transporte de materiales radiactivos, según DS 12/2010 y CCHEN.
        </div>

        {/* Add form */}
        <div className="bg-background rounded-xl border border-border shadow-sm p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-green-500" /> Nuevo OPR</h2>
          <div className="flex gap-3">
            <input className={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo del OPR" onKeyDown={e => e.key === "Enter" && handleAdd()} />
            <button onClick={handleAdd} disabled={adding} className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
              {adding ? "…" : "Registrar"}
            </button>
          </div>
        </div>

        {/* Search & list */}
        <div className="bg-background rounded-xl border border-border shadow-sm p-5">
          <div className="mb-4">
            <input className={inp} value={search} onChange={e => { setSearch(e.target.value); fetchData(e.target.value); }} placeholder="Buscar OPR por nombre…" />
          </div>
          <div className="text-xs text-muted-foreground mb-2">{oprs.length} OPR{oprs.length !== 1 ? "s" : ""} registrado{oprs.length !== 1 ? "s" : ""}</div>
          {loading && oprs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando…</div>
          ) : oprs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin OPRs registrados.</div>
          ) : (
            <div className="space-y-1">
              {oprs.map(o => (
                <div key={o.id} className="flex items-center justify-between border-b border-border/50 pb-1 last:border-0">
                  <div className="flex-1 mr-4">
                    {editId === o.id
                      ? <input className={inp} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEdit(o.id)} />
                      : <span className="text-sm font-medium text-foreground">{o.name}</span>
                    }
                  </div>
                  <div className="flex gap-2">
                    {editId === o.id ? (
                      <>
                        <button onClick={() => handleEdit(o.id)} className="text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                        <button onClick={cancelEdit} className="text-muted-foreground hover:text-muted-foreground"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(o)} className="text-blue-500 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(o.id, o.name)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regulatory footer */}
        <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-muted-foreground mb-1">Marco normativo aplicable</p>
          <p>DS N°12/2010 MINSAL — Artículo 32: requisitos del Oficial de Protección Radiológica para transporte. IAEA Safety Standards SSR-6 (Rev.1) — Responsabilidades de los OPRs en operaciones de transporte. CCHEN ORD — Habilitación y registro de OPRs para transporte de materiales radiactivos.</p>
        </div>
      </div>
    </div>
  );
}
