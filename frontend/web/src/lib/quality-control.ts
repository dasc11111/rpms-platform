// Fase 0 (Medicina Nuclear) - Modulo nuevo: CONTROL DE CALIDAD.
// ARPANSA RPS 14.2 requiere un programa de control de calidad para
// activimetros y equipos de deteccion, con pruebas periodicas de
// constancia, exactitud, linealidad y geometria, ademas de la calibracion
// externa certificada (ya cubierta por el modulo Instrumentos y
// Calibracion). Este modulo registra esas pruebas INTERNAS realizadas por
// el propio personal, distintas de la calibracion externa.
//
// IMPORTANTE (regla 19/32 de Fase 0): las frecuencias y tolerancias listadas
// abajo son valores de referencia TIPICOS de la practica internacional
// (IAEA/ARPANSA). NO estan citadas de una seccion especifica verificada de
// ARPANSA RPS 14.2 en esta implementacion. Deben ser revisadas y ajustadas
// por el Oficial de Proteccion Radiologica (OPR) segun procedimiento
// interno o normativa chilena vigente antes de su uso clinico. Son
// completamente configurables, no codificadas de forma irreversible.

export type QcTestType =
  | "constancia"
  | "exactitud"
  | "linealidad"
  | "geometria"
  | "uniformidad"
  | "resolucion_espacial"
  | "sensibilidad"
  | "fondo"
  | "otro";

export type QcResultStatus = "conforme" | "no_conforme" | "pendiente_revision";

export const QC_TEST_TYPES: {
  code: QcTestType;
  label: string;
  appliesTo: string;
  suggestedFrequencyDays: number | null;
}[] = [
  { code: "constancia", label: "Constancia (activimetro)", appliesTo: "Activimetro", suggestedFrequencyDays: 1 },
  { code: "exactitud", label: "Exactitud (activimetro)", appliesTo: "Activimetro", suggestedFrequencyDays: 365 },
  { code: "linealidad", label: "Linealidad (activimetro)", appliesTo: "Activimetro", suggestedFrequencyDays: 90 },
  { code: "geometria", label: "Geometria / dependencia de volumen (activimetro)", appliesTo: "Activimetro", suggestedFrequencyDays: null },
  { code: "uniformidad", label: "Uniformidad de campo (gammacamara)", appliesTo: "Gammacamara", suggestedFrequencyDays: 1 },
  { code: "resolucion_espacial", label: "Resolucion espacial (gammacamara)", appliesTo: "Gammacamara", suggestedFrequencyDays: 90 },
  { code: "sensibilidad", label: "Sensibilidad (gammacamara)", appliesTo: "Gammacamara", suggestedFrequencyDays: 180 },
  { code: "fondo", label: "Radiacion de fondo", appliesTo: "Cualquier detector", suggestedFrequencyDays: 1 },
  { code: "otro", label: "Otra prueba", appliesTo: "-", suggestedFrequencyDays: null },
];

export const QC_RESULT_LABELS: Record<QcResultStatus, string> = {
  conforme: "Conforme",
  no_conforme: "No conforme",
  pendiente_revision: "Pendiente de revision",
};

export function computeDeviationPercent(measured: number | null, reference: number | null): number | null {
  if (measured === null || reference === null || reference === 0) return null;
  return ((measured - reference) / reference) * 100;
}

export function evaluateResultStatus(
  deviationPercent: number | null,
  tolerancePercent: number | null
): QcResultStatus {
  if (deviationPercent === null || tolerancePercent === null) return "pendiente_revision";
  return Math.abs(deviationPercent) <= tolerancePercent ? "conforme" : "no_conforme";
}

export function getQcTestTypeConfig(code: string) {
  return QC_TEST_TYPES.find((t) => t.code === code) ?? null;
}

// Estado de vigencia respecto a la ultima prueba realizada de cada tipo,
// usado para alertar cuando corresponde repetir una prueba periodica.
export type QcDueStatus = "al_dia" | "proxima" | "vencida" | "sin_frecuencia" | "sin_registro";

export function getQcDueStatus(
  lastTestDate: string | null,
  suggestedFrequencyDays: number | null
): QcDueStatus {
  if (suggestedFrequencyDays === null) return "sin_frecuencia";
  if (!lastTestDate) return "sin_registro";
  const last = new Date(lastTestDate).getTime();
  const now = Date.now();
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);
  if (daysSince > suggestedFrequencyDays) return "vencida";
  if (daysSince > suggestedFrequencyDays * 0.8) return "proxima";
  return "al_dia";
}
