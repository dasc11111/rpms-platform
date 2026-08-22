'use client';

import { useMemo, useState } from "react";
import { Plus, X, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import {
  QC_TEST_TYPES,
  QC_RESULT_LABELS,
  QcResultStatus,
  getQcTestTypeConfig,
  getQcDueStatus,
} from "@/lib/quality-control";

type Instrument = { id: number; code: string; name: string };

type QcTest = {
  id: number;
  instrument_id: number | null;
  instrument_code: string | null;
  instrument_name: string | null;
  test_type: string;
  test_date: string;
  performed_by: string | null;
  radionuclide: string | null;
  measured_value: number | null;
  reference_value: number | null;
  unit: string | null;
  tolerance_percent: number | null;
  deviation_percent: number | null;
  result_status: QcResultStatus;
  corrective_action: string | null;
  notes: string | null;
};

function StatusBadge({ status }: { status: QcResultStatus }) {
  const map: Record<QcResultStatus, string> = {
    conforme: "bg-green-500/15 text-green-500",
    no_conforme: "bg-red-500/15 text-red-500",
    pendiente_revision: "bg-yellow-500/15 text-yellow-500",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[status]}`}>
      {QC_RESULT_LABELS[status]}
    </span>
  );
}

const EMPTY_FORM = {
  instrumentId: "",
  testType: "constancia",
  testDate: new Date().toISOString().slice(0, 10),
  performedBy: "",
  radionuclide: "",
  measuredValue: "",
  referenceValue: "",
  unit: "",
  tolerancePercent: "",
  notes: "",
};

export function QualityControlApp({
  initialTests,
  instruments,
}: {
  initialTests: QcTest[];
  instruments: Instrument[];
}) {
  const [tests, setTests] = useState<QcTest[]>(initialTests);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (filterType && t.test_type !== filterType) return false;
      if (filterStatus && t.result_status !== filterStatus) return false;
      return true;
    });
  }, [tests, filterType, filterStatus]);

  const dueSummary = useMemo(() => {
    return QC_TEST_TYPES.filter((t) => t.suggestedFrequencyDays !== null).map((cfg) => {
      const relevant = tests
        .filter((t) => t.test_type === cfg.code)
        .sort((a, b) => (a.test_date < b.test_date ? 1 : -1));
      const last = relevant[0]?.test_date ?? null;
      const due = getQcDueStatus(last, cfg.suggestedFrequencyDays);
      return { cfg, last, due };
    });
  }, [tests]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const instrument = instruments.find((i) => String(i.id) === form.instrumentId);
      const res = await fetch("/api/quality-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: form.instrumentId || null,
          instrumentCode: instrument?.code ?? null,
          instrumentName: instrument?.name ?? null,
          testType: form.testType,
          testDate: form.testDate,
          performedBy: form.performedBy,
          radionuclide: form.radionuclide,
          measuredValue: form.measuredValue,
          referenceValue: form.referenceValue,
          unit: form.unit,
          tolerancePercent: form.tolerancePercent,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setTests((prev) => [data.test, ...prev]);
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    } catch {
      setError("No se pudo guardar la prueba. Intente nuevamente.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Control de Calidad</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Nueva prueba
        </button>
      </div>
      <p className="mb-6 max-w-3xl text-xs text-muted-foreground">
        Registro de pruebas internas de control de calidad (constancia, exactitud, linealidad, geometria,
        uniformidad, resolucion, sensibilidad) para activimetros y equipos de deteccion de Medicina Nuclear,
        complementario a la calibracion externa certificada del modulo Instrumentos y Calibracion. Las
        frecuencias sugeridas son valores de referencia configurables; deben ser validadas por el Oficial de
        Proteccion Radiologica segun procedimiento interno o normativa vigente.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dueSummary.map(({ cfg, last, due }) => (
          <div key={cfg.code} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-1.5">
              {due === "vencida" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" strokeWidth={2} />}
              {due === "proxima" && <Clock className="h-3.5 w-3.5 text-yellow-500" strokeWidth={2} />}
              {due === "al_dia" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" strokeWidth={2} />}
              {due === "sin_registro" && <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />}
              <span className="text-xs font-medium">{cfg.label}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {last ? `Ultima: ${last}` : "Sin registro"} - cada {cfg.suggestedFrequencyDays} dia(s)
            </span>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
        >
          <option value="">Todos los tipos</option>
          {QC_TEST_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
        >
          <option value="">Todos los resultados</option>
          {Object.entries(QC_RESULT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo de prueba</th>
              <th className="px-3 py-2">Instrumento</th>
              <th className="px-3 py-2">Valor medido</th>
              <th className="px-3 py-2">Valor referencia</th>
              <th className="px-3 py-2">Desviacion</th>
              <th className="px-3 py-2">Resultado</th>
              <th className="px-3 py-2">Realizada por</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2">{t.test_date}</td>
                <td className="px-3 py-2">{getQcTestTypeConfig(t.test_type)?.label ?? t.test_type}</td>
                <td className="px-3 py-2">{t.instrument_name ?? "-"}</td>
                <td className="px-3 py-2">
                  {t.measured_value ?? "-"} {t.unit ?? ""}
                </td>
                <td className="px-3 py-2">
                  {t.reference_value ?? "-"} {t.unit ?? ""}
                </td>
                <td className="px-3 py-2">
                  {t.deviation_percent !== null ? `${t.deviation_percent.toFixed(2)}%` : "-"}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.result_status} />
                </td>
                <td className="px-3 py-2">{t.performed_by ?? "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No hay pruebas registradas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-4 max-h-[90vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nueva prueba de control de calidad</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <label className="col-span-2 flex flex-col gap-1 text-xs">
                Instrumento
                <select
                  value={form.instrumentId}
                  onChange={(e) => setForm({ ...form, instrumentId: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                >
                  <option value="">Sin asociar</option>
                  {instruments.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} - {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Tipo de prueba
                <select
                  value={form.testType}
                  onChange={(e) => setForm({ ...form, testType: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                >
                  {QC_TEST_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Fecha
                <input
                  type="date"
                  value={form.testDate}
                  onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Realizada por
                <input
                  type="text"
                  value={form.performedBy}
                  onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Radionuclido usado
                <input
                  type="text"
                  value={form.radionuclide}
                  onChange={(e) => setForm({ ...form, radionuclide: e.target.value })}
                  placeholder="Ej: Cs-137, Co-57, Tc-99m"
                  className="rounded-md border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Valor medido
                <input
                  type="number"
                  step="any"
                  value={form.measuredValue}
                  onChange={(e) => setForm({ ...form, measuredValue: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Valor de referencia
                <input
                  type="number"
                  step="any"
                  value={form.referenceValue}
                  onChange={(e) => setForm({ ...form, referenceValue: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Unidad
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="Ej: mCi, %, cpm"
                  className="rounded-md border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Tolerancia (%)
                <input
                  type="number"
                  step="any"
                  value={form.tolerancePercent}
                  onChange={(e) => setForm({ ...form, tolerancePercent: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs">
                Notas
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                  rows={2}
                />
              </label>
              {error && <p className="col-span-2 text-xs text-red-500">{error}</p>}
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
