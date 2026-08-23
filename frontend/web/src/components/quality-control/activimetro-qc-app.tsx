'use client';

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Printer,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { QcTrendChart } from "./qc-trend-chart";

type ActivimetroTestType =
  | "precision"
  | "exactitud"
  | "linealidad"
  | "respuesta_fondo"
  | "geometria_volumen";

type Instrument = { id: number; code: string; name: string };

type Tolerance = {
  id: number;
  test_type: string;
  parameter_name: string;
  tolerance_percent: number | null;
  tolerance_absolute: number | null;
  warning_percent: number | null;
  reference_source: string;
  protocol_version: string;
  num_readings_required: number | null;
  notes: string | null;
  active: boolean;
};

type ActivimetroTest = {
  id: number;
  instrument_id: number | null;
  instrument_code: string | null;
  instrument_name: string | null;
  test_type: ActivimetroTestType;
  test_date: string;
  test_time: string | null;
  performed_by: string | null;
  opr_reviewed_by: string | null;
  radionuclide: string | null;
  reference_source: string;
  protocol_version: string | null;
  num_readings: number | null;
  mean_value: number | null;
  stddev_value: number | null;
  cv_percent: number | null;
  reference_value: number | null;
  percent_difference: number | null;
  tolerance_percent: number | null;
  tolerance_parameter: string | null;
  regression_slope: number | null;
  regression_intercept: number | null;
  regression_r2: number | null;
  half_life_minutes: number | null;
  corrected_activity: number | null;
  result_status: "cumple" | "advertencia" | "no_cumple" | "pendiente_revision";
  observaciones: string | null;
  corrective_action: string | null;
  created_by: string | null;
};

type Reading = { value: string; label: string; unit: string; elapsedMinutes: string };

type DueAlert = {
  instrumentId: number;
  instrumentCode: string | null;
  instrumentName: string | null;
  testType: ActivimetroTestType;
  frequencyDays: number;
  lastTestDate: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  status: "overdue" | "upcoming" | "sin_registro";
};

const TEST_TYPES: Array<{
  code: ActivimetroTestType;
  label: string;
  description: string;
  needsReferenceValue: boolean;
  needsElapsed: boolean;
  needsDecay: boolean;
}> = [
  { code: "precision", label: "Precisión (repetibilidad)", description: "Lecturas repetidas de una misma fuente para evaluar dispersión (CV%).", needsReferenceValue: false, needsElapsed: false, needsDecay: false },
  { code: "exactitud", label: "Exactitud", description: "Comparación del promedio medido contra un valor de referencia certificado.", needsReferenceValue: true, needsElapsed: false, needsDecay: false },
  { code: "linealidad", label: "Linealidad", description: "Mediciones a distintos tiempos/actividades; regresión ln-ln para evaluar respuesta lineal.", needsReferenceValue: false, needsElapsed: true, needsDecay: true },
  { code: "respuesta_fondo", label: "Respuesta de fondo", description: "Medición de fondo sin fuente presente en el activímetro.", needsReferenceValue: false, needsElapsed: false, needsDecay: false },
  { code: "geometria_volumen", label: "Geometría / Volumen", description: "Efecto de la geometría/volumen de la muestra sobre la lectura.", needsReferenceValue: true, needsElapsed: false, needsDecay: false },
];

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  cumple: { label: "CUMPLE", className: "bg-green-500/15 text-green-500 border-green-500/30", icon: CheckCircle2 },
  advertencia: { label: "ADVERTENCIA / REVISAR", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30", icon: AlertTriangle },
  no_cumple: { label: "NO CUMPLE", className: "bg-red-500/15 text-red-500 border-red-500/30", icon: XCircle },
  pendiente_revision: { label: "PENDIENTE DE REVISIÓN", className: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente_revision;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${cfg.className}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {cfg.label}
    </span>
  );
}

