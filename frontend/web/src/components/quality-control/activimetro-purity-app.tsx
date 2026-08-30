"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * MODULO ACTIVIMETRO - ACTIV-07: PUREZA RADIONUCLEIDICA DE 99mTc
 *
 * Definicion del catalogo configurable qc_activimetro_test_catalog:
 * "Evaluar la pureza radionucleidica del eluido de 99mTc mediante prueba
 * guiada de 12 pasos (identificacion, muestra, procedimiento,
 * preparacion, configuracion, fondo, mediciones, impurezas, calculo,
 * evaluacion, revision, validacion)." responsible_level = fisico_medico.
 *
 * El limite de aceptacion del % de impureza (paso 10, Evaluacion) NO esta
 * definido en el documento fuente: se muestra "Parametro no configurado"
 * hasta que el Fisico Medico responsable lo configure. El % de impureza
 * (paso 8) es aritmetica basica (impureza / eluido x 100), no una
 * tolerancia inventada.
 *
 * Unidad de actividad: el operador puede registrar las lecturas en MBq o
 * en mCi (conversion fisica estandar 1 mCi = 37 MBq). El sistema siempre
 * convierte y almacena en MBq para mantener consistencia con las
 * tolerancias y comparaciones existentes; la unidad elegida solo afecta
 * la forma de captura.
 */

const MCI_TO_MBQ = 37;

function toMBq(value: number, unit: "MBq" | "mCi") {
  return unit === "mCi" ? value * MCI_TO_MBQ : value;
}

type Instrument = { id: number; code: string | null; name: string | null };

type Radionuclide = {
  name: string;
  symbol: string;
  half_life_minutes: number;
};

type ToleranceConfig = {
  tolerance_percent: number | null;
  frequency_days: number | null;
  notes: string | null;
};

type PurityTest = {
  id: number;
  instrument_id: number | null;
  test_date: string;
  test_time: string | null;
  performed_by: string | null;
  physicist_reviewed_by: string | null;
  generator_batch: string | null;
  eluate_volume_ml: number | null;
  eluate_activity_mbq: number | null;
  procedure_reference: string | null;
  preparation_method: string | null;
  materials_used: string | null;
  geometry: string | null;
  energy_window: string | null;
  background_reading: number | null;
  eluate_reading: number | null;
  impurity_type: string | null;
  impurity_reading: number | null;
  impurity_percent: number | null;
  formula_used: string | null;
  tolerance_percent: number | null;
  result_status: string;
  review_notes: string | null;
  review_status: string | null;
  validated_by: string | null;
  final_status: string | null;
  observaciones: string | null;
};

const BADGE_STYLES: Record<string, string> = {
  cumple: "bg-green-100 text-green-800",
  no_cumple: "bg-red-100 text-red-800",
  pendiente_revision: "bg-gray-100 text-gray-700",
  pendiente: "bg-gray-100 text-gray-700",
  aprobado: "bg-green-100 text-green-800",
  rechazado: "bg-red-100 text-red-800",
};

const BADGE_LABELS: Record<string, string> = {
  cumple: "CUMPLE",
  no_cumple: "NO CUMPLE",
  pendiente_revision: "PENDIENTE DE REVISION",
  pendiente: "PENDIENTE",
  aprobado: "APROBADO",
  rechazado: "RECHAZADO",
};

function StatusBadge({ result }: { result: string | null | undefined }) {
  const key = result ?? "pendiente_revision";
  const style = BADGE_STYLES[key] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={"px-2 py-0.5 rounded text-xs font-semibold " + style}>
      {BADGE_LABELS[key] ?? key}
    </span>
  );
}

function formatTestDate(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "-";
}

const emptyForm = {
  instrumentId: "",
  testDate: new Date().toISOString().substring(0, 10),
  testTime: "",
  performedBy: "",
  physicistReviewedBy: "",
  generatorBatch: "",
  elutionDatetime: "",
  eluateVolumeMl: "",
  eluateActivityMbq: "",
  procedureReference: "",
  preparationMethod: "",
  materialsUsed: "",
  geometry: "",
  energyWindow: "",
  backgroundReading: "",
  eluateReading: "",
  impurityType: "Mo-99 (breakthrough)",
  impurityReading: "",
  observaciones: "",
};

