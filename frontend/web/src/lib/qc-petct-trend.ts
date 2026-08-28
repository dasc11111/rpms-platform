/**
 * MODULO 4 - PET/CT - FASE K
 * Motor de tendencia y grafico de control (Levey-Jennings) - secciones
 * 16-18 del prompt de mejora. Reutiliza las funciones estadisticas puras
 * (mean, stddev) ya validadas en qc-petct-calc.ts, sin duplicar logica ni
 * acceder a base de datos (funciones puras, sin efectos secundarios).
 *
 * Principio: el grafico de control no reemplaza el criterio de tolerancia
 * de cada prueba (ya aplicado en el motor de calculo de cada Fase); es un
 * analisis complementario de estabilidad del proceso en el tiempo, basado
 * en la media y desviacion estandar de los resultados historicos
 * FINALIZADOS de un mismo equipo y prueba. Limites de advertencia a +/-2
 * desviaciones estandar (2DE) y de accion/fuera de control a +/-3
 * desviaciones estandar (3DE), segun el metodo de Levey-Jennings de
 * control estadistico de procesos.
 *
 * No todas las pruebas del catalogo tienen un indicador numerico unico
 * (algunas son evaluaciones por componente CUMPLE/NO CUMPLE/REQUIERE
 * REVISION: PET-05, CT-05, CT-12, PET-CLINICO). Esas pruebas quedan fuera
 * de este grafico de control y no aparecen en TREND_METRICS, en vez de
 * inventar un indicador numerico que no existe en la bibliografia.
 *
 * Seccion 2 (nunca mezclar PET/CT/PETCT): cada definicion indica de que
 * tabla de resultados proviene (pet / ct / joint), para que la API
 * consulte siempre la tabla correcta segun el codigo de prueba.
 */

import { mean, stddev } from "@/lib/qc-petct-calc";

export type TrendTable = "pet" | "ct" | "joint";
export type TrendMetricSource = "calculated" | "raw_inputs";

export interface TrendMetricDefinition {
  test_code: string;
  table: TrendTable;
  label: string;
  unit: string;
  source: TrendMetricSource;
  path: string;
}
export const TREND_METRICS: TrendMetricDefinition[] = [
  { test_code: "PET-01", table: "pet", label: "Razon FWHM observada/esperada", unit: "", source: "calculated", path: "ratio" },
  { test_code: "PET-02", table: "pet", label: "Razon STOT observada/esperada", unit: "", source: "calculated", path: "ratio" },
  { test_code: "PET-03", table: "pet", label: "Razon fraccion de dispersion (SF) observada/esperada", unit: "", source: "calculated", path: "sfRatio" },
  { test_code: "PET-04", table: "pet", label: "Razon resolucion energetica observada/esperada", unit: "", source: "calculated", path: "ratio" },
  { test_code: "PET-06", table: "pet", label: "Razon resolucion temporal (TOF) observada/esperada", unit: "", source: "calculated", path: "ratio" },
  { test_code: "PET-ESTAB", table: "pet", label: "Desviacion vs. baseline", unit: "%", source: "calculated", path: "percentDeviationFromBaseline" },
  { test_code: "PET-CONC", table: "pet", label: "Desviacion de concentracion medida vs. conocida", unit: "%", source: "calculated", path: "percentDeviation" },
  { test_code: "PET-SUV-CAL", table: "pet", label: "Desviacion de calibracion SUV", unit: "%", source: "calculated", path: "percentDeviation" },
  { test_code: "CT-01", table: "ct", label: "Razon tasa de dosis medida/limite", unit: "", source: "calculated", path: "marginFraction" },
  { test_code: "CT-02", table: "ct", label: "Desviacion de alineacion de laser", unit: "mm", source: "raw_inputs", path: "laserDeviationMm" },
  { test_code: "CT-03", table: "ct", label: "Error de posicion de mesa", unit: "mm", source: "raw_inputs", path: "tablePositionErrorMm" },
  { test_code: "CT-04", table: "ct", label: "Error de exactitud del scout view", unit: "mm", source: "raw_inputs", path: "scoutViewErrorMm" },
  { test_code: "CT-06", table: "ct", label: "Desviacion de ancho de corte (slice)", unit: "%", source: "calculated", path: "percentDeviation" },
  { test_code: "CT-07", table: "ct", label: "Razon de resolucion de alto contraste", unit: "", source: "calculated", path: "ratio" },
  { test_code: "CT-08", table: "ct", label: "Desviacion de kVp", unit: "%", source: "calculated", path: "kvpPercentDeviation" },
  { test_code: "CT-09", table: "ct", label: "Desviacion de CTDIvol", unit: "%", source: "calculated", path: "ctdivolPercentDeviation" },
  { test_code: "CT-10", table: "ct", label: "Desviacion de ruido (SD en HU)", unit: "%", source: "calculated", path: "percentDeviation" },
  { test_code: "CT-11", table: "ct", label: "Desviacion maxima de uniformidad (HU)", unit: "HU", source: "calculated", path: "maxDeviationHu" },
  { test_code: "CT-13", table: "ct", label: "Desviacion del numero CT", unit: "HU", source: "calculated", path: "deviationHu" },
  { test_code: "CT-14", table: "ct", label: "Desviacion de densidad electronica", unit: "%", source: "calculated", path: "percentDeviation" },
  { test_code: "PETCT-01", table: "joint", label: "Error de registro PET/CT", unit: "voxels", source: "calculated", path: "errorVoxels" },
  { test_code: "PETCT-02", table: "joint", label: "Offset maximo de calibracion PET/CT", unit: "mm", source: "calculated", path: "maxOffsetMm" },
  { test_code: "PET-QI-RUTINA", table: "joint", label: "Desviacion de concentracion (QI-Rutina)", unit: "%", source: "calculated", path: "concentration.percentDeviation" },
];

