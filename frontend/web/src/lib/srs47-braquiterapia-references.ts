/**
 * REFERENCIAS NORMATIVAS - IAEA Safety Reports Series No. 47
 * "Radiation Protection in the Design of Radiotherapy Facilities"
 * International Atomic Energy Agency (IAEA), Vienna, 2006.
 * STI/PUB/1223, ISBN 92-0-100505-9.
 *
 * ALCANCE DE ESTE ARCHIVO: Seccion 8 "Worked Example of a Brachytherapy
 * Facility" (pag. 99-109) - metodologia de calculo de blindaje y tablas de
 * datos ESPECIFICAS PARA BRAQUITERAPIA (LDR/MDR/HDR). NO incluye las
 * ecuaciones de barreras primarias/secundarias/laberintos para ACELERADORES
 * de la Seccion 5 del mismo documento (ya cubiertas, con metodologia
 * equivalente, por ncrp151-acelerador-barreras-references.ts).
 *
 * ============================================================================
 * FUENTE Y METODO DE VERIFICACION (anti-fabricacion, S61 del Prompt Maestro)
 * ============================================================================
 * Documento releido directamente desde la carpeta Drive del proyecto:
 * "SRS 47.txt" (enlace corregido por el usuario tras descubrirse 6 archivos
 * duplicados mal etiquetados que en realidad contenian OTRA publicacion del
 * OIEA, "Setting Up a Radiotherapy Programme", STI/PUB/1296). Se verifico
 * que el archivo aqui usado es el genuino IAEA Safety Reports Series No. 47
 * (titulo, ISBN y estructura de indice coinciden).
 *
 * ADVERTENCIA SOBRE ARTEFACTO DE OCR (mSv vs uSv):
 * El texto corrido (prosa) del documento presenta sustitucion sistematica
 * u -> m en varias instancias (ej. seccion 2.4 y seccion 8.1 dicen
 * literalmente "7,5 mSv/h" y "2,5 mSv/h"). Esto se identifico como un
 * artefacto de OCR, NO como el valor real, mediante triangulacion interna
 * con tres anclas numericas del mismo documento que si preservan el
 * simbolo correcto dentro de tablas (no en prosa):
 *   (1) Tabla 2 (pag. 43): limite de diseno UK para ocupacion, IDR = 7,5
 *       uSv/h [6] (formato tabla, simbolo correcto).
 *   (2) Tabla 19 (pag. 107): encabezados de columna explicitos "uSv/h"
 *       para los mismos valores 7,5 y 2,5 usados en la Seccion 8.1.
 *   (3) Verificacion cruzada aritmetica interna en el ejemplo de calculo
 *       HDR Co-60 (Seccion 8.5): usando el valor de RAKR de la Tabla 20
 *       para Co-60 (0,308) y la fuerza de kerma en aire declarada por el
 *       documento para el ejemplo (5,70 kU = 5,70 mGy*m^2*h^-1 via AAPM
 *       Informe 21), se verifica: 0,308 * 18500 MBq = 5698. Este resultado
 *       SOLO coincide con "5,70" si la unidad real de la Tabla 20 es
 *       uGy*MBq^-1*m^2*h^-1 (5698 uGy*m^2*h^-1 = 5,698 mGy*m^2*h^-1 ~ 5,70,
 *       coincide), no mGy*MBq^-1*m^2*h^-1 como aparece impreso literalmente
 *       en el encabezado de la Tabla 20 (5698 mGy*m^2*h^-1 = 5,698 Gy*m^2*h^-1,
 *       NO coincide con "5,70 mGy*m^2*h^-1"). Esta verificacion confirma que
 *       el patron de sustitucion OCR u->m afecta tanto a la prosa como a
 *       encabezados de columna sueltos (pero NO a las tablas formateadas en
 *       cuadricula, que preservan el simbolo correcto).
 * CONCLUSION: los valores de diseno de blindaje de braquiterapia citados
 * abajo (7,5 y 2,5) se registran en microsievert por hora (uSv/h), no en
 * milisievert por hora, consistente con la Tabla 2, la Tabla 19 y con la
 * cita independiente de la Clase 7 (curso DeLeC Cientifica), que ya usaba
 * uSv/h para estos mismos valores. Metodologia analoga a
 * validarModeloArcher() en blindaje-calc-engine.ts: cross-validacion
 * aritmetica interna de la propia fuente primaria, no un valor inventado.
 * Nivel de confianza: ALTA para los valores numericos de las Tablas 19-21;
 * MEDIA para el pareo exacto de columnas de los valores "primer HVL/TVL"
 * en nota al pie de la Tabla 22 (estructura de tabla perdida en OCR,
 * marcado PENDIENTE_DE_VERIFICACION mas abajo, ver notas de cada entrada).
 *
 * Clasificacion: Nivel 2 (organismo internacional de referencia - OIEA).
 */

