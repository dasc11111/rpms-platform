/**
 * MODULO 3 - SPECT
 * Motor de calculo del sistema de Control de Calidad.
 *
 * REGLA FUNDAMENTAL (Prompt maestro CC, seccion 3): el operador introduce
 * unicamente los datos medidos/reportados por el equipo. Toda clasificacion
 * contra tolerancia se realiza aqui, nunca manualmente por el usuario.
 *
 * Funciones puras (sin efectos secundarios, sin acceso a BD) para poder ser
 * verificadas y reutilizadas tanto en el backend (API) como en el frontend
 * (vista previa antes de guardar). Modulo independiente de Activimetro
 * (Modulo 1) y Gammacamara (Modulo 2): no reutiliza sus archivos de calculo,
 * para no mezclar logicas de modulos distintos, aunque las formulas
 * estadisticas base son las mismas matematicas generales.
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

// ---- Evaluacion contra tolerancia expresada en % (uniformidad tomografica) ----

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

// ---- Evaluacion contra tolerancia expresada en valor absoluto (Centro de Rotacion) ----
// El Centro de Rotacion (COR) no se expresa como variacion % respecto de un
// valor de referencia arbitrario: se expresa como una desviacion absoluta
// (en pixeles) respecto del centro ideal (0). Por eso este modulo necesita
// una evaluacion de tolerancia distinta a la de Modulo 1/2 (que son siempre
// porcentuales), y usa la columna tolerance_absolute ya prevista en el
// esquema de tolerancias.

export function evaluateAbsoluteTolerance(
  observedAbsolute: number,
  toleranceAbsolute: number | null | undefined,
  warningAbsolute?: number | null
): ResultStatus {
  if (toleranceAbsolute === null || toleranceAbsolute === undefined || Number.isNaN(observedAbsolute)) {
    return "pendiente_revision";
  }
  const abs = Math.abs(observedAbsolute);
  if (abs > toleranceAbsolute) return "no_cumple";
  if (warningAbsolute && abs > toleranceAbsolute - warningAbsolute) return "advertencia";
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

// ---- Centro de Rotacion (COR) ----
// El operador ingresa una o mas lecturas de desviacion del centro de
// rotacion (en pixeles), una por proyeccion/cabezal evaluado, ya calculadas
// por el software de control de calidad del SPECT (o medidas manualmente
// segun el protocolo del fabricante). Este motor promedia las lecturas y
// clasifica la desviacion absoluta promedio contra la tolerancia absoluta
// configurada (tipicamente +/-0.5 pixel), sin recalcular la imagen fuente.

export interface CenterOfRotationInput {
  readings: number[];
  toleranceAbsolute: number | null;
  warningAbsolute?: number | null;
}

export interface CenterOfRotationOutput {
  numReadings: number;
  meanValue: number;
  stddevValue: number;
  cvPercent: number;
  absoluteDifference: number;
  status: ResultStatus;
}

export function calculateCenterOfRotation(input: CenterOfRotationInput): CenterOfRotationOutput {
  const { readings, toleranceAbsolute, warningAbsolute } = input;
  const meanValue = mean(readings);
  const stddevValue = stddev(readings);
  const cvPercent = coefficientOfVariation(readings);
  const absoluteDifference = Math.abs(meanValue);
  const status = evaluateAbsoluteTolerance(absoluteDifference, toleranceAbsolute, warningAbsolute);
  return { numReadings: readings.length, meanValue, stddevValue, cvPercent, absoluteDifference, status };
}

// ---- Uniformidad Tomografica ----
// El operador ingresa el valor de uniformidad integral (%) ya calculado por
// el software de reconstruccion/control de calidad del SPECT sobre los
// cortes del maniqui cilindrico uniforme (analogo conceptualmente a la
// uniformidad de flood de Modulo 2, pero medido sobre imagen reconstruida,
// no planar). Este motor solo clasifica ese valor contra la tolerancia.

export interface TomographicUniformityInput {
  uniformityPercent: number;
  tolerancePercent: number | null;
  warningPercent?: number | null;
}

export interface TomographicUniformityOutput {
  status: ResultStatus;
}

export function calculateTomographicUniformity(input: TomographicUniformityInput): TomographicUniformityOutput {
  const { uniformityPercent, tolerancePercent, warningPercent } = input;
  const status = evaluateTolerance(uniformityPercent, tolerancePercent, warningPercent);
  return { status };
}
