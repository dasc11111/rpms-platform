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


// ---- FASE C: CT-01 a CT-14 (control de calidad del componente CT del
// equipo hibrido PET/CT, seccion 19 del prompt de mejora). La bibliografia
// PET (IAEA Human Health Series No. 1) no fija valores de referencia
// numericos para las pruebas radiologicas de CT con el mismo nivel de
// detalle que las pruebas PET; por eso las tolerancias de estas pruebas se
// marcan REVISAR CON FISICO MEDICO en las tolerancias por defecto
// (secciones 25 y 28 del prompt) y el motor solo aplica la comparacion
// configurada, nunca inventa un limite regulatorio. Se reutiliza el mismo
// modelo de 4 estados (CtAcceptanceStatus = PetAcceptanceStatus) y el mismo
// nivel de accion (CtActionLevel = PetActionLevel) que las pruebas PET,
// para mantener un unico lenguaje de resultado en todo el Modulo 4, aunque
// el componente CT es independiente del componente PET (secciones 2 y 19).

export type CtAcceptanceStatus = PetAcceptanceStatus;
export type CtActionLevel = PetActionLevel;

/**
 * Compara una desviacion (absoluta o en %, segun la unidad del parametro)
 * contra una tolerancia absoluta/porcentual. marginFraction = 0 en el
 * valor de referencia, 1 en el limite de tolerancia (mismo significado que
 * en deriveActionLevel, para reutilizarla sin cambios).
 */
function absoluteDeviationStatus(
  deviation: number,
  tolerance: number | null | undefined
): { status: CtAcceptanceStatus; marginFraction: number } {
  if (tolerance === null || tolerance === undefined || !tolerance || Number.isNaN(deviation)) {
    return { status: "requiere_revision", marginFraction: NaN };
  }
  const abs = Math.abs(deviation);
  const marginFraction = abs / tolerance;
  const status: CtAcceptanceStatus = abs <= tolerance ? "cumple" : "no_cumple";
  return { status, marginFraction };
}