import type { FuenteCita, NivelConfianza } from "./blindaje-calc-engine";
import { calcularNumeroTVL } from "./ncrp151-acelerador-barreras-references";

const BASE_FUENTE_SRS47 = {
    documento:
          "IAEA Safety Reports Series No. 47: Radiation Protection in the Design of Radiotherapy Facilities",
    autores: "International Atomic Energy Agency (IAEA)",
    publicacion: "IAEA, Vienna, 2006 (STI/PUB/1223, ISBN 92-0-100505-9)",
    anio: 2006,
    nivelJerarquia: "Nivel 2" as const,
};

function citaSRS47(paginaAprox: string, tablaOSeccion: string, nivelConfianza: NivelConfianza = "ALTA", notas?: string): FuenteCita {
    return { ...BASE_FUENTE_SRS47, paginaAprox, tablaOEcuacion: tablaOSeccion, nivelConfianza, notas };
}

// ============================================================================
// CRITERIOS DE DISENO PARA SALAS DE BRAQUITERAPIA (Seccion 8.1, pag. 99-101)
// ============================================================================

export const FUENTE_CRITERIOS_DISENO_BRAQUITERAPIA = citaSRS47(
    "99-101",
    "Seccion 8.1",
    "ALTA",
    "Valores corregidos de artefacto OCR u->m, ver cabecera del archivo. Documento original: 'La tasa de dosis dentro de la sala sera mas de 7,5 [uSv/h corregido] y la sala sera designada area controlada [6]. La tasa de dosis fuera de la sala de braquiterapia debe reducirse a 2,5 [uSv/h corregido].'"
  );

export interface CriterioDisenoBraquiterapia {
    codigo: string;
    descripcionEs: string;
    valorUSvH: number;
}

export const CRITERIOS_DISENO_BRAQUITERAPIA: CriterioDisenoBraquiterapia[] = [
  { codigo: "IDR_AREA_CONTROLADA", descripcionEs: "Tasa de dosis instantanea (IDR) dentro/limite de area controlada", valorUSvH: 7.5 },
  { codigo: "IDR_AREA_NO_CONTROLADA", descripcionEs: "Tasa de dosis instantanea (IDR) fuera de la sala / area no controlada (publico)", valorUSvH: 2.5 },
  ];

// ============================================================================
// ECUACIONES DE CALCULO PARA BRAQUITERAPIA (Seccion 8.4, pag. 102-103)
// ============================================================================

export const FUENTE_ECUACIONES_BRAQUITERAPIA = citaSRS47("102-103", "Seccion 8.4, Ecuaciones 33-38", "ALTA");

export interface EcuacionBraquiterapia {
    numero: string;
    nombreEs: string;
    formula: string;
    notas?: string;
}

export const ECUACIONES_BRAQUITERAPIA: EcuacionBraquiterapia[] = [
  { numero: "Eq. 33", nombreEs: "Carga de trabajo (workload) via RAKR", formula: "W = RAKR x A x t x n", notas: "A = actividad total de las fuentes; t = tiempo de tratamiento; n = numero de tratamientos; RAKR = tasa de kerma en aire de referencia (Tabla 20)." },
  { numero: "Eq. 34", nombreEs: "Carga de trabajo (workload) via fuerza de kerma en aire", formula: "W = Sk x t x n", notas: "Sk = fuerza de kerma en aire (formalismo AAPM Informe 21 / Task Group 32), en unidades U = uGy*m^2*h^-1." },
  { numero: "Eq. 35", nombreEs: "Tasa de dosis sin blindaje via RAKR", formula: "D0 = RAKR x A" },
  { numero: "Eq. 36", nombreEs: "Tasa de dosis sin blindaje via fuerza de kerma", formula: "D0 = Sk" },
  { numero: "Eq. 37", nombreEs: "Factor de transmision de barrera (ecuacion de barrera modificada) via RAKR", formula: "B = P*d^2 / (RAKR x A x t x n x T)", notas: "P = objetivo de dosis de diseno; d = distancia fuente-punto; T = factor de ocupacion. El factor de uso U se toma siempre = 1 en braquiterapia (fuentes no colimadas, emiten en todas direcciones)." },
  { numero: "Eq. 38", nombreEs: "Factor de transmision de barrera (ecuacion de barrera modificada) via fuerza de kerma", formula: "B = P*d^2 / (Sk x t x n x T)" },
  ];

