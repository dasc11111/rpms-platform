"use client";

import { useCallback, useEffect, useState } from "react";

const PROBABILITY_SCALE = [
  { value: 1, label: "1 - Muy baja" },
  { value: 2, label: "2 - Baja" },
  { value: 3, label: "3 - Media" },
  { value: 4, label: "4 - Alta" },
  { value: 5, label: "5 - Muy alta" },
];

const SEVERITY_SCALE = [
  { value: 1, label: "1 - Insignificante" },
  { value: 2, label: "2 - Menor" },
  { value: 3, label: "3 - Moderada" },
  { value: 4, label: "4 - Mayor" },
  { value: 5, label: "5 - Catastrofica" },
];

const STATUSES = [
  { value: "identificado", label: "Identificado", dot: "⚪" },
  { value: "en_tratamiento", label: "En tratamiento", dot: "🟡" },
  { value: "controlado", label: "Controlado", dot: "🟢" },
  { value: "cerrado", label: "Cerrado", dot: "⚫" },
];

const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.value, { label: s.label, dot: s.dot }])
);

const LEVEL_DOT = {
  bajo: "🟢",
  moderado: "🟡",
  alto: "🟠",
  muy_alto: "🔴",
};

function cellClass(score) {
  if (score <= 4) return "bg-green-950 text-green-300 border-green-800";
  if (score <= 9) return "bg-yellow-950 text-yellow-300 border-yellow-800";
  if (score <= 15) return "bg-orange-950 text-orange-300 border-orange-800";
  return "bg-red-950 text-red-300 border-red-800";
}

