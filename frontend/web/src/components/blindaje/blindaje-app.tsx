"use client";

import { createElement as h, useEffect, useState, type FormEvent } from "react";
import { FACTORES_OCUPACION_NCRP147, FUENTE_TABLA_4_1_OCUPACION, OPCIONES_CRITERIO_DISENO_DIAGNOSTICO, MATERIALES_BARRERA_NCRP147 , FUENTE_TABLA_A1_MATERIALES} from "@/lib/ncrp147-shielding-references";
import { MAPEO_OCUPACION_NCRP151_MEDICINA_NUCLEAR, OBJETIVOS_DISENO_P_NCRP151 } from "@/lib/ncrp151-shielding-references";
import { RADIONUCLIDOS_PET } from "@/lib/blindaje-calc-engine";
import { DISTRIBUCIONES_CARGA_TRABAJO_NCRP147, TABLA_4_5_KERMA_PRIMARIO_NO_BLINDADO, TABLA_4_7_KERMA_SECUNDARIO_NO_BLINDADO, TABLA_B1_TRANSMISION_PRIMARIA_POR_CARGA, TABLA_C1_TRANSMISION_SECUNDARIA_POR_CARGA, calcularBarreraPrimariaNCRP147, calcularBarreraSecundariaNCRP147, type DistribucionCargaTrabajoNCRP147, type MaterialNCRP147 } from "@/lib/ncrp147-diagnostic-calc-engine";
import { NUCLEIDOS_TABLA20, HVL_TVL_TABLA22, calcularCargaTrabajoBraquiterapiaViaRAKR, calcularFactorTransmisionBarreraBraquiterapiaSemanal, calcularEspesorBarreraBraquiterapia } from "@/lib/srs47-braquiterapia-references";
import { calcularNumeroTVL, FACTORES_OCUPACION_NCRP151_RADIOTERAPIA, TVL_BARRERA_PRIMARIA_NCRP151, FUENTE_TABLA_B2_BARRERA_PRIMARIA, calcularFactorTransmisionBarreraPrimaria, calcularEspesorBarrera, obtenerTVLBarreraPrimaria, calcularFactorTransmisionDispersionPaciente, calcularFactorTransmisionFuga, combinarBarreraSecundariaDosFuentes, FRACCION_DISPERSION_PACIENTE_NCRP151, TVL_DISPERSION_PACIENTE_HORMIGON_NCRP151, TVL_FUGA_HORMIGON_NCRP151, obtenerTVLFugaHormigon, FUERZA_FUENTE_NEUTRONES_NCRP151 } from "@/lib/ncrp151-acelerador-barreras-references"; import { calcularDispersionParedGLaberinto, calcularFugaDispersaCabezaLaberinto, calcularFugaTransmitidaLaberinto, calcularDosisTotalParedG, calcularDosisTotalLaberintoBajaEnergia, FACTOR_USO_ANGULO_PORTICO_TABLA31, calcularFluenciaNeutronesUbicacionA, calcularDosisGammaCapturaEnPuerta, calcularDosisGammaCapturaPuerta, calcularDosisNeutronesKerseyModificado, calcularDosisNeutronesPuertaSemanal, calcularDosisTotalPuertaAltaEnergia, NCRP151_K_GAMMA_CAPTURA_SV_M2, NCRP151_TVD_GAMMA_CAPTURA_M, TVL_PLOMO_GAMMA_CAPTURA_PUERTA_CM, TVL_BPE_RECOMENDADO_CONSERVADOR_DISENO_PUERTA_CM, PESO_MAXIMO_PRACTICO_PUERTA_BATIENTE_120CM_KG_MIN, PESO_MAXIMO_PRACTICO_PUERTA_BATIENTE_120CM_KG_MAX, ANCHO_PUERTA_REFERENCIA_LIMITE_PESO_CM, ENERGIA_GAMMA_CAPTURA_BORO_KEV, ESPESOR_PLOMO_ATENUACION_100X_GAMMA_CAPTURA_BORO_CM, TECNICAS_ALTERNATIVAS_PUERTA_LABERINTO_MCGINLEY_MINER_1995, COMPARACION_TECNICAS_PUERTA_LABERINTO_TABLA21, DISPOSICION_CAPAS_PUERTA_LABERINTO_LARGO_SUGERIDA, ESPESOR_PLOMO_INTERIOR_PUERTA_LABERINTO_LARGO_CM_MIN, ESPESOR_PLOMO_INTERIOR_PUERTA_LABERINTO_LARGO_CM_MAX, ESPESOR_BPE_PUERTA_LABERINTO_LARGO_CM_MIN, ESPESOR_BPE_PUERTA_LABERINTO_LARGO_CM_MAX, NOTA_RAZON_DISPOSICION_PLOMO_BPE_PLOMO } from "@/lib/ncrp151-laberintos-puertas-references";

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
  { value: "medicina_nuclear", label: "Medicina Nuclear (Gammacamara / SPECT)" },
  { value: "medicina_nuclear_pet_ct", label: "Medicina Nuclear - PET / PET-CT (AAPM TG-108)" },
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
        ],
    medicina_nuclear_pet_ct: [
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
    medicina_nuclear_pet_ct: { value: "radionucleido_pet_movil", label: "Radionuclido emisor de positrones (paciente como fuente movil, AAPM TG-108)" },
    radioterapia: { value: "haz_acelerador", label: "Haz de fotones/electrones" },
    braquiterapia: { value: "fuente_sellada", label: "Fuente sellada" },
};

const SOURCE_FIELDS_BY_FACILITY: Record<string, string[]> = {
    diagnostico: ["energy", "dose_rate", "geometry"],
    medicina_nuclear: ["radionuclide", "activity", "geometry"],
    medicina_nuclear_pet_ct: ["radionuclide", "activity", "geometry"],
    radioterapia: ["energy", "dose_rate", "geometry"],
    braquiterapia: ["radionuclide", "activity", "geometry"],
};

const SOURCE_FIELD_LABELS: Record<string, Record<string, string>> = {
    diagnostico: { energy: "Energia (kVp)", dose_rate: "Carga / corriente (mA o mGy por mAs)", geometry: "Distancia foco-piel / geometria" },
    medicina_nuclear: { radionuclide: "Radionuclido", activity: "Actividad", geometry: "Geometria (captacion, distancia)" },
    medicina_nuclear_pet_ct: { radionuclide: "Radionuclido emisor de positrones (Tabla I/II AAPM TG-108)", activity: "Actividad administrada (A0)", geometry: "Geometria (distancia a sala de captacion / sala de imagen, Ecs. 1-12 AAPM TG-108)" },
    radioterapia: { energy: "Energia nominal (MV o MeV)", dose_rate: "Tasa de dosis (UM/min)", geometry: "Isocentro / distancia fuente-eje" },
    braquiterapia: { radionuclide: "Radionuclido", activity: "Actividad", geometry: "Geometria de aplicacion" },
};

const WORKLOAD_MODES: { value: string; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "detallada", label: "Detallada" },
  { value: "avanzada", label: "Avanzada" },
  { value: "braquiterapia", label: "Braquiterapia (SRS-47)" },
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
    braquiterapia: ["treatment_duration_h", "procedures_per_week", "workload_value", "workload_unit", "notes"],
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
    treatment_duration_h: "Duracion promedio del tratamiento (t, horas) - SRS-47 Ec. 33/34",
};

const AREA_CLASSIFICATIONS: { value: string; label: string }[] = [
    { value: "controlada", label: "Area controlada (POE)" },
    { value: "no_controlada", label: "Area no controlada (Publico)" },
    ];

const DENSITY_UNIT_OPTIONS: { value: string; label: string }[] = [
    { value: "g/cm3", label: "g/cm3 (gramos por centimetro cubico)" },
    { value: "kg/m3", label: "kg/m3 (kilogramos por metro cubico)" },
    ];

const ACTIVITY_UNIT_OPTIONS: { value: string; label: string }[] = [
    { value: "MBq", label: "MBq (megabecquerel)" },
    { value: "GBq", label: "GBq (gigabecquerel)" },
    { value: "kBq", label: "kBq (kilobecquerel)" },
    { value: "Ci", label: "Ci (curie)" },
    { value: "mCi", label: "mCi (milicurie)" },
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

const BARRIER_MATERIALS_RADIOTERAPIA: string[] = Array.from(new Set(TVL_BARRERA_PRIMARIA_NCRP151.map((t) => t.material))); const MAPEO_ETIQUETA_MATERIAL_A_NCRP147_DIAGNOSTICO: Record<string, MaterialNCRP147> = { "Plomo": "Plomo", "Hormigon": "Hormigon", "Tablero de yeso (gypsum wallboard)": "Tablero de yeso", "Acero": "Acero", "Vidrio plano (plate glass)": "Vidrio plano", "Madera": "Madera" }; function materialNCRP147DesdeEtiqueta(etiqueta: string): MaterialNCRP147 | null { return MAPEO_ETIQUETA_MATERIAL_A_NCRP147_DIAGNOSTICO[etiqueta] || null; }

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
    scatter_angle_grados: "",
    dsca_m: "", distribucion_carga_ncrp147: "", componente_dispersion_ncrp147: "",
    result_status: "sin_informacion",
    result_value: "",
    result_unit: "",
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
type BlindajeMaze = {
    id: number;
    project_id: number;
    barrier_id: number | null;
    code: string;
    name: string;
    location: string | null;
    leg_count: number | null;
    last_leg_length_m: number | null;
    maze_width_cm: number | null;
    maze_height_cm: number | null;
    wall_material: string | null;
    result_value: number | null;
    result_unit: string | null;
    result_status: string | null;
    source_document: string | null;
    notes: string | null;
    created_at: string;
};

const EMPTY_MAZE_FORM = {
    barrier_id: "",
    code: "",
    name: "",
    location: "",
    leg_count: "",
    last_leg_length_m: "",
    maze_width_cm: "",
    maze_height_cm: "",
    wall_material: "", result_value: "", result_unit: "", ug: "", alfa0: "", a0_m2: "", alfaz: "", az_m2: "", dh_m: "", dr_m: "", dz_m: "", wl_gy_semana: "", alfa1: "", a1_m2: "", dsec_m: "", dzz_m: "", dl_m: "", b_pared_z: "", f_transmision_paciente: "", beta_neutrones: "", d1_m: "", sr_m2: "", qn_x1e12: "", s0_m2: "", s1_m2: "", d2_m: "", result_value_alta_energia: "", result_unit_alta_energia: "", p_diseno_puerta_sv_semana: "", espesor_plomo_puerta_cm: "", espesor_bpe_puerta_cm: "", result_unit_puerta: "",
    result_status: "sin_informacion",
    source_document: "",
    notes: "",
};

type BlindajeSlab = {
    id: number;
    project_id: number;
    barrier_id: number | null;
    code: string;
    name: string;
    location: string | null;
    slab_type: string | null;
    thickness_cm: number | null;
    material: string | null;
    occupancy_above: string | null;
    distance_property_line_m: number | null;
    result_value: number | null;
    result_unit: string | null;
    result_status: string | null;
    source_document: string | null;
    notes: string | null;
    created_at: string;
};

const SLAB_TYPES: { value: string; label: string }[] = [
    { value: "techo", label: "Techo / Losa superior" },
    { value: "piso", label: "Piso / Losa inferior" },
    ];

const OCCUPANCY_ABOVE_OPTIONS: { value: string; label: string }[] = [
    { value: "sin_ocupacion", label: "Sin ocupacion (azotea tecnica)" },
    { value: "ocupacional", label: "Ocupacional (POE)" },
    { value: "publico", label: "Publico" },
    ];

const EMPTY_SLAB_FORM = {
    barrier_id: "",
    code: "",
    name: "",
    location: "",
    slab_type: "techo",
    thickness_cm: "",
    material: "",
    occupancy_above: "sin_ocupacion",
    distance_property_line_m: "",
    result_status: "sin_informacion",
    source_document: "",
    notes: "",
};

type BlindajeOccupancyPoint = {
    id: number;
    project_id: number;
    barrier_id: number | null;
    code: string;
    name: string;
    location: string | null;
    occupancy_type: string | null;
    occupancy_factor_t: number | null;
    distance_m: number | null;
    beam_component: string | null;
    result_value: number | null;
    result_unit: string | null;
    result_status: string | null;
    source_document: string | null;
    notes: string | null;
    created_at: string;
};

const OCCUPANCY_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "toe", label: "Trabajador ocupacionalmente expuesto (TOE)" },
    { value: "publico", label: "Publico general" },
    { value: "paciente_acompanante", label: "Paciente / acompanante" },
    ];

const BEAM_COMPONENT_OPTIONS: { value: string; label: string }[] = [
    { value: "primario", label: "Haz primario" },
    { value: "dispersa", label: "Radiacion dispersa (secundaria)" },
    { value: "fuga", label: "Radiacion de fuga" },
    ];