// ============================================================================
// TABLA 19 (pag. 107) - ESPESORES TIPICOS DE BARRERA DE HORMIGON A 3 m
// ============================================================================

export const FUENTE_TABLA_19 = citaSRS47("107", "Tabla 19", "ALTA", "Referencia interna del documento: [3] = IPEM Report 75.");

export interface EspesorTipicoBraquiterapia {
    tipoTratamiento: string;
    nucleido: string;
    actividadGBq: number;
    espesorHormigonMm_7_5uSvH: number;
    espesorHormigonMm_2_5uSvH: number;
}

export const ESPESORES_TIPICOS_TABLA19: EspesorTipicoBraquiterapia[] = [
  { tipoTratamiento: "MDR", nucleido: "Cs-137", actividadGBq: 22.2, espesorHormigonMm_7_5uSvH: 280, espesorHormigonMm_2_5uSvH: 360 },
  { tipoTratamiento: "HDR", nucleido: "Co-60", actividadGBq: 185, espesorHormigonMm_7_5uSvH: 680, espesorHormigonMm_2_5uSvH: 770 },
  { tipoTratamiento: "LDR", nucleido: "Ir-192", actividadGBq: 37, espesorHormigonMm_7_5uSvH: 310, espesorHormigonMm_2_5uSvH: 360 },
  { tipoTratamiento: "HDR", nucleido: "Ir-192", actividadGBq: 370, espesorHormigonMm_7_5uSvH: 440, espesorHormigonMm_2_5uSvH: 510 },
  ];

// ============================================================================
// TABLA 20 (pag. 108) - DATOS FISICOS DE NUCLEIDOS USADOS EN BRAQUITERAPIA
// ============================================================================

export const FUENTE_TABLA_20 = citaSRS47(
    "108",
    "Tabla 20",
    "ALTA",
    "ADVERTENCIA DE UNIDAD: el encabezado de columna impreso en el documento dice 'mGy*MBq^-1*m^2*h^-1', pero la verificacion cruzada interna con el ejemplo de calculo de la Seccion 8.5 (ver cabecera del archivo) demuestra que la unidad real es uGy*MBq^-1*m^2*h^-1 (artefacto OCR u->m, igual que en los criterios de diseno). Confirmado ademas por coincidencia exacta con la cita independiente de Clase 7 (curso DeLeC Cientifica), que ya usaba uGy*MBq^-1*m^2*h^-1 para estos mismos valores."
  );

export interface NucleidoBraquiterapia {
    nucleido: string;
    vidaMedia: string;
    energiaFotonMediaMeV: number;
    rakrUGyMBqM2H: number; // corregido, ver FUENTE_TABLA_20
}

export const NUCLEIDOS_TABLA20: NucleidoBraquiterapia[] = [
  { nucleido: "Co-60", vidaMedia: "5,27 a", energiaFotonMediaMeV: 1.25, rakrUGyMBqM2H: 0.308 },
  { nucleido: "I-125", vidaMedia: "60,1 d", energiaFotonMediaMeV: 0.028, rakrUGyMBqM2H: 0.034 },
  { nucleido: "Cs-137", vidaMedia: "30,0 a", energiaFotonMediaMeV: 0.662, rakrUGyMBqM2H: 0.077 },
  { nucleido: "Ir-192", vidaMedia: "74,0 d", energiaFotonMediaMeV: 0.37, rakrUGyMBqM2H: 0.111 },
  { nucleido: "Au-198", vidaMedia: "64,7 h", energiaFotonMediaMeV: 0.42, rakrUGyMBqM2H: 0.056 },
  { nucleido: "Ra-226", vidaMedia: "1600 a", energiaFotonMediaMeV: 0.78, rakrUGyMBqM2H: 0.195 },
  ];

// ============================================================================
// TABLA 21 (pag. 108) - RAZON TEJIDO-AIRE (F2) PARA 10 cm DE AGUA
// ============================================================================

export const FUENTE_TABLA_21 = citaSRS47("108", "Tabla 21", "ALTA", "Referencia interna del documento: [45] = Meisberger/Keller/Shalek 1968.");

export interface RazonTejidoAireBraquiterapia {
    nucleido: string;
    f2_10cmAgua: number;
}