function emptyReadings(n: number): Reading[] {
  return Array.from({ length: Math.max(n, 1) }, () => ({ value: "", label: "", unit: "µCi", elapsedMinutes: "" }));
}

const EMPTY_FORM = {
  instrumentId: "",
  instrumentCode: "",
  instrumentName: "",
  testType: "precision" as ActivimetroTestType,
  testDate: new Date().toISOString().slice(0, 10),
  testTime: "",
  performedBy: "",
  oprReviewedBy: "",
  radionuclide: "",
  referenceValue: "",
  halfLifeMinutes: "",
  referenceActivity: "",
  referenceDatetime: "",
  measurementDatetime: "",
  observaciones: "",
  correctiveAction: "",
};

export function ActivimetroQcApp({
  initialTests,
  instruments,
  tolerances,
}: {
  initialTests: ActivimetroTest[];
  instruments: Instrument[];
  tolerances: Tolerance[];
}) {
  const [tests, setTests] = useState<ActivimetroTest[]>(initialTests);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [readings, setReadings] = useState<Reading[]>(emptyReadings(3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ test: ActivimetroTest; readings: any[] } | null>(null);
  const [oprDetail, setOprDetail] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [dueAlerts, setDueAlerts] = useState<DueAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quality-control/activimetro/due-status")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDueAlerts(data.alerts || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTolerance = useMemo(
    () => tolerances.find((t) => t.test_type === form.testType && t.active) || null,
    [tolerances, form.testType]
  );

  const testTypeConfig = TEST_TYPES.find((t) => t.code === form.testType)!;

  function updateReadingCount(n: number) {
    setReadings((prev) => {
      const copy = [...prev];
      while (copy.length < n) copy.push({ value: "", label: "", unit: prev[0]?.unit || "µCi", elapsedMinutes: "" });
      while (copy.length > n) copy.pop();
      return copy;
    });
  }

  function handleTestTypeChange(code: ActivimetroTestType) {
    const tol = tolerances.find((t) => t.test_type === code && t.active);
    setForm((f) => ({ ...f, testType: code }));
    setReadings(emptyReadings(tol?.num_readings_required || 1));
    setLastResult(null);
  }

  const trendPoints = useMemo(() => {
    return tests
      .filter((t) => t.test_type === form.testType && (!form.instrumentId || String(t.instrument_id) === form.instrumentId))
      .map((t) => ({
        test_date: t.test_date,
        measured_value: t.mean_value,
        reference_value: t.reference_value,
        deviation_percent: t.percent_difference,
      }));
  }, [tests, form.testType, form.instrumentId]);

  const historyForType = useMemo(
    () => tests.filter((t) => t.test_type === form.testType).slice(0, 20),
    [tests, form.testType]
  );

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const filledReadings = readings.filter((r) => r.value !== "");
    if (filledReadings.length === 0) {
      setError("Ingrese al menos una lectura antes de calcular.");
      return;
    }
    if (testTypeConfig.needsElapsed && filledReadings.some((r) => r.elapsedMinutes === "")) {
      setError("Para linealidad debe indicar el tiempo transcurrido (min) de cada lectura.");
      return;
    }

    setSaving(true);
    try {
      const instrument = instruments.find((i) => String(i.id) === form.instrumentId);
      const res = await fetch("/api/quality-control/activimetro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: form.instrumentId || null,
          instrumentCode: instrument?.code ?? null,
          instrumentName: instrument?.name ?? null,
          testType: form.testType,
          testDate: form.testDate,
          testTime: form.testTime || null,
          performedBy: form.performedBy || null,
          oprReviewedBy: form.oprReviewedBy || null,
          radionuclide: form.radionuclide || null,
          referenceValue: testTypeConfig.needsReferenceValue ? form.referenceValue : "",
          halfLifeMinutes: testTypeConfig.needsDecay ? form.halfLifeMinutes : "",
          referenceActivity: testTypeConfig.needsDecay ? form.referenceActivity : "",
          referenceDatetime: testTypeConfig.needsDecay ? form.referenceDatetime || null : null,
          measurementDatetime: testTypeConfig.needsDecay ? form.measurementDatetime || null : null,
          observaciones: form.observaciones || null,
          correctiveAction: form.correctiveAction || null,
          readings: filledReadings.map((r, i) => ({
            value: Number(r.value),
            label: r.label || `Lectura ${i + 1}`,
            unit: r.unit || null,
            elapsedMinutes: r.elapsedMinutes !== "" ? Number(r.elapsedMinutes) : undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "save_failed");
      }
      const data = await res.json();
      setTests((prev) => [data.test, ...prev]);
      setLastResult(data);
      fetch("/api/quality-control/activimetro/due-status")
        .then((r) => r.json())
        .then((d) => setDueAlerts(d.alerts || []))
        .catch(() => {});
    } catch {
      setError("No se pudo calcular/guardar la prueba. Revise los valores ingresados e intente nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, testType: form.testType });
    setReadings(emptyReadings(activeTolerance?.num_readings_required || 1));
    setLastResult(null);
    setError(null);
  }

  function dueAlertLabel(a: DueAlert) {
    const testLabel = TEST_TYPES.find((t) => t.code === a.testType)?.label || a.testType;
    const equipo = a.instrumentName || "Equipo sin asignar";
    if (a.status === "overdue") {
      return `${equipo} — ${testLabel}: prueba VENCIDA hace ${Math.abs(a.daysUntilDue || 0)} día(s) (vencía el ${a.nextDueDate}).`;
    }
    if (a.status === "sin_registro") {
      return `${equipo} — ${testLabel}: sin registro histórico. Programar primera prueba.`;
    }
    return `${equipo} — ${testLabel}: vence en ${a.daysUntilDue} día(s) (${a.nextDueDate}).`;
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 print:p-0">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Control de Calidad — Módulo 1: Activímetro</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Pruebas de precisión, exactitud, linealidad, respuesta de fondo y geometría/volumen del activímetro
            (dose calibrator), conforme al documento QA de referencia proporcionado y a IAEA TECDOC-602. El
            operador ingresa únicamente las lecturas; el sistema calcula automáticamente promedio, desviación
            estándar, CV%, diferencia %, corrección por decaimiento y regresión cuando corresponda.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" strokeWidth={2} /> Imprimir
        </button>
      </div>

      {dueAlerts.length > 0 && (
        <div className="mb-4 space-y-1.5 print:hidden">
          {dueAlerts.map((a, idx) => (
            <div
              key={`${a.instrumentId}-${a.testType}-${idx}`}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                a.status === "overdue"
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : a.status === "sin_registro"
                  ? "border-border bg-muted/40 text-muted-foreground"
                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-600"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
              <span>{dueAlertLabel(a)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-surface p-4 print:hidden">
          <h2 className="mb-3 text-sm font-semibold">Paso 1 — Equipo, prueba y fecha</h2>
          <form onSubmit={handleCalculate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                Equipo
                <select
                  value={form.instrumentId}
                  onChange={(e) => setForm((f) => ({ ...f, instrumentId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Seleccione equipo…</option>
                  {instruments.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Prueba
                <select
                  value={form.testType}
                  onChange={(e) => handleTestTypeChange(e.target.value as ActivimetroTestType)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {TEST_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Fecha
                <input
                  type="date"
                  value={form.testDate}
                  onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-xs">
                Hora
                <input
                  type="time"
                  value={form.testTime}
                  onChange={(e) => setForm((f) => ({ ...f, testTime: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-xs">
                Operador
                <input
                  value={form.performedBy}
                  onChange={(e) => setForm((f) => ({ ...f, performedBy: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-xs">
                Radionúclido
                <input
                  value={form.radionuclide}
                  onChange={(e) => setForm((f) => ({ ...f, radionuclide: e.target.value }))}
                  placeholder="Tc-99m, I-131, F-18…"
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
            </div>

            <p className="text-[11px] text-muted-foreground">{testTypeConfig.description}</p>

            {testTypeConfig.needsReferenceValue && (
              <label className="block text-xs">
                Valor de referencia (certificado)
                <input
                  type="number"
                  step="any"
                  value={form.referenceValue}
                  onChange={(e) => setForm((f) => ({ ...f, referenceValue: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
            )}

            {testTypeConfig.needsDecay && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 p-2">
                <label className="text-xs">
                  Semivida (min)
                  <input
                    type="number"
                    step="any"
                    value={form.halfLifeMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, halfLifeMinutes: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs">
                  Actividad de referencia
                  <input
                    type="number"
                    step="any"
                    value={form.referenceActivity}
                    onChange={(e) => setForm((f) => ({ ...f, referenceActivity: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs">
                  Fecha/hora referencia
                  <input
                    type="datetime-local"
                    value={form.referenceDatetime}
                    onChange={(e) => setForm((f) => ({ ...f, referenceDatetime: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs">
                  Fecha/hora medición
                  <input
                    type="datetime-local"
                    value={form.measurementDatetime}
                    onChange={(e) => setForm((f) => ({ ...f, measurementDatetime: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Paso 2 — Lecturas ({readings.length})</h2>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateReadingCount(readings.length + 1)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
                    + lectura
                  </button>
                  <button type="button" onClick={() => updateReadingCount(Math.max(1, readings.length - 1))} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
                    − lectura
                  </button>
                </div>
              </div>
              {activeTolerance?.num_readings_required && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Protocolo sugiere {activeTolerance.num_readings_required} lectura(s) para esta prueba (
                  {activeTolerance.reference_source}, v{activeTolerance.protocol_version}).
                </p>
              )}
              <div className="space-y-2">
                {readings.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <label className="text-[11px]">
                      Lectura {idx + 1} (valor)
                      <input
                        type="number"
                        step="any"
                        value={r.value}
                        onChange={(e) => {
                          const v = e.target.value;
                          setReadings((prev) => prev.map((row, i) => (i === idx ? { ...row, value: v } : row)));
                        }}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                      />
                    </label>
                    {testTypeConfig.needsElapsed ? (
                      <label className="text-[11px]">
                        Tiempo transcurrido (min)
                        <input
                          type="number"
                          step="any"
                          value={r.elapsedMinutes}
                          onChange={(e) => {
                            const v = e.target.value;
                            setReadings((prev) => prev.map((row, i) => (i === idx ? { ...row, elapsedMinutes: v } : row)));
                          }}
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        />
                      </label>
                    ) : (
                      <label className="text-[11px]">
                        Unidad
                        <input
                          value={r.unit}
                          onChange={(e) => {
                            const v = e.target.value;
                            setReadings((prev) => prev.map((row, i) => (i === idx ? { ...row, unit: v } : row)));
                          }}
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => setReadings((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/40"
                      aria-label="Eliminar lectura"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="block text-xs">
              Observaciones
              <textarea
                value={form.observaciones}
                onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                rows={2}
              />
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> {saving ? "Calculando…" : "Calcular / Finalizar prueba"}
              </button>
              <button type="button" onClick={resetForm} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40">
                Limpiar
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {lastResult ? (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Paso 3 — Resultado</h2>
                <StatusBadge status={lastResult.test.result_status} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Valor calculado</dt>
                  <dd className="font-medium">{lastResult.test.mean_value != null ? Number(lastResult.test.mean_value).toFixed(4) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Valor de referencia</dt>
                  <dd className="font-medium">{lastResult.test.reference_value != null ? Number(lastResult.test.reference_value).toFixed(4) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Diferencia %</dt>
                  <dd className="font-medium">{lastResult.test.percent_difference != null ? `${Number(lastResult.test.percent_difference).toFixed(2)}%` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tolerancia aplicada</dt>
                  <dd className="font-medium">{lastResult.test.tolerance_percent != null ? `±${Number(lastResult.test.tolerance_percent)}%` : "Sin tolerancia definida — revisar con Físico Médico"}</dd>
                </div>
              </dl>

              <button
                onClick={() => setOprDetail((v) => !v)}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:underline"
              >
                {oprDetail ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
                {oprDetail ? "Ocultar detalle OPR" : "Ver detalle OPR (lecturas, SD, CV%, regresión)"}
              </button>

              {oprDetail && (
                <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background p-3 text-[11px]">
                  <p><span className="text-muted-foreground">N° lecturas:</span> {lastResult.test.num_readings}</p>
                  <p><span className="text-muted-foreground">Desviación estándar:</span> {lastResult.test.stddev_value != null ? Number(lastResult.test.stddev_value).toFixed(4) : "—"}</p>
                  <p><span className="text-muted-foreground">CV%:</span> {lastResult.test.cv_percent != null ? `${Number(lastResult.test.cv_percent).toFixed(2)}%` : "—"}</p>
                  {lastResult.test.regression_slope != null && (
                    <>
                      <p><span className="text-muted-foreground">Regresión ln-ln — pendiente:</span> {Number(lastResult.test.regression_slope).toFixed(5)}</p>
                      <p><span className="text-muted-foreground">Intercepto:</span> {Number(lastResult.test.regression_intercept).toFixed(5)}</p>
                      <p><span className="text-muted-foreground">R²:</span> {Number(lastResult.test.regression_r2).toFixed(4)}</p>
                    </>
                  )}
                  {lastResult.test.corrected_activity != null && (
                    <p><span className="text-muted-foreground">Actividad corregida por decaimiento:</span> {Number(lastResult.test.corrected_activity).toFixed(4)}</p>
                  )}
                  <p className="font-medium">Lecturas originales:</p>
                  <ul className="list-disc pl-4">
                    {lastResult.readings.map((r: any) => (
                      <li key={r.id}>
                        {r.reading_label || `Lectura ${r.reading_index}`}: {Number(r.measured_value)} {r.unit || ""}
                        {r.elapsed_time_minutes != null ? ` — t=${r.elapsed_time_minutes} min` : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">
                    Referencia: {lastResult.test.reference_source} — protocolo v{lastResult.test.protocol_version}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              Complete el formulario y presione "Calcular / Finalizar prueba" para ver el resultado aquí.
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">Tendencia — {testTypeConfig.label}</h2>
            <QcTrendChart points={trendPoints} unit={null} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Histórico — {testTypeConfig.label}</h2>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto text-[11px]">
              {historyForType.length === 0 && <p className="text-muted-foreground">Sin pruebas registradas para esta prueba.</p>}
              {historyForType.map((t) => (
                <div key={t.id} className="rounded border border-border/50 p-2">
                  <button
                    type="button"
                    onClick={() => setHistoryOpenId((id) => (id === t.id ? null : t.id))}
                    className="flex w-full items-center justify-between"
                  >
                    <span>
                      {t.test_date} — {t.instrument_name || "Sin equipo"} — {t.performed_by || "—"}
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.result_status} />
                      {historyOpenId === t.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                  {historyOpenId === t.id && (
                    <div className="mt-2 grid grid-cols-2 gap-1 border-t border-border/50 pt-2 text-muted-foreground">
                      <span>Promedio: {t.mean_value != null ? Number(t.mean_value).toFixed(4) : "—"}</span>
                      <span>CV%: {t.cv_percent != null ? Number(t.cv_percent).toFixed(2) : "—"}</span>
                      <span>Diferencia %: {t.percent_difference != null ? Number(t.percent_difference).toFixed(2) : "—"}</span>
                      <span>Tolerancia: {t.tolerance_percent != null ? `±${t.tolerance_percent}%` : "—"}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
