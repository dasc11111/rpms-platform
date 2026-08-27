"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 4 - PET/CT - FASE B
 * Pruebas de aceptacion y control de calidad PET (PET-01 a PET-06, seccion
 * 5 del prompt de mejora). El operador solo ingresa los valores medidos;
 * el servidor calcula razon, estado (CUMPLE/NO CUMPLE/REQUIERE
 * REVISION/NO APLICA) y nivel de accion (normal/advertencia/no
 * conformidad) usando qc-petct-calc.ts. PET-06 se oculta como
 * incumplimiento si el equipo no tiene TOF (se muestra NO APLICA).
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
  has_tof: boolean;
};

type PetTestCode = "PET-01" | "PET-02" | "PET-03" | "PET-04" | "PET-05" | "PET-06" | "PET-ESTAB" | "PET-CONC" | "PET-SUV-CAL";

type PetTestRecord = {
  id: number;
  equipment_id: number | null;
  test_code: PetTestCode;
  performed_at: string;
  operator: string;
  phantom: string | null;
  radionuclide: string | null;
  activity_mbq: number | null;
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments: string | null;
  is_finalized: boolean;
  finalized_by: string | null;
  supersedes_id: number | null;
};

const TEST_LABELS: Record<PetTestCode, string> = {
  "PET-01": "PET-01 Resolucion espacial",
  "PET-02": "PET-02 Sensibilidad",
  "PET-03": "PET-03 SF, perdidas de conteo y NEC",
  "PET-04": "PET-04 Resolucion energetica",
  "PET-05": "PET-05 Calidad de imagen y atenuacion/dispersion",
  "PET-06": "PET-06 Coincidencia temporal (TOF)",
  "PET-ESTAB": "PET-ESTAB Estabilidad del detector (rutina)",
  "PET-CONC": "PET-CONC Concentracion de radioactividad",
  "PET-SUV-CAL": "PET-SUV-CAL Calibracion de concentracion / SUV",
};

const STATUS_STYLES: Record<string, string> = {
  cumple: "bg-green-100 text-green-800 border-green-300",
  no_cumple: "bg-red-100 text-red-800 border-red-300",
  requiere_revision: "bg-yellow-100 text-yellow-800 border-yellow-300",
  no_aplica: "bg-gray-100 text-gray-600 border-gray-300",
};

const ACTION_LEVEL_LABELS: Record<string, string> = {
  normal: "Normal",
  advertencia: "Advertencia (cerca del limite)",
  no_conformidad: "No conformidad",
  no_aplica: "No aplica",
};

const COMPONENT_OPTIONS = [
  { value: "cumple", label: "Cumple" },
  { value: "no_cumple", label: "No cumple" },
  { value: "requiere_revision", label: "Requiere revision" },
];

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.requiere_revision;
  const label =
    status === "cumple" ? "CUMPLE" : status === "no_cumple" ? "NO CUMPLE" : status === "no_aplica" ? "NO APLICA" : "REQUIERE REVISION";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{label}</span>;
}

