/**
 * REFERENCIAS NORMATIVAS - NCRP Report No. 151
 * "Structural Shielding Design and Evaluation for Megavoltage X- and
 * Gamma-Ray Radiotherapy Facilities"
 * National Council on Radiation Protection and Measurements (NCRP),
 * 31 de diciembre de 2005.
 *
 * ALCANCE DE ESTE ARCHIVO: Tablas y ecuaciones de calculo de BARRERAS
 * (primarias y secundarias) para ACELERADORES / RADIOTERAPIA DE
 * MEGAVOLTAJE. Complementa a ncrp151-shielding-references.ts (que cubre
 * factores de ocupacion T y objetivos de diseno P) y resuelve el
 * placeholder NCRP151_TVL_Y_BARRERAS_PENDIENTE dejado alli.
 *
 * ============================================================================
 * FUENTE Y METODO DE VERIFICACION (anti-fabricacion, S61 del Prompt Maestro)
 * ============================================================================
 * Documento releido directamente en la carpeta Drive del proyecto:
 * "NCRP 151 español.txt" (traduccion automatica de Google, "Machine
 * Translated by Google"). Datos transcritos tal como aparecen en el
 * Capitulo 2 (Metodos de calculo, pag. 20-46) y el Apendice B (Datos de
 * apoyo / tablas, pag. 160-168), con verificacion cruzada de indices de
 * caracteres dentro del documento para evitar mezclar filas/columnas.
 *
 * NOTA SOBRE PAGINACION: la traduccion automatica introduce artefactos de
 * OCR que desordenan ocasionalmente los numeros de pagina en los pies de
 * pagina (ej. "1AB6P2É/NDICE" en vez de "162 / APENDICE"). Las paginas
 * citadas abajo son aproximadas, reconstruidas a partir de los marcadores
 * de pie de pagina limpios que si se pudieron leer (ej. "168 / APENDICE B"
 * inmediatamente antes de la Tabla B.8a) y de la numeracion secuencial de
 * tablas. Nivel de confianza: ALTA para los valores numericos (copiados
 * directamente), MEDIA para la pagina exacta de cada tabla individual.
 *
 * Clasificacion: Nivel 2 (organismo cientifico internacional de referencia).
 */

import type { FuenteCita, NivelConfianza } from "./blindaje-calc-engine";

const BASE_FUENTE_NCRP151 = {
  documento:
    "NCRP Report No. 151: Structural Shielding Design and Evaluation for Megavoltage X- and Gamma-Ray Radiotherapy Facilities",
  autores: "National Council on Radiation Protection and Measurements (NCRP)",
  publicacion: "NCRP, Bethesda, MD, 31 de diciembre de 2005",
  anio: 2005,
  nivelJerarquia: "Nivel 2" as const,
};

function citaNCRP151(paginaAprox: string, tablaOSeccion: string, nivelConfianza: NivelConfianza = "ALTA", notas?: string): FuenteCita {
  return { ...BASE_FUENTE_NCRP151, paginaAprox, tablaOEcuacion: tablaOSeccion, nivelConfianza, notas };
}

// ============================================================================
// 1. TABLA B.2 - TVL DE BARRERA PRIMARIA (hormigon, acero, plomo)
// ============================================================================
// Texto fuente literal: "TABLA B.2-TVL de barrera primaria para concreto
// ordinario (2,35 g cm-3), acero (7,87 g cm-3) y plomo (11,35 g cm-3)
// (valores sugeridos en centimetros)."
// Nota al pie (a): "Los valores concretos se basan en una adaptacion
// conservadora y segura de Nelson y LaRiviere (1984) con extrapolacion a
// 4 MV y el uso de Kirn y Kennedy (1954) para 30 MV. Los TVL de plomo y
// acero son valores conservadores seguros adaptados del Informe NCRP No.
// 49 (NCRP, 1976) y Wachsmann y Drexler (1975)."
// Nota al pie (b): "Energia de punto final basada en valores de Cohen (1972)."

