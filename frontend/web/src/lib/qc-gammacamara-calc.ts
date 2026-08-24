/**
 * MODULO 2 - GAMMACAMARA
 * Motor de calculo del sistema de Control de Calidad.
 *
 * REGLA FUNDAMENTAL (Prompt maestro CC, seccion 3): el operador introduce
 * unicamente los datos medidos/reportados por el equipo. Toda clasificacion
 * contra tolerancia se realiza aqui, nunca manualmente por el usuario.
 *
 * Funciones puras (sin efectos secundarios, sin acceso a BD) para poder ser
 * verificadas y reutilizadas tanto en el backend (API) como en el frontend
 * (vista previa antes de guardar). Modulo independiente de Activimetro
 * (Modulo 1): no reutiliza su archivo de calculo, para no mezclar logicas
 * de modulos distintos, aunque las formulas estadisticas base son las mismas
 * matematicas generales.
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

export function percentDifference(measuredValue: number, referenceValue: number): number {
  if (!referenceValue) return NaN;
  return ((measuredValue - referenceValue) / referenceValue) * 100;
}

export function decayConstant(halfLifeMinutes: number): number {
  if (!halfLifeMinutes) return NaN;
  return Math.LN2 / halfLifeMinutes;
}

export function decayCorrectActivity(
  activity: number,
  halfLifeMinutes: number,
  elapsedMinutes: number,
  direction: "forward" | "backward" = "forward"
): number {
  const lambda = decayConstant(halfLifeMinutes);
  if (Number.isNaN(lambda)) return NaN;
  const factor = Math.exp(-lambda * elapsedMinutes);
  return direction === "forward" ? activity * factor : activity / factor;
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

// ---- Uniformidad: integral % + diferencial %, cada uno con su propia tolerancia ----
// El operador ingresa los valores de uniformidad integral y diferencial ya
// calculados por el software de adquisicion de la propia gammacamara sobre
// la imagen de flood (intrinseca o extrinseca); este motor solo clasifica
// cada valor contra su tolerancia y determina el estado global (el peor de
// los dos), sin recalcular la imagen ni los pixeles originales.

export interface UniformityInput {
  integralPercent: number;
  differentialPercent: number;
  toleranceIntegral: number | null;
  toleranceDifferential: number | null;
  warningIntegral?: number | null;
  warningDifferential?: number | null;
}

export interface UniformityOutput {
  integralStatus: ResultStatus;
  differentialStatus: ResultStatus;
  overallStatus: ResultStatus;
  worstParameter: "integral_percent" | "differential_percent" | null;
}

export function calculateUniformity(input: UniformityInput): UniformityOutput {
  const integralStatus = evaluateTolerance(input.integralPercent, input.toleranceIntegral, input.warningIntegral);
  const differentialStatus = evaluateTolerance(input.differentialPercent, input.toleranceDifferential, input.warningDifferential);
  const overallStatus = worseStatus(integralStatus, differentialStatus);
  let worstParameter: "integral_percent" | "differential_percent" | null = null;
  if (STATUS_SEVERITY[integralStatus] > STATUS_SEVERITY[differentialStatus]) worstParameter = "integral_percent";
  else if (STATUS_SEVERITY[differentialStatus] > STATUS_SEVERITY[integralStatus]) worstParameter = "differential_percent";
  return { integralStatus, differentialStatus, overallStatus, worstParameter };
}

// ---- Resolucion / Sensibilidad: lecturas promediadas vs valor de referencia (basal de aceptacion) ----
// Ambas pruebas comparten la misma logica: el operador puede repetir la
// lectura (p. ej. varias determinaciones del FWHM del patron de barras, o
// varias mediciones de tasa de conteo), el sistema promedia, calcula
// dispersion y compara el promedio contra el valor basal de referencia
// (establecido en la prueba de aceptacion del equipo).

export interface ReferenceComparisonInput {
  readings: number[];
  referenceValue: number | null;
  tolerancePercent: number | null;
  warningPercent?: number | null;
}

export interface ReferenceComparisonOutput {
  numReadings: number;
  meanValue: number;
  stddevValue: number;
  cvPercent: number;
  percentDifference: number | null;
  status: ResultStatus;
}

export function calculateAgainstReference(input: ReferenceComparisonInput): ReferenceComparisonOutput {
  const { readings, referenceValue, tolerancePercent, warningPercent } = input;
  const meanValue = mean(readings);
  const stddevValue = stddev(readings);
  const cvPercent = coefficientOfVariation(readings);
  const diff = referenceValue ? percentDifference(meanValue, referenceValue) : null;
  const status = evaluateTolerance(diff ?? NaN, tolerancePercent, warningPercent);
  return {
    numReadings: readings.length,
    meanValue,
    stddevValue,
    cvPercent,
    percentDifference: diff,
    status,
  };
}

// ---- Sensibilidad con correccion por decaimiento (opcional) ----
// Cuando la sensibilidad se mide como tasa de conteo por unidad de
// actividad (p. ej. cps/MBq), y la actividad de la fuente debe corregirse
// por decaimiento entre la fecha de calibracion y la fecha de medicion,
// este helper aplica la misma correccion exponencial que Modulo 1, de forma
// independiente (sin importar su archivo).

export interface SensitivityInput {
  countRate: number;
  referenceActivity: number | null;
  halfLifeMinutes: number | null;
  referenceDatetime: string | null;
  measurementDatetime: string | null;
  referenceSensitivity: number | null;
  tolerancePercent: number | null;
  warningPercent?: number | null;
}

export interface SensitivityOutput {
  correctedActivity: number | null;
  measuredSensitivity: number | null;
  percentDifference: number | null;
  status: ResultStatus;
}

export function calculateSensitivity(input: SensitivityInput): SensitivityOutput {
  const {
    countRate,
    referenceActivity,
    halfLifeMinutes,
    referenceDatetime,
    measurementDatetime,
    referenceSensitivity,
    tolerancePercent,
    warningPercent,
  } = input;

  let correctedActivity: number | null = null;
  if (referenceActivity && halfLifeMinutes && referenceDatetime && measurementDatetime) {
    const elapsed = (new Date(measurementDatetime).getTime() - new Date(referenceDatetime).getTime()) / 60000;
    correctedActivity = decayCorrectActivity(referenceActivity, halfLifeMinutes, elapsed, "forward");
  }

  const measuredSensitivity = correctedActivity ? countRate / correctedActivity : null;
  const diff =
    measuredSensitivity !== null && referenceSensitivity ? percentDifference(measuredSensitivity, referenceSensitivity) : null;
  const status = evaluateTolerance(diff ?? NaN, tolerancePercent, warningPercent);

  return { correctedActivity, measuredSensitivity, percentDifference: diff, status };
}