export const RAZON_TEJIDO_AIRE_TABLA21: RazonTejidoAireBraquiterapia[] = [
  { nucleido: "Co-60", f2_10cmAgua: 0.81 },
  { nucleido: "Cs-137", f2_10cmAgua: 0.86 },
  { nucleido: "Ir-192", f2_10cmAgua: 0.93 },
  { nucleido: "Au-198", f2_10cmAgua: 0.90 },
  { nucleido: "Ra-226", f2_10cmAgua: 0.86 },
  ];

// ============================================================================
// TABLA 22 (pag. 109) - HVL Y TVL POR ATENUACION GRANDE PARA NUCLEIDOS DE
// BRAQUITERAPIA (Apendice D, Figs. 11-13)
// ============================================================================

export const FUENTE_TABLA_22 = citaSRS47(
    "109",
    "Tabla 22",
    "ALTA",
    "Referencia interna del documento: [2] (Apendice D, Figs. 11-13). Los valores 'primer HVL/TVL' (nota al pie, distintos del HVL/TVL de atenuacion grande) no se pudieron parear con confianza a su columna exacta debido a perdida de estructura de tabla en la extraccion OCR; ver PENDIENTE_DE_VERIFICACION en HVL_TVL_TABLA22_PRIMER_VALOR_PENDIENTE mas abajo."
  );

export interface HVLTVLBraquiterapia {
    nucleido: string;
    plomoHvlMm: number | null;
    plomoTvlMm: number | null;
    aceroHvlMm: number | null;
    aceroTvlMm: number | null;
    hormigonHvlMm: number | null;
    hormigonTvlMm: number | null;
    notas?: string;
}

export const HVL_TVL_TABLA22: HVLTVLBraquiterapia[] = [
  { nucleido: "Co-60", plomoHvlMm: 12, plomoTvlMm: 41, aceroHvlMm: 21, aceroTvlMm: 71, hormigonHvlMm: 62, hormigonTvlMm: 218 },
  { nucleido: "I-125", plomoHvlMm: 0.03, plomoTvlMm: 0.1, aceroHvlMm: null, aceroTvlMm: null, hormigonHvlMm: null, hormigonTvlMm: null },
  { nucleido: "Cs-137", plomoHvlMm: 6.5, plomoTvlMm: 22, aceroHvlMm: 16, aceroTvlMm: 53, hormigonHvlMm: 48, hormigonTvlMm: 175 },
  { nucleido: "Ir-192", plomoHvlMm: 6, plomoTvlMm: 16, aceroHvlMm: 13, aceroTvlMm: 43, hormigonHvlMm: 43, hormigonTvlMm: 152 },
  { nucleido: "Au-198", plomoHvlMm: 3.3, plomoTvlMm: 11, aceroHvlMm: null, aceroTvlMm: null, hormigonHvlMm: 41, hormigonTvlMm: 142, notas: "Nota al pie 'b' en el documento original junto al valor de TVL de plomo (11), significado no confirmado - PENDIENTE_DE_VERIFICACION." },
  { nucleido: "Ra-226", plomoHvlMm: 16.6, plomoTvlMm: 45, aceroHvlMm: 22, aceroTvlMm: 76, hormigonHvlMm: 69, hormigonTvlMm: 240 },
  ];

// PENDIENTE_DE_VERIFICACION: valores de "primer HVL/TVL" (nota al pie de la
// Tabla 22) distintos del HVL/TVL de atenuacion grande de arriba. Texto OCR
// disponible pero sin pareo columna-valor confiable (estructura de cuadricula
// perdida en la extraccion). No se fabrica el pareo exacto; se deja pendiente
// hasta poder revisar el PDF original pagina por pagina.
export const HVL_TVL_TABLA22_PRIMER_VALOR_PENDIENTE = {
    estado: "PENDIENTE_DE_VERIFICACION" as const,
    motivo: "Estructura de tabla (nota al pie 'primer HVL/TVL') perdida en extraccion OCR del documento; no se puede parear con confianza cada numero a su columna de material sin arriesgar fabricacion de dato.",
    fuente: citaSRS47("109", "Tabla 22 (nota al pie)", "MEDIA"),
};

// ============================================================================
// TABLA 23 (pag. 109) - HVL Y TVL PARA DISPERSION A 90 GRADOS
// ============================================================================

export const FUENTE_TABLA_23 = citaSRS47("109", "Tabla 23", "ALTA", "Referencia interna del documento: [47] = NBS Handbook 73.");

export interface HVLTVLDispersion90 {
    nucleido: string;
    material: "plomo" | "hormigon";
    hvlMm: number;
    tvl1Mm: number;
    tvl2Mm: number | null;
    tvl3Mm: number | null;
}

