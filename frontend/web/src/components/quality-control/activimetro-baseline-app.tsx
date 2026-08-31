"use client";

import { useState } from "react";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Gestion del baseline del equipo (secciones 27-28 del prompt maestro).
 * El baseline es el valor de referencia de un parametro para una prueba
 * dada, establecido en la aceptacion o recomisionamiento del equipo. Nunca
 * se sobrescribe: al establecer un nuevo valor el anterior se conserva
 * (is_current = false) y queda enlazado via previous_baseline_id, junto
 * con el motivo, usuario y fecha del cambio.
 *
 * Unidad de actividad: si el parametro registrado es una actividad, el
 * operador puede capturar el valor en MBq, mCi o uCi (conversion fisica
 * estandar 1 mCi = 37 MBq; 1 uCi = 0.001 mCi = 0.037 MBq). El sistema
 * siempre convierte y almacena en MBq para mantener consistencia con las
 * demas pruebas del modulo, que comparan sus lecturas contra este
 * baseline.
 */

const MCI_TO_MBQ = 37;
const UCI_TO_MBQ = 0.037;

function toMBq(value: number, unit: "MBq" | "mCi" | "uCi") {
  if (unit === "mCi") return value * MCI_TO_MBQ;
  if (unit === "uCi") return value * UCI_TO_MBQ;
  return value;
}

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type CatalogEntry = {
  test_code: string;
  test_name: string;
};

type BaselineRecord = {
  id: number;
  equipment_id: number | null;
  test_code: string;
  parameter_name: string;
  value: number | null;
  unit: string | null;
  date_established: string;
  radionuclide: string | null;
  geometry: string | null;
  operator: string | null;
  physicist_responsible: string | null;
  is_current: boolean;
  previous_baseline_id: number | null;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
};

function equipmentLabel(eq: Equipment | undefined): string {
  if (!eq) return "General (sin equipo especifico)";
  return (eq.manufacturer ?? "") + " " + (eq.model ?? "") + " (" + (eq.internal_code ?? "s/codigo") + ")";
}

const emptyBaselineForm = {
  value: "",
  unit: "MBq" as "MBq" | "mCi" | "uCi",
  radionuclide: "",
  geometry: "",
  operator: "",
  physicist_responsible: "",
  change_reason: "",
  changed_by: "",
};

