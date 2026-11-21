/**
 * BLINDAJE - MOTOR DE CALCULO MATEMATICO
 * Modulo: Medicina Nuclear - PET / PET-CT
 * FASE 6 del Prompt Maestro V2 (Motor Matematico)
 *
 * ============================================================================
 * FUENTE PRIMARIA DE TODAS LAS FORMULAS, TABLAS Y VALORES DE ESTE ARCHIVO
 * ============================================================================
 * Madsen MT, Anderson JA, Halama JR, Kleck J, Simpkin DJ, Votaw JR,
 * Wendt RE III, Williams LE, Yester MV.
 * "AAPM Task Group 108: PET and PET/CT Shielding Requirements."
 * Medical Physics, Vol. 33, No. 1, January 2006, pp. 4-15.
 * DOI: 10.1118/1.2135911
 * Documento fuente verificado en la carpeta Drive del proyecto
 * ("TG108 AAPM REQUIRIMIENTOS DE BLINDAJE.txt"), releido y re-extraido
 * textualmente el 11/09/2026 exclusivamente para esta implementacion.
 * Clasificacion: Nivel 2 (organismo/sociedad cientifica internacional -
 * AAPM), literatura revisada por pares.
 *
 * ============================================================================
 * ADVERTENCIA CRITICA DE MARCO REGULATORIO - CONFLICTO NO RESUELTO
 * ============================================================================
 * Este articulo fue escrito para la normativa de EE.UU. (10 CFR20, NRC).
 * Los valores de limite semanal de dosis (P) que aparecen en el articulo
 * original son ESPECIFICOS DE EE.UU. y NO deben presentarse como limite
 * legal chileno ni argentino:
 *   - Area no controlada / publico: P = 20 uSv/semana (equivale a 1 mSv/ano)
 *   - Area controlada, nivel ALARA habitual: P = 100 uSv/semana
 *   - Limite ocupacional regulatorio (10 CFR20): 50 mSv/ano
 *
 * Durante este proyecto se identificaron TRES marcos regulatorios en
 * potencial conflicto, NO conciliados todavia con el usuario:
 *   (1) Marco asumido inicialmente: Chile (CCHEN / MINSAL / ISP)
 *   (2) Marco real de gran parte de los documentos de la carpeta Drive:
 *       Argentina (ARN - Autoridad Regulatoria Nuclear)
 *   (3) Marco de esta fuente AAPM TG-108: EE.UU. (10 CFR20 / NRC)
 *
 * CONFLICTO NORMATIVO / TECNICO - REVISION EXPERTA REQUERIDA.
 * Este motor NO decide por si mismo cual marco aplica al proyecto. El
 * parametro P se implementa como VALOR CONFIGURABLE proveniente del motor
 * regulatorio (Fase 4, pendiente de definicion formal con el usuario). Los
 * valores de AAPM TG-108 se incluyen solo como catalogo de referencia con
 * su fuente explicita: son seleccionables pero NUNCA se aplican por
 * defecto sin confirmacion del profesional responsable (OPR / Fisico
 * Medico).
 *
 * Los criterios de diseno chilenos mencionados en el Prompt Maestro
 * (25 uSv/h area controlada, 2.5 uSv/h area no controlada) estan en
 * unidades de TASA DE DOSIS (uSv/h), mientras que P (AAPM TG-108) esta en
 * unidades de DOSIS SEMANAL ACUMULADA (uSv/semana). NO son equivalentes ni
 * intercambiables sin definir explicitamente una base temporal de
 * ocupacion semanal. Este motor NUNCA convierte automaticamente entre
 * ambos criterios sin confirmacion explicita del usuario.
 *
 * ============================================================================
 * REGLAS ANTI-FABRICACION APLICADAS
 * ============================================================================
 * - Todo valor numerico de este archivo proviene textualmente del
 *   documento fuente citado arriba, releido el 11/09/2026 (no se uso
 *   memoria de entrenamiento ni inferencia para ningun valor).
 * - Los coeficientes del modelo de Archer (Tabla V del articulo) fueron
 *   validados numericamente contra los valores publicados de transmision
 *   de la Tabla IV, en los tres materiales, a espesor "10" (10 mm para
 *   plomo, 10 cm para hormigon y hierro). Coincidencia dentro de +/-0.001
 *   en los tres casos => NIVEL DE CONFIANZA: ALTA. Ver funcion
 *   validarModeloArcher() al final de este archivo.
 * - Cada dato exportado incluye su objeto FuenteCita (documento, autores,
 *   anio, DOI, pagina aproximada de la revista, tabla/ecuacion de origen)
 *   para responder "De donde proviene este dato" (Seccion 33 del Prompt
 *   Maestro).
 * - Este motor corresponde EXCLUSIVAMENTE a la modalidad PET / PET-CT
 *   (medicina nuclear). No debe usarse para radiologia diagnostica,
 *   radioterapia, aceleradores ni braquiterapia sin una fuente propia
 *   validada para esas modalidades.
 * - NUNCA redondear espesores hacia abajo: ver redondearEspesorMinimo().
 */

// ============================================================================
// 1. TIPOS BASE DE TRAZABILIDAD
// ============================================================================

export type NivelConfianza = "ALTA" | "MEDIA" | "BAJA";
export type NivelJerarquia = "Nivel 1" | "Nivel 2" | "Nivel 3" | "Nivel 4";

export interface FuenteCita {
    documento: string;
    autores: string;
    publicacion: string;
    anio: number;
    doi?: string;
    paginaAprox: string;
    tablaOEcuacion: string;
    nivelJerarquia: NivelJerarquia;
    nivelConfianza: NivelConfianza;
    notas?: string;
}

const BASE_FUENTE_TG108: Omit<FuenteCita, "paginaAprox" | "tablaOEcuacion" | "notas" | "nivelConfianza"> = {
    documento: "AAPM Task Group 108: PET and PET/CT Shielding Requirements",
    autores: "Madsen, Anderson, Halama, Kleck, Simpkin, Votaw, Wendt, Williams, Yester",
    publicacion: "Medical Physics, Vol. 33, No. 1, enero 2006, pp. 4-15",
    anio: 2006,
    doi: "10.1118/1.2135911",
    nivelJerarquia: "Nivel 2",
};

function citaTG108(paginaAprox: string, tablaOEcuacion: string, nivelConfianza: NivelConfianza = "ALTA", notas?: string): FuenteCita {
    return { ...BASE_FUENTE_TG108, paginaAprox, tablaOEcuacion, nivelConfianza, notas };
}

export interface ResultadoTrazable<T> {
    valor: T;
    unidad: string;
    formula: string;
    fuente: FuenteCita;
    supuestos: string[];
    advertencias: string[];
}

// ============================================================================
// 2. TABLA I / II - RADIONUCLIDOS EMISORES DE POSITRONES (pag. 5-6)
// ============================================================================

export interface RadionuclidoPET {
    nuclido: string;
    semividaMin: number;
    modoDecaimiento: string;
    constanteDosisSvM2MBqH: number; // Tabla II, columna "Dose rate constant"
  dosisIntegrada1hSvM2MBq: number; // Tabla II, columna "1 hour integrated dose"
  fuente: FuenteCita;
}

export const RADIONUCLIDOS_PET: RadionuclidoPET[] = [
  { nuclido: "C-11", semividaMin: 20.4, modoDecaimiento: "beta+", constanteDosisSvM2MBqH: 0.148, dosisIntegrada1hSvM2MBq: 0.063, fuente: citaTG108("6", "Tabla II") },
  { nuclido: "N-13", semividaMin: 10.0, modoDecaimiento: "beta+", constanteDosisSvM2MBqH: 0.148, dosisIntegrada1hSvM2MBq: 0.034, fuente: citaTG108("6", "Tabla II") },
  { nuclido: "O-15", semividaMin: 2.0, modoDecaimiento: "beta+", constanteDosisSvM2MBqH: 0.148, dosisIntegrada1hSvM2MBq: 0.007, fuente: citaTG108("6", "Tabla II") },
  { nuclido: "F-18", semividaMin: 109.8, modoDecaimiento: "beta+, captura electronica", constanteDosisSvM2MBqH: 0.143, dosisIntegrada1hSvM2MBq: 0.119, fuente: citaTG108("6", "Tabla II", "ALTA", "Valor recomendado por el Task Group para blindaje: dosis equivalente efectiva segun ANSI/ANS-6.1.1 (1991).") },
  { nuclido: "Cu-64", semividaMin: 762, modoDecaimiento: "beta-, beta+, captura electronica", constanteDosisSvM2MBqH: 0.029, dosisIntegrada1hSvM2MBq: 0.024, fuente: citaTG108("6", "Tabla II") },
  { nuclido: "Ga-68", semividaMin: 68.3, modoDecaimiento: "beta+, captura electronica", constanteDosisSvM2MBqH: 0.134, dosisIntegrada1hSvM2MBq: 0.101, fuente: citaTG108("6", "Tabla II") },
  { nuclido: "Rb-82", semividaMin: 76 / 60, modoDecaimiento: "beta+, captura electronica", constanteDosisSvM2MBqH: 0.159, dosisIntegrada1hSvM2MBq: 0.006, fuente: citaTG108("6", "Tabla II") },
  { nuclido: "I-124", semividaMin: 4.2 * 24 * 60, modoDecaimiento: "beta+, captura electronica", constanteDosisSvM2MBqH: 0.185, dosisIntegrada1hSvM2MBq: 0.184, fuente: citaTG108("6", "Tabla II") },
  ];