export const FUENTE_TABLA_B2_BARRERA_PRIMARIA = citaNCRP151(
  "162 (aprox.)",
  "Apendice B, Tabla B.2",
  "ALTA",
  "TVL1 = primera capa de valor decimo (considera endurecimiento del haz). TVLe = TVL de equilibrio (espectro ya endurecido)."
);

export type MaterialBarreraNCRP151 = "hormigon" | "acero" | "plomo";

export interface TVLBarreraPrimaria {
  energiaMV: string; // "4","6","10","15","18","20","25","30","Co-60"
  material: MaterialBarreraNCRP151;
  tvl1Cm: number;
  tvleCm: number;
}

export const TVL_BARRERA_PRIMARIA_NCRP151: TVLBarreraPrimaria[] = [
  { energiaMV: "4", material: "hormigon", tvl1Cm: 35, tvleCm: 30 },
  { energiaMV: "4", material: "acero", tvl1Cm: 9.9, tvleCm: 9.9 },
  { energiaMV: "4", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "6", material: "hormigon", tvl1Cm: 37, tvleCm: 33 },
  { energiaMV: "6", material: "acero", tvl1Cm: 10, tvleCm: 10 },
  { energiaMV: "6", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "10", material: "hormigon", tvl1Cm: 41, tvleCm: 37 },
  { energiaMV: "10", material: "acero", tvl1Cm: 11, tvleCm: 11 },
  { energiaMV: "10", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "15", material: "hormigon", tvl1Cm: 44, tvleCm: 41 },
  { energiaMV: "15", material: "acero", tvl1Cm: 11, tvleCm: 11 },
  { energiaMV: "15", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "18", material: "hormigon", tvl1Cm: 45, tvleCm: 43 },
  { energiaMV: "18", material: "acero", tvl1Cm: 11, tvleCm: 11 },
  { energiaMV: "18", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "20", material: "hormigon", tvl1Cm: 46, tvleCm: 44 },
  { energiaMV: "20", material: "acero", tvl1Cm: 11, tvleCm: 11 },
  { energiaMV: "20", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "25", material: "hormigon", tvl1Cm: 49, tvleCm: 46 },
  { energiaMV: "25", material: "acero", tvl1Cm: 11, tvleCm: 11 },
  { energiaMV: "25", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "30", material: "hormigon", tvl1Cm: 51, tvleCm: 49 },
  { energiaMV: "30", material: "acero", tvl1Cm: 11, tvleCm: 11 },
  { energiaMV: "30", material: "plomo", tvl1Cm: 5.7, tvleCm: 5.7 },
  { energiaMV: "Co-60", material: "hormigon", tvl1Cm: 21, tvleCm: 21 },
  { energiaMV: "Co-60", material: "acero", tvl1Cm: 7.0, tvleCm: 7.0 },
  { energiaMV: "Co-60", material: "plomo", tvl1Cm: 4.0, tvleCm: 4.0 },
];

export function obtenerTVLBarreraPrimaria(energiaMV: string, material: MaterialBarreraNCRP151): TVLBarreraPrimaria | undefined {
  return TVL_BARRERA_PRIMARIA_NCRP151.find((f) => f.energiaMV === energiaMV && f.material === material);
}

// ============================================================================
// 2. TABLA B.3 - PROPIEDADES DE MATERIALES DE BLINDAJE (referencial)
// ============================================================================
// Texto fuente: "TABLA B.3-Propiedades de varios materiales de blindaje
// (adaptado de Profio, 1979)."
// NOTA: la fila "Activacion de neutrones termicos" presento un artefacto de
// OCR (solo 4 valores legibles para 5 columnas: "Pequeña Largo -a Moderado
// Nulo"), por lo que NO se asigna un valor a cada material individual en esa
// fila para evitar inventar/adivinar la correspondencia (S55, S61). Se deja
// el texto crudo tal como aparece, con la nota de que requiere revision
// contra el documento original en ingles si se necesita ese dato especifico.