export const HVL_TVL_DISPERSION90_TABLA23: HVLTVLDispersion90[] = [
  { nucleido: "Co-60", material: "plomo", hvlMm: 1.3, tvl1Mm: 6.5, tvl2Mm: 11.1, tvl3Mm: null },
  { nucleido: "Co-60", material: "hormigon", hvlMm: 44, tvl1Mm: 142, tvl2Mm: 141, tvl3Mm: 122 },
  { nucleido: "Cs-137", material: "plomo", hvlMm: 0.6, tvl1Mm: 3.2, tvl2Mm: 5.5, tvl3Mm: 7.0 },
  { nucleido: "Cs-137", material: "hormigon", hvlMm: 37, tvl1Mm: 84, tvl2Mm: 122, tvl3Mm: 123 },
  ];

// ============================================================================
// COEFICIENTES DE ALBEDO/REFLEXION PARA LABERINTOS DE BRAQUITERAPIA
// (citados en el ejemplo de calculo, Seccion 8.5, pag. 104-106)
// ============================================================================

export const FUENTE_ALBEDO_BRAQUITERAPIA = citaSRS47(
    "104-106",
    "Seccion 8.5 (Tablas internas 6 y 7 del propio SRS-47)",
    "ALTA",
    "Coeficientes de reflexion/albedo usados en el ejemplo de laberinto/puerta del ejemplo HDR Co-60. Cita distinta (aunque numericamente relacionada) de las Tablas 6/7 de NCRP151 ya usadas en ncrp151-acelerador-barreras-references.ts."
  );

export interface AlbedoBraquiterapia {
    anguloIncidenciaGrados: number;
    anguloReflexionGrados: number;
    coeficienteAlbedo: number;
}

export const ALBEDO_BRAQUITERAPIA: AlbedoBraquiterapia[] = [
  { anguloIncidenciaGrados: 45, anguloReflexionGrados: 0, coeficienteAlbedo: 1.02e-2 },
  { anguloIncidenciaGrados: 0, anguloReflexionGrados: 75, coeficienteAlbedo: 4.06e-3 },
  ];

// ============================================================================
// EJEMPLOS DE CALCULO COMPLETOS (Seccion 8.5, pag. 104-106) - referencia
// documental, no re-implementados aqui como funciones de calculo (eso
// corresponde a blindaje-calc-engine.ts en una fase posterior).
// ============================================================================

export const FUENTE_EJEMPLOS_CALCULO_8_5 = citaSRS47("104-106", "Seccion 8.5", "ALTA");

export interface EjemploCalculoBraquiterapia {
    codigo: string;
    descripcionEs: string;
    espesorHormigonResultanteMm?: number;
    notas?: string;
}

export const EJEMPLOS_CALCULO_8_5: EjemploCalculoBraquiterapia[] = [
  {
        codigo: "HDR_CO60_20_FUENTES",
        descripcionEs: "Sala HDR con 20 fuentes de Co-60 de 18,5 GBq cada una. Fuerza de kerma en aire por fuente (AAPM Informe 21): 5,70 kU. Calculo de barrera primaria.",
        espesorHormigonResultanteMm: 676,
        notas: "El documento reporta espesores de barrera de 554 mm y 676 mm segun el criterio de diseno aplicado (7,5 o 2,5 uSv/h). Valor numericamente consistente con el de la Tabla 19 (680 mm) para una configuracion comparable de 185 GBq de Co-60 al criterio de 7,5 uSv/h.",
  },
  {
        codigo: "HDR_IR192_1_FUENTE",
        descripcionEs: "Sala HDR con una unica fuente de Ir-192 de 370 GBq. Comparacion de espesor de barrera con el ejemplo de Co-60.",
        espesorHormigonResultanteMm: 218,
        notas: "El documento compara 152 mm (Ir-192) vs 218 mm (TVL equivalente citado para Co-60), concluyendo que el blindaje existente de una sala de Co-60 es mas que adecuado para una futura unidad de Ir-192.",
  },
  ];

// ============================================================================
// REFERENCIAS BIBLIOGRAFICAS INTERNAS DEL SRS-47 CITADAS EN ESTE ARCHIVO
// ============================================================================