/** Semivida de F-18 en minutos (Tabla I, pag. 5). Usada en el factor FU de la sala de imagen. */
export const SEMIVIDA_F18_MIN = 109.8;

/**
 * Constante de dosis del PACIENTE (no de la fuente puntual) recomendada por
 * el Task Group para F-18: incluye la autoatenuacion corporal.
 * Fuente textual (pag. 8-9): "the Task Group recommends using a patient
 * dose rate of 0.092 uSv m2/MBq h (3.4 uSv m2/h / 37 MBq) immediately after
 * administration. This corresponds to an effective body absorption factor
 * of 0.36".
 */
export const CONSTANTE_DOSIS_PACIENTE_F18_SV_M2_MBQ_H = 0.092;
export const FACTOR_ABSORCION_CORPORAL_F18 = 0.36;
export const FUENTE_CONSTANTE_DOSIS_PACIENTE_F18 = citaTG108("8-9", "Texto, seccion 'Patient attenuation'", "ALTA");

// ============================================================================
// 3. ECUACION 1 (pag. 9) - FACTOR DE REDUCCION POR DECAIMIENTO Rt
// Rt = D(t) / [Ddot(0) * t] = 1.443 * T_1/2/t * [1 - exp(-0.693 * t/T_1/2)]
// ============================================================================

export const FUENTE_EQ1_RT = citaTG108("9", "Ecuacion 1", "ALTA");

/**
 * Factor de reduccion por decaimiento radiactivo durante un intervalo t.
 * @param tMin tiempo transcurrido, en minutos
 * @param semividaMin semivida del radionuclido, en minutos
 */
export function calcularFactorReduccionDecaimiento(tMin: number, semividaMin: number): ResultadoTrazable<number> {
    const advertencias: string[] = [];
    if (tMin <= 0 || semividaMin <= 0) {
          advertencias.push("ERROR DE DATOS: tiempo y semivida deben ser mayores que cero.");
    }
    const valor = 1.443 * (semividaMin / tMin) * (1 - Math.exp(-0.693 * (tMin / semividaMin)));
    return {
          valor,
          unidad: "adimensional",
          formula: "Rt = 1.443 * (T1/2/t) * [1 - exp(-0.693 * t/T1/2)]",
          fuente: FUENTE_EQ1_RT,
          supuestos: ["Decaimiento radiactivo exponencial simple (sin biocinetica adicional)."],
          advertencias,
    };
}

/**
 * Valores de verificacion publicados textualmente para F-18 (pag. 9):
 * "For F-18, this corresponds to Rt factors of 0.91, 0.83, and 0.76 for
 * t=30, 60, and 90 min, respectively."
 * Se usan como casos de regresion (ver seccion 9 de este archivo).
 */
export const RT_F18_VERIFICACION = [
  { tMin: 30, rtEsperado: 0.91 },
  { tMin: 60, rtEsperado: 0.83 },
  { tMin: 90, rtEsperado: 0.76 },
  ];

// ============================================================================
// 4. LIMITES/CRITERIOS DE REFERENCIA AAPM TG-108 / 10 CFR20 (EE.UU.)
// SOLO CATALOGO DE REFERENCIA - NO SE APLICAN POR DEFECTO. Ver advertencia
// de marco regulatorio al inicio del archivo.
// ============================================================================

export interface CriterioReferenciaP {
    codigo: string;
    descripcion: string;
    areaTipo: "no controlada" | "controlada (ALARA)";
    pUSvSemana: number;
    equivalenciaAnual: string;
    fuente: FuenteCita;
}

export const CRITERIOS_P_REFERENCIA_AAPM: CriterioReferenciaP[] = [
  {
        codigo: "US_NRC_UNCONTROLLED",
        descripcion: "Limite semanal implicito por el limite de dosis efectiva de 1 mSv/ano a publico segun 10 CFR20 (EE.UU.)",
        areaTipo: "no controlada",
        pUSvSemana: 20,
        equivalenciaAnual: "1 mSv/ano (10 CFR20, EE.UU.) o 20 uSv en cualquier hora",
        fuente: citaTG108("9", "Texto, seccion 'Regulatory limits'", "ALTA"),
  },
  {
        codigo: "US_ALARA_CONTROLLED",
        descripcion: "Nivel ALARA habitual usado en calculos de blindaje para areas controladas (el limite regulatorio ocupacional pleno es 50 mSv/ano)",
        areaTipo: "controlada (ALARA)",
        pUSvSemana: 100,
        equivalenciaAnual: "~5 mSv/ano (nivel ALARA de diseno, no el limite regulatorio de 50 mSv/ano)",
        fuente: citaTG108("9", "Texto, seccion 'Regulatory limits'", "ALTA"),
  },
  ];

/**
 * NOTA DE COMPATIBILIDAD DE UNIDADES:
 * Los criterios de diseno chilenos citados en el Prompt Maestro (25 uSv/h
 * area controlada; 2.5 uSv/h area no controlada) estan en uSv/h (tasa),
 * NO en uSv/semana (dosis acumulada). Esta funcion existe unicamente para
 * dejar explicita la diferencia dimensional; NO debe usarse para producir
 * una conversion automatica sin que el usuario defina horas de ocupacion
 * semanal reales del punto de interes.
 */
export function advertenciaConversionCriterio(): string {
    return "ERROR DE UNIDADES POTENCIAL: no se puede convertir automaticamente entre uSv/h (criterio de diseno) y uSv/semana (P de AAPM TG-108) sin que el usuario confirme la base temporal de ocupacion semanal (horas/semana) del punto de interes. Debe configurarse explicitamente en el motor regulatorio (Fase 4).";
}

// ============================================================================
// 5. SALA DE CAPTACION / ESPERA ("uptake room") - Ecuaciones 2-8 (pag. 9-10)
// ============================================================================

export interface ParametrosSalaCaptacion {
    actividadAdministradaMBq: number; // Ao
  tiempoCaptacionH: number; // tU
  distanciaM: number; // d
  factorOcupacion: number; // T
  pacientesPorSemana: number; // Nw
  rtU?: number; // si no se entrega, se calcula con calcularFactorReduccionDecaimiento
  semividaMin?: number; // por defecto F-18
}

export const FUENTE_EQ2_3_SALA_CAPTACION = citaTG108("9", "Ecuaciones 2 y 3", "ALTA");
export const FUENTE_EQ4_8_TRANSMISION_CAPTACION = citaTG108("9-10", "Ecuaciones 4 a 8", "ALTA");

function resolverRtU(p: ParametrosSalaCaptacion): number {
    if (typeof p.rtU === "number") return p.rtU;
    const semivida = p.semividaMin ?? SEMIVIDA_F18_MIN;
    return calcularFactorReduccionDecaimiento(p.tiempoCaptacionH * 60, semivida).valor;
}

/**
 * Dosis semanal en un punto a distancia d de la sala de captacion.
 * Eq. 3: D_semana = 0.092 * Nw * Ao(MBq) * tU(h) * RtU / d(m)^2   [uSv]
 */
