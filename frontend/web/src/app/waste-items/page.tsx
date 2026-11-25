"use client";


import { useEffect, useState, useCallback } from "react";
import {
  Package, Plus, RefreshCw, ChevronDown, ChevronUp,
  FileText, Pencil, Trash2, Save, X, Clock, MapPin,
  Activity, Scale, Beaker, User, ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Estado = "registrado" | "almacenado" | "en disposicion" | "eliminado";

interface WasteItem {
  id: number;
  item_code: string;
  radionuclide_code: string;
  radionuclide_name?: string;
  half_life_days?: number;
  tipo_residuo: string;
  tipo_residuo_otro?: string | null;
  descripcion?: string | null;
  fecha_hora_generacion: string;
  zona_horaria?: string;
  actividad_inicial?: number | null;
  unidad_actividad?: string;
  masa_g?: number | null;
  volumen_ml?: number | null;
  superficie_estimada_cm2?: number | null;
  ubicacion?: string | null;
  contenedor?: string | null;
  area_almacenamiento?: string | null;
  responsable?: string | null;
  estado: Estado;
  created_at?: string;
  updated_at?: string;
}

interface Radionuclide {
  code: string;
  name: string;
  active: boolean;
}

const TIPO_RESIDUO_OPTS = [
  "sólido",
  "líquido",
  "gaseoso",
  "biológico",
  "equipo contaminado",
  "material de paciente",
  "otro",
];

const ESTADOS: Estado[] = ["registrado", "almacenado", "en disposicion", "eliminado"];

const ESTADO_CFG: Record<Estado, { label: string; cls: string; dot: string }> = {
  registrado:      { label: "Registrado",      cls: "bg-blue-100 text-blue-700 border border-blue-200",   dot: "bg-blue-500" },
  almacenado:      { label: "Almacenado",      cls: "bg-yellow-100 text-yellow-700 border border-yellow-200", dot: "bg-yellow-500" },
  "en disposicion": { label: "En disposición", cls: "bg-orange-100 text-orange-700 border border-orange-200", dot: "bg-orange-500" },
  eliminado:       { label: "Eliminado",       cls: "bg-red-100 text-red-700 border border-red-200",      dot: "bg-red-500" },
};

const EMPTY_FORM = {
  radionuclide_code: "",
  tipo_residuo: "sólido",
  tipo_residuo_otro: "",
  descripcion: "",
  fecha_hora_generacion: new Date().toISOString().slice(0, 16),
  actividad_inicial: "",
  unidad_actividad: "mCi",
  masa_g: "",
  volumen_ml: "",
  superficie_estimada_cm2: "",
  ubicacion: "",
  contenedor: "",
  area_almacenamiento: "",
  responsable: "",
};

const EDIT_FORM = {
  descripcion: "",
  ubicacion: "",
  contenedor: "",
  area_almacenamiento: "",
  responsable: "",
  estado: "registrado" as Estado,
  actividad_inicial: "",
  unidad_actividad: "mCi",
  motivo: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDatetime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function fmtNum(n: number | null | undefined, unit = "") {
  if (n === null || n === undefined) return "—";
  return `${n}${unit}`;
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";

// ── Main component ─────────────────────────────────────────────────────────

export default function WasteItemsPage() {
  const [items, setItems] = useState<WasteItem[]>([]);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterEstado, setFilterEstado] = useState<"" | Estado>("");
  const [filterRn, setFilterRn] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [search, setSearch] = useState("");

  // expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // edit modal
  const [editItem, setEditItem] = useState<WasteItem | null>(null);
  const [editForm, setEditForm] = useState({ ...EDIT_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [iRes, rnRes] = await Promise.all([
        fetch("/api/waste-items"),
        fetch("/api/radionuclides?active=true"),
      ]);
      const iJson = await iRes.json();
      const rnJson = await rnRes.json();
      setItems(iJson.items ?? []);
      setRadionuclides(rnJson.radionuclides ?? []);
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ──────────────────────────────────────────────────────────────

  const filtered = items.filter((it) => {
    if (filterEstado && it.estado !== filterEstado) return false;
    if (filterRn && it.radionuclide_code !== filterRn) return false;
    if (filterTipo && it.tipo_residuo !== filterTipo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !it.item_code.toLowerCase().includes(q) &&
        !it.radionuclide_code.toLowerCase().includes(q) &&
        !(it.descripcion ?? "").toLowerCase().includes(q) &&
        !(it.ubicacion ?? "").toLowerCase().includes(q) &&
        !(it.responsable ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── KPIs ────────────────────────────────────────────────────────────────

  const active = items.filter((i) => i.estado !== "eliminado");
  const registrados = active.filter((i) => i.estado === "registrado").length;
  const almacenados = active.filter((i) => i.estado === "almacenado").length;
  const enDisposicion = active.filter((i) => i.estado === "en disposicion").length;

  // ── Helpers ─────────────────────────────────────────────────────────────

  const toggle = (id: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Create ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setCreateError(null);
    if (!createForm.radionuclide_code) { setCreateError("Radionúclido es requerido."); return; }
    if (!createForm.tipo_residuo) { setCreateError("Tipo de residuo es requerido."); return; }
    if (!createForm.fecha_hora_generacion) { setCreateError("Fecha/hora de generación es requerida."); return; }

    setCreating(true);
    try {
      const payload = {
        ...createForm,
        actividad_inicial: createForm.actividad_inicial !== "" ? Number(createForm.actividad_inicial) : null,
        masa_g: createForm.masa_g !== "" ? Number(createForm.masa_g) : null,
        volumen_ml: createForm.volumen_ml !== "" ? Number(createForm.volumen_ml) : null,
        superficie_estimada_cm2: createForm.superficie_estimada_cm2 !== "" ? Number(createForm.superficie_estimada_cm2) : null,
        tipo_residuo_otro: createForm.tipo_residuo_otro || null,
        descripcion: createForm.descripcion || null,
        ubicacion: createForm.ubicacion || null,
        contenedor: createForm.contenedor || null,
        area_almacenamiento: createForm.area_almacenamiento || null,
        responsable: createForm.responsable || null,
      };
      const res = await fetch("/api/waste-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        setCreateError(j.error ?? "Error al crear.");
        return;
      }
      setShowCreate(false);
      setCreateForm({ ...EMPTY_FORM });
      await load();
    } catch {
      setCreateError("Error de red.");
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────

  const openEdit = (it: WasteItem) => {
    setEditItem(it);
    setEditForm({
      descripcion: it.descripcion ?? "",
      ubicacion: it.ubicacion ?? "",
      contenedor: it.contenedor ?? "",
      area_almacenamiento: it.area_almacenamiento ?? "",
      responsable: it.responsable ?? "",
      estado: it.estado,
      actividad_inicial: it.actividad_inicial !== null && it.actividad_inicial !== undefined ? String(it.actividad_inicial) : "",
      unidad_actividad: it.unidad_actividad ?? "mCi",
      motivo: "",
    });
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editItem) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        id: editItem.id,
        descripcion: editForm.descripcion || null,
        ubicacion: editForm.ubicacion || null,
        contenedor: editForm.contenedor || null,
        area_almacenamiento: editForm.area_almacenamiento || null,
        responsable: editForm.responsable || null,
        estado: editForm.estado,
        actividad_inicial: editForm.actividad_inicial !== "" ? Number(editForm.actividad_inicial) : null,
        unidad_actividad: editForm.unidad_actividad || null,
        motivo: editForm.motivo || null,
      };
      const res = await fetch("/api/waste-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        setEditError(j.error ?? "Error al actualizar.");
        return;
      }
      setEditItem(null);
      await load();
    } catch {
      setEditError("Error de red.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete (soft) ────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/waste-items?id=${id}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch { /* ignore */ }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Package className="h-4 w-4 text-purple-500" />
            <span>Gestión de Residuos</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Fichas Individuales de Residuos Radiactivos
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Registro individual con código RR-YYYY-NNNNNN, seguimiento de estado y trazabilidad de disposición.
            DS 133/1984 · NS-06.0 · IAEA GSR Part 5.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button onClick={() => { setCreateForm({ ...EMPTY_FORM }); setCreateError(null); setShowCreate(true); }} className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
            <Plus className="h-4 w-4" />
            Registrar residuo
          </button>
        </div>
      </div>

      {/* ── KPI Tiles ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total activos", value: active.length, cls: "text-purple-700", dotCls: "bg-purple-500" },
          { label: "Registrados", value: registrados, cls: "text-blue-700", dotCls: "bg-blue-500" },
          { label: "Almacenados", value: almacenados, cls: "text-yellow-700", dotCls: "bg-yellow-500" },
          { label: "En disposición", value: enDisposicion, cls: "text-orange-700", dotCls: "bg-orange-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-2 w-2 rounded-full ${k.dotCls}`} />
              <span className="text-xs text-gray-500">{k.label}</span>
            </div>
            <span className={`text-2xl font-bold ${k.cls}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar código, radionúclido, descripción…"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 min-w-[220px]"
        />
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as "" | Estado)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_CFG[s].label}</option>)}
        </select>
        <select value={filterRn} onChange={(e) => setFilterRn(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los radionúclidos</option>
          {radionuclides.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los tipos</option>
          {TIPO_RESIDUO_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-gray-400">
          {filtered.length} de {items.length} ficha{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Content ── */}
      {loading && <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">Cargando…</div>}
      {error && !loading && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {items.length === 0 ? "No hay fichas de residuos registradas." : "No hay fichas que coincidan con los filtros."}
          </p>
          {items.length === 0 && (
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700">
              Registrar primer residuo
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((it) => {
            const isOpen = expanded.has(it.id);
            const cfg = ESTADO_CFG[it.estado] ?? ESTADO_CFG.registrado;
            return (
              <div key={it.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => toggle(it.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                  <Package className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-gray-900">{it.item_code}</span>
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono text-indigo-700">{it.radionuclide_code}</span>
                      <span className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-600">{it.tipo_residuo}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDatetime(it.fecha_hora_generacion)}</span>
                      {it.actividad_inicial !== null && it.actividad_inicial !== undefined && (
                        <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{it.actividad_inicial} {it.unidad_actividad}</span>
                      )}
                      {it.ubicacion && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{it.ubicacion}</span>}
                      {it.responsable && <span className="flex items-center gap-1"><User className="h-3 w-3" />{it.responsable}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(it); }} className="rounded p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(it.id); }} className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
                      <Field label="Código" value={it.item_code} mono />
                      <Field label="Radionúclido" value={`${it.radionuclide_code}${it.radionuclide_name ? ` — ${it.radionuclide_name}` : ""}`} />
                      <Field label="Tipo residuo" value={it.tipo_residuo_otro ? `${it.tipo_residuo} (${it.tipo_residuo_otro})` : it.tipo_residuo} />
                      <Field label="Generación" value={fmtDatetime(it.fecha_hora_generacion)} />
                      <Field label="Actividad inicial" value={fmtNum(it.actividad_inicial, ` ${it.unidad_actividad ?? ""}`)} />
                      {it.half_life_days && <Field label="Semivida" value={`${it.half_life_days} días`} />}
                      <Field label="Masa (g)" value={fmtNum(it.masa_g)} />
                      <Field label="Volumen (mL)" value={fmtNum(it.volumen_ml)} />
                      <Field label="Superficie (cm²)" value={fmtNum(it.superficie_estimada_cm2)} />
                      <Field label="Ubicación" value={it.ubicacion ?? "—"} />
                      <Field label="Contenedor" value={it.contenedor ?? "—"} />
                      <Field label="Área almacenamiento" value={it.area_almacenamiento ?? "—"} />
                      <Field label="Responsable" value={it.responsable ?? "—"} />
                      <Field label="Estado actual" value={cfg.label} />
                      {it.descripcion && <Field label="Descripción" value={it.descripcion} className="col-span-3" />}
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
            <p>DS 133/1984 (MINSAL) — Registro y trazabilidad de residuos radiactivos generados en instalaciones</p>
            <p>NS-06.0 §9.3 — Obligación de ficha individual por cada residuo con identificación, actividad y destino</p>
            <p>IAEA GSR Part 5 — Predisposal waste management: individual waste record requirements (§4.12)</p>
            <p>IAEA SSG-45 — Waste characterization before disposal: required fields and minimum dataset</p>
          </div>
        </div>
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Registrar residuo radiactivo</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {createError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Radionúclido *" required>
                  <select value={createForm.radionuclide_code} onChange={(e) => setCreateForm((p) => ({ ...p, radionuclide_code: e.target.value }))} className={inp}>
                    <option value="">— Seleccionar —</option>
                    {radionuclides.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Tipo de residuo *" required>
                  <select value={createForm.tipo_residuo} onChange={(e) => setCreateForm((p) => ({ ...p, tipo_residuo: e.target.value }))} className={inp}>
                    {TIPO_RESIDUO_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                {createForm.tipo_residuo === "otro" && (
                  <FormField label="Especificar tipo">
                    <input type="text" value={createForm.tipo_residuo_otro} onChange={(e) => setCreateForm((p) => ({ ...p, tipo_residuo_otro: e.target.value }))} placeholder="Describa el tipo" className={inp} />
                  </FormField>
                )}
                <FormField label="Fecha/hora de generación *" required>
                  <input type="datetime-local" value={createForm.fecha_hora_generacion} onChange={(e) => setCreateForm((p) => ({ ...p, fecha_hora_generacion: e.target.value }))} className={inp} />
                </FormField>
                <FormField label="Actividad inicial">
                  <div className="flex gap-2">
                    <input type="number" step="any" min="0" value={createForm.actividad_inicial} onChange={(e) => setCreateForm((p) => ({ ...p, actividad_inicial: e.target.value }))} placeholder="Valor" className={`${inp} flex-1`} />
                    <select value={createForm.unidad_actividad} onChange={(e) => setCreateForm((p) => ({ ...p, unidad_actividad: e.target.value }))} className="rounded-lg border border-gray-200 px-2 py-2 text-sm">
                      {["mCi", "MBq", "GBq", "kBq", "Bq"].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </FormField>
                <FormField label="Masa (g)">
                  <input type="number" step="0.01" min="0" value={createForm.masa_g} onChange={(e) => setCreateForm((p) => ({ ...p, masa_g: e.target.value }))} placeholder="Gramos" className={inp} />
                </FormField>
                <FormField label="Volumen (mL)">
                  <input type="number" step="0.1" min="0" value={createForm.volumen_ml} onChange={(e) => setCreateForm((p) => ({ ...p, volumen_ml: e.target.value }))} placeholder="Mililitros" className={inp} />
                </FormField>
                <FormField label="Superficie estimada (cm²)">
                  <input type="number" step="0.1" min="0" value={createForm.superficie_estimada_cm2} onChange={(e) => setCreateForm((p) => ({ ...p, superficie_estimada_cm2: e.target.value }))} placeholder="cm²" className={inp} />
                </FormField>
                <FormField label="Ubicación">
                  <input type="text" value={createForm.ubicacion} onChange={(e) => setCreateForm((p) => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Sala caliente, estante 3" className={inp} />
                </FormField>
                <FormField label="Contenedor">
                  <input type="text" value={createForm.contenedor} onChange={(e) => setCreateForm((p) => ({ ...p, contenedor: e.target.value }))} placeholder="Ej: Plomo blindado 2L" className={inp} />
                </FormField>
                <FormField label="Área de almacenamiento">
                  <input type="text" value={createForm.area_almacenamiento} onChange={(e) => setCreateForm((p) => ({ ...p, area_almacenamiento: e.target.value }))} placeholder="Ej: Sala residuos 1, NM" className={inp} />
                </FormField>
                <FormField label="Responsable">
                  <input type="text" value={createForm.responsable} onChange={(e) => setCreateForm((p) => ({ ...p, responsable: e.target.value }))} placeholder="Nombre del responsable" className={inp} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Descripción">
                    <textarea rows={2} value={createForm.descripcion} onChange={(e) => setCreateForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción adicional del residuo…" className={`${inp} resize-none`} />
                  </FormField>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {creating ? "Registrando…" : "Registrar residuo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Actualizar ficha</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editItem.item_code}</p>
              </div>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {editError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}

              {/* Estado transition */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Cambio de estado</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_CFG[editItem.estado].cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_CFG[editItem.estado].dot}`} />
                    {ESTADO_CFG[editItem.estado].label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                  <select value={editForm.estado} onChange={(e) => setEditForm((p) => ({ ...p, estado: e.target.value as Estado }))} className="rounded-lg border border-gray-200 px-2 py-1 text-xs">
                    {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_CFG[s].label}</option>)}
                  </select>
                </div>
                {editForm.estado !== editItem.estado && (
                  <div className="mt-2">
                    <FormField label="Motivo del cambio">
                      <input type="text" value={editForm.motivo} onChange={(e) => setEditForm((p) => ({ ...p, motivo: e.target.value }))} placeholder="Razón del cambio de estado…" className={`${inp} text-xs`} />
                    </FormField>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Ubicación">
                  <input type="text" value={editForm.ubicacion} onChange={(e) => setEditForm((p) => ({ ...p, ubicacion: e.target.value }))} placeholder="Ubicación actual" className={inp} />
                </FormField>
                <FormField label="Contenedor">
                  <input type="text" value={editForm.contenedor} onChange={(e) => setEditForm((p) => ({ ...p, contenedor: e.target.value }))} placeholder="Contenedor" className={inp} />
                </FormField>
                <FormField label="Área de almacenamiento">
                  <input type="text" value={editForm.area_almacenamiento} onChange={(e) => setEditForm((p) => ({ ...p, area_almacenamiento: e.target.value }))} placeholder="Sala o área" className={inp} />
                </FormField>
                <FormField label="Responsable">
                  <input type="text" value={editForm.responsable} onChange={(e) => setEditForm((p) => ({ ...p, responsable: e.target.value }))} placeholder="Responsable" className={inp} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Descripción">
                    <textarea rows={2} value={editForm.descripcion} onChange={(e) => setEditForm((p) => ({ ...p, descripcion: e.target.value }))} className={`${inp} resize-none`} />
                  </FormField>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setEditItem(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleEdit} disabled={editSaving} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-900">Marcar como eliminado</h3>
                <p className="mt-1 text-sm text-gray-500">La ficha quedará con estado "Eliminado" (soft delete). No se borra de la base de datos para mantener trazabilidad.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Field({ label, value, mono = false, className = "" }: { label: string; value: string | number; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className={`text-sm text-gray-800 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// Suppress unused import warnings
const _icons = { Scale, Beaker };
void _icons;