const EMPTY_OCCUPANCY_POINT_FORM = {
    barrier_id: "",
    code: "",
    name: "",
    location: "",
    occupancy_type: "toe",
    occupancy_factor_t: "",
    distance_m: "",
    beam_component: "primario",
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
    const [mazesList, setMazesList] = useState<BlindajeMaze[]>([]);
    const [loadingMazes, setLoadingMazes] = useState(false);
    const [mazeForm, setMazeForm] = useState(EMPTY_MAZE_FORM);
    const [savingMaze, setSavingMaze] = useState(false);
    const [mazeError, setMazeError] = useState<string | null>(null);
    const [slabsList, setSlabsList] = useState<BlindajeSlab[]>([]);
    const [loadingSlabs, setLoadingSlabs] = useState(false);
    const [slabForm, setSlabForm] = useState(EMPTY_SLAB_FORM);
    const [savingSlab, setSavingSlab] = useState(false);
    const [slabError, setSlabError] = useState<string | null>(null);
    const [occupancyPointsList, setOccupancyPointsList] = useState<BlindajeOccupancyPoint[]>([]);
    const [loadingOccupancyPoints, setLoadingOccupancyPoints] = useState(false);
    const [occupancyPointForm, setOccupancyPointForm] = useState(EMPTY_OCCUPANCY_POINT_FORM);
    const [savingOccupancyPoint, setSavingOccupancyPoint] = useState(false);
    const [occupancyPointError, setOccupancyPointError] = useState<string | null>(null);
    
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
    function loadMazes(projectId: number) {
        setLoadingMazes(true);
        fetch("/api/blindaje/mazes?project_id=" + projectId)
        .then((r) => (r.ok ? r.json() : { mazes: [] }))
        .then((data) => setMazesList(data.mazes ?? []))
        .finally(() => setLoadingMazes(false));
    }
    function loadSlabs(projectId: number) {
        setLoadingSlabs(true);
        fetch("/api/blindaje/slabs?project_id=" + projectId)
        .then((r) => (r.ok ? r.json() : { slabs: [] }))
        .then((data) => setSlabsList(data.slabs ?? []))
        .finally(() => setLoadingSlabs(false));
    }
    
    function loadOccupancyPoints(projectId: number) {
        setLoadingOccupancyPoints(true);
        fetch("/api/blindaje/occupancy-points?project_id=" + projectId)
            .then((r) => (r.ok ? r.json() : { occupancy_points: [] }))
            .then((data) => setOccupancyPointsList(data.occupancy_points ?? []))
            .finally(() => setLoadingOccupancyPoints(false));
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
        setMazeForm(EMPTY_MAZE_FORM);
        setMazeError(null);
        loadMazes(p.id);
        setSlabForm(EMPTY_SLAB_FORM);
        setSlabError(null);
        loadSlabs(p.id);
        setOccupancyPointForm(EMPTY_OCCUPANCY_POINT_FORM);
        setOccupancyPointError(null);
        loadOccupancyPoints(p.id);
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
      function updateMazeField(key: string, value: string) {
          setMazeForm((f) => ({ ...f, [key]: value }));
      }
    function updateSlabField(key: string, value: string) {
              setSlabForm((f) => ({ ...f, [key]: value }));
    }
    
    function updateOccupancyPointField(key: string, value: string) {
        setOccupancyPointForm((f) => ({ ...f, [key]: value }));
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
                    result_value: barrierForm.result_value,
                    result_unit: barrierForm.result_unit,
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

function calcularBarreraBraquiterapiaClick() {
    if (!selectedProject) return;
    setBarrierError(null);
    if (!barrierForm.pir_id) { setBarrierError("Seleccione un PIR asociado antes de calcular."); return; }
    const pir = pirList.find((p) => String(p.id) === String(barrierForm.pir_id));
    if (!pir) { setBarrierError("PIR asociado no encontrado."); return; }
    if (!pir.distance_m || !pir.occupancy_factor || !pir.design_criterion_value) {
      setBarrierError("El PIR asociado debe tener distancia, factor de ocupacion y valor de criterio de diseno (P) definidos.");
      return;
    }
    if (sourcesList.length === 0) { setBarrierError("Registre al menos una fuente (actividad total de las fuentes cargadas) antes de calcular."); return; }
    if (workloadList.length === 0) { setBarrierError("Registre la carga de trabajo (modo Braquiterapia SRS-47, con duracion y tratamientos/semana) antes de calcular."); return; }
    const source = sourcesList[0];
    const workload = workloadList[0];
    if (!source || !workload) { setBarrierError("Fuente o carga de trabajo no disponibles."); return; }
    const wd = (workload.data || {}) as Record<string, any>;
    const tH = parseFloat(wd.treatment_duration_h);
    const nSemana = parseFloat(wd.procedures_per_week);
    if (!tH || !nSemana) { setBarrierError("La carga de trabajo (modo Braquiterapia) debe indicar Duracion promedio del tratamiento y Procedimientos/sesiones por semana."); return; }
    const nuclido = NUCLEIDOS_TABLA20.find((n) => n.nucleido === source.radionuclide);
    if (!nuclido) { setBarrierError("Radionuclido de la fuente no reconocido en la Tabla 20 SRS-47. Seleccione uno de la lista en Fuentes."); return; }
    if (!source.activity) { setBarrierError("La fuente debe tener actividad total definida."); return; }
    const unit = (source.activity_unit || "MBq").trim().toLowerCase();
    let activityMBq = Number(source.activity);
    if (unit === "gbq") activityMBq = activityMBq * 1000;
    else if (unit === "ci") activityMBq = activityMBq * 37000;
    else if (unit === "mci") activityMBq = activityMBq * 37;
    else if (unit === "kbq") activityMBq = activityMBq / 1000;
    const material = barrierForm.material;
    const tvlRow = HVL_TVL_TABLA22.find((r) => r.nucleido === source.radionuclide);
    if (!tvlRow) { setBarrierError("No hay datos de TVL (Tabla 22 SRS-47) para este radionuclido."); return; }
    let tvlMm: number | null = null;
    if (material === "Hormigon") tvlMm = tvlRow.hormigonTvlMm;
    else if (material === "Plomo") tvlMm = tvlRow.plomoTvlMm;
    else if (material === "Acero") tvlMm = tvlRow.aceroTvlMm;
    if (!tvlMm) { setBarrierError("No hay valor de TVL disponible para " + material + " con " + source.radionuclide + " en la Tabla 22 SRS-47. Elija otro material."); return; }
    const pRaw = Number(pir.design_criterion_value);
    const pUnit = (pir.design_criterion_unit || "").trim().toLowerCase();
    let pUGySemana: number | null = null;
    if (pUnit.indexOf("usv") !== -1 || pUnit.indexOf("ugy") !== -1) pUGySemana = pRaw;
    else if (pUnit.indexOf("msv") !== -1 || pUnit.indexOf("mgy") !== -1) pUGySemana = pRaw * 1000;
    if (pUGySemana === null) {
      setBarrierError("Indique la unidad del criterio de diseno del PIR (design_criterion_unit) en uSv/semana, uGy/semana, mSv/semana o mGy/semana para poder calcular.");
      return;
    }
    const w = calcularCargaTrabajoBraquiterapiaViaRAKR(nuclido.rakrUGyMBqM2H, activityMBq, tH, nSemana);
    const b = calcularFactorTransmisionBarreraBraquiterapiaSemanal(pUGySemana, Number(pir.distance_m), w, Number(pir.occupancy_factor));
    const nTVL = calcularNumeroTVL(b);
    const espesorMm = calcularEspesorBarreraBraquiterapia(nTVL, tvlMm);
    updateBarrierField("thickness_required_cm", (espesorMm / 10).toFixed(1));
    updateBarrierField("result_value", b.toExponential(3));
    updateBarrierField("result_unit", "B (adimensional); n=" + nTVL.toFixed(2) + " TVL; W=" + w.toExponential(3) + " uGy*m2/sem (SRS-47 Ec.33/37, NCRP151 Ec.2.2)");
    updateBarrierField("result_status", "revisar");
}

    function calcularBarreraPrimariaAceleradorClick() {
        if (!selectedProject) return;
        setBarrierError(null);
        if (barrierForm.barrier_type !== "primaria") { setBarrierError("Esta calculadora aplica a barrera primaria (NCRP151 Ec. 2.1-2.3). Seleccione Tipo de barrera = Primaria."); return; }
        if (!barrierForm.pir_id) { setBarrierError("Seleccione un PIR asociado antes de calcular."); return; }
        const pir = pirList.find((p) => String(p.id) === String(barrierForm.pir_id));
        if (!pir) { setBarrierError("PIR asociado no encontrado."); return; }
        if (!pir.distance_m || !pir.occupancy_factor || !pir.design_criterion_value) { setBarrierError("El PIR asociado debe tener distancia, factor de ocupacion y valor de criterio de diseno (P) definidos."); return; }
        if (sourcesList.length === 0) { setBarrierError("Registre al menos una fuente (energia nominal del haz, Paso 4) antes de calcular."); return; }
        if (workloadList.length === 0) { setBarrierError("Registre la carga de trabajo (W, en Gy/semana a 1 m del isocentro) antes de calcular."); return; }
        if (!barrierForm.material) { setBarrierError("Seleccione el material de la barrera antes de calcular."); return; }
        if (!barrierForm.use_factor) { setBarrierError("Indique el factor de uso (U) de la barrera antes de calcular."); return; }
        const source = sourcesList[0];
        const workload = workloadList[0];
        if (!source || !workload) { setBarrierError("Fuente o carga de trabajo no disponibles."); return; }
        const wd = (workload.data || {}) as Record<string, any>;
        const wGySemana = parseFloat(wd.workload_value);
        if (!wGySemana) { setBarrierError("La carga de trabajo debe tener un valor numerico interpretado como Gy/semana a 1 m (NCRP151 Ec. 2.1)."); return; }
        const energia = (source.energy || "").trim();
        const material = barrierForm.material;
        const tvlRow = obtenerTVLBarreraPrimaria(energia, material as any);
        if (!tvlRow) { setBarrierError("No hay datos de TVL (Tabla B.2 NCRP151) para energia '" + energia + "' y material '" + material + "'. Verifique que la energia de la fuente (Paso 4) este seleccionada de la lista NCRP151 y que el material coincida."); return; }
        const pRaw = Number(pir.design_criterion_value);
        const pUnit = (pir.design_criterion_unit || "").trim().toLowerCase();
        let pSvSemana: number | null = null;
        if (pUnit.indexOf("usv") !== -1) pSvSemana = pRaw / 1e6;
        else if (pUnit.indexOf("msv") !== -1) pSvSemana = pRaw / 1000;
        else if (pUnit.indexOf("sv/semana") !== -1) pSvSemana = pRaw;
        if (pSvSemana === null) { setBarrierError("Indique la unidad del criterio de diseno del PIR en Sv/semana, mSv/semana o uSv/semana para poder calcular (NCRP151 Ec. 2.1 usa P en Sv/semana)."); return; }
        const u = Number(barrierForm.use_factor);
        const t = Number(pir.occupancy_factor);
        const b = calcularFactorTransmisionBarreraPrimaria(pSvSemana, Number(pir.distance_m), wGySemana, u, t);
        const n = calcularNumeroTVL(b);
        const resultado = calcularEspesorBarrera(n, tvlRow.tvl1Cm, tvlRow.tvleCm);
        updateBarrierField("thickness_required_cm", resultado.espesorCm.toFixed(1));
        updateBarrierField("result_value", b.toExponential(3));
        updateBarrierField("result_unit", "B (adimensional); n=" + n.toFixed(2) + " TVL; W=" + wGySemana.toExponential(3) + " Gy/sem a 1m (NCRP151 Ec.2.1-2.3)" + (resultado.aproximacionNMenorQueUno ? "; ADVERTENCIA: n<1, espesor aproximado, revisar con Fisico Medico" : "") + ". Cubre solo barrera PRIMARIA; barrera secundaria (dispersion Ec.2.7, fuga Ec.2.8) pendiente para una fase posterior.");
        updateBarrierField("result_status", "revisar");
    }

function calcularBarreraSecundariaAceleradorClick() {
        if (!selectedProject) return;
        setBarrierError(null);
        if (barrierForm.barrier_type !== "secundaria") { setBarrierError("Esta calculadora aplica a barrera secundaria (NCRP151 Ec. 2.7, 2.8 y regla de las dos fuentes). Seleccione Tipo de barrera = Secundaria."); return; }
        if (!barrierForm.pir_id) { setBarrierError("Seleccione un PIR asociado antes de calcular."); return; }
        const pir = pirList.find((p) => String(p.id) === String(barrierForm.pir_id));
        if (!pir) { setBarrierError("PIR asociado no encontrado."); return; }
        if (!pir.distance_m || !pir.occupancy_factor || !pir.design_criterion_value) { setBarrierError("El PIR asociado debe tener distancia, factor de ocupacion y valor de criterio de diseno (P) definidos."); return; }
        if (sourcesList.length === 0) { setBarrierError("Registre al menos una fuente (energia nominal del haz, Paso 4) antes de calcular."); return; }
        if (workloadList.length === 0) { setBarrierError("Registre la carga de trabajo (W, en Gy/semana a 1 m del isocentro) antes de calcular."); return; }
        if (barrierForm.material !== "hormigon") { setBarrierError("Esta calculadora de barrera secundaria solo cubre HORMIGON: la Tabla B.7 NCRP151 (fuga) no reporta datos para plomo ni acero. Seleccione Material = hormigon, o consulte a un Fisico Medico para otros materiales."); return; }
        if (!barrierForm.scatter_angle_grados) { setBarrierError("Seleccione el angulo de dispersion (Tablas B.4/B.5a NCRP151)."); return; }
        if (!barrierForm.dsca_m) { setBarrierError("Indique la distancia objetivo-paciente dsca (m), tipicamente ~1 m (DFI/SAD)."); return; }
        const source = sourcesList[0];
        const workload = workloadList[0];
        if (!source || !workload) { setBarrierError("Fuente o carga de trabajo no disponibles."); return; }
        const wd = (workload.data || {}) as Record<string, any>;
        const wGySemana = parseFloat(wd.workload_value);
        if (!wGySemana) { setBarrierError("La carga de trabajo debe tener un valor numerico interpretado como Gy/semana a 1 m (NCRP151 Ec. 2.1)."); return; }
        const energia = (source.energy || "").trim();
        if (["6", "10", "18"].indexOf(energia) === -1) { setBarrierError("Esta calculadora de barrera secundaria solo cubre energias 6, 10 y 18 MV: son las unicas que tienen simultaneamente datos de fraccion de dispersion (Tabla B.4) y TVL de dispersion en hormigon (Tabla B.5a) dentro del conjunto de energias seleccionables en Paso 4 (Tabla B.2). Para otras energias, consulte a un Fisico Medico."); return; }
        const angulo = Number(barrierForm.scatter_angle_grados);
        const filaFraccion = FRACCION_DISPERSION_PACIENTE_NCRP151.find((f) => f.anguloGrados === angulo);
        if (!filaFraccion) { setBarrierError("No hay datos de fraccion de dispersion (Tabla B.4 NCRP151) para el angulo " + angulo + " grados."); return; }
        const aFraccion = energia === "6" ? filaFraccion.a6MV : energia === "10" ? filaFraccion.a10MV : filaFraccion.a18MV;
        const filaTvlDispersion = TVL_DISPERSION_PACIENTE_HORMIGON_NCRP151.find((f) => f.anguloGrados === angulo);
        if (!filaTvlDispersion) { setBarrierError("No hay datos de TVL de dispersion en hormigon (Tabla B.5a NCRP151) para el angulo " + angulo + " grados."); return; }
        const tvlDispersionCm = energia === "6" ? filaTvlDispersion.mv6Cm : energia === "10" ? filaTvlDispersion.mv10Cm : filaTvlDispersion.mv18Cm;
        const filaFuga = obtenerTVLFugaHormigon(energia);
        if (!filaFuga) { setBarrierError("No hay datos de TVL de fuga en hormigon (Tabla B.7 NCRP151) para energia '" + energia + "'."); return; }
        const pRaw = Number(pir.design_criterion_value);
        const pUnit = (pir.design_criterion_unit || "").trim().toLowerCase();
        let pSvSemana: number | null = null;
        if (pUnit.indexOf("usv") !== -1) pSvSemana = pRaw / 1e6;
        else if (pUnit.indexOf("msv") !== -1) pSvSemana = pRaw / 1000;
        else if (pUnit.indexOf("sv/semana") !== -1) pSvSemana = pRaw;
        if (pSvSemana === null) { setBarrierError("Indique la unidad del criterio de diseno del PIR en Sv/semana, mSv/semana o uSv/semana para poder calcular (NCRP151 Ec. 2.7/2.8 usan P en Sv/semana)."); return; }
        const t = Number(pir.occupancy_factor);
        const dSecM = Number(pir.distance_m);
        const dScaM = Number(barrierForm.dsca_m);
        const dLM = dSecM;
        const bPs = calcularFactorTransmisionDispersionPaciente(pSvSemana, dScaM, dSecM, aFraccion, wGySemana, t);
        const nPs = calcularNumeroTVL(bPs);
        const resultadoPs = calcularEspesorBarrera(nPs, tvlDispersionCm, tvlDispersionCm);
        const bL = calcularFactorTransmisionFuga(pSvSemana, dLM, wGySemana);
        const nL = calcularNumeroTVL(bL);
        const resultadoL = calcularEspesorBarrera(nL, filaFuga.tvl1Cm, filaFuga.tvleCm);
        const tvlMasPenetranteCm = Math.max(tvlDispersionCm, filaFuga.tvleCm);
        const hvlCm = 0.301 * tvlMasPenetranteCm;
        const combinado = combinarBarreraSecundariaDosFuentes(resultadoPs.espesorCm, resultadoL.espesorCm, hvlCm, tvlMasPenetranteCm);
        if (combinado.espesorFinalCm === null) {
                    updateBarrierField("result_value", "");
                    updateBarrierField("result_unit", "SIN RESULTADO NUMERICO: " + combinado.detalle);
                    updateBarrierField("result_status", "revisar");
                    setBarrierError(combinado.detalle);
                    return;
        }
        updateBarrierField("thickness_required_cm", combinado.espesorFinalCm.toFixed(1));
        updateBarrierField("result_value", combinado.espesorFinalCm.toFixed(1));
        updateBarrierField("result_unit", "Dispersion paciente: Bps=" + bPs.toExponential(3) + ", n=" + nPs.toFixed(2) + " TVL, espesor=" + resultadoPs.espesorCm.toFixed(1) + " cm (Ec.2.7; Tabla B.5a usa un unico TVL como TVL1 y TVLe). Fuga cabezal: BL=" + bL.toExponential(3) + ", n=" + nL.toFixed(2) + " TVL, espesor=" + resultadoL.espesorCm.toFixed(1) + " cm (Ec.2.8, fuga asumida 0.1% segun IEC). Combinacion (regla de las dos fuentes, NCRP151 Sec.2.3): " + combinado.criterio + " - " + combinado.detalle + ". Supuestos: campo F=400 cm2 a 1m (referencia 20x20cm), dsec=dL=distancia del PIR (" + dSecM + " m). Cobertura de datos: solo hormigon y energias 6/10/18 MV (limite de Tablas B.4, B.5a y B.7 NCRP151).");
        updateBarrierField("result_status", "revisar");
}
    
function calcularBarreraPrimariaDiagnosticoNCRP147Click() { if (!selectedProject) return; setBarrierError(null); if (barrierForm.barrier_type !== "primaria") { setBarrierError("Esta calculadora aplica a barrera primaria (NCRP147, Apendice B, Tablas 4.5 y B.1). Seleccione Tipo de barrera = Primaria."); return; } if (!barrierForm.pir_id) { setBarrierError("Seleccione un PIR asociado antes de calcular."); return; } const pir = pirList.find((p) => String(p.id) === String(barrierForm.pir_id)); if (!pir) { setBarrierError("PIR asociado no encontrado."); return; } if (!pir.distance_m || !pir.occupancy_factor || !pir.design_criterion_value) { setBarrierError("El PIR asociado debe tener distancia, factor de ocupacion y valor de criterio de diseno (P) definidos."); return; } if (workloadList.length === 0) { setBarrierError("Registre la carga de trabajo (Procedimientos/pacientes por semana) antes de calcular."); return; } if (!barrierForm.material) { setBarrierError("Seleccione el material de la barrera antes de calcular."); return; } if (!barrierForm.use_factor) { setBarrierError("Indique el factor de uso (U) de la barrera antes de calcular."); return; } if (!barrierForm.distribucion_carga_ncrp147) { setBarrierError("Seleccione la distribucion de carga de trabajo (Tabla 4.5 / B.1 NCRP147) antes de calcular."); return; } const distribucion = barrierForm.distribucion_carga_ncrp147 as DistribucionCargaTrabajoNCRP147; const filaK1 = TABLA_4_5_KERMA_PRIMARIO_NO_BLINDADO[distribucion]; if (!filaK1) { setBarrierError("La distribucion de carga seleccionada no genera barrera PRIMARIA segun NCRP147 (Tabla 4.5): esas modalidades usan el receptor de imagen como tope de haz y solo requieren blindaje secundario. Elija Sala Rx (bucky de torax), Sala Rx (piso u otras barreras), Tubo de Rx (sala R&F) o Sala de torax, o cambie el Tipo de barrera a Secundaria."); return; } const material = materialNCRP147DesdeEtiqueta(barrierForm.material); if (!material) { setBarrierError("Material no reconocido en la Tabla B.1 de NCRP147 para imagenologia diagnostica."); return; } const coeficientes = TABLA_B1_TRANSMISION_PRIMARIA_POR_CARGA[distribucion][material]; if (!coeficientes) { setBarrierError("No hay coeficientes de transmision (Tabla B.1 NCRP147) para " + material + " en esta distribucion de carga."); return; } const workload = workloadList[0]; if (!workload) { setBarrierError("Carga de trabajo no disponible."); return; } const wd = (workload.data || {}) as Record<string, any>; const nSemana = parseFloat(wd.procedures_per_week); if (!nSemana) { setBarrierError("La carga de trabajo debe indicar Procedimientos/pacientes por semana (N)."); return; } const pUnit = (pir.design_criterion_unit || "").trim().toLowerCase(); if (pUnit.indexOf("mgy") === -1) { setBarrierError("Esta calculadora requiere que el criterio de diseno (P) del PIR este en mGy/semana (kerma en aire, opcion NCRP147 verificada). Seleccione esa opcion en el criterio de diseno del PIR (Paso 6)."); return; } const pMGySemana = Number(pir.design_criterion_value); const u = Number(barrierForm.use_factor); const t = Number(pir.occupancy_factor); const resultado = calcularBarreraPrimariaNCRP147({ k1PmGyPorPacienteA1m: filaK1.k1PmGyPorPacienteA1m, nPacientesPorSemana: nSemana, factorUsoU: u, distanciaMetros: Number(pir.distance_m), objetivoDisenoPmGyPorSemana: pMGySemana, factorOcupacionT: t, coeficientes: coeficientes }); updateBarrierField("thickness_required_cm", (resultado.espesorRequeridoMm / 10).toFixed(2)); updateBarrierField("result_value", resultado.transmisionRequerida.toExponential(3)); updateBarrierField("result_unit", "B (transmision primaria)=" + resultado.transmisionRequerida.toExponential(3) + "; K(0)=" + resultado.kermaNoAtenuadoMGyPorSemana.toExponential(3) + " mGy/sem a " + pir.distance_m + " m (NCRP147 Apendice B, Ec.B.6/B.8/B.9; Tabla 4.5 K1_P=" + filaK1.k1PmGyPorPacienteA1m + " mGy/paciente a 1m, Wnorm=" + filaK1.wNormMAminPorPaciente + " mA-min/paciente, pag.43; Tabla B.1 coeficientes por distribucion de carga, pag.133-134). Distribucion: " + distribucion + ". Material: " + material + "."); updateBarrierField("result_status", "revisar"); } function calcularBarreraSecundariaDiagnosticoNCRP147Click() { if (!selectedProject) return; setBarrierError(null); if (barrierForm.barrier_type !== "secundaria") { setBarrierError("Esta calculadora aplica a barrera secundaria (NCRP147, Apendice C, Tablas 4.7 y C.1). Seleccione Tipo de barrera = Secundaria."); return; } if (!barrierForm.pir_id) { setBarrierError("Seleccione un PIR asociado antes de calcular."); return; } const pir = pirList.find((p) => String(p.id) === String(barrierForm.pir_id)); if (!pir) { setBarrierError("PIR asociado no encontrado."); return; } if (!pir.distance_m || !pir.occupancy_factor || !pir.design_criterion_value) { setBarrierError("El PIR asociado debe tener distancia, factor de ocupacion y valor de criterio de diseno (P) definidos."); return; } if (workloadList.length === 0) { setBarrierError("Registre la carga de trabajo (Procedimientos/pacientes por semana) antes de calcular."); return; } if (!barrierForm.material) { setBarrierError("Seleccione el material de la barrera antes de calcular."); return; } if (!barrierForm.distribucion_carga_ncrp147) { setBarrierError("Seleccione la distribucion de carga de trabajo (Tabla 4.7 / C.1 NCRP147) antes de calcular."); return; } if (!barrierForm.componente_dispersion_ncrp147) { setBarrierError("Seleccione el componente de radiacion secundaria (lateral 90 grados, o frontal/trasera 135/30 grados) antes de calcular."); return; } const distribucion = barrierForm.distribucion_carga_ncrp147 as DistribucionCargaTrabajoNCRP147; const filaK1 = TABLA_4_7_KERMA_SECUNDARIO_NO_BLINDADO[distribucion]; if (!filaK1) { setBarrierError("No hay datos de Tabla 4.7 para esta distribucion de carga."); return; } const material = materialNCRP147DesdeEtiqueta(barrierForm.material); if (!material) { setBarrierError("Material no reconocido en la Tabla C.1 de NCRP147 para imagenologia diagnostica."); return; } const coeficientes = TABLA_C1_TRANSMISION_SECUNDARIA_POR_CARGA[distribucion][material]; if (!coeficientes) { setBarrierError("No hay coeficientes de transmision (Tabla C.1 NCRP147) para " + material + " en esta distribucion de carga."); return; } const k1Sec = barrierForm.componente_dispersion_ncrp147 === "lateral" ? filaK1.fugaMasLateralMGyPorPaciente : filaK1.fugaMasFrontalTraseraMGyPorPaciente; const workload = workloadList[0]; if (!workload) { setBarrierError("Carga de trabajo no disponible."); return; } const wd = (workload.data || {}) as Record<string, any>; const nSemana = parseFloat(wd.procedures_per_week); if (!nSemana) { setBarrierError("La carga de trabajo debe indicar Procedimientos/pacientes por semana (N)."); return; } const pUnit = (pir.design_criterion_unit || "").trim().toLowerCase(); if (pUnit.indexOf("mgy") === -1) { setBarrierError("Esta calculadora requiere que el criterio de diseno (P) del PIR este en mGy/semana (kerma en aire, opcion NCRP147 verificada). Seleccione esa opcion en el criterio de diseno del PIR (Paso 6)."); return; } const pMGySemana = Number(pir.design_criterion_value); const t = Number(pir.occupancy_factor); const resultado = calcularBarreraSecundariaNCRP147({ k1SecMGyPorPacienteA1m: k1Sec, nPacientesPorSemana: nSemana, distanciaMetros: Number(pir.distance_m), objetivoDisenoPmGyPorSemana: pMGySemana, factorOcupacionT: t, coeficientes: coeficientes }); updateBarrierField("thickness_required_cm", (resultado.espesorRequeridoMm / 10).toFixed(2)); updateBarrierField("result_value", resultado.transmisionRequerida.toExponential(3)); updateBarrierField("result_unit", "B (transmision secundaria, fuga+dispersion)=" + resultado.transmisionRequerida.toExponential(3) + "; K(0)=" + resultado.kermaNoAtenuadoMGyPorSemana.toExponential(3) + " mGy/sem a " + pir.distance_m + " m (NCRP147 Apendice C, Ec.C.13/C.15; Tabla 4.7 K1_sec=" + k1Sec.toExponential(3) + " mGy/paciente a 1m, componente " + barrierForm.componente_dispersion_ncrp147 + ", pag.46-47; Tabla C.1 coeficientes por distribucion de carga, pag.147-148). Distribucion: " + distribucion + ". Material: " + material + ". Supuesto: fuga+dispersion evaluadas a la misma distancia dsec=dL=distancia del PIR."); updateBarrierField("result_status", "revisar"); } function calcularLaberintoBajaEnergiaClick() { if (!selectedProject) return; setMazeError(null); if (selectedProject.facility_type !== "radioterapia") { setMazeError("Esta calculadora aplica solo a radioterapia (NCRP151 Sec. 2.4.1, Ecs. 2.9-2.14, aceleradores <=10 MV o Co-60)."); return; } if (sourcesList.length === 0) { setMazeError("Registre al menos una fuente (energia nominal del haz, Paso 4) antes de calcular."); return; } if (workloadList.length === 0) { setMazeError("Registre la carga de trabajo (W, en Gy/semana a 1 m del isocentro) antes de calcular."); return; } const source = sourcesList[0]; const workload = workloadList[0]; if (!source || !workload) { setMazeError("Fuente o carga de trabajo no disponibles."); return; } const energia = (source.energy || "").trim(); if (["4", "6", "10", "Co-60"].indexOf(energia) === -1) { setMazeError("Esta calculadora de laberinto de baja energia solo cubre energias <=10 MV o Co-60 (4, 6, 10 MV, Co-60, segun Tabla B.2 NCRP151). Para energias mayores, el metodo de alta energia/neutrones (Ecs. 2.15-2.22) queda pendiente para una fase posterior."); return; } const wd = (workload.data || {}) as Record<string, any>; const wGySemana = parseFloat(wd.workload_value); if (!wGySemana) { setMazeError("La carga de trabajo debe tener un valor numerico interpretado como Gy/semana a 1 m (NCRP151 Ec. 2.1)."); return; } const camposRequeridos = ["ug", "alfa0", "a0_m2", "alfaz", "az_m2", "dh_m", "dr_m", "dz_m", "wl_gy_semana", "alfa1", "a1_m2", "dsec_m", "dzz_m", "dl_m", "b_pared_z", "f_transmision_paciente"]; for (const c of camposRequeridos) { if (!(mazeForm as any)[c]) { setMazeError("Complete el campo '" + c + "' antes de calcular (NCRP151 Sec. 2.4.1, Ecs. 2.9-2.14)."); return; } } const uG = Number(mazeForm.ug); const alfa0 = Number(mazeForm.alfa0); const a0M2 = Number(mazeForm.a0_m2); const alfaZ = Number(mazeForm.alfaz); const azM2 = Number(mazeForm.az_m2); const dhM = Number(mazeForm.dh_m); const drM = Number(mazeForm.dr_m); const dzM = Number(mazeForm.dz_m); const wlGySemana = Number(mazeForm.wl_gy_semana); const alfa1 = Number(mazeForm.alfa1); const a1M2 = Number(mazeForm.a1_m2); const dsecM = Number(mazeForm.dsec_m); const dzzM = Number(mazeForm.dzz_m); const dLM = Number(mazeForm.dl_m); const bParedZ = Number(mazeForm.b_pared_z); const fTransmisionPaciente = Number(mazeForm.f_transmision_paciente); const hs = calcularDispersionParedGLaberinto({ wGySemana, uG, alfa0, a0M2, alfaZ, azM2, dhM, drM, dzM }); const hls = calcularFugaDispersaCabezaLaberinto({ wlGySemana, uG, alfa1, a1M2, dsecM, dzzM }); const hlt = calcularFugaTransmitidaLaberinto({ wlGySemana, uG, b: bParedZ, dLM }); const hps = 0; const hg = calcularDosisTotalParedG(fTransmisionPaciente, hs, hls, hps, hlt); let geometria: { dzM: number; alturaLaberintoM: number; anchoLaberintoM: number } | undefined = undefined; if (mazeForm.maze_width_cm && mazeForm.maze_height_cm) { geometria = { dzM, alturaLaberintoM: Number(mazeForm.maze_height_cm) / 100, anchoLaberintoM: Number(mazeForm.maze_width_cm) / 100 }; } const resultado = calcularDosisTotalLaberintoBajaEnergia(hg, geometria); updateMazeField("result_value", resultado.hTotSvSemana.toExponential(3)); updateMazeField("result_unit", "HTot (Sv/semana) en la puerta del laberinto = 2.64*HG (NCRP151 Ec.2.9-2.14, Sec.2.4.1, <=10MV o Co-60). HS=" + hs.toExponential(3) + ", HLS=" + hls.toExponential(3) + ", HLT=" + hlt.toExponential(3) + " Sv/semana. ADVERTENCIA (S24, nunca ocultar): Hps (Ec.2.11, dispersion del paciente hacia el laberinto) se fijo en 0 en este calculo, NO fue evaluada; si el laberinto es corto o el haz frecuentemente apunta a la Pared G este componente puede ser significativo y requiere calculo manual adicional por un Fisico Medico. El metodo de alta energia/neutrones (Ecs.2.15-2.22, Kersey) y el diseno de espesor de la puerta (Sec.2.4.3-2.4.5) quedan PENDIENTES para energias >10 MV o para una fase posterior." + (resultado.advertenciaValidezGeometria ? " ADVERTENCIA DE VALIDEZ GEOMETRICA: " + resultado.advertenciaValidezGeometria : "")); updateMazeField("result_status", "revisar"); } function calcularLaberintoAltaEnergiaClick() { if (!selectedProject) return; setMazeError(null); if (selectedProject.facility_type !== "radioterapia") { setMazeError("Esta calculadora aplica solo a radioterapia (NCRP151 Sec. 2.4.2, Ecs. 2.15-2.22, aceleradores >10 MV)."); return; } if (sourcesList.length === 0) { setMazeError("Registre al menos una fuente (energia nominal del haz, Paso 4) antes de calcular."); return; } if (workloadList.length === 0) { setMazeError("Registre la carga de trabajo (W, en Gy/semana a 1 m del isocentro) antes de calcular."); return; } const source = sourcesList[0]; const workload = workloadList[0]; if (!source || !workload) { setMazeError("Fuente o carga de trabajo no disponibles."); return; } const energia = (source.energy || "").trim(); const energiaNum = parseFloat(energia); if (!energiaNum || energiaNum <= 10) { setMazeError("Esta calculadora de laberinto de alta energia solo cubre fotones >10 MV (NCRP151 Sec. 2.4.2, Ecs. 2.15-2.22, fotoneutrones y rayos gamma de captura de neutrones)."); return; } const wd = (workload.data || {}) as Record<string, any>; const wGySemana = parseFloat(wd.workload_value); if (!wGySemana) { setMazeError("La carga de trabajo debe tener un valor numerico interpretado como Gy/semana a 1 m (NCRP151 Ec. 2.1)."); return; } const camposRequeridos = ["ug", "alfa0", "a0_m2", "alfaz", "az_m2", "dh_m", "dr_m", "dz_m", "wl_gy_semana", "alfa1", "a1_m2", "dsec_m", "dzz_m", "dl_m", "b_pared_z", "f_transmision_paciente", "beta_neutrones", "d1_m", "sr_m2", "qn_x1e12", "s0_m2", "s1_m2", "d2_m"]; for (const c of camposRequeridos) { if (!(mazeForm as any)[c]) { setMazeError("Complete el campo '" + c + "' antes de calcular (NCRP151 Sec. 2.4.2, Ecs. 2.15-2.22)."); return; } } const uG = Number(mazeForm.ug); const alfa0 = Number(mazeForm.alfa0); const a0M2 = Number(mazeForm.a0_m2); const alfaZ = Number(mazeForm.alfaz); const azM2 = Number(mazeForm.az_m2); const dhM = Number(mazeForm.dh_m); const drM = Number(mazeForm.dr_m); const dzM = Number(mazeForm.dz_m); const wlGySemana = Number(mazeForm.wl_gy_semana); const alfa1 = Number(mazeForm.alfa1); const a1M2 = Number(mazeForm.a1_m2); const dsecM = Number(mazeForm.dsec_m); const dzzM = Number(mazeForm.dzz_m); const dLM = Number(mazeForm.dl_m); const bParedZ = Number(mazeForm.b_pared_z); const fTransmisionPaciente = Number(mazeForm.f_transmision_paciente); const betaNeutrones = Number(mazeForm.beta_neutrones); const d1M = Number(mazeForm.d1_m); const srM2 = Number(mazeForm.sr_m2); const qnNeutronesPorGy = Number(mazeForm.qn_x1e12) * 1e12; const s0M2 = Number(mazeForm.s0_m2); const s1M2 = Number(mazeForm.s1_m2); const d2M = Number(mazeForm.d2_m); const hs = calcularDispersionParedGLaberinto({ wGySemana, uG, alfa0, a0M2, alfaZ, azM2, dhM, drM, dzM }); const hls = calcularFugaDispersaCabezaLaberinto({ wlGySemana, uG, alfa1, a1M2, dsecM, dzzM }); const hlt = calcularFugaTransmitidaLaberinto({ wlGySemana, uG, b: bParedZ, dLM }); const hps = 0; const hg = calcularDosisTotalParedG(fTransmisionPaciente, hs, hls, hps, hlt); let geometria: { dzM: number; alturaLaberintoM: number; anchoLaberintoM: number } | undefined = undefined; if (mazeForm.maze_width_cm && mazeForm.maze_height_cm) { geometria = { dzM, alturaLaberintoM: Number(mazeForm.maze_height_cm) / 100, anchoLaberintoM: Number(mazeForm.maze_width_cm) / 100 }; } const resultadoBaja = calcularDosisTotalLaberintoBajaEnergia(hg, geometria); const phiA = calcularFluenciaNeutronesUbicacionA(qnNeutronesPorGy, betaNeutrones, d1M, srM2); const tvdGammaM = energiaNum <= 16 ? NCRP151_TVD_GAMMA_CAPTURA_M.de15MV : NCRP151_TVD_GAMMA_CAPTURA_M.de18a25MV; const h = calcularDosisGammaCapturaEnPuerta(NCRP151_K_GAMMA_CAPTURA_SV_M2, phiA, d2M, tvdGammaM); const hcg = calcularDosisGammaCapturaPuerta(wlGySemana, h); const hnD = calcularDosisNeutronesKerseyModificado(phiA, s0M2, s1M2, d2M); const hn = calcularDosisNeutronesPuertaSemanal(wlGySemana, hnD); const hw = calcularDosisTotalPuertaAltaEnergia(resultadoBaja.hTotSvSemana, hcg, hn); updateMazeField("result_value_alta_energia", hw.toExponential(3)); updateMazeField("result_unit_alta_energia", "Hw (Sv/semana) en la puerta del laberinto = HTot + Hcg + Hn (NCRP151 Ec.2.22, Sec.2.4.2, >10MV). HTot=" + resultadoBaja.hTotSvSemana.toExponential(3) + " Sv/semana (Ec.2.14, con Hps=0 no evaluada), Hcg=" + hcg.toExponential(3) + " Sv/semana (h=" + h.toExponential(3) + " Sv/Gy, Ec.2.15, TVD gamma captura=" + tvdGammaM + "m segun energia nominal " + energia + "MV, Ec.2.17), Hn=" + hn.toExponential(3) + " Sv/semana (Hn,D=" + hnD.toExponential(3) + " Sv/Gy, metodo de Kersey MODIFICADO, Wu y McGinley 2003, Ec.2.19, confianza ALTA, Ec.2.21). ADVERTENCIA (S24, nunca ocultar): se usa el metodo de Kersey MODIFICADO (Ec.2.19), no el metodo de Kersey original (Ec.2.18, que requiere H0 medido por modelo especifico de acelerador, Tabla B.9); Hps (Ec.2.11, dispersion del paciente hacia el laberinto) se fijo en 0 dentro de HTot, no fue evaluada; la asignacion del TVD de rayos gamma de captura (5.4m para 18-25MV, 3.9m para 15MV, Ec.2.15) es una simplificacion basada solo en la energia nominal declarada, revisar contra el documento fuente si el acelerador tiene caracteristicas atipicas; el diseno de espesor de blindaje de la puerta (plomo/BPE, Sec.2.4.3-2.4.5) queda PENDIENTE para una fase posterior." + (resultadoBaja.advertenciaValidezGeometria ? " ADVERTENCIA DE VALIDEZ GEOMETRICA: " + resultadoBaja.advertenciaValidezGeometria : "")); updateMazeField("result_status", "revisar"); } function calcularEspesorPuertaLaberintoClick() { if (!selectedProject) return; setMazeError(null); if (selectedProject.facility_type !== "radioterapia") { setMazeError("Esta calculadora aplica solo a radioterapia (NCRP151 Sec. 2.4.3, TVL de plomo/BPE para la puerta del laberinto, >10MV)."); return; } if (sourcesList.length === 0) { setMazeError("Registre al menos una fuente (energia nominal del haz, Paso 4) antes de calcular."); return; } const source = sourcesList[0]; if (!source) { setMazeError("Fuente no disponible."); return; } const energia = (source.energy || "").trim(); const energiaNum = parseFloat(energia); if (!energiaNum || energiaNum <= 10) { setMazeError("Esta calculadora de espesor de puerta aplica solo a fotones >10 MV (NCRP151 Sec.2.4.2/2.4.3, fotoneutrones y rayos gamma de captura de neutrones)."); return; } const camposRequeridos = ["wl_gy_semana", "beta_neutrones", "d1_m", "sr_m2", "qn_x1e12", "s0_m2", "s1_m2", "d2_m", "p_diseno_puerta_sv_semana"]; for (const c of camposRequeridos) { if (!(mazeForm as any)[c]) { setMazeError("Complete el campo '" + c + "' antes de calcular (NCRP151 Sec. 2.4.2/2.4.3)."); return; } } const wlGySemana = Number(mazeForm.wl_gy_semana); const betaNeutrones = Number(mazeForm.beta_neutrones); const d1M = Number(mazeForm.d1_m); const srM2 = Number(mazeForm.sr_m2); const qnNeutronesPorGy = Number(mazeForm.qn_x1e12) * 1e12; const s0M2 = Number(mazeForm.s0_m2); const s1M2 = Number(mazeForm.s1_m2); const d2M = Number(mazeForm.d2_m); const pSvSemana = Number(mazeForm.p_diseno_puerta_sv_semana); const phiA = calcularFluenciaNeutronesUbicacionA(qnNeutronesPorGy, betaNeutrones, d1M, srM2); const tvdGammaM = energiaNum <= 16 ? NCRP151_TVD_GAMMA_CAPTURA_M.de15MV : NCRP151_TVD_GAMMA_CAPTURA_M.de18a25MV; const h = calcularDosisGammaCapturaEnPuerta(NCRP151_K_GAMMA_CAPTURA_SV_M2, phiA, d2M, tvdGammaM); const hcg = calcularDosisGammaCapturaPuerta(wlGySemana, h); const hnD = calcularDosisNeutronesKerseyModificado(phiA, s0M2, s1M2, d2M); const hn = calcularDosisNeutronesPuertaSemanal(wlGySemana, hnD); const bPlomo = pSvSemana / hcg; const nPlomo = calcularNumeroTVL(bPlomo); const espesorPlomoCm = nPlomo > 0 ? nPlomo * TVL_PLOMO_GAMMA_CAPTURA_PUERTA_CM : 0; const bBpe = pSvSemana / hn; const nBpe = calcularNumeroTVL(bBpe); const espesorBpeCm = nBpe > 0 ? nBpe * TVL_BPE_RECOMENDADO_CONSERVADOR_DISENO_PUERTA_CM : 0; updateMazeField("espesor_plomo_puerta_cm", espesorPlomoCm.toFixed(1)); updateMazeField("espesor_bpe_puerta_cm", espesorBpeCm.toFixed(1)); updateMazeField("result_unit_puerta", "Espesor de puerta de laberinto (NCRP151 Sec.2.4.3, aplicando el metodo general Ec.2.2/2.3 con TVL_plomo=" + TVL_PLOMO_GAMMA_CAPTURA_PUERTA_CM + "cm para rayos gamma de captura ~3.6-10MeV, TVL_BPE=" + TVL_BPE_RECOMENDADO_CONSERVADOR_DISENO_PUERTA_CM + "cm conservador 5% boro para neutrones ~100keV). PLOMO (gamma de captura): Bcg=" + bPlomo.toExponential(3) + ", n=" + nPlomo.toFixed(2) + " TVL, espesor=" + espesorPlomoCm.toFixed(1) + " cm, atenua Hcg=" + hcg.toExponential(3) + " Sv/semana (Ec.2.17) hasta P=" + pSvSemana.toExponential(3) + " Sv/semana. BPE (neutrones): Bn=" + bBpe.toExponential(3) + ", n=" + nBpe.toFixed(2) + " TVL, espesor=" + espesorBpeCm.toFixed(1) + " cm, atenua Hn=" + hn.toExponential(3) + " Sv/semana (Hn,D=" + hnD.toExponential(3) + " Sv/Gy, metodo de Kersey MODIFICADO, Ec.2.21) hasta el mismo P. Disposicion recomendada para laberintos largos (~8m o mas, Sec.2.4.4): plomo-BPE-plomo, con capa adicional de plomo interior 0.6-1.2cm (reduce energia de neutrones por dispersion inelastica, mejora eficacia del BPE) y plomo exterior opcional ~1.9cm si se requiere atenuar los gamma de captura del boro (478keV) generados por el BPE; frecuentemente el plomo exterior no es necesario si el laberinto es suficientemente largo (McCall, 1997). ADVERTENCIA CRITICA (S24, nunca ocultar): el texto revisado de NCRP151 NO especifica una ecuacion combinada explicita para dividir el objetivo de diseno P entre el componente gamma (Hcg) y el componente de neutrones (Hn) de la puerta; esta implementacion aplica, de forma conservadora, el P COMPLETO de manera INDEPENDIENTE a cada componente (reusando Ec.2.2/2.3 ya validadas en 'Calcular barrera primaria'), lo cual es MENOS estricto que dividir P entre ambos componentes. HTot (Ec.2.14) no se incluye en este dimensionamiento de puerta (el documento fuente indica que HTot es habitualmente un orden de magnitud menor que Hcg+Hn y por lo tanto insignificante en la practica, pero no fue omitido en el calculo de Hw de 'Calcular puerta de laberinto - alta energia'). Se recomienda verificacion de un Fisico Medico/OPR calificado y contraste contra las mediciones de la Tabla 2.1 NCRP151 (tecnicas convencional/apertura reducida/puerta de boro/puerta BPE) antes de uso clinico critico."); updateMazeField("result_status", "revisar"); } async function createMaterial(e: FormEvent) {
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
      async function createMaze(e: FormEvent) {
          e.preventDefault();
          if (!selectedProject) return;
          if (!mazeForm.code.trim() || !mazeForm.name.trim()) {
              setMazeError("El codigo y el nombre del laberinto son obligatorios.");
              return;
          }
          setSavingMaze(true);
          setMazeError(null);
          try {
              const res = await fetch("/api/blindaje/mazes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                      project_id: selectedProject.id,
                      barrier_id: mazeForm.barrier_id || null,
                      code: mazeForm.code,
                      name: mazeForm.name,
                      location: mazeForm.location,
                      leg_count: mazeForm.leg_count,
                      last_leg_length_m: mazeForm.last_leg_length_m,
                      maze_width_cm: mazeForm.maze_width_cm,
                      maze_height_cm: mazeForm.maze_height_cm,
                      wall_material: mazeForm.wall_material,
                      result_status: mazeForm.result_status,
                      source_document: mazeForm.source_document,
                      notes: mazeForm.notes,
                  }),
              });
              const data = await res.json();
              if (!res.ok || !data.ok) {
                  setMazeError(data.error || "No se pudo guardar el laberinto.");
                  return;
              }
              setMazeForm(EMPTY_MAZE_FORM);
              loadMazes(selectedProject.id);
          } finally {
              setSavingMaze(false);
          }
      }
    async function createSlab(e: FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        if (!slabForm.code.trim() || !slabForm.name.trim()) {
            setSlabError("El codigo y el nombre de la losa son obligatorios.");
            return;
        }
        setSavingSlab(true);
        setSlabError(null);
        try {
            const res = await fetch("/api/blindaje/slabs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: selectedProject.id,
                    barrier_id: slabForm.barrier_id || null,
                    code: slabForm.code,
                    name: slabForm.name,
                    location: slabForm.location,
                    slab_type: slabForm.slab_type,
                    thickness_cm: slabForm.thickness_cm,
                    material: slabForm.material,
                    occupancy_above: slabForm.occupancy_above,
                    distance_property_line_m: slabForm.distance_property_line_m,
                    result_status: slabForm.result_status,
                    source_document: slabForm.source_document,
                    notes: slabForm.notes,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setSlabError(data.error || "No se pudo guardar la losa.");
                return;
            }
            setSlabForm(EMPTY_SLAB_FORM);
            loadSlabs(selectedProject.id);
        } finally {
            setSavingSlab(false);
        }
    }
    
    async function createOccupancyPoint(e: FormEvent) {
        e.preventDefault();
        if (!selectedProject) return;
        if (!occupancyPointForm.code.trim() || !occupancyPointForm.name.trim()) {
            setOccupancyPointError("El codigo y el nombre del punto de ocupacion son obligatorios.");
            return;
        }
        setSavingOccupancyPoint(true);
        setOccupancyPointError(null);
        try {
            const res = await fetch("/api/blindaje/occupancy-points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: selectedProject.id,
                    barrier_id: occupancyPointForm.barrier_id || null,
                    code: occupancyPointForm.code,
                    name: occupancyPointForm.name,
                    location: occupancyPointForm.location,
                    occupancy_type: occupancyPointForm.occupancy_type,
                    occupancy_factor_t: occupancyPointForm.occupancy_factor_t,
                    distance_m: occupancyPointForm.distance_m,
                    beam_component: occupancyPointForm.beam_component,
                    result_status: occupancyPointForm.result_status,
                    source_document: occupancyPointForm.source_document,
                    notes: occupancyPointForm.notes,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setOccupancyPointError(data.error || "No se pudo guardar el punto de ocupacion.");
                return;
            }
            setOccupancyPointForm(EMPTY_OCCUPANCY_POINT_FORM);
            loadOccupancyPoints(selectedProject.id);
        } finally {
            setSavingOccupancyPoint(false);
        }
    }
    
    function sourceFieldInputs(facilityType: string) {
        const keys = SOURCE_FIELDS_BY_FACILITY[facilityType] || [];
        const labels = SOURCE_FIELD_LABELS[facilityType] || {};
        const inputs: any[] = [];
        keys.forEach((key) => {
                if (key === "activity") {
                          inputs.push(field(labels.activity || "Actividad", sourceForm.activity, (v) => updateSourceField("activity", v)));
                          inputs.push(h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Unidad de actividad", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: sourceForm.activity_unit, onChange: (e: any) => updateSourceField("activity_unit", e.target.value) }, [h("option", { key: "", value: "" }, "Seleccione...")].concat(ACTIVITY_UNIT_OPTIONS.map((o) => h("option", { key: o.value, value: o.value }, o.label))))));
                } else if (key === "dose_rate") {
                          inputs.push(field(labels.dose_rate || "Tasa de dosis", sourceForm.dose_rate, (v) => updateSourceField("dose_rate", v)));
                          inputs.push(field("Unidad de tasa de dosis", sourceForm.dose_rate_unit, (v) => updateSourceField("dose_rate_unit", v)));
                } else if (key === "radionuclide") {
      if (facilityType === "medicina_nuclear_pet_ct") {
        inputs.push(
          h(
            "label",
            { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
            labels.radionuclide || "Radionuclido",
            h(
              "select",
              {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: sourceForm.radionuclide,
                onChange: (e: any) => updateSourceField("radionuclide", e.target.value),
              },
              [h("option", { key: "", value: "" }, "Seleccione...")].concat(
                RADIONUCLIDOS_PET.map((n) => h("option", { key: n.nuclido, value: n.nuclido }, n.nuclido + " (T1/2 = " + n.semividaMin + " min, " + n.modoDecaimiento + ")"))
              )
            )
          )
        );
      } else if (facilityType === "braquiterapia") {
        inputs.push(
          h(
            "label",
            { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
            labels.radionuclide || "Radionuclido (fuente sellada, Tabla 20 SRS-47)",
            h(
              "select",
              {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: sourceForm.radionuclide,
                onChange: (e: any) => updateSourceField("radionuclide", e.target.value),
              },
              [h("option", { key: "", value: "" }, "Seleccione...")].concat(
                NUCLEIDOS_TABLA20.map((n) => h("option", { key: n.nucleido, value: n.nucleido }, n.nucleido + " (RAKR = " + n.rakrUGyMBqM2H + " uGy*MBq^-1*m^2*h^-1)"))
              )
            )
          )
        );
      } else {
        inputs.push(field(labels.radionuclide || "Radionuclido", sourceForm.radionuclide, (v) => updateSourceField("radionuclide", v)));
      }
                } else if (key === "energy") {
                          inputs.push(facilityType === "radioterapia" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, labels.energy || "Energia nominal (MV, Tabla B.2 NCRP151)", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: sourceForm.energy, onChange: (e: any) => updateSourceField("energy", e.target.value) }, [h("option", { key: "", value: "" }, "Seleccione...")].concat(Array.from(new Set(TVL_BARRERA_PRIMARIA_NCRP151.map((t) => t.energiaMV))).map((en) => h("option", { key: en, value: en }, en + (en === "Co-60" ? "" : " MV")))))) : field(labels.energy || "Energia", sourceForm.energy, (v) => updateSourceField("energy", v)));
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
    const pirOccupancyReferenceOptions = !selectedProject
    ? []
        : selectedProject.facility_type === "diagnostico"
    ? FACTORES_OCUPACION_NCRP147.map((f) => ({
        codigo: f.codigo,
        label: f.ubicacionEs + " - T=" + String(f.factorT) + " (NCRP 147, Tabla 4.1)",
        factorT: f.factorT,
        cita: "NCRP 147, Tabla 4.1 y Seccion 4.1.3, pag. " + FUENTE_TABLA_4_1_OCUPACION.paginaAprox + ". Codigo: " + f.codigo,
    }))
        : selectedProject.facility_type === "medicina_nuclear" || selectedProject.facility_type === "medicina_nuclear_pet_ct"
    ? MAPEO_OCUPACION_NCRP151_MEDICINA_NUCLEAR.map((m) => ({
        codigo: m.codigoOrigenNCRP151,
        label: m.ambiente + " - T=" + String(m.factorT) + " (NCRP 151, adaptado de Tabla B.1)",
        factorT: m.factorT,
        cita: "NCRP 151, Apendice B, Tabla B.1 (adaptado a medicina nuclear), pag. 160. " + m.justificacion,
    }))
        : selectedProject.facility_type === "radioterapia"
    ? FACTORES_OCUPACION_NCRP151_RADIOTERAPIA.map((f) => ({
        codigo: f.codigo,
        label: f.ubicacionEs + " - T=" + String(f.factorT) + " (NCRP 151, Tabla B.1, uso radioterapia)",
        factorT: f.factorT,
        cita: "NCRP 151, Apendice B, Tabla B.1 (uso original radioterapia). Codigo: " + f.codigo + (f.notas ? " - " + f.notas : ""),
    }))
        : [];

    const pirOccupancyReferenceSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Factor T de tabla oficial NCRP (S24, S33)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: "",
                onChange: (e: any) => {
                    const codigo = e.target.value;
                    const opt = pirOccupancyReferenceOptions.find((o: any) => o.codigo === codigo);
                    if (opt) {
                        updatePirField("occupancy_factor", String(opt.factorT));
                        updatePirField("occupancy_type", opt.label);
                    }
                },
            },
            [h("option", { key: "", value: "" }, pirOccupancyReferenceOptions.length ? "Seleccionar de tabla oficial..." : "No disponible para esta modalidad (pendiente de extraccion)")].concat(
                pirOccupancyReferenceOptions.map((o: any) => h("option", { key: o.codigo, value: o.codigo }, o.label))
                )
            )
        );

    const pirCriterionReferenceOptions = !selectedProject
    ? []
        : selectedProject.facility_type === "diagnostico"
    ? OPCIONES_CRITERIO_DISENO_DIAGNOSTICO.map((o) => ({
        codigo: o.codigo,
        label: o.etiquetaEs + " - " + String(pirForm.area_type === "controlada" ? o.areaControladaValor : o.areaNoControladaValor) + " " + o.unidad + " (" + o.origen + ", confianza " + o.nivelConfianza + ")",
        valor: pirForm.area_type === "controlada" ? o.areaControladaValor : o.areaNoControladaValor,
        unidad: o.unidad,
        cita: o.etiquetaEs + ". " + o.notas,
    }))
        : (selectedProject.facility_type === "medicina_nuclear" || selectedProject.facility_type === "medicina_nuclear_pet_ct" || selectedProject.facility_type === "radioterapia")
    ? OBJETIVOS_DISENO_P_NCRP151.filter((o) => (pirForm.area_type === "controlada" ? o.areaTipo === "controlada" : o.areaTipo === "no controlada")).map((o) => ({
        codigo: o.codigo,
        label: o.descripcion + " - " + String(o.pSvSemana) + " Sv/semana (NCRP 151)",
        valor: o.pSvSemana,
        unidad: "Sv/semana",
cita: o.fuente.documento + " - " + o.fuente.tablaOEcuacion + ", pag. " + o.fuente.paginaAprox + (o.fuente.notas ? ". " + o.fuente.notas : ""),
    }))
        : [];

    const pirCriterionReferenceSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Criterio de diseno (P) de tabla oficial (S33)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: "",
                onChange: (e: any) => {
                    const codigo = e.target.value;
                    const opt = pirCriterionReferenceOptions.find((o: any) => o.codigo === codigo);
                    if (opt) {
                        updatePirField("design_criterion_value", String(opt.valor));
                        updatePirField("design_criterion_unit", opt.unidad);
                        updatePirField("design_criterion_source", opt.cita);
                    }
                },
            },
            [h("option", { key: "", value: "" }, pirCriterionReferenceOptions.length ? "Seleccionar de tabla oficial..." : "No disponible para esta modalidad/clasificacion (pendiente de extraccion)")].concat(
                pirCriterionReferenceOptions.map((o: any) => h("option", { key: o.codigo, value: o.codigo }, o.label))
                )
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
                pirOccupancyReferenceSelect,
                              field("Ocupacion (descripcion)", pirForm.occupancy_type, (v) => updatePirField("occupancy_type", v)),
                              field("Factor de ocupacion (T)", pirForm.occupancy_factor, (v) => updatePirField("occupancy_factor", v)),
                pirCriterionReferenceSelect,
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
    
    const barrierMaterialInput = selectedProject && selectedProject.facility_type === "braquiterapia"
    ? h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Material (Tabla 22 SRS-47)",
        h(
          "select",
          {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: barrierForm.material,
            onChange: (e: any) => updateBarrierField("material", e.target.value),
          },
          [h("option", { key: "", value: "" }, "Seleccione...")].concat(
            ["Hormigon", "Plomo", "Acero"].map((m) => h("option", { key: m, value: m }, m))
          )
        )
      )
    : selectedProject && selectedProject.facility_type === "radioterapia"
    ? h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Material (" + FUENTE_TABLA_B2_BARRERA_PRIMARIA.tablaOEcuacion + ", pag. " + FUENTE_TABLA_B2_BARRERA_PRIMARIA.paginaAprox + ")",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: barrierForm.material,
                onChange: (e: any) => updateBarrierField("material", e.target.value),
            },
            [h("option", { key: "", value: "" }, "Seleccione...")].concat(
                BARRIER_MATERIALS_RADIOTERAPIA.map((m) => h("option", { key: m, value: m }, m))
                )
            )
        )
        : selectedProject && selectedProject.facility_type === "diagnostico" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Material (" + FUENTE_TABLA_A1_MATERIALES.tablaOEcuacion + ", pag. " + FUENTE_TABLA_A1_MATERIALES.paginaAprox + ")", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: barrierForm.material, onChange: (e: any) => updateBarrierField("material", e.target.value) }, [h("option", { key: "", value: "" }, "Seleccione...")].concat(MATERIALES_BARRERA_NCRP147.map((m) => h("option", { key: m, value: m }, m))))) : field("Material (sin catalogo normativo verificado para esta modalidad; campo libre)", barrierForm.material, (v) => updateBarrierField("material", v));

  const barrierFormEl = selectedProject
        ? h(
            "form",
            { onSubmit: createBarrier, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
            field("Codigo de la barrera *", barrierForm.code, (v) => updateBarrierField("code", v)),
            field("Nombre de la barrera *", barrierForm.name, (v) => updateBarrierField("name", v)),
            barrierTypeSelect,
            barrierPirSelect,
            barrierMaterialInput, selectedProject.facility_type === "diagnostico" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Distribucion de carga de trabajo (Tabla 4.5/4.7, B.1/C.1 NCRP147)", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: barrierForm.distribucion_carga_ncrp147, onChange: (e: any) => updateBarrierField("distribucion_carga_ncrp147", e.target.value) }, [h("option", { key: "", value: "" }, "Seleccione...")].concat(DISTRIBUCIONES_CARGA_TRABAJO_NCRP147.map((d) => h("option", { key: d, value: d }, d))))) : null, selectedProject.facility_type === "diagnostico" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Componente de radiacion secundaria (solo para barrera secundaria)", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: barrierForm.componente_dispersion_ncrp147, onChange: (e: any) => updateBarrierField("componente_dispersion_ncrp147", e.target.value) }, [h("option", { key: "", value: "" }, "Seleccione...")].concat([{ value: "lateral", label: "Lateral (90 grados, side-scatter)" }, { value: "frontal_trasera", label: "Frontal/Trasera (135/30 grados, conservador)" }].map((o) => h("option", { key: o.value, value: o.value }, o.label))))) : null,
            field("Densidad (g/cm3)", barrierForm.density, (v) => updateBarrierField("density", v)),
            field("Fuente del material (norma, pagina)", barrierForm.material_source, (v) => updateBarrierField("material_source", v)),
            field("Espesor existente (cm)", barrierForm.thickness_existing_cm, (v) => updateBarrierField("thickness_existing_cm", v)),
            field("Espesor requerido (cm)", barrierForm.thickness_required_cm, (v) => updateBarrierField("thickness_required_cm", v)),
            field("Espesor adoptado (cm)", barrierForm.thickness_adopted_cm, (v) => updateBarrierField("thickness_adopted_cm", v)),
            field("Margen (cm)", barrierForm.margin_cm, (v) => updateBarrierField("margin_cm", v)),
            field("Distancia (m)", barrierForm.distance_m, (v) => updateBarrierField("distance_m", v)),
            selectedProject.facility_type === "radioterapia" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Angulo de dispersion (grados, Tablas B.4/B.5a NCRP151)", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: barrierForm.scatter_angle_grados, onChange: (e: any) => updateBarrierField("scatter_angle_grados", e.target.value) }, [h("option", { key: "", value: "" }, "Seleccione...")].concat([30, 45, 60, 90, 135].map((a) => h("option", { key: String(a), value: String(a) }, String(a) + " grados"))))) : null,
            selectedProject.facility_type === "radioterapia" ? field("Distancia objetivo-paciente dsca (m, tipicamente ~1 m, DFI/SAD)", barrierForm.dsca_m, (v) => updateBarrierField("dsca_m", v)) : null,
            field("Factor de uso (U)", barrierForm.use_factor, (v) => updateBarrierField("use_factor", v)),
            field("Factor de ocupacion (T)", barrierForm.occupancy_factor, (v) => updateBarrierField("occupancy_factor", v)),
            field("Resultado (valor B / dosis)", barrierForm.result_value, (v) => updateBarrierField("result_value", v)),
            field("Resultado (unidad / detalle)", barrierForm.result_unit, (v) => updateBarrierField("result_unit", v)),