export const FUENTE_TABLA_B3_PROPIEDADES = citaNCRP151(
  "163 (aprox.)",
  "Apendice B, Tabla B.3",
  "ALTA",
  "Adaptado de Profio (1979). Fila de activacion de neutrones termicos con artefacto de OCR (ver nota en el codigo)."
);

export interface PropiedadMaterialNCRP151 {
  material: "concreto_ordinario" | "concreto_pesado" | "plomo" | "acero" | "polietileno";
  densidadGCm3: string;
  numeroAtomicoEfectivo: string;
  concentracionHidrogenoX1e22AtomosCm3: string;
  costoRelativo: string;
}

export const PROPIEDADES_MATERIALES_NCRP151: PropiedadMaterialNCRP151[] = [
  { material: "concreto_ordinario", densidadGCm3: "2.2-2.4", numeroAtomicoEfectivo: "11", concentracionHidrogenoX1e22AtomosCm3: "0.8-2.4", costoRelativo: "$$" },
  { material: "concreto_pesado", densidadGCm3: "3.7-4.8", numeroAtomicoEfectivo: "~26", concentracionHidrogenoX1e22AtomosCm3: "0.8-2.4", costoRelativo: "$$$$" },
  { material: "plomo", densidadGCm3: "11.35", numeroAtomicoEfectivo: "82", concentracionHidrogenoX1e22AtomosCm3: "0", costoRelativo: "$$$" },
  { material: "acero", densidadGCm3: "7.87", numeroAtomicoEfectivo: "26", concentracionHidrogenoX1e22AtomosCm3: "0", costoRelativo: "$$" },
  { material: "polietileno", densidadGCm3: "0.95", numeroAtomicoEfectivo: "5.5", concentracionHidrogenoX1e22AtomosCm3: "8", costoRelativo: "$$$" },
];

// ============================================================================
// 3. TABLA B.4 - FRACCION DE DISPERSION (a) DEL PACIENTE A 1 m
// ============================================================================
// Texto fuente: "TABLA B.4-Fracciones de dispersion (a) a 1 m de un maniqui
// de tamaño humano, distancia objetivo a maniqui de 1 m y tamaño de campo
// de 400 cm2 (McGinley, 2002; Taylor et al., 1999)."

export const FUENTE_TABLA_B4_FRACCION_DISPERSION = citaNCRP151(
  "165 (aprox.)",
  "Apendice B, Tabla B.4",
  "ALTA",
  "Fraccion de dosis absorbida del haz primario dispersada por el paciente en un angulo dado, normalizada a campo 20x20 cm (400 cm2) a 1 m."
);

export interface FraccionDispersionPaciente {
  anguloGrados: number;
  a6MV: number;
  a10MV: number;
  a18MV: number;
  a24MV: number;
}

export const FRACCION_DISPERSION_PACIENTE_NCRP151: FraccionDispersionPaciente[] = [
  { anguloGrados: 10, a6MV: 1.04e-2, a10MV: 1.66e-2, a18MV: 1.42e-2, a24MV: 1.78e-2 },
  { anguloGrados: 20, a6MV: 6.73e-3, a10MV: 5.79e-3, a18MV: 5.39e-3, a24MV: 6.32e-3 },
  { anguloGrados: 30, a6MV: 2.77e-3, a10MV: 3.18e-3, a18MV: 2.53e-3, a24MV: 2.74e-3 },
  { anguloGrados: 45, a6MV: 1.39e-3, a10MV: 1.35e-3, a18MV: 8.64e-4, a24MV: 8.30e-4 },
  { anguloGrados: 60, a6MV: 8.24e-4, a10MV: 7.46e-4, a18MV: 4.24e-4, a24MV: 3.86e-4 },
  { anguloGrados: 90, a6MV: 4.26e-4, a10MV: 3.81e-4, a18MV: 1.89e-4, a24MV: 1.74e-4 },
  { anguloGrados: 135, a6MV: 3.00e-4, a10MV: 3.02e-4, a18MV: 1.24e-4, a24MV: 1.20e-4 },
  { anguloGrados: 150, a6MV: 2.87e-4, a10MV: 2.74e-4, a18MV: 1.20e-4, a24MV: 1.13e-4 },
];

