"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { Activity, Gauge, Plus, Trash2, Pencil, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AreaRecord {
  id: number;
  zone_name: string;
  location: string;
  measurement_date: string;
  instrument_name: string | null;
  dose_rate_usv_h: number;
  background_usv_h: number | null;
  net_dose_rate_usv_h: number | null;
  expected_annual_dose_msv: number | null;
  occupancy_factor: number;
  zone_type: string | null;
  result: string | null;
  performed_by: string | null;
  notes: string | null;
}

interface ApiResponse {
  records: AreaRecord[];
  stats: {
    total_zones: number;
    fail_count: number;
    review_count: number;
    pass_count: number;
    max_dose_rate: number;
  };
}

const RESULT_CONFIG: Record<string, { label: string; color: string; border: string; bg: string; icon: React.ElementType }> = {
  fail:   { label: "Supera Límite", color: "text-red-700",   border: "border-red-500",   bg: "bg-red-50",   icon: AlertTriangle },
  review: { label: "Requiere Revisión", color: "text-amber-700", border: "border-amber-400", bg: "bg-amber-50", icon: Clock },
  pass:   { label: "Conforme",      color: "text-green-700", border: "border-green-500", bg: "bg-green-50", icon: CheckCircle },
};

const ZONE_TYPE_BADGE: Record<string, string> = {
  controlada: "bg-red-100 text-red-800",
  supervisada: "bg-amber-100 text-amber-800",
  libre: "bg-green-100 text-green-800",
};

