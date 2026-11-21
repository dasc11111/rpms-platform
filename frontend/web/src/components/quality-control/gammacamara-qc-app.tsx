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
  Bell,
} from "lucide-react";
import { QcTrendChart } from "./qc-trend-chart";

type GammacamaraTestType = "uniformidad" | "resolucion" | "sensibilidad";
type GammacamaraTestMode = "intrinseca" | "extrinseca" | "na";

type Instrument = { id: number; code: string; name: string };

type Tolerance = {
  id: number;
  test_type: string;
  test_mode: string;
  parameter_name: string;
  tolerance_percent: number | null;
  warning_percent: number | null;
  reference_source: string;
  protocol_version: string;
  num_readings_required: number | null;
  notes: string | null;
  active: boolean;
};

type GammacamaraTest = {
  id: number;
  instrument_id: number | null;
  instrument_code: string | null;
  instrument_name: string | null;
  test_type: GammacamaraTestType;
  test_mode: GammacamaraTestMode;
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
  integral_percent: number | null;
  differential_percent: number | null;
  integral_status: string | null;
  differential_status: string | null;
  worst_parameter: string | null;
  corrected_activity: number | null;
  result_status: "cumple" | "advertencia" | "no_cumple" | "pendiente_revision";
  observaciones: string | null;
  corrective_action: string | null;
  created_by: string | null;
};

type Reading = { value: string; label: string; unit: string };

type DueAlert = {
  instrumentId: number;
  instrumentCode: string | null;
  instrumentName: string | null;
  testType: string;
  testMode: string;
  frequencyDays: number;
  lastTestDate: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  status: "overdue" | "upcoming" | "sin_registro";
};

const TEST_TYPES: Array<{
  code: GammacamaraTestType;
  label: string;
  description: string;
  hasMode: boolean;
  needsReferenceValue: boolean;
}> = [
  {
    code: "uniformidad",
    label: "Uniformidad",
    description:
      "Uniformidad integral y diferencial de la imagen de flood, calculadas por el software de adquisicion de la gammacamara (intrinseca sin colimador, o extrinseca con colimador).",
    hasMode: true,
    needsReferenceValue: false,
  },
  {
    code: "resolucion",
    label: "Resolucion espacial",
    description:
      "FWHM del patron de barras u otro metodo de resolucion espacial, comparado contra el valor basal establecido en la prueba de aceptacion del equipo.",
    hasMode: false,
    needsReferenceValue: true,
  },
  {
    code: "sensibilidad",
    label: "Sensibilidad",
    description:
      "Tasa de conteo por unidad de actividad, comparada contra el valor basal establecido en la prueba de aceptacion del equipo. Permite correccion opcional por decaimiento.",
    hasMode: false,
    needsReferenceValue: true,
  },
];