// ============================================================================
// 4. TABLA B.5a - TVL EN HORMIGON PARA RADIACION DISPERSADA POR EL PACIENTE
// ============================================================================
export const FUENTE_TABLA_B5A_TVL_DISPERSION_HORMIGON = citaNCRP151(
  "166 (aprox.)",
  "Apendice B, Tabla B.5a",
  "ALTA",
  "Basada en Figuras 10 y 15 del Informe NCRP No. 49 (1976). Valores conservadores y seguros para diseno de blindaje."
);

export interface TVLDispersionHormigon {
  anguloGrados: number;
  co60Cm: number;
  mv4Cm: number;
  mv6Cm: number;
  mv10Cm: number;
  mv15Cm: number;
  mv18Cm: number;
  mv20Cm: number;
  mv24Cm: number;
}

export const TVL_DISPERSION_PACIENTE_HORMIGON_NCRP151: TVLDispersionHormigon[] = [
  { anguloGrados: 15, co60Cm: 22, mv4Cm: 30, mv6Cm: 34, mv10Cm: 39, mv15Cm: 42, mv18Cm: 44, mv20Cm: 46, mv24Cm: 49 },
  { anguloGrados: 30, co60Cm: 21, mv4Cm: 25, mv6Cm: 26, mv10Cm: 28, mv15Cm: 31, mv18Cm: 32, mv20Cm: 33, mv24Cm: 36 },
  { anguloGrados: 45, co60Cm: 20, mv4Cm: 22, mv6Cm: 23, mv10Cm: 25, mv15Cm: 26, mv18Cm: 27, mv20Cm: 27, mv24Cm: 29 },
  { anguloGrados: 60, co60Cm: 19, mv4Cm: 21, mv6Cm: 21, mv10Cm: 22, mv15Cm: 23, mv18Cm: 23, mv20Cm: 24, mv24Cm: 24 },
  { anguloGrados: 90, co60Cm: 15, mv4Cm: 17, mv6Cm: 17, mv10Cm: 18, mv15Cm: 18, mv18Cm: 19, mv20Cm: 19, mv24Cm: 19 },
  { anguloGrados: 135, co60Cm: 13, mv4Cm: 14, mv6Cm: 15, mv10Cm: 15, mv15Cm: 15, mv18Cm: 15, mv20Cm: 15, mv24Cm: 16 },
];

// ============================================================================
// 5. TABLA B.5b - TVL1 Y TVL2 EN PLOMO PARA RADIACION DISPERSADA POR EL PACIENTE
// ============================================================================
export const FUENTE_TABLA_B5B_TVL_DISPERSION_PLOMO = citaNCRP151(
  "166 (aprox.)",
  "Apendice B, Tabla B.5b",
  "ALTA",
  "Basado en Nogueira y Biggs (2002), actualizado por Biggs (2005, comunicacion personal)."
);

export interface TVLDispersionPlomo {
  anguloGrados: number;
  mv4TVL1Cm: number;
  mv4TVL2Cm: number;
  mv6TVL1Cm: number;
  mv6TVL2Cm: number;
  mv10TVL1Cm: number;
  mv10TVL2Cm: number;
}

