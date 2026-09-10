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

type BlindajeSource = {
    id: number;
    project_id: number;
    source_type: string;
    radionuclide: string | null;
    energy: string | null;
    activity: number | null;
    activity_unit: string | null;
    dose_rate: number | null;
    dose_rate_unit: string | null;
    geometry: string | null;
    created_at: string;
};

type BlindajeWorkload = {
    id: number;
    project_id: number;
    input_mode: string;
    data: Record<string, unknown> | null;
    created_at: string;
};

type BlindajePir = {
        id: number;
        project_id: number;
        code: string;
        name: string;
        description: string | null;
        coordinates: string | null;
        distance_m: number | null;
        area_type: string | null;
        occupancy_type: string | null;
        occupancy_factor: number | null;
        design_criterion_value: number | null;
        design_criterion_unit: string | null;
        design_criterion_source: string | null;
        result_value: number | null;
        result_unit: string | null;
        result_status: string | null;
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

const SOURCE_TYPE_BY_FACILITY: Record<string, { value: string; label: string }> = {
    diagnostico: { value: "tubo_rayos_x", label: "Tubo de rayos X" },
    medicina_nuclear: { value: "radionucleido_no_sellado", label: "Radionuclido no sellado" },
    radioterapia: { value: "haz_acelerador", label: "Haz de fotones/electrones" },
    braquiterapia: { value: "fuente_sellada", label: "Fuente sellada" },
};

const SOURCE_FIELDS_BY_FACILITY: Record<string, string[]> = {
    diagnostico: ["energy", "dose_rate", "geometry"],
    medicina_nuclear: ["radionuclide", "activity", "geometry"],
    radioterapia: ["energy", "dose_rate", "geometry"],
    braquiterapia: ["radionuclide", "activity", "geometry"],
};

const SOURCE_FIELD_LABELS: Record<string, Record<string, string>> = {
    diagnostico: { energy: "Energia (kVp)", dose_rate: "Carga / corriente (mA o mGy por mAs)", geometry: "Distancia foco-piel / geometria" },
    medicina_nuclear: { radionuclide: "Radionuclido", activity: "Actividad", geometry: "Geometria (captacion, distancia)" },
    radioterapia: { energy: "Energia nominal (MV o MeV)", dose_rate: "Tasa de dosis (UM/min)", geometry: "Isocentro / distancia fuente-eje" },
    braquiterapia: { radionuclide: "Radionuclido", activity: "Actividad", geometry: "Geometria de aplicacion" },
};

const WORKLOAD_MODES: { value: string; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "detallada", label: "Detallada" },
  { value: "avanzada", label: "Avanzada" },
  ];

const WORKLOAD_SCENARIOS: { value: string; label: string }[] = [
  { value: "A", label: "A - Escenario normal" },
  { value: "B", label: "B - Carga maxima" },
  { value: "C", label: "C - Peor caso" },
  { value: "D", label: "D - Definido por usuario" },
  ];

const WORKLOAD_FIELDS_BY_MODE: Record<string, string[]> = {
    simple: ["workload_value", "workload_unit", "notes"],
    detallada: ["procedures_per_week", "workload_value", "workload_unit", "use_factor", "occupancy_factor", "distance", "notes"],
    avanzada: ["procedures_per_week", "workload_value", "workload_unit", "use_factor", "occupancy_factor", "distance", "scenario", "sensitivity_notes", "notes"],
};

const WORKLOAD_FIELD_LABELS: Record<string, string> = {
    procedures_per_week: "Procedimientos / sesiones por semana",
    workload_value: "Carga de trabajo (valor) *",
    workload_unit: "Unidad (ej. mA-min/sem, Gy/sem, GBq-h/sem)",
    use_factor: "Factor de uso (U)",
    occupancy_factor: "Factor de ocupacion (T)",
    distance: "Distancia de referencia (m)",
    scenario: "Escenario (S36)",
    sensitivity_notes: "Notas de analisis de sensibilidad (S37)",
    notes: "Notas / supuestos (S59)",
};

const AREA_CLASSIFICATIONS: { value: string; label: string }[] = [
    { value: "controlada", label: "Area controlada (POE)" },
    { value: "no_controlada", label: "Area no controlada (Publico)" },
    ];

const RESULT_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "sin_informacion", label: "Sin informacion (S60)" },
    { value: "cumple", label: "Cumple" },
    { value: "revisar", label: "Revisar" },
    { value: "no_cumple", label: "No cumple" },
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

const EMPTY_EQUIPMENT_FORM = {
    equipment_type: "",
    manufacturer: "",
    model: "",
    notes: "",
};

const EMPTY_SOURCE_FORM = {
    radionuclide: "",
    energy: "",
    activity: "",
    activity_unit: "",
    dose_rate: "",
    dose_rate_unit: "",
    geometry: "",
};

const EMPTY_WORKLOAD_FORM = {
    input_mode: "simple",
    procedures_per_week: "",
    workload_value: "",
    workload_unit: "",
    use_factor: "",
    occupancy_factor: "",
    distance: "",
    scenario: "A",
    sensitivity_notes: "",
    notes: "",
};

