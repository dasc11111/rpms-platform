"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 2 - GAMMACAMARA - FASE A
 * Registro de eventos de servicio técnico de la gammacámara.
 * DS 133/1984: trazabilidad de mantenimientos de equipos generadores de radiación.
 */

type ServiceEvent = {
  id: number;
  equipment_id: number | null;
  service_type: string;
  service_date: string | null;
  technician: string | null;
  company: string | null;
  description: string | null;
  finding: string | null;
  action_taken: string | null;
  status: string;
  post_service_qc_required: boolean;
  post_service_qc_completed: boolean;
  created_at: string;
};

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

const SERVICE_TYPES = [
  { value: "mantenimiento_preventivo", label: "Mantenimiento preventivo" },
  { value: "mantenimiento_correctivo", label: "Mantenimiento correctivo" },
  { value: "calibracion", label: "Calibración" },
  { value: "actualizacion_software", label: "Actualización de software" },
  { value: "reemplazo_componente", label: "Reemplazo de componente" },
  { value: "inspeccion_regulatoria", label: "Inspección regulatoria" },
  { value: "otro", label: "Otro" },
];

const STATUS_TYPES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
];

const emptyForm = {
  equipment_id: "" as string | number,
  service_type: "mantenimiento_preventivo",
  service_date: "",
  technician: "",
  company: "",
  description: "",
  finding: "",
  action_taken: "",
  status: "completado",
  post_service_qc_required: false,
  post_service_qc_completed: false,
};