selectedProject.facility_type === "braquiterapia"
            ? h(
                    "div",
                { className: "md:col-span-3" },
                    h(
                                "button",
                        {
                                        type: "button",
                                        onClick: calcularBarreraBraquiterapiaClick,
                                        className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground",
                        },
                                "Calcular (SRS-47, Ec. 33/37)"
                            )
                )
            : selectedProject.facility_type === "radioterapia"
            ? h(
                    "div",
                { className: "md:col-span-3 flex flex-wrap gap-2" },
                    h(
                                "button",
                        {
                                        type: "button",
                                        onClick: calcularBarreraPrimariaAceleradorClick,
                                        className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground",
                        },
                                "Calcular barrera primaria (NCRP151, Ec. 2.1-2.3)"
                            ),
                    h(
                                "button",
                        {
                                        type: "button",
                                        onClick: calcularBarreraSecundariaAceleradorClick,
                                        className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground",
                        },
                                "Calcular barrera secundaria (NCRP151, Ec. 2.7/2.8)"
                            )
                )
            : null,
            selectedProject.facility_type === "diagnostico" ? h( "div", { className: "md:col-span-3 flex flex-wrap gap-2" }, h( "button", { type: "button", onClick: calcularBarreraPrimariaDiagnosticoNCRP147Click, className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground" }, "Calcular barrera primaria (NCRP147, Apendice B)" ), h( "button", { type: "button", onClick: calcularBarreraSecundariaDiagnosticoNCRP147Click, className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground" }, "Calcular barrera secundaria (NCRP147, Apendice C)" ) ) : null, barrierResultStatusSelect,
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
        h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Unidad de densidad", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: materialForm.density_unit, onChange: (e: any) => updateMaterialField("density_unit", e.target.value) }, DENSITY_UNIT_OPTIONS.map((o) => h("option", { key: o.value, value: o.value }, o.label)))),
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

    function materialLibraryReferenceSelect(onPick: (name: string) => void) {
        return h(
            "label",
            { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
            "Material desde biblioteca de Materiales (S22)",
            h(
                "select",
                {
                    className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                    value: "",
                    onChange: (e: any) => {
                        const name = e.target.value;
                        if (name) onPick(name);
                    },
                },
                [h("option", { key: "", value: "" }, materialsList.length ? "Seleccionar de biblioteca..." : "Sin materiales registrados aun (ver seccion Materiales)")].concat(
                    materialsList.map((m) => h("option", { key: String(m.id), value: m.name }, m.name + (m.density ? " - " + m.density + " " + (m.density_unit || "") : "") + (m.source_document ? " [" + m.source_document + (m.source_page ? ", p. " + m.source_page : "") + "]" : "")))
                    )
                )
            );
    }
    
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
                    materialLibraryReferenceSelect((name) => updateDoorField("material", name)),
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
            materialLibraryReferenceSelect((name) => updateWindowField("material", name)),
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
        field("Material de relleno / sellado (masilla, lana de plomo, etc. - sin catalogo normativo especifico verificado; campo libre)", penetrationForm.fill_material, (v) => updatePenetrationField("fill_material", v)),
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
const mazeBarrierSelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Barrera asociada",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: mazeForm.barrier_id,
            onChange: (e: any) => updateMazeField("barrier_id", e.target.value),
        },
        [h("option", { key: "", value: "" }, "Sin barrera asociada")].concat(
            barriersList.map((b) => h("option", { key: String(b.id), value: String(b.id) }, b.code + " - " + b.name))
            )
        )
    );

const mazeResultStatusSelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Estado (S39, S60)",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: mazeForm.result_status,
            onChange: (e: any) => updateMazeField("result_status", e.target.value),
        },
        RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
        )
    );

const mazeRows = mazesList.map((m) =>
    h(
        "tr",
        { key: m.id, className: "border-b border-border" },
        h("td", { className: "px-3 py-2 text-sm" }, m.code),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.name),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.location || "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.leg_count ? String(m.leg_count) : "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.last_leg_length_m ? String(m.last_leg_length_m) + " m" : "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.wall_material || "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, m.result_status || "sin_informacion")
        )
    );

const mazesTable = h(
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
                h("th", { className: "px-3 py-2" }, "N de tramos"),
                h("th", { className: "px-3 py-2" }, "Largo ultimo tramo"),
                h("th", { className: "px-3 py-2" }, "Material de muros"),
                h("th", { className: "px-3 py-2" }, "Estado")
                )
            ),
        h("tbody", null, mazeRows)
        )
    );

const disenosAlternativosPuertaInfoPanel = h("div", { className: "flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground" }, h("div", { className: "font-medium text-foreground" }, "Disenos alternativos para reducir o eliminar el blindaje de la puerta del laberinto (NCRP151 Sec. 2.4.4, pag. 46-48, McGinley y Miner 1995)"), h("p", null, "El procedimiento estandar de diseno de puertas de laberintos tipicos puede resultar en una puerta pesada y costosa que requiere un abridor motorizado. Tres tecnicas permiten mantener los neutrones fuera del laberinto y asi reducir o eliminar el blindaje de la puerta:"), h("ul", { className: "list-disc pl-4" }, TECNICAS_ALTERNATIVAS_PUERTA_LABERINTO_MCGINLEY_MINER_1995.map((t) => h("li", { key: t.tecnica }, t.descripcion))), h("div", { className: "overflow-x-auto" }, h("table", { className: "w-full text-left text-xs" }, h("thead", null, h("tr", { className: "border-b border-border" }, h("th", { className: "px-2 py-1" }, "Tecnica"), h("th", { className: "px-2 py-1" }, "Gamma de captura (Sv/Gy)"), h("th", { className: "px-2 py-1" }, "Neutrones (Sv/Gy)"), h("th", { className: "px-2 py-1" }, "Total (Sv/Gy)"))), h("tbody", null, COMPARACION_TECNICAS_PUERTA_LABERINTO_TABLA21.map((f) => h("tr", { key: f.tipoLaberintoYPuerta, className: "border-b border-border" }, h("td", { className: "px-2 py-1" }, f.tipoLaberintoYPuerta), h("td", { className: "px-2 py-1" }, f.capturaGammaSvGy.toExponential(2)), h("td", { className: "px-2 py-1" }, f.neutronesSvGy.toExponential(2)), h("td", { className: "px-2 py-1" }, f.totalSvGy.toExponential(2))))))), h("p", null, "Mediciones de referencia (Tabla 2.1): acelerador nominal 18 MV, longitud de laberinto d2=6.5 m, tasa de dosis en isocentro 6.67e-2 Gy/s (4 Gy/min). Valores en Sv/h por unidad de tasa de dosis absorbida (Gy/h) de rayos X en el isocentro."), h("p", null, "Para laberintos largos (del orden de 8 m o mas), la disposicion recomendada de blindaje de puerta es: " + DISPOSICION_CAPAS_PUERTA_LABERINTO_LARGO_SUGERIDA.join(" -> ") + ". Espesor de plomo interior sugerido: " + ESPESOR_PLOMO_INTERIOR_PUERTA_LABERINTO_LARGO_CM_MIN + " a " + ESPESOR_PLOMO_INTERIOR_PUERTA_LABERINTO_LARGO_CM_MAX + " cm; espesor de BPE sugerido: " + ESPESOR_BPE_PUERTA_LABERINTO_LARGO_CM_MIN + " a " + ESPESOR_BPE_PUERTA_LABERINTO_LARGO_CM_MAX + " cm. " + NOTA_RAZON_DISPOSICION_PLOMO_BPE_PLOMO), h("p", { className: "text-amber-600" }, "S24/S1/S5: este panel es informativo/comparativo, no una calculadora numerica para el proyecto especifico. Los valores de la Tabla 2.1 corresponden a mediciones en una instalacion particular (18 MV, d2=6.5 m) y no deben extrapolarse directamente a otra geometria sin verificacion por un Fisico Medico calificado."));
    
    const puertaBlindajeDirectoInfoPanel = h(
        "div",
    { className: "flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground" },
        h("div", { className: "font-medium text-foreground" }, "Alternativa: puerta con blindaje directo, sin laberinto (NCRP151 Sec. 2.4.5, pag. 48-51)"),
        h("p", null, "Regla de diseno explicita del documento: la puerta con blindaje directo debe tener el mismo valor de blindaje que la barrera secundaria adyacente. Material habitual: laminado de plomo y acero, con BPE (5% boro) si hay fotoneutrones (energia del acelerador >10 MV)."),
        h("p", null, "Limite practico de peso: " + PESO_MAXIMO_PRACTICO_PUERTA_BATIENTE_120CM_KG_MIN + " a " + PESO_MAXIMO_PRACTICO_PUERTA_BATIENTE_120CM_KG_MAX + " kg para una puerta batiente de " + ANCHO_PUERTA_REFERENCIA_LIMITE_PESO_CM + " cm de ancho; mas alla de ese peso se requieren dos puertas mas estrechas o una puerta corrediza (planifique tambien una via de escape alternativa para el paciente ante una falla del mecanismo)."),
        h("p", null, "Recomendacion conservadora (McGinley y Miner, 1995): al no existir mediciones conocidas de la intensidad de rayos gamma de captura de neutrones dentro de la sala, calcule el blindaje de la puerta para la radiacion de fuga y luego agregue 1 HVL del material de la puerta. Dato de referencia: los rayos gamma de captura de boro (BPE) tienen " + ENERGIA_GAMMA_CAPTURA_BORO_KEV + " keV; " + ESPESOR_PLOMO_ATENUACION_100X_GAMMA_CAPTURA_BORO_CM + " cm de plomo reducen su intensidad en mas de un factor de 100."),
        h("p", { className: "text-amber-600" }, "S24/S1/S5: esta version no incluye una calculadora numerica automatica para este caso. La Tabla B.7 de NCRP151 (TVL de fuga) solo reporta valores verificados para hormigon, no para plomo ni acero (el mismo motivo por el que la calculadora de Barrera secundaria del Paso 10 rechaza materiales distintos de hormigon). Inventar un TVL de fuga en plomo/acero violaria el principio de no fabricar valores. Recomendacion: (1) si la puerta se construira en hormigon, use la calculadora de Barrera secundaria (Paso 10, Ecs. 2.7/2.8) y luego agregue el margen de 1 HVL indicado arriba; (2) si se construira en plomo/acero laminado (caso habitual), el espesor final debe ser determinado por un Fisico Medico calificado con TVL de fuga verificados contra el documento original o mediciones directas.")
    );
    
    const mazeFormEl = selectedProject
