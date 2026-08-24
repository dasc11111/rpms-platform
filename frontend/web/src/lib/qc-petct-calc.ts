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
