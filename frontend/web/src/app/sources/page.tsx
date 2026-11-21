"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Plus, Pencil, Trash2, X, Save, Search, AlertTriangle,
  CheckCircle2, Clock, Package, RadioIcon, Shield, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Source {
  id: number;
  source_code: string;
  isotope: string;
  half_life_days: number;
  activity_bq_initial: number;
  activity_reference_date: string;
  category_iaea: number | null;
  manufacturer: string | null;
  serial_number: string | null;
  location: string | null;
  status: string;
  next_inventory_date: string | null;
  notes: string | null;
  updated_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_use:    { label: "En uso",        color: "bg-green-100 text-green-800" },
  stored:    { label: "Almacenada",    color: "bg-blue-100 text-blue-800" },
  borrowed:  { label: "Prestada",      color: "bg-amber-100 text-amber-800" },
  disposed:  { label: "Dados de baja", color: "bg-gray-100 text-gray-700" },
  lost:      { label: "Pérdida",       color: "bg-red-100 text-red-800" },
};

const IAEA_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Cat. 1 — Peligrosa",  color: "bg-red-100 text-red-800" },
  2: { label: "Cat. 2 — Alta",       color: "bg-orange-100 text-orange-800" },
  3: { label: "Cat. 3 — Media",      color: "bg-amber-100 text-amber-800" },
  4: { label: "Cat. 4 — Baja",       color: "bg-yellow-100 text-yellow-700" },
  5: { label: "Cat. 5 — Mínima",     color: "bg-green-100 text-green-700" },
};

function calcActivityNow(bqInitial: number, halfLifeDays: number, refDate: string): number {
  const days = (Date.now() - new Date(refDate).getTime()) / 86400000;
  return bqInitial * Math.pow(0.5, days / halfLifeDays);
}

function formatBq(bq: number): string {
  if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
  if (bq >= 1e9)  return `${(bq / 1e9).toFixed(2)} GBq`;
  if (bq >= 1e6)  return `${(bq / 1e6).toFixed(2)} MBq`;
  if (bq >= 1e3)  return `${(bq / 1e3).toFixed(2)} kBq`;
  return `${bq.toFixed(0)} Bq`;
}

function inventoryStatus(d: string | null): "ok" | "due" | "overdue" {
  if (!d) return "due";
  const diff = (new Date(d).getTime() - Date.now()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff < 30) return "due";
  return "ok";
}