export default function ActivimetroBaselineApp({ equipment, catalog }: { equipment: Equipment[]; catalog: CatalogEntry[] }) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [testCode, setTestCode] = useState("");
  const [parameterName, setParameterName] = useState("");
  const [current, setCurrent] = useState<BaselineRecord | null>(null);
  const [history, setHistory] = useState<BaselineRecord[]>([]);
  const [queried, setQueried] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyBaselineForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateField<K extends keyof typeof emptyBaselineForm>(key: K, value: (typeof emptyBaselineForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadBaseline() {
    if (!testCode || !parameterName) {
      setMessage("Se requieren codigo de prueba y nombre del parametro.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const qs = "testCode=" + encodeURIComponent(testCode) + "&parameterName=" + encodeURIComponent(parameterName) + (equipmentId ? "&equipmentId=" + equipmentId : "");
      const [currentRes, historyRes] = await Promise.all([
        fetch("/api/quality-control/activimetro/baseline?" + qs),
        fetch("/api/quality-control/activimetro/baseline?" + qs + "&history=true"),
      ]);
      const currentData = await currentRes.json();
      const historyData = await historyRes.json();
      setCurrent(currentData ?? null);
      setHistory(Array.isArray(historyData) ? historyData : []);
      setQueried(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testCode || !parameterName) {
      setMessage("Se requieren codigo de prueba y nombre del parametro.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const isActivity = form.unit === "MBq" || form.unit === "mCi" || form.unit === "uCi";
      const convertedValue = form.value === "" ? null : isActivity ? toMBq(Number(form.value), form.unit) : Number(form.value);
      const res = await fetch("/api/quality-control/activimetro/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId || null,
          test_code: testCode,
          parameter_name: parameterName,
          value: convertedValue,
          unit: isActivity ? "MBq" : form.unit || null,
          radionuclide: form.radionuclide || null,
          geometry: form.geometry || null,
          operator: form.operator || null,
          physicist_responsible: form.physicist_responsible || null,
          change_reason: form.change_reason || null,
          changed_by: form.changed_by || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setMessage("Baseline establecido correctamente.");
      setForm(emptyBaselineForm);
      setShowForm(false);
      await loadBaseline();
    } catch {
      setMessage("Ocurrio un error al establecer el baseline.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Baseline del Equipo (Activimetro)</h1>
        <p className="text-sm text-gray-500">
          Valor de referencia por equipo, prueba y parametro (secciones 27-28 del prompt maestro). El
          baseline nunca se sobrescribe: al establecer un nuevo valor, el anterior se conserva con su
          motivo, usuario y fecha de cambio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Equipo</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm text-slate-800"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">General (sin equipo especifico)</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {equipmentLabel(eq)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Prueba</label>
          <select className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={testCode} onChange={(e) => setTestCode(e.target.value)}>
            <option value="">Seleccionar...</option>
            {catalog.map((c) => (
              <option key={c.test_code} value={c.test_code}>
                {c.test_code} - {c.test_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Parametro</label>
          <input
            type="text"
            placeholder="ej. actividad_MBq"
            className="w-full border rounded px-2 py-1 text-sm text-slate-800"
            value={parameterName}
            onChange={(e) => setParameterName(e.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <button type="button" onClick={loadBaseline} disabled={loading} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">
            {loading ? "Consultando..." : "Consultar baseline"}
          </button>
          {message && <span className="ml-3 text-sm text-gray-400">{message}</span>}
        </div>
      </div>

      {queried && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">Baseline vigente</h2>
              <button type="button" onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 rounded bg-green-600 text-white text-xs">
                {showForm ? "Cancelar" : current ? "Establecer nuevo valor" : "Establecer baseline inicial"}
              </button>
            </div>
            {current ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-300">
                <div>
                  <span className="text-gray-500">Valor:</span> {current.value ?? "-"} {current.unit ?? ""}
                </div>
                <div>
                  <span className="text-gray-500">Fecha:</span> {new Date(current.date_established).toLocaleDateString()}
                </div>
                <div>
                  <span className="text-gray-500">Radionucleido:</span> {current.radionuclide ?? "-"}
                </div>
                <div>
                  <span className="text-gray-500">Geometria:</span> {current.geometry ?? "-"}
                </div>
                <div>
                  <span className="text-gray-500">Operador:</span> {current.operator ?? "-"}
                </div>
                <div>
                  <span className="text-gray-500">Fisico responsable:</span> {current.physicist_responsible ?? "-"}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No hay baseline establecido para esta combinacion.</p>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4">
              <NumField label="Valor" value={form.value} onChange={(v) => updateField("value", v)} />
              <div>
                <label className="text-sm font-medium block mb-1">Unidad</label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm text-slate-800"
                  value={form.unit}
                  onChange={(e) => updateField("unit", e.target.value === "mCi" ? "mCi" : e.target.value === "uCi" ? "uCi" : "MBq")}
                >
                  <option value="MBq">MBq</option>
                  <option value="mCi">mCi (se convertira a MBq automaticamente)</option>
                  <option value="uCi">µCi (se convertira a MBq automaticamente)</option>
                </select>
              </div>
              <TxtField label="Radionucleido" value={form.radionuclide} onChange={(v) => updateField("radionuclide", v)} />
              <TxtField label="Geometria" value={form.geometry} onChange={(v) => updateField("geometry", v)} />
              <TxtField label="Operador" value={form.operator} onChange={(v) => updateField("operator", v)} />
              <TxtField
                label="Fisico responsable"
                value={form.physicist_responsible}
                onChange={(v) => updateField("physicist_responsible", v)}
              />
              <TxtField label="Registrado por" value={form.changed_by} onChange={(v) => updateField("changed_by", v)} />
              <div className="md:col-span-2">
                <label className="text-sm font-medium block mb-1">
                  Motivo del cambio {current ? "(obligatorio al reemplazar un baseline existente)" : ""}
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1 text-sm text-slate-800"
                  value={form.change_reason}
                  onChange={(e) => updateField("change_reason", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 text-white text-sm">
                  {loading ? "Guardando..." : "Guardar baseline"}
                </button>
              </div>
            </form>
          )}

          <div className="border rounded-lg p-4">
            <h2 className="font-semibold text-sm mb-2">Historico completo</h2>
            {history.length === 0 && <p className="text-xs text-gray-500">Sin historico.</p>}
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="border rounded p-2 text-xs flex flex-wrap items-center gap-2">
                  {h.is_current && (
                    <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-300 font-semibold">
                      VIGENTE
                    </span>
                  )}
                  <span className="font-medium">
                    {h.value ?? "-"} {h.unit ?? ""}
                  </span>
                  <span className="text-gray-500">{new Date(h.date_established).toLocaleDateString()}</span>
                  {h.change_reason && <span className="text-gray-500">Motivo: {h.change_reason}</span>}
                  {h.changed_by && <span className="text-gray-500">Por: {h.changed_by}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TxtField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input type="number" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
