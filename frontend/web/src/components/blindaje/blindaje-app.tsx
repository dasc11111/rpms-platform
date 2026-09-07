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

type BlindajeEquipment = {
  id: number;
  project_id: number;
  manufacturer: string | null;
  model: string | null;
  equipment_type: string;
  parameters: Record<string, unknown> | null;
  created_at: string;
};

const FACILITY_TYPES: { value: string; label: string }[] = [
  { value: "diagnostico", label: "Radiologia Diagnostica" },
  { value: "medicina_nuclear", label: "Medicina Nuclear" },
  { value: "radioterapia", label: "Radioterapia / Acelerador" },
  { value: "braquiterapia", label: "Braquiterapia" },
  ];

const EQUIPMENT_TYPES: Record<string, { value: string; label: string }[]> = {
  diagnostico: [
    { value: "radiografia_general", label: "Radiografia General" },
    { value: "fluoroscopia", label: "Fluoroscopia" },
    { value: "mamografia", label: "Mamografia" },
    { value: "tomografia_computada", label: "Tomografia Computada (TC)" },
    ],
  medicina_nuclear: [
    { value: "gamma_camara", label: "Gamma Camara" },
    { value: "spect", label: "SPECT" },
    { value: "pet", label: "PET" },
    { value: "pet_ct", label: "PET/CT" },
    ],
  radioterapia: [
    { value: "acelerador_lineal", label: "Acelerador Lineal" },
    { value: "cobalto_60", label: "Unidad de Cobalto-60" },
    ],
  braquiterapia: [
    { value: "hdr", label: "Braquiterapia HDR" },
    { value: "ldr", label: "Braquiterapia LDR" },
    { value: "pdr", label: "Braquiterapia PDR" },
    ],
};

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

const EMPTY_EQUIPMENT_FORM = {
  equipment_type: "",
  manufacturer: "",
  model: "",
  notes: "",
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

const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [facilityTypeDraft, setFacilityTypeDraft] = useState("");
  const [savingFacilityType, setSavingFacilityType] = useState(false);
  const [facilityTypeError, setFacilityTypeError] = useState<string | null>(null);

const [equipmentList, setEquipmentList] = useState<BlindajeEquipment[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT_FORM);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);

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

const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

function loadEquipment(projectId: number) {
  setLoadingEquipment(true);
  fetch("/api/blindaje/equipment?project_id=" + projectId)
  .then((r) => (r.ok ? r.json() : { equipment: [] }))
  .then((data) => setEquipmentList(data.equipment ?? []))
  .finally(() => setLoadingEquipment(false));
}

function selectProject(p: BlindajeProject) {
  setSelectedProjectId(p.id);
  setFacilityTypeDraft(p.facility_type);
  setFacilityTypeError(null);
  setEquipmentForm(EMPTY_EQUIPMENT_FORM);
  setEquipmentError(null);
  loadEquipment(p.id);
}

async function saveFacilityType() {
  if (!selectedProject) return;
  setSavingFacilityType(true);
  setFacilityTypeError(null);
  try {
    const res = await fetch("/api/blindaje/" + selectedProject.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_type: facilityTypeDraft }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setFacilityTypeError(data.error || "No se pudo actualizar el tipo de instalacion.");
      return;
    }
    load();
  } finally {
    setSavingFacilityType(false);
  }
}

function updateField(key: string, value: string) {
  setForm((f) => ({ ...f, [key]: value }));
}