export function calcularDosisSemanalSalaCaptacion(p: ParametrosSalaCaptacion): ResultadoTrazable<number> {
    const rtU = resolverRtU(p);
    const advertencias: string[] = [];
    if (p.distanciaM <= 0) advertencias.push("ERROR DE DATOS: la distancia debe ser mayor que cero.");
    const valor =
          (CONSTANTE_DOSIS_PACIENTE_F18_SV_M2_MBQ_H * p.pacientesPorSemana * p.actividadAdministradaMBq * p.tiempoCaptacionH * rtU) /
          Math.pow(p.distanciaM, 2);
    return {
          valor,
          unidad: "uSv/semana",
          formula: "D_semana = 0.092 * Nw * Ao(MBq) * tU(h) * RtU / d(m)^2",
          fuente: FUENTE_EQ2_3_SALA_CAPTACION,
          supuestos: [
                  "Constante de dosis del paciente F-18 = 0.092 uSv*m2/(MBq*h) (factor de autoatenuacion corporal incluido).",
                  "No incluye blindaje propio de mobiliario ni del tomografo.",
                ],
          advertencias,
    };
}

/**
 * Factor de transmision B requerido para cumplir un limite/criterio P
 * (uSv/semana) configurado por el usuario. Eq. 4 (forma general):
 * B = 10.9 * P * d^2 / (T * Nw * Ao(MBq) * tU(h) * RtU)
 * IMPORTANTE: P debe ser provisto explicitamente por el usuario/motor
 * regulatorio (uSv/semana). Este motor NO asume un valor de P por
 * defecto (ver advertencia de marco regulatorio al inicio del archivo).
 */
export function calcularTransmisionRequeridaSalaCaptacion(
    p: ParametrosSalaCaptacion,
    pUSvSemana: number
  ): ResultadoTrazable<number> {
    const rtU = resolverRtU(p);
    const advertencias: string[] = [];
    if (p.distanciaM <= 0 || p.factorOcupacion <= 0 || p.pacientesPorSemana <= 0 || p.actividadAdministradaMBq <= 0) {
          advertencias.push("ERROR DE DATOS: distancia, factor de ocupacion, pacientes/semana y actividad deben ser mayores que cero.");
    }
    const valor =
          (10.9 * pUSvSemana * Math.pow(p.distanciaM, 2)) /
          (p.factorOcupacion * p.pacientesPorSemana * p.actividadAdministradaMBq * p.tiempoCaptacionH * rtU);
    return {
          valor,
          unidad: "adimensional (factor de transmision B, 0 a 1)",
          formula: "B = 10.9 * P(uSv/sem) * d(m)^2 / [T * Nw * Ao(MBq) * tU(h) * RtU]",
          fuente: FUENTE_EQ4_8_TRANSMISION_CAPTACION,
          supuestos: ["P debe ser ingresado por el usuario segun el criterio de diseno vigente para el proyecto (no incluido por defecto)."],
          advertencias,
    };
}

// ============================================================================
// 6. SALA DE TOMOGRAFO / IMAGEN ("imaging room") - Ecuaciones 9-12 (pag. 10-11)
// ============================================================================

export interface ParametrosSalaImagen extends ParametrosSalaCaptacion {
    tiempoImagenH: number; // tI
  rtI?: number;
    fu?: number; // decaimiento durante captacion; si no se entrega, se calcula
}

export const FUENTE_EQ9_SALA_IMAGEN = citaTG108("10-11", "Ecuacion 9", "ALTA");
export const FUENTE_EQ10_12_TRANSMISION_IMAGEN = citaTG108("11", "Ecuaciones 10 a 12", "ALTA");
export const FACTOR_VACIADO_VESICAL = 0.85; // "the patient will void... decreasing the dose rate by 0.85" (pag. 10)

function resolverRtI(p: ParametrosSalaImagen): number {
    if (typeof p.rtI === "number") return p.rtI;
    const semivida = p.semividaMin ?? SEMIVIDA_F18_MIN;
    return calcularFactorReduccionDecaimiento(p.tiempoImagenH * 60, semivida).valor;
}

function resolverFU(p: ParametrosSalaImagen): number {
    if (typeof p.fu === "number") return p.fu;
    const semivida = p.semividaMin ?? SEMIVIDA_F18_MIN;
    return Math.exp(-0.693 * ((p.tiempoCaptacionH * 60) / semivida));
}

/**
 * Dosis semanal en un punto a distancia d de la sala de tomografo.
 * Eq. 9: D_semana = 0.092 * Nw * Ao(MBq) * 0.85 * FU * tI(h) * RtI / d(m)^2
 */
export function calcularDosisSemanalSalaImagen(p: ParametrosSalaImagen): ResultadoTrazable<number> {
    const rtI = resolverRtI(p);
    const fu = resolverFU(p);
    const advertencias: string[] = [];
    if (p.distanciaM <= 0) advertencias.push("ERROR DE DATOS: la distancia debe ser mayor que cero.");
    const valor =
          (CONSTANTE_DOSIS_PACIENTE_F18_SV_M2_MBQ_H *
                 p.pacientesPorSemana *
                 p.actividadAdministradaMBq *
                 FACTOR_VACIADO_VESICAL *
                 fu *
                 p.tiempoImagenH *
                 rtI) /
          Math.pow(p.distanciaM, 2);
    return {
          valor,
          unidad: "uSv/semana",
          formula: "D_semana = 0.092 * Nw * Ao(MBq) * 0.85 * FU * tI(h) * RtI / d(m)^2",
          fuente: FUENTE_EQ9_SALA_IMAGEN,
          supuestos: [
                  "FU = exp(-0.693 * tU_min/semivida): decaimiento durante el periodo de captacion previo a la imagen.",
                  "Factor 0.85 asume vaciado vesical antes de la imagen (~15% de la actividad administrada se excreta).",
                  "No incluye la atenuacion propia del gantry/detectores del tomografo (el articulo trata esto como reduccion adicional opcional, no incluida aqui por defecto).",
                ],
          advertencias,
    };
}

/**
 * Factor de transmision requerido para la sala de imagen.
 * Eq. 10: B = 10.9 * P * d^2 / (T * Nw * Ao * 0.85 * FU * tI * RtI)
 */
export function calcularTransmisionRequeridaSalaImagen(
    p: ParametrosSalaImagen,
    pUSvSemana: number
  ): ResultadoTrazable<number> {
    const rtI = resolverRtI(p);
    const fu = resolverFU(p);
    const advertencias: string[] = [];
    if (p.distanciaM <= 0 || p.factorOcupacion <= 0 || p.pacientesPorSemana <= 0 || p.actividadAdministradaMBq <= 0) {
          advertencias.push("ERROR DE DATOS: distancia, factor de ocupacion, pacientes/semana y actividad deben ser mayores que cero.");
    }
    const valor =
          (10.9 * pUSvSemana * Math.pow(p.distanciaM, 2)) /
          (p.factorOcupacion * p.pacientesPorSemana * p.actividadAdministradaMBq * FACTOR_VACIADO_VESICAL * fu * p.tiempoImagenH * rtI);
    return {
          valor,
          unidad: "adimensional (factor de transmision B, 0 a 1)",
          formula: "B = 10.9 * P(uSv/sem) * d(m)^2 / [T * Nw * Ao(MBq) * 0.85 * FU * tI(h) * RtI]",
          fuente: FUENTE_EQ10_12_TRANSMISION_IMAGEN,
          supuestos: ["P debe ser ingresado por el usuario segun el criterio de diseno vigente para el proyecto (no incluido por defecto)."],
          advertencias,
    };
}

// ============================================================================
// 7. TABLA IV (pag. 7) - FACTORES DE TRANSMISION BROAD-BEAM A 511 keV
// Espesor: mm para plomo; cm para hormigon (densidad 2.35 g/cm3) y hierro.
// ============================================================================

export const FUENTE_TABLA_IV = citaTG108("7", "Tabla IV", "ALTA", "Calculo Monte Carlo (geometria broad-beam infinita, esquema de reciprocidad), no atenuacion narrow-beam.");

export interface FilaTablaIV {
    espesor: number; // mm si material=plomo, cm si hormigon/hierro
  plomo: number | null;
    hormigon: number | null;
    hierro: number | null;
}

