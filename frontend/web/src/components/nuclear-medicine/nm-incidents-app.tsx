"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, RefreshCcw, X } from "lucide-react";
import {
  NM_INCIDENT_CATEGORIES,
  NM_INCIDENT_SEVERITIES,
  NM_NOTIFICATION_STATUSES,
  NM_INVESTIGATION_STATUSES,
  type NmIncidentRecord,
} from "@/lib/nm-incidents";

const FIELD_LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT_CLASS =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

type FormState = {
  eventDate: string;
  eventTime: string;
  category: string;
  severity: string;
  isNearMiss: boolean;
  location: string;
  personInvolved: string;
  description: string;
  immediateActions: string;
  notificationStatus: string;
  notifiedTo: string;
  investigationStatus: string;
  correctiveActions: string;
  responsible: string;
  documentsUrl: string;
};

const EMPTY: FormState = {
  eventDate: "",
  eventTime: "",
  category: "otro",
  severity: "leve",
  isNearMiss: false,
  location: "",
  personInvolved: "",
  description: "",
  immediateActions: "",
  notificationStatus: "pendiente",
  notifiedTo: "",
  investigationStatus: "abierto",
  correctiveActions: "",
  responsible: "",
  documentsUrl: "",
};

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    leve: "bg-muted text-muted-foreground",
    moderado: "bg-warning/10 text-warning",
    grave: "bg-danger/10 text-danger",
  };
  const label = NM_INCIDENT_SEVERITIES.find((s) => s.value === severity)?.label ?? severity;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[severity] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function statusBadge(status: string) {
  const isOpen = status === "abierto";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        isOpen ? "bg-accent-subtle text-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {isOpen ? "Abierto" : "Cerrado"}
    </span>
  );
}

export function NmIncidentsApp() {
  const [incidents, setIncidents] = useState<NmIncidentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"todos" | "abierto" | "cerrado">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, version]);

  async function load() {
    setLoading(true);
    try {
      const url =
        filter === "todos" ? "/api/nuclear-medicine/incidents" : `/api/nuclear-medicine/incidents?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setIncidents(data.incidents ?? []);
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  }

  async function submit() {
    setError(null);
    if (!form.eventDate) {
      setError("La fecha del evento es obligatoria.");
      return;
    }
    if (!form.description.trim()) {
      setError("La descripcion del evento es obligatoria.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/nuclear-medicine/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar el registro.");
        setSaving(false);
        return;
      }
      setSaving(false);
      setModalOpen(false);
      setVersion((v) => v + 1);
    } catch {
      setError("Error de red al guardar el registro.");
      setSaving(false);
    }
  }

  async function toggleStatus(record: NmIncidentRecord) {
    const newStatus = record.status === "abierto" ? "cerrado" : "abierto";
    await fetch(`/api/nuclear-medicine/incidents/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Emergencias e Incidentes (Medicina Nuclear)</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Registro cualitativo de derrames, perdida de material, exposiciones no planificadas y otros
            incidentes. La severidad es clasificada manualmente por quien registra el evento; esta vista no
            aplica umbrales numericos automaticos (Fase 0, regla 19).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVersion((v) => v + 1)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nuevo registro
          </button>
        </div>
      </div>

      <div className="mb-4 mt-4 flex gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        <button
          onClick={() => setFilter("todos")}
          className={`flex flex-1 items-center justify-center rounded px-3 py-1.5 ${
            filter === "todos" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter("abierto")}
          className={`flex flex-1 items-center justify-center rounded px-3 py-1.5 ${
            filter === "abierto" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Abiertos
        </button>
        <button
          onClick={() => setFilter("cerrado")}
          className={`flex flex-1 items-center justify-center rounded px-3 py-1.5 ${
            filter === "cerrado" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Cerrados
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Severidad</th>
              <th className="px-3 py-2">Descripcion</th>
              <th className="px-3 py-2">Notificacion</th>
              <th className="px-3 py-2">Investigacion</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Sin registros para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr key={inc.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">
                    {String(inc.event_date).slice(0, 10)} {inc.event_time ? `- ${inc.event_time}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {NM_INCIDENT_CATEGORIES.find((c) => c.value === inc.category)?.label ?? inc.category}
                    {inc.is_near_miss && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                        <AlertTriangle className="h-3 w-3" /> Casi-incidente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{severityBadge(inc.severity)}</td>
                  <td className="max-w-[320px] truncate px-3 py-2 text-xs" title={inc.description}>
                    {inc.description}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {NM_NOTIFICATION_STATUSES.find((s) => s.value === inc.notification_status)?.label ??
                      inc.notification_status}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {NM_INVESTIGATION_STATUSES.find((s) => s.value === inc.investigation_status)?.label ??
                      inc.investigation_status}
                  </td>
                  <td className="px-3 py-2">{statusBadge(inc.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleStatus(inc)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      {inc.status === "abierto" ? "Cerrar" : "Reabrir"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nuevo registro de emergencia/incidente</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>Fecha del evento *</label>
                <input
                  type="date"
                  className={INPUT_CLASS}
                  value={form.eventDate}
                  onChange={(e) => set("eventDate", e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Hora</label>
                <input
                  type="time"
                  className={INPUT_CLASS}
                  value={form.eventTime}
                  onChange={(e) => set("eventTime", e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Categoria</label>
                <select className={INPUT_CLASS} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {NM_INCIDENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Severidad (clasificacion manual)</label>
                <select className={INPUT_CLASS} value={form.severity} onChange={(e) => set("severity", e.target.value)}>
                  {NM_INCIDENT_SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Lugar</label>
                <input className={INPUT_CLASS} value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Personal involucrado</label>
                <input
                  className={INPUT_CLASS}
                  value={form.personInvolved}
                  onChange={(e) => set("personInvolved", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Descripcion del evento *</label>
                <textarea
                  className={INPUT_CLASS}
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Acciones inmediatas</label>
                <textarea
                  className={INPUT_CLASS}
                  rows={2}
                  value={form.immediateActions}
                  onChange={(e) => set("immediateActions", e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Estado de notificacion</label>
                <select
                  className={INPUT_CLASS}
                  value={form.notificationStatus}
                  onChange={(e) => set("notificationStatus", e.target.value)}
                >
                  {NM_NOTIFICATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Notificado a</label>
                <input className={INPUT_CLASS} value={form.notifiedTo} onChange={(e) => set("notifiedTo", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Estado de investigacion</label>
                <select
                  className={INPUT_CLASS}
                  value={form.investigationStatus}
                  onChange={(e) => set("investigationStatus", e.target.value)}
                >
                  {NM_INVESTIGATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Responsable</label>
                <input className={INPUT_CLASS} value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Acciones correctivas</label>
                <textarea
                  className={INPUT_CLASS}
                  rows={2}
                  value={form.correctiveActions}
                  onChange={(e) => set("correctiveActions", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>URL de documentos de respaldo</label>
                <input
                  className={INPUT_CLASS}
                  value={form.documentsUrl}
                  onChange={(e) => set("documentsUrl", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="isNearMiss"
                  type="checkbox"
                  checked={form.isNearMiss}
                  onChange={(e) => set("isNearMiss", e.target.checked)}
                />
                <label htmlFor="isNearMiss" className="text-xs text-muted-foreground">
                  Corresponde a un casi-incidente (near miss), sin consecuencias reales
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