export default function GammacamaraServiceEventsApp() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [filterEquipmentId, setFilterEquipmentId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEquipment() {
    const res = await fetch("/api/quality-control/gammacamara/equipment");
    setEquipmentList(await res.json());
  }

  async function loadEvents(equipmentId?: number) {
    const url = equipmentId
      ? `/api/quality-control/gammacamara/service-events?equipment_id=${equipmentId}`
      : "/api/quality-control/gammacamara/service-events";
    const res = await fetch(url);
    setEvents(await res.json());
  }

  useEffect(() => {
    loadEquipment();
    loadEvents();
  }, []);

  function handleFilterChange(id: number | null) {
    setFilterEquipmentId(id);
    loadEvents(id ?? undefined);
  }

  function selectEvent(ev: ServiceEvent | null) {
    if (!ev) {
      setSelectedId(null);
      setForm(emptyForm);
      return;
    }
    setSelectedId(ev.id);
    setForm({
      equipment_id: ev.equipment_id ?? "",
      service_type: ev.service_type,
      service_date: ev.service_date?.slice(0, 10) ?? "",
      technician: ev.technician ?? "",
      company: ev.company ?? "",
      description: ev.description ?? "",
      finding: ev.finding ?? "",
      action_taken: ev.action_taken ?? "",
      status: ev.status,
      post_service_qc_required: ev.post_service_qc_required,
      post_service_qc_completed: ev.post_service_qc_completed,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        equipment_id: form.equipment_id !== "" ? Number(form.equipment_id) : null,
        ...(selectedId ? { id: selectedId } : {}),
      };
      const method = selectedId ? "PUT" : "POST";
      const res = await fetch("/api/quality-control/gammacamara/service-events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(selectedId ? "Evento actualizado correctamente." : "Evento registrado correctamente.");
      setSelectedId(null);
      setForm(emptyForm);
      await loadEvents(filterEquipmentId ?? undefined);
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-0.5";

  function equipmentLabel(eq: Equipment) {
    const parts = [eq.manufacturer, eq.model].filter(Boolean).join(" ");
    return eq.internal_code ? `${parts} (${eq.internal_code})` : parts || `Equipo #${eq.id}`;
  }

  function serviceTypeLabel(val: string) {
    return SERVICE_TYPES.find(t => t.value === val)?.label ?? val;
  }

  function statusLabel(val: string) {
    return STATUS_TYPES.find(t => t.value === val)?.label ?? val;
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      completado: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
      en_progreso: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
      pendiente: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
      cancelado: "bg-muted text-muted-foreground",
    };
    return map[status] ?? "bg-muted text-muted-foreground";
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Eventos de Servicio Técnico — Gammacámara</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL. Trazabilidad de mantenimientos, calibraciones e intervenciones en equipos de cámara de centelleo.
        </p>
      </div>

      {/* Filter by equipment */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtrar por equipo:</span>
        <button
          className={`rounded border px-2.5 py-1 text-xs ${filterEquipmentId === null ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
          onClick={() => handleFilterChange(null)}
        >
          Todos
        </button>
        {equipmentList.map(eq => (
          <button
            key={eq.id}
            className={`rounded border px-2.5 py-1 text-xs ${filterEquipmentId === eq.id ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
            onClick={() => handleFilterChange(eq.id)}
          >
            {equipmentLabel(eq)}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium">Eventos registrados</span>
          <button
            className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
            onClick={() => selectEvent(null)}
          >
            + Nuevo evento
          </button>
        </div>
        {events.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin eventos registrados{filterEquipmentId ? " para este equipo" : ""}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left">Tipo de servicio</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Empresa / Técnico</th>
                <th className="px-4 py-2 text-left hidden lg:table-cell">QC post-servicio</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map(ev => {
                const eq = equipmentList.find(e => e.id === ev.equipment_id);
                return (
                  <tr key={ev.id} className={`hover:bg-muted/30 ${selectedId === ev.id ? "bg-muted/20" : ""}`}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{serviceTypeLabel(ev.service_type)}</span>
                      {eq && <span className="ml-2 text-xs text-muted-foreground">{equipmentLabel(eq)}</span>}
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell text-xs text-muted-foreground">
                      {ev.service_date?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell text-xs text-muted-foreground">
                      {[ev.company, ev.technician].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell text-xs">
                      {ev.post_service_qc_required ? (
                        ev.post_service_qc_completed
                          ? <span className="text-green-600">✓ Realizado</span>
                          : <span className="text-red-600 font-medium">⚠ Pendiente</span>
                      ) : <span className="text-muted-foreground">No requerido</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusBadge(ev.status)}`}>
                        {statusLabel(ev.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        onClick={() => selectEvent(ev)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 space-y-4 bg-surface">
        <h2 className="text-sm font-semibold">
          {selectedId ? "Editar evento" : "Registrar nuevo evento"}
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Equipo</label>
            <select
              className={inputCls}
              value={form.equipment_id}
              onChange={e => setForm(prev => ({ ...prev, equipment_id: e.target.value }))}
            >
              <option value="">— Sin asociar —</option>
              {equipmentList.map(eq => (
                <option key={eq.id} value={eq.id}>{equipmentLabel(eq)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Tipo de servicio *</label>
            <select
              className={inputCls}
              required
              value={form.service_type}
              onChange={e => setForm(prev => ({ ...prev, service_type: e.target.value }))}
            >
              {SERVICE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Fecha del servicio</label>
            <input
              type="date"
              className={inputCls}
              value={form.service_date}
              onChange={e => setForm(prev => ({ ...prev, service_date: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Empresa proveedora</label>
            <input
              className={inputCls}
              value={form.company}
              onChange={e => setForm(prev => ({ ...prev, company: e.target.value }))}
              placeholder="p.ej. Siemens Healthineers Chile"
            />
          </div>

          <div>
            <label className={labelCls}>Técnico responsable</label>
            <input
              className={inputCls}
              value={form.technician}
              onChange={e => setForm(prev => ({ ...prev, technician: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Estado</label>
            <select
              className={inputCls}
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
            >
              {STATUS_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Descripción del trabajo realizado</label>
          <textarea
            className={`${inputCls} resize-y`}
            rows={2}
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Hallazgo / Diagnóstico</label>
            <textarea
              className={`${inputCls} resize-y`}
              rows={2}
              value={form.finding}
              onChange={e => setForm(prev => ({ ...prev, finding: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Acción tomada / Solución</label>
            <textarea
              className={`${inputCls} resize-y`}
              rows={2}
              value={form.action_taken}
              onChange={e => setForm(prev => ({ ...prev, action_taken: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.post_service_qc_required}
              onChange={e => setForm(prev => ({ ...prev, post_service_qc_required: e.target.checked }))}
              className="rounded border-border"
            />
            QC post-servicio requerido
          </label>
          {form.post_service_qc_required && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.post_service_qc_completed}
                onChange={e => setForm(prev => ({ ...prev, post_service_qc_completed: e.target.checked }))}
                className="rounded border-border"
              />
              QC post-servicio completado
            </label>
          )}
        </div>

        {message && (
          <p className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{message}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Guardando..." : selectedId ? "Actualizar evento" : "Registrar evento"}
          </button>
          {selectedId && (
            <button type="button" onClick={() => selectEvent(null)} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