export const TABLA_IV_TRANSMISION_511KEV: FilaTablaIV[] = [
  { espesor: 0, plomo: 1.0000, hormigon: 1.0000, hierro: 1.0000 },
  { espesor: 1, plomo: 0.8912, hormigon: 0.9583, hierro: 0.7484 },
  { espesor: 2, plomo: 0.7873, hormigon: 0.9088, hierro: 0.5325 },
  { espesor: 3, plomo: 0.6905, hormigon: 0.8519, hierro: 0.3614 },
  { espesor: 4, plomo: 0.6021, hormigon: 0.7889, hierro: 0.2353 },
  { espesor: 5, plomo: 0.5227, hormigon: 0.7218, hierro: 0.1479 },
  { espesor: 6, plomo: 0.4522, hormigon: 0.6528, hierro: 0.0905 },
  { espesor: 7, plomo: 0.3903, hormigon: 0.5842, hierro: 0.0542 },
  { espesor: 8, plomo: 0.3362, hormigon: 0.5180, hierro: 0.0319 },
  { espesor: 9, plomo: 0.2892, hormigon: 0.4558, hierro: 0.0186 },
  { espesor: 10, plomo: 0.2485, hormigon: 0.3987, hierro: 0.0107 },
  { espesor: 12, plomo: 0.1831, hormigon: 0.3008, hierro: 0.0035 },
  { espesor: 14, plomo: 0.1347, hormigon: 0.2243, hierro: 0.0011 },
  { espesor: 16, plomo: 0.0990, hormigon: 0.1662, hierro: 0.0004 },
  { espesor: 18, plomo: 0.0728, hormigon: 0.1227, hierro: 0.0001 },
  { espesor: 20, plomo: 0.0535, hormigon: 0.0904, hierro: null },
  { espesor: 25, plomo: 0.0247, hormigon: 0.0419, hierro: null },
  { espesor: 30, plomo: 0.0114, hormigon: 0.0194, hierro: null },
  { espesor: 40, plomo: 0.0024, hormigon: 0.0042, hierro: null },
  { espesor: 50, plomo: 0.0005, hormigon: 0.0009, hierro: null },
  ];

export const DENSIDAD_HORMIGON_TABLA_IV_G_CM3 = 2.35;

// ============================================================================
// 8. TABLA V (pag. 7) - PARAMETROS DE AJUSTE AL MODELO DE ARCHER
// B(x) = [(1+beta/alfa) * exp(alfa*gamma*x) - beta/alfa] ^ (-1/gamma)
// x SIEMPRE en cm en este modelo (alfa y beta en cm^-1). Para plomo, la
// Tabla IV lista el espesor en mm: se debe dividir por 10 antes de usar
// estas formulas (verificado numericamente, ver validarModeloArcher()).
// ============================================================================

export const FUENTE_TABLA_V_ARCHER = citaTG108("7", "Tabla V", "ALTA", "Parametros de ajuste al modelo de Archer et al. (Ref. 10 del articulo original) sobre los datos Monte Carlo de la Tabla IV.");

export interface ParametrosArcher {
    material: "plomo" | "hormigon" | "hierro";
    alfaCm: number;
    betaCm: number;
    gamma: number;
}

export const PARAMETROS_ARCHER_511KEV: ParametrosArcher[] = [
  { material: "plomo", alfaCm: 1.543, betaCm: -0.4408, gamma: 2.136 },
  { material: "hormigon", alfaCm: 0.1539, betaCm: -0.1161, gamma: 2.0752 },
  { material: "hierro", alfaCm: 0.5704, betaCm: -0.3063, gamma: 0.6326 },
  ];

/**
 * Modelo de Archer: transmision B en funcion del espesor x (cm).
 */
export function transmisionArcher(xCm: number, prm: ParametrosArcher): number {
    const { alfaCm: a, betaCm: b, gamma: g } = prm;
    const base = (1 + b / a) * Math.exp(a * g * xCm) - b / a;
    return Math.pow(base, -1 / g);
}

/**
 * Inversa del modelo de Archer: espesor x (cm) necesario para alcanzar una
 * transmision B dada.
 * x = (1/(alfa*gamma)) * ln{ [B^(-gamma) - beta/alfa] / [1 + beta/alfa] }
 */
export function espesorRequeridoArcher(bObjetivo: number, prm: ParametrosArcher): number {
    const { alfaCm: a, betaCm: b, gamma: g } = prm;
    const numerador = Math.pow(bObjetivo, -g) - b / a;
    const denominador = 1 + b / a;
    return (1 / (a * g)) * Math.log(numerador / denominador);
}

/**
 * NUNCA REDONDEAR HACIA ABAJO (Prompt Maestro, Seccion 23 / 61). Redondea
 * un espesor calculado hacia arriba, al multiplo de granularidad indicado
 * (por ejemplo, planchas de plomo disponibles en incrementos de 1 mm).
 */
export function redondearEspesorMinimo(valorCalculado: number, granularidad: number): number {
    return Math.ceil(valorCalculado / granularidad) * granularidad;
}

/**
 * VALIDACION CRUZADA (no fabricacion): compara el modelo de Archer contra
 * los valores publicados de la Tabla IV en x=10 (10 mm plomo = 1 cm; 10 cm
 * hormigon; 10 cm hierro). Debe usarse en las pruebas de regresion del
 * motor (Fase 15 del Prompt Maestro).
 */
export function validarModeloArcher(): { material: string; calculado: number; publicadoTablaIV: number; diferenciaAbs: number }[] {
    const filaRef = TABLA_IV_TRANSMISION_511KEV.find((f) => f.espesor === 10)!;
    return PARAMETROS_ARCHER_511KEV.map((prm) => {
          const xCm = prm.material === "plomo" ? 1.0 : 10.0; // 10 mm Pb = 1 cm
                                            const publicado = prm.material === "plomo" ? filaRef.plomo! : prm.material === "hormigon" ? filaRef.hormigon! : filaRef.hierro!;
          const calculado = transmisionArcher(xCm, prm);
          return { material: prm.material, calculado, publicadoTablaIV: publicado, diferenciaAbs: Math.abs(calculado - publicado) };
    });
}

// ============================================================================
// 9. CASOS DE REGRESION - EJEMPLOS PUBLICADOS TEXTUALMENTE EN EL ARTICULO
// (Fase 15 del Prompt Maestro: pruebas de regresion obligatorias). Estos
// casos NO deben modificarse sin releer el articulo fuente: son la unica
// forma de detectar errores de implementacion.
// ============================================================================

export const FUENTE_EJEMPLOS = citaTG108("9-13", "Ejemplos 1, 2, 4, 5 y 6 del articulo", "ALTA");

/**
 * Ejemplo 1 (pag. 9-10): sala de captacion, area no controlada, T=1, d=4 m,
 * Ao=555 MBq, Nw=40 pacientes/semana, tU=1 h.
 * Resultado publicado: B = 0.189 (texto dice "=0.189"); redondeado a 4
 * cifras el motor puede diferir en el 3er/4to decimal por redondeos
 * intermedios del articulo original - se acepta tolerancia +/-0.002.
 * Blindaje resultante segun el articulo: 1.2 cm de plomo o 15 cm de hormigon.
 */
export const EJEMPLO_1_SALA_CAPTACION: ParametrosSalaCaptacion = {
    actividadAdministradaMBq: 555,
    tiempoCaptacionH: 1,
    distanciaM: 4,
    factorOcupacion: 1,
    pacientesPorSemana: 40,
};
export const EJEMPLO_1_B_ESPERADO = 0.189;
export const EJEMPLO_1_P_USV_SEMANA = 20; // uncontrolled, AAPM/US

/**
 * Ejemplo 2 (pag. 11): sala de imagen, d=3 m, Ao=555 MBq, Nw=40, tU=60 min,
 * tI=30 min. Dosis semanal publicada: 59.7 uSv. B publicado (T=1): 0.34.
 * Blindaje resultante segun el articulo: 0.8 cm de plomo o 11 cm de hormigon.
 */
export const EJEMPLO_2_SALA_IMAGEN: ParametrosSalaImagen = {
    actividadAdministradaMBq: 555,
    tiempoCaptacionH: 1,
    tiempoImagenH: 0.5,
    distanciaM: 3,
    factorOcupacion: 1,
    pacientesPorSemana: 40,
};
export const EJEMPLO_2_DOSIS_SEMANAL_ESPERADA_USV = 59.7;
export const EJEMPLO_2_B_ESPERADO = 0.34;
export const EJEMPLO_2_P_USV_SEMANA = 20;

