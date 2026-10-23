"use client";

import { useState } from "react";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * Gestion del baseline por equipo / tipo de prueba / parametro.
 * SPECT solo tiene test_type (sin test_mode), a diferencia de Gammacamara.
 * El baseline nunca se sobrescribe: al establecer un nuevo valor el
 * anterior se conserva (is_current = false) con motivo, usuario y fecha.
 */

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type ToleranceRow = {
  test_type: string;
};

type BaselineRecord = {
  id: number;
  equipment_id: number | null;
  test_type: string;
  parameter_name: string;
  value: number | null;
  unit: string | null;
  date_established: string;
  methodology: string | null;
  phantom: string | null;
  protocol: string | null;
  operator: string | null;
  physicist_responsible: string | null;
  is_current: boolean;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
};

function eqLabel(eq: Equipment | undefined): string {
  if (!eq) return "General (sin equipo específico)";
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/código"})`.trim();
}

const emptyForm = {
  value: "",
  unit: "",
  methodology: "",
  phantom: "",
  protocol: "",
  operator: "",
  physicist_responsible: "",
  change_reason: "",
  changed_by: "",
};

export default function SpectBaselineApp({
  equipment,
  tolerances,
}: {
  equipment: Equipment[];
  tolerances: ToleranceRow[];
}) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [testType, setTestType] = useState("");
  const [parameterName, setParameterName] = useState("");
  const [current, setCurrent] = useState<BaselineRecord | null>(null);
  const [history, setHistory] = useState<BaselineRecord[]>([]);
  const [queried, setQueried] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Derive unique test_types from tolerances
  const testTypes = Array.from(new Set(tolerances.map(t => t.test_type))).sort();

  function upd<K extends keyof typeof emptyForm>(key: K, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function loadBaseline() {
    if (!testType || !parameterName) {
      setMessage("Se requieren tipo de prueba y nombre del parámetro.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({
        testType,
        parameterName,
        ...(equipmentId ? { equipmentId: String(equipmentId) } : {}),
      });
      const [curRes, histRes] = await Promise.all([
        fetch("/api/quality-control/spect/baseline?" + qs),
        fetch("/api/quality-control/spect/baseline?" + qs + "&history=true"),
      ]);
      setCurrent((await curRes.json()) ?? null);
      const hd = await histRes.json();
      setHistory(Array.isArray(hd) ? hd : []);
      setQueried(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testType || !parameterName) {
      setMessage("Se requieren tipo de prueba y nombre del parámetro.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quality-control/spect/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId || null,
          test_type: testType,
          parameter_name: parameterName,
          value: form.value === "" ? null : Number(form.value),
          unit: form.unit || null,
          methodology: form.methodology || null,
          phantom: form.phantom || null,
          protocol: form.protocol || null,
          operator: form.operator || null,
          physicist_responsible: form.physicist_responsible || null,
          change_reason: form.change_reason || null,
          changed_by: form.changed_by || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("Baseline establecido correctamente.");
      setForm(emptyForm);
      setShowForm(false);
      await loadBaseline();
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-0.5";

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Baseline del Equipo — SPECT</h1>
        <p className="text-xs text-muted-foreground">
          Valor de referencia por equipo, tipo de prueba y parámetro (IAEA TECDOC-602).
          El baseline nunca se sobrescribe: al establecer un nuevo valor el anterior queda en el histórico
          con motivo de cambio, usuario y fecha.
        </p>
      </div>

      {/* Query panel */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-surface">
        <h2 className="text-sm font-semibold">Consultar baseline</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Equipo</label>
            <select className={inputCls} value={equipmentId} onChange={e => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">General (sin equipo específico)</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eqLabel(eq)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tipo de prueba</label>
            <select className={inputCls} value={testType} onChange={e => setTestType(e.target.value)}>
              <option value="">Seleccionar...</option>
              {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Parámetro</label>
            <input
              className={inputCls}
              placeholder="ej. uniformidad_integral_%"
              value={parameterName}
              onChange={e => setParameterName(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadBaseline}
            disabled={loading}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Consultando..." : "Consultar baseline"}
          </button>
          {message && <span className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{message}</span>}
        </div>
      </div>

      {queried && (
        <div className="space-y-4">
          {/* Current baseline */}
          <div className="rounded-lg border border-border p-4 bg-surface">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Baseline vigente</h2>
              <button
                type="button"
                onClick={() => setShowForm(v => !v)}
                className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                {showForm ? "Cancelar" : current ? "Establecer nuevo valor" : "Establecer baseline inicial"}
              </button>
            </div>
            {current ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Valor: </span><span className="font-medium">{current.value ?? "—"} {current.unit ?? ""}</span></div>
                <div><span className="text-muted-foreground">Fecha: </span>{current.date_established?.slice(0, 10)}</div>
                <div><span className="text-muted-foreground">Phantom: </span>{current.phantom ?? "—"}</div>
                <div><span className="text-muted-foreground">Metodología: </span>{current.methodology ?? "—"}</div>
                <div><span className="text-muted-foreground">Operador: </span>{current.operator ?? "—"}</div>
                <div><span className="text-muted-foreground">Físico responsable: </span>{current.physicist_responsible ?? "—"}</div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No hay baseline establecido para esta combinación. El físico médico responsable debe definirlo.
              </p>
            )}
          </div>

          {/* New baseline form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 space-y-3 bg-surface">
              <h2 className="text-sm font-semibold">Establecer nuevo baseline</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelCls}>Valor</label>
                  <input type="number" step="any" className={inputCls} value={form.value} onChange={e => upd("value", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Unidad</label>
                  <input className={inputCls} value={form.unit} onChange={e => upd("unit", e.target.value)} placeholder="ej. %, cps/MBq, mm" />
                </div>
                <div>
                  <label className={labelCls}>Phantom utilizado</label>
                  <input className={inputCls} value={form.phantom} onChange={e => upd("phantom", e.target.value)} placeholder="ej. Jaszczak, NEMA IQ" />
                </div>
                <div>
                  <label className={labelCls}>Metodología</label>
                  <input className={inputCls} value={form.methodology} onChange={e => upd("methodology", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Protocolo de adquisición</label>
                  <input className={inputCls} value={form.protocol} onChange={e => upd("protocol", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Operador</label>
                  <input className={inputCls} value={form.operator} onChange={e => upd("operator", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Físico médico responsable</label>
                  <input className={inputCls} value={form.physicist_responsible} onChange={e => upd("physicist_responsible", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Registrado por</label>
                  <input className={inputCls} value={form.changed_by} onChange={e => upd("changed_by", e.target.value)} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelCls}>
                    Motivo del cambio {current ? "(obligatorio al reemplazar un baseline existente)" : ""}
                  </label>
                  <input className={inputCls} value={form.change_reason} onChange={e => upd("change_reason", e.target.value)} />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Guardar baseline"}
              </button>
            </form>
          )}

          {/* History */}
          <div className="rounded-lg border border-border p-4 bg-surface">
            <h2 className="text-sm font-semibold mb-3">Histórico completo</h2>
            {history.length === 0 && <p className="text-xs text-muted-foreground">Sin histórico para esta combinación.</p>}
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="rounded border border-border p-2 text-xs flex flex-wrap items-center gap-2">
                  {h.is_current && (
                    <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 font-semibold">VIGENTE</span>
                  )}
                  <span className="font-medium">{h.value ?? "—"} {h.unit ?? ""}</span>
                  <span className="text-muted-foreground">{h.date_established?.slice(0, 10)}</span>
                  {h.change_reason && <span className="text-muted-foreground">Motivo: {h.change_reason}</span>}
                  {h.changed_by && <span className="text-muted-foreground">Por: {h.changed_by}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
