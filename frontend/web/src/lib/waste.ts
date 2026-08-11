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

import { sql } from "@/lib/db";

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
  waste_type_other: string | null;
  punto_medicion_key: string | null;
  actividad_superficial_inicial_bq_cm2: number | null;
  fecha_medicion_superficial: string | null;
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
// (cps) medidas, las cuentas por segundo de fondo radiactivo (cps de fondo) y
// la tasa de dosis (uSv/hr); el sistema calcula automaticamente la actividad
// superficial neta en Bq/cm2 para I-131 aplicando la misma formula ya
// validada en el modulo de Registro de Contaminacion:
//
// Actividad (Bq/cm2) = (cps medida - cps de fondo) / (eficiencia del detector x area monitoreada)
//
// Eficiencia y area quedan fijas para este documento, confirmadas por el
// Oficial de Proteccion Radiologica para el equipo/sonda usado en mediciones
// de I-131 (mismos valores por defecto ya usados en Registro de Contaminacion).
export const ACTA_I131_EFICIENCIA_DETECTOR = 0.15;
export const ACTA_I131_AREA_MONITOREADA_CM2 = 15;

export function calcActaActividadBqCm2(
  cps: number | null | undefined,
  cpsFondo: number | null | undefined = 0
): number {
  const c = Number(cps ?? 0);
  const fondo = Number(cpsFondo ?? 0);
  const neto = c - fondo;
  if (!neto || neto <= 0) return 0;
  return neto / (ACTA_I131_EFICIENCIA_DETECTOR * ACTA_I131_AREA_MONITOREADA_CM2);
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
  { key: "bolsa_basura_bano", label: "Bolsa basura baño", categoria: "publica_ropa_basura" },
  { key: "almohada_cama", label: "Almohada de cama", categoria: "publica_ropa_basura" },
];

export const ACTA_LIMITE_AREA_CONTROLADA_BQ_CM2 = 30;
export const ACTA_LIMITE_AREA_PUBLICA_BQ_CM2 = 3;