/**
 * Ejemplos 4 y 5 (pag. 12): habitaciones sobre/bajo la sala de captacion.
 * Distancia fuente-piso 1 m; medicion a 0.5 m sobre el piso (sala superior)
 * o 1.7 m sobre el piso (sala inferior); separacion entre losas 4.3 m; 10 cm
 * de hormigon existente entre losas.
 * Ejemplo 4 (sala superior): d = 4.3 - 1 + 0.5 = 3.8 m; dosis semanal = 117 uSv;
 * B = 20/117 = 0.17; blindaje total requerido: 1.3 cm Pb o 17 cm hormigon
 * (menos 10 cm hormigon ya existente = 0.65 cm Pb o 7 cm hormigon adicional).
 * Ejemplo 5 (sala inferior): d = 4.3 + 1 - 1.7 = 3.6 m; dosis semanal = 131 uSv;
 * B = 20/131 = 0.15; mismo blindaje adicional resultante (0.65 cm Pb o 7 cm).
 */
export const EJEMPLO_4_SALA_SUPERIOR: ParametrosSalaCaptacion = {
    actividadAdministradaMBq: 555,
    tiempoCaptacionH: 1,
    distanciaM: 4.3 - 1 + 0.5,
    factorOcupacion: 1,
    pacientesPorSemana: 40,
};
export const EJEMPLO_4_DOSIS_SEMANAL_ESPERADA_USV = 117;
export const EJEMPLO_4_B_ESPERADO = 0.17;

export const EJEMPLO_5_SALA_INFERIOR: ParametrosSalaCaptacion = {
    actividadAdministradaMBq: 555,
    tiempoCaptacionH: 1,
    distanciaM: 4.3 + 1 - 1.7,
    factorOcupacion: 1,
    pacientesPorSemana: 40,
};
export const EJEMPLO_5_DOSIS_SEMANAL_ESPERADA_USV = 131;
export const EJEMPLO_5_B_ESPERADO = 0.15;

/**
 * Ejecuta todos los casos de regresion contra las funciones del motor y
 * devuelve diferencias absolutas para inspeccion (Fase 15). NO lanza
 * excepciones: reporta desviaciones para revision experta.
 */
export function ejecutarCasosDeRegresion() {
    const r1 = calcularTransmisionRequeridaSalaCaptacion(EJEMPLO_1_SALA_CAPTACION, EJEMPLO_1_P_USV_SEMANA);
    const r2dosis = calcularDosisSemanalSalaImagen(EJEMPLO_2_SALA_IMAGEN);
    const r2b = calcularTransmisionRequeridaSalaImagen(EJEMPLO_2_SALA_IMAGEN, EJEMPLO_2_P_USV_SEMANA);
    const r4dosis = calcularDosisSemanalSalaCaptacion(EJEMPLO_4_SALA_SUPERIOR);
    const r5dosis = calcularDosisSemanalSalaCaptacion(EJEMPLO_5_SALA_INFERIOR);
    const rArcher = validarModeloArcher();
    const rRt = RT_F18_VERIFICACION.map((c) => ({
          tMin: c.tMin,
          esperado: c.rtEsperado,
          calculado: calcularFactorReduccionDecaimiento(c.tMin, SEMIVIDA_F18_MIN).valor,
    }));
    return {
          ejemplo1_B: { calculado: r1.valor, esperado: EJEMPLO_1_B_ESPERADO, diferencia: Math.abs(r1.valor - EJEMPLO_1_B_ESPERADO) },
          ejemplo2_dosis: { calculado: r2dosis.valor, esperado: EJEMPLO_2_DOSIS_SEMANAL_ESPERADA_USV, diferencia: Math.abs(r2dosis.valor - EJEMPLO_2_DOSIS_SEMANAL_ESPERADA_USV) },
          ejemplo2_B: { calculado: r2b.valor, esperado: EJEMPLO_2_B_ESPERADO, diferencia: Math.abs(r2b.valor - EJEMPLO_2_B_ESPERADO) },
          ejemplo4_dosis: { calculado: r4dosis.valor, esperado: EJEMPLO_4_DOSIS_SEMANAL_ESPERADA_USV, diferencia: Math.abs(r4dosis.valor - EJEMPLO_4_DOSIS_SEMANAL_ESPERADA_USV) },
          ejemplo5_dosis: { calculado: r5dosis.valor, esperado: EJEMPLO_5_DOSIS_SEMANAL_ESPERADA_USV, diferencia: Math.abs(r5dosis.valor - EJEMPLO_5_DOSIS_SEMANAL_ESPERADA_USV) },
          modeloArcher: rArcher,
          factorDecaimientoRt: rRt,
    };
}

/**
 * DISCLAIMER LEGAL OBLIGATORIO (Prompt Maestro, Seccion 62). Debe mostrarse
 * junto a cualquier resultado producido por este motor.
 */
export const DISCLAIMER_LEGAL =
    "Los resultados corresponden a una herramienta de apoyo para el diseno y evaluacion de proteccion radiologica. La responsabilidad profesional del estudio, su revision y su presentacion ante la autoridad competente corresponde al profesional responsable.";

// ============================================================================
// 10. INTEGRACION CON NCRP REPORT No. 151 (ver ncrp151-shielding-references.ts)
// ============================================================================
// Instruccion del usuario (12/09/2026): "Todo se debe alimentar de NCRP 147
// o NCRP 151 dependiendo de la practica."
//
// ACTUALIZACION (13/09/2026): el usuario preciso la instruccion: "usa la
// del ncrp 151 como fuente primaria para estos casos [medicina nuclear /
// PET-PET-CT] y para diagnostico por imagen la ncrp 147." Esto reemplaza
// la convencion anterior de este archivo (que tomaba T y P de NCRP 147
// como fuente "universal"). Convencion vigente para PET/PET-CT, documentada
// y auditable:
//   - El factor de ocupacion T de cada punto de interes DEBE tomarse del
//     catalogo NCRP 151, Tabla B.1 (FACTORES_OCUPACION_NCRP151 en
//     ncrp151-shielding-references.ts), o de su adaptacion documentada a
//     medicina nuclear (MAPEO_OCUPACION_NCRP151_MEDICINA_NUCLEAR en el
//     mismo archivo), nunca de NCRP 147.
//   - El criterio P (limite/objetivo semanal) recomendado por defecto para
//     PET/PET-CT pasa a ser el de NCRP 151 (OBJETIVOS_DISENO_P_NCRP151),
//     verificado textualmente en los ejemplos numericos del Capitulo 7
//     (Secciones 7.1.8, 7.1.9 y 7.1.13: P = 20 uSv/semana no controlada;
//     100 uSv/semana controlada). Estos valores ya estan en dosis
//     equivalente (Sv), la misma magnitud fisica que usan las funciones de
//     transmision de este archivo (Eq. 4-8 y 10-12), por lo que no requieren
//     la advertencia de conversion de unidades que si aplica a NCRP 147.
//   - NCRP 147 (ncrp147-shielding-references.ts) queda reservado como fuente
//     primaria de T y P EXCLUSIVAMENTE para la futura Fase de imagenologia
//     diagnostica con rayos X, y ya no se usa por defecto en este archivo.
//   - El estado anterior ("solo catalogo de referencia, no aplicado por
//     defecto", ver CRITERIOS_P_REFERENCIA_AAPM arriba) y la convencion
//     intermedia que uso NCRP 147 (12/09/2026) quedan conservados
//     unicamente para trazabilidad historica; no deben usarse en nuevos
//     calculos de PET/PET-CT.
//   - NCRP 151 tambien se usara para aceleradores/radioterapia de
//     megavoltaje (TVL, barreras, laberintos) cuando se aborde esa fase;
//     ese contenido especifico queda PENDIENTE (ver
//     NCRP151_TVL_Y_BARRERAS_PENDIENTE en ncrp151-shielding-references.ts).

/**
 * Valor de P recomendado por defecto para PET/PET-CT, expresado en las
 * mismas unidades que usan las funciones de este archivo (uSv/semana),
 * tomando el valor de NCRP 151 (dosis equivalente, ver advertencia de
 * unidades) como fuente primaria por instruccion explicita del usuario
 * (13/09/2026).
 */