function ResultBadge({ result }: { result: string | null }) {
  const cfg = RESULT_CONFIG[result ?? "pass"] ?? RESULT_CONFIG.pass;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function DoseRateBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = value >= 2.28 ? "bg-red-500" : value >= 0.571 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

export default function AreaMonitoringPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AreaRecord | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    zone_name: "",
    location: "",
    dose_rate_usv_h: "",
    background_usv_h: "",
    occupancy_factor: "1.0",
    instrument_name: "",
    performed_by: "",
    notes: "",
  });

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const openEdit = (r: AreaRecord) => {
    setEditing(r);
    setForm({
      zone_name: r.zone_name ?? "",
      location: r.location ?? "",
      dose_rate_usv_h: r.dose_rate_usv_h != null ? String(r.dose_rate_usv_h) : "",
      background_usv_h: r.background_usv_h != null ? String(r.background_usv_h) : "",
      occupancy_factor: r.occupancy_factor != null ? String(r.occupancy_factor) : "1.0",
      instrument_name: r.instrument_name ?? "",
      performed_by: r.performed_by ?? "",
      notes: r.notes ?? "",
    });
    setShowModal(true);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/area-monitoring");
      const json = await res.json();
      setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        zone_name: form.zone_name,
        location: form.location,
        dose_rate_usv_h: parseFloat(form.dose_rate_usv_h),
        background_usv_h: form.background_usv_h ? parseFloat(form.background_usv_h) : null,
        occupancy_factor: parseFloat(form.occupancy_factor),
        instrument_name: form.instrument_name || null,
        performed_by: form.performed_by || null,
        notes: form.notes || null,
      };
      if (editing) {
        await fetch(`/api/area-monitoring?id=${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/area-monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      setForm({ zone_name: "", location: "", dose_rate_usv_h: "", background_usv_h: "", occupancy_factor: "1.0", instrument_name: "", performed_by: "", notes: "" });
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro de monitoreo?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/area-monitoring?id=${id}`, { method: "DELETE" });
      fetchData();
    } finally {
      setDeleting(null);
    }
  };

  const stats = data?.stats;
  const records = data?.records ?? [];
  const hasFails = (stats?.fail_count ?? 0) > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gauge className="w-7 h-7 text-blue-600" />
            Monitoreo de Área
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Mediciones de tasa de dosis ambiental · DS 3/1985 Art. 15 — MINSAL
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Registrar Medición
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {hasFails && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">⚠ Zonas con tasa de dosis que supera límites normativos</p>
            <p className="text-sm text-red-700 mt-1">
              {stats?.fail_count} zona(s) con resultado FALLA. Revisar inmediatamente y tomar medidas correctivas.
              Límite controlada: 6 mSv/año — DS 3/1985 Art. 15.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Zonas Monitoreadas</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? "—" : (stats?.total_zones ?? 0)}</p>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", hasFails ? "bg-red-50 border-red-300" : "bg-white")}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Con Falla</p>
          <p className={cn("text-3xl font-bold mt-1", hasFails ? "text-red-700" : "text-gray-900")}>
            {loading ? "—" : (stats?.fail_count ?? 0)}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">En Revisión</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{loading ? "—" : (stats?.review_count ?? 0)}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Tasa Máx. (µSv/h)</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {loading ? "—" : (stats?.max_dose_rate != null ? Number(stats.max_dose_rate).toFixed(2) : "—")}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Última Medición por Zona</h2>
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando mediciones…</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Gauge className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sin mediciones registradas.</p>
            <p className="text-sm mt-1">Registre la primera medición ambiental.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Zona / Ubicación</th>
                  <th className="text-left px-4 py-3">Tasa (µSv/h)</th>
                  <th className="text-left px-4 py-3">Dosis Anual Est.</th>
                  <th className="text-left px-4 py-3">Clasificación</th>
                  <th className="text-left px-4 py-3">Resultado</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Realizado por</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r) => {
                  const cfg = RESULT_CONFIG[r.result ?? "pass"] ?? RESULT_CONFIG.pass;
                  return (
                    <tr key={r.id} className={cn("hover:bg-gray-50 transition-colors", r.result === "fail" && "bg-red-50/40")}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{r.zone_name}</p>
                        <p className="text-xs text-gray-500">{r.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <DoseRateBar value={Number(r.dose_rate_usv_h)} max={Math.max(Number(stats?.max_dose_rate ?? 1), 1)} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.expected_annual_dose_msv != null
                          ? <span className={cn("font-medium", Number(r.expected_annual_dose_msv) >= 20 ? "text-red-700" : Number(r.expected_annual_dose_msv) >= 6 ? "text-amber-700" : "text-gray-700")}>
                              {Number(r.expected_annual_dose_msv).toFixed(2)} mSv/año
                            </span>
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.zone_type ? (
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", ZONE_TYPE_BADGE[r.zone_type] ?? "bg-gray-100 text-gray-700")}>
                            {r.zone_type}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ResultBadge result={r.result} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(r.measurement_date).toLocaleDateString("es-CL")}
                        {r.instrument_name && <p className="text-gray-400">{r.instrument_name}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.performed_by ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-1 rounded" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className="text-gray-400 hover:text-red-600 p-1 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Regulatory note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Fundamento normativo:</strong> DS 3/1985 Art. 15 — Zonas clasificadas según tasa de dosis:{" "}
        <span className="font-medium">Controlada</span> ≥ 6 mSv/año,{" "}
        <span className="font-medium">Supervisada</span> 1–6 mSv/año,{" "}
        <span className="font-medium">Libre</span> &lt; 1 mSv/año. Conversión: tasa (µSv/h) × factor ocupación × 2000 h/año.
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? "Editar Medición Ambiental" : "Registrar Medición Ambiental"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de zona *</label>
                  <input required value={form.zone_name} onChange={e => setForm(f => ({ ...f, zone_name: e.target.value }))}
                    placeholder="Ej: Sala de Rayos X N°1"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación *</label>
                  <input required value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Ej: Pabellón B, 2° piso"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de dosis (µSv/h) *</label>
                  <input required type="number" step="0.001" min="0" value={form.dose_rate_usv_h}
                    onChange={e => setForm(f => ({ ...f, dose_rate_usv_h: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fondo (µSv/h)</label>
                  <input type="number" step="0.001" min="0" value={form.background_usv_h}
                    onChange={e => setForm(f => ({ ...f, background_usv_h: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Factor de ocupación</label>
                  <input type="number" step="0.1" min="0.1" max="1" value={form.occupancy_factor}
                    onChange={e => setForm(f => ({ ...f, occupancy_factor: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  <p className="text-xs text-gray-400 mt-0.5">1.0 = ocupación completa (2000 h/año)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instrumento</label>
                  <input value={form.instrument_name} onChange={e => setForm(f => ({ ...f, instrument_name: e.target.value }))}
                    placeholder="Ej: Graetz X5C Plus"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Realizado por</label>
                  <input value={form.performed_by} onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))}
                    placeholder="Nombre del dosimetrista"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Guardando…" : editing ? "Actualizar Medición" : "Guardar Medición"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
