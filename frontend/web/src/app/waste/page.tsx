"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, X, Edit2, Recycle, Radiation
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

// §55 — Gestión de Residuos Radiactivos
// DS 3/1985 Arts. 55–60 — clasificación, almacenamiento y disposición
// IAEA GSR Part 5 — principio 10 semividas (T10) para liberación

interface Waste {
  id: number;
  waste_code: string;
  description: string;
  waste_type: string;
  category: string;
  origin: string;
  radionuclide: string | null;
  half_life_hours: number | null;
  initial_activity_mbq: number | null;
  initial_date: string | null;
  current_activity_mbq: number | null;
  container: string | null;
  volume_liters: number | null;
  mass_kg: number | null;
  storage_location: string | null;
  clearance_level_mbq: number | null;
  clearance_date: string | null;
  disposal_method: string | null;
  disposal_date: string | null;
  disposal_entity: string | null;
  status: string;
  responsible: string | null;
  references_norm: string | null;
  notes: string | null;
  // computed
  half_lives_elapsed?: number;
  is_cleared_by_decay?: boolean;
  clearance_progress_pct?: number;
  hours_to_clearance?: number | null;
}

interface Stats {
  total: string; in_storage: string; cleared: string; disposed: string; liquid: string; solid: string;
}

const TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  liquid:   { label: "Líquido",  color: "text-blue-700",  bg: "bg-blue-100"  },
  solid:    { label: "Sólido",   color: "text-brown-700", bg: "bg-orange-100"},
  gaseous:  { label: "Gaseoso",  color: "text-foreground/80",  bg: "bg-muted"  },
  mixed:    { label: "Mixto",    color: "text-purple-700",bg: "bg-purple-100"},
};

const CAT_CFG: Record<string, { label: string; color: string }> = {
  very_low_level: { label: "MNR (Muy bajo)",    color: "text-green-700"  },
  low_level:      { label: "BNR (Bajo nivel)",  color: "text-yellow-700" },
  intermediate:   { label: "MNR (Intermedio)",  color: "text-orange-700" },
  high_level:     { label: "ANR (Alto nivel)",  color: "text-red-700"    },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  in_storage: { label: "En almacenamiento", color: "text-amber-700",  bg: "bg-amber-100",  icon: <Clock size={13} />        },
  cleared:    { label: "Liberado (decaído)",color: "text-green-700",  bg: "bg-green-100",  icon: <CheckCircle2 size={13} /> },
  disposed:   { label: "Dispuesto",         color: "text-blue-700",   bg: "bg-blue-100",   icon: <Recycle size={13} />      },
  pending:    { label: "Pendiente gestión", color: "text-red-700",    bg: "bg-red-100",    icon: <AlertTriangle size={13} />},
};

const DISPOSAL_CFG: Record<string, string> = {
  decay_in_storage: "Decaimiento y liberación",
  transfer_cchen:   "Transferencia CCHEN",
  sewer_release:    "Vertido a alcantarilla (DS 3/1985)",
  incineration:     "Incineración autorizada",
  other:            "Otro",
};

function fmtMbq(mbq: number | null | undefined): string {
  if (mbq === null || mbq === undefined) return "—";
  if (mbq < 0.001) return `${(mbq * 1000).toFixed(3)} kBq`;
  if (mbq < 1)     return `${(mbq * 1000).toFixed(1)} kBq`;
  return `${mbq.toFixed(2)} MBq`;
}

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24)  return `${h.toFixed(1)}h`;
  if (h < 720) return `${(h/24).toFixed(1)} días`;
  return `${(h/720).toFixed(1)} meses`;
}