? h(
    "form",
    { onSubmit: createMaze, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
    field("Codigo del laberinto *", mazeForm.code, (v) => updateMazeField("code", v)),
    field("Nombre del laberinto *", mazeForm.name, (v) => updateMazeField("name", v)),
    mazeBarrierSelect,
    field("Ubicacion", mazeForm.location, (v) => updateMazeField("location", v)),
    field("Numero de tramos (legs)", mazeForm.leg_count, (v) => updateMazeField("leg_count", v)),
    field("Largo del ultimo tramo (m)", mazeForm.last_leg_length_m, (v) => updateMazeField("last_leg_length_m", v)),
    field("Ancho del laberinto (cm)", mazeForm.maze_width_cm, (v) => updateMazeField("maze_width_cm", v)),
    field("Alto del laberinto (cm)", mazeForm.maze_height_cm, (v) => updateMazeField("maze_height_cm", v)),
    materialLibraryReferenceSelect((name) => updateMazeField("wall_material", name)),
    field("Material de los muros", mazeForm.wall_material, (v) => updateMazeField("wall_material", v)), selectedProject.facility_type === "radioterapia" ? field("Factor de uso Pared G (UG, Tabla 3.1 NCRP151)", mazeForm.ug, (v) => updateMazeField("ug", v)) : null, selectedProject.facility_type === "radioterapia" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "UG desde Tabla 3.1 NCRP151 (factor de uso por angulo de portico)", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: "", onChange: (e: any) => { const idx = e.target.value; if (idx !== "") { const opt = FACTOR_USO_ANGULO_PORTICO_TABLA31[Number(idx)]; if (opt) updateMazeField("ug", String(opt.usoPorcentaje / 100)); } } }, [h("option", { key: "", value: "" }, "Seleccionar de tabla oficial...")].concat(FACTOR_USO_ANGULO_PORTICO_TABLA31.map((o, i) => h("option", { key: String(i), value: String(i) }, o.etiqueta + " (" + o.anchoIntervaloGrados + " grados) - " + o.usoPorcentaje + "% (Tabla 3.1)"))))) : null, selectedProject.facility_type === "radioterapia" ? field("alfa0 - coef. reflexion 1ra superficie (Tabla B.8a-f NCRP151, pag.168-171, ej. 0.0053)", mazeForm.alfa0, (v) => updateMazeField("alfa0", v)) : null, selectedProject.facility_type === "radioterapia" ? field("A0 - area del haz en la 1ra superficie de reflexion (m2, Ec.2.9)", mazeForm.a0_m2, (v) => updateMazeField("a0_m2", v)) : null, selectedProject.facility_type === "radioterapia" ? field("alfaZ - coef. reflexion 2da superficie ~0.5MeV (Tabla B.8a-f NCRP151)", mazeForm.alfaz, (v) => updateMazeField("alfaz", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Az - area seccion transversal entrada interior del laberinto proyectada (m2)", mazeForm.az_m2, (v) => updateMazeField("az_m2", v)) : null, selectedProject.facility_type === "radioterapia" ? field("dh - distancia perpendicular objetivo a 1ra superficie de reflexion (m, = dpp+1m)", mazeForm.dh_m, (v) => updateMazeField("dh_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("dr - distancia centro del haz en 1er reflejo a punto b en linea media (m)", mazeForm.dr_m, (v) => updateMazeField("dr_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("dz - distancia en linea central del laberinto desde punto b hasta la puerta (m)", mazeForm.dz_m, (v) => updateMazeField("dz_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("WL - carga de trabajo para radiacion de fuga (Gy/semana, puede diferir de W)", mazeForm.wl_gy_semana, (v) => updateMazeField("wl_gy_semana", v)) : null, selectedProject.facility_type === "radioterapia" ? field("alfa1 - coef. reflexion fuga cabezal (Tabla B.8a, energia efectiva 1.4MeV)", mazeForm.alfa1, (v) => updateMazeField("alfa1", v)) : null, selectedProject.facility_type === "radioterapia" ? field("A1 - area Pared G visible desde la puerta del laberinto (m2)", mazeForm.a1_m2, (v) => updateMazeField("a1_m2", v)) : null, selectedProject.facility_type === "radioterapia" ? field("dsec - distancia objetivo a linea central del laberinto en Pared G (m)", mazeForm.dsec_m, (v) => updateMazeField("dsec_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("dzz - distancia linea central del laberinto (m, Ec.2.10)", mazeForm.dzz_m, (v) => updateMazeField("dzz_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("dL - distancia objetivo a centro puerta a traves pared interior laberinto (m, Ec.2.12)", mazeForm.dl_m, (v) => updateMazeField("dl_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("B - factor de transmision Pared Z en camino oblicuo dL (Ec.2.12)", mazeForm.b_pared_z, (v) => updateMazeField("b_pared_z", v)) : null, selectedProject.facility_type === "radioterapia" ? field("f - fraccion haz principal transmitido a traves del paciente (~0.25 para 6-10MV, campo 40x40cm2, McGinley y James 1997)", mazeForm.f_transmision_paciente, (v) => updateMazeField("f_transmision_paciente", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado HTot (Sv/semana)", mazeForm.result_value, (v) => updateMazeField("result_value", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado (detalle)", mazeForm.result_unit, (v) => updateMazeField("result_unit", v)) : null, selectedProject.facility_type === "radioterapia" ? h("div", { className: "md:col-span-3" }, h("button", { type: "button", onClick: calcularLaberintoBajaEnergiaClick, className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground" }, "Calcular puerta de laberinto (NCRP151, Ec. 2.9-2.14, <=10MV o Co-60)")) : null, selectedProject.facility_type === "radioterapia" ? field("beta - factor de transmision de neutrones a traves del blindaje del cabezal (1 para plomo, 0.85 para tungsteno; Ec.2.16 NCRP151)", mazeForm.beta_neutrones, (v) => updateMazeField("beta_neutrones", v)) : null, selectedProject.facility_type === "radioterapia" ? field("d1 - distancia desde el isocentro hasta el punto A del laberinto, donde el isocentro apenas deja de ser visible (m, Ecs.2.16/2.18/2.19 NCRP151)", mazeForm.d1_m, (v) => updateMazeField("d1_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Sr - superficie total de la sala de tratamiento (m2, Ec.2.16 NCRP151)", mazeForm.sr_m2, (v) => updateMazeField("sr_m2", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Qn - fuerza de fuente de neutrones (x1e12 neutrones/Gy en isocentro, Tabla B.9 NCRP151, ej. 0.96 para Varian 2100C 18MV)", mazeForm.qn_x1e12, (v) => updateMazeField("qn_x1e12", v)) : null, selectedProject.facility_type === "radioterapia" ? h("label", { className: "flex flex-col gap-1 text-xs text-muted-foreground" }, "Qn desde Tabla B.9 NCRP151 (fuerza de fuente de neutrones por modelo de acelerador, referencial)", h("select", { className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground", value: "", onChange: (e: any) => { const idx = e.target.value; if (idx !== "") { const opt = FUERZA_FUENTE_NEUTRONES_NCRP151[Number(idx)]; if (opt) updateMazeField("qn_x1e12", String(opt.qnX1e12)); } } }, [h("option", { key: "", value: "" }, "Seleccionar de tabla oficial...")].concat(FUERZA_FUENTE_NEUTRONES_NCRP151.map((o, i) => h("option", { key: String(i), value: String(i) }, o.vendedor + " " + o.modelo + " " + o.energiaNominalMV + "MV - Qn=" + o.qnX1e12 + "x1e12 n/Gy (Tabla B.9)"))))) : null, selectedProject.facility_type === "radioterapia" ? field("S0 - area de la entrada interior del laberinto (m2, Ecs.2.18/2.19/2.20 NCRP151)", mazeForm.s0_m2, (v) => updateMazeField("s0_m2", v)) : null, selectedProject.facility_type === "radioterapia" ? field("S1 - area de la seccion transversal a lo largo del laberinto (m2, Ecs.2.18/2.19/2.20 NCRP151)", mazeForm.s1_m2, (v) => updateMazeField("s1_m2", v)) : null, selectedProject.facility_type === "radioterapia" ? field("d2 - distancia desde el punto A hasta la puerta, a lo largo de la linea central del laberinto (m, Ecs.2.15/2.18/2.19 NCRP151)", mazeForm.d2_m, (v) => updateMazeField("d2_m", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado Hw alta energia (Sv/semana)", mazeForm.result_value_alta_energia, (v) => updateMazeField("result_value_alta_energia", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado alta energia (detalle)", mazeForm.result_unit_alta_energia, (v) => updateMazeField("result_unit_alta_energia", v)) : null, selectedProject.facility_type === "radioterapia" ? h("div", { className: "md:col-span-3" }, h("button", { type: "button", onClick: calcularLaberintoAltaEnergiaClick, className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground" }, "Calcular puerta de laberinto - alta energia (NCRP151, Ecs. 2.15-2.22, metodo de Kersey modificado, >10MV)")) : null, selectedProject.facility_type === "radioterapia" ? field("P - objetivo de diseno de la puerta (Sv/semana, del PIR/criterio de diseno)", mazeForm.p_diseno_puerta_sv_semana, (v) => updateMazeField("p_diseno_puerta_sv_semana", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado: espesor de plomo requerido (cm, Sec.2.4.3, gamma de captura de neutrones)", mazeForm.espesor_plomo_puerta_cm, (v) => updateMazeField("espesor_plomo_puerta_cm", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado: espesor de BPE requerido (cm, Sec.2.4.3, neutrones)", mazeForm.espesor_bpe_puerta_cm, (v) => updateMazeField("espesor_bpe_puerta_cm", v)) : null, selectedProject.facility_type === "radioterapia" ? field("Resultado espesor de puerta (detalle)", mazeForm.result_unit_puerta, (v) => updateMazeField("result_unit_puerta", v)) : null, selectedProject.facility_type === "radioterapia" ? h("div", { className: "md:col-span-3" }, h("button", { type: "button", onClick: calcularEspesorPuertaLaberintoClick, className: "rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground" }, "Calcular espesor de puerta (NCRP151, Sec. 2.4.3, TVL plomo/BPE)")) : null,
    mazeResultStatusSelect,
    field("Fuente documental (norma, pagina)", mazeForm.source_document, (v) => updateMazeField("source_document", v)),
    field("Notas", mazeForm.notes, (v) => updateMazeField("notes", v)),
    mazeError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, mazeError) : null,
    h(
        "div",
        { className: "md:col-span-3" },
        h(
            "button",
            {
                type: "submit",
                disabled: savingMaze,
                className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
            },
            savingMaze ? "Guardando..." : "Agregar laberinto"
            )
        )
    )
    : null;

const paso11Panel = selectedProject
? h(
    "div",
    { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
    h("div", { className: "text-sm font-medium text-foreground" }, "Paso 11 - Laberintos (" + selectedProject.name + ")"),
    h(
        "div",
        { className: "text-xs text-muted-foreground" },
        "Cada laberinto registra numero de tramos, largo del ultimo tramo (dimension critica para radiacion dispersa), dimensiones y material de los muros, con su barrera asociada y fuente documental (S30, S33)."
        ),
    loadingMazes ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando laberintos...") : mazesTable,
    mazeFormEl,
        disenosAlternativosPuertaInfoPanel,
        puertaBlindajeDirectoInfoPanel
    )
    : null;
    
    const slabBarrierSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Barrera asociada",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: slabForm.barrier_id,
                onChange: (e: any) => updateSlabField("barrier_id", e.target.value),
            },
            [h("option", { key: "", value: "" }, "Sin barrera asociada")].concat(
                barriersList.map((b) => h("option", { key: String(b.id), value: String(b.id) }, b.code + " - " + b.name))
                )
            )
        );

const slabTypeSelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Tipo de losa",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: slabForm.slab_type,
            onChange: (e: any) => updateSlabField("slab_type", e.target.value),
        },
        SLAB_TYPES.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
        )
    );

const slabOccupancySelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Ocupacion del lado opuesto",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: slabForm.occupancy_above,
            onChange: (e: any) => updateSlabField("occupancy_above", e.target.value),
        },
        OCCUPANCY_ABOVE_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
        )
    );

const slabResultStatusSelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Estado (S39, S60)",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: slabForm.result_status,
            onChange: (e: any) => updateSlabField("result_status", e.target.value),
        },
        RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
        )
    );