export const REFERENCIAS_INTERNAS_SRS47 = [
  { numero: "[3]", cita: "IPEM Report 75" },
  { numero: "[6]", cita: "Fuente de los limites de diseno UK (IDR 7,5 uSv/h), citada en Tabla 2 y Seccion 8.1 del SRS-47" },
  { numero: "[44]", cita: "AAPM Report 21 (Task Group 32), Specification of Brachytherapy Source Strength" },
  { numero: "[45]", cita: "Meisberger, Keller, Shalek (1968) - fuente de la razon tejido-aire" },
  { numero: "[46]", cita: "Aird, Williams, Rembowska - capitulo de Braquiterapia" },
  { numero: "[47]", cita: "NBS Handbook 73" },
  ];

// ============================================================================
// FUNCIONES EJECUTABLES DE CALCULO (Seccion 8.4, Ecuaciones 33-38) - agregado
// 17/09/2026 al continuar la Fase 5 del Prompt Maestro. Hasta esta fecha este
// archivo solo contenia tablas de referencia (ver comentario historico mas
// arriba: "no re-implementados aqui como funciones de calculo"). Estas
// funciones se transcriben directamente de las Ecuaciones 33-38 (Seccion 8.4,
// pag. 102-103) y se validan mas abajo contra el ejemplo numerico completo de
// la Seccion 8.5 (pag. 104-106, sala HDR de Co-60), reproducido con sus
// valores de entrada reales (no inventados) leidos directamente del
// documento "SRS 47.txt" de la carpeta Drive del proyecto.
//
// NOTA DE UNIDADES (S24, no ocultar supuestos): el documento fuente mezcla,
// dentro de una misma formula, valores etiquetados "mSv" (limite de diseno P)
// con valores etiquetados "mGy" (carga de trabajo W, tasa de kerma D0), pero
// segun la advertencia de calidad de fuente al inicio de este archivo, el
// artefacto OCR u->m probablemente afecta a ambos por igual, por lo que la
// UNIDAD REAL mas probable es uSv/uGy en vez de mSv/mGy. Esto NO afecta el
// resultado numerico de B (es un cociente entre magnitudes con el mismo
// factor de escala), por lo que las funciones de abajo se implementan tal
// como aparecen las formulas en el texto, sin fijar una unidad especifica en
// el nombre del parametro salvo la que aparece impresa; el llamador debe
// mantener consistencia de unidades entre P y W/D0.
// ============================================================================

/**
 * Ecuacion 33: carga de trabajo (workload) via tasa de kerma en aire de
 * referencia (RAKR).
 * W = RAKR x A x t x n
 * @param rakr Tasa de kerma en aire de referencia de la fuente (Tabla 20)
 * @param actividadTotalMBq Actividad total de las fuentes (MBq)
 * @param tiempoTratamientoH Duracion promedio del tratamiento (h)
 * @param tratamientosPorSemana Numero de tratamientos por semana
 */
export function calcularCargaTrabajoBraquiterapiaViaRAKR(
  rakr: number,
  actividadTotalMBq: number,
  tiempoTratamientoH: number,
  tratamientosPorSemana: number
): number {
  return rakr * actividadTotalMBq * tiempoTratamientoH * tratamientosPorSemana;
}

/**
 * Ecuacion 34: carga de trabajo (workload) via fuerza de kerma en aire
 * (formalismo AAPM Informe 21 / Task Group 32).
 * W = Sk x t x n
 * @param skUGyM2H Fuerza de kerma en aire de la fuente, en U (uGy*m^2*h^-1)
 */
export function calcularCargaTrabajoBraquiterapiaViaKerma(
  skUGyM2H: number,
  tiempoTratamientoH: number,
  tratamientosPorSemana: number
): number {
  return skUGyM2H * tiempoTratamientoH * tratamientosPorSemana;
}

/**
 * Ecuacion 35: tasa de dosis sin blindaje (a 1 m) via RAKR.
 * D0 = RAKR x A
 * @param actividadMBq Actividad de la(s) fuente(s) expuesta(s) simultaneamente (MBq)
 */
export function calcularTasaDosisSinBlindajeBraquiterapiaViaRAKR(rakr: number, actividadMBq: number): number {
  return rakr * actividadMBq;
}

/**
 * Ecuacion 36: tasa de dosis sin blindaje via fuerza de kerma en aire.
 * D0 = Sk (identidad, incluida por trazabilidad explicita con la fuente, S24)
 */
export function calcularTasaDosisSinBlindajeBraquiterapiaViaKerma(skUGyM2H: number): number {
  return skUGyM2H;
}