function updateEquipmentField(key: string, value: string) {
  setEquipmentForm((f) => ({ ...f, [key]: value }));
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

async function createEquipment(e: FormEvent) {
  e.preventDefault();
  if (!selectedProject) return;
  if (!equipmentForm.equipment_type) {
    setEquipmentError("El tipo de equipo es obligatorio.");
    return;
  }
  setSavingEquipment(true);
  setEquipmentError(null);
  try {
    const res = await fetch("/api/blindaje/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: selectedProject.id,
        equipment_type: equipmentForm.equipment_type,
        manufacturer: equipmentForm.manufacturer,
        model: equipmentForm.model,
        parameters: { notes: equipmentForm.notes },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setEquipmentError(data.error || "No se pudo crear el equipo.");
      return;
    }
    setEquipmentForm(EMPTY_EQUIPMENT_FORM);
    loadEquipment(selectedProject.id);
  } finally {
    setSavingEquipment(false);
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
    {
      key: p.id,
      className: "cursor-pointer border-b border-border hover:bg-muted" + (p.id === selectedProjectId ? " bg-accent-subtle" : ""),
      onClick: () => selectProject(p),
    },
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
    "Proyectos (" + projects.length + ") - seleccione uno para continuar con Paso 2 y Paso 3"
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

const facilityTypeSelect = h(
  "label",
  { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
  "Tipo de instalacion",
  h(
    "select",
    {
      className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
      value: facilityTypeDraft,
      onChange: (e: any) => setFacilityTypeDraft(e.target.value),
    },
    FACILITY_TYPES.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
    )
  );

const paso2Panel = selectedProject
  ? h(
    "div",
    { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
    h("div", { className: "text-sm font-medium text-foreground" }, "Paso 2 - Tipo de instalacion (" + selectedProject.name + ")"),
    h("div", { className: "flex flex-wrap items-end gap-3" },
      facilityTypeSelect,
      h(
        "button",
        {
          type: "button",
          disabled: savingFacilityType || facilityTypeDraft === selectedProject.facility_type,
          onClick: saveFacilityType,
          className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
        },
        savingFacilityType ? "Guardando..." : "Guardar tipo de instalacion"
        )
      ),
    facilityTypeError ? h("div", { className: "text-xs text-red-500" }, facilityTypeError) : null
    )
  : null;

const equipmentTypeOptions = selectedProject ? EQUIPMENT_TYPES[selectedProject.facility_type] || [] : [];

const equipmentTypeSelect = h(
  "label",
  { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
  "Tipo de equipo *",
  h(
    "select",
    {
      className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
      value: equipmentForm.equipment_type,
      onChange: (e: any) => updateEquipmentField("equipment_type", e.target.value),
    },
    [h("option", { key: "", value: "" }, "Seleccione...")].concat(
      equipmentTypeOptions.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
      )
    )
  );

const equipmentRows = equipmentList.map((eq) =>
  h(
    "tr",
    { key: eq.id, className: "border-b border-border" },
    h("td", { className: "px-3 py-2 text-sm" }, eq.equipment_type),
    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, eq.manufacturer || "-"),
    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, eq.model || "-")
    )
                                        );

const equipmentTable = h(
  "div",
  { className: "rounded-lg border border-border" },
  h(
    "table",
    { className: "w-full text-left" },
    h(
      "thead",
      null,
      h(
        "tr",
        { className: "border-b border-border text-xs text-muted-foreground" },
        h("th", { className: "px-3 py-2" }, "Tipo"),
        h("th", { className: "px-3 py-2" }, "Fabricante"),
        h("th", { className: "px-3 py-2" }, "Modelo")
        )
      ),
    h("tbody", null, equipmentRows)
    )
  );

const equipmentForm_ = h(
  "form",
  { onSubmit: createEquipment, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
  equipmentTypeSelect,
  field("Fabricante", equipmentForm.manufacturer, (v) => updateEquipmentField("manufacturer", v)),
  field("Modelo", equipmentForm.model, (v) => updateEquipmentField("model", v)),
  field("Notas", equipmentForm.notes, (v) => updateEquipmentField("notes", v)),
  equipmentError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, equipmentError) : null,
  h(
    "div",
    { className: "md:col-span-3" },
    h(
      "button",
      {
        type: "submit",
        disabled: savingEquipment,
        className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
      },
      savingEquipment ? "Guardando..." : "Agregar equipo"
      )
    )
  );

const paso3Panel = selectedProject
  ? h(
    "div",
    { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
    h("div", { className: "text-sm font-medium text-foreground" }, "Paso 3 - Equipo (" + selectedProject.name + ")"),
    loadingEquipment ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando equipos...") : equipmentTable,
    equipmentForm_
    )
  : null;

const nextPhases = h(
  "div",
  { className: "rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground" },
  "Proximas fases (en desarrollo): fuente de radiacion, carga de trabajo, geometria y puntos de interes (PIR), barreras y materiales, motor regulatorio con fuentes citadas (NCRP 147 / NCRP 151 y normativa CCHEN vigente), memoria de calculo e informe PDF."
  );

return h(
  "div",
  { className: "flex flex-col gap-4 p-4" },
  header,
  disclaimer,
  projectForm,
  projectsTable,
  paso2Panel,
  paso3Panel,
  nextPhases
  );
}
