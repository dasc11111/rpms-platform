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


// ============================================================================
// FASE C: Motor 3 (Contaminacion Superficial) + Motor 4 (Tasa de Dosis) +
// Motor 5 (Regulacion y Decision). Funciones puras, sin acceso a base de
// datos (secciones 6, 17-21, 25-30, 36-38, 42-44 del Prompt Maestro
// Definitivo). Se combinan con Motor 1/2 (arriba) desde las rutas API
// /api/waste-items/* (src/lib/waste-expert-db.ts contiene el esquema).
// ============================================================================

// ---------------------------------------------------------------------------
// MOTOR 3 - CONTAMINACION SUPERFICIAL (secciones 17-21, 36)
// ---------------------------------------------------------------------------

// Sc = A / S. Nunca asume area del detector = area contaminada: el area
// debe venir explicitamente clasificada (ver AreaTipo) y confirmada por el
// usuario, nunca inferida automaticamente.
export type AreaTipo =
    | "ventana_detector"
| "area_activa"
| "area_efectiva"
| "area_superficie_evaluada"
| "area_total_objeto";

export function surfaceContaminationBqCm2(activityBq: number | null, areaCm2: number | null): number | null {
    if (activityBq === null || activityBq === undefined) return null;
    if (!areaCm2 || areaCm2 <= 0) return null;
    return activityBq / areaCm2;
}

// Diferencia contaminacion removible (wipe test) de la total estimada
// (medicion directa). NUNCA se asume que ambas son iguales (seccion 21).
export function removableFraction(wipeBqCm2: number | null, directBqCm2: number | null): number | null {
    if (wipeBqCm2 === null || wipeBqCm2 === undefined) return null;
    if (!directBqCm2 || directBqCm2 <= 0) return null;
    return wipeBqCm2 / directBqCm2;
}

export type ContaminationGridPoint = { punto: string; bqCm2: number | null };

export type ContaminationGridSummary = {
    maximo: number | null;
    minimo: number | null;
    promedio: number | null;
    puntosCriticos: string[];
};

// Mapa de contaminacion (seccion 36): maximo, minimo, promedio y puntos
// criticos (los que superan el limite aplicable, si se entrega).
export function summarizeContaminationGrid(
    points: ContaminationGridPoint[],
    limiteBqCm2?: number | null
    ): ContaminationGridSummary {
    const valores = points.map((p) => p.bqCm2).filter((v): v is number => v !== null && v !== undefined);
    if (valores.length === 0) {
        return { maximo: null, minimo: null, promedio: null, puntosCriticos: [] };
    }
    const maximo = Math.max(...valores);
    const minimo = Math.min(...valores);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const puntosCriticos =
        limiteBqCm2 !== undefined && limiteBqCm2 !== null
    ? points.filter((p) => p.bqCm2 !== null && p.bqCm2 !== undefined && p.bqCm2 > limiteBqCm2).map((p) => p.punto)
        : [];
    return { maximo, minimo, promedio, puntosCriticos };
}

// ---------------------------------------------------------------------------
// MOTOR 4 - PROTECCION RADIOLOGICA Y TASA DE DOSIS (secciones 25-26)
// PROHIBIDO: convertir automaticamente uSv/h a Bq/cm2 (son magnitudes
// distintas). Este motor es independiente del Motor 3.
// ---------------------------------------------------------------------------

export function netDoseRateUsvH(grossUsvH: number | null | undefined, backgroundUsvH: number | null | undefined): number | null {
    if (grossUsvH === null || grossUsvH === undefined) return null;
    const net = grossUsvH - (backgroundUsvH ?? 0);
    return net < 0 ? 0 : net;
}

// ---------------------------------------------------------------------------
// MOTOR 5 - REGULACION Y DECISION (secciones 27-31, 37-38, 42-44)
// ---------------------------------------------------------------------------

export type CriterioAplicable = {
    id: number;
    documentoFuente: string;
    tipoCriterio: "contaminacion" | "liberacion";
    valor: number;
    unidad: string;
};

// Compara SIEMPRE Bq/cm2 con Bq/cm2 (nunca Bq total contra un limite de
// Bq/cm2) y uSv/h con uSv/h de forma independiente (seccion 27-28).
export function cumpleCriterioContaminacion(bqCm2: number | null, limiteBqCm2: number | null): boolean | null {
    if (bqCm2 === null || bqCm2 === undefined || limiteBqCm2 === null || limiteBqCm2 === undefined) return null;
    return bqCm2 <= limiteBqCm2;
}

export function cumpleCriterioTasaDosis(usvH: number | null, limiteUsvH: number | null): boolean | null {
    if (usvH === null || usvH === undefined || limiteUsvH === null || limiteUsvH === undefined) return null;
    return usvH < limiteUsvH;
}

// Estados posibles de un residuo (seccion 31). No incluye ningun estado que
// implique liberacion automatica por decaimiento: LIBERADO siempre requiere
// autorizacion registrada explicitamente (seccion 6, 39, 43).
export const WASTE_ITEM_ESTADOS = [
    "registrado",
    "en_decaimiento",
    "pendiente_medicion",
    "pendiente_verificacion",
    "disponible_evaluacion_final",
    "liberado",
    "no_cumple",
    "bloqueado",
    ] as const;