function DecayBar({ pct, isCleared }: { pct: number; isCleared: boolean }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Decaimiento</span>
        <span className={isCleared ? "text-green-700 font-medium" : "text-muted-foreground"}>{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${isCleared ? "bg-green-500" : pct > 70 ? "bg-amber-400" : "bg-blue-400"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function WasteCard({ waste, onEdit, onDelete }: { waste: Waste; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const typeCfg = TYPE_CFG[waste.waste_type]  ?? TYPE_CFG.solid!;
  const st      = STATUS_CFG[waste.status]     ?? STATUS_CFG.in_storage!;
  const catCfg  = CAT_CFG[waste.category]      ?? CAT_CFG.low_level!;
  const isCleared = waste.is_cleared_by_decay ?? false;

  return (
    <div className={`bg-background rounded-lg border shadow-sm ${waste.status === "in_storage" && isCleared ? "border-green-300" : "border-border"}`}>
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        <div className={`mt-1 p-1.5 rounded-md ${typeCfg.bg} shrink-0`}>
          <Radiation size={14} className={typeCfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-muted-foreground">{waste.waste_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeCfg.bg} ${typeCfg.color}`}>{typeCfg.label}</span>
            <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.icon}{st.label}</span>
            <span className={`text-xs font-medium ${catCfg.color}`}>{catCfg.label}</span>
            {waste.radionuclide && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">{waste.radionuclide}</span>}
          </div>
          <p className="font-medium text-foreground truncate">{waste.description}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {waste.current_activity_mbq !== null && waste.current_activity_mbq !== undefined && (
              <span>Actividad actual: <span className="font-medium">{fmtMbq(waste.current_activity_mbq)}</span></span>
            )}
            {waste.half_lives_elapsed !== undefined && (
              <span>{waste.half_lives_elapsed.toFixed(1)} semividas transcurridas</span>
            )}
            {waste.hours_to_clearance !== null && waste.hours_to_clearance !== undefined && waste.hours_to_clearance > 0 && (
              <span className="text-amber-600">Liberación en: {fmtHours(waste.hours_to_clearance)}</span>
            )}
            {isCleared && waste.status === "in_storage" && (
              <span className="text-green-700 font-medium">✓ Listo para liberación</span>
            )}
          </div>
          {waste.clearance_progress_pct !== undefined && waste.status !== "disposed" && (
            <DecayBar pct={waste.clearance_progress_pct} isCleared={isCleared} />
          )}
        </div>
        {open ? <ChevronUp size={18} className="text-muted-foreground mt-1 shrink-0" />
               : <ChevronDown size={18} className="text-muted-foreground mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
            {waste.half_life_hours && <div><span className="font-medium">Semivida:</span> {fmtHours(waste.half_life_hours)}</div>}
            {waste.initial_activity_mbq && <div><span className="font-medium">Actividad inicial:</span> {fmtMbq(waste.initial_activity_mbq)}</div>}
            {waste.initial_date && <div><span className="font-medium">Fecha inicio:</span> {new Date(waste.initial_date).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</div>}
            {waste.clearance_level_mbq !== null && waste.clearance_level_mbq !== undefined && <div><span className="font-medium">Nivel liberación:</span> {fmtMbq(waste.clearance_level_mbq)}</div>}
            {waste.storage_location && <div><span className="font-medium">Almacén:</span> {waste.storage_location}</div>}
            {waste.container && <div><span className="font-medium">Contenedor:</span> {waste.container}</div>}
            {waste.volume_liters && <div><span className="font-medium">Volumen:</span> {waste.volume_liters}L</div>}
            {waste.responsible && <div><span className="font-medium">Responsable:</span> {waste.responsible}</div>}
          </div>

          {waste.disposal_method && (
            <div className="bg-blue-50 rounded p-3 text-xs">
              <p className="font-medium text-blue-800 mb-1">Disposición final</p>
              <p className="text-blue-700">{DISPOSAL_CFG[waste.disposal_method] ?? waste.disposal_method}</p>
              {waste.disposal_date && <p className="text-blue-600 mt-1">Fecha: {new Date(waste.disposal_date).toLocaleDateString("es-CL")}</p>}
              {waste.disposal_entity && <p className="text-blue-600">Entidad: {waste.disposal_entity}</p>}
            </div>
          )}

          {waste.references_norm && (
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-3 py-2">{waste.references_norm}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-muted hover:bg-muted rounded text-foreground/80">
              <Edit2 size={12} />Editar
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded text-red-600">
              <Trash2 size={12} />Dar de baja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY: Partial<Waste> = {
  waste_code: "", description: "", waste_type: "liquid", category: "low_level",
  origin: "nuclear_medicine", radionuclide: "", clearance_level_mbq: 0.1,
  status: "in_storage", responsible: "", references_norm: "", notes: ""
};

function WasteForm({ initial, onSave, onClose }: {
  initial: Partial<Waste>; onSave: (d: Partial<Waste>) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Waste>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Waste, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const lbl = "block text-xs font-medium text-muted-foreground mb-1";
  const inp = "w-full border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  // Known radionuclide half-lives (hours)
  const KNOWN_HL: Record<string, number> = {
    "F-18": 1.8295, "Tc-99m": 6.0167, "I-131": 192.5, "Ga-67": 78.26,
    "In-111": 67.31, "Lu-177": 161.5, "Y-90": 64.08, "Tl-201": 72.91,
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Radiation size={18} className="text-green-600" />
            {initial.id ? "Editar residuo" : "Nuevo residuo radiactivo"}
          </h2>
          <button onClick={onClose}><X size={20} className="text-muted-foreground hover:text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input required className={inp} value={form.waste_code ?? ""} onChange={e => set("waste_code", e.target.value)} placeholder="RW-TC99-2026-001" />
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status ?? "in_storage"} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descripción *</label>
            <textarea required className={inp} rows={2} value={form.description ?? ""} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tipo de residuo</label>
              <select className={inp} value={form.waste_type ?? "liquid"} onChange={e => set("waste_type", e.target.value)}>
                {Object.entries(TYPE_CFG).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Categoría</label>
              <select className={inp} value={form.category ?? "low_level"} onChange={e => set("category", e.target.value)}>
                {Object.entries(CAT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Radionucleido</label>
              <select className={inp} value={form.radionuclide ?? ""}
                onChange={e => {
                  const rn = e.target.value;
                  set("radionuclide", rn);
                  if (KNOWN_HL[rn]) set("half_life_hours", KNOWN_HL[rn]);
                }}>
                <option value="">Seleccionar…</option>
                {Object.keys(KNOWN_HL).map(rn => <option key={rn} value={rn}>{rn} (T½={fmtHours(KNOWN_HL[rn])})</option>)}
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Semivida (horas)</label>
              <input type="number" step="0.0001" className={inp} value={form.half_life_hours ?? ""} onChange={e => set("half_life_hours", parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Actividad inicial (MBq)</label>
              <input type="number" step="0.01" className={inp} value={form.initial_activity_mbq ?? ""} onChange={e => set("initial_activity_mbq", parseFloat(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Fecha/hora inicio</label>
              <input type="datetime-local" className={inp} value={form.initial_date ? new Date(form.initial_date).toISOString().slice(0,16) : ""} onChange={e => set("initial_date", new Date(e.target.value).toISOString())} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Nivel de liberación (MBq)</label>
              <input type="number" step="0.000001" className={inp} value={form.clearance_level_mbq ?? 0.1} onChange={e => set("clearance_level_mbq", parseFloat(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Volumen (L)</label>
              <input type="number" step="0.001" className={inp} value={form.volume_liters ?? ""} onChange={e => set("volume_liters", parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Contenedor</label>
              <input className={inp} value={form.container ?? ""} onChange={e => set("container", e.target.value)} placeholder="Contenedor plomado 5L" />
            </div>
            <div>
              <label className={lbl}>Ubicación almacenamiento</label>
              <input className={inp} value={form.storage_location ?? ""} onChange={e => set("storage_location", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Método disposición final</label>
              <select className={inp} value={form.disposal_method ?? ""} onChange={e => set("disposal_method", e.target.value)}>
                <option value="">Sin definir</option>
                {Object.entries(DISPOSAL_CFG).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fecha disposición</label>
              <input type="date" className={inp} value={form.disposal_date?.slice(0,10) ?? ""} onChange={e => set("disposal_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Entidad disposición / CCHEN</label>
            <input className={inp} value={form.disposal_entity ?? ""} onChange={e => set("disposal_entity", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Responsable</label>
            <input className={inp} value={form.responsible ?? ""} onChange={e => set("responsible", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Referencias normativas</label>
            <input className={inp} value={form.references_norm ?? ""} onChange={e => set("references_norm", e.target.value)} placeholder="DS 3/1985 Arts. 55-60; IAEA GSR Part 5..." />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-muted/50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WastePage() {
  const [wasteList, setWasteList] = useState<Waste[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterSt, setFilterSt]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Waste | null>(null);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterSt)   params.set("status", filterSt);
    try {
      const r = await fetch(`/api/waste?${params}`);
      const d = await r.json();
      setWasteList(d.waste ?? []);
      setStats(d.stats ?? null);
    } catch { setError("Error cargando residuos"); }
    setLoading(false);
  }, [filterType, filterSt]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: Partial<Waste>) {
    const r = await fetch("/api/waste", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) { const d = await r.json(); alert(d.error ?? "Error"); return; }
    setShowForm(false); setEditing(null); load();
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Dar de baja este residuo?")) return;
    await fetch(`/api/waste?id=${id}`, { method: "DELETE" });
    load();
  }

  const readyForClearance = wasteList.filter(w => w.is_cleared_by_decay && w.status === "in_storage").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radiation size={28} className="text-green-700" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Residuos Radiactivos</h1>
            <p className="text-sm text-muted-foreground">DS 3/1985 Arts. 55–60 — IAEA GSR Part 5 — Principio 10 semividas (T10)</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium"
        >
          <Plus size={16} />Nuevo residuo
        </button>
      </div>

      {readyForClearance > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm text-green-800">{readyForClearance} residuo{readyForClearance > 1 ? "s" : ""} ha{readyForClearance > 1 ? "n" : ""} alcanzado el nivel de liberación por decaimiento — verificar y actualizar estado.</p>
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="waste"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total",         value: stats.total,      color: "text-foreground"  },
            { label: "Almacenados",   value: stats.in_storage, color: "text-amber-700" },
            { label: "Liberados",     value: stats.cleared,    color: "text-green-700" },
            { label: "Dispuestos",    value: stats.disposed,   color: "text-blue-700"  },
          ].map(k => (
            <div key={k.label} className="bg-background border border-border rounded-lg p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_CFG).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        {(filterType || filterSt) && (
          <button onClick={() => { setFilterType(""); setFilterSt(""); }}
            className="text-xs text-muted-foreground hover:text-foreground/80 px-2">Limpiar filtros</button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando residuos…</div>
      ) : wasteList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Radiation size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay residuos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wasteList.map(w => (
            <WasteCard
              key={w.id}
              waste={w}
              onEdit={() => { setEditing(w); setShowForm(true); }}
              onDelete={() => handleDelete(w.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <WasteForm
          initial={editing ?? EMPTY}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
