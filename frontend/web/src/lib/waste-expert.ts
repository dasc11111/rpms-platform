// ============================================================================
// Sistema Experto de Gestion de Desechos Radiactivos - Medicina Nuclear
// FASE A: Motor 1 (Fisica Nuclear / Decaimiento) + Motor 2 (Metrologia)
//
// Funciones puras, sin acceso a base de datos. Implementan las formulas
// especificadas en el PROMPT MAESTRO DEFINITIVO (secciones 11, 12, 13, 15,
// 16, 17, 22, 23, 24), separando claramente:
//   - PREDICCION TEORICA (Motor 1: decaimiento fisico)
//   - MEDICION REAL Y EVALUACION METROLOGICA (Motor 2)
//
// IMPORTANTE (seccion 47 del Prompt Maestro): estas formulas deben validarse
// mediante casos de prueba independientes por un Fisico Medico / OPR antes de
// usarse para decisiones clinicas reales. El umbral de decision y el limite
// de deteccion aqui implementados usan la formulacion clasica de Currie
// (L. A. Currie, "Limits for qualitative detection and quantitative
// determination", Anal. Chem. 40 (1968) 586-593), compatible conceptualmente
// con ISO 11929 para conteo con fondo conocido, pero NO son una
// implementacion completa de ISO 11929 (que en el caso general requiere
// resolver una ecuacion no lineal). No debe considerarse una certificacion
// metrologica formal.
// ============================================================================

// ---------------------------------------------------------------------------
// MOTOR 1 - FISICA NUCLEAR: DECAIMIENTO RADIACTIVO
// ---------------------------------------------------------------------------

const LN2 = Math.log(2);

// lambda = ln(2) / T_(1/2). Unidades: [1 / unidad de tiempo de T_half].
export function decayConstant(halfLife: number): number {
    if (!halfLife || halfLife <= 0) return 0;
    return LN2 / halfLife;
}

// A(t) = A0 * e^(-lambda*t) = A0 * 2^(-t/T_half)
export function activityAtElapsed(a0: number, halfLife: number, elapsed: number): number {
    if (a0 === null || a0 === undefined) return 0;
    if (elapsed <= 0) return a0;
    const lambda = decayConstant(halfLife);
    return a0 * Math.exp(-lambda * elapsed);
}

export type TheoreticalCompliance =
    | { aplica: false; mensaje: string }
  | { aplica: true; elapsedRequerido: number; etiqueta: "PREDICCION_MATEMATICA" };

// t = T_half * ln(A0/Alimite) / ln(2)
// Etiquetado explicitamente como prediccion matematica (seccion 12): NUNCA
// debe interpretarse como liberacion automatica.
export function theoreticalTimeToLimit(
    a0: number | null | undefined,
    limite: number | null | undefined,
    halfLife: number | null | undefined
  ): TheoreticalCompliance {
    if (a0 === null || a0 === undefined || !limite || limite <= 0 || !halfLife || halfLife <= 0) {
          return { aplica: false, mensaje: "INFORMACION INSUFICIENTE PARA UNA DECISION" };
    }
    if (a0 <= limite) {
          return { aplica: true, elapsedRequerido: 0, etiqueta: "PREDICCION_MATEMATICA" };
    }
    const elapsedRequerido = (halfLife * Math.log(a0 / limite)) / LN2;
    return { aplica: true, elapsedRequerido, etiqueta: "PREDICCION_MATEMATICA" };
}

// Fecha/hora teorica de cumplimiento (secciones 12 y 32). Nunca sustituye a
// la verificacion real.
export function theoreticalComplianceDateTime(referenceDateISO: string, elapsedDays: number): string | null {
    const ref = new Date(referenceDateISO);
    if (Number.isNaN(ref.getTime())) return null;
    return new Date(ref.getTime() + elapsedDays * 86400000).toISOString();
}

// ---------------------------------------------------------------------------
// MOTOR 1 - CADENAS DE DECAIMIENTO (ECUACIONES DE BATEMAN, caso de 2
// miembros: progenitor -> descendiente, p. ej. Mo-99 -> Tc-99m). Seccion 13.
// ---------------------------------------------------------------------------

// A2(t) = (lambda2/(lambda2-lambda1)) * A1_0 * (e^-lambda1*t - e^-lambda2*t)
//         + A2_0 * e^-lambda2*t
// No aplicable cuando lambda1 == lambda2 (caso degenerado).
export function batemanDaughterActivity(params: {
    parentA0: number;
    daughterA0?: number;
    lambdaParent: number;
    lambdaDaughter: number;
    elapsed: number;
}): number | null {
    const { parentA0, daughterA0 = 0, lambdaParent, lambdaDaughter, elapsed } = params;
    if (lambdaParent === lambdaDaughter) return null;
    const term1 =
          (lambdaDaughter / (lambdaDaughter - lambdaParent)) *
          parentA0 *
          (Math.exp(-lambdaParent * elapsed) - Math.exp(-lambdaDaughter * elapsed));
    const term2 = daughterA0 * Math.exp(-lambdaDaughter * elapsed);
    return term1 + term2;
}

// ---------------------------------------------------------------------------
// MOTOR 2 - METROLOGIA: CPS NETOS (seccion 15)
// ---------------------------------------------------------------------------

export type NetCpsResult = { netCps: number; distinguishableFromBackground: boolean };

