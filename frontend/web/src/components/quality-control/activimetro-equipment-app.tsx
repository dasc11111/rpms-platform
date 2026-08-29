"use client";

import { useEffect, useState } from "react";

/**
 * MODULO ACTIVIMETRO - FASE A
 * Ficha tecnica del equipo (seccion 3/4 del prompt maestro). Lista los
 * equipos existentes y permite crear/editar su ficha. Estos datos
 * alimentan el resto del sistema (seleccion de equipo en cada control,
 * vinculacion de baseline, eventos de servicio y evidencia a un equipo
 * especifico).
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  service_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  chamber_type: string | null;
  detector_type: string | null;
  software_name: string | null;
  software_version: string | null;
  installation_date: string | null;
  acceptance_date: string | null;
  last_calibration_date: string | null;
  last_service_date: string | null;
  notes: string | null;
};

const emptyForm: Partial<Equipment> = {
  institution_name: "",
  service_name: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  internal_code: "",
  chamber_type: "pozo (well-type)",
};

export default function ActivimetroEquipmentApp() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Equipment>>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEquipment() {
    const res = await fetch("/api/quality-control/activimetro/equipment");
    const data = await res.json();
    setEquipmentList(data);
  }

  useEffect(() => {
    loadEquipment();
  }, []);

  function selectEquipment(eq: Equipment | null) {
    if (!eq) {
      setSelectedId(null);
      setForm(emptyForm);
      return;
    }
    setSelectedId(eq.id);
    setForm(eq);
  }

  function updateField<K extends keyof Equipment>(key: K, value: Equipment[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const method = selectedId ? "PUT" : "POST";
      const body = selectedId ? { ...form, id: selectedId } : form;
      const res = await fetch("/api/quality-control/activimetro/equipment", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setMessage(selectedId ? "Ficha actualizada correctamente." : "Equipo creado correctamente.");
      await loadEquipment();
    } catch {
      setMessage("Ocurrio un error al guardar la ficha del equipo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ficha Tecnica del Activimetro</h1>
        <p className="text-sm text-gray-500">
          Modulo Activimetro - Fase A. Cada activimetro dispone de una ficha propia
          (institucion, fabricante, camara de medicion, software, fechas de
          instalacion/aceptacion/calibracion/servicio), base para el resto de los
          controles de calidad, el baseline y los eventos de servicio tecnico.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => selectEquipment(null)}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
        >
          + Nuevo equipo
        </button>
        {equipmentList.map((eq) => (
          <button
            key={eq.id}
            type="button"
            onClick={() => selectEquipment(eq)}
            className={`px-3 py-1.5 rounded text-sm border ${selectedId === eq.id ? "bg-gray-800 text-white" : "bg-white"}`}
          >
            {eq.manufacturer} {eq.model} ({eq.internal_code ?? "s/codigo"})
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
        <Field label="Institucion" value={form.institution_name} onChange={(v) => updateField("institution_name", v)} />
        <Field label="Servicio" value={form.service_name} onChange={(v) => updateField("service_name", v)} />
        <Field label="Fabricante" value={form.manufacturer} onChange={(v) => updateField("manufacturer", v)} />
        <Field label="Modelo" value={form.model} onChange={(v) => updateField("model", v)} />
        <Field label="Numero de serie" value={form.serial_number} onChange={(v) => updateField("serial_number", v)} />
        <Field label="Codigo interno" value={form.internal_code} onChange={(v) => updateField("internal_code", v)} />
        <Field label="Tipo de camara de medicion" value={form.chamber_type} onChange={(v) => updateField("chamber_type", v)} />
        <Field label="Tipo de detector" value={form.detector_type} onChange={(v) => updateField("detector_type", v)} />
        <Field label="Software" value={form.software_name} onChange={(v) => updateField("software_name", v)} />
        <Field label="Version de software" value={form.software_version} onChange={(v) => updateField("software_version", v)} />
        <DateField label="Fecha de instalacion" value={form.installation_date} onChange={(v) => updateField("installation_date", v)} />
        <DateField label="Fecha de aceptacion" value={form.acceptance_date} onChange={(v) => updateField("acceptance_date", v)} />
        <DateField label="Ultima calibracion" value={form.last_calibration_date} onChange={(v) => updateField("last_calibration_date", v)} />
        <DateField label="Ultimo servicio tecnico" value={form.last_service_date} onChange={(v) => updateField("last_service_date", v)} />

        <div className="md:col-span-2">
          <label className="text-sm font-medium block mb-1">Notas</label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 text-white text-sm">
            {loading ? "Guardando..." : selectedId ? "Actualizar ficha" : "Crear equipo"}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input
        type="text"
        className="w-full border rounded px-2 py-1 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input
        type="date"
        className="w-full border rounded px-2 py-1 text-sm"
        value={value ? value.substring(0, 10) : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