export default function PetCtPetTestsApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | null>(equipment[0]?.id ?? null);
  const [testCode, setTestCode] = useState<PetTestCode>("PET-01");
  const [operator, setOperator] = useState("");
  const [phantom, setPhantom] = useState("");
  const [radionuclide, setRadionuclide] = useState("F-18");
  const [activityMbq, setActivityMbq] = useState<string>("");
  const [protocolAcquisition, setProtocolAcquisition] = useState("");
  const [protocolReconstruction, setProtocolReconstruction] = useState("");
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<PetTestRecord[]>([]);
  const [lastResult, setLastResult] = useState<PetTestRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId) ?? null;
  const hasTof = selectedEquipment?.has_tof ?? false;

  async function loadHistory() {
    if (!equipmentId) {
      setHistory([]);
      return;
    }
    const res = await fetch(`/api/quality-control/petct/pet-tests?equipment_id=${equipmentId}&test_code=${testCode}`);
    const data = await res.json();
    setHistory(data);
  }

  useEffect(() => {
    loadHistory();
    setRawInputs({});
    setLastResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, testCode]);

  function updateRaw(key: string, value: string) {
    setRawInputs((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!operator) {
      setMessage("Indique el operador que realiza el control.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quality-control/petct/pet-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId,
          test_code: testCode,
          operator,
          phantom,
          radionuclide,
          activity_mbq: activityMbq === "" ? null : Number(activityMbq),
          protocol_acquisition: protocolAcquisition,
          protocol_reconstruction: protocolReconstruction,
          raw_inputs: rawInputs,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al registrar el control");
      }
      const created = await res.json();
      setLastResult(created);
      setMessage("Control registrado como borrador. Revise el resultado y finalice cuando corresponda.");
      await loadHistory();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al registrar el control");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize(id: number) {
    const finalizedBy = window.prompt("Nombre de quien finaliza el control (OPR / Fisico Medico):");
    if (!finalizedBy) return;
    const res = await fetch(`/api/quality-control/petct/pet-tests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalizar", finalized_by: finalizedBy }),
    });
    if (res.ok) {
      await loadHistory();
    } else {
      const err = await res.json();
      window.alert(err.error ?? "No se pudo finalizar el control");
    }
  }

  async function handleCorrect(record: PetTestRecord) {
    const reason = window.prompt("Motivo de la correccion (obligatorio):");
    if (!reason) return;
    const editedBy = window.prompt("Nombre de quien corrige el registro:");
    if (!editedBy) return;
    const res = await fetch(`/api/quality-control/petct/pet-tests/${record.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "corregir_finalizado", edit_reason: reason, edited_by: editedBy, patch: {} }),
    });
    if (res.ok) {
      await loadHistory();
      window.alert("Se creo una nueva version del registro. El registro original se conserva sin modificar.");
    } else {
      const err = await res.json();
      window.alert(err.error ?? "No se pudo corregir el registro");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pruebas PET (PET-01 a PET-06)</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase B. Referencia tecnica: IAEA Human Health Series No. 1. El operador
          registra unicamente los valores medidos; el sistema calcula la razon
          observado/esperado y clasifica el resultado. REVISAR CON FISICO MEDICO cualquier
          valor esperado asumido.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end border rounded-lg p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Equipo PET/CT</label>
          <select
            className="border rounded px-2 py-1 text-sm min-w-[260px]"
            value={equipmentId ?? ""}
            onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Seleccione equipo...</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.manufacturer} {eq.model} ({eq.internal_code ?? "s/codigo"})
              </option>
            ))}
          </select>
        </div>
        {selectedEquipment && (
          <span className="text-xs text-gray-500">
            {hasTof ? "Este equipo dispone de TOF." : "Este equipo NO dispone de TOF (PET-06 = NO APLICA)."}
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TEST_LABELS) as PetTestCode[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setTestCode(code)}
            className={`px-3 py-1.5 rounded text-sm border ${testCode === code ? "bg-gray-800 text-white" : "bg-white"}`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="text-sm font-medium">{TEST_LABELS[testCode]}</div>

      {testCode === "PET-06" && !hasTof ? (
        <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-600">
          El equipo seleccionado no dispone de tecnologia TOF. Esta prueba se marca
          automaticamente como NO APLICA y no se solicita registro de datos (seccion 5.6 y 8
          del prompt de mejora).
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextField label="Operador" value={operator} onChange={setOperator} />
            <TextField label="Phantom" value={phantom} onChange={setPhantom} />
            <TextField label="Radionuclido" value={radionuclide} onChange={setRadionuclide} />
            <TextField label="Actividad (MBq)" value={activityMbq} onChange={setActivityMbq} type="number" />
            <TextField label="Protocolo de adquisicion" value={protocolAcquisition} onChange={setProtocolAcquisition} />
            <TextField label="Protocolo de reconstruccion" value={protocolReconstruction} onChange={setProtocolReconstruction} />
          </div>

          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-2">Datos medidos</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {testCode === "PET-01" && (
                <>
                  <TextField label="FWHM observada (mm)" value={rawInputs.fwhmObservedMm ?? ""} onChange={(v) => updateRaw("fwhmObservedMm", v)} type="number" />
                  <TextField label="FWHM esperada (mm)" value={rawInputs.fwhmExpectedMm ?? ""} onChange={(v) => updateRaw("fwhmExpectedMm", v)} type="number" />
                </>
              )}
              {testCode === "PET-02" && (
                <>
                  <TextField label="STOT observada (cps)" value={rawInputs.sTotObservedCps ?? ""} onChange={(v) => updateRaw("sTotObservedCps", v)} type="number" />
                  <TextField label="STOT esperada (cps)" value={rawInputs.sTotExpectedCps ?? ""} onChange={(v) => updateRaw("sTotExpectedCps", v)} type="number" />
                </>
              )}
              {testCode === "PET-03" && (
                <>
                  <TextField label="SF observada" value={rawInputs.scatterFractionObserved ?? ""} onChange={(v) => updateRaw("scatterFractionObserved", v)} type="number" />
                  <TextField label="SF esperada" value={rawInputs.scatterFractionExpected ?? ""} onChange={(v) => updateRaw("scatterFractionExpected", v)} type="number" />
                  <TextField label="True count rate (kcps)" value={rawInputs.trueCountRateKcps ?? ""} onChange={(v) => updateRaw("trueCountRateKcps", v)} type="number" />
                  <TextField label="Random count rate (kcps)" value={rawInputs.randomCountRateKcps ?? ""} onChange={(v) => updateRaw("randomCountRateKcps", v)} type="number" />
                  <TextField label="Scatter count rate (kcps)" value={rawInputs.scatterCountRateKcps ?? ""} onChange={(v) => updateRaw("scatterCountRateKcps", v)} type="number" />
                  <TextField label="NEC observada (kcps)" value={rawInputs.necObservedKcps ?? ""} onChange={(v) => updateRaw("necObservedKcps", v)} type="number" />
                  <TextField label="NEC recomendada (kcps)" value={rawInputs.necRecommendedKcps ?? ""} onChange={(v) => updateRaw("necRecommendedKcps", v)} type="number" />
                </>
              )}
              {testCode === "PET-04" && (
                <>
                  <TextField label="Resolucion energetica observada (%)" value={rawInputs.energyResolutionObservedPercent ?? ""} onChange={(v) => updateRaw("energyResolutionObservedPercent", v)} type="number" />
                  <TextField label="Resolucion energetica esperada (%)" value={rawInputs.energyResolutionExpectedPercent ?? ""} onChange={(v) => updateRaw("energyResolutionExpectedPercent", v)} type="number" />
                </>
              )}
              {testCode === "PET-05" && (
                <>
                  <SelectField label="Uniformidad" value={rawInputs.uniformity ?? "cumple"} onChange={(v) => updateRaw("uniformity", v)} />
                  <SelectField label="Contraste" value={rawInputs.contrast ?? "cumple"} onChange={(v) => updateRaw("contrast", v)} />
                  <SelectField label="Recuperacion" value={rawInputs.recovery ?? "cumple"} onChange={(v) => updateRaw("recovery", v)} />
                  <SelectField label="Artefactos" value={rawInputs.artifacts ?? "cumple"} onChange={(v) => updateRaw("artifacts", v)} />
                  <SelectField label="Exactitud de concentracion" value={rawInputs.concentrationAccuracy ?? "cumple"} onChange={(v) => updateRaw("concentrationAccuracy", v)} />
                  <SelectField label="Comportamiento de esferas" value={rawInputs.sphereBehavior ?? "cumple"} onChange={(v) => updateRaw("sphereBehavior", v)} />
                  <SelectField label="Correccion atenuacion/dispersion" value={rawInputs.attenuationScatterCorrection ?? "cumple"} onChange={(v) => updateRaw("attenuationScatterCorrection", v)} />
                </>
              )}
              {testCode === "PET-06" && (
                <>
                  <TextField label="Resolucion temporal observada (ps)" value={rawInputs.timingResolutionObservedPs ?? ""} onChange={(v) => updateRaw("timingResolutionObservedPs", v)} type="number" />
                  <TextField label="Resolucion temporal esperada (ps)" value={rawInputs.timingResolutionExpectedPs ?? ""} onChange={(v) => updateRaw("timingResolutionExpectedPs", v)} type="number" />
                </>
              )}
              {testCode === "PET-ESTAB" && (
                <>
                  <TextField label="Resultado del sistema (valor medido)" value={rawInputs.systemResultValue ?? ""} onChange={(v) => updateRaw("systemResultValue", v)} type="number" />
                  <SelectField
                    label="Resultado automatico del equipo (si esta disponible)"
                    value={rawInputs.systemReportedStatus ?? ""}
                    onChange={(v) => updateRaw("systemReportedStatus", v)}
                    options={[
                      { value: "", label: "No disponible (comparar con baseline)" },
                      { value: "ok", label: "OK" },
                      { value: "atencion", label: "Atencion" },
                      { value: "falla", label: "Falla" },
                    ]}
                  />
                  <TextField label="Tolerancia vs baseline (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
                </>
              )}
              {testCode === "PET-CONC" && (
                <>
                  <TextField label="Actividad real (MBq)" value={rawInputs.realActivityMbq ?? ""} onChange={(v) => updateRaw("realActivityMbq", v)} type="number" />
                  <TextField label="Fecha/hora de la actividad" value={rawInputs.activityDateTimeIso ?? ""} onChange={(v) => updateRaw("activityDateTimeIso", v)} type="datetime-local" />
                  <TextField label="Fecha/hora de referencia (medicion)" value={rawInputs.referenceDateTimeIso ?? ""} onChange={(v) => updateRaw("referenceDateTimeIso", v)} type="datetime-local" />
                  <TextField label="Periodo de semidesintegracion (min)" value={rawInputs.halfLifeMinutes ?? ""} onChange={(v) => updateRaw("halfLifeMinutes", v)} type="number" />
                  <TextField label="Volumen (mL)" value={rawInputs.volumeMl ?? ""} onChange={(v) => updateRaw("volumeMl", v)} type="number" />
                  <TextField label="Concentracion medida (Bq/mL)" value={rawInputs.measuredConcentrationBqMl ?? ""} onChange={(v) => updateRaw("measuredConcentrationBqMl", v)} type="number" />
                  <TextField label="Tolerancia (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
                </>
              )}
              {testCode === "PET-SUV-CAL" && (
                <>
                  <TextField label="Actividad medida en activimetro (MBq)" value={rawInputs.activimeterActivityMbq ?? ""} onChange={(v) => updateRaw("activimeterActivityMbq", v)} type="number" />
                  <TextField label="Fecha/hora de la medicion en activimetro" value={rawInputs.activimeterDateTimeIso ?? ""} onChange={(v) => updateRaw("activimeterDateTimeIso", v)} type="datetime-local" />
                  <TextField label="Fecha/hora de referencia (medicion en PET/CT)" value={rawInputs.referenceDateTimeIso ?? ""} onChange={(v) => updateRaw("referenceDateTimeIso", v)} type="datetime-local" />
                  <TextField label="Periodo de semidesintegracion (min)" value={rawInputs.halfLifeMinutes ?? ""} onChange={(v) => updateRaw("halfLifeMinutes", v)} type="number" />
                  <TextField label="Volumen (mL)" value={rawInputs.volumeMl ?? ""} onChange={(v) => updateRaw("volumeMl", v)} type="number" />
                  <TextField label="Concentracion reportada por PET/CT (Bq/mL)" value={rawInputs.petReportedConcentrationBqMl ?? ""} onChange={(v) => updateRaw("petReportedConcentrationBqMl", v)} type="number" />
                  <TextField label="Tolerancia segun fabricante (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading || !equipmentId} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">
              {loading ? "Calculando..." : "Registrar control (borrador)"}
            </button>
            {message && <span className="text-sm text-gray-600">{message}</span>}
          </div>
        </form>
      )}

      {lastResult && (
        <div className="border rounded-lg p-4 bg-blue-50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Resultado del calculo:</span>
            <StatusBadge status={lastResult.status} />
            <span className="text-xs text-gray-600">Nivel de accion: {ACTION_LEVEL_LABELS[lastResult.action_level] ?? lastResult.action_level}</span>
          </div>
          <pre className="text-xs bg-white border rounded p-2 overflow-x-auto">{JSON.stringify(lastResult.calculated, null, 2)}</pre>
          <button type="button" onClick={() => handleFinalize(lastResult.id)} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm">
            Finalizar control
          </button>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Historial ({TEST_LABELS[testCode]})</h2>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-gray-500">No hay registros para este equipo y prueba.</p>}
          {history.map((rec) => (
            <div key={rec.id} className="border rounded p-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-500">{new Date(rec.performed_at).toLocaleString()}</span>
              <StatusBadge status={rec.status} />
              <span className="text-xs text-gray-500">{ACTION_LEVEL_LABELS[rec.action_level] ?? rec.action_level}</span>
              <span className="text-gray-700">Operador: {rec.operator}</span>
              {rec.is_finalized ? (
                <>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-white">Finalizado por {rec.finalized_by}</span>
                  <button type="button" onClick={() => handleCorrect(rec)} className="text-xs text-blue-700 underline">
                    Corregir (crea nueva version)
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => handleFinalize(rec.id)} className="text-xs text-green-700 underline">
                  Finalizar
                </button>
              )}
              {rec.supersedes_id && <span className="text-xs text-gray-400">Corrige al registro #{rec.supersedes_id}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input type={type} className="w-full border rounded px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
}) {
  const opts = options ?? COMPONENT_OPTIONS;
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <select className="w-full border rounded px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