const slabRows = slabsList.map((s) =>
    h(
        "tr",
        { key: s.id, className: "border-b border-border" },
        h("td", { className: "px-3 py-2 text-sm" }, s.code),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.name),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.location || "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.slab_type || "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.thickness_cm ? String(s.thickness_cm) + " cm" : "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.occupancy_above || "-"),
        h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, s.result_status || "sin_informacion")
        )
                               );

const slabsTable = h(
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
                h("th", { className: "px-3 py-2" }, "Espesor"),
                h("th", { className: "px-3 py-2" }, "Ocupacion lado opuesto"),
                h("th", { className: "px-3 py-2" }, "Estado")
                )
            ),
        h("tbody", null, slabRows)
        )
    );

const slabFormEl = selectedProject
    ? h(
        "form",
        { onSubmit: createSlab, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
        field("Codigo de la losa *", slabForm.code, (v) => updateSlabField("code", v)),
        field("Nombre de la losa *", slabForm.name, (v) => updateSlabField("name", v)),
        slabBarrierSelect,
        field("Ubicacion", slabForm.location, (v) => updateSlabField("location", v)),
        slabTypeSelect,
        field("Espesor (cm)", slabForm.thickness_cm, (v) => updateSlabField("thickness_cm", v)),
        materialLibraryReferenceSelect((name) => updateSlabField("material", name)),
        field("Material", slabForm.material, (v) => updateSlabField("material", v)),
        slabOccupancySelect,
        field("Distancia al limite del predio (m)", slabForm.distance_property_line_m, (v) => updateSlabField("distance_property_line_m", v)),
        slabResultStatusSelect,
        field("Fuente documental (norma, pagina)", slabForm.source_document, (v) => updateSlabField("source_document", v)),
        field("Notas", slabForm.notes, (v) => updateSlabField("notes", v)),
        slabError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, slabError) : null,
        h(
            "div",
            { className: "md:col-span-3" },
            h(
                "button",
                {
                    type: "submit",
                    disabled: savingSlab,
                    className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                },
                savingSlab ? "Guardando..." : "Agregar losa"
                )
            )
        )
    : null;

