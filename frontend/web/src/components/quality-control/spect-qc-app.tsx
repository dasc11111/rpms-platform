"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Orbit,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Printer,
  Clock,
  History,
} from "lucide-react";
import { QcTrendChart } from "./qc-trend-chart";

type SpectTestType = "centro_rotacion" | "uniformidad_tomografica";

interface TestTypeConfig {
  value: SpectTestType;
  label: string;
  unit: string;
  usesReadingsArray: boolean;
  numReadingsRequired: number;
  description: string;
}

const TEST_TYPES: TestTypeConfig[] = [
  {
    value: "centro_rotacion",
    label: "Centro de Rotacion (COR)",
    unit: "px",
    usesReadingsArray: true,
    numReadingsRequired: 4,
    description:
      "Evalua la alineacion del eje mecanico de rotacion del gantry con el eje de reconstruccion tomografica. Se registra la desviacion en pixeles respecto del valor ideal (0) para multiples proyecciones/cabezales. REVISAR CON FISICO MEDICO.",
  },
  {
    value: "uniformidad_tomografica",
    label: "Uniformidad Tomografica",
    unit: "%",
    usesReadingsArray: false,
    numReadingsRequired: 1,
    description:
      "Evalua la uniformidad de la imagen reconstruida (cortes tomograficos) utilizando un fantoma cilindrico, distinta de la uniformidad planar de flood del Modulo 2. REVISAR CON FISICO MEDICO.",
  },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pass: { label: "Aprobado", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
  warning: { label: "Advertencia", color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertTriangle },
  fail: { label: "Fuera de Tolerancia", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

interface DueAlert {
  instrumentId: string;
  instrumentName: string;
  testType: SpectTestType;
  status: "overdue" | "upcoming" | "sin_registro";
  dueDate: string | null;
  daysOverdue?: number;
}

interface SpectReadingResult {
  id: string;
  instrumentId: string;
  testType: SpectTestType;
  performedAt: string;
  operator: string;
  radionuclide: string;
  absoluteDifference?: number;
  toleranceAbsolute?: number;
  percentValue?: number;
  tolerancePercent?: number;
  status: "pass" | "warning" | "fail";
  readings?: number[];
}

interface Instrument {
  id: string;
  name: string;
}

export function SpectQcApp({ instruments }: { instruments: Instrument[] }) {
  const [dueAlerts, setDueAlerts] = useState<DueAlert[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [instrumentId, setInstrumentId] = useState("");
  const [testType, setTestType] = useState<SpectTestType>("centro_rotacion");
  const [performedAt, setPerformedAt] = useState("");
  const [operator, setOperator] = useState("");
  const [radionuclide, setRadionuclide] = useState("Tc-99m");
  const [readings, setReadings] = useState<string[]>(["", "", "", ""]);
  const [uniformityPercent, setUniformityPercent] = useState("");
  const [result, setResult] = useState<SpectReadingResult | null>(null);
  const [history, setHistory] = useState<SpectReadingResult[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTestConfig = TEST_TYPES.find((t) => t.value === testType)!;

  const fetchDueStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/quality-control/spect/due-status");
      if (res.ok) {
        const data = await res.json();
        setDueAlerts(data.alerts ?? []);
      }
    } catch (e) {
      // silent
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!instrumentId) return;
    try {
      const res = await fetch(
        `/api/quality-control/spect?instrumentId=${instrumentId}&testType=${testType}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.results ?? []);
      }
    } catch (e) {
      // silent
    }
  }, [instrumentId, testType]);

  useEffect(() => {
    fetchDueStatus();
  }, [fetchDueStatus]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function handleReadingChange(index: number, value: string) {
    setReadings((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        instrumentId,
        testType,
        performedAt,
        operator,
        radionuclide,
      };
      if (currentTestConfig.usesReadingsArray) {
        payload.readings = readings
          .filter((r) => r.trim() !== "")
          .map((r) => parseFloat(r));
      } else {
        payload.uniformityPercent = parseFloat(uniformityPercent);
      }

      const res = await fetch("/api/quality-control/spect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al registrar la prueba");
      }
      const data = await res.json();
      setResult(data.result);
      setStep(3);
      fetchHistory();
      fetchDueStatus();
    } catch (e: any) {
      setError(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setStep(1);
    setPerformedAt("");
    setOperator("");
    setReadings(["", "", "", ""]);
    setUniformityPercent("");
    setResult(null);
    setError(null);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 print:p-0">
      <div className="flex items-center gap-3 print:hidden">
        <Orbit className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-xl font-semibold">
            Control de Calidad - Modulo 3: SPECT
          </h1>
          <p className="text-sm text-gray-500">
            Referencia tecnica: IAEA TECDOC-602. Pruebas: Centro de Rotacion
            (COR) y Uniformidad Tomografica.
          </p>
        </div>
      </div>

      {dueAlerts.length > 0 && (
        <div className="space-y-2 print:hidden">
          {dueAlerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                alert.status === "overdue"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : alert.status === "upcoming"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              {alert.status === "overdue" ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 shrink-0" />
              )}
              <span>
                <strong>{alert.instrumentName}</strong> -{" "}
                {TEST_TYPES.find((t) => t.value === alert.testType)?.label}:{" "}
                {alert.status === "overdue"
                  ? `Prueba atrasada (${alert.daysOverdue ?? "?"} dias)`
                  : alert.status === "upcoming"
                  ? `Proxima a vencer (${alert.dueDate ?? ""})`
                  : "Sin registro previo"}
              </span>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 border rounded-lg p-4">
          <h2 className="font-medium">Paso 1: Datos generales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Equipo</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={instrumentId}
                onChange={(e) => setInstrumentId(e.target.value)}
              >
                <option value="">Seleccionar equipo</option>
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Prueba</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={testType}
                onChange={(e) => setTestType(e.target.value as SpectTestType)}
              >
                {TEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Fecha y hora</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-2 py-1"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Operador</label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Radionuclido</label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1"
                value={radionuclide}
                onChange={(e) => setRadionuclide(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">{currentTestConfig.description}</p>
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!instrumentId || !performedAt || !operator}
            onClick={() => setStep(2)}
          >
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 border rounded-lg p-4">
          <h2 className="font-medium">Paso 2: Registro de mediciones</h2>
          {currentTestConfig.usesReadingsArray ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Ingrese la desviacion (px) para cada proyeccion/cabezal (
                {currentTestConfig.numReadingsRequired} lecturas requeridas).
              </p>
              {readings.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm w-24">Lectura {i + 1}</span>
                  <input
                    type="number"
                    step="0.01"
                    className="border rounded px-2 py-1 flex-1"
                    value={r}
                    onChange={(e) => handleReadingChange(i, e.target.value)}
                  />
                  <span className="text-sm text-gray-400">px</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-sm mb-1">
                Uniformidad Tomografica (%)
              </label>
              <input
                type="number"
                step="0.01"
                className="border rounded px-2 py-1 w-40"
                value={uniformityPercent}
                onChange={(e) => setUniformityPercent(e.target.value)}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded"
              onClick={() => setStep(1)}
            >
              Atras
            </button>
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "Guardando..." : "Registrar"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4 border rounded-lg p-4 print:border-0">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Resultado</h2>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 text-sm border px-3 py-1 rounded print:hidden"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
          {(() => {
            const cfg = STATUS_CONFIG[result.status];
            const Icon = cfg.icon;
            return (
              <div className={`flex items-center gap-2 rounded-md border p-3 ${cfg.color}`}>
                <Icon className="w-5 h-5" />
                <span className="font-medium">{cfg.label}</span>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Prueba:</span>{" "}
              {TEST_TYPES.find((t) => t.value === result.testType)?.label}
            </div>
            <div>
              <span className="text-gray-500">Fecha:</span>{" "}
              {result.performedAt}
            </div>
            <div>
              <span className="text-gray-500">Operador:</span>{" "}
              {result.operator}
            </div>
            <div>
              <span className="text-gray-500">Radionuclido:</span>{" "}
              {result.radionuclide}
            </div>
            {result.testType === "centro_rotacion" ? (
              <>
                <div>
                  <span className="text-gray-500">Desviacion absoluta:</span>{" "}
                  {result.absoluteDifference?.toFixed(3)} px
                </div>
                <div>
                  <span className="text-gray-500">Tolerancia:</span> ±
                  {result.toleranceAbsolute} px
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-gray-500">Uniformidad:</span>{" "}
                  {result.percentValue?.toFixed(2)}%
                </div>
                <div>
                  <span className="text-gray-500">Tolerancia:</span>{" "}
                  {result.tolerancePercent}%
                </div>
              </>
            )}
          </div>
          <button
            className="text-sm text-indigo-600 underline print:hidden"
            onClick={() => setShowDetail((v) => !v)}
          >
            {showDetail ? "Ocultar detalle OPR" : "Ver detalle OPR"}
          </button>
          {showDetail && (
            <p className="text-xs text-gray-500 border-t pt-2">
              {currentTestConfig.description}
            </p>
          )}
          <button
            className="border px-4 py-2 rounded print:hidden"
            onClick={resetForm}
          >
            Nueva medicion
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3 print:hidden">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500" />
            <h2 className="font-medium">Historial y tendencia</h2>
          </div>
          <QcTrendChart
            data={history.map((h) => ({
              date: h.performedAt,
              value:
                h.testType === "centro_rotacion"
                  ? h.absoluteDifference ?? 0
                  : h.percentValue ?? 0,
              status: h.status,
            }))}
            unit={currentTestConfig.unit}
          />
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1">Fecha</th>
                <th className="py-1">Operador</th>
                <th className="py-1">Valor</th>
                <th className="py-1">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-1">{h.performedAt}</td>
                  <td className="py-1">{h.operator}</td>
                  <td className="py-1">
                    {h.testType === "centro_rotacion"
                      ? `${h.absoluteDifference?.toFixed(3)} px`
                      : `${h.percentValue?.toFixed(2)}%`}
                  </td>
                  <td className="py-1">{STATUS_CONFIG[h.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