/**
 * Ecuaciones 37/38: factor de transmision de barrera requerido, evaluacion
 * SEMANAL/promediada (usa la carga de trabajo W ya calculada por Eq. 33 o 34,
 * y el factor de ocupacion T). El factor de uso U del enfoque de aceleradores
 * NO aparece aqui: el texto fuente establece explicitamente que en
 * braquiterapia U = 1 siempre, porque las fuentes no estan colimadas y
 * emiten en todas direcciones (Seccion 8.4).
 * B = P * d^2 / (W * T)
 * @param pDosisSemana Objetivo de diseno de blindaje P (por semana)
 * @param dM Distancia desde la fuente expuesta hasta el punto protegido (m)
 * @param wSemana Carga de trabajo W (Eq. 33 o 34), por semana
 * @param t Factor de ocupacion (fraccion 0-1)
 */
export function calcularFactorTransmisionBarreraBraquiterapiaSemanal(
  pDosisSemana: number,
  dM: number,
  wSemana: number,
  t: number
): number {
  return (pDosisSemana * dM * dM) / (wSemana * t);
}

/**
 * Variante para verificacion de tasa de dosis instantanea (IDR) con el
 * numero maximo de fuentes expuestas simultaneamente. Analoga a la Ecuacion
 * 7 del enfoque de aceleradores (NCRP151): usa D0 (Eq. 35/36) directamente en
 * el denominador, SIN el factor de ocupacion T, porque el IDR representa el
 * caso de una persona presente en ese instante exacto (ver ejemplo numerico
 * de la Seccion 8.5, que omite T al verificar el IDR de 7,5 [uSv corregido]
 * por hora con las 20 fuentes expuestas).
 * B_IDR = P_IDR * d^2 / D0
 */
export function calcularFactorTransmisionInstantaneaBraquiterapia(
  pInstantanea: number,
  dM: number,
  d0: number
): number {
  return (pInstantanea * dM * dM) / d0;
}

/**
 * Espesor de barrera a partir del numero de TVL (Eq. 6/Ec. 2.2, generica),
 * usando el valor UNICO de TVL "por atenuacion grande" de la Tabla 22.
 * A DIFERENCIA del enfoque de aceleradores (NCRP151, TVL1 + (n-1)*TVLe), el
 * SRS-47 no tabula un TVL de primera capa distinto para braquiterapia en su
 * Tabla 22 principal (solo existe la nota al pie de "primer HVL/TVL", no
 * pareada con confianza - ver HVL_TVL_TABLA22_PRIMER_VALOR_PENDIENTE mas
 * arriba). Por lo tanto esta funcion NO aplica una capa de endurecimiento de
 * haz distinta; usa el mismo TVL para todas las capas, tal como lo hace el
 * propio ejemplo numerico de la Seccion 8.5 (554 = 2.54 x 218; 676 = 3.1 x
 * 218, ambos con el mismo TVL de 218 mm). Esto se documenta explicitamente
 * para no ocultar la simplificacion (S24).
 */
export function calcularEspesorBarreraBraquiterapia(nTVL: number, tvlMm: number): number {
  return nTVL * tvlMm;
}
// ============================================================================
// CASOS DE REGRESION - validados contra el ejemplo numerico COMPLETO de la
// Seccion 8.5 (pag. 104-106), leido directamente del documento fuente el
// 17/09/2026 (no se fabrican los valores de entrada). Sala HDR de Co-60 con
// 15 fuentes de 18,5 GBq c/u (barrera semanal) y 20 fuentes (verificacion de
// IDR con el numero maximo de fuentes), y sub-ejemplo comparativo con una
// unica fuente de Ir-192 de 370 GBq.
// ============================================================================

export const CASO_REGRESION_BRAQUITERAPIA_CO60_SEMANAL = {
  rakr: 0.308,
  actividadTotalMBq: 15 * 18.5 * 1000, // 15 fuentes x 18,5 GBq
  tiempoTratamientoH: 0.1,
  tratamientosPorSemana: 30,
  pDosisSemana: 6,
  dM: 3.5,
  t: 0.1,
  tvlHormigonMm: 218,
  wEsperado: 2.56e5,
  bEsperado: 2.87e-3,
  nTVLEsperado: 2.54,
  espesorEsperadoMm: 554,
};

export const CASO_REGRESION_BRAQUITERAPIA_CO60_IDR = {
  rakr: 0.308,
  actividadTotalMBq: 20 * 18.5 * 1000, // 20 fuentes (peor caso) x 18,5 GBq
  pInstantanea: 7.5,
  dM: 3.5,
  tvlHormigonMm: 218,
  d0Esperado: 113960,
  bEsperado: 8.1e-4,
  nTVLEsperado: 3.1,
  espesorEsperadoMm: 676,
};