export const P_RECOMENDADO_NO_CONTROLADA_USV_SEMANA = 20; // NCRP151: 20 uSv/semana (Seccion 7.1.9)
export const P_RECOMENDADO_CONTROLADA_USV_SEMANA = 100; // NCRP151: 0.1 mSv/semana = 100 uSv/semana (Secciones 7.1.8 y 7.1.13)
export const FUENTE_P_RECOMENDADO: FuenteCita = {
      documento:
              "NCRP Report No. 151: Structural Shielding Design and Evaluation for Megavoltage X- and Gamma-Ray Radiotherapy Facilities",
      autores: "National Council on Radiation Protection and Measurements (NCRP)",
      publicacion: "NCRP, Bethesda, MD, 31 de diciembre de 2005",
      anio: 2005,
      paginaAprox: "121, 125, 137",
      tablaOEcuacion: "Ejemplos, Secciones 7.1.8, 7.1.9 y 7.1.13",
      nivelJerarquia: "Nivel 2",
      nivelConfianza: "ALTA",
      notas:
              "Valor tomado de NCRP 151 (ver ncrp151-shielding-references.ts, OBJETIVOS_DISENO_P_NCRP151). Coincide numericamente con el P de AAPM TG-108 Seccion 'Regulatory limits', pero se cita aqui la fuente primaria segun instruccion del usuario (13/09/2026). NCRP 151 y AAPM TG-108 expresan P en la misma magnitud fisica (dosis equivalente/efectiva, Sv); a diferencia de NCRP 147 (kerma en aire), no se requiere aqui la advertencia de conversion de unidades. Ver advertenciaUnidadesP151() en ncrp151-shielding-references.ts.",
};


// ============================================================================
// 11. CONTENIDO ADICIONAL FUSIONADO DESDE aapm-tg108-petct-references.ts
// (fusion por instruccion del usuario, opcion "b": conservar unicamente el
// contenido UNICO no duplicado en este motor; el archivo
// aapm-tg108-petct-references.ts queda DEPRECADO tras esta fusion, ver nota
// en su encabezado). Fecha de fusion: 16/09/2026.
// ============================================================================

// ---- 11.1 Resolucion de la advertencia de unidad de Tabla V (plomo) ----
// El archivo fusionado marcaba como PENDIENTE_DE_VERIFICACION si alfa/beta
// de plomo (Tabla V) estaban en cm^-1 o mm^-1. Esta ambiguedad QUEDA
// RESUELTA por la validacion cruzada ya existente en este motor (ver
// validarModeloArcher(), Seccion 8): al usar x=1.0 cm (10 mm de plomo) con
// alfa/beta en cm^-1, el modelo reproduce el valor publicado de la Tabla IV
// para 10 mm de plomo dentro de +/-0.001. CONCLUSION: alfa y beta de plomo
// SI estan en cm^-1, igual que hormigon y hierro (no mm^-1). Confianza: ALTA.

// ---- 11.2 Tabla I - propiedades fisicas adicionales de radionucleidos PET ----
// (energia maxima del positron, fotones de emision y fotones/decaimiento;
// no presentes en RADIONUCLIDOS_PET de la Seccion 2, que solo trae datos
// de la Tabla II).
export const FUENTE_TABLA_I_PROPIEDADES_FISICAS = citaTG108("4-5", "Tabla I", "ALTA");

export interface PropiedadesFisicasNucleidoPET {
  nuclido: string;
  semividaTexto: string;
  modoDecaimiento: string;
  energiaMaximaPositronMeV: number | null;
  fotonesEmisionKeV: number[];
  fotonesPorDecaimiento: number[];
  notas?: string;
}

export const PROPIEDADES_FISICAS_TABLA_I: PropiedadesFisicasNucleidoPET[] = [
  { nuclido: "C-11", semividaTexto: "20.4 min", modoDecaimiento: "beta+", energiaMaximaPositronMeV: 0.96, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [2.0] },
  { nuclido: "N-13", semividaTexto: "10.0 min", modoDecaimiento: "beta+", energiaMaximaPositronMeV: 1.19, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [2.0] },
  { nuclido: "O-15", semividaTexto: "2.0 min", modoDecaimiento: "beta+", energiaMaximaPositronMeV: 1.72, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [2.0] },
  { nuclido: "F-18", semividaTexto: "109.8 min", modoDecaimiento: "beta+, captura electronica", energiaMaximaPositronMeV: 0.63, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [1.93] },
  { nuclido: "Cu-64", semividaTexto: "12.7 h", modoDecaimiento: "beta-, beta+, captura electronica", energiaMaximaPositronMeV: 0.65, fotonesEmisionKeV: [511, 1346], fotonesPorDecaimiento: [0.38, 0.005] },
  { nuclido: "Ga-68", semividaTexto: "68.3 min", modoDecaimiento: "beta+, captura electronica", energiaMaximaPositronMeV: 1.9, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [1.84] },
  { nuclido: "Rb-82", semividaTexto: "76 s", modoDecaimiento: "beta+, captura electronica", energiaMaximaPositronMeV: 3.35, fotonesEmisionKeV: [511, 776], fotonesPorDecaimiento: [1.90, 0.13] },
  {
    nuclido: "I-124",
    semividaTexto: "4.2 d",
    modoDecaimiento: "beta+, captura electronica",
    energiaMaximaPositronMeV: null,
    fotonesEmisionKeV: [511, 603, 1693],
    fotonesPorDecaimiento: [0.5, 0.62, 0.3],
    notas: "PENDIENTE_DE_VERIFICACION: la energia maxima del positron para I-124 no se pudo parear con confianza a su columna exacta en la extraccion de texto (columnas desalineadas por un salto de pagina en la tabla original). Los valores de fotones/decaimiento SI son consistentes con datos nucleares conocidos de I-124 (confianza ALTA).",
  },
];

// ---- 11.3 Tabla III - constantes alternativas reportadas para F-18 ----
export const FUENTE_TABLA_III_CONSTANTES_F18 = citaTG108(
  "5-6",
  "Tabla III",
  "ALTA",
  "Constantes alternativas de tasa de dosis/exposicion para F-18 reportadas en la literatura citada por el articulo. Solo 0.092 (dosis de paciente, Seccion 2) y 0.143 (dosis equivalente efectiva, usada en RADIONUCLIDOS_PET) se usan por defecto en este motor; el resto se conserva como catalogo de referencia."
);

export interface ConstanteAlternativaF18 {
  parametro: string;
  valor: number;
  unidad: string;
  notas?: string;
}

export const CONSTANTES_ALTERNATIVAS_F18_TABLA_III: ConstanteAlternativaF18[] = [
  { parametro: "Constante de tasa de exposicion", valor: 15.4, unidad: "R*m^2/(MBq*h)" },
  { parametro: "Constante de tasa de kerma en aire", valor: 0.134, unidad: "uSv*m^2/(MBq*h)" },
  { parametro: "Dosis equivalente efectiva (ANSI/ANS-6.1.1, 1991)", valor: 0.143, unidad: "uSv*m^2/(MBq*h)", notas: "Valor usado por defecto en RADIONUCLIDOS_PET (Seccion 2) para F-18." },
  { parametro: "Constante de dosis en tejido", valor: 0.148, unidad: "uSv*m^2/(MBq*h)", notas: "Dosis a 1 cm^3 de tejido unitario en densidad, en aire." },
  { parametro: "Dosis equivalente profunda (ANS, 1977)", valor: 0.183, unidad: "uSv*m^2/(MBq*h)", notas: "Dosis a 1 cm de profundidad en slab de tejido de 30 cm expuesto a haz ancho de 511 keV." },
  { parametro: "Dosis maxima (ANS, 1977)", valor: 0.188, unidad: "uSv*m^2/(MBq*h)", notas: "Dosis maxima en slab de tejido de 30 cm (incluye retrodispersion lateral); profundidad de dosis maxima = 3 mm." },
];

// ---- 11.4 Limites regulatorios detallados (10 CFR 20) ----
// Complementa CRITERIOS_P_REFERENCIA_AAPM (Seccion 4) con el limite legal
// ocupacional pleno y el limite horario, no incluidos alli.
export const FUENTE_LIMITES_REGULATORIOS_DETALLADOS = citaTG108("8", "Seccion 'Regulatory limits'", "ALTA");

export interface LimiteRegulatorioDetallado {
  codigo: string;
  descripcionEs: string;
  valorAnualMSv?: number;
  valorSemanalUSv?: number;
  valorPorHoraUSv?: number;
}