const MODE_LABELS: Record<string, string> = {
  intrinseca: "Intrinseca (sin colimador)",
  extrinseca: "Extrinseca (con colimador)",
  na: "No aplica",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  cumple: { label: "CUMPLE", className: "bg-green-500/15 text-green-500 border-green-500/30", icon: CheckCircle2 },
  advertencia: { label: "ADVERTENCIA / REVISAR", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30", icon: AlertTriangle },
  no_cumple: { label: "NO CUMPLE", className: "bg-red-500/15 text-red-500 border-red-500/30", icon: XCircle },
  pendiente_revision: { label: "PENDIENTE DE REVISION", className: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente_revision!;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${cfg.className}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {cfg.label}
    </span>
  );
}

function dueAlertLabel(a: DueAlert): string {
  const modeLabel = a.testMode !== "na" ? ` (${MODE_LABELS[a.testMode] || a.testMode})` : "";
  const typeLabel = TEST_TYPES.find((t) => t.code === a.testType)?.label || a.testType;
  if (a.status === "sin_registro") return `${typeLabel}${modeLabel} - sin registro para ${a.instrumentName || "equipo sin nombre"}`;
  if (a.status === "overdue") return `${typeLabel}${modeLabel} - ${a.instrumentName || "equipo"} atrasada ${Math.abs(a.daysUntilDue || 0)} dia(s) (venció ${a.nextDueDate})`;
  return `${typeLabel}${modeLabel} - ${a.instrumentName || "equipo"} vence en ${a.daysUntilDue} dia(s) (${a.nextDueDate})`;
}

function emptyReadings(n: number): Reading[] {
  return Array.from({ length: Math.max(n, 1) }, () => ({ value: "", label: "", unit: "mm" }));
}

const EMPTY_FORM = {
  instrumentId: "",
  testType: "uniformidad" as GammacamaraTestType,
  testMode: "intrinseca" as GammacamaraTestMode,
  testDate: new Date().toISOString().slice(0, 10),
  testTime: "",
  performedBy: "",
  oprReviewedBy: "",
  radionuclide: "",
  referenceValue: "",
  integralPercent: "",
  differentialPercent: "",
  halfLifeMinutes: "",
  referenceActivity: "",
  referenceDatetime: "",
  measurementDatetime: "",
  observaciones: "",
  correctiveAction: "",
};
export function GammacamaraQcApp({
  initialTests,
  instruments,
  tolerances,
}: {
  initialTests: GammacamaraTest[];
  instruments: Instrument[];
  tolerances: Tolerance[];
}) {
  const [tests, setTests] = useState<GammacamaraTest[]>(initialTests);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [readings, setReadings] = useState<Reading[]>(emptyReadings(1));
  const [useDecay, setUseDecay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ test: GammacamaraTest; readings: any[] } | null>(null);
  const [oprDetail, setOprDetail] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [dueAlerts, setDueAlerts] = useState<DueAlert[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/quality-control/gammacamara/due-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.alerts) setDueAlerts(data.alerts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const testTypeConfig = TEST_TYPES.find((t) => t.code === form.testType)!;

  const activeTolerances = useMemo(
    () => tolerances.filter((t) => t.test_type === form.testType && t.test_mode === form.testMode && t.active),
    [tolerances, form.testType, form.testMode]
  );

  function handleTestTypeChange(code: GammacamaraTestType) {
    const cfg = TEST_TYPES.find((t) => t.code === code)!;
    setForm((f) => ({ ...f, testType: code, testMode: cfg.hasMode ? f.testMode || "intrinseca" : "na" }));
    setReadings(emptyReadings(1));
    setUseDecay(false);
    setLastResult(null);
    setError(null);
  }

  function updateReadingCount(n: number) {
    setReadings((prev) => {
      const copy = [...prev];
      while (copy.length < n) copy.push({ value: "", label: "", unit: prev[0]?.unit || "mm" });
      while (copy.length > n) copy.pop();
      return copy;
    });
  }

  const trendPoints = useMemo(() => {
    return tests
      .filter(
        (t) =>
          t.test_type === form.testType &&
          (form.testType !== "uniformidad" || t.test_mode === form.testMode) &&
          (!form.instrumentId || String(t.instrument_id) === form.instrumentId)
      )
      .map((t) => {
        if (t.test_type === "uniformidad") {
          return {
            test_date: t.test_date,
            measured_value: t.integral_percent,
            reference_value: null,
            deviation_percent: t.differential_percent,
          };
        }
        return {
          test_date: t.test_date,
          measured_value: t.mean_value,
          reference_value: t.reference_value,
          deviation_percent: t.percent_difference,
        };
      });
  }, [tests, form.testType, form.testMode, form.instrumentId]);

  const historyForType = useMemo(
    () =>
      tests
        .filter((t) => t.test_type === form.testType && (form.testType !== "uniformidad" || t.test_mode === form.testMode))
        .slice(0, 20),
    [tests, form.testType, form.testMode]
  );

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const instrument = instruments.find((i) => String(i.id) === form.instrumentId);
    const payload: any = {
      instrumentId: form.instrumentId || null,
      instrumentCode: instrument?.code ?? null,
      instrumentName: instrument?.name ?? null,
      testType: form.testType,
      testMode: form.testMode,
      testDate: form.testDate,
      testTime: form.testTime || null,
      performedBy: form.performedBy || null,
      oprReviewedBy: form.oprReviewedBy || null,
      radionuclide: form.radionuclide || null,
      observaciones: form.observaciones || null,
      correctiveAction: form.correctiveAction || null,
    };

    if (form.testType === "uniformidad") {
      if (form.integralPercent === "" || form.differentialPercent === "") {
        setError("Ingrese los valores de uniformidad integral y diferencial reportados por el equipo.");
        return;
      }
      payload.integralPercent = form.integralPercent;
      payload.differentialPercent = form.differentialPercent;
    } else {
      const filledReadings = readings.filter((r) => r.value !== "");
      if (filledReadings.length === 0) {
        setError("Ingrese al menos una lectura antes de calcular.");
        return;
      }
      payload.readings = filledReadings.map((r, i) => ({
        value: Number(r.value),
        label: r.label || `Lectura ${i + 1}`,
        unit: r.unit || null,
      }));
      payload.referenceValue = form.referenceValue;
      if (form.testType === "sensibilidad" && useDecay) {
        payload.halfLifeMinutes = form.halfLifeMinutes;
        payload.referenceActivity = form.referenceActivity;
        payload.referenceDatetime = form.referenceDatetime || null;
        payload.measurementDatetime = form.measurementDatetime || null;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/quality-control/gammacamara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "save_failed");
      }
      const data = await res.json();
      setTests((prev) => [data.test, ...prev]);
      setLastResult(data);
    } catch {
      setError("No se pudo calcular/guardar la prueba. Revise los valores ingresados e intente nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, testType: form.testType, testMode: form.testMode });
    setReadings(emptyReadings(1));
    setUseDecay(false);
    setLastResult(null);
    setError(null);
  }

  const overdueCount = dueAlerts.filter((a) => a.status === "overdue").length;
  const upcomingCount = dueAlerts.filter((a) => a.status === "upcoming").length;
  const sinRegistroCount = dueAlerts.filter((a) => a.status === "sin_registro").length;

  return (
    <div className="mx-auto max-w-[1400px] p-6 print:p-0">
      {dueAlerts.length > 0 && !bannerDismissed && (
        <div
          className={`mb-4 flex items-start justify-between gap-3 rounded-lg border p-3 print:hidden ${
            overdueCount > 0
              ? "border-red-500/40 bg-red-500/10"
              : upcomingCount > 0
              ? "border-yellow-500/40 bg-yellow-500/10"
              : "border-border bg-muted/30"
          }`}
        >
          <div className="flex items-start gap-2">
            <Bell
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                overdueCount > 0 ? "text-red-500" : upcomingCount > 0 ? "text-yellow-500" : "text-muted-foreground"
              }`}
              strokeWidth={2}
            />
            <div className={`text-xs ${overdueCount > 0 ? "text-red-500" : upcomingCount > 0 ? "text-yellow-500" : "text-muted-foreground"}`}>
              <p className="font-medium">
                Avisos de Control de Calidad - Gammacamara: {overdueCount} atrasada(s), {upcomingCount} proxima(s) a vencer
                {sinRegistroCount > 0 ? `, ${sinRegistroCount} sin registro previo` : ""}.
              </p>
              <ul className="mt-1 list-disc pl-4">
                {dueAlerts.slice(0, 6).map((a, idx) => (
                  <li key={idx}>{dueAlertLabel(a)}</li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={() => setBannerDismissed(true)} aria-label="Cerrar alerta" className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Control de Calidad - Modulo 2: Gammacamara</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Pruebas de uniformidad, resolucion espacial y sensibilidad de la gammacamara planar, conforme a IAEA
            TECDOC-602. El operador ingresa unicamente los valores medidos o reportados por el equipo; el sistema
            clasifica automaticamente el resultado contra la tolerancia configurada.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" strokeWidth={2} /> Imprimir
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-surface p-4 print:hidden">
          <h2 className="mb-3 text-sm font-semibold">Paso 1 - Equipo, prueba y fecha</h2>
          <form onSubmit={handleCalculate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                Equipo
                <select
                  value={form.instrumentId}
                  onChange={(e) => setForm((f) => ({ ...f, instrumentId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Seleccione equipo...</option>
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
                  onChange={(e) => handleTestTypeChange(e.target.value as GammacamaraTestType)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {TEST_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {testTypeConfig.hasMode && (
                <label className="text-xs">
                  Modo
                  <select
                    value={form.testMode}
                    onChange={(e) => setForm((f) => ({ ...f, testMode: e.target.value as GammacamaraTestMode }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="intrinseca">Intrinseca (sin colimador)</option>
                    <option value="extrinseca">Extrinseca (con colimador)</option>
                  </select>
                </label>
              )}
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
                Radionuclido
                <input
                  value={form.radionuclide}
                  onChange={(e) => setForm((f) => ({ ...f, radionuclide: e.target.value }))}
                  placeholder="Tc-99m, Co-57..."
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
            </div>

            <p className="text-[11px] text-muted-foreground">{testTypeConfig.description}</p>

            {form.testType === "uniformidad" ? (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 p-2">
                <label className="text-xs">
                  Uniformidad integral (%)
                  <input
                    type="number"
                    step="any"
                    value={form.integralPercent}
                    onChange={(e) => setForm((f) => ({ ...f, integralPercent: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs">
                  Uniformidad diferencial (%)
                  <input
                    type="number"
                    step="any"
                    value={form.differentialPercent}
                    onChange={(e) => setForm((f) => ({ ...f, differentialPercent: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
            ) : (
              <>
                <label className="block text-xs">
                  Valor de referencia (basal de aceptacion)
                  <input
                    type="number"
                    step="any"
                    value={form.referenceValue}
                    onChange={(e) => setForm((f) => ({ ...f, referenceValue: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </label>

                {form.testType === "sensibilidad" && (
                  <label className="flex items-center gap-2 text-[11px]">
                    <input type="checkbox" checked={useDecay} onChange={(e) => setUseDecay(e.target.checked)} />
                    Aplicar correccion por decaimiento de la fuente entre calibracion y medicion
                  </label>
                )}

                {form.testType === "sensibilidad" && useDecay && (
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
                      Fecha/hora medicion
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
                    <h2 className="text-sm font-semibold">Paso 2 - Lecturas ({readings.length})</h2>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateReadingCount(readings.length + 1)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
                        + lectura
                      </button>
                      <button type="button" onClick={() => updateReadingCount(Math.max(1, readings.length - 1))} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
                        - lectura
                      </button>
                    </div>
                  </div>
                  {activeTolerances[0]?.num_readings_required && (
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Protocolo sugiere {activeTolerances[0].num_readings_required} lectura(s) para esta prueba (
                      {activeTolerances[0].reference_source}, v{activeTolerances[0].protocol_version}).
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
              </>
            )}

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
                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> {saving ? "Calculando..." : "Calcular / Finalizar prueba"}
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
                <h2 className="text-sm font-semibold">Paso 3 - Resultado</h2>
                <StatusBadge status={lastResult.test.result_status} />
              </div>

              {lastResult.test.test_type === "uniformidad" ? (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Uniformidad integral</dt>
                    <dd className="font-medium">
                      {lastResult.test.integral_percent != null ? `${Number(lastResult.test.integral_percent).toFixed(2)}%` : "-"}{" "}
                      {lastResult.test.integral_status && <StatusBadge status={lastResult.test.integral_status} />}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Uniformidad diferencial</dt>
                    <dd className="font-medium">
                      {lastResult.test.differential_percent != null ? `${Number(lastResult.test.differential_percent).toFixed(2)}%` : "-"}{" "}
                      {lastResult.test.differential_status && <StatusBadge status={lastResult.test.differential_status} />}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Tolerancia aplicada</dt>
                    <dd className="font-medium">
                      {lastResult.test.tolerance_percent != null ? `±${Number(lastResult.test.tolerance_percent)}%` : "Sin tolerancia definida - revisar con Fisico Medico"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Valor calculado</dt>
                    <dd className="font-medium">{lastResult.test.mean_value != null ? Number(lastResult.test.mean_value).toFixed(4) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Valor de referencia</dt>
                    <dd className="font-medium">{lastResult.test.reference_value != null ? Number(lastResult.test.reference_value).toFixed(4) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Diferencia %</dt>
                    <dd className="font-medium">{lastResult.test.percent_difference != null ? `${Number(lastResult.test.percent_difference).toFixed(2)}%` : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tolerancia aplicada</dt>
                    <dd className="font-medium">
                      {lastResult.test.tolerance_percent != null ? `±${Number(lastResult.test.tolerance_percent)}%` : "Sin tolerancia definida - revisar con Fisico Medico"}
                    </dd>
                  </div>
                </dl>
              )}

              <button
                onClick={() => setOprDetail((v) => !v)}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:underline"
              >
                {oprDetail ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
                {oprDetail ? "Ocultar detalle OPR" : "Ver detalle OPR (lecturas, SD, CV%)"}
              </button>

              {oprDetail && (
                <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background p-3 text-[11px]">
                  <p><span className="text-muted-foreground">N° lecturas:</span> {lastResult.test.num_readings}</p>
                  {lastResult.test.stddev_value != null && (
                    <p><span className="text-muted-foreground">Desviacion estandar:</span> {Number(lastResult.test.stddev_value).toFixed(4)}</p>
                  )}
                  {lastResult.test.cv_percent != null && (
                    <p><span className="text-muted-foreground">CV%:</span> {Number(lastResult.test.cv_percent).toFixed(2)}%</p>
                  )}
                  {lastResult.test.corrected_activity != null && (
                    <p><span className="text-muted-foreground">Actividad corregida por decaimiento:</span> {Number(lastResult.test.corrected_activity).toFixed(4)}</p>
                  )}
                  {lastResult.test.worst_parameter && (
                    <p><span className="text-muted-foreground">Parametro determinante del resultado:</span> {lastResult.test.worst_parameter}</p>
                  )}
                  <p className="font-medium">Lecturas / valores originales:</p>
                  <ul className="list-disc pl-4">
                    {lastResult.readings.map((r: any) => (
                      <li key={r.id}>
                        {r.reading_label || `Lectura ${r.reading_index}`}: {Number(r.measured_value)} {r.unit || ""}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">
                    Referencia: {lastResult.test.reference_source} - protocolo v{lastResult.test.protocol_version}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              Complete el formulario y presione "Calcular / Finalizar prueba" para ver el resultado aqui.
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">
              Tendencia - {testTypeConfig.label}
              {testTypeConfig.hasMode ? ` (${MODE_LABELS[form.testMode]})` : ""}
            </h2>
            <QcTrendChart points={trendPoints} unit={null} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Historico - {testTypeConfig.label}
                {testTypeConfig.hasMode ? ` (${MODE_LABELS[form.testMode]})` : ""}
              </h2>
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
                      {t.test_date} - {t.instrument_name || "Sin equipo"} - {t.performed_by || "-"}
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.result_status} />
                      {historyOpenId === t.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                  {historyOpenId === t.id && (
                    <div className="mt-2 grid grid-cols-2 gap-1 border-t border-border/50 pt-2 text-muted-foreground">
                      {t.test_type === "uniformidad" ? (
                        <>
                          <span>Integral: {t.integral_percent != null ? `${Number(t.integral_percent).toFixed(2)}%` : "-"}</span>
                          <span>Diferencial: {t.differential_percent != null ? `${Number(t.differential_percent).toFixed(2)}%` : "-"}</span>
                        </>
                      ) : (
                        <>
                          <span>Promedio: {t.mean_value != null ? Number(t.mean_value).toFixed(4) : "-"}</span>
                          <span>Diferencia %: {t.percent_difference != null ? Number(t.percent_difference).toFixed(2) : "-"}</span>
                        </>
                      )}
                      <span>Tolerancia: {t.tolerance_percent != null ? `±${t.tolerance_percent}%` : "-"}</span>
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
