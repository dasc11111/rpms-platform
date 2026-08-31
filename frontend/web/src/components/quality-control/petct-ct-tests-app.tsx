"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 4 - PET/CT - FASE C
 * Pruebas de control de calidad del componente CT (CT-01 a CT-14, seccion
 * 19 del prompt de mejora). El operador ingresa unicamente los datos
 * medidos; el servidor (qc-petct-calc.ts) calcula desviacion, estado
 * (CUMPLE/NO CUMPLE/REQUIERE REVISION/NO APLICA) y nivel de accion. Las
 * tolerancias por defecto de las pruebas radiologicas de CT deben marcarse
 * REVISAR CON FISICO MEDICO cuando no provienen del informe de aceptacion
 * o del fabricante (secciones 25 y 28 del prompt).
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type CtTestCode =
  | "CT-01" | "CT-02" | "CT-03" | "CT-04" | "CT-05" | "CT-06" | "CT-07"
  | "CT-08" | "CT-09" | "CT-10" | "CT-11" | "CT-12" | "CT-13" | "CT-14";

type CtTestRecord = {
  id: number;
  equipment_id: number | null;
  test_code: CtTestCode;
  performed_at: string;
  operator: string;
  physicist_reviewed_by: string | null;
  phantom: string | null;
  protocol: string | null;
  kvp: number | null;
  mas: number | null;
  pitch: number | null;
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments: string | null;
  corrective_action: string | null;
  is_finalized: boolean;
  finalized_by: string | null;
  supersedes_id: number | null;
};