// CT-01: Radiacion dispersa y verificacion de blindaje. El operador ingresa
// la tasa de dosis medida en el punto de referencia; el limite proviene del
// informe de blindaje/proteccion radiologica del recinto (no de este
// modulo). Criterio: tasa medida <= limite.
export interface Ct01Input {
  measuredDoseRateUSvH: number;
  doseRateLimitUSvH: number;
}
export interface Ct01Output {
  marginFraction: number;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt01(input: Ct01Input): Ct01Output {
  if (!input.doseRateLimitUSvH) {
    return { marginFraction: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const marginFraction = input.measuredDoseRateUSvH / input.doseRateLimitUSvH;
  const status: CtAcceptanceStatus = input.measuredDoseRateUSvH <= input.doseRateLimitUSvH ? "cumple" : "no_cumple";
  return { marginFraction, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-02: Alineacion de laser. Criterio: |desviacion| <= tolerancia (mm).
export interface Ct02Input {
  laserDeviationMm: number;
  toleranceMm: number;
}
export interface Ct02Output {
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt02(input: Ct02Input): Ct02Output {
  const { status, marginFraction } = absoluteDeviationStatus(input.laserDeviationMm, input.toleranceMm);
  return { status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-03: Alineacion de mesa y exactitud posicional. Criterio: |error| <= tolerancia (mm).
export interface Ct03Input {
  tablePositionErrorMm: number;
  toleranceMm: number;
}
export interface Ct03Output {
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt03(input: Ct03Input): Ct03Output {
  const { status, marginFraction } = absoluteDeviationStatus(input.tablePositionErrorMm, input.toleranceMm);
  return { status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-04: Exactitud del scout view. Criterio: |error| <= tolerancia (mm).
export interface Ct04Input {
  scoutViewErrorMm: number;
  toleranceMm: number;
}
export interface Ct04Output {
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt04(input: Ct04Input): Ct04Output {
  const { status, marginFraction } = absoluteDeviationStatus(input.scoutViewErrorMm, input.toleranceMm);
  return { status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-05: Inspeccion visual y revision del programa. Evaluacion NO numerica
// (analoga a PET-05): el operador reporta el estado observado de cada
// componente y el motor solo consolida el resultado global.
export type Ct05ComponentStatus = "cumple" | "no_cumple" | "requiere_revision";
export interface Ct05Input {
  visualInspection: Ct05ComponentStatus;
  safetyInterlocks: Ct05ComponentStatus;
  tableMotion: Ct05ComponentStatus;
  gantryMotion: Ct05ComponentStatus;
  softwareVersion: Ct05ComponentStatus;
}
export interface Ct05Output {
  status: CtAcceptanceStatus;
}
export function calculateCt05(input: Ct05Input): Ct05Output {
  const components = Object.values(input);
  const status: CtAcceptanceStatus = components.includes("no_cumple")
    ? "no_cumple"
    : components.includes("requiere_revision")
    ? "requiere_revision"
    : "cumple";
  return { status };
}

// CT-06: Perfil y ancho de corte (slice width). Criterio: % desviacion
// respecto del ancho nominal dentro de tolerancia.
export interface Ct06Input {
  measuredSliceWidthMm: number;
  nominalSliceWidthMm: number;
  tolerancePercent: number;
}
export interface Ct06Output {
  percentDeviation: number;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt06(input: Ct06Input): Ct06Output {
  if (!input.nominalSliceWidthMm) {
    return { percentDeviation: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const percentDeviation = ((input.measuredSliceWidthMm - input.nominalSliceWidthMm) / input.nominalSliceWidthMm) * 100;
  const { status, marginFraction } = absoluteDeviationStatus(percentDeviation, input.tolerancePercent);
  return { percentDeviation, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-07: Modulacion de alto contraste (resolucion espacial de alto
// contraste). Criterio: resolucion observada >= 0.95 x resolucion esperada
// (misma logica de limite inferior que PET-02/sensibilidad).
export interface Ct07Input {
  observedResolutionLpCm: number;
  expectedResolutionLpCm: number;
}
export interface Ct07Output {
  ratio: number;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt07(input: Ct07Input): Ct07Output {
  if (!input.expectedResolutionLpCm) {
    return { ratio: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const { ratio, status, marginFraction } = ratioLowerBoundStatus(
    input.observedResolutionLpCm / input.expectedResolutionLpCm,
    0.95
  );
  return { ratio, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-08: kVp y HVL. Dos sub-parametros independientes, consolidados igual
// que PET-03 (SF + NEC): si alguno no cumple, el resultado global es NO
// CUMPLE.
export interface Ct08Input {
  kvpMeasured: number;
  kvpNominal: number;
  kvpTolerancePercent: number;
  hvlMeasuredMmAl: number;
  hvlExpectedMmAl: number;
  hvlTolerancePercent: number;
}
export interface Ct08Output {
  kvpPercentDeviation: number;
  kvpStatus: CtAcceptanceStatus;
  hvlPercentDeviation: number;
  hvlStatus: CtAcceptanceStatus;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt08(input: Ct08Input): Ct08Output {
  const kvpPercentDeviation = input.kvpNominal
    ? ((input.kvpMeasured - input.kvpNominal) / input.kvpNominal) * 100
    : NaN;
  const kvpEval = input.kvpNominal
    ? absoluteDeviationStatus(kvpPercentDeviation, input.kvpTolerancePercent)
    : { status: "requiere_revision" as CtAcceptanceStatus, marginFraction: NaN };

  const hvlPercentDeviation = input.hvlExpectedMmAl
    ? ((input.hvlMeasuredMmAl - input.hvlExpectedMmAl) / input.hvlExpectedMmAl) * 100
    : NaN;
  const hvlEval = input.hvlExpectedMmAl
    ? absoluteDeviationStatus(hvlPercentDeviation, input.hvlTolerancePercent)
    : { status: "requiere_revision" as CtAcceptanceStatus, marginFraction: NaN };

  const status: CtAcceptanceStatus =
    kvpEval.status === "no_cumple" || hvlEval.status === "no_cumple"
      ? "no_cumple"
      : kvpEval.status === "requiere_revision" || hvlEval.status === "requiere_revision"
      ? "requiere_revision"
      : "cumple";
  const margins = [kvpEval.marginFraction, hvlEval.marginFraction].filter((m) => !Number.isNaN(m));
  const marginFraction = margins.length ? Math.max(...margins) : NaN;
  return {
    kvpPercentDeviation,
    kvpStatus: kvpEval.status,
    hvlPercentDeviation,
    hvlStatus: hvlEval.status,
    status,
    actionLevel: deriveActionLevel(status, marginFraction),
  };
}

// CT-09: Dosis (CTDIvol / DLP). Mismo patron de consolidacion de dos
// sub-parametros que CT-08.
export interface Ct09Input {
  ctdivolMeasuredMgy: number;
  ctdivolReferenceMgy: number;
  dlpMeasuredMgyCm: number;
  dlpReferenceMgyCm: number;
  tolerancePercent: number;
}
export interface Ct09Output {
  ctdivolPercentDeviation: number;
  ctdivolStatus: CtAcceptanceStatus;
  dlpPercentDeviation: number;
  dlpStatus: CtAcceptanceStatus;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt09(input: Ct09Input): Ct09Output {
  const ctdivolPercentDeviation = input.ctdivolReferenceMgy
    ? ((input.ctdivolMeasuredMgy - input.ctdivolReferenceMgy) / input.ctdivolReferenceMgy) * 100
    : NaN;
  const ctdivolEval = input.ctdivolReferenceMgy
    ? absoluteDeviationStatus(ctdivolPercentDeviation, input.tolerancePercent)
    : { status: "requiere_revision" as CtAcceptanceStatus, marginFraction: NaN };

  const dlpPercentDeviation = input.dlpReferenceMgyCm
    ? ((input.dlpMeasuredMgyCm - input.dlpReferenceMgyCm) / input.dlpReferenceMgyCm) * 100
    : NaN;
  const dlpEval = input.dlpReferenceMgyCm
    ? absoluteDeviationStatus(dlpPercentDeviation, input.tolerancePercent)
    : { status: "requiere_revision" as CtAcceptanceStatus, marginFraction: NaN };

  const status: CtAcceptanceStatus =
    ctdivolEval.status === "no_cumple" || dlpEval.status === "no_cumple"
      ? "no_cumple"
      : ctdivolEval.status === "requiere_revision" || dlpEval.status === "requiere_revision"
      ? "requiere_revision"
      : "cumple";
  const margins = [ctdivolEval.marginFraction, dlpEval.marginFraction].filter((m) => !Number.isNaN(m));
  const marginFraction = margins.length ? Math.max(...margins) : NaN;
  return {
    ctdivolPercentDeviation,
    ctdivolStatus: ctdivolEval.status,
    dlpPercentDeviation,
    dlpStatus: dlpEval.status,
    status,
    actionLevel: deriveActionLevel(status, marginFraction),
  };
}

// CT-10: Ruido. Criterio: % desviacion del ruido (SD en HU) respecto del
// esperado, dentro de tolerancia.
export interface Ct10Input {
  measuredNoiseSdHu: number;
  expectedNoiseSdHu: number;
  tolerancePercent: number;
}
export interface Ct10Output {
  percentDeviation: number;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt10(input: Ct10Input): Ct10Output {
  if (!input.expectedNoiseSdHu) {
    return { percentDeviation: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const percentDeviation = ((input.measuredNoiseSdHu - input.expectedNoiseSdHu) / input.expectedNoiseSdHu) * 100;
  const { status, marginFraction } = absoluteDeviationStatus(percentDeviation, input.tolerancePercent);
  return { percentDeviation, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-11: Uniformidad (numero CT y ruido por ROI, seccion 21 del prompt).
// El operador ingresa la media del ROI central y de hasta 4 ROI
// perifericos (en HU); el motor calcula la desviacion maxima respecto del
// central y clasifica contra la tolerancia (HU).
export interface Ct11Input {
  centralRoiHu: number;
  peripheralRoiHu: number[];
  toleranceHu: number;
}
export interface Ct11Output {
  meanPeripheralHu: number;
  maxDeviationHu: number;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt11(input: Ct11Input): Ct11Output {
  const validPeripheral = input.peripheralRoiHu.filter((v) => !Number.isNaN(v));
  if (!validPeripheral.length) {
    return { meanPeripheralHu: NaN, maxDeviationHu: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const meanPeripheralHu = mean(validPeripheral);
  const maxDeviationHu = Math.max(...validPeripheral.map((v) => Math.abs(v - input.centralRoiHu)));
  const { status, marginFraction } = absoluteDeviationStatus(maxDeviationHu, input.toleranceHu);
  return { meanPeripheralHu, maxDeviationHu, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-12: Artefactos (seccion 22 del prompt). Formulario estructurado: el
// operador solo selecciona el tipo observado; el motor decide si requiere
// revision del Fisico Medico (nunca clasifica el operador manualmente).
export type Ct12ArtifactType =
  | "sin_artefactos"
  | "anillo"
  | "bandas"
  | "streak"
  | "anormalidad_uniformidad"
  | "metalico"
  | "otros";
export interface Ct12Input {
  artifactType: Ct12ArtifactType;
}
export interface Ct12Output {
  status: CtAcceptanceStatus;
}
export function calculateCt12(input: Ct12Input): Ct12Output {
  const status: CtAcceptanceStatus = input.artifactType === "sin_artefactos" ? "cumple" : "requiere_revision";
  return { status };
}

// CT-13: Numero CT. Criterio: |HU medido - HU esperado del material| <= tolerancia (HU absolutos).
export interface Ct13Input {
  materialMeasuredHu: number;
  materialExpectedHu: number;
  toleranceHu: number;
}
export interface Ct13Output {
  deviationHu: number;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt13(input: Ct13Input): Ct13Output {
  const deviationHu = input.materialMeasuredHu - input.materialExpectedHu;
  const { status, marginFraction } = absoluteDeviationStatus(deviationHu, input.toleranceHu);
  return { deviationHu, status, actionLevel: deriveActionLevel(status, marginFraction) };
}

// CT-14: Exactitud de densidad electronica. "Cuando corresponda" (catalogo,
// uso en planificacion de radioterapia): si notApplicable = true, el
// resultado es NO APLICA y no se exige registro numerico.
export interface Ct14Input {
  notApplicable?: boolean;
  measuredElectronDensityRatio: number;
  referenceElectronDensityRatio: number;
  tolerancePercent: number;
}
export interface Ct14Output {
  percentDeviation: number | null;
  status: CtAcceptanceStatus;
  actionLevel: CtActionLevel;
}
export function calculateCt14(input: Ct14Input): Ct14Output {
  if (input.notApplicable) {
    return { percentDeviation: null, status: "no_aplica", actionLevel: "no_aplica" };
  }
  if (!input.referenceElectronDensityRatio) {
    return { percentDeviation: NaN, status: "requiere_revision", actionLevel: "no_aplica" };
  }
  const percentDeviation =
    ((input.measuredElectronDensityRatio - input.referenceElectronDensityRatio) / input.referenceElectronDensityRatio) * 100;
  const { status, marginFraction } = absoluteDeviationStatus(percentDeviation, input.tolerancePercent);
  return { percentDeviation, status, actionLevel: deriveActionLevel(status, marginFraction) };
}