const paso12Panel = selectedProject
    ? h(
        "div",
        { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
        h("div", { className: "text-sm font-medium text-foreground" }, "Paso 12 - Losas de techo y piso / Skyshine (" + selectedProject.name + ")"),
        h(
            "div",
            { className: "text-xs text-muted-foreground" },
            "Cada losa (techo o piso) registra espesor, material y ocupacion del lado opuesto, incluyendo distancia al limite del predio para el analisis de radiacion dispersa hacia el cielo (skyshine), con su barrera asociada y fuente documental (S31, S33)."
            ),
        loadingSlabs ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando losas...") : slabsTable,
        slabFormEl
        )
    : null;

const occupancyPointBarrierSelect = h(
    "label",
    { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
    "Barrera asociada",
    h(
        "select",
        {
            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
            value: occupancyPointForm.barrier_id,
            onChange: (e: any) => updateOccupancyPointField("barrier_id", e.target.value),
        },
        [h("option", { key: "", value: "" }, "Sin barrera asociada")].concat(
            barriersList.map((b) => h("option", { key: String(b.id), value: String(b.id) }, b.code + " - " + b.name))
            )
        )
    );
    
        const occupancyReferenceOptions = !selectedProject
                    ? []
                    : selectedProject.facility_type === "diagnostico"
                ? FACTORES_OCUPACION_NCRP147.map((f) => ({
                        codigo: f.codigo,
                        label: f.ubicacionEs + " - T=" + String(f.factorT) + " (NCRP 147, Tabla 4.1)",
                        factorT: f.factorT,
                        cita: "NCRP 147, Tabla 4.1 y Seccion 4.1.3, pag. " + FUENTE_TABLA_4_1_OCUPACION.paginaAprox + ". Codigo: " + f.codigo,
                }))
                : selectedProject.facility_type === "medicina_nuclear"
                ? MAPEO_OCUPACION_NCRP151_MEDICINA_NUCLEAR.map((m) => ({
                        codigo: m.codigoOrigenNCRP151,
                        label: m.ambiente + " - T=" + String(m.factorT) + " (NCRP 151, adaptado de Tabla B.1)",
                        factorT: m.factorT,
                        cita: "NCRP 151, Apendice B, Tabla B.1 (adaptado a medicina nuclear), pag. 160. " + m.justificacion,
                }))
                : [];
    
        const occupancyReferenceSelect = h(
                "label",
            { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
                "Factor T de tabla oficial NCRP (S24, S33)",
                    h(
                        "select",
                    {
                            className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                            value: "",
                            onChange: (e: any) => {
                                    const codigo = e.target.value;
                                    const opt = occupancyReferenceOptions.find((o: any) => o.codigo === codigo);
                                    if (opt) {
                                            updateOccupancyPointField("occupancy_factor_t", String(opt.factorT));
                                            updateOccupancyPointField("source_document", opt.cita);
                                    }
                            },
                    },
                        [h("option", { key: "", value: "" }, occupancyReferenceOptions.length ? "Seleccionar de tabla oficial..." : "No disponible para esta modalidad (pendiente de extraccion)")].concat(
                                occupancyReferenceOptions.map((o: any) => h("option", { key: o.codigo, value: o.codigo }, o.label))
                                )
                        )
                );
    
    const occupancyTypeSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Tipo de ocupacion",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: occupancyPointForm.occupancy_type,
                onChange: (e: any) => updateOccupancyPointField("occupancy_type", e.target.value),
            },
            OCCUPANCY_TYPE_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );
    
    const beamComponentSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Componente del haz",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: occupancyPointForm.beam_component,
                onChange: (e: any) => updateOccupancyPointField("beam_component", e.target.value),
            },
            BEAM_COMPONENT_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );
    
    const occupancyPointResultStatusSelect = h(
        "label",
        { className: "flex flex-col gap-1 text-xs text-muted-foreground" },
        "Estado (S39, S60)",
        h(
            "select",
            {
                className: "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
                value: occupancyPointForm.result_status,
                onChange: (e: any) => updateOccupancyPointField("result_status", e.target.value),
            },
            RESULT_STATUS_OPTIONS.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
            )
        );
    
    const occupancyPointRows = occupancyPointsList.map((o) =>
        h(
            "tr",
            { key: o.id, className: "border-b border-border" },
            h("td", { className: "px-3 py-2 text-sm" }, o.code),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.name),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.location || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.occupancy_type || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.occupancy_factor_t ? String(o.occupancy_factor_t) : "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.distance_m ? String(o.distance_m) + " m" : "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.beam_component || "-"),
            h("td", { className: "px-3 py-2 text-sm text-muted-foreground" }, o.result_status || "sin_informacion")
            )
                                                       );
    
    const occupancyPointsTable = h(
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
                    h("th", { className: "px-3 py-2" }, "Tipo de ocupacion"),
                    h("th", { className: "px-3 py-2" }, "Factor T"),
                    h("th", { className: "px-3 py-2" }, "Distancia"),
                    h("th", { className: "px-3 py-2" }, "Componente"),
                    h("th", { className: "px-3 py-2" }, "Estado")
                    )
                ),
            h("tbody", null, occupancyPointRows)
            )
        );
    
    const occupancyPointFormEl = selectedProject
        ? h(
            "form",
            { onSubmit: createOccupancyPoint, className: "grid grid-cols-1 gap-3 md:grid-cols-3" },
            field("Codigo del punto *", occupancyPointForm.code, (v) => updateOccupancyPointField("code", v)),
            field("Nombre del punto *", occupancyPointForm.name, (v) => updateOccupancyPointField("name", v)),
            occupancyPointBarrierSelect,
            field("Ubicacion", occupancyPointForm.location, (v) => updateOccupancyPointField("location", v)),
            occupancyReferenceSelect,
            occupancyTypeSelect,
            field("Factor de ocupacion (T)", occupancyPointForm.occupancy_factor_t, (v) => updateOccupancyPointField("occupancy_factor_t", v)),
            field("Distancia fuente-punto (m)", occupancyPointForm.distance_m, (v) => updateOccupancyPointField("distance_m", v)),
            beamComponentSelect,
            occupancyPointResultStatusSelect,
            field("Fuente documental (norma, pagina)", occupancyPointForm.source_document, (v) => updateOccupancyPointField("source_document", v)),
            field("Notas", occupancyPointForm.notes, (v) => updateOccupancyPointField("notes", v)),
            occupancyPointError ? h("div", { className: "md:col-span-3 text-xs text-red-500" }, occupancyPointError) : null,
            h(
                "div",
                { className: "md:col-span-3" },
                h(
                    "button",
                    {
                        type: "submit",
                        disabled: savingOccupancyPoint,
                        className: "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50",
                    },
                    savingOccupancyPoint ? "Guardando..." : "Agregar punto de ocupacion"
                    )
                )
            )
        : null;
    
    const paso13Panel = selectedProject
        ? h(
            "div",
            { className: "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" },
            h("div", { className: "text-sm font-medium text-foreground" }, "Paso 13 - Puntos de ocupacion / Receptores de dosis (" + selectedProject.name + ")"),
            h(
                "div",
                { className: "text-xs text-muted-foreground" },
                "Cada punto de ocupacion registra el tipo de ocupante, el factor de ocupacion (T), la distancia a la fuente y el componente del haz (primario, dispersa o fuga) relevante para el calculo de dosis en ese receptor, con su barrera asociada y fuente documental (S32, S33)."
                ),
            loadingOccupancyPoints ? h("div", { className: "text-sm text-muted-foreground" }, "Cargando puntos de ocupacion...") : occupancyPointsTable,
            occupancyPointFormEl
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
          paso11Panel,
          paso12Panel,
          paso13Panel,
          nextPhases
      );
}