export type ActaPuntoMedicion = {
  key: string;
  label: string;
  categoria: ActaPuntoCategoria;
  cps: number | null;
  cps_fondo: number | null;
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
  inputs: Record<string, { cps: number | null; cps_fondo: number | null; tasa_dosis_usv_h: number | null }>
): ActaPuntoMedicion[] {
  return ACTA_PUNTOS_INTERES.map((p) => {
    const input = inputs[p.key] ?? { cps: null, cps_fondo: null, tasa_dosis_usv_h: null };
    const actividad = calcActaActividadBqCm2(input.cps, input.cps_fondo);
    return {
      key: p.key,
      label: p.label,
      categoria: p.categoria,
      cps: input.cps,
      cps_fondo: input.cps_fondo,
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


// --- Correccion: Dispensa por decaimiento (Bq/cm2) para residuos de Liberacion
// de Sala Hospitalizado -------------------------------------------------------
//
// Diferencia explicita entre actividad total (Bq/mCi, del paciente/Acta) y
// actividad SUPERFICIAL (Bq/cm2, del residuo puntual). El criterio de
// "APTO PARA DISPENSA" siempre se evalua en Bq/cm2, nunca comparando
// directamente una actividad total contra un limite de Bq/cm2.
//
// "Tipo de residuo" (dropdown + Otro): mapea cada residuo al punto de medicion
// del Acta (ACTA_PUNTOS_INTERES) ya registrado, de forma que la actividad
// superficial inicial se obtiene de una medicion ya realizada y nunca se le
// pide al usuario que la estime manualmente.
export const WASTE_TYPE_DISPENSA_OPTIONS: { value: string; label: string }[] = [
  { value: "ropa_cama", label: "Ropa de cama" },
  { value: "basura_comun", label: "Basura común" },
  { value: "basura_bano", label: "Basura de baño" },
  { value: "otro", label: "Otro" },
];

export const WASTE_TYPE_TO_ACTA_POINT: Record<string, string> = {
  ropa_cama: "bolsa_ropa_cama",
  basura_comun: "bolsas_basura_comun_sala",
  basura_bano: "bolsa_basura_bano",
};

export function wasteTypeDisplayLabel(wasteType: string | null | undefined, wasteTypeOther: string | null | undefined): string {
  if (!wasteType) return "—";
  if (wasteType === "otro") {
    return wasteTypeOther && wasteTypeOther.trim() ? wasteTypeOther.trim() : "Otro";
  }
  const found = WASTE_TYPE_DISPENSA_OPTIONS.find((o) => o.value === wasteType);
  return found ? found.label : wasteType;
}

// Resuelve a que punto ya medido en el Acta (ACTA_PUNTOS_INTERES) corresponde
// el tipo de residuo seleccionado. Si es "Otro", intenta emparejar por texto
// (ej: "Almohada" -> "almohada_cama") en vez de pedir una nueva medicion.
export function resolveActaPointKeyForWasteType(
  wasteType: string | null | undefined,
  wasteTypeOther: string | null | undefined
): string | null {
  if (!wasteType) return null;
  if (wasteType in WASTE_TYPE_TO_ACTA_POINT) return WASTE_TYPE_TO_ACTA_POINT[wasteType] ?? null;
  if (wasteType === "otro" && wasteTypeOther && wasteTypeOther.trim()) {
    const norm = wasteTypeOther.trim().toLowerCase();
    const match = ACTA_PUNTOS_INTERES.find(
      (p) => norm.includes(p.label.toLowerCase()) || p.label.toLowerCase().includes(norm)
    );
    return match ? match.key : null;
  }
  return null;
}

// --- Catalogo parametrizable de limites de dispensa por radionuclido -------
// No fijos en el codigo: viven en la tabla waste_release_limits, editables
// desde un panel de administracion (mismo patron que contamination_limits).
export type ReleaseLimit = {
  id: number;
  radionuclide_code: string;
  label: string;
  half_life_days: number;
  limit_bq_cm2: number;
  notes: string | null;
  active: boolean;
  sort_order: number;
};

// Alias: el mismo radionuclido fisico (Tc-99m) puede provenir de un estudio
// de paciente o de un generador Mo-99/Tc-99m; ambos comparten fisica de
// decaimiento pero el generador tiene un criterio de dispensa mas estricto.
export const RELEASE_LIMIT_ALIAS: Record<string, string> = {
  "TC-99M": "MO99-TC99M",
};

let wasteReleaseLimitsEnsured = false;
export async function ensureWasteReleaseLimitsTable(): Promise<void> {
  if (wasteReleaseLimitsEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS waste_release_limits (
      id SERIAL PRIMARY KEY,
      radionuclide_code TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      half_life_days NUMERIC NOT NULL,
      limit_bq_cm2 NUMERIC NOT NULL,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM waste_release_limits`;
  if ((rows[0]?.count ?? 0) === 0) {
    await sql`
      INSERT INTO waste_release_limits (radionuclide_code, label, half_life_days, limit_bq_cm2, notes, sort_order) VALUES
      ('I-131', 'I-131 (residuos solidos: ropa de cama, basura comun, basura de bano)', 8.02, 4, 'Criterio de dispensa final por decaimiento para residuos solidos contaminados con I-131. Valor parametrizable: debe ser validado por el Oficial de Proteccion Radiologica segun normativa vigente.', 1),
      ('MO99-TC99M', 'Mo-99/Tc-99m (residuos de generador)', 0.2508, 0.4, 'Criterio de dispensa para residuos de generadores de Mo-99/Tc-99m. Semivida corresponde a Tc-99m (6.02 horas). Valor parametrizable: debe ser validado por el Oficial de Proteccion Radiologica segun normativa vigente.', 2)
      ON CONFLICT (radionuclide_code) DO NOTHING;
    `;
  }
  wasteReleaseLimitsEnsured = true;
}

export async function getReleaseLimitForRadionuclide(radionuclideCode: string | null | undefined): Promise<ReleaseLimit | null> {
  if (!radionuclideCode) return null;
  await ensureWasteReleaseLimitsTable();
  const code = RELEASE_LIMIT_ALIAS[radionuclideCode] ?? radionuclideCode;
  const { rows } = await sql`SELECT * FROM waste_release_limits WHERE radionuclide_code = ${code} AND active = true`;
  return (rows[0] as unknown as ReleaseLimit) ?? null;
}

let wasteDispensaColumnsEnsured = false;
export async function ensureWasteLabelDispensaColumns(): Promise<void> {
  if (wasteDispensaColumnsEnsured) return;
  await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS waste_type_other TEXT`;
  await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS punto_medicion_key TEXT`;
  await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS actividad_superficial_inicial_bq_cm2 NUMERIC`;
  await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS fecha_medicion_superficial DATE`;
  wasteDispensaColumnsEnsured = true;
}

// Deja exactamente las dos ubicaciones de almacenamiento inicialmente
// solicitadas como opciones activas, SIN eliminar ubicaciones previas (se
// desactivan, preservando el historial de residuos ya asignados a ellas). El
// catalogo queda preparado para agregar mas ubicaciones despues sin tocar
// logica (ver /api/waste-storage/locations).
let wasteStorageSeedV2Ensured = false;
export async function ensureWasteStorageInitialLocations(): Promise<void> {
  if (wasteStorageSeedV2Ensured) return;
  await sql`
    INSERT INTO waste_storage_locations (name, description, sort_order, active) VALUES
    ('Contenedor de basura', 'Contenedor para basura comun y basura de bano contaminada, en decaimiento', 1, true),
    ('Contenedor de ropa de cama', 'Contenedor para ropa de cama y almohadas contaminadas, en decaimiento', 2, true)
    ON CONFLICT (name) DO UPDATE SET active = true, sort_order = EXCLUDED.sort_order
  `;
  await sql`
    UPDATE waste_storage_locations SET active = false, updated_at = now()
    WHERE name IN ('Sala de Decaimiento - Estante A', 'Sala de Decaimiento - Estante B', 'Bodega de Residuos - Contenedor 1', 'Bodega de Residuos - Contenedor 2')
  `;
  wasteStorageSeedV2Ensured = true;
}

export const INSUFFICIENT_DISPENSA_INFO = "INFORMACION INSUFICIENTE PARA CALCULO DE DECAIMIENTO Y DISPENSA.";

export type DispensaResult =
  | { aplica: false; mensaje: string }
  | {
      aplica: true;
      radionuclideCode: string;
      halfLifeDays: number;
      limiteBqCm2: number;
      actividadInicialBqCm2: number;
      fechaMedicionInicial: string;
      elapsedDays: number;
      actividadResidualBqCm2: number;
      diasRestantesEstimados: number;
      fechaEstimadaLiberacion: string | null;
      estado: "APTO PARA DISPENSA" | "NO APTO PARA DISPENSA";
    };

// Calcula el estado de dispensa de un residuo por decaimiento radiactivo,
// usando A(t) = A0 * (1/2)^(t/T1/2) y, cuando corresponde, el tiempo
// necesario para alcanzar el limite: t = T1/2 * log2(A0/Alimite).
// Nunca estima A0: siempre proviene de una medicion ya registrada (Bq/cm2).
export function computeDispensa(params: {
  radionuclideCode: string | null | undefined;
  halfLifeDays: number | null | undefined;
  limiteBqCm2: number | null | undefined;
  actividadInicialBqCm2: number | null | undefined;
  fechaMedicionInicial: string | null | undefined;
  now?: Date;
}): DispensaResult {
  const { radionuclideCode, halfLifeDays, limiteBqCm2, actividadInicialBqCm2, fechaMedicionInicial } = params;
  if (
    !radionuclideCode ||
    !halfLifeDays ||
    !limiteBqCm2 ||
    actividadInicialBqCm2 === null ||
    actividadInicialBqCm2 === undefined ||
    !fechaMedicionInicial
  ) {
    return { aplica: false, mensaje: INSUFFICIENT_DISPENSA_INFO };
  }

  const now = params.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const elapsedDays = daysBetween(fechaMedicionInicial, today);
  const actividadResidualBqCm2 = estimateResidualActivity(actividadInicialBqCm2, halfLifeDays, elapsedDays) ?? 0;
  const estado: "APTO PARA DISPENSA" | "NO APTO PARA DISPENSA" =
    actividadResidualBqCm2 <= limiteBqCm2 ? "APTO PARA DISPENSA" : "NO APTO PARA DISPENSA";

  let fechaEstimadaLiberacion: string | null = null;
  let diasRestantesEstimados = 0;
  if (actividadInicialBqCm2 > limiteBqCm2) {
    const tTotalDays = halfLifeDays * (Math.log(actividadInicialBqCm2 / limiteBqCm2) / Math.log(2));
    const fecha = new Date(new Date(fechaMedicionInicial + "T00:00:00Z").getTime() + tTotalDays * 86400000);
    fechaEstimadaLiberacion = fecha.toISOString().slice(0, 10);
    diasRestantesEstimados = Math.max(0, Math.round(tTotalDays - elapsedDays));
  }

  return {
    aplica: true,
    radionuclideCode,
    halfLifeDays,
    limiteBqCm2,
    actividadInicialBqCm2,
    fechaMedicionInicial,
    elapsedDays: Math.round(elapsedDays),
    actividadResidualBqCm2,
    diasRestantesEstimados,
    fechaEstimadaLiberacion,
    estado,
  };
}


// ---------------------------------------------------------------------------
// Revision 10/08/2026 - Criterio universal de dispensa (Bq/cm2 + tasa de
// dosis), tipos de residuo ampliados, N de lote y proyeccion SIEMPRE desde
// la ultima medicion real (no desde la actividad inicial de generacion).
// Ver PROMPT MAESTRO - Sistema de Contaminacion, Liberacion de Sala y
// Gestion de Desechos Radiactivos.
// ---------------------------------------------------------------------------

export type WasteMeasurementTipo = "seguimiento" | "verificacion_final" | "dispensa";

export const WASTE_MEASUREMENT_TIPO_LABELS: Record<WasteMeasurementTipo, string> = {
    seguimiento: "Seguimiento (decaimiento)",
    verificacion_final: "Verificacion final",
    dispensa: "Dispensa",
};

// Criterio universal: se aplica a TODOS los tipos de residuo de este modulo.
// Bq/cm2 <= 4 Y tasa de dosis < 2.5 uSv/h (estrictamente menor). Ambos
// parametros son independientes: la tasa de dosis nunca se deriva de la
// actividad superficial calculada.
export const CRITERIO_UNIVERSAL_BQ_CM2 = 4;
export const CRITERIO_UNIVERSAL_TASA_DOSIS_USVH = 2.5;

export function evaluaCriterioUniversal(
    bqCm2: number | null | undefined,
    tasaDosisUsvH: number | null | undefined
  ): { cumpleContaminacion: boolean; cumpleTasaDosis: boolean; apto: boolean } {
    const cumpleContaminacion = bqCm2 !== null && bqCm2 !== undefined && bqCm2 <= CRITERIO_UNIVERSAL_BQ_CM2;
    const cumpleTasaDosis =
          tasaDosisUsvH !== null && tasaDosisUsvH !== undefined && tasaDosisUsvH < CRITERIO_UNIVERSAL_TASA_DOSIS_USVH;
    return { cumpleContaminacion, cumpleTasaDosis, apto: cumpleContaminacion && cumpleTasaDosis };
}

// Tipos de residuo ampliados: capacho I-131, generador Mo-99/Tc-99m y
// cortopunzante Tc-99m se generan de forma independiente (no requieren un
// Acta de Liberacion de Sala); ropa de cama / basura comun / basura de bano
// siguen proviniendo del Acta de un paciente hospitalizado.
export const WASTE_TYPE_OPTIONS_V2: { value: string; label: string; radionuclide_code: string | null }[] = [
  { value: "capacho_i131", label: "Capacho I-131", radionuclide_code: "I-131" },
  { value: "generador_mo99_tc99m", label: "Generador Mo-99/Tc-99m", radionuclide_code: "MO99-TC99M" },
  { value: "cortopunzante_tc99m", label: "Cortopunzante Tc-99m", radionuclide_code: "TC-99M" },
  { value: "ropa_cama", label: "Ropa de cama", radionuclide_code: null },
  { value: "basura_comun", label: "Basura comun", radionuclide_code: null },
  { value: "basura_bano", label: "Basura de bano", radionuclide_code: null },
  { value: "otro", label: "Otro", radionuclide_code: null },
  ];

export function isStandaloneWasteType(wasteType: string | null | undefined): boolean {
    return wasteType === "capacho_i131" || wasteType === "generador_mo99_tc99m" || wasteType === "cortopunzante_tc99m";
}

export function formatWasteLotNumber(radionuclideCode: string | null | undefined, date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const codeShort = (radionuclideCode || "RN").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return `L-${codeShort}-${y}-${m}${d}`;
}

let wasteMeasurementsTableEnsured = false;
export async function ensureWasteMeasurementsTable(): Promise<void> {
    if (wasteMeasurementsTableEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_measurements (
              id SERIAL PRIMARY KEY,
                    label_id INTEGER NOT NULL REFERENCES radioactive_waste_labels(id) ON DELETE CASCADE,
                          tipo TEXT NOT NULL DEFAULT 'seguimiento',
                                fecha DATE NOT NULL,
                                      hora TIME,
                                            cps NUMERIC,
                                                  cps_fondo NUMERIC,
                                                        cps_neto NUMERIC,
                                                              bq_cm2 NUMERIC,
                                                                    tasa_dosis_usv_h NUMERIC,
                                                                          instrumento TEXT,
                                                                                usuario TEXT,
                                                                                      cumple_contaminacion BOOLEAN,
                                                                                            cumple_tasa_dosis BOOLEAN,
                                                                                                  resultado TEXT,
                                                                                                        observaciones TEXT,
                                                                                                              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                  );
                                                                                                                    `;
    await sql`CREATE INDEX IF NOT EXISTS waste_measurements_label_id_idx ON waste_measurements(label_id)`;
    wasteMeasurementsTableEnsured = true;
}

let wasteLabelDispensaV2ColumnsEnsured = false;
export async function ensureWasteLabelDispensaV2Columns(): Promise<void> {
    if (wasteLabelDispensaV2ColumnsEnsured) return;
    await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS lot_number TEXT`;
    await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS dispensa_estado TEXT NOT NULL DEFAULT 'en_decaimiento'`;
    await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS fecha_estimada_liberacion DATE`;
    await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS fecha_dispensa DATE`;
    await sql`ALTER TABLE radioactive_waste_labels ADD COLUMN IF NOT EXISTS dispensado_por TEXT`;
    wasteLabelDispensaV2ColumnsEnsured = true;
}

export const WASTE_DISPENSA_ESTADO_LABELS: Record<string, string> = {
    en_decaimiento: "En decaimiento",
    pendiente_verificacion_final: "Pendiente de verificacion final",
    no_apto: "No apto - continua en decaimiento",
    apto_para_dispensa: "Apto para dispensa",
    dispensado: "Dispensado",
};

let wasteRadionuclidesV2Ensured = false;
export async function ensureWasteRadionuclidesV2(): Promise<void> {
    if (wasteRadionuclidesV2Ensured) return;
    await sql`
        INSERT INTO radionuclides (code, name, half_life_days, unit, release_criteria_dose_rate_usvh, active, sort_order, notes)
            VALUES
                  ('I-131', 'Yodo-131', 8.02, 'mCi', 2.5, true, 1, 'Vida media fisica. Criterio de dispensa universal Bq/cm2<=4 y usv/h<2.5.'),
                        ('MO-99', 'Molibdeno-99 (generador)', 2.75, 'mCi', 2.5, true, 2, 'Vida media fisica del Mo-99 (padre). Gobierna el decaimiento de largo plazo de un generador Mo-99/Tc-99m por equilibrio transitorio con el Tc-99m.'),
                              ('TC-99M', 'Tecnecio-99m', 0.2506, 'mCi', 2.5, true, 3, 'Vida media fisica (6.01 horas).')
                                  ON CONFLICT (code) DO UPDATE SET
                                        half_life_days = EXCLUDED.half_life_days,
                                              release_criteria_dose_rate_usvh = EXCLUDED.release_criteria_dose_rate_usvh,
                                                    active = true,
                                                          notes = EXCLUDED.notes
                                                            `;
    wasteRadionuclidesV2Ensured = true;
}

let wasteReleaseLimitsUniversalV2Ensured = false;
export async function ensureWasteReleaseLimitsUniversalV2(): Promise<void> {
    if (wasteReleaseLimitsUniversalV2Ensured) return;
    await ensureWasteReleaseLimitsTable();
    await sql`ALTER TABLE waste_release_limits ADD COLUMN IF NOT EXISTS tasa_dosis_limite_usvh NUMERIC NOT NULL DEFAULT 2.5`;
    await sql`
        UPDATE waste_release_limits SET
              limit_bq_cm2 = 4,
                    tasa_dosis_limite_usvh = 2.5,
                          half_life_days = CASE WHEN radionuclide_code = 'MO99-TC99M' THEN 2.75 ELSE half_life_days END,
                                notes = CASE WHEN radionuclide_code = 'MO99-TC99M' THEN 'Actualizado 10/08/2026: criterio universal Bq/cm2<=4 y usv/h<2.5. Vida media usada para el decaimiento del generador: Mo-99 (2.75 dias), por equilibrio transitorio con Tc-99m. Valor parametrizable, debe ser validado por el Oficial de Proteccion Radiologica.' ELSE 'Actualizado 10/08/2026: criterio universal Bq/cm2<=4 y usv/h<2.5 aplicado a todos los tipos de residuo del modulo.' END,
                                      updated_at = now()
                                        `;
    wasteReleaseLimitsUniversalV2Ensured = true;
}

export async function ensureWasteEngineV2(): Promise<void> {
    await ensureWasteLabelDispensaColumns();
    await ensureWasteLabelDispensaV2Columns();
    await ensureWasteReleaseLimitsTable();
    await ensureWasteReleaseLimitsUniversalV2();
    await ensureWasteRadionuclidesV2();
    await ensureWasteMeasurementsTable();
    await ensureWasteStorageInitialLocations();
}

// Proyeccion de la fecha estimada de eliminacion: SIEMPRE a partir de la
// ULTIMA medicion real de actividad superficial (Bq/cm2), nunca desde la
// actividad inicial de generacion. Si la ultima medicion ya esta en o bajo
// el limite universal, no hay tiempo adicional de decaimiento pendiente
// respecto del criterio de contaminacion y el residuo pasa a
// "pendiente_verificacion_final".
export function computeProyeccionDesdeUltimaMedicion(params: {
    ultimaBqCm2: number | null | undefined;
    fechaUltimaMedicion: string | null | undefined;
    halfLifeDays: number | null | undefined;
    limiteBqCm2?: number;
    now?: Date;
}): {
    aplica: boolean;
    mensaje?: string;
    fechaEstimadaLiberacion: string | null;
    diasRestantesEstimados: number;
    estado: "en_decaimiento" | "pendiente_verificacion_final";
} {
    const limite = params.limiteBqCm2 ?? CRITERIO_UNIVERSAL_BQ_CM2;
    const { ultimaBqCm2, fechaUltimaMedicion, halfLifeDays } = params;
    if (ultimaBqCm2 === null || ultimaBqCm2 === undefined || !fechaUltimaMedicion || !halfLifeDays) {
          return {
                  aplica: false,
                  mensaje: INSUFFICIENT_DISPENSA_INFO,
                  fechaEstimadaLiberacion: null,
                  diasRestantesEstimados: 0,
                  estado: "en_decaimiento",
          };
    }
    if (ultimaBqCm2 <= limite) {
          return {
                  aplica: true,
                  fechaEstimadaLiberacion: null,
                  diasRestantesEstimados: 0,
                  estado: "pendiente_verificacion_final",
          };
    }
    const tTotalDays = halfLifeDays * (Math.log(ultimaBqCm2 / limite) / Math.log(2));
    const fecha = new Date(new Date(fechaUltimaMedicion + "T00:00:00Z").getTime() + tTotalDays * 86400000);
    const hoy = params.now ?? new Date();
    const elapsedDays = daysBetween(fechaUltimaMedicion, hoy.toISOString().slice(0, 10));
    return {
          aplica: true,
          fechaEstimadaLiberacion: fecha.toISOString().slice(0, 10),
          diasRestantesEstimados: Math.max(0, Math.round(tTotalDays - elapsedDays)),
          estado: "en_decaimiento",
    };
}

// Correccion: mapa robusto (independiente de WASTE_TYPE_OPTIONS_V2) del
// radionuclido FISICO a registrar en radioactive_waste_labels.radionuclide_code
// para tipos de residuo generados de forma independiente. Debe existir en la
// tabla "radionuclides" (restriccion de llave foranea). Para el generador se
// usa Mo-99 (el radionuclido padre, de vida media mas larga, que gobierna el
// decaimiento de largo plazo por equilibrio transitorio con el Tc-99m); para
// el cortopunzante se usa Tc-99m puro.
export const STANDALONE_WASTE_TYPE_RADIONUCLIDE: Record<string, string> = {
    capacho_i131: "I-131",
    generador_mo99_tc99m: "MO-99",
    cortopunzante_tc99m: "TC-99M",
};

let wasteRoomReleaseIdNullableEnsured = false;
export async function ensureWasteRoomReleaseIdNullable(): Promise<void> {
    if (wasteRoomReleaseIdNullableEnsured) return;
    await sql`ALTER TABLE radioactive_waste_labels ALTER COLUMN room_release_id DROP NOT NULL`;
    wasteRoomReleaseIdNullableEnsured = true;
}

// Vida media fisica del radionuclido: unica fuente de verdad para todos los
// calculos de decaimiento del modulo (tabla parametrizable "radionuclides").
export async function getHalfLifeDaysForRadionuclide(code: string | null | undefined): Promise<number | null> {
    if (!code) return null;
    const { rows } = await sql`SELECT half_life_days FROM radionuclides WHERE code = ${code}`;
    const v = rows[0]?.half_life_days;
    return v === null || v === undefined ? null : Number(v);
}
