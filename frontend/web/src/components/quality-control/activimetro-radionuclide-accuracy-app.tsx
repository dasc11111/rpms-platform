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
 * MODULO ACTIVIMETRO - ACTIV-05: EXACTITUD POR RADIONUCLIDO
 * (seccion 12 del prompt maestro QA/QC Activimetros)
 *
 * Repite la evaluacion de exactitud (ACTIV-02) para el radionucleido
 * seleccionado desde el catalogo configurable. La correccion por
 * decaimiento entre la calibracion de la fuente de referencia y el
 * instante de medicion se calcula automaticamente con la vida media
 * del catalogo; el operador solo introduce actividad certificada,
 * fechas/horas y lecturas medidas.
 */

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

type TestRecord = {
  id: number;
  instrument_id: number | null;
  test_date: string;
  test_time: string | null;
  performed_by: string | null;
  opr_reviewed_by: string | null;
  radionuclide: string | null;
  num_readings: number | null;
  mean_value: number | null;
  reference_activity: number | null;
  corrected_activity: number | null;
  percent_difference: number | null;
  tolerance_percent: number | null;
  result_status: string;
  observaciones: string | null;
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

export default function ActivimetroRadionuclideAccuracyApp() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [tolerance, setTolerance] = useState<ToleranceConfig | null>(null);
  const [tests, setTests] = useState<TestRecord[]>([]);

  const [instrumentId, setInstrumentId] = useState("");
  const [radionuclideSymbol, setRadionuclideSymbol] = useState("");
  const [testDate, setTestDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [testTime, setTestTime] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [oprReviewedBy, setOprReviewedBy] = useState("");
  const [referenceActivity, setReferenceActivity] = useState("");
  const [referenceDatetime, setReferenceDatetime] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [measurementDatetime, setMeasurementDatetime] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [readings, setReadings] = useState<string[]>(["", "", ""]);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quality-control/activimetro/radionuclide-accuracy/catalog")
      .then((r) => r.json())
      .then((data) => {
        setInstruments(data.instruments ?? []);
        setRadionuclides(data.radionuclides ?? []);
        setTolerance(data.tolerance ?? null);
        const n = data.tolerance?.num_readings_required;
        if (n && n > 0) {
          setReadings(Array.from({ length: n }, () => ""));
        }
      });
    loadTests();
  }, []);

  async function loadTests() {
    const res = await fetch("/api/quality-control/activimetro/radionuclide-accuracy");
    const data = await res.json();
    setTests(data);
  }

  const selectedRadionuclide = useMemo(
    () => radionuclides.find((r) => r.symbol === radionuclideSymbol) ?? null,
    [radionuclides, radionuclideSymbol]
  );

  const preview = useMemo(() => {
    const values = readings.filter((r) => r !== "").map((r) => Number(r)).filter((v) => !Number.isNaN(v));
    if (!selectedRadionuclide || !referenceActivity || values.length === 0) return null;
    const meanValue = mean(values);
    const stddevValue = stddev(values);
    const cvPercent = coefficientOfVariation(values);
    const elapsedMinutes = (new Date(measurementDatetime).getTime() - new Date(referenceDatetime).getTime()) / 60000;
    const correctedActivity = decayCorrectActivity(Number(referenceActivity), Number(selectedRadionuclide.half_life_minutes), elapsedMinutes, "forward");
    const diff = percentDifference(meanValue, correctedActivity);
    const status = evaluateTolerance(diff, tolerance?.tolerance_percent ?? null, tolerance?.warning_percent ?? null);
    return { meanValue, stddevValue, cvPercent, correctedActivity, diff, status, elapsedMinutes };
  }, [readings, selectedRadionuclide, referenceActivity, referenceDatetime, measurementDatetime, tolerance]);

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
      const values = readings.filter((r) => r !== "").map((r) => Number(r)).filter((v) => !Number.isNaN(v));
      if (!radionuclideSymbol) throw new Error("Debe seleccionar un radionucleido del catalogo.");
      if (!referenceActivity) throw new Error("Debe indicar la actividad certificada de la fuente de referencia.");
      if (values.length === 0) throw new Error("Debe registrar al menos una lectura medida.");

      const res = await fetch("/api/quality-control/activimetro/radionuclide-accuracy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_id: instrumentId ? Number(instrumentId) : null,
          test_date: testDate,
          test_time: testTime || null,
          performed_by: performedBy || null,
          opr_reviewed_by: oprReviewedBy || null,
          radionuclide: radionuclideSymbol,
          reference_activity: Number(referenceActivity),
          reference_datetime: new Date(referenceDatetime).toISOString(),
          measurement_datetime: new Date(measurementDatetime).toISOString(),
          readings: values,
          observaciones: observaciones || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al guardar");
      }
      setMessage("Prueba de exactitud por radionuclido registrada correctamente.");
      setObservaciones("");
      await loadTests();
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
        <h1 className="text-2xl font-bold">ACTIV-05 - Exactitud por Radionuclido</h1>
        <p className="text-sm text-gray-500">
          Repite la evaluacion de exactitud (ACTIV-02) para el radionucleido seleccionado del catalogo
          configurable. La correccion por decaimiento entre la calibracion de la fuente de referencia y el
          instante de medicion se calcula automaticamente con la vida media del catalogo.
        </p>
        {tolerance?.notes && (
          <p className="text-xs text-amber-700 mt-1">Nota de tolerancia: {tolerance.notes}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Equipo</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
              <option value="">Sin equipo asociado</option>
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.code ?? "s/codigo"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Radionuclido</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={radionuclideSymbol} onChange={(e) => setRadionuclideSymbol(e.target.value)}>
              <option value="">Seleccionar...</option>
              {radionuclides.map((rn) => (
                <option key={rn.symbol} value={rn.symbol}>
                  {rn.name} ({rn.symbol}) T1/2 {Number(rn.half_life_minutes).toFixed(1)} min
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Fecha</label>
            <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Hora</label>
            <input type="time" className="w-full border rounded px-2 py-1 text-sm" value={testTime} onChange={(e) => setTestTime(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Realizado por (operador)</label>
            <input type="text" className="w-full border rounded px-2 py-1 text-sm" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Revisado por (fisico medico)</label>
            <input type="text" className="w-full border rounded px-2 py-1 text-sm" value={oprReviewedBy} onChange={(e) => setOprReviewedBy(e.target.value)} />
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Fuente de referencia certificada</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Actividad certificada (MBq)</label>
              <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm" value={referenceActivity} onChange={(e) => setReferenceActivity(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha/hora de referencia (calibracion)</label>
              <input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm" value={referenceDatetime} onChange={(e) => setReferenceDatetime(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha/hora de medicion</label>
              <input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm" value={measurementDatetime} onChange={(e) => setMeasurementDatetime(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lecturas medidas (MBq)</h3>
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
                  className="w-full border rounded px-2 py-1 text-sm"
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
          {tolerance?.num_readings_required && (
            <p className="text-xs text-gray-500">Numero minimo de lecturas requerido por protocolo: {tolerance.num_readings_required}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Observaciones generales</label>
          <textarea className="w-full border rounded px-2 py-1 text-sm" rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>

        {preview && (
          <div className="border rounded-md p-3 bg-slate-50 space-y-1 text-sm">
            <h3 className="text-sm font-semibold mb-1">Resultado (calculado, vista previa)</h3>
            <div>Media de lecturas: {preview.meanValue.toFixed(3)} MBq</div>
            <div>Desviacion estandar: {preview.stddevValue.toFixed(3)} MBq</div>
            <div>CV%: {preview.cvPercent.toFixed(2)}%</div>
            <div>Tiempo transcurrido desde calibracion: {preview.elapsedMinutes.toFixed(1)} min</div>
            <div>Actividad de referencia corregida por decaimiento: {preview.correctedActivity.toFixed(3)} MBq</div>
            <div>Diferencia %: {preview.diff.toFixed(2)}%</div>
            <div className="flex items-center gap-2">
              <span>Resultado:</span>
              <ResultBadge result={preview.status} />
            </div>
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
        <h2 className="text-lg font-semibold mb-2">Historial de pruebas ACTIV-05</h2>
        <div className="border rounded-lg divide-y">
          {tests.length === 0 && <div className="p-3 text-sm text-gray-500">Sin pruebas registradas.</div>}
          {tests.map((t) => (
            <div key={t.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="text-sm">
                  <span className="font-medium">{t.test_date}</span>{" "}
                  {t.test_time ? t.test_time + " - " : ""}
                  {t.radionuclide ? t.radionuclide + " - " : ""}
                  {instrumentLabel(t.instrument_id)}
                  {t.performed_by ? " - " + t.performed_by : ""}
                </div>
                <ResultBadge result={t.result_status} />
              </div>
              <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-3">
                <span>Media: {t.mean_value != null ? Number(t.mean_value).toFixed(3) : "-"} MBq</span>
                <span>Ref. corregida: {t.corrected_activity != null ? Number(t.corrected_activity).toFixed(3) : "-"} MBq</span>
                <span>Diferencia: {t.percent_difference != null ? Number(t.percent_difference).toFixed(2) : "-"}%</span>
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