export function getTrendMetricDefinition(testCode: string): TrendMetricDefinition | null {
  return TREND_METRICS.find((m) => m.test_code === testCode) ?? null;
}
function getByPath(source: Record<string, unknown> | null | undefined, path: string): number | null {
  if (!source) return null;
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = source;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    current = current[part];
  }
  if (typeof current !== "number" || Number.isNaN(current)) return null;
  return current;
}

export interface TrendSourceRecord {
  id: number;
  performed_at: string;
  is_finalized: boolean;
  calculated: Record<string, unknown>;
  raw_inputs: Record<string, unknown>;
}

export function extractMetricValue(def: TrendMetricDefinition, record: TrendSourceRecord): number | null {
  const source = def.source === "calculated" ? record.calculated : record.raw_inputs;
  return getByPath(source, def.path);
}

export type TrendPointStatus = "dentro_control" | "alerta_2de" | "fuera_control_3de";

export interface TrendPoint {
  record_id: number;
  performed_at: string;
  value: number;
}

export interface TrendStatsPoint extends TrendPoint {
  status: TrendPointStatus;
  westgard_2_2de: boolean;
}

export interface TrendSeries {
  n: number;
  mean_value: number;
  stddev_value: number;
  upper_warning_2de: number | null;
  lower_warning_2de: number | null;
  upper_action_3de: number | null;
  lower_action_3de: number | null;
  points: TrendStatsPoint[];
}
/**
 * Construye la serie de control (Levey-Jennings) a partir de los puntos
 * historicos FINALIZADOS de un mismo equipo y prueba, ya ordenados por
 * fecha ascendente. La media y desviacion estandar se calculan sobre el
 * total de puntos disponibles: el prompt de mejora no exige un periodo de
 * referencia fijo distinto del historico de resultados finalizados.
 *
 * Recorre los puntos con un acumulador de la desviacion anterior (en vez
 * de indexar el arreglo por posicion) para evitar depender del acceso
 * indexado, que TypeScript en modo estricto trata como posiblemente
 * indefinido incluso cuando el indice es valido.
 */
export function buildTrendSeries(points: TrendPoint[]): TrendSeries | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const meanValue = mean(values);
  const sd = points.length >= 2 ? stddev(values) : 0;

  const hasLimits = sd > 0;
  const upperWarning = hasLimits ? meanValue + 2 * sd : null;
  const lowerWarning = hasLimits ? meanValue - 2 * sd : null;
  const upperAction = hasLimits ? meanValue + 3 * sd : null;
  const lowerAction = hasLimits ? meanValue - 3 * sd : null;

  const statsPoints: TrendStatsPoint[] = [];
  let previousDeviation: number | null = null;
  for (const p of points) {
    const deviation = p.value - meanValue;
    let status: TrendPointStatus = "dentro_control";
    if (hasLimits) {
      const absDeviation = Math.abs(deviation);
      if (absDeviation > 3 * sd) status = "fuera_control_3de";
      else if (absDeviation > 2 * sd) status = "alerta_2de";
    }
    let westgard = false;
    if (
      hasLimits &&
      previousDeviation !== null &&
      Math.abs(previousDeviation) > 2 * sd &&
      Math.abs(deviation) > 2 * sd &&
      Math.sign(previousDeviation) === Math.sign(deviation)
    ) {
      westgard = true;
    }
    statsPoints.push({ ...p, status, westgard_2_2de: westgard });
    previousDeviation = deviation;
  }

  return {
    n: points.length,
    mean_value: meanValue,
    stddev_value: sd,
    upper_warning_2de: upperWarning,
    lower_warning_2de: lowerWarning,
    upper_action_3de: upperAction,
    lower_action_3de: lowerAction,
    points: statsPoints,
  };
}
