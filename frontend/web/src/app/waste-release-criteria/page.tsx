"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  Recycle, Plus, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, FileText, Pencil, Trash2,
  Save, X, AlertTriangle, Droplets, Wind, Flame,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Criterion {
  id: number;
  jurisdiccion: string;
  documento_fuente: string;
  version: string | null;
  fecha_vigencia_desde: string | null;
  fecha_vigencia_hasta: string | null;
  radionuclide_code: string | null;
  tipo_residuo: string | null;
  via_eliminacion: string | null;
  parametro: string;
  valor: number;
  unidad: string;
  autoridad: string | null;
  condicion_aplicacion: string | null;
  active: boolean;
  notes: string | null;
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
];

const VIA_ELIMINACION_OPTS = [
  "sistema alcantarillado",
  "basura municipal",
  "incineración",
  "decaimiento almacenamiento",
  "emisión atmosférica",
  "disposición en tierra",
];

const PARAMETRO_OPTS = [
  "actividad_total_bq",
  "concentracion_bq_ml",
  "concentracion_bq_g",
  "actividad_especifica_bq_g",
  "dosis_publica_msv_anio",
  "actividad_total_gbq_anio",
  "dosis_eficaz_msv",
];

const EMPTY_FORM = {
  jurisdiccion: "Chile",
  documento_fuente: "",
  version: "",
  fecha_vigencia_desde: "",
  fecha_vigencia_hasta: "",
  radionuclide_code: "",
  tipo_residuo: "",
  via_eliminacion: "",
  parametro: "actividad_total_bq",
  valor: "",
  unidad: "Bq",
  autoridad: "",
  condicion_aplicacion: "",
  active: true,
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL");
}

