/**
 * MODULO 4 - PET/CT
 * Motor de calculo del sistema de Control de Calidad.
 *
 * REGLA FUNDAMENTAL (Prompt maestro CC, seccion 3): el operador introduce
 * unicamente los datos medidos/reportados por el equipo. Toda clasificacion
 * contra tolerancia se realiza aqui, nunca manualmente por el usuario.
 *
 * Funciones puras (sin efectos secundarios, sin acceso a BD). Modulo
 * independiente de Activimetro (Modulo 1), Gammacamara (Modulo 2) y SPECT
 * (Modulo 3): no reutiliza sus archivos de calculo, para no mezclar logicas
 * de modulos distintos, aunque las formulas estadisticas base son las
 * mismas matematicas generales.
 */

export type ResultStatus = "cumple" | "advertencia" | "no_cumple" | "pendiente_revision";

export function mean(values: number[]): number {
  if (!values.length) return NaN;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (!m) return NaN;
  return (stddev(values) / m) * 100;
}

export function evaluateTolerance(
  observedPercent: number,
  tolerancePercent: number | null | undefined,
  warningPercent?: number | null
): ResultStatus {
  if (tolerancePercent === null || tolerancePercent === undefined || Number.isNaN(observedPercent)) {
    return "pendiente_revision";
  }
  const abs = Math.abs(observedPercent);
  if (abs > tolerancePercent) return "no_cumple";
  if (warningPercent && abs > tolerancePercent - warningPercent) return "advertencia";
  return "cumple";
}

const STATUS_SEVERITY: Record<ResultStatus, number> = {
  cumple: 0,
  advertencia: 1,
  pendiente_revision: 2,
  no_cumple: 3,
};

