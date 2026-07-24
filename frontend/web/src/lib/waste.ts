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
  ubicacion: string | null;
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
  puntos_medicion: ActaPuntoMedicion[] | null;
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
  storage_location_id: number | null;
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

// --- Modulo: Inventario de Residuos y Almacenamiento Temporal ---------------
//
// Extiende la Gestion de Residuos Radiactivos con el control fisico del
// inventario: donde esta almacenado cada rotulo, sus movimientos (ingreso,
// traslado, liberacion) y el calculo automatico de cuando un residuo cumple
// el criterio de liberacion por decaimiento (por defecto 10 periodos de
// semidesintegracion, ajustable segun el criterio configurado por
// radionuclido). No se solicita informacion ya ingresada: reutiliza el
// rotulo generado en Gestion de Residuos Radiactivos como unica fuente de datos.

export const STORAGE_MOVEMENT_TYPES = ["ingreso", "traslado", "liberacion", "ajuste"] as const;
export type StorageMovementType = (typeof STORAGE_MOVEMENT_TYPES)[number];

export const STORAGE_MOVEMENT_LABELS: Record<StorageMovementType, string> = {
  ingreso: "Ingreso a almacenamiento",
  traslado: "Traslado de ubicación",
  liberacion: "Liberación del residuo",
  ajuste: "Ajuste / corrección",
};

export const DEFAULT_REQUIRED_HALF_LIVES = 10;

export type WasteStorageLocation = {
  id: number;
  name: string;
  description: string | null;
  capacity: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  current_count?: number;
};

export type WasteInventoryMovement = {
  id: number;
  waste_label_id: number;
  label_number: string | null;
  movement_type: StorageMovementType;
  from_location: string | null;
  to_location: string | null;
  moved_by: string | null;
  observaciones: string | null;
  moved_at: string;
};

export type WasteInventoryItem = WasteLabel & {
  half_life_days: number | null;
  elapsed_days: number;
  half_lives_elapsed: number;
  actividad_actual: number | null;
  release_eligible: boolean;
  days_until_release_eligible: number;
  location_name: string | null;
};

// Dias que faltan para cumplir el criterio de liberacion por decaimiento
// (por defecto 10 periodos de semidesintegracion). Retorna 0 si ya se cumplio.
export function daysUntilReleaseEligible(
  halfLifeDays: number,
  elapsedDays: number,
  requiredHalfLives: number = DEFAULT_REQUIRED_HALF_LIVES
): number {
  if (!halfLifeDays || halfLifeDays <= 0) return 0;
  const requiredDays = halfLifeDays * requiredHalfLives;
  return Math.max(0, requiredDays - elapsedDays);
}

export function isReleaseEligible(
  halfLifeDays: number,
  elapsedDays: number,
  requiredHalfLives: number = DEFAULT_REQUIRED_HALF_LIVES
): boolean {
  return daysUntilReleaseEligible(halfLifeDays, elapsedDays, requiredHalfLives) <= 0;
}

// --- Modulo: Acta Entrega de Sala - Aislamiento de Paciente con I-131 ------
//
// Genera el documento oficial "ACTA ENTREGA DE SALA / AISLAMIENTO DE PACIENTE
// CON I 131", reutilizando la fecha, servicio, sala y radionuclido ya
// registrados en el Acta de Liberacion de Sala. El usuario solo ingresa, por
// cada punto de interes fijo del modelo original, las cuentas por segundo
// (cps) medidas y la tasa de dosis (uSv/hr); el sistema calcula
// automaticamente la actividad superficial en Bq/cm2 para I-131 aplicando la
// misma formula ya validada en el modulo de Registro de Contaminacion:
//
//   Actividad (Bq/cm2) = cps / (eficiencia del detector x area monitoreada)
//
// Eficiencia y area quedan fijas para este documento, confirmadas por el
// Oficial de Proteccion Radiologica para el equipo/sonda usado en mediciones
// de I-131 (mismos valores por defecto ya usados en Registro de Contaminacion).
export const ACTA_I131_EFICIENCIA_DETECTOR = 0.15;
export const ACTA_I131_AREA_MONITOREADA_CM2 = 15;