function activeBadge(active: boolean) {
  return active
    ? { label: "Activo", cls: "bg-green-100 text-green-700 border border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
    : { label: "Inactivo", cls: "bg-gray-100 text-gray-500 border border-gray-200", icon: <XCircle className="h-3.5 w-3.5" /> };
}

function viaIcon(via: string | null) {
  if (!via) return <Recycle className="h-3.5 w-3.5" />;
  if (via.includes("alcantarillado") || via.includes("líquido")) return <Droplets className="h-3.5 w-3.5" />;
  if (via.includes("atmosférica") || via.includes("gaseoso")) return <Wind className="h-3.5 w-3.5" />;
  if (via.includes("incineración")) return <Flame className="h-3.5 w-3.5" />;
  return <Recycle className="h-3.5 w-3.5" />;
}

function viaColor(via: string | null) {
  if (!via) return "bg-gray-50 text-gray-600";
  if (via.includes("alcantarillado")) return "bg-blue-50 text-blue-700";
  if (via.includes("basura")) return "bg-green-50 text-green-700";
  if (via.includes("incineración")) return "bg-orange-50 text-orange-700";
  if (via.includes("atmosférica")) return "bg-sky-50 text-sky-700";
  if (via.includes("decaimiento")) return "bg-purple-50 text-purple-700";
  return "bg-gray-50 text-gray-600";
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300";

// ── Main component ─────────────────────────────────────────────────────────

export default function WasteReleaseCriteriaPage() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterRn, setFilterRn] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterVia, setFilterVia] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  // expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // form modal
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, rnRes] = await Promise.all([
        fetch("/api/waste-release-criteria?active=false"),
        fetch("/api/radionuclides?active=true"),
      ]);
      const cJson = await cRes.json();
      const rnJson = await rnRes.json();
      setCriteria(cJson.criteria ?? []);
      setRadionuclides(rnJson.radionuclides ?? []);
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ──────────────────────────────────────────────────────────────

  const filtered = criteria.filter((c) => {
    if (filterRn) {
      if (filterRn === "__generic__" && c.radionuclide_code !== null) return false;
      if (filterRn !== "__generic__" && c.radionuclide_code !== filterRn) return false;
    }
    if (filterTipo && c.tipo_residuo !== filterTipo) return false;
    if (filterVia && c.via_eliminacion !== filterVia) return false;
    if (filterActive === "active" && !c.active) return false;
    if (filterActive === "inactive" && c.active) return false;
    return true;
  });

  // ── KPIs ────────────────────────────────────────────────────────────────

  const total = criteria.length;
  const activos = criteria.filter((c) => c.active).length;
  const vias = new Set(criteria.map((c) => c.via_eliminacion).filter(Boolean)).size;
  const documentos = new Set(criteria.map((c) => c.documento_fuente)).size;

  // ── Expand toggle ───────────────────────────────────────────────────────

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Form helpers ────────────────────────────────────────────────────────

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM });
    setEditId(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (c: Criterion) => {
    setFormData({
      jurisdiccion: c.jurisdiccion,
      documento_fuente: c.documento_fuente,
      version: c.version ?? "",
      fecha_vigencia_desde: c.fecha_vigencia_desde ?? "",
      fecha_vigencia_hasta: c.fecha_vigencia_hasta ?? "",
      radionuclide_code: c.radionuclide_code ?? "",
      tipo_residuo: c.tipo_residuo ?? "",
      via_eliminacion: c.via_eliminacion ?? "",
      parametro: c.parametro,
      valor: String(c.valor),
      unidad: c.unidad,
      autoridad: c.autoridad ?? "",
      condicion_aplicacion: c.condicion_aplicacion ?? "",
      active: c.active,
      notes: c.notes ?? "",
    });
    setEditId(c.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!formData.documento_fuente.trim()) { setFormError("Documento fuente es requerido."); return; }
    if (!formData.parametro.trim()) { setFormError("Parámetro es requerido."); return; }
    if (!formData.valor || isNaN(Number(formData.valor))) { setFormError("Valor numérico es requerido."); return; }
    if (!formData.unidad.trim()) { setFormError("Unidad es requerida."); return; }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        valor: Number(formData.valor),
        radionuclide_code: formData.radionuclide_code || null,
        tipo_residuo: formData.tipo_residuo || null,
        via_eliminacion: formData.via_eliminacion || null,
        version: formData.version || null,
        fecha_vigencia_desde: formData.fecha_vigencia_desde || null,
        fecha_vigencia_hasta: formData.fecha_vigencia_hasta || null,
        autoridad: formData.autoridad || null,
        condicion_aplicacion: formData.condicion_aplicacion || null,
        notes: formData.notes || null,
      };

      let res: Response;
      if (editId !== null) {
        res = await fetch("/api/waste-release-criteria", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, active: payload.active }),
        });
      } else {
        res = await fetch("/api/waste-release-criteria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const j = await res.json();
        setFormError(j.error ?? "Error al guardar.");
        return;
      }
      setShowForm(false);
      await load();
    } catch {
      setFormError("Error de red.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/waste-release-criteria?id=${id}`, { method: "DELETE" });
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
            <Recycle className="h-4 w-4 text-teal-500" />
            <span>Gestión de Residuos</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Criterios de Liberación / Dispensa de Residuos
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Umbrales bajo los cuales un residuo puede liberarse sin restricción radiológica.
            DS 133/1984 · IAEA GSR Part 5 · IAEA SSG-45 · CCHEN.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            <Plus className="h-4 w-4" />
            Nuevo criterio
          </button>
        </div>
      </div>

      {/* ── Normative note ── */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-teal-800">
          <strong>Criterios de liberación:</strong> umbrales bajo los cuales un residuo puede liberarse al ambiente sin restricción radiológica
          (IAEA GSR Part 5, DS 133/1984 MINSAL). Distintos de los{" "}
          <strong>criterios de control de contaminación superficial</strong> (ver módulo Criterios de Contaminación).
        </p>
      </div>

      {/* ── KPI Tiles ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total criterios", value: total, icon: <Recycle className="h-5 w-5 text-teal-500" />, cls: "text-teal-700" },
          { label: "Activos", value: activos, icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, cls: "text-green-700" },
          { label: "Vías de eliminación", value: vias, icon: <Droplets className="h-5 w-5 text-blue-500" />, cls: "text-blue-700" },
          { label: "Documentos fuente", value: documentos, icon: <FileText className="h-5 w-5 text-indigo-500" />, cls: "text-indigo-700" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{k.label}</span>
              {k.icon}
            </div>
            <span className={`text-2xl font-bold ${k.cls}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterRn} onChange={(e) => setFilterRn(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los radionúclidos</option>
          <option value="__generic__">Solo genéricos</option>
          {radionuclides.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los tipos</option>
          {TIPO_RESIDUO_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterVia} onChange={(e) => setFilterVia(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todas las vías</option>
          {VIA_ELIMINACION_OPTS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as typeof filterActive)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="all">Todos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
        <span className="ml-auto self-center text-xs text-gray-400">
          {filtered.length} de {total} criterio{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Content ── */}
      {loading && <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">Cargando…</div>}
      {error && !loading && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Recycle className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {total === 0 ? "No hay criterios de liberación registrados." : "No hay criterios que coincidan con los filtros."}
          </p>
          {total === 0 && (
            <button onClick={openCreate} className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700">
              Registrar primer criterio
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((c) => {
            const isOpen = expanded.has(c.id);
            const badge = activeBadge(c.active);
            return (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <Recycle className="h-5 w-5 text-teal-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.radionuclide_code
                        ? <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono text-indigo-700">{c.radionuclide_code}</span>
                        : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Genérico</span>
                      }
                      {c.via_eliminacion && (
                        <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${viaColor(c.via_eliminacion)}`}>
                          {viaIcon(c.via_eliminacion)}{c.via_eliminacion}
                        </span>
                      )}
                      <span className="font-semibold text-gray-900 text-sm">
                        {c.parametro}: {c.valor} {c.unidad}
                      </span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.icon}{badge.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{c.documento_fuente}{c.version ? ` v${c.version}` : ""}</span>
                      <span>{c.jurisdiccion}</span>
                      {c.tipo_residuo && <span>Tipo: {c.tipo_residuo}</span>}
                      {c.autoridad && <span>Autoridad: {c.autoridad}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="rounded p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }} className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
                      <Field label="Jurisdicción" value={c.jurisdiccion} />
                      <Field label="Documento fuente" value={c.documento_fuente} />
                      <Field label="Versión" value={c.version ?? "—"} />
                      <Field label="Radionúclido" value={c.radionuclide_code ?? "Genérico (todos)"} mono={!!c.radionuclide_code} />
                      <Field label="Tipo residuo" value={c.tipo_residuo ?? "—"} />
                      <Field label="Vía eliminación" value={c.via_eliminacion ?? "—"} />
                      <Field label="Parámetro" value={c.parametro} />
                      <Field label="Valor límite" value={`${c.valor} ${c.unidad}`} />
                      <Field label="Autoridad" value={c.autoridad ?? "—"} />
                      <Field label="Vigencia desde" value={fmtDate(c.fecha_vigencia_desde)} />
                      <Field label="Vigencia hasta" value={fmtDate(c.fecha_vigencia_hasta)} />
                      <Field label="Estado" value={badge.label} />
                      {c.condicion_aplicacion && <Field label="Condición aplicación" value={c.condicion_aplicacion} className="col-span-3" />}
                      {c.notes && <Field label="Notas" value={c.notes} className="col-span-3" />}
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
            <p>DS 133/1984 (MINSAL) — Criterios de liberación de residuos radiactivos al ambiente en Chile</p>
            <p>IAEA GSR Part 5 — Radiation Protection and Safety of Radiation Sources: clearance levels for radioactive material</p>
            <p>IAEA SSG-45 — Predisposal Management of Radioactive Waste including decommissioning waste</p>
            <p>CCHEN — Normas técnicas para gestión y disposición de desechos radiactivos en instalaciones autorizadas</p>
          </div>
        </div>
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editId !== null ? "Cambiar estado del criterio" : "Nuevo criterio de liberación"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

              {editId !== null ? (
                /* Edit: API PATCH only supports toggling active */
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    La API actual permite cambiar el estado activo/inactivo del criterio.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.active} onChange={(e) => setFormData((p) => ({ ...p, active: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-teal-600" />
                    <span className="text-sm text-gray-700">Criterio activo</span>
                  </label>
                </div>
              ) : (
                /* Create: full form */
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Documento fuente *" required>
                    <input type="text" value={formData.documento_fuente} onChange={(e) => setFormData((p) => ({ ...p, documento_fuente: e.target.value }))} placeholder="Ej: IAEA GSR Part 5 Tabla I" className={inp} />
                  </FormField>
                  <FormField label="Jurisdicción">
                    <input type="text" value={formData.jurisdiccion} onChange={(e) => setFormData((p) => ({ ...p, jurisdiccion: e.target.value }))} placeholder="Ej: Chile / IAEA" className={inp} />
                  </FormField>
                  <FormField label="Versión">
                    <input type="text" value={formData.version} onChange={(e) => setFormData((p) => ({ ...p, version: e.target.value }))} placeholder="Ej: 2023" className={inp} />
                  </FormField>
                  <FormField label="Autoridad">
                    <input type="text" value={formData.autoridad} onChange={(e) => setFormData((p) => ({ ...p, autoridad: e.target.value }))} placeholder="Ej: CCHEN, MINSAL" className={inp} />
                  </FormField>
                  <FormField label="Radionúclido (vacío = genérico)">
                    <select value={formData.radionuclide_code} onChange={(e) => setFormData((p) => ({ ...p, radionuclide_code: e.target.value }))} className={inp}>
                      <option value="">Genérico (aplica a todos)</option>
                      {radionuclides.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Tipo de residuo">
                    <select value={formData.tipo_residuo} onChange={(e) => setFormData((p) => ({ ...p, tipo_residuo: e.target.value }))} className={inp}>
                      <option value="">— Cualquier tipo —</option>
                      {TIPO_RESIDUO_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Vía de eliminación">
                    <select value={formData.via_eliminacion} onChange={(e) => setFormData((p) => ({ ...p, via_eliminacion: e.target.value }))} className={inp}>
                      <option value="">— Cualquier vía —</option>
                      {VIA_ELIMINACION_OPTS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Parámetro *" required>
                    <select value={formData.parametro} onChange={(e) => setFormData((p) => ({ ...p, parametro: e.target.value }))} className={inp}>
                      {PARAMETRO_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Valor *" required>
                    <input type="number" step="any" min="0" value={formData.valor} onChange={(e) => setFormData((p) => ({ ...p, valor: e.target.value }))} placeholder="Ej: 1000" className={inp} />
                  </FormField>
                  <FormField label="Unidad *" required>
                    <input type="text" value={formData.unidad} onChange={(e) => setFormData((p) => ({ ...p, unidad: e.target.value }))} placeholder="Ej: Bq, Bq/g, mSv/año" className={inp} />
                  </FormField>
                  <FormField label="Vigencia desde">
                    <input type="date" value={formData.fecha_vigencia_desde} onChange={(e) => setFormData((p) => ({ ...p, fecha_vigencia_desde: e.target.value }))} className={inp} />
                  </FormField>
                  <FormField label="Vigencia hasta">
                    <input type="date" value={formData.fecha_vigencia_hasta} onChange={(e) => setFormData((p) => ({ ...p, fecha_vigencia_hasta: e.target.value }))} className={inp} />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Condición de aplicación">
                      <input type="text" value={formData.condicion_aplicacion} onChange={(e) => setFormData((p) => ({ ...p, condicion_aplicacion: e.target.value }))} placeholder="Ej: Solo para residuos hospitalarios de MN" className={inp} />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField label="Notas adicionales">
                      <textarea rows={2} value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Observaciones, referencias…" className={`${inp} resize-none`} />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.active} onChange={(e) => setFormData((p) => ({ ...p, active: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-teal-600" />
                      <span className="text-sm text-gray-700">Criterio activo</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? "Guardando…" : editId !== null ? "Guardar estado" : "Registrar criterio"}
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
              <div className="rounded-full bg-red-100 p-2">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar criterio</h3>
                <p className="mt-1 text-sm text-gray-500">¿Confirmas la eliminación de este criterio de liberación? Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Eliminar</button>
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
      <dd className={`text-sm text-gray-800 font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
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