export function worseStatus(a: ResultStatus, b: ResultStatus): ResultStatus {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

// ---- Calibracion Cruzada (Cross-Calibration) ----
// El PET/CT no se evalua comparando una lectura contra un valor ideal fijo
// (como el Centro de Rotacion de SPECT), sino comparando la concentracion de
// actividad (Bq/mL) que el software del PET reporta para un maniqui/fuente,
// contra la concentracion de referencia obtenida de forma independiente con
// el activimetro (Modulo 1) y la geometria del maniqui. Esta comparacion
// entre dos instrumentos distintos es exclusiva de PET (sustento de la
// exactitud del SUV) y no existe en Modulo 2 ni Modulo 3.

export interface CrossCalibrationInput {
  measuredActivityConcentration: number;
  referenceActivityConcentration: number;
  tolerancePercent: number | null;
  warningPercent?: number | null;
}

export interface CrossCalibrationOutput {
  percentDeviation: number;
  status: ResultStatus;
}

export function calculateCrossCalibration(input: CrossCalibrationInput): CrossCalibrationOutput {
  const { measuredActivityConcentration, referenceActivityConcentration, tolerancePercent, warningPercent } = input;
  if (!referenceActivityConcentration) {
    return { percentDeviation: NaN, status: "pendiente_revision" };
  }
  const percentDeviation =
    ((measuredActivityConcentration - referenceActivityConcentration) / referenceActivityConcentration) * 100;
  const status = evaluateTolerance(percentDeviation, tolerancePercent, warningPercent);
  return { percentDeviation, status };
}

// ---- Uniformidad de Imagen PET ----
// El operador ingresa el valor de uniformidad integral (%) ya calculado por
// el software de reconstruccion/control de calidad del PET sobre los cortes
// del maniqui cilindrico uniforme, analogo conceptualmente a la uniformidad
// tomografica de Modulo 3, pero medido sobre una reconstruccion PET (con
// correccion de atenuacion, dispersion y coincidencias aleatorias propias de
// la deteccion en coincidencia), no sobre una reconstruccion SPECT. Este
// motor solo clasifica ese valor contra la tolerancia.

export interface PetImageUniformityInput {
  uniformityPercent: number;
  tolerancePercent: number | null;
  warningPercent?: number | null;
}

export interface PetImageUniformityOutput {
  status: ResultStatus;
}

export function calculatePetImageUniformity(input: PetImageUniformityInput): PetImageUniformityOutput {
  const { uniformityPercent, tolerancePercent, warningPercent } = input;
  const status = evaluateTolerance(uniformityPercent, tolerancePercent, warningPercent);
  return { status };
}

// ---- FASE B: PET-01 a PET-06 (pruebas de aceptacion y control de calidad
// PET segun IAEA Human Health Series No. 1, seccion 5 del prompt de mejora) ----
// El operador ingresa unicamente los valores medidos/reportados; el motor
// calcula la razon observado/esperado y clasifica el resultado. Estas
// pruebas usan su propio tipo de resultado (PetAcceptanceStatus) porque el
// prompt exige distinguir CUMPLE / NO CUMPLE / REQUIERE REVISION / NO
// APLICA, distinto del ResultStatus porcentual usado arriba en calibracion
// cruzada y uniformidad.

export type PetAcceptanceStatus = "cumple" | "no_cumple" | "requiere_revision" | "no_aplica";

function ratioUpperBoundStatus(
  ratio: number,
  upperBound: number
): { ratio: number; status: PetAcceptanceStatus; marginFraction: number } {
  const marginFraction = (ratio - 1) / (upperBound - 1);
  const status: PetAcceptanceStatus = ratio < upperBound ? "cumple" : "no_cumple";
  return { ratio, status, marginFraction };
}

function ratioLowerBoundStatus(
  ratio: number,
  lowerBound: number
): { ratio: number; status: PetAcceptanceStatus; marginFraction: number } {
  const marginFraction = (1 - ratio) / (1 - lowerBound);
  const status: PetAcceptanceStatus = ratio > lowerBound ? "cumple" : "no_cumple";
  return { ratio, status, marginFraction };
}

// Nivel de accion (seccion 18 del prompt): separa la simple tolerancia
// (cumple/no cumple) de una alerta temprana cuando el resultado, aunque
// dentro de tolerancia, se acerca al limite (>= 80% del margen disponible).
// No reemplaza el analisis de tendencia/control chart de Fase E; es una
// primera senal basada solo en el resultado puntual.
export type PetActionLevel = "normal" | "advertencia" | "no_conformidad" | "no_aplica";

export function deriveActionLevel(status: PetAcceptanceStatus, marginFraction: number | null): PetActionLevel {
  if (status === "no_aplica") return "no_aplica";
  if (status === "no_cumple") return "no_conformidad";
  if (marginFraction !== null && marginFraction >= 0.8) return "advertencia";
  return "normal";
}

// PET-01: Resolucion espacial. Criterio: FWHM observada < 1.05 x FWHM esperada.
export interface Pet01Input {
  fwhmObservedMm: number;
  fwhmExpectedMm: number;
}
export interface Pet01Output {
  ratio: number;
  status: PetAcceptanceStatus;
  actionLevel: PetActionLevel;
}
export function calculatePet01(input: Pet01Input): Pet01Output {
  if (!input.fwhmExpectedMm) {
    return { ratio: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const { ratio, status, marginFraction } = ratioUpperBoundStatus(input.fwhmObservedMm / input.fwhmExpectedMm, 1.05);
  return { ratio, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// PET-02: Sensibilidad. Criterio: STOT observada > 0.95 x STOT esperada.
export interface Pet02Input {
  sTotObservedCps: number;
  sTotExpectedCps: number;
}
export interface Pet02Output {
  ratio: number;
  status: PetAcceptanceStatus;
  actionLevel: PetActionLevel;
}
export function calculatePet02(input: Pet02Input): Pet02Output {
  if (!input.sTotExpectedCps) {
    return { ratio: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const { ratio, status, marginFraction } = ratioLowerBoundStatus(input.sTotObservedCps / input.sTotExpectedCps, 0.95);
  return { ratio, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// PET-03: Fraccion de dispersion (SF), perdidas de conteo y randoms (NEC).
// Criterio: SF observada < 1.05 x SF esperada; NEC observada >= NEC recomendada.
export interface Pet03Input {
  scatterFractionObserved: number;
  scatterFractionExpected: number;
  trueCountRateKcps: number;
  randomCountRateKcps: number;
  scatterCountRateKcps: number;
  necObservedKcps: number;
  necRecommendedKcps: number;
  activityMbq: number;
}
export interface Pet03Output {
  sfRatio: number;
  sfStatus: PetAcceptanceStatus;
  necStatus: PetAcceptanceStatus;
  status: PetAcceptanceStatus;
  actionLevel: PetActionLevel;
}
export function calculatePet03(input: Pet03Input): Pet03Output {
  const sf = input.scatterFractionExpected
    ? ratioUpperBoundStatus(input.scatterFractionObserved / input.scatterFractionExpected, 1.05)
    : { ratio: NaN, status: "requiere_revision" as PetAcceptanceStatus, marginFraction: null as number | null };
  const necStatus: PetAcceptanceStatus = input.necRecommendedKcps
    ? input.necObservedKcps >= input.necRecommendedKcps
      ? "cumple"
      : "no_cumple"
    : "requiere_revision";
  const necMargin = input.necRecommendedKcps
    ? (input.necRecommendedKcps - input.necObservedKcps) / input.necRecommendedKcps
    : null;
  const combinedStatus: PetAcceptanceStatus =
    sf.status === "no_cumple" || necStatus === "no_cumple"
      ? "no_cumple"
      : sf.status === "requiere_revision" || necStatus === "requiere_revision"
      ? "requiere_revision"
      : "cumple";
  const margins = [sf.marginFraction, necMargin].filter((m): m is number => m !== null);
  const marginFraction = margins.length ? Math.max(...margins) : null;
  return {
    sfRatio: sf.ratio,
    sfStatus: sf.status,
    necStatus,
    status: combinedStatus,
    actionLevel: deriveActionLevel(combinedStatus, marginFraction),
  };
}

// PET-04: Resolucion energetica. Criterio: RE observada < 1.05 x RE esperada.
export interface Pet04Input {
  energyResolutionObservedPercent: number;
  energyResolutionExpectedPercent: number;
}
export interface Pet04Output {
  ratio: number;
  status: PetAcceptanceStatus;
  actionLevel: PetActionLevel;
}
export function calculatePet04(input: Pet04Input): Pet04Output {
  if (!input.energyResolutionExpectedPercent) {
    return { ratio: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const { ratio, status, marginFraction } = ratioUpperBoundStatus(
    input.energyResolutionObservedPercent / input.energyResolutionExpectedPercent,
    1.05
  );
  return { ratio, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// PET-05: Calidad de imagen y exactitud de correccion de atenuacion/dispersion.
// Evaluacion NO puramente numerica (seccion 5.5 del prompt): el operador
// reporta el comportamiento observado por componente (uniformidad,
// contraste, recuperacion, artefactos, exactitud de concentracion,
// comportamiento de esferas, correccion de atenuacion/dispersion) y el
// motor solo consolida el estado global: si algun componente es NO CUMPLE,
// el resultado global es NO CUMPLE; si ninguno es NO CUMPLE pero alguno
// requiere revision, el global es REQUIERE REVISION.
export type Pet05ComponentStatus = "cumple" | "no_cumple" | "requiere_revision";
export interface Pet05Input {
  uniformity: Pet05ComponentStatus;
  contrast: Pet05ComponentStatus;
  recovery: Pet05ComponentStatus;
  artifacts: Pet05ComponentStatus;
  concentrationAccuracy: Pet05ComponentStatus;
  sphereBehavior: Pet05ComponentStatus;
  attenuationScatterCorrection: Pet05ComponentStatus;
}
export interface Pet05Output {
  status: PetAcceptanceStatus;
}
export function calculatePet05(input: Pet05Input): Pet05Output {
  const components = Object.values(input);
  const status: PetAcceptanceStatus = components.includes("no_cumple")
    ? "no_cumple"
    : components.includes("requiere_revision")
    ? "requiere_revision"
    : "cumple";
  return { status };
}

// PET-06: Coincidencia temporal (TOF). NO APLICA si el equipo no tiene TOF
// (secciones 5.6 y 8 del prompt): nunca se muestra como incumplimiento.
export interface Pet06Input {
  hasTof: boolean;
  timingResolutionObservedPs: number;
  timingResolutionExpectedPs: number;
}
export interface Pet06Output {
  ratio: number | null;
  status: PetAcceptanceStatus;
  actionLevel: PetActionLevel;
}
export function calculatePet06(input: Pet06Input): Pet06Output {
  if (!input.hasTof) {
    return { ratio: null, status: "no_aplica", actionLevel: "no_aplica" };
  }
  if (!input.timingResolutionExpectedPs) {
    return { ratio: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const { ratio, status, marginFraction } = ratioUpperBoundStatus(
    input.timingResolutionObservedPs / input.timingResolutionExpectedPs,
    1.05
  );
  return { ratio, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// Correccion por decaimiento (seccion 13 del prompt): todo calculo que
// involucre actividad debe pasar por aqui; el operador nunca calcula la
// correccion manualmente.
export interface DecayCorrectionInput {
  initialActivity: number;
  halfLifeMinutes: number;
  initialDateTimeIso: string;
  referenceDateTimeIso: string;
}
export interface DecayCorrectionOutput {
  correctedActivity: number;
  elapsedMinutes: number;
}
export function calculateDecayCorrection(input: DecayCorrectionInput): DecayCorrectionOutput {
  const elapsedMs = new Date(input.referenceDateTimeIso).getTime() - new Date(input.initialDateTimeIso).getTime();
  const elapsedMinutes = elapsedMs / 60000;
  const correctedActivity = input.initialActivity * Math.pow(0.5, elapsedMinutes / input.halfLifeMinutes);
  return { correctedActivity, elapsedMinutes };
}
