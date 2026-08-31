"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 4 - PET/CT - FASE D (extendido en FASE G)
 * Pruebas de interaccion PET/CT (categoria C de la seccion 2 del prompt de
 * mejora: relacion espacial entre el componente PET y el componente CT).
 * PETCT-01 (seccion 6): exactitud del registro PET/CT, en voxels.
 * PETCT-02 (seccion 14): PET/CT Offset Calibration X/Y/Z, con comparacion
 * automatica contra el resultado anterior y el baseline vigente.
 *
 * FASE G agrega aqui dos pruebas cuya modalidad de catalogo es "PETCT" (no
 * pertenecen ni a PET ni a CT por separado, igual que PETCT-01/02):
 * PET-CLINICO (seccion 9): evaluacion cualitativa de un estudio clinico
 * (artefactos, uniformidad, errores de reconstruccion, correccion de
 * atenuacion/dispersion y fusion), siguiendo el mismo patron de checklist
 * de PET-05/CT-05.
 * PET-QI-RUTINA (seccion 15): prueba rutinaria integrada de calidad de
 * imagen (uniformidad, concentracion con correccion de decaimiento y
 * resolucion espacial), que reutiliza el motor de PET-CONC y PET-01.
 *
 * Incluye ademas una pestana "Vista integrada" (seccion 24 del prompt):
 * muestra, para el equipo seleccionado, el ultimo resultado de cada prueba
 * PET, CT y de interaccion PET/CT lado a lado, para ayudar a identificar si
 * un problema proviene del PET, del CT, del registro/fusion o de la
 * calibracion, sin mezclar los resultados de cada componente (seccion 2).
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type JointTestCode = "PETCT-01" | "PETCT-02" | "PET-CLINICO" | "PET-QI-RUTINA";

