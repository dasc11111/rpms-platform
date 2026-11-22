"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FlaskConical, Plus, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, Clock, Ruler,
  Calculator, FileText, Pencil, Trash2, Save, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Calibration {
  id: number;
  instrumento: string;
  radionuclide_code: string;
  geometria: string | null;
  distancia_cm: number | null;
  metodo: "eficiencia" | "factor_calibracion";
  eficiencia: number | null;
  factor_calibracion: number | null;
  area_efectiva_cm2: number | null;
  fecha_calibracion: string | null;
  fecha_vigencia_hasta: string | null;
  vigente: boolean;
  documento_fuente: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Radionuclide {
  code: string;
  name: string;
  half_life_days?: number;
  active: boolean;
}

const EMPTY_FORM: Omit<Calibration, "id" | "created_at" | "updated_at"> = {
  instrumento: "",
  radionuclide_code: "",
  geometria: "",
  distancia_cm: null,
  metodo: "eficiencia",
  eficiencia: null,
  factor_calibracion: null,
  area_efectiva_cm2: null,
  fecha_calibracion: "",
  fecha_vigencia_hasta: "",
  vigente: true,
  documento_fuente: "",
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function vigencyBadge(c: Calibration) {
  if (!c.vigente)
    return { label: "Vencida", cls: "bg-red-100 text-red-700 border border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> };
  if (c.fecha_vigencia_hasta) {
    const days = Math.ceil(
      (new Date(c.fecha_vigencia_hasta).getTime() - Date.now()) / 86_400_000
    );
    if (days < 0)
      return { label: "Vencida", cls: "bg-red-100 text-red-700 border border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> };
    if (days <= 30)
      return { label: `Vence en ${days}d`, cls: "bg-yellow-100 text-yellow-700 border border-yellow-200", icon: <AlertTriangle className="h-3.5 w-3.5" /> };
  }
  return { label: "Vigente", cls: "bg-green-100 text-green-700 border border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL");
}

function fmtNum(n: number | null, unit = "") {
  if (n === null || n === undefined) return "—";
  return `${n}${unit}`;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WasteCalibrationPage() {
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterRn, setFilterRn] = useState("");
  const [filterVigente, setFilterVigente] = useState<"all" | "vigente" | "vencida">("all");

  // expanded cards
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // modal
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
      const [calRes, rnRes] = await Promise.all([
        fetch("/api/waste-calibration"),
        fetch("/api/radionuclides?active=true"),
      ]);
      const calJson = await calRes.json();
      const rnJson = await rnRes.json();
      setCalibrations(calJson.calibrations ?? []);
      setRadionuclides(rnJson.radionuclides ?? []);
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ──────────────────────────────────────────────────────────────

  const filtered = calibrations.filter((c) => {
    if (filterRn && c.radionuclide_code !== filterRn) return false;
    if (filterVigente === "vigente" && !c.vigente) return false;
    if (filterVigente === "vencida" && c.vigente) return false;
    return true;
  });

  // ── KPIs ────────────────────────────────────────────────────────────────

  const total = calibrations.length;
  const vigentes = calibrations.filter((c) => c.vigente).length;
  const vencidas = total - vigentes;
  const proxVencer = calibrations.filter((c) => {
    if (!c.vigente || !c.fecha_vigencia_hasta) return false;
    const days = Math.ceil((new Date(c.fecha_vigencia_hasta).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 30;
  }).length;

  const uniqueInst = new Set(calibrations.map((c) => c.instrumento)).size;

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

  const openEdit = (c: Calibration) => {
    setFormData({
      instrumento: c.instrumento,
      radionuclide_code: c.radionuclide_code,
      geometria: c.geometria ?? "",
      distancia_cm: c.distancia_cm,
      metodo: c.metodo,
      eficiencia: c.eficiencia,
      factor_calibracion: c.factor_calibracion,
      area_efectiva_cm2: c.area_efectiva_cm2,
      fecha_calibracion: c.fecha_calibracion ?? "",
      fecha_vigencia_hasta: c.fecha_vigencia_hasta ?? "",
      vigente: c.vigente,
      documento_fuente: c.documento_fuente ?? "",
      notes: c.notes ?? "",
    });
    setEditId(c.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!formData.instrumento.trim()) { setFormError("Instrumento es requerido."); return; }
    if (!formData.radionuclide_code) { setFormError("Radionúclido es requerido."); return; }
    if (formData.metodo === "eficiencia" && (formData.eficiencia === null || formData.eficiencia === undefined)) {
      setFormError("Eficiencia es requerida para este método.");
      return;
    }
    if (formData.metodo === "factor_calibracion" && (formData.factor_calibracion === null || formData.factor_calibracion === undefined)) {
      setFormError("Factor de calibración es requerido para este método.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        distancia_cm: formData.distancia_cm !== null && formData.distancia_cm !== undefined ? Number(formData.distancia_cm) : null,
        eficiencia: formData.eficiencia !== null && formData.eficiencia !== undefined ? Number(formData.eficiencia) : null,
        factor_calibracion: formData.factor_calibracion !== null && formData.factor_calibracion !== undefined ? Number(formData.factor_calibracion) : null,
        area_efectiva_cm2: formData.area_efectiva_cm2 !== null && formData.area_efectiva_cm2 !== undefined ? Number(formData.area_efectiva_cm2) : null,
        geometria: formData.geometria || null,
        fecha_calibracion: formData.fecha_calibracion || null,
        fecha_vigencia_hasta: formData.fecha_vigencia_hasta || null,
        documento_fuente: formData.documento_fuente || null,
        notes: formData.notes || null,
      };

      let res: Response;
      if (editId !== null) {
        res = await fetch("/api/waste-calibration", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...payload }),
        });
      } else {
        res = await fetch("/api/waste-calibration", {
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
      await fetch(`/api/waste-calibration?id=${id}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch {
      /* ignore */
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <FlaskConical className="h-4 w-4 text-indigo-500" />
            <span>Gestión de Residuos</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Matriz de Calibración de Detectores
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Eficiencias y factores de calibración por detector × radionúclido × geometría. DS 3/1985 · NS-06.0 · IAEA GSG-1.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nueva calibración
          </button>
        </div>
      </div>

      {/* ── KPI Tiles ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total entradas", value: total, icon: <FlaskConical className="h-5 w-5 text-indigo-500" />, cls: "text-indigo-700" },
          { label: "Vigentes", value: vigentes, icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, cls: "text-green-700" },
          { label: "Vencidas", value: vencidas, icon: <XCircle className="h-5 w-5 text-red-500" />, cls: "text-red-700" },
          { label: "Por vencer (≤30d)", value: proxVencer, icon: <Clock className="h-5 w-5 text-yellow-500" />, cls: "text-yellow-700" },
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
        <select
          value={filterRn}
          onChange={(e) => setFilterRn(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Todos los radionúclidos</option>
          {radionuclides.map((r) => (
            <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
          ))}
        </select>

        <select
          value={filterVigente}
          onChange={(e) => setFilterVigente(e.target.value as typeof filterVigente)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="all">Todos los estados</option>
          <option value="vigente">Solo vigentes</option>
          <option value="vencida">Solo vencidas</option>
        </select>

        <span className="ml-auto self-center text-xs text-gray-400">
          {filtered.length} de {total} entrada{total !== 1 ? "s" : ""}
          {uniqueInst > 0 && ` · ${uniqueInst} instrumento${uniqueInst !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Content ── */}
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          Cargando…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <FlaskConical className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {total === 0
              ? "No hay entradas de calibración registradas."
              : "No hay entradas que coincidan con los filtros seleccionados."}
          </p>
          {total === 0 && (
            <button
              onClick={openCreate}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Registrar primera calibración
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((c) => {
            const isOpen = expanded.has(c.id);
            const badge = vigencyBadge(c);
            return (
              <div
                key={c.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <button
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <FlaskConical className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{c.instrumento}</span>
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono text-indigo-700">
                        {c.radionuclide_code}
                      </span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.icon}{badge.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      {c.metodo === "eficiencia"
                        ? <span className="flex items-center gap-1"><Calculator className="h-3 w-3" />Eficiencia: {fmtNum(c.eficiencia, " %")}</span>
                        : <span className="flex items-center gap-1"><Calculator className="h-3 w-3" />Factor cal.: {fmtNum(c.factor_calibracion)}</span>
                      }
                      {c.geometria && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{c.geometria}</span>}
                      {c.distancia_cm !== null && <span>{c.distancia_cm} cm</span>}
                      {c.fecha_calibracion && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(c.fecha_calibracion)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                      className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
                      <Field label="Instrumento" value={c.instrumento} />
                      <Field label="Radionúclido" value={c.radionuclide_code} mono />
                      <Field label="Método" value={c.metodo === "eficiencia" ? "Eficiencia" : "Factor de calibración"} />
                      {c.metodo === "eficiencia"
                        ? <Field label="Eficiencia (%)" value={fmtNum(c.eficiencia)} />
                        : <Field label="Factor calibración" value={fmtNum(c.factor_calibracion)} />
                      }
                      <Field label="Geometría" value={c.geometria ?? "—"} />
                      <Field label="Distancia (cm)" value={fmtNum(c.distancia_cm)} />
                      <Field label="Área efectiva (cm²)" value={fmtNum(c.area_efectiva_cm2)} />
                      <Field label="Fecha calibración" value={fmtDate(c.fecha_calibracion)} />
                      <Field label="Vigencia hasta" value={fmtDate(c.fecha_vigencia_hasta)} />
                      <Field label="Estado" value={badge.label} />
                      {c.documento_fuente && <Field label="Documento fuente" value={c.documento_fuente} className="col-span-2" />}
                      {c.notes && <Field label="Notas" value={c.notes} className="col-span-3" />}
                    </div>
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
            <p>DS 3/1985 (MINSAL) — Art. 86–89: requisitos de calibración de instrumentos de medición radiológica</p>
            <p>NS-06.0 §6.4 — Control de calidad de instrumentos de detección utilizados en dosimetría y mediciones de residuos</p>
            <p>IAEA GSG-1 §4.3 — Efficiency calibration requirements for waste characterization measurements</p>
            <p>IAEA GSG-1 §5.2 — Geometry and source-detector distance considerations for efficiency calibration</p>
          </div>
        </div>
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editId !== null ? "Editar calibración" : "Nueva calibración"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Instrumento *" required>
                  <input
                    type="text"
                    value={formData.instrumento}
                    onChange={(e) => setFormData((p) => ({ ...p, instrumento: e.target.value }))}
                    placeholder="Ej: Contador Geiger-Müller LB6010"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <FormField label="Radionúclido *" required>
                  <select
                    value={formData.radionuclide_code}
                    onChange={(e) => setFormData((p) => ({ ...p, radionuclide_code: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— Seleccionar —</option>
                    {radionuclides.map((r) => (
                      <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Método de calibración *" required>
                  <select
                    value={formData.metodo}
                    onChange={(e) => setFormData((p) => ({ ...p, metodo: e.target.value as "eficiencia" | "factor_calibracion" }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="eficiencia">Eficiencia (%)</option>
                    <option value="factor_calibracion">Factor de calibración</option>
                  </select>
                </FormField>

                {formData.metodo === "eficiencia" ? (
                  <FormField label="Eficiencia (%) *" required>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="100"
                      value={formData.eficiencia ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, eficiencia: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                      placeholder="Ej: 0.045"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </FormField>
                ) : (
                  <FormField label="Factor de calibración *" required>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.factor_calibracion ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, factor_calibracion: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                      placeholder="Ej: 1.234"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </FormField>
                )}

                <FormField label="Geometría">
                  <input
                    type="text"
                    value={formData.geometria ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, geometria: e.target.value }))}
                    placeholder="Ej: Marinelli 1L, Pozo 50 mL"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <FormField label="Distancia fuente-detector (cm)">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.distancia_cm ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, distancia_cm: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                    placeholder="Ej: 10"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <FormField label="Área efectiva del detector (cm²)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.area_efectiva_cm2 ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, area_efectiva_cm2: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                    placeholder="Ej: 20.0"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <FormField label="Fecha de calibración">
                  <input
                    type="date"
                    value={formData.fecha_calibracion ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, fecha_calibracion: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <FormField label="Vigencia hasta">
                  <input
                    type="date"
                    value={formData.fecha_vigencia_hasta ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, fecha_vigencia_hasta: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <FormField label="Documento fuente">
                  <input
                    type="text"
                    value={formData.documento_fuente ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, documento_fuente: e.target.value }))}
                    placeholder="Ej: Informe cal. CCHEN 2024-003"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <FormField label="Notas adicionales">
                    <textarea
                      rows={2}
                      value={formData.notes ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Condiciones de calibración, observaciones…"
                      className="input resize-none"
                    />
                  </FormField>
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.vigente}
                      onChange={(e) => setFormData((p) => ({ ...p, vigente: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Calibración vigente</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando…" : editId !== null ? "Guardar cambios" : "Registrar calibración"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar entrada</h3>
                <p className="mt-1 text-sm text-gray-500">
                  ¿Confirmas que deseas eliminar esta entrada de calibración? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  mono = false,
  className = "",
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className={`text-sm text-gray-800 font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