export const TVL_DISPERSION_PACIENTE_PLOMO_NCRP151: TVLDispersionPlomo[] = [
  { anguloGrados: 30, mv4TVL1Cm: 3.3, mv4TVL2Cm: 3.7, mv6TVL1Cm: 3.8, mv6TVL2Cm: 4.4, mv10TVL1Cm: 4.3, mv10TVL2Cm: 4.5 },
  { anguloGrados: 45, mv4TVL1Cm: 2.4, mv4TVL2Cm: 3.1, mv6TVL1Cm: 2.8, mv6TVL2Cm: 3.4, mv10TVL1Cm: 3.1, mv10TVL2Cm: 3.6 },
  { anguloGrados: 60, mv4TVL1Cm: 1.8, mv4TVL2Cm: 2.5, mv6TVL1Cm: 1.9, mv6TVL2Cm: 2.6, mv10TVL1Cm: 2.1, mv10TVL2Cm: 2.7 },
  { anguloGrados: 75, mv4TVL1Cm: 1.3, mv4TVL2Cm: 1.9, mv6TVL1Cm: 1.4, mv6TVL2Cm: 1.9, mv10TVL1Cm: 1.5, mv10TVL2Cm: 1.9 },
  { anguloGrados: 90, mv4TVL1Cm: 0.9, mv4TVL2Cm: 1.3, mv6TVL1Cm: 1.0, mv6TVL2Cm: 1.5, mv10TVL1Cm: 1.2, mv10TVL2Cm: 1.6 },
  { anguloGrados: 105, mv4TVL1Cm: 0.7, mv4TVL2Cm: 1.2, mv6TVL1Cm: 0.7, mv6TVL2Cm: 1.2, mv10TVL1Cm: 0.95, mv10TVL2Cm: 1.4 },
  { anguloGrados: 120, mv4TVL1Cm: 0.5, mv4TVL2Cm: 0.8, mv6TVL1Cm: 0.5, mv6TVL2Cm: 0.8, mv10TVL1Cm: 0.8, mv10TVL2Cm: 1.4 },
];

// ============================================================================
// 6. TABLA B.6 - ENERGIA MEDIA (MeV) DE LA RADIACION DISPERSADA POR EL PACIENTE
// ============================================================================
export const FUENTE_TABLA_B6_ENERGIA_MEDIA_DISPERSION = citaNCRP151(
  "166 (aprox.)",
  "Apendice B, Tabla B.6",
  "ALTA",
  "Adaptado por McGinley (2002) de Taylor et al. (1999). Energia media en MeV en funcion del angulo de dispersion y la energia de punto final (MV)."
);

export interface EnergiaMediaDispersion {
  energiaPuntoFinalMV: number;
  ang0: number;
  ang10: number;
  ang20: number;
  ang30: number;
  ang40: number;
  ang50: number;
  ang70: number;
  ang90: number;
}

export const ENERGIA_MEDIA_DISPERSION_NCRP151: EnergiaMediaDispersion[] = [
  { energiaPuntoFinalMV: 6, ang0: 1.6, ang10: 1.4, ang20: 1.2, ang30: 0.9, ang40: 0.7, ang50: 0.5, ang70: 0.4, ang90: 0.2 },
  { energiaPuntoFinalMV: 10, ang0: 2.7, ang10: 2.0, ang20: 1.3, ang30: 1.0, ang40: 0.7, ang50: 0.5, ang70: 0.4, ang90: 0.2 },
  { energiaPuntoFinalMV: 18, ang0: 5.0, ang10: 3.2, ang20: 2.1, ang30: 1.3, ang40: 0.9, ang50: 0.6, ang70: 0.4, ang90: 0.3 },
  { energiaPuntoFinalMV: 24, ang0: 5.6, ang10: 3.9, ang20: 2.7, ang30: 1.7, ang40: 1.1, ang50: 0.8, ang70: 0.5, ang90: 0.3 },
];

// ============================================================================
// 7. TABLA B.7 - TVL PARA RADIACION DE FUGA EN HORMIGON ORDINARIO
// ============================================================================
// Nota al pie (a): "Los datos para TVL1 y TVL2 se basan en una adaptacion
// conservadora y segura de los valores de 90 grados (80 a 100 grados) de
// Nelson y LaRiviere (1984) y extrapolaciones graficas a 4 MV y 30 MV. NCRP
// Report No. 49 (NCRP, 1976) valores utilizados para 60Co."
// Nota al pie (b): "Energia de punto final basada en valores de Cohen (1972)."

