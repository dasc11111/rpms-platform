"use client";

import { useEffect, useState } from "react";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Gestion de eventos de servicio tecnico (seccion 30 del prompt maestro):
 * registrar una intervencion tecnica (mantenimiento, cambio de componente,
 * actualizacion de software, etc.) y hacer seguimiento de las pruebas de QC
 * que corresponde repetir tras esa intervencion (control post-servicio).
 * El sistema solo lista las pruebas requeridas segun el catalogo
 * (freq_post_service = true); nunca decide automaticamente resultados
 * clinicos ni de mantenimiento, eso queda a criterio del Fisico Medico.
 */

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type CatalogEntry = {
  test_code: string;
  test_name: string;
  freq_post_service: boolean;
};

type ServiceEvent = {
  id: number;
  equipment_id: number | null;
  service_type: string;
  component_affected: string | null;
  service_date: string;
  technician: string | null;
  company: string | null;
  work_order_number: string | null;
  description: string | null;
  tests_required: string[] | null;
  tests_completed: string[] | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ["pendiente", "en_progreso", "completado"];

const STATUS_STYLES: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  en_progreso: "bg-blue-100 text-blue-800 border-blue-300",
  completado: "bg-green-100 text-green-800 border-green-300",
};

function equipmentLabel(eq: Equipment | undefined): string {
  if (!eq) return "Equipo no especificado";
  const manufacturer = eq.manufacturer ?? "";
  const model = eq.model ?? "";
  const code = eq.internal_code ?? "s/codigo";
  return manufacturer + " " + model + " (" + code + ")";
}

const emptyForm = {
  equipment_id: "" as number | "",
  service_type: "",
  component_affected: "",
  service_date: new Date().toISOString().substring(0, 10),
  technician: "",
  company: "",
  work_order_number: "",
  description: "",
  created_by: "",
};