const TEST_LABELS: Record<CtTestCode, string> = {
  "CT-01": "CT-01 Radiacion dispersa y verificacion de blindaje",
  "CT-02": "CT-02 Alineacion de laser",
  "CT-03": "CT-03 Alineacion de mesa y exactitud posicional",
  "CT-04": "CT-04 Exactitud del scout view",
  "CT-05": "CT-05 Inspeccion visual y revision del programa",
  "CT-06": "CT-06 Perfil y ancho de corte (slice)",
  "CT-07": "CT-07 Modulacion de alto contraste",
  "CT-08": "CT-08 kVp y HVL",
  "CT-09": "CT-09 Dosis (CTDIvol / DLP)",
  "CT-10": "CT-10 Ruido",
  "CT-11": "CT-11 Uniformidad",
  "CT-12": "CT-12 Artefactos",
  "CT-13": "CT-13 Numero CT",
  "CT-14": "CT-14 Exactitud de densidad electronica",
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

const ARTIFACT_OPTIONS = [
  { value: "sin_artefactos", label: "Sin artefactos" },
  { value: "anillo", label: "Artefacto anular" },
  { value: "bandas", label: "Bandas" },
  { value: "streak", label: "Streak" },
  { value: "anormalidad_uniformidad", label: "Anormalidad de uniformidad" },
  { value: "metalico", label: "Artefacto metalico" },
  { value: "otros", label: "Otros" },
];

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.requiere_revision;
  const label =
    status === "cumple" ? "CUMPLE" : status === "no_cumple" ? "NO CUMPLE" : status === "no_aplica" ? "NO APLICA" : "REQUIERE REVISION";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{label}</span>;
}
export default function PetCtCtTestsApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | null>(equipment[0]?.id ?? null);
  const [testCode, setTestCode] = useState<CtTestCode>("CT-01");
  const [operator, setOperator] = useState("");
  const [physicistReviewedBy, setPhysicistReviewedBy] = useState("");
  const [phantom, setPhantom] = useState("");
  const [protocol, setProtocol] = useState("");
  const [kvp, setKvp] = useState<string>("");
  const [mas, setMas] = useState<string>("");
  const [pitch, setPitch] = useState<string>("");
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [peripheralRoiHuText, setPeripheralRoiHuText] = useState("");
  const [notApplicable, setNotApplicable] = useState(false);
  const [history, setHistory] = useState<CtTestRecord[]>([]);
  const [lastResult, setLastResult] = useState<CtTestRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadHistory() {
    if (!equipmentId) {
      setHistory([]);
      return;
    }
    const res = await fetch(`/api/quality-control/petct/ct-tests?equipment_id=${equipmentId}&test_code=${testCode}`);
    const data = await res.json();
    setHistory(data);
  }

  useEffect(() => {
    loadHistory();
    setRawInputs({});
    setPeripheralRoiHuText("");
    setNotApplicable(false);
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
      const effectiveRawInputs: Record<string, unknown> = { ...rawInputs };
      if (testCode === "CT-11") {
        effectiveRawInputs.peripheralRoiHu = peripheralRoiHuText
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v !== "")
          .map((v) => Number(v));
      }
      if (testCode === "CT-14") {
        effectiveRawInputs.notApplicable = notApplicable;
      }
      if (testCode === "CT-12") {
        effectiveRawInputs.artifactType = rawInputs.artifactType ?? "sin_artefactos";
      }
      const res = await fetch("/api/quality-control/petct/ct-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId,
          test_code: testCode,
          operator,
          physicist_reviewed_by: physicistReviewedBy || null,
          phantom,
          protocol,
          kvp: kvp === "" ? null : Number(kvp),
          mas: mas === "" ? null : Number(mas),
          pitch: pitch === "" ? null : Number(pitch),
          raw_inputs: effectiveRawInputs,
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
    const res = await fetch(`/api/quality-control/petct/ct-tests/${id}`, {
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

  async function handleCorrect(record: CtTestRecord) {
    const reason = window.prompt("Motivo de la correccion (obligatorio):");
    if (!reason) return;
    const editedBy = window.prompt("Nombre de quien corrige el registro:");
    if (!editedBy) return;
    const res = await fetch(`/api/quality-control/petct/ct-tests/${record.id}`, {
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
        <h1 className="text-2xl font-bold">Pruebas CT (CT-01 a CT-14)</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase C. Componente CT independiente del componente PET (seccion 2 del
          prompt de mejora). Referencia metodologica: IAEA Human Health Series No. 1. El
          operador registra unicamente los valores medidos; el sistema calcula la desviacion y
          clasifica el resultado. REVISAR CON FISICO MEDICO cualquier tolerancia por defecto que
          no provenga del informe de aceptacion o del fabricante.
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
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TEST_LABELS) as CtTestCode[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setTestCode(code)}
            className={`px-3 py-1.5 rounded text-sm border ${testCode === code ? "bg-gray-800 text-white border-gray-800" : "bg-white text-slate-700 border-slate-300"}`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="text-sm font-medium">{TEST_LABELS[testCode]}</div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField label="Operador" value={operator} onChange={setOperator} />
          <TextField label="Fisico Medico revisor" value={physicistReviewedBy} onChange={setPhysicistReviewedBy} />
          <TextField label="Phantom" value={phantom} onChange={setPhantom} />
          <TextField label="Protocolo" value={protocol} onChange={setProtocol} />
          <TextField label="kVp" value={kvp} onChange={setKvp} type="number" />
          <TextField label="mAs" value={mas} onChange={setMas} type="number" />
          <TextField label="Pitch" value={pitch} onChange={setPitch} type="number" />
        </div>

        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">Datos medidos</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {testCode === "CT-01" && (
              <>
                <TextField label="Tasa de dosis medida (uSv/h)" value={rawInputs.measuredDoseRateUSvH ?? ""} onChange={(v) => updateRaw("measuredDoseRateUSvH", v)} type="number" />
                <TextField label="Limite de tasa de dosis (uSv/h)" value={rawInputs.doseRateLimitUSvH ?? ""} onChange={(v) => updateRaw("doseRateLimitUSvH", v)} type="number" />
              </>
            )}
            {testCode === "CT-02" && (
              <>
                <TextField label="Desviacion del laser (mm)" value={rawInputs.laserDeviationMm ?? ""} onChange={(v) => updateRaw("laserDeviationMm", v)} type="number" />
                <TextField label="Tolerancia (mm)" value={rawInputs.toleranceMm ?? ""} onChange={(v) => updateRaw("toleranceMm", v)} type="number" />
              </>
            )}
            {testCode === "CT-03" && (
              <>
                <TextField label="Error de posicion de mesa (mm)" value={rawInputs.tablePositionErrorMm ?? ""} onChange={(v) => updateRaw("tablePositionErrorMm", v)} type="number" />
                <TextField label="Tolerancia (mm)" value={rawInputs.toleranceMm ?? ""} onChange={(v) => updateRaw("toleranceMm", v)} type="number" />
              </>
            )}
            {testCode === "CT-04" && (
              <>
                <TextField label="Error del scout view (mm)" value={rawInputs.scoutViewErrorMm ?? ""} onChange={(v) => updateRaw("scoutViewErrorMm", v)} type="number" />
                <TextField label="Tolerancia (mm)" value={rawInputs.toleranceMm ?? ""} onChange={(v) => updateRaw("toleranceMm", v)} type="number" />
              </>
            )}
            {testCode === "CT-05" && (
              <>
                <SelectField label="Inspeccion visual" value={rawInputs.visualInspection ?? "cumple"} onChange={(v) => updateRaw("visualInspection", v)} />
                <SelectField label="Enclavamientos de seguridad" value={rawInputs.safetyInterlocks ?? "cumple"} onChange={(v) => updateRaw("safetyInterlocks", v)} />
                <SelectField label="Movimiento de mesa" value={rawInputs.tableMotion ?? "cumple"} onChange={(v) => updateRaw("tableMotion", v)} />
                <SelectField label="Movimiento de gantry" value={rawInputs.gantryMotion ?? "cumple"} onChange={(v) => updateRaw("gantryMotion", v)} />
                <SelectField label="Version de software" value={rawInputs.softwareVersion ?? "cumple"} onChange={(v) => updateRaw("softwareVersion", v)} />
              </>
            )}
            {testCode === "CT-06" && (
              <>
                <TextField label="Ancho de corte medido (mm)" value={rawInputs.measuredSliceWidthMm ?? ""} onChange={(v) => updateRaw("measuredSliceWidthMm", v)} type="number" />
                <TextField label="Ancho de corte nominal (mm)" value={rawInputs.nominalSliceWidthMm ?? ""} onChange={(v) => updateRaw("nominalSliceWidthMm", v)} type="number" />
                <TextField label="Tolerancia (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
              </>
            )}
            {testCode === "CT-07" && (
              <>
                <TextField label="Resolucion observada (lp/cm)" value={rawInputs.observedResolutionLpCm ?? ""} onChange={(v) => updateRaw("observedResolutionLpCm", v)} type="number" />
                <TextField label="Resolucion esperada (lp/cm)" value={rawInputs.expectedResolutionLpCm ?? ""} onChange={(v) => updateRaw("expectedResolutionLpCm", v)} type="number" />
              </>
            )}
            {testCode === "CT-08" && (
              <>
                <TextField label="kVp medido" value={rawInputs.kvpMeasured ?? ""} onChange={(v) => updateRaw("kvpMeasured", v)} type="number" />
                <TextField label="kVp nominal" value={rawInputs.kvpNominal ?? ""} onChange={(v) => updateRaw("kvpNominal", v)} type="number" />
                <TextField label="Tolerancia kVp (%)" value={rawInputs.kvpTolerancePercent ?? ""} onChange={(v) => updateRaw("kvpTolerancePercent", v)} type="number" />
                <TextField label="HVL medido (mm Al)" value={rawInputs.hvlMeasuredMmAl ?? ""} onChange={(v) => updateRaw("hvlMeasuredMmAl", v)} type="number" />
                <TextField label="HVL esperado (mm Al)" value={rawInputs.hvlExpectedMmAl ?? ""} onChange={(v) => updateRaw("hvlExpectedMmAl", v)} type="number" />
                <TextField label="Tolerancia HVL (%)" value={rawInputs.hvlTolerancePercent ?? ""} onChange={(v) => updateRaw("hvlTolerancePercent", v)} type="number" />
              </>
            )}
            {testCode === "CT-09" && (
              <>
                <TextField label="CTDIvol medido (mGy)" value={rawInputs.ctdivolMeasuredMgy ?? ""} onChange={(v) => updateRaw("ctdivolMeasuredMgy", v)} type="number" />
                <TextField label="CTDIvol referencia (mGy)" value={rawInputs.ctdivolReferenceMgy ?? ""} onChange={(v) => updateRaw("ctdivolReferenceMgy", v)} type="number" />
                <TextField label="DLP medido (mGy.cm)" value={rawInputs.dlpMeasuredMgyCm ?? ""} onChange={(v) => updateRaw("dlpMeasuredMgyCm", v)} type="number" />
                <TextField label="DLP referencia (mGy.cm)" value={rawInputs.dlpReferenceMgyCm ?? ""} onChange={(v) => updateRaw("dlpReferenceMgyCm", v)} type="number" />
                <TextField label="Tolerancia (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
              </>
            )}
            {testCode === "CT-10" && (
              <>
                <TextField label="Ruido medido, SD (HU)" value={rawInputs.measuredNoiseSdHu ?? ""} onChange={(v) => updateRaw("measuredNoiseSdHu", v)} type="number" />
                <TextField label="Ruido esperado, SD (HU)" value={rawInputs.expectedNoiseSdHu ?? ""} onChange={(v) => updateRaw("expectedNoiseSdHu", v)} type="number" />
                <TextField label="Tolerancia (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
              </>
            )}
            {testCode === "CT-11" && (
              <>
                <TextField label="ROI central (HU)" value={rawInputs.centralRoiHu ?? ""} onChange={(v) => updateRaw("centralRoiHu", v)} type="number" />
                <TextField label="ROI perifericos (HU, separados por coma)" value={peripheralRoiHuText} onChange={setPeripheralRoiHuText} />
                <TextField label="Tolerancia (HU)" value={rawInputs.toleranceHu ?? ""} onChange={(v) => updateRaw("toleranceHu", v)} type="number" />
              </>
            )}
            {testCode === "CT-12" && (
              <div>
                <label className="text-sm font-medium block mb-1">Tipo de artefacto observado</label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={rawInputs.artifactType ?? "sin_artefactos"}
                  onChange={(e) => updateRaw("artifactType", e.target.value)}
                >
                  {ARTIFACT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {testCode === "CT-13" && (
              <>
                <TextField label="Numero CT medido del material (HU)" value={rawInputs.materialMeasuredHu ?? ""} onChange={(v) => updateRaw("materialMeasuredHu", v)} type="number" />
                <TextField label="Numero CT esperado del material (HU)" value={rawInputs.materialExpectedHu ?? ""} onChange={(v) => updateRaw("materialExpectedHu", v)} type="number" />
                <TextField label="Tolerancia (HU)" value={rawInputs.toleranceHu ?? ""} onChange={(v) => updateRaw("toleranceHu", v)} type="number" />
              </>
            )}
            {testCode === "CT-14" && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    id="ct14-na"
                    type="checkbox"
                    checked={notApplicable}
                    onChange={(e) => setNotApplicable(e.target.checked)}
                  />
                  <label htmlFor="ct14-na" className="text-sm">No aplica (equipo sin uso en planificacion de radioterapia)</label>
                </div>
                {!notApplicable && (
                  <>
                    <TextField label="Razon de densidad electronica medida" value={rawInputs.measuredElectronDensityRatio ?? ""} onChange={(v) => updateRaw("measuredElectronDensityRatio", v)} type="number" />
                    <TextField label="Razon de densidad electronica de referencia" value={rawInputs.referenceElectronDensityRatio ?? ""} onChange={(v) => updateRaw("referenceElectronDensityRatio", v)} type="number" />
                    <TextField label="Tolerancia (%)" value={rawInputs.tolerancePercent ?? ""} onChange={(v) => updateRaw("tolerancePercent", v)} type="number" />
                  </>
                )}
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

function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <select className="w-full border rounded px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {COMPONENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