type JointTestRecord = {
  id: number;
  equipment_id: number | null;
  test_code: JointTestCode;
  performed_at: string;
  operator: string;
  physicist_reviewed_by: string | null;
  phantom: string | null;
  protocol: string | null;
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

type SummaryRecord = {
  test_code: string;
  performed_at: string;
  status: string;
  is_finalized: boolean;
};

const TEST_LABELS: Record<JointTestCode, string> = {
  "PETCT-01": "PETCT-01 Exactitud del registro PET/CT",
  "PETCT-02": "PETCT-02 PET/CT Offset Calibration (X/Y/Z)",
  "PET-CLINICO": "PET-CLINICO Evaluacion de estudio clinico",
  "PET-QI-RUTINA": "PET-QI-RUTINA Prueba rutinaria de calidad de imagen",
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
export default function PetCtJointTestsApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | null>(equipment[0]?.id ?? null);
  const [testCode, setTestCode] = useState<JointTestCode>("PETCT-01");
  const [operator, setOperator] = useState("");
  const [physicistReviewedBy, setPhysicistReviewedBy] = useState("");
  const [phantom, setPhantom] = useState("");
  const [protocol, setProtocol] = useState("");
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<JointTestRecord[]>([]);
  const [lastResult, setLastResult] = useState<JointTestRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"registro" | "integrada">("registro");
  const [petSummary, setPetSummary] = useState<SummaryRecord[]>([]);
  const [ctSummary, setCtSummary] = useState<SummaryRecord[]>([]);
  const [jointSummary, setJointSummary] = useState<SummaryRecord[]>([]);

  async function loadHistory() {
    if (!equipmentId) {
      setHistory([]);
      return;
    }
    const res = await fetch(`/api/quality-control/petct/joint-tests?equipment_id=${equipmentId}&test_code=${testCode}`);
    const data = await res.json();
    setHistory(data);
  }

  function latestByCode(records: Array<{ test_code: string; performed_at: string; status: string; is_finalized: boolean }>): SummaryRecord[] {
    const latest = new Map<string, SummaryRecord>();
    for (const r of records) {
      const existing = latest.get(r.test_code);
      if (!existing || new Date(r.performed_at).getTime() > new Date(existing.performed_at).getTime()) {
        latest.set(r.test_code, { test_code: r.test_code, performed_at: r.performed_at, status: r.status, is_finalized: r.is_finalized });
      }
    }
    return Array.from(latest.values()).sort((a, b) => a.test_code.localeCompare(b.test_code));
  }

  async function loadIntegratedView() {
    if (!equipmentId) {
      setPetSummary([]);
      setCtSummary([]);
      setJointSummary([]);
      return;
    }
    const [petRes, ctRes, jointRes] = await Promise.all([
      fetch(`/api/quality-control/petct/pet-tests?equipment_id=${equipmentId}`),
      fetch(`/api/quality-control/petct/ct-tests?equipment_id=${equipmentId}`),
      fetch(`/api/quality-control/petct/joint-tests?equipment_id=${equipmentId}`),
    ]);
    const [petData, ctData, jointData] = await Promise.all([petRes.json(), ctRes.json(), jointRes.json()]);
    setPetSummary(latestByCode(petData));
    setCtSummary(latestByCode(ctData));
    setJointSummary(latestByCode(jointData));
  }

  useEffect(() => {
    loadHistory();
    setRawInputs({});
    setLastResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, testCode]);

  useEffect(() => {
    if (view === "integrada") {
      loadIntegratedView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, equipmentId]);

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
      const res = await fetch("/api/quality-control/petct/joint-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId,
          test_code: testCode,
          operator,
          physicist_reviewed_by: physicistReviewedBy || null,
          phantom,
          protocol,
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
    const res = await fetch(`/api/quality-control/petct/joint-tests/${id}`, {
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

  async function handleCorrect(record: JointTestRecord) {
    const reason = window.prompt("Motivo de la correccion (obligatorio):");
    if (!reason) return;
    const editedBy = window.prompt("Nombre de quien corrige el registro:");
    if (!editedBy) return;
    const res = await fetch(`/api/quality-control/petct/joint-tests/${record.id}`, {
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
        <h1 className="text-2xl font-bold">Pruebas de interaccion PET/CT</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase D/G. Pruebas que evaluan la relacion espacial entre el componente PET y
          el componente CT, y pruebas cuya modalidad de catalogo es PETCT (seccion 2, categoria C
          del prompt de mejora): NO pertenecen ni a PET ni a CT por separado. El operador registra
          unicamente los valores medidos; el sistema calcula la desviacion y clasifica el resultado.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setView("registro")}
          className={`px-3 py-2 text-sm border-b-2 ${view === "registro" ? "border-gray-800 font-semibold" : "border-transparent text-gray-500"}`}
        >
          Registro de pruebas
        </button>
        <button
          type="button"
          onClick={() => setView("integrada")}
          className={`px-3 py-2 text-sm border-b-2 ${view === "integrada" ? "border-gray-800 font-semibold" : "border-transparent text-gray-500"}`}
        >
          Vista PET/CT integrada
        </button>
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

      {view === "integrada" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Ultimo resultado de cada prueba, por componente, para el equipo seleccionado (seccion
            24 del prompt de mejora). Permite identificar si un problema proviene del PET, del CT
            o del registro/fusion entre ambos, sin mezclar sus resultados.
          </p>
          <IntegratedColumn title="PET (PET-01 a PET-06)" rows={petSummary} />
          <IntegratedColumn title="CT (CT-01 a CT-14)" rows={ctSummary} />
          <IntegratedColumn title="Interaccion PET/CT (PETCT-01, PETCT-02, PET-CLINICO, PET-QI-RUTINA)" rows={jointSummary} />
        </div>
      )}

      {view === "registro" && (
        <>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(TEST_LABELS) as JointTestCode[]).map((code) => (
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
            </div>

            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Datos medidos</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {testCode === "PETCT-01" && (
                  <>
                    <TextField label="Tamano de voxel (mm)" value={rawInputs.voxelSizeMm ?? ""} onChange={(v) => updateRaw("voxelSizeMm", v)} type="number" />
                    <TextField label="Desplazamiento X (mm)" value={rawInputs.displacementXMm ?? ""} onChange={(v) => updateRaw("displacementXMm", v)} type="number" />
                    <TextField label="Desplazamiento Y (mm)" value={rawInputs.displacementYMm ?? ""} onChange={(v) => updateRaw("displacementYMm", v)} type="number" />
                    <TextField label="Desplazamiento Z (mm)" value={rawInputs.displacementZMm ?? ""} onChange={(v) => updateRaw("displacementZMm", v)} type="number" />
                  </>
                )}
                {testCode === "PETCT-02" && (
                  <>
                    <TextField label="Offset X (mm)" value={rawInputs.offsetXMm ?? ""} onChange={(v) => updateRaw("offsetXMm", v)} type="number" />
                    <TextField label="Offset Y (mm)" value={rawInputs.offsetYMm ?? ""} onChange={(v) => updateRaw("offsetYMm", v)} type="number" />
                    <TextField label="Offset Z (mm)" value={rawInputs.offsetZMm ?? ""} onChange={(v) => updateRaw("offsetZMm", v)} type="number" />
                    <TextField label="Tolerancia (mm)" value={rawInputs.toleranceMm ?? ""} onChange={(v) => updateRaw("toleranceMm", v)} type="number" />
                    <TextField label="Offset anterior X (mm, opcional)" value={rawInputs.previousOffsetXMm ?? ""} onChange={(v) => updateRaw("previousOffsetXMm", v)} type="number" />
                    <TextField label="Offset anterior Y (mm, opcional)" value={rawInputs.previousOffsetYMm ?? ""} onChange={(v) => updateRaw("previousOffsetYMm", v)} type="number" />
                    <TextField label="Offset anterior Z (mm, opcional)" value={rawInputs.previousOffsetZMm ?? ""} onChange={(v) => updateRaw("previousOffsetZMm", v)} type="number" />
                    <TextField label="Offset baseline X (mm, opcional)" value={rawInputs.baselineOffsetXMm ?? ""} onChange={(v) => updateRaw("baselineOffsetXMm", v)} type="number" />
                    <TextField label="Offset baseline Y (mm, opcional)" value={rawInputs.baselineOffsetYMm ?? ""} onChange={(v) => updateRaw("baselineOffsetYMm", v)} type="number" />
                    <TextField label="Offset baseline Z (mm, opcional)" value={rawInputs.baselineOffsetZMm ?? ""} onChange={(v) => updateRaw("baselineOffsetZMm", v)} type="number" />
                  </>
                )}
                {testCode === "PET-CLINICO" && (
                  <>
                    <SelectField label="Artefactos" value={rawInputs.artifacts ?? ""} onChange={(v) => updateRaw("artifacts", v)} />
                    <SelectField label="Uniformidad" value={rawInputs.uniformity ?? ""} onChange={(v) => updateRaw("uniformity", v)} />
                    <SelectField label="Errores de reconstruccion" value={rawInputs.reconstructionErrors ?? ""} onChange={(v) => updateRaw("reconstructionErrors", v)} />
                    <SelectField label="Correccion de atenuacion/dispersion" value={rawInputs.attenuationScatterCorrection ?? ""} onChange={(v) => updateRaw("attenuationScatterCorrection", v)} />
                    <SelectField label="Fusion PET/CT" value={rawInputs.fusion ?? ""} onChange={(v) => updateRaw("fusion", v)} />
                  </>
                )}
                {testCode === "PET-QI-RUTINA" && (
                  <>
                    <TextField label="Eventos verdaderos adquiridos (millones)" value={rawInputs.trueEventCountMillions ?? ""} onChange={(v) => updateRaw("trueEventCountMillions", v)} type="number" />
                    <TextField label="Eventos verdaderos recomendados (millones, opcional)" value={rawInputs.recommendedEventCountMillions ?? ""} onChange={(v) => updateRaw("recommendedEventCountMillions", v)} type="number" />
                    <TextField label="Uniformidad medida (%)" value={rawInputs.uniformityPercent ?? ""} onChange={(v) => updateRaw("uniformityPercent", v)} type="number" />
                    <TextField label="Tolerancia de uniformidad (%)" value={rawInputs.uniformityTolerancePercent ?? ""} onChange={(v) => updateRaw("uniformityTolerancePercent", v)} type="number" />
                    <TextField label="Actividad real (MBq)" value={rawInputs.realActivityMbq ?? ""} onChange={(v) => updateRaw("realActivityMbq", v)} type="number" />
                    <TextField label="Fecha/hora de la actividad" value={rawInputs.activityDateTimeIso ?? ""} onChange={(v) => updateRaw("activityDateTimeIso", v)} type="datetime-local" />
                    <TextField label="Fecha/hora de referencia (medicion)" value={rawInputs.referenceDateTimeIso ?? ""} onChange={(v) => updateRaw("referenceDateTimeIso", v)} type="datetime-local" />
                    <TextField label="Vida media (minutos)" value={rawInputs.halfLifeMinutes ?? ""} onChange={(v) => updateRaw("halfLifeMinutes", v)} type="number" />
                    <TextField label="Volumen del maniqui (mL)" value={rawInputs.volumeMl ?? ""} onChange={(v) => updateRaw("volumeMl", v)} type="number" />
                    <TextField label="Concentracion medida (Bq/mL)" value={rawInputs.measuredConcentrationBqMl ?? ""} onChange={(v) => updateRaw("measuredConcentrationBqMl", v)} type="number" />
                    <TextField label="Tolerancia de concentracion (%)" value={rawInputs.concentrationTolerancePercent ?? ""} onChange={(v) => updateRaw("concentrationTolerancePercent", v)} type="number" />
                    <TextField label="FWHM observado (mm)" value={rawInputs.fwhmObservedMm ?? ""} onChange={(v) => updateRaw("fwhmObservedMm", v)} type="number" />
                    <TextField label="FWHM esperado (mm)" value={rawInputs.fwhmExpectedMm ?? ""} onChange={(v) => updateRaw("fwhmExpectedMm", v)} type="number" />
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
        </>
      )}
    </div>
  );
}

function IntegratedColumn({ title, rows }: { title: string; rows: SummaryRecord[] }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {rows.length === 0 && <p className="text-sm text-gray-500">Sin registros para este equipo.</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.test_code} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono text-xs text-gray-600 w-24">{r.test_code}</span>
            <StatusBadge status={r.status} />
            <span className="text-xs text-gray-500">{new Date(r.performed_at).toLocaleString()}</span>
            {!r.is_finalized && <span className="text-xs text-yellow-700">Borrador</span>}
          </div>
        ))}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <select className="w-full border rounded px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Seleccione...</option>
        {COMPONENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