export const LIMITES_REGULATORIOS_DETALLADOS_TG108: LimiteRegulatorioDetallado[] = [
  { codigo: "PUBLICO_ANUAL", descripcionEs: "Limite de dosis efectiva en areas no controladas (publico), 10 CFR 20", valorAnualMSv: 1, valorSemanalUSv: 20 },
  { codigo: "PUBLICO_POR_HORA", descripcionEs: "Limite de dosis efectiva en cualquier hora, areas no controladas", valorPorHoraUSv: 20 },
  { codigo: "OCUPACIONAL_LEGAL_ANUAL", descripcionEs: "Limite legal de dosis ocupacional en areas controladas (10 CFR 20), limite regulatorio pleno, NO el nivel de diseno ALARA", valorAnualMSv: 50 },
  { codigo: "OCUPACIONAL_ALARA_ANUAL", descripcionEs: "Objetivo de diseno ALARA tipico para areas controladas (nivel de diseno recomendado, no el limite legal de 50 mSv/ano)", valorAnualMSv: 5, valorSemanalUSv: 100 },
];

// ---- 11.5 Glosario de parametros (Tabla VI) ----
export const FUENTE_GLOSARIO_TABLA_VI = citaTG108("8", "Tabla VI", "ALTA");

export const GLOSARIO_PARAMETROS_TABLA_VI: { simbolo: string; descripcionEs: string }[] = [
  { simbolo: "A0", descripcionEs: "Actividad administrada (MBq)" },
  { simbolo: "t", descripcionEs: "Tiempo (h)" },
  { simbolo: "tU", descripcionEs: "Tiempo de captacion/reposo (uptake) (h)" },
  { simbolo: "tI", descripcionEs: "Tiempo de adquisicion de imagen (h)" },
  { simbolo: "D(t)", descripcionEs: "Dosis total en el tiempo t (uSv)" },
  { simbolo: "D0punto", descripcionEs: "Tasa de dosis inicial (uSv/h)" },
  { simbolo: "T1/2", descripcionEs: "Vida media del radionucleido (h)" },
  { simbolo: "Rt", descripcionEs: "Factor de reduccion de dosis por decaimiento durante el tiempo t" },
  { simbolo: "RtU", descripcionEs: "Factor de reduccion de dosis durante el tiempo de captacion tU" },
  { simbolo: "RtI", descripcionEs: "Factor de reduccion de dosis durante el tiempo de imagen tI" },
  { simbolo: "Nw", descripcionEs: "Numero de pacientes por semana" },
  { simbolo: "d", descripcionEs: "Distancia de la fuente a la barrera (m)" },
  { simbolo: "FU", descripcionEs: "Factor de decaimiento durante el tiempo de captacion (uptake)" },
  { simbolo: "T", descripcionEs: "Factor de ocupacion" },
  { simbolo: "P", descripcionEs: "Limite de dosis semanal de diseno (uSv)" },
  { simbolo: "B", descripcionEs: "Factor de transmision requerido de la barrera" },
];

// ---- 11.6 Catalogo de ecuaciones TG-108 con formas numericas explicitas ----
// Complementa las funciones ya implementadas (Secciones 3, 5 y 6) con las
// formas numericas explicitas publicadas en el articulo (constantes ya
// sustituidas), utiles para documentacion/UI y verificacion manual.
export const FUENTE_CATALOGO_ECUACIONES = citaTG108("8-11", "Ecuaciones 1-12", "ALTA");

export interface EcuacionCatalogoTG108 {
  numero: string;
  nombreEs: string;
  formula: string;
  notas?: string;
  funcionEnEsteMotor?: string;
}

export const CATALOGO_ECUACIONES_TG108: EcuacionCatalogoTG108[] = [
  { numero: "Eq. 1", nombreEs: "Factor de reduccion por decaimiento Rt", formula: "Rt = 1.443*(T1/2/t)*[1-exp(-0.693*t/T1/2)]", funcionEnEsteMotor: "calcularFactorReduccionDecaimiento()" },
  { numero: "Eq. 2", nombreEs: "Dosis en sala de captacion, un paciente", formula: "D(tU) = 0.092 * A0[MBq] * tU[h] * RtU / d[m]^2" },
  { numero: "Eq. 3", nombreEs: "Dosis semanal en sala de captacion", formula: "D_semana = 0.092 * Nw * A0[MBq] * tU[h] * RtU / d[m]^2", funcionEnEsteMotor: "calcularDosisSemanalSalaCaptacion()" },
  { numero: "Eq. 4", nombreEs: "Transmision requerida, forma general (captacion)", formula: "B = 10.9 * P[uSv] * d[m]^2 / (T*Nw*A0[MBq]*tU[h]*RtU)", funcionEnEsteMotor: "calcularTransmisionRequeridaSalaCaptacion()" },
  { numero: "Eq. 5", nombreEs: "Transmision, area no controlada (P=20 uSv/sem), A0 en MBq", formula: "B = 218 * d^2 / (T*Nw*A0[MBq]*tU*RtU)", notas: "Forma numerica de Eq.4 con P=20 sustituido; equivale a calcularTransmisionRequeridaSalaCaptacion() con pUSvSemana=20." },
  { numero: "Eq. 6", nombreEs: "Transmision, area no controlada, A0 en mCi", formula: "B = 5.89 * d^2 / (T*Nw*A0[mCi]*tU*RtU)", notas: "Equivalente a Eq.5 en unidades mCi; este motor usa MBq exclusivamente." },
  { numero: "Eq. 7", nombreEs: "Transmision, area controlada ALARA (P=100 uSv/sem), A0 en MBq", formula: "B = 1090 * d^2 / (T*Nw*A0[MBq]*tU*RtU)", notas: "Forma numerica de Eq.4 con P=100 sustituido." },
  { numero: "Eq. 8", nombreEs: "Transmision, area controlada ALARA, A0 en mCi", formula: "B = 29.5 * d^2 / (T*Nw*A0[mCi]*tU*RtU)" },
  { numero: "Eq. 9", nombreEs: "Dosis semanal en sala de imagen", formula: "D_semana = 0.092*Nw*A0*0.85*FU*tI*RtI/d^2", funcionEnEsteMotor: "calcularDosisSemanalSalaImagen()" },
  { numero: "Eq. 10", nombreEs: "Transmision requerida, forma general (imagen)", formula: "B = 10.9*P[uSv]*d^2/(T*Nw*A0*0.85*FU*tI*RtI)", funcionEnEsteMotor: "calcularTransmisionRequeridaSalaImagen()" },
  { numero: "Eq. 11", nombreEs: "Transmision, sala de imagen, area no controlada", formula: "B = 256*d^2/(T*Nw*A0*FU*tI*RtI)", notas: "Forma numerica de Eq.10 con P=20 sustituido." },
  { numero: "Eq. 12", nombreEs: "Transmision, sala de imagen, area controlada ALARA", formula: "B = 1280*d^2/(T*Nw*A0*FU*tI*RtI)", notas: "Forma numerica de Eq.10 con P=100 sustituido." },
];

// ---- 11.7 Ejemplos documentales adicionales (Examples 3, 6 y 7) ----
// No implementados como funciones (Ejemplo 3 requiere layout completo de
// una instalacion; Ejemplo 6 despeja distancia en vez de B; Ejemplo 7 usa
// una metodologia de tasa de conteo/camara gamma, fuera del alcance de las
// funciones de dosis/transmision de este motor). Se conservan como
// referencia documental. Los ejemplos 1, 2, 4 y 5 SI estan implementados
// como casos de regresion (Seccion 9, ejecutarCasosDeRegresion()).
export const FUENTE_EJEMPLOS_ADICIONALES = citaTG108("11-15", "Ejemplos 3, 6 y 7", "ALTA");

export const EJEMPLOS_DOCUMENTALES_ADICIONALES_TG108 = [
  {
    codigo: "EJEMPLO_3_LAYOUT_COMPLETO",
    descripcionEs: "Diseno completo de una instalacion PET (Fig. 4): 40 pacientes/semana, 555 MBq de F-18 FDG, tU=1 h, tI=30 min. Ver TABLA_VII_LAYOUT_EJEMPLO_3 y TABLA_VIII_BLINDAJE_EJEMPLO_3 para los valores completos por punto de interes.",
  },
  {
    codigo: "EJEMPLO_6_DISTANCIA_CONSOLA",
    descripcionEs: "Distancia minima entre la consola de control y el paciente para dosis de operador < 5 mSv/ano (ALARA, P=100 uSv/semana). 40 pacientes/semana, 555 MBq, tU=60 min, tI=30 min.",
    resultado: "d = 2.32 m.",
  },
  {
    codigo: "EJEMPLO_7_CAMARA_GAMMA_ADYACENTE",
    descripcionEs: "Blindaje requerido en sala adyacente con camara gamma (Tc-99m) para reducir tasa de fondo por radiacion de aniquilacion de 511 keV de 592000 CPM a 1000 CPM.",
    resultado: "B = 1000/592000 = 0.0017. Usando la Fig. 1 (transmision de plomo): 3.9 cm de plomo requeridos.",
  },
];

