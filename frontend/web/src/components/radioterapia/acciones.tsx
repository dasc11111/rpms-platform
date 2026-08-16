"use client";

import { useCallback, useEffect, useState } from "react";

const ACTION_TYPES = [
  { value: "correctiva", label: "Correctiva" },
  { value: "preventiva", label: "Preventiva" },
];

const ORIGINS = [
  { value: "incidente", label: "Incidente" },
  { value: "auditoria", label: "Auditoria" },
  { value: "desviacion", label: "Desviacion (QC/blindaje/dispositivo)" },
  { value: "vencimiento", label: "Vencimiento" },
  { value: "riesgo", label: "Riesgo" },
  { value: "tendencia", label: "Tendencia" },
  { value: "alerta", label: "Alerta" },
  { value: "manual", label: "Registro manual" },
];

const PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Critica" },
];

const STATUSES = [
  { value: "pendiente", label: "Pendiente", dot: "🟡" },
  { value: "en_proceso", label: "En proceso", dot: "🔵" },
  { value: "atrasada", label: "Atrasada", dot: "🟠" },
  { value: "completada", label: "Completada", dot: "🟢" },
  { value: "no_resuelta", label: "No resuelta", dot: "🔴" },
  { value: "cancelada", label: "Cancelada", dot: "⚫" },
];

const STATUS_MAP: Record<string, { label: string; dot: string }> = Object.fromEntries(
  STATUSES.map((s) => [s.value, { label: s.label, dot: s.dot }])
);

const ALERT_DOT: Record<string, string> = {
  vencida: "🔴",
  rojo: "🔴",
  naranjo: "🟠",
  amarillo: "🟡",
  verde: "🟢",
  sin_fecha: "⚪",
  cerrada: "⚫",
};

export function AccionesTab({ facilityId, actorEmail }: { facilityId: number; actorEmail: string | null }) {
  const [actions, setActions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [form, setForm] = useState<any>({ actionType: "correctiva", origin: "manual", priority: "media", status: "pendiente" });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const load = useCallback(async () => {
    if (!facilityId) return;
    const res = await fetch("/api/radioterapia/actions?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) {
      setActions(data.actions);
      setSummary(data.summary);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function handleCreate() {
    if (!form.description || !form.action) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...form }),
      });
      setForm({ actionType: "correctiva", origin: "manual", priority: "media", status: "pendiente" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    await fetch("/api/radioterapia/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, actorEmail }),
    });
    load();
  }

  const filtered = filterStatus ? actions.filter((a: any) => a.status === filterStatus) : actions;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <SummaryBox label="Total" value={summary.total} onClick={() => setFilterStatus("")} active={filterStatus === ""} />
          <SummaryBox label="Abiertas" value={summary.abiertas} />
          <SummaryBox label="🔴 Vencidas" value={summary.vencidas} />
          <SummaryBox label="🔴 <=7 dias" value={summary.proximasA7} />
          <SummaryBox label="🟠 <=15 dias" value={summary.proximasA15} />
          <SummaryBox label="🟡 <=30 dias" value={summary.proximasA30} />
          <SummaryBox label="🟢 Completadas" value={summary.completadas} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar accion correctiva / preventiva</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select className={inputCls} value={form.actionType} onChange={(e) => set("actionType", e.target.value)}>
            {ACTION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <select className={inputCls} value={form.origin} onChange={(e) => set("origin", e.target.value)}>
            {ORIGINS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <input className={inputCls} placeholder="Referencia de origen (ej: Incidente #12)" value={form.originRef || ""} onChange={(e) => set("originRef", e.target.value)} />
          <select className={inputCls} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
          </select>
          <input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
          <input type="date" className={inputCls} value={form.dueDate || ""} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
        <textarea className={inputCls + " mt-2"} placeholder="Descripcion del hallazgo/situacion" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Causa (si se conoce)" value={form.cause || ""} onChange={(e) => set("cause", e.target.value)} />
          <input className={inputCls} placeholder="Accion a implementar" value={form.action || ""} onChange={(e) => set("action", e.target.value)} />
        </div>
        <button onClick={handleCreate} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar accion"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Acciones registradas</p>
          <select className={inputCls + " w-auto"} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">Tipo</th>
              <th className="p-1">Origen</th>
              <th className="p-1">Descripcion</th>
              <th className="p-1">Accion</th>
              <th className="p-1">Responsable</th>
              <th className="p-1">Vencimiento</th>
              <th className="p-1">Alerta</th>
              <th className="p-1">Estado</th>
              <th className="p-1">Cambiar estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: any) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="p-1 text-foreground">{a.action_type}</td>
                <td className="p-1 text-foreground">{a.origin}{a.origin_ref ? " (" + a.origin_ref + ")" : ""}</td>
                <td className="p-1 text-foreground">{a.description}</td>
                <td className="p-1 text-foreground">{a.action}</td>
                <td className="p-1 text-foreground">{a.responsible || "-"}</td>
                <td className="p-1 text-foreground">{a.due_date ? String(a.due_date).slice(0, 10) : "-"}</td>
                <td className="p-1 text-foreground">{ALERT_DOT[a.alert?.level] || "⚪"} {a.alert?.label || "-"}</td>
                <td className="p-1 text-foreground">{STATUS_MAP[a.status]?.dot} {STATUS_MAP[a.status]?.label || a.status}</td>
                <td className="p-1">
                  <select
                    className={inputCls}
                    value={a.status}
                    onChange={(e) => updateStatus(a.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-2 text-center text-muted-foreground">Sin acciones registradas para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, onClick, active }: any) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-lg border p-3 text-left " +
        (active ? "border-accent" : "border-border") +
        " bg-surface hover:bg-muted"
      }
    >
      <p className="text-lg font-semibold text-foreground">{value ?? 0}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </button>
  );
}
