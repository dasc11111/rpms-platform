"use client";


import { useEffect, useState, useCallback } from "react";
import {
  Warehouse, RefreshCw, ChevronDown, ChevronUp,
  FileText, Pencil, Save, X, Plus, Trash2,
  Clock, TrendingDown, CheckCircle, AlertTriangle,
  MapPin, Package, Activity, Calendar,
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

// ── Types ──────────────────────────────────────────────────────────────────

interface StorageLocation {
  id: number;
  name: string;
  description?: string | null;
  capacity?: number | null;
  sort_order?: number;
  active: boolean;
  current_count?: number;
}

interface InventoryItem {
  id: number;
  label_number: string;
  radionuclide_code?: string | null;
  waste_type?: string | null;
  entry_date?: string | null;
  generation_date?: string | null;
  service?: string | null;
  sala?: string | null;
  status: string;
  storage_location_id?: number | null;
  location_name?: string | null;
  elapsed_days?: number | null;
  half_lives_elapsed?: number | null;
  actividad_actual?: number | null;
  unidad_actividad?: string | null;
  days_until_release?: number | null;
  is_release_eligible?: boolean;
  dispensa_estado?: string | null;
  fecha_estimada_liberacion?: string | null;
}

interface DashData {
  totales: {
    totalEnAlmacenamiento: number;
    liberablesAhora: number;
    tiempoPromedioAlmacenamientoDias: number;
    proximos30Dias: number;
  };
  porUbicacion: { location: string; count: number }[];
  proximosALiberar: { id: number; label_number: string; dias_restantes: number }[];
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

const WASTE_TYPE_LABELS: Record<string, string> = {
  capacho_i131: "Capacho I-131",
  generador_mo99_tc99m: "Generador Mo-99/Tc-99m",
  cortopunzante_tc99m: "Cortopunzante Tc-99m",
  ropa_cama: "Ropa de cama",
  basura_comun: "Basura común",
  basura_bano: "Basura baño",
  otro: "Otro",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { dateStyle: "short" });
}

function decayBadge(item: InventoryItem) {
  if (item.is_release_eligible) return { label: "Listo para liberar", cls: "bg-green-100 text-green-700 border border-green-200", dot: "bg-green-500" };
  const d = item.days_until_release;
  if (d !== null && d !== undefined && d <= 30) return { label: `${Math.round(d)}d para liberar`, cls: "bg-yellow-100 text-yellow-700 border border-yellow-200", dot: "bg-yellow-500" };
  return { label: "En decaimiento", cls: "bg-blue-100 text-blue-700 border border-blue-200", dot: "bg-blue-500" };
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WasteStoragePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [dash, setDash] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterLoc, setFilterLoc] = useState("");
  const [filterEligible, setFilterEligible] = useState<"" | "si" | "no">("");
  const [filterRn, setFilterRn] = useState("");
  const [includeReleased, setIncludeReleased] = useState(false);

  // expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // locations panel
  const [showLocations, setShowLocations] = useState(false);

  // new location form
  const [newLocForm, setNewLocForm] = useState({ name: "", description: "", capacity: "" });
  const [addingLoc, setAddingLoc] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // edit location
  const [editLoc, setEditLoc] = useState<StorageLocation | null>(null);
  const [editLocForm, setEditLocForm] = useState({ name: "", description: "", capacity: "", active: true });
  const [savingLoc, setSavingLoc] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (includeReleased) params.set("includeReleased", "true");
      if (filterLoc) params.set("location_id", filterLoc);

      const [invRes, locRes, dashRes] = await Promise.all([
        fetch(`/api/waste-storage/inventory?${params}`),
        fetch("/api/waste-storage/locations?all=1"),
        fetch("/api/waste-storage/dashboard"),
      ]);
      const invJson = await invRes.json();
      const locJson = await locRes.json();
      const dashJson = await dashRes.json();

      setInventory(invJson.rows ?? []);
      setLocations(locJson.rows ?? []);
      setDash(dashJson);
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, [includeReleased, filterLoc]);

  useEffect(() => { load(); }, [load]);

  // ── Filter ──────────────────────────────────────────────────────────────

  const filtered = inventory.filter((it) => {
    if (filterEligible === "si" && !it.is_release_eligible) return false;
    if (filterEligible === "no" && it.is_release_eligible) return false;
    if (filterRn && it.radionuclide_code !== filterRn) return false;
    return true;
  });

  const radionuclides = Array.from(new Set(inventory.map((i) => i.radionuclide_code).filter(Boolean))).sort();

  const toggle = (id: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Add location ─────────────────────────────────────────────────────────

  const handleAddLoc = async () => {
    setLocError(null);
    if (!newLocForm.name.trim()) { setLocError("Nombre requerido."); return; }
    setAddingLoc(true);
    try {
      const res = await fetch("/api/waste-storage/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLocForm.name.trim(),
          description: newLocForm.description || null,
          capacity: newLocForm.capacity !== "" ? Number(newLocForm.capacity) : null,
        }),
      });
      if (!res.ok) { const j = await res.json(); setLocError(j.error ?? "Error."); return; }
      setNewLocForm({ name: "", description: "", capacity: "" });
      await load();
    } catch { setLocError("Error de red."); } finally { setAddingLoc(false); }
  };

  // ── Edit location ─────────────────────────────────────────────────────────

  const openEditLoc = (loc: StorageLocation) => {
    setEditLoc(loc);
    setEditLocForm({ name: loc.name, description: loc.description ?? "", capacity: loc.capacity !== null && loc.capacity !== undefined ? String(loc.capacity) : "", active: loc.active });
  };

  const handleSaveLoc = async () => {
    if (!editLoc) return;
    setSavingLoc(true);
    try {
      await fetch("/api/waste-storage/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editLoc.id, ...editLocForm, capacity: editLocForm.capacity !== "" ? Number(editLocForm.capacity) : null }),
      });
      setEditLoc(null);
      await load();
    } catch { /* ignore */ } finally { setSavingLoc(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Warehouse className="h-4 w-4 text-emerald-500" />
            <span>Gestión de Residuos</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Almacenamiento Temporal de Residuos Radiactivos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Inventario en almacenamiento con cálculo automático de decaimiento y criterio de liberación (10 T½).
            DS 3/1985 · NS-06.0 §9.5 · IAEA GSG-1 §5.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLocations((p) => !p)} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <MapPin className="h-4 w-4" />
            Ubicaciones
          </button>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="waste-storage"
        ownerType="module"
        title="Documentos del módulo"
      />

      {/* ── Dashboard KPIs ── */}
      {dash && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "En almacenamiento", value: dash.totales.totalEnAlmacenamiento, cls: "text-emerald-700", dot: "bg-emerald-500" },
            { label: "Listos para liberar", value: dash.totales.liberablesAhora, cls: "text-green-700", dot: "bg-green-500" },
            { label: "Próx. 30 días", value: dash.totales.proximos30Dias, cls: "text-yellow-700", dot: "bg-yellow-500" },
            { label: "Tiempo prom. (días)", value: dash.totales.tiempoPromedioAlmacenamientoDias, cls: "text-blue-700", dot: "bg-blue-500" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full ${k.dot}`} />
                <span className="text-xs text-gray-500">{k.label}</span>
              </div>
              <span className={`text-2xl font-bold ${k.cls}`}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Por ubicación + próximos a liberar ── */}
      {dash && (dash.porUbicacion.length > 0 || dash.proximosALiberar.length > 0) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {dash.porUbicacion.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-500" />Por ubicación</h3>
              <div className="space-y-2">
                {dash.porUbicacion.map((u) => (
                  <div key={u.location} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate max-w-[200px]">{u.location}</span>
                    <span className="font-semibold text-gray-900 ml-2">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dash.proximosALiberar.length > 0 && (
            <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">
              <h3 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2"><TrendingDown className="h-4 w-4" />Próximos a liberar (≤30 días)</h3>
              <div className="space-y-2">
                {dash.proximosALiberar.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-yellow-800">{p.label_number}</span>
                    <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-900">{p.dias_restantes} días</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Locations panel ── */}
      {showLocations && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-500" />Ubicaciones de almacenamiento</h3>
          <div className="space-y-2 mb-4">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                <div>
                  <span className={`font-medium ${loc.active ? "text-gray-800" : "text-gray-400 line-through"}`}>{loc.name}</span>
                  {loc.description && <span className="text-xs text-gray-500 ml-2">— {loc.description}</span>}
                  {loc.capacity && <span className="text-xs text-gray-400 ml-2">(cap. {loc.capacity})</span>}
                  <span className="ml-3 text-xs font-medium text-emerald-600">{loc.current_count ?? 0} activos</span>
                </div>
                <button onClick={() => openEditLoc(loc)} className="rounded p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          {locError && <p className="text-xs text-red-600 mb-2">{locError}</p>}
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-500 mb-1">Nueva ubicación</label>
              <input type="text" value={newLocForm.name} onChange={(e) => setNewLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nombre de la ubicación" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <input type="text" value={newLocForm.description} onChange={(e) => setNewLocForm((p) => ({ ...p, description: e.target.value }))} placeholder="Opcional" className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-40" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Capacidad</label>
              <input type="number" min="1" value={newLocForm.capacity} onChange={(e) => setNewLocForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="N°" className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-20" />
            </div>
            <button onClick={handleAddLoc} disabled={addingLoc} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60">
              <Plus className="h-4 w-4" />Agregar
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todas las ubicaciones</option>
          {locations.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterEligible} onChange={(e) => setFilterEligible(e.target.value as "" | "si" | "no")} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los estados de decaimiento</option>
          <option value="si">Listos para liberar</option>
          <option value="no">En decaimiento</option>
        </select>
        <select value={filterRn} onChange={(e) => setFilterRn(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los radionúclidos</option>
          {radionuclides.map((r) => <option key={r!} value={r!}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 self-center">
          <input type="checkbox" checked={includeReleased} onChange={(e) => setIncludeReleased(e.target.checked)} className="rounded" />
          Incluir liberados
        </label>
        <span className="ml-auto self-center text-xs text-gray-400">
          {filtered.length} de {inventory.length} ítem{inventory.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Content ── */}
      {loading && <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">Cargando…</div>}
      {error && !loading && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Warehouse className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">{inventory.length === 0 ? "No hay residuos en almacenamiento." : "No hay ítems que coincidan con los filtros."}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((it) => {
            const isOpen = expanded.has(it.id);
            const db = decayBadge(it);
            return (
              <div key={it.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => toggle(it.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <Package className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-gray-900">{it.label_number}</span>
                      {it.radionuclide_code && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono text-indigo-700">{it.radionuclide_code}</span>}
                      {it.waste_type && <span className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-600">{WASTE_TYPE_LABELS[it.waste_type] ?? it.waste_type}</span>}
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${db.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${db.dot}`} />
                        {db.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      {it.location_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{it.location_name}</span>}
                      {it.entry_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(it.entry_date)}</span>}
                      {it.elapsed_days !== null && it.elapsed_days !== undefined && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{it.elapsed_days} días almacenado</span>}
                      {it.half_lives_elapsed !== null && it.half_lives_elapsed !== undefined && <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{it.half_lives_elapsed} T½ transcurridos</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
                      <Field label="Rótulo" value={it.label_number} mono />
                      <Field label="Radionúclido" value={it.radionuclide_code ?? "—"} />
                      <Field label="Tipo residuo" value={WASTE_TYPE_LABELS[it.waste_type ?? ""] ?? it.waste_type ?? "—"} />
                      <Field label="Fecha ingreso" value={fmtDate(it.entry_date)} />
                      <Field label="Generación" value={fmtDate(it.generation_date)} />
                      <Field label="Ubicación" value={it.location_name ?? "—"} />
                      <Field label="Servicio" value={it.service ?? "—"} />
                      <Field label="Sala" value={it.sala ?? "—"} />
                      <Field label="Estado" value={it.status} />
                      <Field label="Días almacenado" value={it.elapsed_days !== null && it.elapsed_days !== undefined ? String(it.elapsed_days) : "—"} />
                      <Field label="T½ transcurridos" value={it.half_lives_elapsed !== null && it.half_lives_elapsed !== undefined ? String(it.half_lives_elapsed) : "—"} />
                      <Field label="Actividad actual est." value={it.actividad_actual !== null && it.actividad_actual !== undefined ? `${it.actividad_actual} ${it.unidad_actividad ?? ""}` : "—"} />
                      <Field label="Días para liberación" value={it.is_release_eligible ? "Listo ahora" : it.days_until_release !== null && it.days_until_release !== undefined ? `${Math.round(it.days_until_release)} días` : "—"} />
                      {it.fecha_estimada_liberacion && <Field label="Fecha est. liberación" value={fmtDate(it.fecha_estimada_liberacion)} />}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Regulatory footer ── */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-500 space-y-0.5">
            <p className="font-medium text-gray-600">Marco normativo aplicable</p>
            <p>DS 3/1985 (MINSAL) — Almacenamiento temporal obligatorio hasta cumplir criterio de 10 períodos de semivida</p>
            <p>NS-06.0 §9.5 — Requisitos de infraestructura para almacenamiento y seguimiento de residuos en instalaciones</p>
            <p>IAEA GSG-1 §5 — Predisposal management: storage, monitoring and release conditions for radioactive waste</p>
            <p>IAEA SSG-45 §4 — Tracking of decay-in-storage periods and release eligibility documentation requirements</p>
          </div>
        </div>
      </div>

      {/* ── Edit location modal ── */}
      {editLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Editar ubicación</h2>
              <button onClick={() => setEditLoc(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <FormField label="Nombre">
                <input type="text" value={editLocForm.name} onChange={(e) => setEditLocForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
              </FormField>
              <FormField label="Descripción">
                <input type="text" value={editLocForm.description} onChange={(e) => setEditLocForm((p) => ({ ...p, description: e.target.value }))} className={inp} />
              </FormField>
              <FormField label="Capacidad (N° rótulos)">
                <input type="number" min="1" value={editLocForm.capacity} onChange={(e) => setEditLocForm((p) => ({ ...p, capacity: e.target.value }))} className={inp} />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editLocForm.active} onChange={(e) => setEditLocForm((p) => ({ ...p, active: e.target.checked }))} />
                Ubicación activa
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditLoc(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveLoc} disabled={savingLoc} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60">
                <Save className="h-4 w-4" />{savingLoc ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className={`text-sm text-gray-800 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// Suppress unused icon warnings
const _icons = { CheckCircle, AlertTriangle, Trash2 };
void _icons;