export function RiesgosTab({ facilityId, actorEmail }) {
  const [risks, setRisks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [form, setForm] = useState({ probability: 1, severity: 1, status: "identificado" });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const load = useCallback(async () => {
    if (!facilityId) return;
    const res = await fetch("/api/radioterapia/risks?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) {
      setRisks(data.risks);
      setSummary(data.summary);
      setMatrix(data.matrix);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleCreate() {
    if (!form.description || !form.action) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...form }),
      });
      setForm({ probability: 1, severity: 1, status: "identificado" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    await fetch("/api/radioterapia/risks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, actorEmail }),
    });
    load();
  }

  let filtered = filterStatus ? risks.filter((r) => r.status === filterStatus) : risks;
  if (selectedCell) {
    filtered = filtered.filter((r) => Number(r.probability) === selectedCell.p && Number(r.severity) === selectedCell.s);
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <SummaryBox label="Total" value={summary.total} onClick={() => setFilterStatus("")} active={filterStatus === ""} />
          <SummaryBox label="Abiertos" value={summary.abiertos} />
          <SummaryBox label="🟢 Bajo" value={summary.bajo} />
          <SummaryBox label="🟡 Moderado" value={summary.moderado} />
          <SummaryBox label="🟠 Alto" value={summary.alto} />
          <SummaryBox label="🔴 Muy alto" value={summary.muyAlto} />
          <SummaryBox label="🟢 Controlados" value={summary.controlados} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Mapa de riesgos (Probabilidad x Consecuencia)</p>
        <p className="mb-2 text-[11px] text-muted-foreground">Clasificacion de gestion (no normativa), calculada como Probabilidad x Severidad. Seleccione una celda para ver los riesgos asociados.</p>
        {matrix && (
          <table className="border-collapse text-xs">
            <tbody>
              {[5, 4, 3, 2, 1].map((p) => (
                <tr key={p}>
                  <td className="p-1 pr-2 text-right text-muted-foreground">{p}</td>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const count = matrix[p] ? matrix[p][s] || 0 : 0;
                    const score = p * s;
                    const active = selectedCell && selectedCell.p === p && selectedCell.s === s;
                    return (
                      <td key={s} className="p-0.5">
                        <button
                          onClick={() => setSelectedCell(active ? null : { p, s })}
                          className={"h-12 w-12 border text-center " + cellClass(score) + (active ? " ring-2 ring-accent" : "")}
                        >
                          {count > 0 ? count : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="p-1"></td>
                {[1, 2, 3, 4, 5].map((s) => (
                  <td key={s} className="p-1 text-center text-muted-foreground">{s}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">Filas: Probabilidad (1-5, de abajo hacia arriba). Columnas: Consecuencia/Severidad (1-5).</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar riesgo</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input className={inputCls} placeholder="Area" value={form.area || ""} onChange={(e) => set("area", e.target.value)} />
          <input className={inputCls} placeholder="Equipo" value={form.equipment || ""} onChange={(e) => set("equipment", e.target.value)} />
          <input className={inputCls} placeholder="Proceso" value={form.process || ""} onChange={(e) => set("process", e.target.value)} />
          <select className={inputCls} value={form.probability} onChange={(e) => set("probability", Number(e.target.value))}>
            {PROBABILITY_SCALE.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
          </select>
          <select className={inputCls} value={form.severity} onChange={(e) => set("severity", Number(e.target.value))}>
            {SEVERITY_SCALE.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
          <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </div>
        <textarea className={inputCls + " mt-2"} placeholder="Descripcion del riesgo" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Causa" value={form.cause || ""} onChange={(e) => set("cause", e.target.value)} />
          <input className={inputCls} placeholder="Consecuencia" value={form.consequence || ""} onChange={(e) => set("consequence", e.target.value)} />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className={inputCls} placeholder="Control existente" value={form.existingControl || ""} onChange={(e) => set("existingControl", e.target.value)} />
          <input className={inputCls} placeholder="Accion propuesta" value={form.action || ""} onChange={(e) => set("action", e.target.value)} />
          <input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input type="date" className={inputCls} value={form.dueDate || ""} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
        <button onClick={handleCreate} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar riesgo"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Riesgos registrados</p>
          <div className="flex gap-2">
            {selectedCell && (
              <button onClick={() => setSelectedCell(null)} className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground">
                Quitar filtro de celda (P{selectedCell.p} x C{selectedCell.s})
              </button>
            )}
            <select className={inputCls + " w-auto"} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">Descripcion</th>
              <th className="p-1">Area/Equipo</th>
              <th className="p-1">P x S</th>
              <th className="p-1">Nivel</th>
              <th className="p-1">Control existente</th>
              <th className="p-1">Accion</th>
              <th className="p-1">Responsable</th>
              <th className="p-1">Vencimiento</th>
              <th className="p-1">Estado</th>
              <th className="p-1">Cambiar estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-1 text-foreground">{r.description}</td>
                <td className="p-1 text-foreground">{r.area || "-"}{r.equipment ? " / " + r.equipment : ""}</td>
                <td className="p-1 text-foreground">{r.probability} x {r.severity} = {r.classification ? r.classification.score : "-"}</td>
                <td className="p-1 text-foreground">{r.classification ? LEVEL_DOT[r.classification.level] : ""} {r.classification ? r.classification.label : ""}</td>
                <td className="p-1 text-foreground">{r.existing_control || "-"}</td>
                <td className="p-1 text-foreground">{r.action || "-"}</td>
                <td className="p-1 text-foreground">{r.responsible || "-"}</td>
                <td className="p-1 text-foreground">{r.due_date ? String(r.due_date).slice(0, 10) : "-"}</td>
                <td className="p-1 text-foreground">{STATUS_MAP[r.status] ? STATUS_MAP[r.status].dot : ""} {STATUS_MAP[r.status] ? STATUS_MAP[r.status].label : r.status}</td>
                <td className="p-1">
                  <select
                    className={inputCls}
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="p-2 text-center text-muted-foreground">Sin riesgos registrados para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-lg border p-3 text-left " +
        (active ? "border-accent" : "border-border") +
        " bg-surface hover:bg-muted"
      }
    >
      <p className="text-lg font-semibold text-foreground">{value != null ? value : 0}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </button>
  );
}