export const FUENTE_TABLA_B7_TVL_FUGA = citaNCRP151(
  "167 (aprox.)",
  "Apendice B, Tabla B.7",
  "ALTA",
  "TVL para radiacion de fuga del cabezal, en hormigon ordinario. TVL1 = primera capa; TVLe = capa de equilibrio."
);

export interface TVLFugaHormigon {
  energiaMV: string;
  tvl1Cm: number;
  tvleCm: number;
}

export const TVL_FUGA_HORMIGON_NCRP151: TVLFugaHormigon[] = [
  { energiaMV: "4", tvl1Cm: 33, tvleCm: 28 },
  { energiaMV: "6", tvl1Cm: 34, tvleCm: 29 },
  { energiaMV: "10", tvl1Cm: 35, tvleCm: 31 },
  { energiaMV: "15", tvl1Cm: 36, tvleCm: 33 },
  { energiaMV: "18", tvl1Cm: 36, tvleCm: 34 },
  { energiaMV: "20", tvl1Cm: 36, tvleCm: 34 },
  { energiaMV: "25", tvl1Cm: 37, tvleCm: 35 },
  { energiaMV: "30", tvl1Cm: 37, tvleCm: 36 },
  { energiaMV: "Co-60", tvl1Cm: 21, tvleCm: 21 },
];

export function obtenerTVLFugaHormigon(energiaMV: string): TVLFugaHormigon | undefined {
  return TVL_FUGA_HORMIGON_NCRP151.find((f) => f.energiaMV === energiaMV);
}

// ============================================================================
// 8. ECUACIONES DE CALCULO (Capitulo 2, "Metodos de calculo", pag. 20-34)
// ============================================================================
// Todas las ecuaciones se transcriben tal como aparecen en el texto
// (traduccion), con simbolos definidos explicitamente (S24: nunca ocultar
// el significado ni la fuente de un valor).

export const FUENTE_ECUACIONES_BARRERA_PRIMARIA = citaNCRP151(
  "22-23",
  "Seccion 2.2.1, Ecuaciones 2.1, 2.2 y 2.3",
  "ALTA",
  "Enfoque estandar para barrera primaria: factor de transmision, numero de TVL requeridos y espesor de barrera."
);

export const FUENTE_ECUACION_DISPERSION_PACIENTE = citaNCRP151(
  "32 (aprox.)",
  "Seccion 2.3, Ecuacion 2.7",
  "ALTA",
  "Factor de transmision de barrera secundaria requerido para la radiacion dispersada por el paciente."
);

export const FUENTE_ECUACION_FUGA = citaNCRP151(
  "33 (aprox.)",
  "Seccion 2.3, Ecuacion 2.8",
  "ALTA",
  "Factor de transmision de barrera secundaria requerido para la radiacion de fuga del cabezal (se asume fuga = 0.1% del haz util a 1 m, IEC)."
);

export const FUENTE_REGLA_DOS_FUENTES = citaNCRP151(
  "33-34 (aprox.)",
  "Seccion 2.3, 'regla de las dos fuentes'",
  "MEDIA",
  "Texto fuente (traduccion): 'Si el espesor de la barrera requerida es aproximadamente el mismo para cada componente secundario ... se agrega 1 HVL al mayor de los dos espesores de barrera. Si los dos espesores difieren en un TVL o mas, se utiliza el espesor de barrera mas grande.' El pasaje revisado NO especifica un metodo de interpolacion explicito para diferencias intermedias (entre 1 HVL y 1 TVL); esta implementacion NO inventa una formula de interpolacion para ese rango y en su lugar senala 'REQUIERE REVISION EXPERTA' (S5, S55 del Prompt Maestro)."
);

/**
 * Ecuacion 2.1: factor de transmision requerido para la barrera primaria.
 * Bpri = P * dpri^2 / (W * U * T)
 * @param pSvSemana Objetivo de diseno de blindaje P (Sv/semana)
 * @param dPriM Distancia desde el objetivo (target) hasta el punto protegido (m)
 * @param wGySemana Carga de trabajo W (Gy/semana a 1 m)
 * @param u Factor de uso (fraccion 0-1)
 * @param t Factor de ocupacion (fraccion 0-1)
 */
