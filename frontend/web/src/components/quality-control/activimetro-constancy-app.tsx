"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mean,
  stddev,
  coefficientOfVariation,
  percentDifference,
  decayCorrectActivity,
  evaluateTolerance,
} from "@/lib/qc-activimetro-calc";

/**
 * MODULO ACTIVIMETRO - ACTIV-06: CONSTANCIA
 *
 * Definicion del catalogo configurable qc_activimetro_test_catalog:
 * "Control periodico comparando la actividad medida contra tolerancia,
 * baseline y resultado anterior."
 *
 * El radionuclido es opcional: si no se selecciona ninguno del catalogo,
 * se compara directamente la media de lecturas (sin correccion por
 * decaimiento) contra el baseline vigente del equipo y la prueba anterior.
 * La tolerancia no esta definida en el documento fuente para esta prueba:
 * el sistema informa el porcentaje de variacion, pero el resultado se
 * muestra como "pendiente de revision" hasta que el Fisico Medico
 * responsable configure una tolerancia (nunca se inventa).
 *
 * Unidad de actividad: el operador puede registrar la actividad
 * certificada y las lecturas en MBq, mCi o uCi (conversion fisica
 * estandar 1 mCi = 37 MBq; 1 uCi = 0.001 mCi = 0.037 MBq). El sistema
 * siempre convierte y almacena en MBq para mantener consistencia con el
 * baseline y las tolerancias existentes.
 */

const MCI_TO_MBQ = 37;
const UCI_TO_MBQ = 0.037;

function toMBq(value: number, unit: "MBq" | "mCi" | "uCi") {
  if (unit === "mCi") return value * MCI_TO_MBQ;
  if (unit === "uCi") return value * UCI_TO_MBQ;
  return value;
}

type Instrument = { id: number; code: string | null; name: string | null };

type Radionuclide = {
  id: number;
  name: string;
  symbol: string;
  half_life_minutes: number;
  decay_constant_per_min: number;
  unit: string | null;
};

type ToleranceConfig = {
  tolerance_percent: number | null;
  warning_percent: number | null;
  num_readings_required: number | null;
  frequency_days: number | null;
  reference_source: string;
  notes: string | null;
};

type BaselineRecord = {
  id: number;
  value: number | string | null;
  unit: string | null;
  date_established: string | null;
};

type BaselineInfo = {
  equipmentId: number | null;
  baseline: BaselineRecord | null;
};

type TestRecord = {
  id: number;
  instrument_id: number | null;
  test_date: string;
  test_time: string | null;
  performed_by: string | null;
  opr_reviewed_by: string | null;
  radionuclide: string | null;
  mean_value: number | null;
  corrected_activity: number | null;
  reference_value: number | null;
  percent_difference: number | null;
  tolerance_percent: number | null;
  result_status: string;
  observaciones: string | null;
  metadata: { percent_difference_previous?: number | null; previous_test_date?: string | null } | null;
};

const BADGE_STYLES: Record<string, string> = {
  cumple: "bg-green-100 text-green-800",
  no_cumple: "bg-red-100 text-red-800",
  advertencia: "bg-yellow-100 text-yellow-800",
  pendiente_revision: "bg-gray-100 text-gray-700",
};

const BADGE_LABELS: Record<string, string> = {
  cumple: "CUMPLE",
  no_cumple: "NO CUMPLE",
  advertencia: "REQUIERE REVISION",
  pendiente_revision: "PENDIENTE DE REVISION",
};

function ResultBadge({ result }: { result: string }) {
  const style = BADGE_STYLES[result] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={"px-2 py-0.5 rounded text-xs font-semibold " + style}>
      {BADGE_LABELS[result] ?? result}
    </span>
  );
}

function pad2(n: number) {
  return n < 10 ? "0" + n : String(n);
}

function toLocalDateTimeInputValue(d: Date) {
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
    "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
  );
}

function formatTestDate(value: string) {
  return String(value).slice(0, 10);
}

