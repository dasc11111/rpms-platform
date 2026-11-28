"use client";


import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, Clock, Plus, Trash2, Pencil, RefreshCw, Gauge, Battery, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckRecord {
  id: number;
  instrument_id: number;
  instrument_name: string;
  instrument_code: string | null;
  check_source_name: string | null;
  check_date: string;
  reference_reading: number | null;
  actual_reading: number;
  deviation_pct: number | null;
  result: "pass" | "fail" | "marginal";
  battery_ok: boolean;
  background_reading: number | null;
  performed_by: string | null;
  notes: string | null;
  days_since_check?: number;
}

interface ApiResponse {
  records: CheckRecord[];
  stats: {
    total: number;
    pass: number;
    fail: number;
    marginal: number;
    overdue: number;
  };
}

const RESULT_CONFIG = {
  pass:     { label: "Conforme",   color: "text-green-700", bg: "bg-green-50",  border: "border-green-400", icon: CheckCircle },
  marginal: { label: "Marginal",   color: "text-amber-700", bg: "bg-amber-50",  border: "border-amber-400", icon: AlertCircle },
  fail:     { label: "Falla",      color: "text-red-700",   bg: "bg-red-50",    border: "border-red-500",   icon: AlertTriangle },
};

function ResultBadge({ result }: { result: "pass" | "fail" | "marginal" }) {
  const cfg = RESULT_CONFIG[result];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function DeviationBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground text-xs">—</span>;
  const abs = Math.abs(pct);
  const color = abs > 10 ? "bg-red-500" : abs > 5 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-muted rounded-full h-1.5">
        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${Math.min(abs * 5, 100)}%` }} />
      </div>
      <span className={cn("text-xs tabular-nums font-medium", abs > 10 ? "text-red-700" : abs > 5 ? "text-amber-700" : "text-green-700")}>
        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function OperationalCheckPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CheckRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState({
    instrument_id: "",
    instrument_name: "",
    instrument_code: "",
    check_source_name: "",
    check_source_activity_kbq: "",
    reference_reading: "",
    actual_reading: "",
    battery_ok: true,
    background_reading: "",
    performed_by: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/instruments/operational-check?summary=1");
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live deviation preview
  const previewDeviation = (() => {
    const actual = parseFloat(form.actual_reading);
    const ref = parseFloat(form.reference_reading);
    if (isNaN(actual) || isNaN(ref) || ref === 0) return null;
    return ((actual - ref) / ref) * 100;
  })();

  const previewResult = previewDeviation == null ? null
    : Math.abs(previewDeviation) > 10 ? "fail"
    : Math.abs(previewDeviation) > 5 ? "marginal"
    : "pass";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        instrument_id: parseInt(form.instrument_id) || 0,
        instrument_name: form.instrument_name,
        instrument_code: form.instrument_code || null,
        check_source_name: form.check_source_name || null,
        check_source_activity_kbq: form.check_source_activity_kbq ? parseFloat(form.check_source_activity_kbq) : null,
        reference_reading: form.reference_reading ? parseFloat(form.reference_reading) : null,
        actual_reading: parseFloat(form.actual_reading),
        battery_ok: form.battery_ok,
        background_reading: form.background_reading ? parseFloat(form.background_reading) : null,
        performed_by: form.performed_by || null,
        notes: form.notes || null,
      };
      if (editing) {
        await fetch(`/api/instruments/operational-check?id=${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/instruments/operational-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      setForm({ instrument_id: "", instrument_name: "", instrument_code: "", check_source_name: "", check_source_activity_kbq: "", reference_reading: "", actual_reading: "", battery_ok: true, background_reading: "", performed_by: "", notes: "" });
      fetchData();
    } finally { setSaving(false); }
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const openEdit = (r: CheckRecord) => {
    setEditing(r);
    setForm({
      instrument_id: String(r.instrument_id),
      instrument_name: r.instrument_name ?? "",
      instrument_code: r.instrument_code ?? "",
      check_source_name: r.check_source_name ?? "",
      check_source_activity_kbq: "",
      reference_reading: r.reference_reading != null ? String(r.reference_reading) : "",
      actual_reading: r.actual_reading != null ? String(r.actual_reading) : "",
      battery_ok: r.battery_ok !== false,
      background_reading: r.background_reading != null ? String(r.background_reading) : "",
      performed_by: r.performed_by ?? "",
      notes: r.notes ?? "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro de verificación?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/instruments/operational-check?id=${id}`, { method: "DELETE" });
      fetchData();
    } finally { setDeleting(null); }
  };

  const stats = data?.stats;
  const records = data?.records ?? [];
  const hasFails = (stats?.fail_count ?? stats?.fail ?? 0) > 0;
  const hasOverdue = (stats?.overdue ?? 0) > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gauge className="w-7 h-7 text-blue-600" />
            Verificación Operacional de Instrumentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verificación pre-uso con fuente patrón · NS-06.0 §8.3 — CCHEN
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted/50">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Registrar Verificación
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {hasFails && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Instrumento(s) con falla en verificación</p>
            <p className="text-sm text-red-700 mt-1">
              Desviación &gt; ±10% respecto al valor de referencia. No usar el instrumento hasta resolución técnica.
            </p>
          </div>
        </div>
      )}
      {hasOverdue && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Instrumento(s) sin verificación diaria</p>
            <p className="text-sm text-amber-700 mt-1">
              {stats?.overdue} instrumento(s) con última verificación hace más de 1 día. NS-06.0 §8.3 requiere verificación antes de cada uso.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-background border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Instrumentos Verificados</p>
          <p className="text-3xl font-bold text-foreground mt-1">{loading ? "—" : (stats?.total ?? 0)}</p>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", hasFails ? "bg-red-50 border-red-300" : "bg-background")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Con Falla</p>
          <p className={cn("text-3xl font-bold mt-1", hasFails ? "text-red-700" : "text-foreground")}>
            {loading ? "—" : (stats?.fail ?? 0)}
          </p>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", (stats?.marginal ?? 0) > 0 ? "bg-amber-50 border-amber-200" : "bg-background")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Marginales</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{loading ? "—" : (stats?.marginal ?? 0)}</p>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", hasOverdue ? "bg-amber-50 border-amber-200" : "bg-background")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sin verif. hoy</p>
          <p className={cn("text-3xl font-bold mt-1", hasOverdue ? "text-amber-700" : "text-foreground")}>
            {loading ? "—" : (stats?.overdue ?? 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-background border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Última Verificación por Instrumento</h2>
          <span className="text-xs text-muted-foreground ml-2">Criterio: desviación ≤ ±10% (NS-06.0 §8.3)</span>
        </div>
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando verificaciones…</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Gauge className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sin verificaciones registradas.</p>
            <p className="text-sm mt-1">Registre la primera verificación pre-uso.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Instrumento</th>
                  <th className="text-left px-4 py-3">Fuente Patrón</th>
                  <th className="text-left px-4 py-3">Lectura Ref.</th>
                  <th className="text-left px-4 py-3">Lectura Real</th>
                  <th className="text-left px-4 py-3">Desviación</th>
                  <th className="text-left px-4 py-3">Batería</th>
                  <th className="text-left px-4 py-3">Resultado</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Realizado por</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r) => {
                  const overdue = (r.days_since_check ?? 0) > 1;
                  return (
                    <tr key={r.id} className={cn(
                      "hover:bg-muted/50 transition-colors",
                      r.result === "fail" && "bg-red-50/40",
                      overdue && r.result !== "fail" && "bg-amber-50/30"
                    )}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{r.instrument_name}</p>
                        {r.instrument_code && <p className="text-xs text-muted-foreground">{r.instrument_code}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.check_source_name ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground/80">
                        {r.reference_reading != null ? `${Number(r.reference_reading).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium">
                        {Number(r.actual_reading).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <DeviationBar pct={r.deviation_pct != null ? Number(r.deviation_pct) : null} />
                      </td>
                      <td className="px-4 py-3">
                        {r.battery_ok
                          ? <span className="text-green-600 flex items-center gap-1 text-xs"><Battery className="w-3.5 h-3.5" /> OK</span>
                          : <span className="text-red-600 flex items-center gap-1 text-xs"><Battery className="w-3.5 h-3.5" /> Baja</span>
                        }
                      </td>
                      <td className="px-4 py-3"><ResultBadge result={r.result} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        <div>{new Date(r.check_date).toLocaleDateString("es-CL")}</div>
                        {overdue && <div className="text-amber-600 font-medium">{r.days_since_check}d sin verif.</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.performed_by ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-blue-600 p-1 rounded" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className="text-muted-foreground hover:text-red-600 p-1 rounded"
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
        <strong>Fundamento normativo:</strong> NS-06.0 §8.3 CCHEN — Los instrumentos de monitoreo deben verificarse operacionalmente
        antes de cada uso con una fuente de verificación (check source). Criterio de aceptación: desviación ≤ ±10% del valor de referencia.
        Desviación &gt; ±10%: instrumento fuera de servicio hasta mantención.
        Desviación 5–10%: registrar y monitorear tendencia.
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? "Editar Verificación Operacional" : "Registrar Verificación Operacional"}</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-muted-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Nombre del instrumento *</label>
                  <input required value={form.instrument_name}
                    onChange={e => setForm(f => ({ ...f, instrument_name: e.target.value }))}
                    placeholder="Ej: Graetz X5C Plus – Contaminímetro"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Código / N° serie</label>
                  <input value={form.instrument_code}
                    onChange={e => setForm(f => ({ ...f, instrument_code: e.target.value }))}
                    placeholder="INS-001"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">ID instrumento</label>
                  <input type="number" value={form.instrument_id}
                    onChange={e => setForm(f => ({ ...f, instrument_id: e.target.value }))}
                    placeholder="1"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fuente de Verificación (Check Source)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Fuente patrón</label>
                  <input value={form.check_source_name}
                    onChange={e => setForm(f => ({ ...f, check_source_name: e.target.value }))}
                    placeholder="Ej: Sr-90, 37 kBq"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Actividad ref. (kBq)</label>
                  <input type="number" step="0.001" value={form.check_source_activity_kbq}
                    onChange={e => setForm(f => ({ ...f, check_source_activity_kbq: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lecturas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Lectura de referencia</label>
                  <input type="number" step="0.001" value={form.reference_reading}
                    onChange={e => setForm(f => ({ ...f, reference_reading: e.target.value }))}
                    placeholder="µSv/h o cps"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Lectura real *</label>
                  <input required type="number" step="0.001" value={form.actual_reading}
                    onChange={e => setForm(f => ({ ...f, actual_reading: e.target.value }))}
                    placeholder="µSv/h o cps"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                {/* Live preview */}
                {previewDeviation != null && (
                  <div className={cn("col-span-2 rounded-lg p-3 text-sm font-medium flex items-center gap-2",
                    previewResult === "fail" ? "bg-red-50 text-red-700 border border-red-300"
                    : previewResult === "marginal" ? "bg-amber-50 text-amber-700 border border-amber-300"
                    : "bg-green-50 text-green-700 border border-green-300"
                  )}>
                    {previewResult === "fail" ? <AlertTriangle className="w-4 h-4" />
                      : previewResult === "marginal" ? <AlertCircle className="w-4 h-4" />
                      : <CheckCircle className="w-4 h-4" />}
                    Desviación: {previewDeviation > 0 ? "+" : ""}{previewDeviation.toFixed(1)}% →{" "}
                    {previewResult === "fail" ? "FALLA (> ±10%)" : previewResult === "marginal" ? "MARGINAL (5–10%)" : "CONFORME (≤ ±5%)"}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Fondo (background)</label>
                  <input type="number" step="0.001" value={form.background_reading}
                    onChange={e => setForm(f => ({ ...f, background_reading: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" id="battery_ok" checked={form.battery_ok}
                    onChange={e => setForm(f => ({ ...f, battery_ok: e.target.checked }))}
                    className="w-4 h-4 rounded border-border" />
                  <label htmlFor="battery_ok" className="text-sm font-medium text-foreground/80 flex items-center gap-1">
                    <Battery className="w-4 h-4" /> Batería OK
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Realizado por</label>
                  <input value={form.performed_by}
                    onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))}
                    placeholder="Nombre del operador"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Notas</label>
                  <textarea value={form.notes} rows={2}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-muted/50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Guardando…" : editing ? "Actualizar Verificación" : "Guardar Verificación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