export function calcularFactorTransmisionBarreraPrimaria(
  pSvSemana: number,
  dPriM: number,
  wGySemana: number,
  u: number,
  t: number
): number {
  return (pSvSemana * dPriM * dPriM) / (wGySemana * u * t);
}

/**
 * Ecuacion 2.2: numero de TVL requeridos a partir del factor de transmision B.
 * n = log10(1 / B)
 */
export function calcularNumeroTVL(b: number): number {
  return Math.log10(1 / b);
}

/**
 * Ecuacion 2.3: espesor de barrera a partir del numero de TVL, usando la
 * primera capa (TVL1, considera endurecimiento del haz) y la capa de
 * equilibrio (TVLe).
 * t_barrera = TVL1 + (n - 1) * TVLe   (valido para n >= 1)
 * Si n < 1 el texto fuente no define una formula distinta; se devuelve
 * n * TVL1 como aproximacion conservadora explicita y se marca en el
 * resultado (aproximacionNMenorQueUno = true) para que la UI lo muestre
 * sin ocultarlo (S24).
 */
export function calcularEspesorBarrera(
  n: number,
  tvl1Cm: number,
  tvleCm: number
): { espesorCm: number; aproximacionNMenorQueUno: boolean } {
  if (n >= 1) {
    return { espesorCm: tvl1Cm + (n - 1) * tvleCm, aproximacionNMenorQueUno: false };
  }
  return { espesorCm: n * tvl1Cm, aproximacionNMenorQueUno: true };
}

/**
 * Ecuacion 2.7: factor de transmision requerido para la barrera secundaria
 * por radiacion dispersada por el paciente.
 * Bps = P * dsca^2 * dsec^2 * 400 / (a * W * T * F)
 * @param dScaM Distancia desde el objetivo (target) hasta el paciente/superficie dispersora (m)
 * @param dSecM Distancia desde el objeto dispersor hasta el punto protegido (m)
 * @param aFraccion Fraccion de dispersion (Tabla B.4)
 * @param fCm2 Area de campo a mitad de profundidad del paciente a 1 m (cm2); 400 = referencia 20x20cm
 */
export function calcularFactorTransmisionDispersionPaciente(
  pSvSemana: number,
  dScaM: number,
  dSecM: number,
  aFraccion: number,
  wGySemana: number,
  t: number,
  fCm2: number = 400
): number {
  return (pSvSemana * dScaM * dScaM * dSecM * dSecM * 400) / (aFraccion * wGySemana * t * fCm2);
}

/**
 * Ecuacion 2.8: factor de transmision requerido para la barrera secundaria
 * por radiacion de fuga del cabezal.
 * BL = P * dL^2 / (1e-3 * W)
 * Supuestos explicitos del documento: radiacion de fuga = 0.1% (1e-3) del haz
 * util a 1 m (limite IEC); factor de uso = 1 (a menos que se conozcan los
 * factores de uso reales, en cuyo caso se deben usar en el denominador,
 * segun el texto fuente).
 * @param dLM Distancia desde el isocentro (o cabezal) hasta el punto protegido (m)
 * @param factorFuga Fraccion de fuga asumida (por defecto 1e-3 = 0.1%, IEC)
 */
export function calcularFactorTransmisionFuga(
  pSvSemana: number,
  dLM: number,
  wGySemana: number,
  factorFuga: number = 1e-3
): number {
  return (pSvSemana * dLM * dLM) / (factorFuga * wGySemana);
}

export type CriterioCombinacionDosFuentes =
  | "SUMA_1_HVL_AL_MAYOR"
  | "USAR_MAYOR_SIN_SUMA"
  | "RANGO_INTERMEDIO_REQUIERE_REVISION_EXPERTA";

export interface ResultadoCombinacionDosFuentes {
  espesorFinalCm: number | null;
  criterio: CriterioCombinacionDosFuentes;
  detalle: string;
  fuente: FuenteCita;
}