const EMPTY_PIR_FORM = {
        code: "",
        name: "",
        description: "",
        coordinates: "",
        distance_m: "",
        area_type: "controlada",
        occupancy_type: "",
        occupancy_factor: "",
        design_criterion_value: "",
        design_criterion_unit: "",
        design_criterion_source: "",
        result_status: "sin_informacion",
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

type BlindajeBarrier = {
    id: number;
    project_id: number;
    pir_id: number | null;
    code: string;
    name: string;
    barrier_type: string;
    material: string | null;
    density: number | null;
    material_source: string | null;
    thickness_existing_cm: number | null;
    thickness_required_cm: number | null;
    thickness_adopted_cm: number | null;
    margin_cm: number | null;
    distance_m: number | null;
    use_factor: number | null;
    occupancy_factor: number | null;
    result_value: number | null;
    result_unit: string | null;
    result_status: string | null;
    created_at: string;
};

const BARRIER_TYPES: { value: string; label: string }[] = [
    { value: "primaria", label: "Barrera primaria" },
    { value: "secundaria", label: "Barrera secundaria" },
    { value: "neutronica", label: "Barrera neutronica" },
    { value: "captura", label: "Barrera de captura" },
    ];

const EMPTY_BARRIER_FORM = {
    pir_id: "",
    code: "",
    name: "",
    barrier_type: "primaria",
    material: "",
    density: "",
    material_source: "",
    thickness_existing_cm: "",
    thickness_required_cm: "",
    thickness_adopted_cm: "",
    margin_cm: "",
    distance_m: "",
    use_factor: "",
    occupancy_factor: "",
    result_status: "sin_informacion",
};

type BlindajeMaterial = {
    id: number;
    name: string;
    density: number | null;
    density_unit: string | null;
    hvl: number | null;
    tvl: number | null;
    method: string | null;
    application_range: string | null;
    source_document: string | null;
    source_page: string | null;
    created_at: string;
};

const EMPTY_MATERIAL_FORM = {
    name: "",
    density: "",
    density_unit: "g/cm3",
    hvl: "",
    tvl: "",
    method: "",
    application_range: "",
    source_document: "",
    source_page: "",
};

type BlindajeDoor = {
        id: number;
        project_id: number;
        barrier_id: number | null;
        code: string;
        name: string;
        location: string | null;
        width_cm: number | null;
        height_cm: number | null;
        material: string | null;
        thickness_cm: number | null;
        lead_equivalent_mm: number | null;
        result_value: number | null;
        result_unit: string | null;
        result_status: string | null;
        source_document: string | null;
        notes: string | null;
        created_at: string;
};

const EMPTY_DOOR_FORM = {
        barrier_id: "",
        code: "",
        name: "",
        location: "",
        width_cm: "",
        height_cm: "",
        material: "",
        thickness_cm: "",
        lead_equivalent_mm: "",
        result_status: "sin_informacion",
        source_document: "",
        notes: "",
};

type BlindajeWindow = {
    id: number;
    project_id: number;
    barrier_id: number | null;
    code: string;
    name: string;
    location: string | null;
    width_cm: number | null;
    height_cm: number | null;
    material: string | null;
    thickness_cm: number | null;
    lead_equivalent_mm: number | null;
    energy: string | null;
    result_value: number | null;
    result_unit: string | null;
    result_status: string | null;
    source_document: string | null;
    notes: string | null;
    created_at: string;
};

const EMPTY_WINDOW_FORM = {
    barrier_id: "",
    code: "",
    name: "",
    location: "",
    width_cm: "",
    height_cm: "",
    material: "",
    thickness_cm: "",
    lead_equivalent_mm: "",
    energy: "",
    result_status: "sin_informacion",
    source_document: "",
    notes: "",
};
type BlindajePenetration = {
    id: number;
    project_id: number;
    barrier_id: number | null;
    code: string;
    name: string;
    location: string | null;
    penetration_type: string | null;
    diameter_cm: number | null;
    width_cm: number | null;
    height_cm: number | null;
    fill_material: string | null;
    offset_cm: number | null;
    result_value: number | null;
    result_unit: string | null;
    result_status: string | null;
    source_document: string | null;
    notes: string | null;
    created_at: string;
};

const PENETRATION_TYPES: { value: string; label: string }[] = [
    { value: "ducto", label: "Ducto / conduit" },
    { value: "tuberia", label: "Tuberia" },
    { value: "bandeja_cables", label: "Bandeja de cables" },
    { value: "otro", label: "Otro" },
    ];

const EMPTY_PENETRATION_FORM = {
    barrier_id: "",
    code: "",
    name: "",
    location: "",
    penetration_type: "ducto",
    diameter_cm: "",
    width_cm: "",
    height_cm: "",
    fill_material: "",
    offset_cm: "",
    result_status: "sin_informacion",
    source_document: "",
    notes: "",
};

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

  const [sourcesList, setSourcesList] = useState<BlindajeSource[]>([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE_FORM);
    const [savingSource, setSavingSource] = useState(false);
    const [sourceError, setSourceError] = useState<string | null>(null);

  const [workloadList, setWorkloadList] = useState<BlindajeWorkload[]>([]);
    const [loadingWorkload, setLoadingWorkload] = useState(false);
    const [workloadForm, setWorkloadForm] = useState(EMPTY_WORKLOAD_FORM);
    const [savingWorkload, setSavingWorkload] = useState(false);
    const [workloadError, setWorkloadError] = useState<string | null>(null);

        const [pirList, setPirList] = useState<BlindajePir[]>([]);
        const [loadingPir, setLoadingPir] = useState(false);
        const [pirForm, setPirForm] = useState(EMPTY_PIR_FORM);
        const [savingPir, setSavingPir] = useState(false);
        const [pirError, setPirError] = useState<string | null>(null);

    const [barriersList, setBarriersList] = useState<BlindajeBarrier[]>([]);
    const [loadingBarriers, setLoadingBarriers] = useState(false);
    const [barrierForm, setBarrierForm] = useState(EMPTY_BARRIER_FORM);
    const [savingBarrier, setSavingBarrier] = useState(false);
    const [barrierError, setBarrierError] = useState<string | null>(null);

  const [materialsList, setMaterialsList] = useState<BlindajeMaterial[]>([]);
    const [loadingMaterials, setLoadingMaterials] = useState(false);
    const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL_FORM);
    const [savingMaterial, setSavingMaterial] = useState(false);
    const [materialError, setMaterialError] = useState<string | null>(null);

        const [doorsList, setDoorsList] = useState<BlindajeDoor[]>([]);
        const [loadingDoors, setLoadingDoors] = useState(false);
        const [doorForm, setDoorForm] = useState(EMPTY_DOOR_FORM);
        const [savingDoor, setSavingDoor] = useState(false);
        const [doorError, setDoorError] = useState<string | null>(null);
    
const [windowsList, setWindowsList] = useState<BlindajeWindow[]>([]);
    const [loadingWindows, setLoadingWindows] = useState(false);
    const [windowForm, setWindowForm] = useState(EMPTY_WINDOW_FORM);
    const [savingWindow, setSavingWindow] = useState(false);
    const [windowError, setWindowError] = useState<string | null>(null);
const [penetrationsList, setPenetrationsList] = useState<BlindajePenetration[]>([]);
    const [loadingPenetrations, setLoadingPenetrations] = useState(false);
    const [penetrationForm, setPenetrationForm] = useState(EMPTY_PENETRATION_FORM);
    const [savingPenetration, setSavingPenetration] = useState(false);
    const [penetrationError, setPenetrationError] = useState<string | null>(null);
    
    function load() {
        setLoading(true);
        fetch("/api/blindaje")
          .then((r) => (r.ok ? r.json() : { projects: [] }))
          .then((data) => setProjects(data.projects ?? []))
          .finally(() => setLoading(false));
  }

  useEffect(() => {
        load();
      loadMaterials();
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  function loadMaterials() {
      setLoadingMaterials(true);
      fetch("/api/blindaje/materials")
          .then((r) => (r.ok ? r.json() : { materials: [] }))
          .then((data) => setMaterialsList(data.materials ?? []))
          .finally(() => setLoadingMaterials(false));
  }
    
    function loadEquipment(projectId: number) {
        setLoadingEquipment(true);
        fetch("/api/blindaje/equipment?project_id=" + projectId)
          .then((r) => (r.ok ? r.json() : { equipment: [] }))
          .then((data) => setEquipmentList(data.equipment ?? []))
          .finally(() => setLoadingEquipment(false));
  }

  function loadSources(projectId: number) {
        setLoadingSources(true);
        fetch("/api/blindaje/sources?project_id=" + projectId)
          .then((r) => (r.ok ? r.json() : { sources: [] }))
          .then((data) => setSourcesList(data.sources ?? []))
          .finally(() => setLoadingSources(false));
  }

  function loadWorkload(projectId: number) {
        setLoadingWorkload(true);
        fetch("/api/blindaje/workload?project_id=" + projectId)
          .then((r) => (r.ok ? r.json() : { workload: [] }))
          .then((data) => setWorkloadList(data.workload ?? []))
          .finally(() => setLoadingWorkload(false));
  }

        function loadPir(projectId: number) {
                    setLoadingPir(true);
                    fetch("/api/blindaje/pir?project_id=" + projectId)
                        .then((r) => (r.ok ? r.json() : { pir: [] }))
                        .then((data) => setPirList(data.pir ?? []))
                        .finally(() => setLoadingPir(false));
        }

    function loadBarriers(projectId: number) {
        setLoadingBarriers(true);
        fetch("/api/blindaje/barriers?project_id=" + projectId)
        .then((r) => (r.ok ? r.json() : { barriers: [] }))
        .then((data) => setBarriersList(data.barriers ?? []))
        .finally(() => setLoadingBarriers(false));
    }

    function loadDoors(projectId: number) {
            setLoadingDoors(true);
            fetch("/api/blindaje/doors?project_id=" + projectId)
                .then((r) => (r.ok ? r.json() : { doors: [] }))
                .then((data) => setDoorsList(data.doors ?? []))
                .finally(() => setLoadingDoors(false));
    }

function loadWindows(projectId: number) {
    setLoadingWindows(true);
    fetch("/api/blindaje/windows?project_id=" + projectId)
        .then((r) => (r.ok ? r.json() : { windows: [] }))
        .then((data) => setWindowsList(data.windows ?? []))
        .finally(() => setLoadingWindows(false));
}
function loadPenetrations(projectId: number) {
    setLoadingPenetrations(true);
    fetch("/api/blindaje/penetrations?project_id=" + projectId)
    .then((r) => (r.ok ? r.json() : { penetrations: [] }))
    .then((data) => setPenetrationsList(data.penetrations ?? []))
    .finally(() => setLoadingPenetrations(false));
}
    
    function selectProject(p: BlindajeProject) {
        setSelectedProjectId(p.id);
        setFacilityTypeDraft(p.facility_type);
        setFacilityTypeError(null);
        setEquipmentForm(EMPTY_EQUIPMENT_FORM);
        setEquipmentError(null);
        setSourceForm(EMPTY_SOURCE_FORM);
        setSourceError(null);
        setWorkloadForm(EMPTY_WORKLOAD_FORM);
        setWorkloadError(null);
        loadEquipment(p.id);
        loadSources(p.id);
        loadWorkload(p.id);
              setPirForm(EMPTY_PIR_FORM);
              setPirError(null);
              loadPir(p.id);
      setBarrierForm(EMPTY_BARRIER_FORM);
      setBarrierError(null);
      loadBarriers(p.id);
          setDoorForm(EMPTY_DOOR_FORM);
          setDoorError(null);
          loadDoors(p.id);
setWindowForm(EMPTY_WINDOW_FORM);
    setWindowError(null);
    loadWindows(p.id);
setPenetrationForm(EMPTY_PENETRATION_FORM);
    setPenetrationError(null);
    loadPenetrations(p.id);
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

  function updateSourceField(key: string, value: string) {
        setSourceForm((f) => ({ ...f, [key]: value }));
  }

  function updateWorkloadField(key: string, value: string) {
        setWorkloadForm((f) => ({ ...f, [key]: value }));
  }

        function updatePirField(key: string, value: string) {
                    setPirForm((f) => ({ ...f, [key]: value }));
        }

    function updateBarrierField(key: string, value: string) {
        setBarrierForm((f) => ({ ...f, [key]: value }));
    }

  function updateMaterialField(key: string, value: string) {
      setMaterialForm((f) => ({ ...f, [key]: value }));
  }

    function updateDoorField(key: string, value: string) {
            setDoorForm((f) => ({ ...f, [key]: value }));
    }
    
    function updateWindowField(key: string, value: string) {
        setWindowForm((f) => ({ ...f, [key]: value }));
    }
function updatePenetrationField(key: string, value: string) {
    setPenetrationForm((f) => ({ ...f, [key]: value }));
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

  async function createSource(e: FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        const sourceTypeConfig = SOURCE_TYPE_BY_FACILITY[selectedProject.facility_type];
        if (!sourceTypeConfig) {
                setSourceError("Este tipo de instalacion todavia no tiene fuente de radiacion configurada.");
                return;
        }
        setSavingSource(true);
        setSourceError(null);
        try {
                const res = await fetch("/api/blindaje/sources", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                                      project_id: selectedProject.id,
                                      source_type: sourceTypeConfig.value,
                                      radionuclide: sourceForm.radionuclide,
                                      energy: sourceForm.energy,
                                      activity: sourceForm.activity,
                                      activity_unit: sourceForm.activity_unit,
                                      dose_rate: sourceForm.dose_rate,
                                      dose_rate_unit: sourceForm.dose_rate_unit,
                                      geometry: sourceForm.geometry,
                          }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) {
                          setSourceError(data.error || "No se pudo guardar la fuente de radiacion.");
                          return;
                }
                setSourceForm(EMPTY_SOURCE_FORM);
                loadSources(selectedProject.id);
        } finally {
                setSavingSource(false);
        }
  }

  async function createWorkload(e: FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        if (!workloadForm.workload_value.trim()) {
                setWorkloadError("El valor de carga de trabajo es obligatorio.");
                return;
        }
        setSavingWorkload(true);
        setWorkloadError(null);
        try {
      const keys: string[] = WORKLOAD_FIELDS_BY_MODE[workloadForm.input_mode] || WORKLOAD_FIELDS_BY_MODE.simple || [];
                const data: Record<string, string> = {};
                keys.forEach((key) => {
                          data[key] = (workloadForm as any)[key];
                });
                const res = await fetch("/api/blindaje/workload", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                                      project_id: selectedProject.id,
                                      input_mode: workloadForm.input_mode,
                                      data,
                          }),
                });
                const resData = await res.json();
                if (!res.ok || !resData.ok) {
                          setWorkloadError(resData.error || "No se pudo guardar la carga de trabajo.");
                          return;
                }
                setWorkloadForm((f) => ({ ...EMPTY_WORKLOAD_FORM, input_mode: f.input_mode }));
                loadWorkload(selectedProject.id);
        } finally {
                setSavingWorkload(false);
        }
  }

        async function createPir(e: FormEvent) {
                    e.preventDefault();
                    if (!selectedProject) return;
                    if (!pirForm.code.trim() || !pirForm.name.trim()) {
                                    setPirError("El codigo y el nombre del punto de interes son obligatorios.");
                                    return;
                    }
                    setSavingPir(true);
                    setPirError(null);
                    try {
                                    const res = await fetch("/api/blindaje/pir", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                                                project_id: selectedProject.id,
                                                                                code: pirForm.code,
                                                                                name: pirForm.name,
                                                                                description: pirForm.description,
                                                                                coordinates: pirForm.coordinates,
                                                                                distance_m: pirForm.distance_m,
                                                                                area_type: pirForm.area_type,
                                                                                occupancy_type: pirForm.occupancy_type,
                                                                                occupancy_factor: pirForm.occupancy_factor,
                                                                                design_criterion_value: pirForm.design_criterion_value,
                                                                                design_criterion_unit: pirForm.design_criterion_unit,
                                                                                design_criterion_source: pirForm.design_criterion_source,
                                                                                result_status: pirForm.result_status,
                                                        }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok || !data.ok) {
                                                        setPirError(data.error || "No se pudo guardar el punto de interes.");
                                                        return;
                                    }
                                    setPirForm(EMPTY_PIR_FORM);
                                    loadPir(selectedProject.id);
                    } finally {
                                    setSavingPir(false);
                    }
        }

    async function createBarrier(e: FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        if (!barrierForm.code.trim() || !barrierForm.name.trim()) {
            setBarrierError("El codigo y el nombre de la barrera son obligatorios.");
            return;
        }
        setSavingBarrier(true);
        setBarrierError(null);
        try {
            const res = await fetch("/api/blindaje/barriers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: selectedProject.id,
                    pir_id: barrierForm.pir_id || null,
                    code: barrierForm.code,
                    name: barrierForm.name,
                    barrier_type: barrierForm.barrier_type,
                    material: barrierForm.material,
                    density: barrierForm.density,
                    material_source: barrierForm.material_source,
                    thickness_existing_cm: barrierForm.thickness_existing_cm,
                    thickness_required_cm: barrierForm.thickness_required_cm,
                    thickness_adopted_cm: barrierForm.thickness_adopted_cm,
                    margin_cm: barrierForm.margin_cm,
                    distance_m: barrierForm.distance_m,
                    use_factor: barrierForm.use_factor,
                    occupancy_factor: barrierForm.occupancy_factor,
                    result_status: barrierForm.result_status,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setBarrierError(data.error || "No se pudo guardar la barrera.");
                return;
            }
            setBarrierForm(EMPTY_BARRIER_FORM);
            loadBarriers(selectedProject.id);
        } finally {
            setSavingBarrier(false);
        }
    }

  async function createMaterial(e: FormEvent) {
      e.preventDefault();
      if (!materialForm.name.trim()) {
          setMaterialError("El nombre del material es obligatorio.");
          return;
      }
      if (!materialForm.source_document.trim()) {
          setMaterialError("La fuente documental del material es obligatoria (S33, S55).");
          return;
      }
      setSavingMaterial(true);
      setMaterialError(null);
      try {
          const res = await fetch("/api/blindaje/materials", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  name: materialForm.name,
                  density: materialForm.density,
                  density_unit: materialForm.density_unit,
                  hvl: materialForm.hvl,
                  tvl: materialForm.tvl,
                  method: materialForm.method,
                  application_range: materialForm.application_range,
                  source_document: materialForm.source_document,
                  source_page: materialForm.source_page,
              }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
              setMaterialError(data.error || "No se pudo guardar el material.");
              return;
          }
          setMaterialForm(EMPTY_MATERIAL_FORM);
          loadMaterials();
      } finally {
          setSavingMaterial(false);
      }
  }

    async function createDoor(e: FormEvent) {
            e.preventDefault();
            if (!selectedProject) return;
            if (!doorForm.code.trim() || !doorForm.name.trim()) {
                        setDoorError("El codigo y el nombre de la puerta son obligatorios.");
                        return;
            }
            setSavingDoor(true);
            setDoorError(null);
            try {
                        const res = await fetch("/api/blindaje/doors", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                                            project_id: selectedProject.id,
                                                            barrier_id: doorForm.barrier_id || null,
                                                            code: doorForm.code,
                                                            name: doorForm.name,
                                                            location: doorForm.location,
                                                            width_cm: doorForm.width_cm,
                                                            height_cm: doorForm.height_cm,
                                                            material: doorForm.material,
                                                            thickness_cm: doorForm.thickness_cm,
                                                            lead_equivalent_mm: doorForm.lead_equivalent_mm,
                                                            result_status: doorForm.result_status,
                                                            source_document: doorForm.source_document,
                                                            notes: doorForm.notes,
                                        }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.ok) {
                                        setDoorError(data.error || "No se pudo guardar la puerta.");
                                        return;
                        }
                        setDoorForm(EMPTY_DOOR_FORM);
                        loadDoors(selectedProject.id);
            } finally {
                        setSavingDoor(false);
            }
    }
    
    async function createWindow(e: FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        if (!windowForm.code.trim() || !windowForm.name.trim()) {
            setWindowError("El codigo y el nombre de la ventana son obligatorios.");
            return;
        }
        setSavingWindow(true);
        setWindowError(null);
        try {
            const res = await fetch("/api/blindaje/windows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: selectedProject.id,
                    barrier_id: windowForm.barrier_id || null,
                    code: windowForm.code,
                    name: windowForm.name,
                    location: windowForm.location,
                    width_cm: windowForm.width_cm,
                    height_cm: windowForm.height_cm,
                    material: windowForm.material,
                    thickness_cm: windowForm.thickness_cm,
                    lead_equivalent_mm: windowForm.lead_equivalent_mm,
                    energy: windowForm.energy,
                    result_status: windowForm.result_status,
                    source_document: windowForm.source_document,
                    notes: windowForm.notes,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setWindowError(data.error || "No se pudo guardar la ventana.");
                return;
            }
            setWindowForm(EMPTY_WINDOW_FORM);
            loadWindows(selectedProject.id);
        } finally {
            setSavingWindow(false);
        }
    }
