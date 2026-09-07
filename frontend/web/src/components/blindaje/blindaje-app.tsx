"use client";

import { createElement as h, useEffect, useState, type FormEvent } from "react";

type BlindajeProject = {
  id: number;
  name: string;
  institution: string | null;
  service: string | null;
  unit: string | null;
  facility_type: string;
  status: string;
  version: string;
  project_number: string | null;
  created_at: string;
};

const FACILITY_TYPES: { value: string; label: string }[] = [
  { value: "diagnostico", label: "Radiologia Diagnostica" },
  { value: "medicina_nuclear", label: "Medicina Nuclear" },
  { value: "radioterapia", label: "Radioterapia / Acelerador" },
  { value: "braquiterapia", label: "Braquiterapia" },
  ];

const EMPTY_FORM = {
  name: "",
  institution: "",
  service: "",
  unit: "",
  address: "",
  city: "",
  responsible: "",
  opr_name: "",
  medical_physicist: "",
  facility_type: "diagnostico",
  project_number: "",
};

function field(label: string, value: string, onChange: (v: string) => void, placeholder?: string) {
  return h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    label,
    h("input", {
      className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
      value,
      placeholder: placeholder || "",
      onChange: (e: any) => onChange(e.target.value),
    })
    );
}

export function BlindajeApp() {
  const [projects, setProjects] = useState<BlindajeProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

function load() {
  setLoading(true);
  fetch("/api/blindaje")
  .then((r) => (r.ok ? r.json() : { projects: [] }))
  .then((data) => setProjects(data.projects ?? []))
  .finally(() => setLoading(false));
}

useEffect(() => {
  load();
}, []);

function updateField(key: string, value: string) {
  setForm((f) => ({ ...f, [key]: value }));
}

async function createProject(e: FormEvent) {
  e.preventDefault();
  if (!form.name.trim()) {
    setError("El nombre del proyecto es obligatorio.");
    return;
  }
  setSaving(true);
  setError(null);
  try {
    const res = await fetch("/api/blindaje", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "No se pudo crear el proyecto.");
      return;
    }
    setForm(EMPTY_FORM);
    load();
  } finally {
    setSaving(false);
  }
  }

const disclaimer = h(
  "div",
  { className: "rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning" },
  "Los resultados de este modulo corresponden a una herramienta de apoyo para el diseno y evaluacion de proteccion radiologica. La responsabilidad profesional del estudio, su revision y su presentacion ante la autoridad competente corresponde al profesional responsable (OPR / Fisico Medico)."
  );

const header = h(
  "div",
  { className: "flex flex-col gap-1" },
  h("h1", { className: "text-lg font-semibold text-foreground" }, "Blindaje y Diseno"),
  h(
    "p",
    { className: "text-sm text-muted-foreground" },
    "Sistema experto de calculo, diseno, validacion, trazabilidad y documentacion de blindajes radiologicos."
    )
  );

const formFacilitySelect = h(
  "label",
  { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
  "Tipo de instalacion",
  h(
    "select",
    {
      className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
      value: form.facility_type,
      onChange: (e: any) => updateField("facility_type", e.target.value),
    },
    FACILITY_TYPES.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
    )
  );

const projectForm = h(
  "form",
  { onSubmit: createProject, className: "grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3" },
  h("div", { className: "md:col-span-3 text-sm font-medium text-foreground" }, "Paso 1 - Identificacion del proyecto"),
  field("Nombre del proyecto *", form.name, (v) => updateField("name", v)),
  field("N de proyecto", form.project_number, (v) => updateField("project_number", v)),
  formFacilitySelect,
  field("Institucion", form.institution, (v) => updateField("institution", v)),
  field("Servicio", form.service, (v) => updateField("service", v)),
  field("Unidad", form.unit, (v) => updateField("unit", v)),
  field("Direccion", form.address, (v) => updateField("address", v)),
  field("Ciudad", form.city, (v) => updateField("city", v)),
  field("Responsable", form.responsible, (v) => updateField("responsible", v)),
  field("OPR", form.opr_name, (v) => updateField("opr_name", v)),
  field("Fisico Medico", form.medical_physicist, (v) => updateField("medical_physicist", v)),
  error ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, error) : null,
  h(
    "div",
    { className: "md:col-span-3" },
    h(
      "button",
      {
        type: "submit",
        disabled: saving,
        className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
      },
      saving ? "Guardando..." : "Crear proyecto"
      )
    )
  );

const projectRows = projects.map((p) =>
  h(
    "tr",
    { key: p.id, className: "border-b border-border" },
    h("td", { className: "px-3 py-2 text-sm" }, p.name),
    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.facility_type),
    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.institution || "-"),
    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.version),
    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.status)
    )
                                 );

const projectsTable = h(
  "div",
  { className: "rounded-lg border border-border bg-surface" },
  h(
    "div",
    { className: "border-b border-border p-3 text-sm font-medium" },
    "Proyectos (" + projects.length + ")"
    ),
  loading
  ? h("div", { className: "p-4 text-sm text-muted-foreground" }, "Cargando...")
  : h(
    "table",
    { className: "w-full text-left" },
    h(
      "thead",
      null,
      h(
        "tr",
        { className: "border-b border-border text-xs text-muted-foreground" },
        h("th", { className: "px-3 py-2" }, "Nombre"),
        h("th", { className: "px-3 py-2" }, "Tipo"),
        h("th", { className: "px-3 py-2" }, "Institucion"),
        h("th", { className: "px-3 py-2" }, "Version"),
        h("th", { className: "px-3 py-2" }, "Estado")
        )
      ),
    h("tbody", null, projectRows)
    )
  );

const nextPhases = h(
  "div",
  { className: "rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground" },
  "Proximas fases (en desarrollo): Equipo y fuente de radiacion, carga de trabajo, geometria y puntos de interes (PIR), barreras y materiales, motor regulatorio con fuentes citadas (NCRP 147 / NCRP 151 y normativa CCHEN vigente), memoria de calculo e informe PDF."
  );

return h(
  "div",
  { className: "flex flex-col gap-4 p-4" },
  header,
  disclaimer,
  projectForm,
  projectsTable,
  nextPhases
  );
}
