// ─── lib/petct.ts ─────────────────────────────────────────────────────────────
// Física y tipos para el módulo PET/CT
// Referencias: DS 133/1984 (Chile), CCHEN, IAEA Safety Reports Series No. 58,
//              IAEA Human Health Series No. 1 (Good Practice for PET/CT)

export const PETCT_RADIONUCLIDES = ["F-18", "Ga-68", "C-11", "Zr-89", "Cu-64"] as const;
export type PetctRadionuclide = typeof PETCT_RADIONUCLIDES[number];

export const PETCT_RADIOPHARMACEUTICALS = [
  "F-18 FDG",
  "F-18 NaF",
  "F-18 PSMA-1007",
  "F-18 Fluciclovine",
  "Ga-68 PSMA-11",
  "Ga-68 DOTATATE",
  "Ga-68 DOTATOC",
  "C-11 Choline",
  "C-11 Metionina",
  "Zr-89 Trastuzumab",
  "Cu-64 DOTATATE",
] as const;
export type PetctRadiopharmaceutical = (typeof PETCT_RADIOPHARMACEUTICALS)[number];

export const PETCT_EXAM_STATES = [
  "programado",
  "en_espera",
  "en_examen",
  "completado",
  "cancelado",
] as const;
export type PetctExamState = (typeof PETCT_EXAM_STATES)[number];

export const PETCT_EXAM_STATE_LABELS: Record<PetctExamState, string> = {
  programado: "Programado",
  en_espera: "En sala de espera (uptake)",
  en_examen: "En examen",
  completado: "Completado",
  cancelado: "Cancelado",
};

// Semividas en minutos
export const HALF_LIFE_MINUTES: Record<PetctRadionuclide, number> = {
  "F-18": 109.8,
  "Ga-68": 67.7,
  "C-11": 20.4,
  "Zr-89": 78.4 * 60,
  "Cu-64": 12.7 * 60,
};

export const PHARMA_DEFAULTS: Record<
  string,
  { min_mbq_kg: number; max_mbq_kg: number; uptake_min: number; radionuclide: PetctRadionuclide }
> = {
  "F-18 FDG":          { min_mbq_kg: 3.0, max_mbq_kg: 5.0, uptake_min: 60, radionuclide: "F-18" },
  "F-18 NaF":          { min_mbq_kg: 2.0, max_mbq_kg: 3.0, uptake_min: 60, radionuclide: "F-18" },
  "F-18 PSMA-1007":    { min_mbq_kg: 3.0, max_mbq_kg: 4.0, uptake_min: 60, radionuclide: "F-18" },
  "F-18 Fluciclovine": { min_mbq_kg: 3.7, max_mbq_kg: 3.7, uptake_min: 3,  radionuclide: "F-18" },
  "Ga-68 PSMA-11":     { min_mbq_kg: 1.5, max_mbq_kg: 3.0, uptake_min: 60, radionuclide: "Ga-68" },
  "Ga-68 DOTATATE":    { min_mbq_kg: 1.5, max_mbq_kg: 3.0, uptake_min: 60, radionuclide: "Ga-68" },
  "Ga-68 DOTATOC":     { min_mbq_kg: 1.5, max_mbq_kg: 2.5, uptake_min: 60, radionuclide: "Ga-68" },
  "C-11 Choline":      { min_mbq_kg: 3.7, max_mbq_kg: 3.7, uptake_min: 5,  radionuclide: "C-11" },
  "C-11 Metionina":    { min_mbq_kg: 4.0, max_mbq_kg: 6.0, uptake_min: 20, radionuclide: "C-11" },
  "Zr-89 Trastuzumab": { min_mbq_kg: 0.9, max_mbq_kg: 1.1, uptake_min: 4320, radionuclide: "Zr-89" },
  "Cu-64 DOTATATE":    { min_mbq_kg: 2.0, max_mbq_kg: 3.0, uptake_min: 60, radionuclide: "Cu-64" },
};

/** A(t) = A₀ · 2^(−t / T½) */
export function calcDecay(a0_mbq: number, elapsed_min: number, radionuclide: PetctRadionuclide): number {
  const t_half = HALF_LIFE_MINUTES[radionuclide];
  if (!t_half || elapsed_min < 0) return a0_mbq;
  return a0_mbq * Math.pow(2, -elapsed_min / t_half);
}