async function createPenetration(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    if (!penetrationForm.code.trim() || !penetrationForm.name.trim()) {
        setPenetrationError("El codigo y el nombre de la penetracion son obligatorios.");
        return;
    }
    setSavingPenetration(true);
    setPenetrationError(null);
    try {
        const res = await fetch("/api/blindaje/penetrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project_id: selectedProject.id,
                barrier_id: penetrationForm.barrier_id || null,
                code: penetrationForm.code,
                name: penetrationForm.name,
                location: penetrationForm.location,
                penetration_type: penetrationForm.penetration_type,
                diameter_cm: penetrationForm.diameter_cm,
                width_cm: penetrationForm.width_cm,
                height_cm: penetrationForm.height_cm,
                fill_material: penetrationForm.fill_material,
                offset_cm: penetrationForm.offset_cm,
                result_status: penetrationForm.result_status,
                source_document: penetrationForm.source_document,
                notes: penetrationForm.notes,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            setPenetrationError(data.error || "No se pudo guardar la penetracion.");
            return;
        }
        setPenetrationForm(EMPTY_PENETRATION_FORM);
        loadPenetrations(selectedProject.id);
    } finally {
        setSavingPenetration(false);
    }
}
    
    function sourceFieldInputs(facilityType: string) {
        const keys = SOURCE_FIELDS_BY_FACILITY[facilityType] || [];
        const labels = SOURCE_FIELD_LABELS[facilityType] || {};
        const inputs: any[] = [];
        keys.forEach((key) => {
                if (key === "activity") {
                          inputs.push(field(labels.activity || "Actividad", sourceForm.activity, (v) => updateSourceField("activity", v)));
                          inputs.push(field("Unidad de actividad (GBq, mCi, etc.)", sourceForm.activity_unit, (v) => updateSourceField("activity_unit", v)));
                } else if (key === "dose_rate") {
                          inputs.push(field(labels.dose_rate || "Tasa de dosis", sourceForm.dose_rate, (v) => updateSourceField("dose_rate", v)));
                          inputs.push(field("Unidad de tasa de dosis", sourceForm.dose_rate_unit, (v) => updateSourceField("dose_rate_unit", v)));
                } else if (key === "radionuclide") {
                          inputs.push(field(labels.radionuclide || "Radionuclido", sourceForm.radionuclide, (v) => updateSourceField("radionuclide", v)));
                } else if (key === "energy") {
                          inputs.push(field(labels.energy || "Energia", sourceForm.energy, (v) => updateSourceField("energy", v)));
                } else if (key === "geometry") {
                          inputs.push(field(labels.geometry || "Geometria", sourceForm.geometry, (v) => updateSourceField("geometry", v)));
                }
        });
        return inputs;
  }

  function workloadFieldInputs(mode: string) {
            const keys: string[] = WORKLOAD_FIELDS_BY_MODE[mode] || WORKLOAD_FIELDS_BY_MODE.simple || [];
        const inputs: any[] = [];
        keys.forEach((key) => {
                if (key === "scenario") {
                          inputs.push(
                                      h(
                                                    "label",
                                        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
                                                    WORKLOAD_FIELD_LABELS.scenario,
                                                    h(
                                                                    "select",
                                                      {
                                                                        className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                                                                        value: workloadForm.scenario,
                                                                        onChange: (e: any) => updateWorkloadField("scenario", e.target.value),
                                                      },
                                                                    WORKLOAD_SCENARIOS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
                                                                  )
                                                  )
                                    );
                } else {
                          inputs.push(field(WORKLOAD_FIELD_LABELS[key] || key, (workloadForm as any)[key], (v) => updateWorkloadField(key, v)));
                }
        });
        return inputs;
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
                "Proyectos (" + projects.length + ") - seleccione uno para continuar con Paso 2, Paso 3, Paso 4 y Paso 5"
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
                h(
                            "div",
                  { className: "flex flex-wrap items-end gap-3" },
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

  const sourceRows = sourcesList.map((s) =>
        h(
                "tr",
          { key: s.id, className: "border-b border-border" },
                h("td", { className: "px-3 py-2 text-sm" }, s.source_type || "-"),
                h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.radionuclide || s.energy || "-"),
                h(
                          "td",
                  { className: "px-3 py-2 text-sm text-muted-foreground" },
                          s.activity ? s.activity + " " + (s.activity_unit || "") : s.dose_rate ? s.dose_rate + " " + (s.dose_rate_unit || "") : "-"
                        ),
                h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.geometry || "-")
              )
                                       );

  const sourcesTable = h(
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
                                      h("th", { className: "px-3 py-2" }, "Tipo de fuente"),
                                      h("th", { className: "px-3 py-2" }, "Radionuclido / Energia"),
                                      h("th", { className: "px-3 py-2" }, "Actividad / Tasa de dosis"),
                                      h("th", { className: "px-3 py-2" }, "Geometria")
                                    )
                        ),
                h("tbody", null, sourceRows)
              )
      );

  const sourceFormEl = selectedProject
      ? h(
                "form",
        { onSubmit: createSource, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
                ...sourceFieldInputs(selectedProject.facility_type),
                sourceError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, sourceError) : null,
                h(
                            "div",
                  { className: "md:col-span-3" },
                            h(
                                          "button",
                              {
                                              type: "submit",
                                              disabled: savingSource,
                                              className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                              },
                                          savingSource ? "Guardando..." : "Agregar fuente de radiacion"
                                        )
                          )
              )
        : null;

  const paso4Panel = selectedProject
      ? h(
                "div",
        { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
                h("div", { className: "text-sm font-medium text-foreground" }, "Paso 4 - Fuente de radiacion (" + selectedProject.name + ")"),
                h(
                            "div",
                  { className: "text-xs text-muted-foreground" },
                            "Tipo de fuente segun instalacion: " + ((SOURCE_TYPE_BY_FACILITY[selectedProject.facility_type] || {}).label || "no configurado")
                          ),
                loadingSources ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando fuentes...") : sourcesTable,
                sourceFormEl
              )
        : null;

  const workloadModeSelect = h(
        "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Modo de ingreso (S18)",
        h(
                "select",
          {
                    className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                    value: workloadForm.input_mode,
                    onChange: (e: any) => updateWorkloadField("input_mode", e.target.value),
          },
                WORKLOAD_MODES.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
              )
      );

  const workloadRows = workloadList.map((w) => {
        const data = (w.data || {}) as Record<string, any>;
        return h(
                "tr",
          { key: w.id, className: "border-b border-border" },
                h("td", { className: "px-3 py-2 text-sm" }, w.input_mode),
                h(
                          "td",
                  { className: "px-3 py-2 text-sm text-muted-foreground" },
                          data.workload_value ? data.workload_value + " " + (data.workload_unit || "") : "-"
                        ),
                h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, data.procedures_per_week || "-"),
                h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, data.scenario || "-"),
                h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, new Date(w.created_at).toLocaleString())
              );
  });

  const workloadTable = h(
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
                                      h("th", { className: "px-3 py-2" }, "Modo"),
                                      h("th", { className: "px-3 py-2" }, "Carga de trabajo"),
                                      h("th", { className: "px-3 py-2" }, "Procedimientos/sem"),
                                      h("th", { className: "px-3 py-2" }, "Escenario"),
                                      h("th", { className: "px-3 py-2" }, "Registrado")
                                    )
                        ),
                h("tbody", null, workloadRows)
              )
      );

  const workloadFormEl = selectedProject
      ? h(
                "form",
        { onSubmit: createWorkload, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
                workloadModeSelect,
                ...workloadFieldInputs(workloadForm.input_mode),
                workloadError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, workloadError) : null,
                h(
                            "div",
                  { className: "md:col-span-3" },
                            h(
                                          "button",
                              {
                                              type: "submit",
                                              disabled: savingWorkload,
                                              className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                              },
                                          savingWorkload ? "Guardando..." : "Agregar carga de trabajo"
                                        )
                          )
              )
        : null;

  const paso5Panel = selectedProject
      ? h(
                "div",
        { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
                h("div", { className: "text-sm font-medium text-foreground" }, "Paso 5 - Carga de trabajo (" + selectedProject.name + ")"),
                h(
                            "div",
                  { className: "text-xs text-muted-foreground" },
                            "El historico de cargas de trabajo se conserva completo y no se sobrescribe (S35). Modos disponibles: Simple, Detallada y Avanzada (S18)."
                          ),
                loadingWorkload ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando carga de trabajo...") : workloadTable,
                workloadFormEl
              )
        : null;

        const areaTypeSelect = h(
                    "label",
            { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
                    "Clasificacion de area (S20)",
                    h(
                                    "select",
                        {
                                            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                                            value: pirForm.area_type,
                                            onChange: (e: any) => updatePirField("area_type", e.target.value),
                        },
                                    AREA_CLASSIFICATIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
                                )
                );

        const resultStatusSelect = h(
                    "label",
            { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
                    "Estado (S39, S60)",
                    h(
                                    "select",
                        {
                                            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                                            value: pirForm.result_status,
                                            onChange: (e: any) => updatePirField("result_status", e.target.value),
                        },
                                    RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
                                )
                );

        const pirRows = pirList.map((pir) =>
                    h(
                                    "tr",
                        { key: pir.id, className: "border-b border-border" },
                                    h("td", { className: "px-3 py-2 text-sm" }, pir.code),
                                    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, pir.name),
                                    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, pir.area_type || "-"),
                                    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, pir.distance_m ? String(pir.distance_m) + " m" : "-"),
                                    h(
                                                        "td",
                                        { className: "px-3 py-2 text-sm text-muted-foreground" },
                                                        pir.design_criterion_value ? pir.design_criterion_value + " " + (pir.design_criterion_unit || "") : "-"
                                                    ),
                                    h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, pir.result_status || "sin_informacion")
                                )
                );

        const pirTable = h(
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
                                                                                h("th", { className: "px-3 py-2" }, "Codigo"),
                                                                                h("th", { className: "px-3 py-2" }, "Nombre"),
                                                                                h("th", { className: "px-3 py-2" }, "Clasificacion"),
                                                                                h("th", { className: "px-3 py-2" }, "Distancia"),
                                                                                h("th", { className: "px-3 py-2" }, "Criterio de diseno"),
                                                                                h("th", { className: "px-3 py-2" }, "Estado")
                                                                            )
                                                    ),
                                    h("tbody", null, pirRows)
                                )
                );

                const pirFormEl = selectedProject
            ? h(
                              "form",
                { onSubmit: createPir, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
                              field("Codigo del PIR *", pirForm.code, (v) => updatePirField("code", v)),
                              field("Nombre del PIR *", pirForm.name, (v) => updatePirField("name", v)),
                              field("Descripcion", pirForm.description, (v) => updatePirField("description", v)),
                              field("Coordenadas / ubicacion", pirForm.coordinates, (v) => updatePirField("coordinates", v)),
                              field("Distancia fuente-punto (m)", pirForm.distance_m, (v) => updatePirField("distance_m", v)),
                              areaTypeSelect,
                              field("Ocupacion (descripcion)", pirForm.occupancy_type, (v) => updatePirField("occupancy_type", v)),
                              field("Factor de ocupacion (T)", pirForm.occupancy_factor, (v) => updatePirField("occupancy_factor", v)),
                              field("Criterio de diseno (valor)", pirForm.design_criterion_value, (v) => updatePirField("design_criterion_value", v)),
                              field("Criterio de diseno (unidad)", pirForm.design_criterion_unit, (v) => updatePirField("design_criterion_unit", v)),
                              field("Fuente del criterio (norma, pagina) *", pirForm.design_criterion_source, (v) => updatePirField("design_criterion_source", v)),
                              resultStatusSelect,
                              pirError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, pirError) : null,
                              h(
                                                    "div",
                                  { className: "md:col-span-3" },
                                                    h(
                                                                              "button",
                                                        {
                                                                                      type: "submit",
                                                                                      disabled: savingPir,
                                                                                      className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                                                        },
                                                                              savingPir ? "Guardando..." : "Agregar punto de interes"
                                                                          )
                                                )
                          )
                    : null;

            const paso6Panel = selectedProject
            ? h(
                              "div",
                { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
                              h("div", { className: "text-sm font-medium text-foreground" }, "Paso 6 - Geometria y Puntos de Interes / PIR (" + selectedProject.name + ")"),
                    h(
                                "div",
                        { className: "text-xs text-muted-foreground" },
                                "Cada PIR registra codigo, nombre, coordenadas, distancia, clasificacion de area, ocupacion y el criterio de diseno con su fuente (S20, S33)."
                                ),
                        loadingPir ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando puntos de interes...") : pirTable,
                        pirFormEl
                              )
                        : null;

    const barrierTypeSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Tipo de barrera (S25)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: barrierForm.barrier_type,
                onChange: (e: any) => updateBarrierField("barrier_type", e.target.value),
            },
            BARRIER_TYPES.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );

    const barrierResultStatusSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Estado (S39, S60)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: barrierForm.result_status,
                onChange: (e: any) => updateBarrierField("result_status", e.target.value),
            },
            RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );

    const barrierPirSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "PIR asociado",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: barrierForm.pir_id,
                onChange: (e: any) => updateBarrierField("pir_id", e.target.value),
            },
            [h("option", { key: "", value: "" }, "Sin PIR asociado")].concat(
                pirList.map((pir) => h("option", { key: String(pir.id), value: String(pir.id) }, pir.code + " - " + pir.name))
                )
            )
        );
    

          const barrierRows = barriersList.map((b) =>
              h(
                  "tr",
                  { key: b.id, className: "border-b border-border" },
                  h("td", { className: "px-3 py-2 text-sm" }, b.code),
                  h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, b.name),
                  h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, b.barrier_type),
                  h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, b.material || "-"),
                  h(
                      "td",
                      { className: "px-3 py-2 text-sm text-muted-foreground" },
                      b.thickness_required_cm ? String(b.thickness_required_cm) + " cm" : "-"
                      ),
                  h(
                      "td",
                      { className: "px-3 py-2 text-sm text-muted-foreground" },
                      b.thickness_adopted_cm ? String(b.thickness_adopted_cm) + " cm" : "-"
                      ),
                  h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, b.result_status || "sin_informacion")
                  )
                                               );
    
    const barriersTable = h(
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
                    h("th", { className: "px-3 py-2" }, "Codigo"),
                    h("th", { className: "px-3 py-2" }, "Nombre"),
                    h("th", { className: "px-3 py-2" }, "Tipo"),
                    h("th", { className: "px-3 py-2" }, "Material"),
                    h("th", { className: "px-3 py-2" }, "Espesor requerido"),
                    h("th", { className: "px-3 py-2" }, "Espesor adoptado"),
                    h("th", { className: "px-3 py-2" }, "Estado")
                    )
                ),
            h("tbody", null, barrierRows)
            )
        );
    
    const barrierFormEl = selectedProject
        ? h(
            "form",
            { onSubmit: createBarrier, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
            field("Codigo de la barrera *", barrierForm.code, (v) => updateBarrierField("code", v)),
            field("Nombre de la barrera *", barrierForm.name, (v) => updateBarrierField("name", v)),
            barrierTypeSelect,
            barrierPirSelect,
            field("Material", barrierForm.material, (v) => updateBarrierField("material", v)),
            field("Densidad (g/cm3)", barrierForm.density, (v) => updateBarrierField("density", v)),
            field("Fuente del material (norma, pagina)", barrierForm.material_source, (v) => updateBarrierField("material_source", v)),
            field("Espesor existente (cm)", barrierForm.thickness_existing_cm, (v) => updateBarrierField("thickness_existing_cm", v)),
            field("Espesor requerido (cm)", barrierForm.thickness_required_cm, (v) => updateBarrierField("thickness_required_cm", v)),
            field("Espesor adoptado (cm)", barrierForm.thickness_adopted_cm, (v) => updateBarrierField("thickness_adopted_cm", v)),
            field("Margen (cm)", barrierForm.margin_cm, (v) => updateBarrierField("margin_cm", v)),
            field("Distancia (m)", barrierForm.distance_m, (v) => updateBarrierField("distance_m", v)),
            field("Factor de uso (U)", barrierForm.use_factor, (v) => updateBarrierField("use_factor", v)),
            field("Factor de ocupacion (T)", barrierForm.occupancy_factor, (v) => updateBarrierField("occupancy_factor", v)),
            barrierResultStatusSelect,
            barrierError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, barrierError) : null,
            h(
                "div",
                { className: "md:col-span-3" },
                h(
                    "button",
                    {
                        type: "submit",
                        disabled: savingBarrier,
                        className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                    },
                    savingBarrier ? "Guardando..." : "Agregar barrera"
                    )
                )
            )
        : null;
    
    const paso7Panel = selectedProject
        ? h(
            "div",
            { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
            h("div", { className: "text-sm font-medium text-foreground" }, "Paso 7 - Barreras (" + selectedProject.name + ")"),
            h(
                "div",
                { className: "text-xs text-muted-foreground" },
                "Cada barrera guarda tipo, material y espesores existente/requerido/adoptado con su margen, PIR asociado y factores de uso/ocupacion (S21, S23, S24, S25)."
                ),
            loadingBarriers ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando barreras...") : barriersTable,
            barrierFormEl
            )
        : null;
    
const materialRows = materialsList.map((m) =>
    h(
        "tr",
        { key: m.id, className: "border-b border-border" },
        h("td", { className: "px-3 py-2 text-sm" }, m.name),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.density ? String(m.density) + " " + (m.density_unit || "") : "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.hvl ? String(m.hvl) + " cm" : "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.tvl ? String(m.tvl) + " cm" : "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.source_document ? m.source_document + (m.source_page ? " (p. " + m.source_page + ")" : "") : "-")
        )
                                       );
    
    const materialsTable = h(
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
                    h("th", { className: "px-3 py-2" }, "Nombre"),
                    h("th", { className: "px-3 py-2" }, "Densidad"),
                    h("th", { className: "px-3 py-2" }, "HVL"),
                    h("th", { className: "px-3 py-2" }, "TVL"),
                    h("th", { className: "px-3 py-2" }, "Fuente documental")
                    )
                ),
            h("tbody", null, materialRows)
            )
        );
    
    const materialFormEl = h(
        "form",
        { onSubmit: createMaterial, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
        field("Nombre del material *", materialForm.name, (v) => updateMaterialField("name", v)),
        field("Densidad", materialForm.density, (v) => updateMaterialField("density", v)),
        field("Unidad de densidad", materialForm.density_unit, (v) => updateMaterialField("density_unit", v)),
        field("HVL (cm)", materialForm.hvl, (v) => updateMaterialField("hvl", v)),
        field("TVL (cm)", materialForm.tvl, (v) => updateMaterialField("tvl", v)),
        field("Metodo", materialForm.method, (v) => updateMaterialField("method", v)),
        field("Rango de aplicacion (energia)", materialForm.application_range, (v) => updateMaterialField("application_range", v)),
        field("Fuente documental (norma) *", materialForm.source_document, (v) => updateMaterialField("source_document", v)),
        field("Pagina / seccion de la fuente", materialForm.source_page, (v) => updateMaterialField("source_page", v)),
        materialError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, materialError) : null,
        h(
            "div",
            { className: "md:col-span-3" },
            h(
                "button",
                {
                    type: "submit",
                    disabled: savingMaterial,
                    className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                },
                savingMaterial ? "Guardando..." : "Agregar material"
                )
            )
        );
    
    const materialsPanel = h(
        "div",
        { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
        h("div", { className: "text-sm font-medium text-foreground" }, "Materiales - Base de datos compartida (S22)"),
        h(
            "div",
            { className: "text-xs text-muted-foreground" },
            "Biblioteca comun de materiales de blindaje (hormigon, plomo, acero, etc). No esta asociada a un proyecto; cada registro exige su fuente documental (S33, S55, S61)."
            ),
        loadingMaterials ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando materiales...") : materialsTable,
        materialFormEl
        );

    const doorBarrierSelect = h(
            "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
            "Barrera asociada",
            h(
                        "select",
                {
                                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                                value: doorForm.barrier_id,
                                onChange: (e: any) => updateDoorField("barrier_id", e.target.value),
                },
                        [h("option", { key: "", value: "" }, "Sin barrera asociada")].concat(
                                        barriersList.map((b) => h("option", { key: String(b.id), value: String(b.id) }, b.code + " - " + b.name))
                                    )
                    )
        );

    const doorResultStatusSelect = h(
            "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
            "Estado (S39, S60)",
            h(
                        "select",
                {
                                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                                value: doorForm.result_status,
                                onChange: (e: any) => updateDoorField("result_status", e.target.value),
                },
                        RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
                    )
        );

    const doorRows = doorsList.map((d) =>
            h(
                        "tr",
                { key: d.id, className: "border-b border-border" },
                        h("td", { className: "px-3 py-2 text-sm" }, d.code),
                        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, d.name),
                        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, d.location || "-"),
                        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, d.material || "-"),
                        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, d.thickness_cm ? String(d.thickness_cm) + " cm" : "-"),
                        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, d.lead_equivalent_mm ? String(d.lead_equivalent_mm) + " mm Pb" : "-"),
                        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, d.result_status || "sin_informacion")
                    )
        );

    const doorsTable = h(
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
                                                            h("th", { className: "px-3 py-2" }, "Codigo"),
                                                            h("th", { className: "px-3 py-2" }, "Nombre"),
                                                            h("th", { className: "px-3 py-2" }, "Ubicacion"),
                                                            h("th", { className: "px-3 py-2" }, "Material"),
                                                            h("th", { className: "px-3 py-2" }, "Espesor"),
                                                            h("th", { className: "px-3 py-2" }, "Equiv. Pb"),
                                                            h("th", { className: "px-3 py-2" }, "Estado")
                                                        )
                                    ),
                        h("tbody", null, doorRows)
                    )
        );

    const doorFormEl = selectedProject
        ? h(
                    "form",
            { onSubmit: createDoor, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
                    field("Codigo de la puerta *", doorForm.code, (v) => updateDoorField("code", v)),
                    field("Nombre de la puerta *", doorForm.name, (v) => updateDoorField("name", v)),
                    doorBarrierSelect,
                    field("Ubicacion", doorForm.location, (v) => updateDoorField("location", v)),
                    field("Ancho (cm)", doorForm.width_cm, (v) => updateDoorField("width_cm", v)),
                    field("Alto (cm)", doorForm.height_cm, (v) => updateDoorField("height_cm", v)),
                    field("Material", doorForm.material, (v) => updateDoorField("material", v)),
                    field("Espesor (cm)", doorForm.thickness_cm, (v) => updateDoorField("thickness_cm", v)),
                    field("Equivalencia en plomo (mm)", doorForm.lead_equivalent_mm, (v) => updateDoorField("lead_equivalent_mm", v)),
                    doorResultStatusSelect,
                    field("Fuente documental (norma, pagina)", doorForm.source_document, (v) => updateDoorField("source_document", v)),
                    field("Notas", doorForm.notes, (v) => updateDoorField("notes", v)),
                    doorError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, doorError) : null,
                    h(
                                    "div",
                        { className: "md:col-span-3" },
                                    h(
                                                        "button",
                                        {
                                                                type: "submit",
                                                                disabled: savingDoor,
                                                                className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                                        },
                                                        savingDoor ? "Guardando..." : "Agregar puerta"
                                                    )
                                )
                )
            : null;

    const paso8Panel = selectedProject
        ? h(
                    "div",
            { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
                    h("div", { className: "text-sm font-medium text-foreground" }, "Paso 8 - Puertas (" + selectedProject.name + ")"),
                    h(
                                    "div",
                        { className: "text-xs text-muted-foreground" },
                                    "Cada puerta registra ubicacion, dimensiones, material, espesor y equivalencia en plomo, con su barrera asociada y fuente documental (S27, S33)."
                                ),
                    loadingDoors ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando puertas...") : doorsTable,
                    doorFormEl
                )
            : null;
    
    const windowBarrierSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Barrera asociada",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: windowForm.barrier_id,
                onChange: (e: any) => updateWindowField("barrier_id", e.target.value),
            },
            [h("option", { key: "", value: "" }, "Sin barrera asociada")].concat(
                barriersList.map((b) => h("option", { key: String(b.id), value: String(b.id) }, b.code + " - " + b.name))
                )
            )
        );
    
    const windowResultStatusSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Estado (S39, S60)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: windowForm.result_status,
                onChange: (e: any) => updateWindowField("result_status", e.target.value),
            },
            RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );
    
    const windowRows = windowsList.map((w) =>
        h(
            "tr",
            { key: w.id, className: "border-b border-border" },
            h("td", { className: "px-3 py-2 text-sm" }, w.code),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.name),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.location || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.material || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.thickness_cm ? String(w.thickness_cm) + " cm" : "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.lead_equivalent_mm ? String(w.lead_equivalent_mm) + " mm Pb" : "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.energy || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, w.result_status || "sin_informacion")
            )
                                       );
    
    const windowsTable = h(
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
                    h("th", { className: "px-3 py-2" }, "Codigo"),
                    h("th", { className: "px-3 py-2" }, "Nombre"),
                    h("th", { className: "px-3 py-2" }, "Ubicacion"),
                    h("th", { className: "px-3 py-2" }, "Material"),
                    h("th", { className: "px-3 py-2" }, "Espesor"),
                    h("th", { className: "px-3 py-2" }, "Equiv. Pb"),
                    h("th", { className: "px-3 py-2" }, "Energia"),
                    h("th", { className: "px-3 py-2" }, "Estado")
                    )
                ),
            h("tbody", null, windowRows)
            )
        );
    
    const windowFormEl = selectedProject
        ? h(
            "form",
            { onSubmit: createWindow, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
            field("Codigo de la ventana *", windowForm.code, (v) => updateWindowField("code", v)),
            field("Nombre de la ventana *", windowForm.name, (v) => updateWindowField("name", v)),
            windowBarrierSelect,
            field("Ubicacion", windowForm.location, (v) => updateWindowField("location", v)),
            field("Ancho (cm)", windowForm.width_cm, (v) => updateWindowField("width_cm", v)),
            field("Alto (cm)", windowForm.height_cm, (v) => updateWindowField("height_cm", v)),
            field("Material", windowForm.material, (v) => updateWindowField("material", v)),
            field("Espesor (cm)", windowForm.thickness_cm, (v) => updateWindowField("thickness_cm", v)),
            field("Equivalencia en plomo (mm)", windowForm.lead_equivalent_mm, (v) => updateWindowField("lead_equivalent_mm", v)),
            field("Energia de diseno", windowForm.energy, (v) => updateWindowField("energy", v)),
            windowResultStatusSelect,
            field("Fuente documental (norma, pagina)", windowForm.source_document, (v) => updateWindowField("source_document", v)),
            field("Notas", windowForm.notes, (v) => updateWindowField("notes", v)),
            windowError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, windowError) : null,
            h(
                "div",
                { className: "md:col-span-3" },
                h(
                    "button",
                    {
                        type: "submit",
                        disabled: savingWindow,
                        className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                    },
                    savingWindow ? "Guardando..." : "Agregar ventana"
                    )
                )
            )
        : null;
    
    const paso9Panel = selectedProject
        ? h(
            "div",
            { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
            h("div", { className: "text-sm font-medium text-foreground" }, "Paso 9 - Ventanas de observacion (" + selectedProject.name + ")"),
            h(
                "div",
                { className: "text-xs text-muted-foreground" },
                "Cada ventana registra ubicacion, dimensiones, material, espesor, equivalencia en plomo y energia de diseno, con su barrera asociada y fuente documental (S28, S33)."
                ),
            loadingWindows ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando ventanas...") : windowsTable,
            windowFormEl
            )
        : null;
const penetrationBarrierSelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Barrera asociada",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: penetrationForm.barrier_id,
            onChange: (e: any) => updatePenetrationField("barrier_id", e.target.value),
        },
        [h("option", { key: "", value: "" }, "Sin barrera asociada")].concat(
            barriersList.map((b) => h("option", { key: String(b.id), value: String(b.id) }, b.code + " - " + b.name))
            )
        )
    );

    const penetrationTypeSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Tipo de penetracion",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: penetrationForm.penetration_type,
                onChange: (e: any) => updatePenetrationField("penetration_type", e.target.value),
            },
            PENETRATION_TYPES.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );

    const penetrationResultStatusSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Estado (S39, S60)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: penetrationForm.result_status,
                onChange: (e: any) => updatePenetrationField("result_status", e.target.value),
            },
            RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );

    const penetrationRows = penetrationsList.map((p) =>
        h(
            "tr",
            { key: p.id, className: "border-b border-border" },
            h("td", { className: "px-3 py-2 text-sm" }, p.code),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.name),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.location || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.penetration_type || "-"),
            h(
                "td",
                { className: "px-3 py-2 text-sm text-muted-foreground" },
                p.diameter_cm ? String(p.diameter_cm) + " cm (diam.)" : p.width_cm ? String(p.width_cm) + "x" + (p.height_cm || "-") + " cm" : "-"
                ),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.fill_material || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.offset_cm ? String(p.offset_cm) + " cm" : "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, p.result_status || "sin_informacion")
            )
        );

    const penetrationsTable = h(
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
                    h("th", { className: "px-3 py-2" }, "Codigo"),
                    h("th", { className: "px-3 py-2" }, "Nombre"),
                    h("th", { className: "px-3 py-2" }, "Ubicacion"),
                    h("th", { className: "px-3 py-2" }, "Tipo"),
                    h("th", { className: "px-3 py-2" }, "Dimension"),
                    h("th", { className: "px-3 py-2" }, "Material de relleno"),
                    h("th", { className: "px-3 py-2" }, "Desplazamiento"),
                    h("th", { className: "px-3 py-2" }, "Estado")
                    )
                ),
            h("tbody", null, penetrationRows)
            )
        );

    const penetrationFormEl = selectedProject
    ? h(
        "form",
        { onSubmit: createPenetration, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
        field("Codigo de la penetracion *", penetrationForm.code, (v) => updatePenetrationField("code", v)),
        field("Nombre de la penetracion *", penetrationForm.name, (v) => updatePenetrationField("name", v)),
        penetrationBarrierSelect,
        field("Ubicacion", penetrationForm.location, (v) => updatePenetrationField("location", v)),
        penetrationTypeSelect,
        field("Diametro (cm, si es circular)", penetrationForm.diameter_cm, (v) => updatePenetrationField("diameter_cm", v)),
        field("Ancho (cm, si es rectangular)", penetrationForm.width_cm, (v) => updatePenetrationField("width_cm", v)),
        field("Alto (cm, si es rectangular)", penetrationForm.height_cm, (v) => updatePenetrationField("height_cm", v)),
        field("Material de relleno / sellado", penetrationForm.fill_material, (v) => updatePenetrationField("fill_material", v)),
        field("Desplazamiento respecto a linea recta (cm)", penetrationForm.offset_cm, (v) => updatePenetrationField("offset_cm", v)),
        penetrationResultStatusSelect,
        field("Fuente documental (norma, pagina)", penetrationForm.source_document, (v) => updatePenetrationField("source_document", v)),
        field("Notas", penetrationForm.notes, (v) => updatePenetrationField("notes", v)),
        penetrationError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, penetrationError) : null,
        h(
            "div",
            { className: "md:col-span-3" },
            h(
                "button",
                {
                    type: "submit",
                    disabled: savingPenetration,
                    className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                },
                savingPenetration ? "Guardando..." : "Agregar penetracion"
                )
            )
        )
        : null;

    const paso10Panel = selectedProject
    ? h(
        "div",
        { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
        h("div", { className: "text-sm font-medium text-foreground" }, "Paso 10 - Penetraciones (" + selectedProject.name + ")"),
        h(
            "div",
            { className: "text-xs text-muted-foreground" },
            "Cada penetracion (ducto, tuberia, bandeja de cables) registra ubicacion, tipo, dimensiones, material de relleno y desplazamiento respecto a la linea recta para evitar streaming directo de radiacion, con su barrera asociada y fuente documental (S29, S33)."
            ),
        loadingPenetrations ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando penetraciones...") : penetrationsTable,
        penetrationFormEl
        )
        : null;
    
    const nextPhases = h(
    "div",
    { className: "rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground" },
    "Proximas fases (en desarrollo): motor regulatorio con fuentes citadas (NCRP 147 / NCRP 151 y normativa CCHEN vigente), memoria de calculo e informe PDF."
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
        paso4Panel,
        paso5Panel,
                  paso6Panel,
          paso7Panel,
          materialsPanel,
              paso8Panel,
paso9Panel,
          paso10Panel,
          nextPhases
      );
}