/**
 * Aplica la "regla de las dos fuentes" (Seccion 2.3) para combinar los
 * espesores requeridos por dispersion del paciente (tPsCm) y por fuga del
 * cabezal (tLCm) en un unico espesor de barrera secundaria.
 * hvlCm y tvlCm deben corresponder al MISMO material y a la radiacion mas
 * penetrante de las dos (regla explicita del documento, Seccion 1.4.3).
 * HVL se puede aproximar como 0.301 * TVLe cuando no se dispone de un valor
 * de HVL tabulado (identidad matematica: HVL = TVL * log10(2); usada
 * explicitamente en los ejemplos numericos del Capitulo 7 del propio
 * documento, ej. factor 0.301 en la Seccion 7.1 revisada en esta sesion).
 */
export function combinarBarreraSecundariaDosFuentes(
  tPsCm: number,
  tLCm: number,
  hvlCm: number,
  tvlCm: number
): ResultadoCombinacionDosFuentes {
  const mayor = Math.max(tPsCm, tLCm);
  const diff = Math.abs(tPsCm - tLCm);
  if (diff <= hvlCm) {
    return {
      espesorFinalCm: mayor + hvlCm,
      criterio: "SUMA_1_HVL_AL_MAYOR",
      detalle: `Diferencia entre espesores (${diff.toFixed(2)} cm) <= 1 HVL (${hvlCm.toFixed(2)} cm): se suma 1 HVL al mayor de los dos espesores, por la regla de las dos fuentes.`,
      fuente: FUENTE_REGLA_DOS_FUENTES,
    };
  }
  if (diff >= tvlCm) {
    return {
      espesorFinalCm: mayor,
      criterio: "USAR_MAYOR_SIN_SUMA",
      detalle: `Diferencia entre espesores (${diff.toFixed(2)} cm) >= 1 TVL (${tvlCm.toFixed(2)} cm): se utiliza directamente el espesor de barrera mas grande.`,
      fuente: FUENTE_REGLA_DOS_FUENTES,
    };
  }
  return {
    espesorFinalCm: null,
    criterio: "RANGO_INTERMEDIO_REQUIERE_REVISION_EXPERTA",
    detalle: `Diferencia entre espesores (${diff.toFixed(2)} cm) esta entre 1 HVL (${hvlCm.toFixed(2)} cm) y 1 TVL (${tvlCm.toFixed(2)} cm). El pasaje revisado de NCRP 151 no especifica un metodo de interpolacion para este rango intermedio. No se inventa una formula: se requiere revision de un experto calificado (Fisico Medico / OPR), conforme S5 y S55 del Prompt Maestro.`,
    fuente: FUENTE_REGLA_DOS_FUENTES,
  };
}

// ============================================================================
// 9. PENDIENTE EXPLICITO: PUERTAS, LABERINTOS Y NEUTRONES (Seccion 2.4, 7.1.10-7.1.17)
// ============================================================================
export const NCRP151_LABERINTOS_Y_NEUTRONES_PENDIENTE = {
  estado: "PENDIENTE_DE_EXTRACCION" as const,
  advertencia:
    "El diseno de puertas y laberintos (Seccion 2.4: aceleradores de baja energia <=10 MV y de alta energia >10 MV con produccion de neutrones, metodo de Kersey y Kersey modificado, rayos gamma de captura de neutrones, Tablas B.8a/b/c de albedo y B.9 de rendimiento de fotoneutrones) fue localizado en el documento pero NO fue extraido ni transcrito de forma sistematica en esta sesion. Esta implementacion cubre unicamente barreras primarias y secundarias (Tablas B.2 a B.7, Ecuaciones 2.1, 2.2, 2.3, 2.7 y 2.8). No se fabrica ningun valor de las tablas de laberintos/neutrones aqui. Su extraccion queda pendiente para una fase posterior, respetando el orden de fases del Prompt Maestro.",
};
