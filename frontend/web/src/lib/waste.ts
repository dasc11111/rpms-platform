// Modulo: Liberacion de Sala Hospitalizado / Gestion de Residuos Radiactivos
//
// Este archivo centraliza tipos, constantes y funciones puras reutilizadas por
// las rutas API y los componentes de UI de este modulo. Sigue el mismo patron
// que src/lib/i131.ts y src/lib/contamination.ts.
//
// Diseno pensado para escalabilidad: aunque hoy solo I-131 esta activo, los
// radionuclidos, periodos de semidesintegracion, factores de conversion y
// criterios de liberacion viven en la tabla parametrizable "radionuclides"
// (ver src/app/api/init/route.ts), nunca como valores fijos en el codigo.

export const WASTE_LABEL_PREFIX = "GRR";

export function formatWasteLabelNumber(year: number, correlative: number): string {
    return `${WASTE_LABEL_PREFIX}-${year}-${String(correlative).padStart(6, "0")}`;
}

export const ROOM_RELEASE_STATUS = ["en_sala", "liberado", "anulado"] as const;
export type RoomReleaseStatus = (typeof ROOM_RELEASE_STATUS)[number];

export const ROOM_RELEASE_STATUS_LABELS: Record<RoomReleaseStatus, string> = {
    en_sala: "En sala",
    liberado: "Liberado",
    anulado: "Anulado",
};

export type RoomReleaseRecord = {
    id: number;
    release_date: string;
    admission_date: string | null;
    service: string;
    sala: string;
    room_number: string | null;
    paciente_nombre: string;
    paciente_run: string | null;
    ficha_clinica: string | null;
    radionuclide_code: string;
    actividad_administrada: number | null;
    actividad_medida_liberacion: number | null;
    unidad_actividad: string;
    tasa_dosis_medida: string | null;
    criterio_liberacion: string | null;
    responsable_opr: string;
    observaciones: string | null;
    status: RoomReleaseStatus;
    waste_label_generated: boolean;
    created_at: string;
    updated_at: string;
};

export const WASTE_LABEL_STATUS = ["pendiente", "almacenado", "liberado"] as const;
export type WasteLabelStatus = (typeof WASTE_LABEL_STATUS)[number];

export const WASTE_LABEL_STATUS_LABELS: Record<WasteLabelStatus, string> = {
    pendiente: "Pendiente",
    almacenado: "Almacenado",
    liberado: "Liberado",
};

export type WasteLabel = {
    id: number;
    label_number: string;
    label_year: number;
    correlative: number;
    room_release_id: number;
    generation_date: string;
    service: string;
    sala: string;
    room_number: string | null;
    paciente_nombre: string | null;
    radionuclide_code: string;
    actividad_estimada_residual: number | null;
    unidad_actividad: string;
    waste_type: string | null;
    waste_classification: string | null;
    container: string | null;
    storage_location: string | null;
    entry_date: string;
    responsible: string;
    observations: string | null;
    status: WasteLabelStatus;
    print_count: number;
    last_printed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type WasteLabelHistoryEntry = {
    id: number;
    label_id: number;
    action: string;
    changed_by: string | null;
    snapshot: unknown;
    changed_at: string;
};

export type Radionuclide = {
    code: string;
    name: string;
    half_life_days: number;
    unit: string;
    release_criteria_activity: number | null;
    release_criteria_dose_rate_usvh: number | null;
    active: boolean;
    sort_order: number;
    notes: string | null;
};

export const WASTE_TYPE_OPTIONS = ["Solido", "Liquido", "Mixto", "Excretas", "Material punzocortante"];
export const WASTE_CLASSIFICATION_OPTIONS = [
    "Baja actividad",
    "Media actividad",
    "Alta actividad",
    "Vida corta (decaimiento)",
  ];
export const WASTE_CONTAINER_OPTIONS = [
    "Bolsa doble plastica",
    "Tambor blindado",
    "Contenedor plomado",
    "Bidon para liquidos",
  ];

export const RESPONSABLE_OPR_FIJO = "Oficial de Proteccion Radiologica";

// Fraccion de actividad remanente segun decaimiento exponencial simple.
export function decayFractionRemaining(halfLifeDays: number, elapsedDays: number): number {
    if (!halfLifeDays || halfLifeDays <= 0) return 1;
    return Math.pow(0.5, elapsedDays / halfLifeDays);
}

export function estimateResidualActivity(
    initialActivity: number | null | undefined,
    halfLifeDays: number,
    elapsedDays: number
  ): number | null {
    if (initialActivity === null || initialActivity === undefined) return null;
    return initialActivity * decayFractionRemaining(halfLifeDays, elapsedDays);
}

export function daysBetween(a: string, b: string): number {
    const d1 = new Date(a).getTime();
    const d2 = new Date(b).getTime();
    if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
    return Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24));
}

// Numero de periodos de semidesintegracion transcurridos, usado para estimar
// cuando un residuo es liberable (criterio habitual: >= 10 periodos, o el
// criterio especifico configurado en la tabla "radionuclides").
export function halfLivesElapsed(halfLifeDays: number, elapsedDays: number): number {
    if (!halfLifeDays || halfLifeDays <= 0) return 0;
    return elapsedDays / halfLifeDays;
}

export function formatActividad(v: number | null | undefined, unidad = "mCi"): string {
    if (v === null || v === undefined) return "—";
    return `${Number(v).toFixed(2)} ${unidad}`;
}