export default function ActivimetroServiceEventsApp({ equipment }: { equipment: Equipment[] }) {
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [filterEquipment, setFilterEquipment] = useState<number | "">("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [overrideTests, setOverrideTests] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const postServiceTests = catalog.filter((c) => c.freq_post_service);

  async function loadEvents() {
    const url = filterEquipment
      ? "/api/quality-control/activimetro/service-events?equipmentId=" + filterEquipment
      : "/api/quality-control/activimetro/service-events";
    const res = await fetch(url);
    const data = await res.json();
    setEvents(data);
  }

  async function loadCatalog() {
    const res = await fetch("/api/quality-control/activimetro/catalog");
    const data = await res.json();
    setCatalog(data);
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEquipment]);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTest(code: string) {
    setSelectedTests((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.service_type || !form.service_date) {
      setMessage("Se requieren tipo de servicio y fecha.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quality-control/activimetro/service-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: form.equipment_id || null,
          service_type: form.service_type,
          component_affected: form.component_affected || null,
          service_date: form.service_date,
          technician: form.technician || null,
          company: form.company || null,
          work_order_number: form.work_order_number || null,
          description: form.description || null,
          tests_required: overrideTests ? selectedTests : null,
          created_by: form.created_by || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setMessage("Evento de servicio registrado correctamente.");
      setForm(emptyForm);
      setOverrideTests(false);
      setSelectedTests([]);
      setShowForm(false);
      await loadEvents();
    } catch {
      setMessage("Ocurrio un error al registrar el evento de servicio.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(event: ServiceEvent, status: string) {
    await fetch("/api/quality-control/activimetro/service-events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, status, tests_completed: event.tests_completed ?? [] }),
    });
    await loadEvents();
  }

  async function toggleCompletedTest(event: ServiceEvent, code: string) {
    const current = event.tests_completed ?? [];
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    await fetch("/api/quality-control/activimetro/service-events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, status: event.status, tests_completed: next }),
    });
    await loadEvents();
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Eventos de Servicio Tecnico - Activimetro</h1>
        <p className="text-sm text-gray-500">
          Registro de intervenciones tecnicas (seccion 30 del prompt maestro) y seguimiento de las pruebas
          de control de calidad que corresponde repetir tras cada intervencion. El sistema solo lista las
          pruebas requeridas segun el catalogo; no decide resultados clinicos ni de mantenimiento.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end border rounded-lg p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Filtrar por equipo</label>
          <select
            className="border rounded px-2 py-1 text-sm min-w-[260px] text-slate-800"
            value={filterEquipment}
            onChange={(e) => setFilterEquipment(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Todos los equipos</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {equipmentLabel(eq)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
        >
          {showForm ? "Cancelar" : "+ Registrar evento de servicio"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
          <div>
            <label className="text-sm font-medium block mb-1">Equipo</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm text-slate-800"
              value={form.equipment_id}
              onChange={(e) => updateField("equipment_id", e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Sin especificar</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {equipmentLabel(eq)}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Tipo de servicio" value={form.service_type} onChange={(v) => updateField("service_type", v)} />
          <TextField label="Componente afectado" value={form.component_affected} onChange={(v) => updateField("component_affected", v)} />
          <div>
            <label className="text-sm font-medium block mb-1">Fecha del servicio</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 text-sm text-slate-800"
              value={form.service_date}
              onChange={(e) => updateField("service_date", e.target.value)}
            />
          </div>
          <TextField label="Tecnico" value={form.technician} onChange={(v) => updateField("technician", v)} />
          <TextField label="Empresa / Compania" value={form.company} onChange={(v) => updateField("company", v)} />
          <TextField label="N de orden de trabajo" value={form.work_order_number} onChange={(v) => updateField("work_order_number", v)} />
          <TextField label="Registrado por" value={form.created_by} onChange={(v) => updateField("created_by", v)} />

          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Descripcion</label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm text-slate-800"
              rows={2}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 border-t pt-3">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input type="checkbox" checked={overrideTests} onChange={(e) => setOverrideTests(e.target.checked)} />
              Definir manualmente las pruebas requeridas (por defecto se usan todas las marcadas
              &quot;post-servicio&quot; en el catalogo)
            </label>
            {overrideTests && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {postServiceTests.map((t) => (
                  <label key={t.test_code} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={selectedTests.includes(t.test_code)} onChange={() => toggleTest(t.test_code)} />
                    {t.test_code} - {t.test_name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 text-white text-sm">
              {loading ? "Guardando..." : "Registrar evento"}
            </button>
            {message && <span className="text-sm text-gray-400">{message}</span>}
          </div>
        </form>
      )}

      <div className="space-y-3">
        {events.length === 0 && <p className="text-sm text-gray-500">No hay eventos de servicio registrados.</p>}
        {events.map((ev) => {
          const eq = equipment.find((e) => e.id === ev.equipment_id);
          const required = ev.tests_required ?? [];
          const completed = ev.tests_completed ?? [];
          const statusClass = "inline-block px-2 py-0.5 rounded text-xs font-semibold border " + (STATUS_STYLES[ev.status] ?? "");
          return (
            <div key={ev.id} className="border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusClass}>
                  {ev.status.toUpperCase()}
                </span>
                <span className="font-medium">{ev.service_type}</span>
                {ev.component_affected && <span className="text-gray-500">({ev.component_affected})</span>}
                <span className="text-xs text-gray-500">{equipmentLabel(eq)}</span>
                <span className="text-xs text-gray-500">{new Date(ev.service_date).toLocaleDateString()}</span>
                {ev.technician && <span className="text-xs text-gray-500">Tecnico: {ev.technician}</span>}
                {ev.company && <span className="text-xs text-gray-500">Empresa: {ev.company}</span>}
                {ev.work_order_number && <span className="text-xs text-gray-500">OT: {ev.work_order_number}</span>}
                <select
                  className="ml-auto border rounded px-2 py-1 text-xs text-slate-800"
                  value={ev.status}
                  onChange={(e) => updateStatus(ev, e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {ev.description && <p className="text-xs text-gray-400">{ev.description}</p>}
              {required.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Pruebas de QC requeridas tras el servicio:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {required.map((code) => (
                      <label key={code} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={completed.includes(code)} onChange={() => toggleCompletedTest(ev, code)} />
                        {code}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input type="text" className="w-full border rounded px-2 py-1 text-sm text-slate-800" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
