// Fase 0 (Medicina Nuclear) - Modulo nuevo: CONTROL DE CALIDAD.
// ARPANSA RPS 14.2 requiere un programa de control de calidad para
// activimetros y equipos de deteccion, con pruebas periodicas de
// constancia, exactitud, linealidad y geometria, ademas de la calibracion
// externa certificada (ya cubierta por el modulo Instrumentos y
// Calibracion). Este modulo registra esas pruebas INTERNAS realizadas por
// el propio personal, distintas de la calibracion externa.
//
// ACTUALIZACION (auditoria IAEA-TECDOC-602): las frecuencias de "constancia",
// "exactitud", "linealidad", "resolucion_espacial" y "fondo" fueron
// verificadas directamente contra el documento oficial IAEA-TECDOC-602
// "Quality Control of Nuclear Medicine Instruments" (1991), disponible en
// https://www.iaea.org/es/node/279792, Tabla 2-1 (pag. 19, activimetro) y
// Tabla 6-1 (pag. 145, gammacamara). Cada prueba incluye su cita exacta en
// el campo "sourceRef". Las pruebas "geometria" y "sensibilidad" NO tienen
// una fila propia verificada en esas tablas (regla 19/32 de Fase 0: no
// inventar limites/frecuencias no respaldadas); su frecuencia debe
// confirmarla el Oficial de Proteccion Radiologica (OPR) segun
// procedimiento interno o normativa chilena vigente. Todas las frecuencias
// siguen siendo completamente configurables, no codificadas de forma
// irreversible.

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
    sourceRef: string;
}[] = [
  {
        code: "constancia",
        label: "Constancia (activimetro)",
        appliesTo: "Activimetro",
        suggestedFrequencyDays: 1,
        sourceRef:
                "IAEA-TECDOC-602, Tabla 2-1 (pag. 19), prueba 2.4.1 'Check of Reproducibility': verificacion operacional, cada dia de uso.",
  },
  {
        code: "exactitud",
        label: "Exactitud (activimetro)",
        appliesTo: "Activimetro",
        suggestedFrequencyDays: 180,
        sourceRef:
                "IAEA-TECDOC-602, Tabla 2-1 (pag. 19), prueba 2.3.2 'Test of Precision and Accuracy': prueba de referencia, repeticion semestral.",
  },
  {
        code: "linealidad",
        label: "Linealidad (activimetro)",
        appliesTo: "Activimetro",
        suggestedFrequencyDays: 180,
        sourceRef:
                "IAEA-TECDOC-602, Tabla 2-1 (pag. 19), prueba 2.3.3 'Test of Linearity of Activity Response': prueba de referencia, repeticion semestral.",
  },
  {
        code: "geometria",
        label: "Geometria / dependencia de volumen (activimetro)",
        appliesTo: "Activimetro",
        suggestedFrequencyDays: null,
        sourceRef:
                "No figura como fila independiente en la Tabla 2-1 de IAEA-TECDOC-602. Frecuencia pendiente de definicion por el OPR segun procedimiento interno o normativa chilena.",
  },
  {
        code: "uniformidad",
        label: "Uniformidad de campo (gammacamara)",
        appliesTo: "Gammacamara",
        suggestedFrequencyDays: 1,
        sourceRef:
                "IAEA-TECDOC-602, Tabla 6-1 (pag. 145), prueba 6.3.3 'Test of Intrinsic Flood-field Uniformity': verificacion operacional diaria, con prueba de referencia semanal.",
  },
  {
        code: "resolucion_espacial",
        label: "Resolucion espacial (gammacamara)",
        appliesTo: "Gammacamara",
        suggestedFrequencyDays: 180,
        sourceRef:
                "IAEA-TECDOC-602, Tabla 6-1 (pag. 145), prueba 6.3.7 'Test of Intrinsic Spatial Resolution': prueba de referencia, repeticion semestral.",
  },
  {
        code: "sensibilidad",
        label: "Sensibilidad (gammacamara)",
        appliesTo: "Gammacamara",
        suggestedFrequencyDays: 180,
        sourceRef:
                "Valor de referencia interno (semestral); no se identifico una fila especifica verificada en la Tabla 6-1 de IAEA-TECDOC-602 en esta auditoria. Debe confirmarlo el OPR contra el documento completo.",
  },
  {
        code: "fondo",
        label: "Radiacion de fondo",
        appliesTo: "Cualquier detector",
        suggestedFrequencyDays: 1,
        sourceRef:
                "IAEA-TECDOC-602, Tabla 2-1 (pag. 19), prueba 2.4.2 'Check of Background Response': verificacion operacional, cada dia de uso.",
  },
  {
        code: "otro",
        label: "Otra prueba",
        appliesTo: "-",
        suggestedFrequencyDays: null,
        sourceRef: "Prueba personalizada, sin referencia tabulada.",
  },
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

// --- Aviso anticipado y alertas de atraso (requisito TECDOC-602) ---

const DAY_MS = 24 * 60 * 60 * 1000;

// Fecha en la que corresponde repetir la prueba, segun la ultima realizada.
export function getNextDueDate(lastTestDate: string | null, frequencyDays: number | null): Date | null {
    if (!lastTestDate || frequencyDays === null) return null;
    const last = new Date(lastTestDate).getTime();
    return new Date(last + frequencyDays * DAY_MS);
}

// Lista de proximas fechas programadas (aviso con anticipacion), proyectando
// la frecuencia sugerida hacia adelante desde la ultima prueba registrada.
export function getUpcomingSchedule(
    lastTestDate: string | null,
    frequencyDays: number | null,
    occurrences = 3
  ): Date[] {
    if (!lastTestDate || frequencyDays === null) return [];
    const last = new Date(lastTestDate).getTime();
    const out: Date[] = [];
    for (let i = 1; i <= occurrences; i++) {
          out.push(new Date(last + frequencyDays * i * DAY_MS));
    }
    return out;
}

// Dias de atraso respecto de la fecha en que correspondia repetir la prueba
// (0 si aun no vence). Se usa para la alerta desplegable en pantalla.
export function getDaysOverdue(lastTestDate: string | null, frequencyDays: number | null): number | null {
    const due = getNextDueDate(lastTestDate, frequencyDays);
    if (!due) return null;
    const diffDays = (Date.now() - due.getTime()) / DAY_MS;
    return diffDays > 0 ? Math.floor(diffDays) : 0;
}

export function formatShortDate(d: Date): string {
    return d.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
}