// Rnet = Rgross - Rbackground. Si Rgross < Rbackground, NUNCA se devuelve un
// valor negativo: se marca explicitamente como no distinguible del fondo.
export function netCps(grossCps: number, backgroundCps: number): NetCpsResult {
    const net = (grossCps ?? 0) - (backgroundCps ?? 0);
    if (net <= 0) {
          return { netCps: 0, distinguishableFromBackground: false };
    }
    return { netCps: net, distinguishableFromBackground: true };
}

// ---------------------------------------------------------------------------
// MOTOR 2 - METODOS DE CONVERSION CPS -> ACTIVIDAD (seccion 16). Obliga a
// elegir un unico metodo; nunca se aplican ambos a la vez.
// ---------------------------------------------------------------------------

export type CalibrationMethod = "eficiencia" | "factor_calibracion";

export function activityFromEfficiency(netCpsValue: number, eficiencia: number): number | null {
    if (!eficiencia || eficiencia <= 0) return null;
    return netCpsValue / eficiencia;
}

export function activityFromCalibrationFactor(netCpsValue: number, factorCalibracionBqPorCps: number): number | null {
    if (factorCalibracionBqPorCps === null || factorCalibracionBqPorCps === undefined || factorCalibracionBqPorCps < 0) {
          return null;
    }
    return netCpsValue * factorCalibracionBqPorCps;
}

export function activityFromMethod(
    method: CalibrationMethod,
    netCpsValue: number,
    eficiencia: number | null | undefined,
    factorCalibracion: number | null | undefined
  ): number | null {
    if (method === "eficiencia") {
          if (!eficiencia) return null;
          return activityFromEfficiency(netCpsValue, eficiencia);
    }
    if (!factorCalibracion && factorCalibracion !== 0) return null;
    return activityFromCalibrationFactor(netCpsValue, factorCalibracion);
}

// ---------------------------------------------------------------------------
// MOTOR 2 - UMBRAL DE DECISION Y LIMITE DE DETECCION (seccion 22-24)
// Ver nota de cabecera: aproximacion clasica de Currie (1968), compatible con
// los conceptos de ISO 11929, NO una implementacion completa de la norma.
// ---------------------------------------------------------------------------

export type DecisionMetrologica =
    | "NO_DISTINGUIBLE_DEL_FONDO"
  | "DETECTADO"
  | "CUANTIFICABLE"
  | "CUANTIFICABLE_CON_INCERTIDUMBRE_RELEVANTE";

export type EvaluacionMetrologica = {
    netCps: number;
    umbralDecisionCps: number;
    limiteDeteccionCps: number;
    incertidumbreCps: number | null;
    decision: DecisionMetrologica;
};

// Umbral de decision (Currie L_C), en cps: L_C = k * sqrt(Rb*(1/tg + 1/tb))
export function decisionThresholdCps(backgroundCps: number, tGrossSec: number, tBackgroundSec: number, k = 1.645): number {
    if (!tGrossSec || !tBackgroundSec || tGrossSec <= 0 || tBackgroundSec <= 0) return 0;
    const rb = Math.max(0, backgroundCps ?? 0);
    return k * Math.sqrt(rb * (1 / tGrossSec + 1 / tBackgroundSec));
}

// Limite de deteccion (Currie L_D), aproximacion estandar L_D ~= 2 * L_C para
// k=1.645. Es una aproximacion documentada, no la solucion exacta de la
// ecuacion cuadratica de Currie.
export function detectionLimitCpsApprox(backgroundCps: number, tGrossSec: number, tBackgroundSec: number, k = 1.645): number {
    return 2 * decisionThresholdCps(backgroundCps, tGrossSec, tBackgroundSec, k);
}

// Incertidumbre combinada (1 sigma) de la tasa neta, Poisson independiente:
// sigma_net = sqrt(Rg/tg + Rb/tb)
export function netCpsUncertainty(
    grossCps: number,
    tGrossSec: number,
    backgroundCps: number,
    tBackgroundSec: number
  ): number | null {
    if (!tGrossSec || !tBackgroundSec || tGrossSec <= 0 || tBackgroundSec <= 0) return null;
    const rg = Math.max(0, grossCps ?? 0);
    const rb = Math.max(0, backgroundCps ?? 0);
    return Math.sqrt(rg / tGrossSec + rb / tBackgroundSec);
}

// Evaluacion metrologica integrada (seccion 22-24): nunca usa la logica
// simplificada "cps > 0 = contaminacion demostrada".
export function evaluarMetrologia(params: {
    grossCps: number;
    backgroundCps: number;
    tGrossSec: number;
    tBackgroundSec: number;
    k?: number;
}): EvaluacionMetrologica {
    const { grossCps, backgroundCps, tGrossSec, tBackgroundSec, k = 1.645 } = params;
    const { netCps: net } = netCps(grossCps, backgroundCps);
    const umbral = decisionThresholdCps(backgroundCps, tGrossSec, tBackgroundSec, k);
    const limite = detectionLimitCpsApprox(backgroundCps, tGrossSec, tBackgroundSec, k);
    const incertidumbre = netCpsUncertainty(grossCps, tGrossSec, backgroundCps, tBackgroundSec);

  let decision: DecisionMetrologica;
    if (net <= umbral) {
          decision = "NO_DISTINGUIBLE_DEL_FONDO";
    } else if (net <= limite) {
          decision = "DETECTADO";
    } else if (incertidumbre !== null && incertidumbre > 0 && net / incertidumbre < 3) {
          decision = "CUANTIFICABLE_CON_INCERTIDUMBRE_RELEVANTE";
    } else {
          decision = "CUANTIFICABLE";
    }

  return { netCps: net, umbralDecisionCps: umbral, limiteDeteccionCps: limite, incertidumbreCps: incertidumbre, decision };
}
