import type { PetCtAlert } from "@/lib/qc-petct-alerts";

/**
 * MODULO 4 - PET/CT - FASE N
 * Motor de decision (seccion 30 del prompt de mejora): agrega una "accion
 * recomendada" textual a cada alerta ya detectada por el motor de
 * inteligencia de alertas (Fase M, seccion 29).
 *
 * Este motor NO inventa limites numericos ni protocolos clinicos (seccion
 * 37 del prompt): la accion recomendada es siempre un paso de PROCESO
 * (notificar, suspender uso clinico, repetir medicion, investigar causa,
 * programar), nunca un valor de referencia o una instruccion tecnica de
 * como corregir el equipo, que corresponde exclusivamente al Fisico
 * Medico o al servicio tecnico del fabricante.
 *
 * La urgencia (PetCtDecisionUrgency) es una capa distinta de la severidad
 * de deteccion (PetCtAlertSeverity) que ya calcula el motor de alertas: la
 * severidad indica que tan grave es la condicion detectada; la urgencia
 * indica que tan pronto debe actuarse en consecuencia. Por eso una misma
 * severidad (por ejemplo "alta") puede derivar en distinta urgencia segun
 * el tipo de alerta (un cambio brusco exige detener el uso clinico de
 * inmediato; una prueba vencida hace mucho tiempo es prioritaria pero no
 * necesariamente exige detener el uso clinico ya en curso).
 */

export type PetCtDecisionUrgency = "inmediata" | "prioritaria" | "programada" | "informativa";

export interface PetCtRecommendedAction {
  urgency: PetCtDecisionUrgency;
  action: string;
}

export const PETCT_DECISION_URGENCY_LABEL: Record<PetCtDecisionUrgency, string> = {
  inmediata: "Accion inmediata",
  prioritaria: "Accion prioritaria",
  programada: "Accion programada",
  informativa: "Informativa",
};

export const PETCT_DECISION_URGENCY_CLASS: Record<PetCtDecisionUrgency, string> = {
  inmediata: "bg-red-600 text-white",
  prioritaria: "bg-orange-500 text-white",
  programada: "bg-blue-500 text-white",
  informativa: "bg-slate-400 text-white",
};

const URGENCY_ORDER: Record<PetCtDecisionUrgency, number> = {
  inmediata: 0,
  prioritaria: 1,
  programada: 2,
  informativa: 3,
};

export function worseUrgency(a: PetCtDecisionUrgency, b: PetCtDecisionUrgency): PetCtDecisionUrgency {
  return URGENCY_ORDER[a] <= URGENCY_ORDER[b] ? a : b;
}

type DecisionContext = Pick<PetCtAlert, "type" | "severity" | "test_name">;

/**
 * Deriva la accion recomendada para una alerta ya detectada. No recalcula
 * ni reinterpreta la deteccion (eso ya lo hizo qc-petct-alerts.ts): solo
 * traduce el tipo de alerta (y, cuando corresponde, su severidad) a un
 * paso de proceso concreto para el Fisico Medico/operador.
 */
export function deriveRecommendedAction(alert: DecisionContext): PetCtRecommendedAction {
  const testLabel = alert.test_name ? `de ${alert.test_name}` : "de esta prueba";

  switch (alert.type) {
    case "fuera_de_tolerancia":
      return {
        urgency: "inmediata",
        action: `Suspender el uso clinico ${testLabel} y notificar de inmediato al Fisico Medico para que revise el resultado, determine la causa y autorice si corresponde repetir la medicion, continuar o solicitar mantenimiento correctivo.`,
      };
    case "cambio_brusco":
      return {
        urgency: "inmediata",
        action: `Detener el uso clinico ${testLabel} hasta identificar la causa asignable del cambio brusco (fuente de referencia, calibracion, falla del equipo o error de medicion).`,
      };
    case "post_servicio_pendiente":
      return {
        urgency: "inmediata",
        action: "No habilitar el uso clinico del equipo tras el servicio tecnico hasta completar y que el Fisico Medico apruebe todas las pruebas de control de calidad exigidas por ese evento de servicio.",
      };
    case "cambio_vs_baseline":
      return alert.severity === "alta"
        ? {
            urgency: "inmediata",
            action: `Notificar al Fisico Medico: la desviacion ${testLabel} respecto del baseline vigente alcanza o supera la tolerancia configurada; evaluar si corresponde suspender el uso clinico o re-establecer el baseline.`,
          }
        : {
            urgency: "prioritaria",
            action: `Notificar al Fisico Medico la deriva ${testLabel} respecto del baseline vigente y dar seguimiento en los proximos registros para confirmar si la tendencia continua.`,
          };
    case "tendencia_progresiva":
      return {
        urgency: "prioritaria",
        action: `Investigar la causa de la deriva progresiva ${testLabel} (calibracion, fuente de referencia, condiciones ambientales) antes de que el proceso salga de tolerancia; documentar los hallazgos con el Fisico Medico.`,
      };
    case "cercano_al_limite":
      return {
        urgency: "prioritaria",
        action: `Notificar al Fisico Medico y repetir o aumentar la frecuencia ${testLabel} para confirmar que el resultado se mantiene estable dentro de tolerancia.`,
      };
    case "prueba_vencida":
      return alert.severity === "alta"
        ? {
            urgency: "prioritaria",
            action: `Programar y ejecutar ${testLabel} a la brevedad: el atraso ya supera el doble del periodo de la frecuencia configurada.`,
          }
        : {
            urgency: "programada",
            action: `Programar y ejecutar ${testLabel} lo antes posible dentro del periodo de frecuencia configurado.`,
          };
    case "prueba_sin_registro":
      return {
        urgency: "programada",
        action: `Programar el primer registro ${testLabel} segun la frecuencia definida en el catalogo del equipo.`,
      };
    default:
      return {
        urgency: "informativa",
        action: "Revisar la alerta con el Fisico Medico responsable del equipo.",
      };
  }
}

/**
 * Adjunta la accion recomendada a un listado de alertas, preservando el
 * resto de los campos (usado por la API de alertas para no duplicar el
 * calculo de severidad/deteccion en dos lugares distintos).
 */
export function withRecommendedActions<T extends DecisionContext>(
  alerts: T[]
): Array<T & { recommended_action: PetCtRecommendedAction }> {
  return alerts.map((a) => ({ ...a, recommended_action: deriveRecommendedAction(a) }));
}