export default function ActivimetroConstancyApp() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [tolerance, setTolerance] = useState<ToleranceConfig | null>(null);
  const [baselineInfo, setBaselineInfo] = useState<BaselineInfo | null>(null);
  const [tests, setTests] = useState<TestRecord[]>([]);

  const [instrumentId, setInstrumentId] = useState("");
  const [radionuclideSymbol, setRadionuclideSymbol] = useState("");
  const [testDate, setTestDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [testTime, setTestTime] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [oprReviewedBy, setOprReviewedBy] = useState("");
  const [activityUnit, setActivityUnit] = useState<"MBq" | "mCi" | "uCi">("MBq");
  const [referenceActivity, setReferenceActivity] = useState("");
  const [referenceDatetime, setReferenceDatetime] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [measurementDatetime, setMeasurementDatetime] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [readings, setReadings] = useState<string[]>([""]);
  const [observaciones, setObservaciones] = useState("");
  const [setAsBaseline, setSetAsBaseline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog("");
    loadTests();
  }, []);

  async function loadCatalog(instId: string) {
    const url = instId
      ? "/api/quality-control/activimetro/constancy/catalog?instrument_id=" + instId
      : "/api/quality-control/activimetro/constancy/catalog";
    const res = await fetch(url);
    const data = await res.json();
    setInstruments(data.instruments ?? []);
    setRadionuclides(data.radionuclides ?? []);
    setTolerance(data.tolerance ?? null);
    setBaselineInfo(data.baselineInfo ?? null);
  }

  async function loadTests() {
    const res = await fetch("/api/quality-control/activimetro/constancy");
    const data = await res.json();
    setTests(data);
  }

  function handleInstrumentChange(value: string) {
    setInstrumentId(value);
    loadCatalog(value);
  }

  const selectedRadionuclide = useMemo(
    () => radionuclides.find((r) => r.symbol === radionuclideSymbol) ?? null,
    [radionuclides, radionuclideSymbol]
  );

  const previousTestForInstrument = useMemo(() => {
    if (!instrumentId) return null;
    return tests.find((t) => String(t.instrument_id) === instrumentId) ?? null;
  }, [tests, instrumentId]);

  const preview = useMemo(() => {
    const values = readings.filter((r) => r !== "").map((r) => Number(r)).filter((v) => !Number.isNaN(v)).map((v) => toMBq(v, activityUnit));
    if (values.length === 0) return null;

    const meanValue = mean(values);
    const stddevValue = stddev(values);
    const cvPercent = coefficientOfVariation(values);

    let measuredValue = meanValue;
    let correctedActivity: number | null = null;
    let elapsedMinutes: number | null = null;
    if (selectedRadionuclide && referenceActivity) {
      elapsedMinutes = (new Date(measurementDatetime).getTime() - new Date(referenceDatetime).getTime()) / 60000;
      correctedActivity = decayCorrectActivity(toMBq(Number(referenceActivity), activityUnit), Number(selectedRadionuclide.half_life_minutes), elapsedMinutes, "forward");
      measuredValue = correctedActivity;
    }

    const baselineValue = baselineInfo?.baseline?.value != null ? Number(baselineInfo.baseline.value) : null;
    const diffBaseline = baselineValue != null ? percentDifference(measuredValue, baselineValue) : null;

    const previousValue = previousTestForInstrument
      ? (previousTestForInstrument.corrected_activity ?? previousTestForInstrument.mean_value)
      : null;
    const diffPrevious = previousValue != null ? percentDifference(measuredValue, Number(previousValue)) : null;

    const status = evaluateTolerance(diffBaseline ?? NaN, tolerance?.tolerance_percent ?? null, tolerance?.warning_percent ?? null);

    return { meanValue, stddevValue, cvPercent, correctedActivity, elapsedMinutes, measuredValue, diffBaseline, diffPrevious, status };
  }, [readings, selectedRadionuclide, referenceActivity, referenceDatetime, measurementDatetime, baselineInfo, previousTestForInstrument, tolerance, activityUnit]);

  function updateReading(index: number, value: string) {
    setReadings((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  function addReading() {
    setReadings((prev) => [...prev, ""]);
  }

  function removeReading(index: number) {
    setReadings((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const values = readings.filter((r) => r !== "").map((r) => Number(r)).filter((v) => !Number.isNaN(v)).map((v) => toMBq(v, activityUnit));
      if (values.length === 0) throw new Error("Debe registrar al menos una lectura medida.");

      const useDecay = Boolean(selectedRadionuclide && referenceActivity);

      const res = await fetch("/api/quality-control/activimetro/constancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_id: instrumentId ? Number(instrumentId) : null,
          test_date: testDate,
          test_time: testTime || null,
          performed_by: performedBy || null,
          opr_reviewed_by: oprReviewedBy || null,
          radionuclide: radionuclideSymbol || null,
          reference_activity: useDecay ? toMBq(Number(referenceActivity), activityUnit) : null,
          reference_datetime: useDecay ? new Date(referenceDatetime).toISOString() : null,
          measurement_datetime: useDecay ? new Date(measurementDatetime).toISOString() : null,
          readings: values,
          observaciones: observaciones || null,
          set_as_baseline: setAsBaseline,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al guardar");
      }
      setMessage("Prueba de constancia registrada correctamente.");
      setObservaciones("");
      setSetAsBaseline(false);
      await loadTests();
      await loadCatalog(instrumentId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrio un error al registrar la prueba.");
    } finally {
      setLoading(false);
    }
  }

  function instrumentLabel(id: number | null) {
    if (!id) return "Sin equipo asociado";
    const inst = instruments.find((i) => i.id === id);
    if (!inst) return "Equipo #" + id;
    return (inst.name ?? "") + " (" + (inst.code ?? "s/codigo") + ")";
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ACTIV-06 - Constancia</h1>
        <p className="text-sm text-gray-500">
          Control periodico que compara la actividad medida contra la tolerancia configurada, el
          baseline vigente del equipo y el resultado de la prueba anterior. El radionuclido es
          opcional: si no se selecciona ninguno del catalogo, se compara directamente la media de
          lecturas sin correccion por decaimiento.
        </p>
        {tolerance?.notes && (
          <p className="text-xs text-amber-700 mt-1">Nota de tolerancia: {tolerance.notes}</p>
        )}
        {tolerance?.tolerance_percent == null && (
          <p className="text-xs text-amber-700 mt-1">
            Parametro no configurado. La tolerancia de esta prueba debe ser definida por el Fisico
            Medico responsable; mientras tanto el resultado se muestra como pendiente de revision.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Equipo</label>
            <select className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={instrumentId} onChange={(e) => handleInstrumentChange(e.target.value)}>
              <option value="">Sin equipo asociado</option>
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.code ?? "s/codigo"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Radionuclido (opcional)</label>
            <select className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={radionuclideSymbol} onChange={(e) => setRadionuclideSymbol(e.target.value)}>
              <option value="">Sin radionuclido (fuente de verificacion no catalogada)</option>
              {radionuclides.map((rn) => (
                <option key={rn.symbol} value={rn.symbol}>
                  {rn.name} ({rn.symbol}) T1/2 {Number(rn.half_life_minutes).toFixed(1)} min
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Fecha</label>
            <input type="date" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Hora</label>
            <input type="time" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={testTime} onChange={(e) => setTestTime(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Realizado por (operador)</label>
            <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Revisado por (fisico medico)</label>
            <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={oprReviewedBy} onChange={(e) => setOprReviewedBy(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Unidad de actividad</label>
            <select className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={activityUnit} onChange={(e) => setActivityUnit(e.target.value === "mCi" ? "mCi" : e.target.value === "uCi" ? "uCi" : "MBq")}>
              <option value="MBq">MBq</option>
              <option value="mCi">mCi</option>
              <option value="uCi">µCi</option>
            </select>
          </div>
        </div>

        {radionuclideSymbol && (
          <div className="border rounded-md p-3 space-y-3">
            <h3 className="text-sm font-semibold">Correccion por decaimiento (opcional, solo si aplica al radionuclido seleccionado)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Actividad certificada ({activityUnit})</label>
                <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={referenceActivity} onChange={(e) => setReferenceActivity(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Fecha/hora de referencia</label>
                <input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={referenceDatetime} onChange={(e) => setReferenceDatetime(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Fecha/hora de medicion</label>
                <input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={measurementDatetime} onChange={(e) => setMeasurementDatetime(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lecturas medidas ({activityUnit})</h3>
            <button type="button" onClick={addReading} className="text-xs px-2 py-1 rounded border">
              + Agregar lectura
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {readings.map((r, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  placeholder={"Lectura " + (idx + 1)}
                  className="w-full border rounded px-2 py-1 text-sm text-slate-800"
                  value={r}
                  onChange={(e) => updateReading(idx, e.target.value)}
                />
                {readings.length > 1 && (
                  <button type="button" onClick={() => removeReading(idx)} className="text-xs text-red-600">
                    x
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-1 text-sm">
          <h3 className="text-sm font-semibold mb-1">Baseline del equipo</h3>
          {!instrumentId && <p className="text-gray-500">Seleccione un equipo para ver su baseline vigente.</p>}
          {instrumentId && baselineInfo?.equipmentId == null && (
            <p className="text-amber-700">
              Este instrumento no tiene ficha tecnica de equipo vinculada (ver Ficha tecnica del
              equipo); la comparacion contra baseline no esta disponible.
            </p>
          )}
          {instrumentId && baselineInfo?.equipmentId != null && !baselineInfo.baseline && (
            <p className="text-gray-500">Sin baseline establecido todavia para este equipo en ACTIV-06.</p>
          )}
          {instrumentId && baselineInfo?.baseline && (
            <p className="text-gray-700">
              Baseline actual: {Number(baselineInfo.baseline.value).toFixed(3)} {baselineInfo.baseline.unit ?? "MBq"}
              {baselineInfo.baseline.date_established ? " (establecido " + baselineInfo.baseline.date_established + ")" : ""}
            </p>
          )}
          {instrumentId && baselineInfo?.equipmentId != null && (
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={setAsBaseline} onChange={(e) => setSetAsBaseline(e.target.checked)} />
              <span>Establecer el resultado de esta prueba como nuevo baseline</span>
            </label>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Observaciones generales</label>
          <textarea className="w-full border rounded px-2 py-1 text-sm text-slate-800" rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>

        {preview && (
          <div className="border rounded-md p-3 bg-slate-50 space-y-1 text-sm text-slate-800">
            <h3 className="text-sm font-semibold mb-1">Resultado (calculado, vista previa)</h3>
            {activityUnit === "mCi" && (
              <div className="text-xs text-amber-700">Lecturas ingresadas en mCi, convertidas automaticamente a MBq (1 mCi = 37 MBq).</div>
            )}
            {activityUnit === "uCi" && (
              <div className="text-xs text-amber-700">Lecturas ingresadas en µCi, convertidas automaticamente a MBq (1 µCi = 0.037 MBq).</div>
            )}
            <div>Media de lecturas: {preview.meanValue.toFixed(3)} MBq</div>
            <div>Desviacion estandar: {preview.stddevValue.toFixed(3)} MBq</div>
            <div>CV%: {preview.cvPercent.toFixed(2)}%</div>
            {preview.correctedActivity != null && (
              <div>Valor corregido por decaimiento: {preview.correctedActivity.toFixed(3)} MBq</div>
            )}
            <div>
              Diferencia % vs baseline: {preview.diffBaseline != null ? preview.diffBaseline.toFixed(2) + "%" : "Sin baseline disponible"}
            </div>
            <div>
              Diferencia % vs prueba anterior: {preview.diffPrevious != null ? preview.diffPrevious.toFixed(2) + "%" : "Sin prueba anterior registrada"}
            </div>
            <div className="flex items-center gap-2">
              <span>Resultado:</span>
              <ResultBadge result={preview.status} />
            </div>
            {tolerance?.tolerance_percent == null && (
              <div className="text-xs text-amber-700">Parametro no configurado. Debe ser definido por el Fisico Medico responsable.</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 text-white text-sm">
            {loading ? "Guardando..." : "Registrar prueba"}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      </form>

      <div>
        <h2 className="text-lg font-semibold mb-2">Historial de pruebas ACTIV-06</h2>
        <div className="border rounded-lg divide-y">
          {tests.length === 0 && <div className="p-3 text-sm text-gray-500">Sin pruebas registradas.</div>}
          {tests.map((t) => (
            <div key={t.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="text-sm">
                  <span className="font-medium">{formatTestDate(t.test_date)}</span>{" "}
                  {t.test_time ? t.test_time + " - " : ""}
                  {t.radionuclide ? t.radionuclide + " - " : ""}
                  {instrumentLabel(t.instrument_id)}
                  {t.performed_by ? " - " + t.performed_by : ""}
                </div>
                <ResultBadge result={t.result_status} />
              </div>
              <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-3">
                <span>Media: {t.mean_value != null ? Number(t.mean_value).toFixed(3) : "-"} MBq</span>
                <span>Vs. baseline: {t.percent_difference != null ? Number(t.percent_difference).toFixed(2) + "%" : "-"}</span>
                <span>
                  Vs. prueba anterior:{" "}
                  {t.metadata?.percent_difference_previous != null ? Number(t.metadata.percent_difference_previous).toFixed(2) + "%" : "-"}
                </span>
                <span>Tolerancia: {t.tolerance_percent != null ? "+/-" + t.tolerance_percent + "%" : "No configurada"}</span>
              </div>
              {t.observaciones && <div className="text-xs text-gray-600 mt-1">Observaciones: {t.observaciones}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