export function calcActaActividadBqCm2(cps: number | null | undefined): number {
  const c = Number(cps ?? 0);
  if (!c || c <= 0) return 0;
  return c / (ACTA_I131_EFICIENCIA_DETECTOR * ACTA_I131_AREA_MONITOREADA_CM2);
}

export type ActaPuntoCategoria = "controlada" | "publica_ropa_basura";

export type ActaPuntoDefinicion = {
  key: string;
  label: string;
  categoria: ActaPuntoCategoria;
};

// Los 8 puntos de interes del modelo, en el mismo orden y con la misma
// categoria de limite aplicable que en el documento original:
// - "controlada": superficie/equipamiento que permanece en el area
//   controlada; limite 30 Bq/cm2 (Superficie y equipamiento en areas
//   controladas).
// - "publica_ropa_basura": items que salen del area controlada hacia zonas
//   supervisadas/de acceso publico (ropa de cama, basura comun de sala);
//   limite mas estricto de 3 Bq/cm2 (Areas supervisadas y de acceso publico,
//   vestimenta y ropa de cama).
export const ACTA_PUNTOS_INTERES: ActaPuntoDefinicion[] = [
  { key: "piso_bano_sala", label: "Piso de Baño y Sala", categoria: "controlada" },
  { key: "manillas_puertas", label: "Manillas puertas", categoria: "controlada" },
  { key: "interior_lavamanos", label: "Interior lavamanos", categoria: "controlada" },
  { key: "interior_contorno_wc", label: "Interior contorno WC", categoria: "controlada" },
  { key: "bolsa_ropa_cama", label: "Bolsa Ropa de Cama", categoria: "publica_ropa_basura" },
  { key: "bolsas_basura_comun_sala", label: "Bolsas de basura común sala", categoria: "publica_ropa_basura" },
  { key: "bolsa_basura_bano", label: "Bolsa basura baño", categoria: "controlada" },
  { key: "almohada_cama", label: "Almohada de cama", categoria: "controlada" },
];

export const ACTA_LIMITE_AREA_CONTROLADA_BQ_CM2 = 30;
export const ACTA_LIMITE_AREA_PUBLICA_BQ_CM2 = 3;

export type ActaPuntoMedicion = {
  key: string;
  label: string;
  categoria: ActaPuntoCategoria;
  cps: number | null;
  tasa_dosis_usv_h: number | null;
  actividad_bq_cm2: number;
  observacion: "Contaminado" | "No Contaminado";
};

export function clasificarActaPunto(
  categoria: ActaPuntoCategoria,
  actividadBqCm2: number
): "Contaminado" | "No Contaminado" {
  const limite =
    categoria === "publica_ropa_basura" ? ACTA_LIMITE_AREA_PUBLICA_BQ_CM2 : ACTA_LIMITE_AREA_CONTROLADA_BQ_CM2;
  return actividadBqCm2 > limite ? "Contaminado" : "No Contaminado";
}

export function buildActaPuntosMedicion(
  inputs: Record<string, { cps: number | null; tasa_dosis_usv_h: number | null }>
): ActaPuntoMedicion[] {
  return ACTA_PUNTOS_INTERES.map((p) => {
    const input = inputs[p.key] ?? { cps: null, tasa_dosis_usv_h: null };
    const actividad = calcActaActividadBqCm2(input.cps);
    return {
      key: p.key,
      label: p.label,
      categoria: p.categoria,
      cps: input.cps,
      tasa_dosis_usv_h: input.tasa_dosis_usv_h,
      actividad_bq_cm2: actividad,
      observacion: clasificarActaPunto(p.categoria, actividad),
    };
  });
}

// Texto fijo de referencia normativa y pie de firma del Acta, tal como figura
// en el documento original. Se reutiliza al generar el PDF.
export const ACTA_FIRMA_NOMBRE = "TM DIEGO SOLÍS CATALÁN";
export const ACTA_FIRMA_CARGO = "OFICIAL DE PROTECCIÓN RADIOLOGICA";
export const ACTA_FIRMA_LICENCIAS = ["AE 1670-118-132 CCHEN", "AE-2369-2025-38265 CCHEN"];
export const ACTA_REFERENCIA_NORMATIVA =
  "6 ICRP Publication 57, 1990. Radiological protection of the worker in medicine and dentistry.";
export const ACTA_FIRMA_IMAGEN_PATH = "/assets/firma-diego-solis.png";