export type WasteItemEstado = (typeof WASTE_ITEM_ESTADOS)[number];

export type FactorMultifactorial = {
    nombre: string;
    cumplido: boolean;
    detalle?: string;
};

export type EvaluacionMultifactorial = {
    factores: FactorMultifactorial[];
    todosCumplidos: boolean;
    faltantes: string[];
};

// Motor multifactorial de decision (seccion 30): la liberacion NUNCA se basa
// en un solo factor (p.ej. cps o vidas medias transcurridas). Requiere que
// TODOS los factores relevantes esten evaluados y cumplidos.
export function evaluarMultifactorial(factores: FactorMultifactorial[]): EvaluacionMultifactorial {
    const faltantes = factores.filter((f) => !f.cumplido).map((f) => f.nombre);
    return { factores, todosCumplidos: faltantes.length === 0, faltantes };
}

// Bloqueos automaticos (seccion 37): lista de motivos de bloqueo detectados.
// Si la lista no esta vacia, el residuo NUNCA puede pasar a "liberado".
export function detectarBloqueos(params: {
    radionuclideCode?: string | null;
    criterioIdentificado?: boolean;
    criterioVencido?: boolean;
    instrumentoVigente?: boolean;
    calibracionVigente?: boolean;
    factorOEficienciaExiste?: boolean;
    geometriaValidada?: boolean;
    resultadoCuantificable?: boolean;
    limiteDeteccionSuficiente?: boolean;
    incertidumbreRequiereVerificacion?: boolean;
    informacionCompleta?: boolean;
    medicionConsistente?: boolean;
    usuarioAutorizado?: boolean;
}): string[] {
    const motivos: string[] = [];
    if (!params.radionuclideCode) motivos.push("Falta radionuclido");
    if (params.criterioIdentificado === false) motivos.push("Falta criterio aplicable");
    if (params.criterioVencido === true) motivos.push("Criterio regulatorio vencido");
    if (params.instrumentoVigente === false) motivos.push("Instrumento sin vigencia de calibracion");
    if (params.calibracionVigente === false) motivos.push("Calibracion vencida");
    if (params.factorOEficienciaExiste === false) motivos.push("No existe factor de calibracion o eficiencia validada");
    if (params.geometriaValidada === false) motivos.push("Geometria de medicion no validada");
    if (params.resultadoCuantificable === false) motivos.push("Resultado no cuantificable");
    if (params.limiteDeteccionSuficiente === false) motivos.push("Limite de deteccion insuficiente");
    if (params.incertidumbreRequiereVerificacion === true) motivos.push("Incertidumbre requiere verificacion adicional");
    if (params.informacionCompleta === false) motivos.push("Informacion incompleta");
    if (params.medicionConsistente === false) motivos.push("Medicion inconsistente respecto de la prediccion teorica");
    if (params.usuarioAutorizado === false) motivos.push("Usuario no autorizado para esta accion");
    return motivos;
}

// Regla de precaucion (seccion 43) + regla de no invencion (seccion 44):
// ante cualquier duda tecnica, NUNCA declarar liberable.
export const INSUFICIENTE_PARA_DECISION = "INFORMACION INSUFICIENTE PARA UNA DECISION";



// Motor de explicacion (seccion 42): construye un texto minimo, comprensible
// y trazable para cada decision. No reemplaza la ficha completa ni el
// informe tecnico (seccion 41), solo resume el estado actual.
export function construirExplicacion(params: {
    itemCode: string;
    estado: WasteItemEstado;
    radionuclideCode: string;
    ultimaBqCm2: number | null;
    criterioBqCm2: number | null;
    ultimaMedicionValida: boolean | null;
    fechaTeoricaProximaEvaluacion: string | null;
}): string {
    const lineas: string[] = [];
    lineas.push(`Residuo ${params.itemCode} (${params.radionuclideCode}): estado ${params.estado}.`);
    if (params.ultimaBqCm2 !== null && params.criterioBqCm2 !== null) {
        lineas.push(`Ultima contaminacion medida: ${params.ultimaBqCm2} Bq/cm2 (criterio aplicable: ${params.criterioBqCm2} Bq/cm2).`);
    } else {
        lineas.push("Aun no hay medicion de contaminacion valida registrada.");
    }
    lineas.push(
        params.ultimaMedicionValida === false
        ? "La ultima medicion NO es valida para decision (revisar instrumento/calibracion/geometria)."
        : "La ultima medicion registrada es valida para efectos de seguimiento."
        );
    if (params.fechaTeoricaProximaEvaluacion) {
        lineas.push(`Fecha teorica estimada para la proxima evaluacion: ${params.fechaTeoricaProximaEvaluacion} (prediccion matematica, no es liberacion automatica).`);
    }
    lineas.push("La liberacion final requiere verificar todos los criterios aplicables y una autorizacion explicita registrada.");
    return lineas.join(" ");
}