export const CASO_REGRESION_BRAQUITERAPIA_IR192_SEMANAL = {
  rakr: 0.111,
  actividadTotalMBq: 370 * 1000, // 1 fuente de 370 GBq
  tiempoTratamientoH: 0.167,
  tratamientosPorSemana: 30,
  pDosisSemana: 6,
  dM: 3.5,
  t: 0.1,
  tvlHormigonMm: 152,
  wEsperado: 2.06e5,
  bEsperado: 3.6e-3,
  nTVLEsperado: 2.45,
};

/**
 * Ejecuta los casos de regresion contra las funciones ejecutables de este
 * archivo y devuelve, para cada caso, el valor calculado, el esperado (leido
 * del documento fuente) y si coinciden dentro de una tolerancia relativa del
 * 1% (redondeos de 3 cifras significativas del propio documento).
 */
export function ejecutarCasosDeRegresionBraquiterapia() {
  function cerca(calculado: number, esperado: number, tolRel = 0.01): boolean {
    return Math.abs(calculado - esperado) <= tolRel * Math.abs(esperado);
  }

  const c1 = CASO_REGRESION_BRAQUITERAPIA_CO60_SEMANAL;
  const w1 = calcularCargaTrabajoBraquiterapiaViaRAKR(c1.rakr, c1.actividadTotalMBq, c1.tiempoTratamientoH, c1.tratamientosPorSemana);
  const b1 = calcularFactorTransmisionBarreraBraquiterapiaSemanal(c1.pDosisSemana, c1.dM, w1, c1.t);
  const n1 = calcularNumeroTVL(b1);
  const espesor1 = calcularEspesorBarreraBraquiterapia(n1, c1.tvlHormigonMm);

  const c2 = CASO_REGRESION_BRAQUITERAPIA_CO60_IDR;
  const d0_2 = calcularTasaDosisSinBlindajeBraquiterapiaViaRAKR(c2.rakr, c2.actividadTotalMBq);
  const b2 = calcularFactorTransmisionInstantaneaBraquiterapia(c2.pInstantanea, c2.dM, d0_2);
  const n2 = calcularNumeroTVL(b2);
  const espesor2 = calcularEspesorBarreraBraquiterapia(n2, c2.tvlHormigonMm);

  const c3 = CASO_REGRESION_BRAQUITERAPIA_IR192_SEMANAL;
  const w3 = calcularCargaTrabajoBraquiterapiaViaRAKR(c3.rakr, c3.actividadTotalMBq, c3.tiempoTratamientoH, c3.tratamientosPorSemana);
  const b3 = calcularFactorTransmisionBarreraBraquiterapiaSemanal(c3.pDosisSemana, c3.dM, w3, c3.t);
  const n3 = calcularNumeroTVL(b3);

  return [
    { caso: "CO60_SEMANAL_W", calculado: w1, esperado: c1.wEsperado, ok: cerca(w1, c1.wEsperado) },
    { caso: "CO60_SEMANAL_B", calculado: b1, esperado: c1.bEsperado, ok: cerca(b1, c1.bEsperado) },
    { caso: "CO60_SEMANAL_N_TVL", calculado: n1, esperado: c1.nTVLEsperado, ok: cerca(n1, c1.nTVLEsperado) },
    { caso: "CO60_SEMANAL_ESPESOR_MM", calculado: espesor1, esperado: c1.espesorEsperadoMm, ok: cerca(espesor1, c1.espesorEsperadoMm) },
    { caso: "CO60_IDR_D0", calculado: d0_2, esperado: c2.d0Esperado, ok: cerca(d0_2, c2.d0Esperado) },
    { caso: "CO60_IDR_B", calculado: b2, esperado: c2.bEsperado, ok: cerca(b2, c2.bEsperado) },
    { caso: "CO60_IDR_N_TVL", calculado: n2, esperado: c2.nTVLEsperado, ok: cerca(n2, c2.nTVLEsperado) },
    { caso: "CO60_IDR_ESPESOR_MM", calculado: espesor2, esperado: c2.espesorEsperadoMm, ok: cerca(espesor2, c2.espesorEsperadoMm) },
    { caso: "IR192_SEMANAL_W", calculado: w3, esperado: c3.wEsperado, ok: cerca(w3, c3.wEsperado) },
    { caso: "IR192_SEMANAL_B", calculado: b3, esperado: c3.bEsperado, ok: cerca(b3, c3.bEsperado) },
    { caso: "IR192_SEMANAL_N_TVL", calculado: n3, esperado: c3.nTVLEsperado, ok: cerca(n3, c3.nTVLEsperado) },
  ];
}