const DEFAULT_FORM = {
  source_code: "", isotope: "", half_life_days: "", activity_bq_initial: "",
  activity_reference_date: new Date().toISOString().slice(0, 10),
  category_iaea: "", manufacturer: "", serial_number: "", location: "",
  status: "in_use", next_inventory_date: "", notes: "",
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [form, setForm] = useState<typeof DEFAULT_FORM>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...DEFAULT_FORM }); setError(null); setShowModal(true); };
  const openEdit = (s: Source) => {
    setEditing(s);
    setForm({
      source_code: s.source_code,
      isotope: s.isotope,
      half_life_days: String(s.half_life_days),
      activity_bq_initial: String(s.activity_bq_initial),
      activity_reference_date: s.activity_reference_date.slice(0, 10),
      category_iaea: s.category_iaea != null ? String(s.category_iaea) : "",
      manufacturer: s.manufacturer ?? "",
      serial_number: s.serial_number ?? "",
      location: s.location ?? "",
      status: s.status,
      next_inventory_date: s.next_inventory_date?.slice(0, 10) ?? "",
      notes: s.notes ?? "",
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        source_code: form.source_code.trim(),
        isotope: form.isotope.trim(),
        half_life_days: parseFloat(form.half_life_days),
        activity_bq_initial: parseFloat(form.activity_bq_initial),
        activity_reference_date: form.activity_reference_date,
        category_iaea: form.category_iaea ? parseInt(form.category_iaea) : null,
        manufacturer: form.manufacturer || null,
        serial_number: form.serial_number || null,
        location: form.location || null,
        status: form.status,
        next_inventory_date: form.next_inventory_date || null,
        notes: form.notes || null,
      };
      const res = await fetch("/api/sources" + (editing ? "" : ""), {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error"); }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const handleDelete = async (s: Source) => {
    if (!confirm(`¿Eliminar fuente ${s.source_code} (${s.isotope})?`)) return;
    await fetch(`/api/sources?id=${s.id}`, { method: "DELETE" });
    load();
  };

  const filtered = sources.filter(s => {
    const matchSearch = !search || [s.source_code, s.isotope, s.manufacturer, s.serial_number, s.location]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: sources.length,
    in_use: sources.filter(s => s.status === "in_use").length,
    overdue: sources.filter(s => inventoryStatus(s.next_inventory_date) === "overdue").length,
    cat1_2: sources.filter(s => s.category_iaea != null && s.category_iaea <= 2).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventario de Fuentes Radiactivas</h1>
            <p className="text-sm text-muted-foreground">NS-04 CCHEN · DS 3/1985 MINSAL</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 text-sm font-medium">
            <Plus className="h-4 w-4" /> Nueva Fuente
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total fuentes", value: counts.total, icon: Package, color: "text-blue-500" },
          { label: "En uso", value: counts.in_use, icon: RadioIcon, color: "text-green-500" },
          { label: "Inventario vencido", value: counts.overdue, icon: AlertTriangle, color: counts.overdue > 0 ? "text-red-500" : "text-muted-foreground" },
          { label: "Cat. 1-2 (alta peligrosidad)", value: counts.cat1_2, icon: Shield, color: counts.cat1_2 > 0 ? "text-orange-500" : "text-muted-foreground" },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <k.icon className={cn("h-8 w-8", k.color)} />
            <div>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, isótopo, ubicación…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No se encontraron fuentes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Isótopo</th>
                  <th className="px-4 py-3 text-left">Actividad actual</th>
                  <th className="px-4 py-3 text-left">Cat. IAEA</th>
                  <th className="px-4 py-3 text-left">Ubicación</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Próx. inventario</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(s => {
                  const actNow = calcActivityNow(s.activity_bq_initial, s.half_life_days, s.activity_reference_date);
                  const invSt = inventoryStatus(s.next_inventory_date);
                  const statusCfg = STATUS_CONFIG[s.status] ?? { label: s.status, color: "bg-gray-100 text-gray-700" };
                  const iaeaCfg = s.category_iaea != null ? IAEA_CONFIG[s.category_iaea] : null;
                  return (
                    <tr key={s.id} className={cn("hover:bg-muted/30", invSt === "overdue" && "bg-red-50/50")}>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">{s.source_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">{s.isotope}</span>
                        {s.manufacturer && <span className="block text-xs text-muted-foreground">{s.manufacturer}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">{formatBq(actNow)}</span>
                        <span className="block text-xs text-muted-foreground">Inicial: {formatBq(s.activity_bq_initial)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {iaeaCfg ? (
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", iaeaCfg.color)}>{iaeaCfg.label}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.location ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusCfg.color)}>{statusCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.next_inventory_date ? (
                          <span className={cn("flex items-center gap-1 text-xs",
                            invSt === "overdue" ? "text-red-600 font-semibold" :
                            invSt === "due" ? "text-amber-600" : "text-green-700")}>
                            {invSt === "overdue" ? <AlertTriangle className="h-3 w-3" /> :
                             invSt === "due" ? <Clock className="h-3 w-3" /> :
                             <CheckCircle2 className="h-3 w-3" />}
                            {new Date(s.next_inventory_date).toLocaleDateString("es-CL")}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(s)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background">
              <h2 className="text-lg font-semibold">{editing ? "Editar Fuente" : "Nueva Fuente Radiactiva"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Código fuente *</label>
                  <input required value={form.source_code} onChange={e => setForm(f => ({ ...f, source_code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="FT-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Isótopo *</label>
                  <input required value={form.isotope} onChange={e => setForm(f => ({ ...f, isotope: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Co-57, Tc-99m…" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vida media (días) *</label>
                  <input required type="number" step="any" min="0" value={form.half_life_days}
                    onChange={e => setForm(f => ({ ...f, half_life_days: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="271.74" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Actividad inicial (Bq) *</label>
                  <input required type="number" step="any" min="0" value={form.activity_bq_initial}
                    onChange={e => setForm(f => ({ ...f, activity_bq_initial: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="3.7e10" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha referencia actividad *</label>
                  <input required type="date" value={form.activity_reference_date}
                    onChange={e => setForm(f => ({ ...f, activity_reference_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Categoría IAEA</label>
                  <select value={form.category_iaea} onChange={e => setForm(f => ({ ...f, category_iaea: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                    <option value="">— Sin categoría —</option>
                    {[1,2,3,4,5].map(c => <option key={c} value={c}>{IAEA_CONFIG[c].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fabricante</label>
                  <input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° Serie</label>
                  <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ubicación</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Próx. inventario</label>
                  <input type="date" value={form.next_inventory_date} onChange={e => setForm(f => ({ ...f, next_inventory_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
              </div>

              {/* Activity preview */}
              {form.activity_bq_initial && form.half_life_days && form.activity_reference_date && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <span className="font-medium">Actividad actual estimada: </span>
                  <span className="font-mono text-yellow-700">
                    {formatBq(calcActivityNow(parseFloat(form.activity_bq_initial), parseFloat(form.half_life_days), form.activity_reference_date))}
                  </span>
                  <span className="text-muted-foreground ml-2">(calculado por decaimiento radiactivo)</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 text-sm font-medium disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar fuente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