export default function ActivimetroPurityApp() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [tolerance, setTolerance] = useState<ToleranceConfig | null>(null);
  const [tests, setTests] = useState<PurityTest[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [activityUnit, setActivityUnit] = useState<"MBq" | "mCi">("MBq");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [reviewOpenId, setReviewOpenId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("aprobado");
  const [validatedBy, setValidatedBy] = useState("");

  useEffect(() => {
    loadCatalog();
    loadTests();
  }, []);

  async function loadCatalog() {
    const res = await fetch("/api/quality-control/activimetro/purity/catalog");
    const data = await res.json();
    setInstruments(data.instruments ?? []);
    setRadionuclides(data.radionuclides ?? []);
    setTolerance(data.tolerance ?? null);
  }

  async function loadTests() {
    const res = await fetch("/api/quality-control/activimetro/purity");
    const data = await res.json();
    setTests(Array.isArray(data) ? data : []);
  }

  function updateField<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const tc99m = useMemo(() => radionuclides.find((r) => r.symbol === "99mTc") ?? null, [radionuclides]);

  const preview = useMemo(() => {
    const eluateReading = Number(form.eluateReading);
    const impurityReading = form.impurityReading !== "" ? Number(form.impurityReading) : null;
    if (!eluateReading || Number.isNaN(eluateReading)) return null;
    const impurityPercent =
      impurityReading != null && !Number.isNaN(impurityReading) ? (impurityReading / eluateReading) * 100 : null;
    let status = "pendiente_revision";
    if (impurityPercent != null && tolerance?.tolerance_percent != null) {
      status = impurityPercent <= tolerance.tolerance_percent ? "cumple" : "no_cumple";
    }
    return { impurityPercent, status };
  }, [form.eluateReading, form.impurityReading, tolerance]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!form.eluateReading) {
        throw new Error("La lectura del eluido (paso 7, Mediciones) es obligatoria.");
      }
      const res = await fetch("/api/quality-control/activimetro/purity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_id: form.instrumentId ? Number(form.instrumentId) : null,
          test_date: form.testDate,
          test_time: form.testTime || null,
          performed_by: form.performedBy || null,
          physicist_reviewed_by: form.physicistReviewedBy || null,
          generator_batch: form.generatorBatch || null,
          elution_datetime: form.elutionDatetime ? new Date(form.elutionDatetime).toISOString() : null,
          eluate_volume_ml: form.eluateVolumeMl ? Number(form.eluateVolumeMl) : null,
          eluate_activity_mbq: form.eluateActivityMbq ? toMBq(Number(form.eluateActivityMbq), activityUnit) : null,
          procedure_reference: form.procedureReference || null,
          preparation_method: form.preparationMethod || null,
          materials_used: form.materialsUsed || null,
          geometry: form.geometry || null,
          energy_window: form.energyWindow || null,
          background_reading: form.backgroundReading ? toMBq(Number(form.backgroundReading), activityUnit) : null,
          eluate_reading: toMBq(Number(form.eluateReading), activityUnit),
          impurity_type: form.impurityType || null,
          impurity_reading: form.impurityReading ? toMBq(Number(form.impurityReading), activityUnit) : null,
          observaciones: form.observaciones || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al guardar");
      }
      setMessage("Prueba de pureza radionucleidica (ACTIV-07) registrada correctamente.");
      setForm(emptyForm);
      await loadTests();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrio un error al registrar la prueba.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewSubmit(id: number) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quality-control/activimetro/purity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          review_notes: reviewNotes || null,
          review_status: reviewStatus,
          validated_by: validatedBy || null,
          final_status: reviewStatus,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al revisar/validar");
      }
      setMessage("Revision y validacion (pasos 11 y 12) registradas correctamente.");
      setReviewOpenId(null);
      setReviewNotes("");
      setValidatedBy("");
      await loadTests();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrio un error al revisar/validar la prueba.");
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
        <h1 className="text-2xl font-bold">ACTIV-07 - Pureza radionucleidica de 99mTc</h1>
        <p className="text-sm text-gray-500">
          Prueba guiada de 12 pasos (identificacion, muestra, procedimiento, preparacion,
          configuracion, fondo, mediciones, impurezas, calculo, evaluacion, revision, validacion)
          para evaluar la pureza radionucleidica del eluido de 99mTc.
          {tc99m && " T1/2 99mTc: " + Number(tc99m.half_life_minutes).toFixed(1) + " min."}
        </p>
        {tolerance?.notes && <p className="text-xs text-amber-700 mt-1">Nota de tolerancia: {tolerance.notes}</p>}
        {tolerance?.tolerance_percent == null && (
          <p className="text-xs text-amber-700 mt-1">
            Parametro no configurado. El limite de aceptacion de impureza debe ser definido por el
            Fisico Medico responsable; mientras tanto el resultado se muestra como pendiente de
            revision.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 1 - Identificacion</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Equipo</label>
              <select className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.instrumentId} onChange={(e) => updateField("instrumentId", e.target.value)}>
                <option value="">Sin equipo asociado</option>
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.code ?? "s/codigo"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha</label>
              <input type="date" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.testDate} onChange={(e) => updateField("testDate", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Hora</label>
              <input type="time" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.testTime} onChange={(e) => updateField("testTime", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Realizado por (operador)</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.performedBy} onChange={(e) => updateField("performedBy", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fisico medico responsable</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.physicistReviewedBy} onChange={(e) => updateField("physicistReviewedBy", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Unidad de actividad</label>
              <select className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={activityUnit} onChange={(e) => setActivityUnit(e.target.value === "mCi" ? "mCi" : "MBq")}>
                <option value="MBq">MBq</option>
                <option value="mCi">mCi</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 2 - Muestra (eluido de 99mTc)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Lote / generador</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.generatorBatch} onChange={(e) => updateField("generatorBatch", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha/hora de elucion</label>
              <input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.elutionDatetime} onChange={(e) => updateField("elutionDatetime", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Volumen del eluido (mL)</label>
              <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.eluateVolumeMl} onChange={(e) => updateField("eluateVolumeMl", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Actividad del eluido ({activityUnit})</label>
              <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.eluateActivityMbq} onChange={(e) => updateField("eluateActivityMbq", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 3 - Procedimiento</h3>
          <div>
            <label className="text-sm font-medium block mb-1">Referencia del procedimiento institucional utilizado</label>
            <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.procedureReference} onChange={(e) => updateField("procedureReference", e.target.value)} placeholder="Codigo/version del procedimiento (ver Procedimientos institucionales)" />
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 4 - Preparacion</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Metodo de preparacion utilizado</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.preparationMethod} onChange={(e) => updateField("preparationMethod", e.target.value)} placeholder="Descripcion del metodo real aplicado" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Materiales utilizados</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.materialsUsed} onChange={(e) => updateField("materialsUsed", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 5 - Configuracion del activimetro</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Geometria</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.geometry} onChange={(e) => updateField("geometry", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Ventana de energia / configuracion</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.energyWindow} onChange={(e) => updateField("energyWindow", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 6 - Fondo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Lectura de fondo ({activityUnit})</label>
              <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.backgroundReading} onChange={(e) => updateField("backgroundReading", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <h3 className="text-sm font-semibold">Paso 7 - Mediciones</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Lectura del eluido de 99mTc ({activityUnit}) *</label>
              <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.eluateReading} onChange={(e) => updateField("eluateReading", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Tipo de impureza</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.impurityType} onChange={(e) => updateField("impurityType", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Lectura de la impureza ({activityUnit})</label>
              <input type="number" step="any" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={form.impurityReading} onChange={(e) => updateField("impurityReading", e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Observaciones generales</label>
          <textarea className="w-full border rounded px-2 py-1 text-sm text-slate-800" rows={3} value={form.observaciones} onChange={(e) => updateField("observaciones", e.target.value)} />
        </div>

        {preview && (
          <div className="border rounded-md p-3 bg-slate-50 space-y-1 text-sm text-slate-800">
            <h3 className="text-sm font-semibold mb-1">Pasos 8 a 10 - Impurezas, calculo y evaluacion (vista previa)</h3>
            <div>
              Formula: % impureza = (Actividad de impureza / Actividad del eluido) x 100 (aritmetica
              basica; el % es independiente de la unidad siempre que ambas lecturas usen la misma).
            </div>
            <div>
              % de impureza calculado:{" "}
              {preview.impurityPercent != null ? preview.impurityPercent.toFixed(4) + "%" : "Sin lectura de impureza"}
            </div>
            <div className="flex items-center gap-2">
              <span>Resultado:</span>
              <StatusBadge result={preview.status} />
            </div>
            {tolerance?.tolerance_percent == null && (
              <div className="text-xs text-amber-700">Parametro no configurado. Debe ser definido por el Fisico Medico responsable.</div>
            )}
            {tolerance?.tolerance_percent != null && (
              <div>Limite de aceptacion configurado: {tolerance.tolerance_percent}%</div>
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
        <h2 className="text-lg font-semibold mb-2">Historial de pruebas ACTIV-07</h2>
        <div className="border rounded-lg divide-y">
          {tests.length === 0 && <div className="p-3 text-sm text-gray-500">Sin pruebas registradas.</div>}
          {tests.map((t) => (
            <div key={t.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="text-sm">
                  <span className="font-medium">{formatTestDate(t.test_date)}</span>{" "}
                  {t.test_time ? t.test_time + " - " : ""}
                  99mTc - {instrumentLabel(t.instrument_id)}
                  {t.performed_by ? " - " + t.performed_by : ""}
                </div>
                <StatusBadge result={t.result_status} />
              </div>
              <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-3">
                <span>Eluido: {t.eluate_reading != null ? Number(t.eluate_reading).toFixed(3) : "-"} MBq</span>
                <span>Impureza ({t.impurity_type ?? "-"}): {t.impurity_reading != null ? Number(t.impurity_reading).toFixed(4) : "-"} MBq</span>
                <span>% impureza: {t.impurity_percent != null ? Number(t.impurity_percent).toFixed(4) + "%" : "-"}</span>
                <span>Limite: {t.tolerance_percent != null ? t.tolerance_percent + "%" : "No configurado"}</span>
              </div>
              <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-3">
                <span>Paso 11 (Revision): {t.review_status ? <StatusBadge result={t.review_status} /> : "Pendiente"}</span>
                <span>Paso 12 (Validacion): {t.validated_by ? "Validado por " + t.validated_by : "Pendiente"}</span>
              </div>
              {t.observaciones && <div className="text-xs text-gray-600 mt-1">Observaciones: {t.observaciones}</div>}

              {reviewOpenId === t.id ? (
                <div className="mt-2 border rounded-md p-3 space-y-2 bg-slate-50 text-slate-800">
                  <h4 className="text-xs font-semibold">Pasos 11 y 12 - Revision y validacion</h4>
                  <textarea className="w-full border rounded px-2 py-1 text-sm" rows={2} placeholder="Notas de revision" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select className="w-full border rounded px-2 py-1 text-sm" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                      <option value="aprobado">Aprobado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                    <input type="text" className="w-full border rounded px-2 py-1 text-sm" placeholder="Validado por (fisico medico)" value={validatedBy} onChange={(e) => setValidatedBy(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={loading} onClick={() => handleReviewSubmit(t.id)} className="px-3 py-1 rounded bg-blue-600 text-white text-xs">
                      Guardar revision/validacion
                    </button>
                    <button type="button" onClick={() => setReviewOpenId(null)} className="px-3 py-1 rounded border text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setReviewOpenId(t.id)} className="mt-2 text-xs px-2 py-1 rounded border">
                  Revisar y validar (pasos 11-12)
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