// ---- 11.8 Tabla VII / VIII - layout completo del Ejemplo 3 (Fig. 4) ----
export const FUENTE_TABLA_VII_VIII = citaTG108(
  "11-12",
  "Tablas VII y VIII",
  "ALTA",
  "Calculo basado en 40 pacientes/semana, 555 MBq por administracion, 1 h de captacion, 30 min de imagen."
);

export interface PuntoInteresEjemplo3 {
  sala: string;
  distanciaCaptacionM: number;
  distanciaTomografoM: number;
  dosisObjetivoSemanalUSv: number;
  factorOcupacion: number;
  dosisSemanalCaptacionUSv: number;
  dosisSemanalTomografoUSv: number;
  dosisSemanalTotalUSv: number;
  factorTransmisionRequerido: number | null;
  notas?: string;
}

export const TABLA_VII_LAYOUT_EJEMPLO_3: PuntoInteresEjemplo3[] = [
  { sala: "Oficina 1", distanciaCaptacionM: 8, distanciaTomografoM: 3, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 27.1, dosisSemanalTomografoUSv: 70.1, dosisSemanalTotalUSv: 97.2, factorTransmisionRequerido: 0.206 },
  { sala: "Oficina 2", distanciaCaptacionM: 6, distanciaTomografoM: 3, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 48.7, dosisSemanalTomografoUSv: 70.1, dosisSemanalTotalUSv: 118.8, factorTransmisionRequerido: 0.169 },
  { sala: "Oficina 3", distanciaCaptacionM: 8, distanciaTomografoM: 7, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 27.1, dosisSemanalTomografoUSv: 12.9, dosisSemanalTotalUSv: 40, factorTransmisionRequerido: 0.500 },
  { sala: "Oficina 4", distanciaCaptacionM: 8.5, distanciaTomografoM: 9, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 24, dosisSemanalTomografoUSv: 7.8, dosisSemanalTotalUSv: 31.8, factorTransmisionRequerido: 0.629 },
  { sala: "Oficina 5", distanciaCaptacionM: 8.5, distanciaTomografoM: 11, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 24, dosisSemanalTomografoUSv: 5.2, dosisSemanalTotalUSv: 29.2, factorTransmisionRequerido: 0.685 },
  { sala: "Oficina 6", distanciaCaptacionM: 9.5, distanciaTomografoM: 13, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 19.2, dosisSemanalTomografoUSv: 3.7, dosisSemanalTotalUSv: 22.9, factorTransmisionRequerido: 0.872 },
  { sala: "Oficina 7", distanciaCaptacionM: 12, distanciaTomografoM: 15, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 12, dosisSemanalTomografoUSv: 2.8, dosisSemanalTotalUSv: 14.8, factorTransmisionRequerido: null, notas: "No se requiere blindaje adicional (dosis total ya por debajo del objetivo sin barrera)." },
  { sala: "Oficina 8", distanciaCaptacionM: 7, distanciaTomografoM: 8, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 35.4, dosisSemanalTomografoUSv: 9.9, dosisSemanalTotalUSv: 45.3, factorTransmisionRequerido: 0.442 },
  { sala: "Oficina 9", distanciaCaptacionM: 9, distanciaTomografoM: 9, dosisObjetivoSemanalUSv: 20, factorOcupacion: 1, dosisSemanalCaptacionUSv: 21.4, dosisSemanalTomografoUSv: 7.8, dosisSemanalTotalUSv: 29.2, factorTransmisionRequerido: 0.685 },
  { sala: "Pasillo 1", distanciaCaptacionM: 2.5, distanciaTomografoM: 2.5, dosisObjetivoSemanalUSv: 100, factorOcupacion: 0.25, dosisSemanalCaptacionUSv: 277.8, dosisSemanalTomografoUSv: 101, dosisSemanalTotalUSv: 378.8, factorTransmisionRequerido: null, notas: "Factor de ocupacion incluido en el calculo de transmision; no modifica la dosis semanal total mostrada." },
  { sala: "Pasillo 2", distanciaCaptacionM: 9, distanciaTomografoM: 4, dosisObjetivoSemanalUSv: 20, factorOcupacion: 0.25, dosisSemanalCaptacionUSv: 21.6, dosisSemanalTomografoUSv: 39.6, dosisSemanalTotalUSv: 60.2, factorTransmisionRequerido: null },
  { sala: "Sala de control PET", distanciaCaptacionM: 9, distanciaTomografoM: 2.5, dosisObjetivoSemanalUSv: 100, factorOcupacion: 1, dosisSemanalCaptacionUSv: 21.4, dosisSemanalTomografoUSv: 101, dosisSemanalTotalUSv: 122.4, factorTransmisionRequerido: 0.817 },
  { sala: "Camara gamma", distanciaCaptacionM: 3, distanciaTomografoM: 10, dosisObjetivoSemanalUSv: 100, factorOcupacion: 1, dosisSemanalCaptacionUSv: 192.7, dosisSemanalTomografoUSv: 6.3, dosisSemanalTotalUSv: 199, factorTransmisionRequerido: 0.503 },
];

export interface BlindajeParedEjemplo3 {
  pared: "N" | "E" | "S" | "O";
  espesorPlomoSalaCaptacionMm: number;
  espesorPlomoSalaTomografoMm: number;
}

export const TABLA_VIII_BLINDAJE_EJEMPLO_3: BlindajeParedEjemplo3[] = [
  { pared: "N", espesorPlomoSalaCaptacionMm: 0, espesorPlomoSalaTomografoMm: 0 },
  { pared: "E", espesorPlomoSalaCaptacionMm: 5, espesorPlomoSalaTomografoMm: 3 },
  { pared: "S", espesorPlomoSalaCaptacionMm: 5, espesorPlomoSalaTomografoMm: 0 },
  { pared: "O", espesorPlomoSalaCaptacionMm: 2, espesorPlomoSalaTomografoMm: 12.1 },
];

// ---- 11.9 Consideraciones de diseno adicionales (texto narrativo) ----
export const CONSIDERACIONES_DISENO_TG108 = {
  fuente: citaTG108("12-14", "Design considerations / PET-CT installations", "ALTA"),
  puntos: [
    "Para una instalacion PET tipica (555 MBq administrados, 60 min de captacion, 40 pacientes/semana), la distancia requerida para mantener la dosis semanal por debajo de 20 uSv sin blindaje adicional es de 9.3 m.",
    "Losas de piso de 10 cm de hormigon (espesor tipico) proporcionan un factor de reduccion de dosis de 2.5 para radiacion de aniquilacion de 511 keV.",
    "Para instalaciones PET/CT, el componente CT se disena con los mismos criterios que cualquier instalacion de TC diagnostico; el blindaje de plomo tipico de una sala de TC (ej. 1.6 mm Pb) es insuficiente por si solo para los fotones de 511 keV (factor de transmision de solo 0.81), pero una sala ya blindada para el criterio PET de 1 mSv/ano al publico normalmente NO requiere blindaje adicional por el componente CT salvo en areas controladas a mas de 3 m de la fuente, donde el CT puede pasar a ser el factor limitante.",
    "El tomografo PET puede requerir un nivel de radiacion ambiental menor a 0.1 mR/h para operar correctamente (especificacion de un fabricante), lo cual puede requerir consideracion de blindaje adicional entre salas adyacentes con fuentes radiactivas.",
    "Camaras de centelleo (gamma) adyacentes a salas PET pueden sufrir incremento significativo de la tasa de fondo por fotones de 511 keV si el detector queda orientado directamente hacia el paciente PET; se recomienda no ubicar camaras SPECT junto a salas de captacion o imagen PET salvo que el detector pueda orientarse de forma que nunca apunte hacia la fuente durante la adquisicion.",
  ],
};