// Constante de dosis Γ para estimación rápida de tasa de dosis a 1 m.
//
// IAEA SRS-58 (2004), Tabla 2, Γ(F-18) ≈ 0,143 μSv·m²/(MBq·h).
// Esta constante corresponde a los fotones de aniquilación de 511 keV de los
// emisores β⁺. Es una buena aproximación para F-18, Ga-68 y C-11 (emisores
// casi puros de β⁺ cuyo Γ varía menos del 3% entre sí). Para Zr-89
// (T½ = 78,4 h) la constante efectiva es mayor (~0,18 μSv·m²/(MBq·h)) por
// la línea γ adicional de 909 keV (I ≈ 99 %); con la constante de F-18 el
// sistema subestima la tasa de dosis de Zr-89 en ~20 %. Para Cu-64 la
// diferencia respecto de F-18 es <5 % (Γ ≈ 0,15).
//
// OPR: para Zr-89 usar Γ ≈ 0,18 μSv·m²/(MBq·h) o el valor certificado por
// el fabricante del radiofármaco. Considerar agregar un mapa
// GAMMA_CONSTANT_BY_RADIONUCLIDE cuando Zr-89 esté activo en el HHHA.
export const GAMMA_CONSTANT_F18_USVH_M2_PER_MBQ_H = 0.143;

/**
 * Tasa de dosis estimada a 1 m del paciente (μSv/h).
 * Usa Γ(F-18) = 0.143 μSv·m²/(MBq·h) como aproximación para todos los
 * emisores β⁺ del módulo. Ver nota GAMMA_CONSTANT_F18 para limitaciones
 * con Zr-89.
 */
export function doseRateAt1m_usvh(activity_mbq: number): number {
  return GAMMA_CONSTANT_F18_USVH_M2_PER_MBQ_H * activity_mbq;
}

// Umbral de tasa de dosis para alta de paciente PET.
// 25 μSv/h a 1 m es el criterio conservador habitual en medicina nuclear
// (equivalente a 2,5 mR/h, adoptado internacionalmente como criterio de
// referencia para alta ambulatoria de pacientes con β⁺ de corta semivida).
// PENDIENTE OPR: confirmar que este valor coincide con el criterio
// establecido en la autorización CCHEN vigente del HHHA. Para pacientes con
// Zr-89 (T½ largo) el cálculo puede subestimarse por la constante de dosis
// aproximada (ver comentario GAMMA_CONSTANT_F18).
export const DOSE_RELEASE_THRESHOLD_USVH = 25;

/**
 * Minutos hasta que la tasa de dosis a 1 m cae bajo el umbral.
 * CCHEN / DS 133: se usa 25 μSv/h como criterio conservador de referencia.
 * Proyecta desde la actividad administrada (a0_mbq), no desde la actividad
 * actual, para planificación de alta desde el momento de inyección.
 */
export function minutesToBelowDoseRate(
  a0_mbq: number,
  radionuclide: PetctRadionuclide,
  threshold_usvh = DOSE_RELEASE_THRESHOLD_USVH
): number {
  const t_half = HALF_LIFE_MINUTES[radionuclide];
  const current = doseRateAt1m_usvh(a0_mbq);
  if (current <= threshold_usvh) return 0;
  return t_half * Math.log2(current / threshold_usvh);
}

export interface PetctExam {
  id: string;
  patient_id: string;
  patient_name: string | null;
  radiopharmaceutical: string;
  radionuclide: PetctRadionuclide;
  administered_mbq: number;
  patient_weight_kg: number | null;
  injection_datetime: string;
  uptake_minutes: number;
  exam_start: string | null;
  exam_end: string | null;
  state: PetctExamState;
  operator: string;
  prescribing_physician: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PetctQc {
  id: string;
  qc_date: string;
  phantom_type: string;
  uniformity_pass: boolean;
  count_rate_mcps: number | null;
  image_quality_pass: boolean;
  comments: string | null;
  performed_by: string;
  created_at: string;
}

export interface PetctDerived {
  elapsed_minutes: number;
  current_activity_mbq: number;
  dose_rate_1m_usvh: number;
  uptake_complete: boolean;
  minutes_to_release: number;
  release_datetime: string;
  uptake_remaining_min: number;
}

export function calcPetctDerived(exam: PetctExam): PetctDerived {
  const now = Date.now();
  const injTime = new Date(exam.injection_datetime).getTime();
  const elapsed_minutes = (now - injTime) / 60_000;
  const current_activity_mbq = calcDecay(exam.administered_mbq, elapsed_minutes, exam.radionuclide);
  const dose_rate_1m_usvh = doseRateAt1m_usvh(current_activity_mbq);
  const uptake_complete = elapsed_minutes >= exam.uptake_minutes;
  const uptake_remaining_min = Math.max(0, exam.uptake_minutes - elapsed_minutes);
  const minutes_to_release = minutesToBelowDoseRate(exam.administered_mbq, exam.radionuclide, 25);
  const release_datetime = new Date(injTime + minutes_to_release * 60_000).toISOString();
  return {
    elapsed_minutes,
    current_activity_mbq,
    dose_rate_1m_usvh,
    uptake_complete,
    minutes_to_release,
    release_datetime,
    uptake_remaining_min,
  };
}
