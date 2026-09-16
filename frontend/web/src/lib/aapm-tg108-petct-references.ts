/**
 * REFERENCIAS NORMATIVAS - AAPM Task Group 108 Report
 * "PET and PET/CT Shielding Requirements"
 * Madsen M.T., Anderson J.A., Halama J.R., Kleck J., Simpkin D.J., Votaw J.R.,
 * Wendt R.E. III, Williams L.E., Yester M.V. (AAPM Task Group 108).
 * Medical Physics, Vol. 33, No. 1, pp. 4-15, enero de 2006
 * (recibido 21-jul-2005, publicado 19-dic-2005). DOI: 10.1118/1.2135911
 *
 * ALCANCE DE ESTE ARCHIVO: metodologia y datos de blindaje ESPECIFICOS PARA
 * MEDICINA NUCLEAR PET / PET-CT (foton de aniquilacion positron-electron de
 * 511 keV). Distinto de NCRP147 (diagnostico por rayos X convencional) y de
 * NCRP151 (aceleradores/radioterapia externa de megavoltaje) ya usados en
 * este proyecto: la metodologia de TG-108 modela al PACIENTE como fuente
 * radiactiva movil en el tiempo (con decaimiento fisico y biologico), NO un
 * haz de rayos X con carga de trabajo W. NO reemplaza ni se mezcla con las
 * tablas/ecuaciones de NCRP147/151 (regla S1 del Prompt Maestro: no mezclar
 * metodologias de distintas modalidades).
 *
 * Hallazgo de este archivo dentro del proyecto (16/09/2026): documento
 * localizado en la carpeta Drive del proyecto ("TG108 AAPM REQUIRIMIENTOS DE
 * BLINDAJE.txt"), no listado previamente en el inventario de Fase 1. Dado
 * que la rama actual de desarrollo (feature/fase23-petct-fase-a-arquitectura)
 * tiene foco especifico en PET-CT, este es el documento primario mas
 * relevante para esa fase y se prioriza su extraccion.
 *
 * ============================================================================
 * FUENTE Y METODO DE VERIFICACION (anti-fabricacion, S61 del Prompt Maestro)
 * ============================================================================
 * Documento releido directamente desde la carpeta Drive del proyecto. Es un
 * articulo de revista (Medical Physics/AAPM) en ingles, con estructura de
 * texto limpia (sin las traducciones automaticas que afectan a otros
 * archivos de este proyecto como NCRP151 o SRS-47).
 *
 * ADVERTENCIA SOBRE UNIDADES (simbolo µ eliminado en la extraccion de texto):
 * En el documento fuente, TODOS los valores de tasa de dosis en "Sv" (sin
 * prefijo) corresponden en realidad a microsievert (µSv): el simbolo µ fue
 * eliminado por completo durante la extraccion de texto (distinto del caso
 * SRS-47, donde µ fue sustituido por "m"; aqui simplemente desaparece).
 * Verificacion cruzada interna (igual metodologia que validarModeloArcher()
 * en blindaje-calc-engine.ts): el documento declara la constante de tasa de
 * dosis del F-18 como "0.143 Sv*m^2/(MBq*h)" y en la misma seccion afirma
 * textualmente que la tasa de dosis de 37 MBq (1 mCi) de F-18 a 1 m es
 * "5.3 Sv/h". Verificacion: 0.143 * 37 = 5.291, que solo coincide con "5.3"
 * si la unidad real es µSv (5.291 µSv/h ~ 5.3 µSv/h). Confirmado ademas por
 * los limites regulatorios citados en el propio documento, que SI conservan
 * el simbolo µ en una frase ("...no exceda 1 mSv/year or 20 µSv in any 1 h"),
 * y por el hecho de que 1 mSv/ano / 52 semanas ~ 19.2 µSv/semana ~ 20 µSv
 * (coincide con el limite semanal P=20 [µSv] usado en las Ecs. 5 y 6 de este
 * mismo documento). CONCLUSION: todos los valores de tasa/constante de dosis
 * de este archivo se registran corregidos en microsievert (µSv), nunca en
 * milisievert. Nivel de confianza: ALTA (verificacion aritmetica interna,
 * no un valor inventado).
 *
 * ADVERTENCIA SOBRE MARCO REGULATORIO: este documento usa como base el
 * codigo regulatorio federal de EE.UU. (10 CFR 20), NO NCRP147 ni NCRP151.
 * Los valores P (objetivo de diseno semanal) de TG-108 son especificos de
 * PET/PET-CT y NO deben combinarse con los valores P de NCRP147/151 ya
 * sembrados para otras modalidades.
 *
 * TABLA I (nucleidos PET): la fila de I-124 presento columnas desalineadas
 * en la extraccion de texto (salto de pagina en la tabla original). Los
 * valores de energia maxima del positron para I-124 NO se pudieron parear
 * con confianza a su columna exacta; se marcan PENDIENTE_DE_VERIFICACION.
 * Los valores de energia de fotones y fotones/decaimiento para I-124 SI son
 * reconstruibles sin ambiguedad (511, 603 y 1693 keV con intensidades 0.5,
 * 0.62 y 0.3 fotones/decaimiento, consistente con datos nucleares conocidos
 * de I-124) y se registran con confianza ALTA.
 *
 * Clasificacion: Nivel 2 (organismo cientifico de referencia - AAPM,
 * revision por pares en Medical Physics).
 */

import type { FuenteCita, NivelConfianza } from "./blindaje-calc-engine";

const BASE_FUENTE_TG108 = {
  documento: "AAPM Task Group 108 Report: PET and PET/CT Shielding Requirements",
  autores:
    "Madsen M.T., Anderson J.A., Halama J.R., Kleck J., Simpkin D.J., Votaw J.R., Wendt R.E. III, Williams L.E., Yester M.V. (AAPM Task Group 108)",
  publicacion: "Medical Physics, Vol. 33, No. 1, pp. 4-15, enero de 2006 (DOI: 10.1118/1.2135911)",
  anio: 2006,
  nivelJerarquia: "Nivel 2" as const,
};

function citaTG108(paginaAprox: string, tablaOSeccion: string, nivelConfianza: NivelConfianza = "ALTA", notas?: string): FuenteCita {
  return { ...BASE_FUENTE_TG108, paginaAprox, tablaOEcuacion: tablaOSeccion, nivelConfianza, notas };
}

// ============================================================================
// TABLA I - PROPIEDADES FISICAS DE RADIONUCLEIDOS PET COMUNES
// ============================================================================

export const FUENTE_TABLA_I = citaTG108("4-5", "Table I", "ALTA");

export interface NucleidoPET {
  nucleido: string;
  vidaMedia: string;
  modoDecaimiento: string;
  energiaMaximaPositronMeV: number | null;
  fotonesEmisionKeV: number[];
  fotonesPorDecaimiento: number[];
  notas?: string;
}

export const NUCLEIDOS_PET_TABLA_I: NucleidoPET[] = [
  { nucleido: "C-11", vidaMedia: "20.4 min", modoDecaimiento: "b+", energiaMaximaPositronMeV: 0.96, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [2.0] },
  { nucleido: "N-13", vidaMedia: "10.0 min", modoDecaimiento: "b+", energiaMaximaPositronMeV: 1.19, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [2.0] },
  { nucleido: "O-15", vidaMedia: "2.0 min", modoDecaimiento: "b+", energiaMaximaPositronMeV: 1.72, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [2.0] },
  { nucleido: "F-18", vidaMedia: "109.8 min", modoDecaimiento: "b+, EC", energiaMaximaPositronMeV: 0.63, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [1.93] },
  { nucleido: "Cu-64", vidaMedia: "12.7 h", modoDecaimiento: "b-, b+, EC", energiaMaximaPositronMeV: 0.65, fotonesEmisionKeV: [511, 1346], fotonesPorDecaimiento: [0.38, 0.005] },
  { nucleido: "Ga-68", vidaMedia: "68.3 min", modoDecaimiento: "b+, EC", energiaMaximaPositronMeV: 1.9, fotonesEmisionKeV: [511], fotonesPorDecaimiento: [1.84] },
  { nucleido: "Rb-82", vidaMedia: "76 s", modoDecaimiento: "b+, EC", energiaMaximaPositronMeV: 3.35, fotonesEmisionKeV: [511, 776], fotonesPorDecaimiento: [1.90, 0.13] },
  {
    nucleido: "I-124",
    vidaMedia: "4.2 d",
    modoDecaimiento: "b+, EC",
    energiaMaximaPositronMeV: null,
    fotonesEmisionKeV: [511, 603, 1693],
    fotonesPorDecaimiento: [0.5, 0.62, 0.3],
    notas: "PENDIENTE_DE_VERIFICACION: la energia maxima del positron para I-124 no se pudo parear con confianza a su columna exacta en la extraccion de texto (valores candidatos '1.5' o '2.17' MeV aparecen en el documento pero desordenados por un salto de pagina en la tabla original). Los valores de fotones/decaimiento SI son consistentes con datos nucleares conocidos de I-124 y se registran con confianza ALTA.",
  },
];

// ============================================================================
// TABLA II - CONSTANTES DE TASA DE DOSIS EQUIVALENTE EFECTIVA (corregidas a uSv)
// ============================================================================

export const FUENTE_TABLA_II = citaTG108(
  "5",
  "Table II",
  "ALTA",
  "Unidad corregida de 'Sv*m^2/(MBq*h)' (como aparece impreso, sin prefijo) a uSv*m^2/(MBq*h), ver advertencia de unidades en la cabecera del archivo."
);

export interface ConstanteDosisPET {
  nucleido: string;
  constanteTasaDosisUSvM2MBqH: number;
  dosisIntegrada1hUSvM2MBq: number;
}

export const CONSTANTES_DOSIS_TABLA_II: ConstanteDosisPET[] = [
  { nucleido: "C-11", constanteTasaDosisUSvM2MBqH: 0.148, dosisIntegrada1hUSvM2MBq: 0.063 },
  { nucleido: "N-13", constanteTasaDosisUSvM2MBqH: 0.148, dosisIntegrada1hUSvM2MBq: 0.034 },
  { nucleido: "O-15", constanteTasaDosisUSvM2MBqH: 0.148, dosisIntegrada1hUSvM2MBq: 0.007 },
  { nucleido: "F-18", constanteTasaDosisUSvM2MBqH: 0.143, dosisIntegrada1hUSvM2MBq: 0.119 },
  { nucleido: "Cu-64", constanteTasaDosisUSvM2MBqH: 0.029, dosisIntegrada1hUSvM2MBq: 0.024 },
  { nucleido: "Ga-68", constanteTasaDosisUSvM2MBqH: 0.134, dosisIntegrada1hUSvM2MBq: 0.101 },
  { nucleido: "Rb-82", constanteTasaDosisUSvM2MBqH: 0.159, dosisIntegrada1hUSvM2MBq: 0.006 },
  { nucleido: "I-124", constanteTasaDosisUSvM2MBqH: 0.185, dosisIntegrada1hUSvM2MBq: 0.184 },
];

// ============================================================================
// TABLA III - CONSTANTES DE TASA DE EXPOSICION/DOSIS REPORTADAS PARA F-18
// ============================================================================

export const FUENTE_TABLA_III = citaTG108(
  "5-6",
  "Table III",
  "ALTA",
  "Unidades 'Sv*m^2/(MBq*h)' corregidas a uSv*m^2/(MBq*h) excepto la constante de exposicion (en R, Roentgen, que si esta correctamente indicada en el documento fuente)."
);

export interface ConstanteF18 {
  parametro: string;
  valor: number;
  unidad: string;
  notas?: string;
}

export const CONSTANTES_F18_TABLA_III: ConstanteF18[] = [
  { parametro: "Constante de tasa de exposicion", valor: 15.4, unidad: "R*m^2/(MBq*h)" },
  { parametro: "Constante de tasa de kerma en aire", valor: 0.134, unidad: "uSv*m^2/(MBq*h)" },
  { parametro: "Dosis equivalente efectiva (ANSI/ANS-6.1.1, 1991)", valor: 0.143, unidad: "uSv*m^2/(MBq*h)", notas: "Valor recomendado por el Task Group para calculos de blindaje, por ser consistente con la forma en que se expresan los limites regulatorios (dosis equivalente efectiva)." },
  { parametro: "Constante de dosis en tejido", valor: 0.148, unidad: "uSv*m^2/(MBq*h)", notas: "Dosis a 1 cm^3 de tejido unitario en densidad, en aire." },
  { parametro: "Dosis equivalente profunda (ANS, 1977)", valor: 0.183, unidad: "uSv*m^2/(MBq*h)", notas: "Dosis a 1 cm de profundidad en un slab de tejido de 30 cm expuesto a haz ancho de fotones de 511 keV." },
  { parametro: "Dosis maxima (ANS, 1977)", valor: 0.188, unidad: "uSv*m^2/(MBq*h)", notas: "Dosis maxima recibida en un slab de tejido de 30 cm (incluye componentes de retrodispersion lateral); profundidad de dosis maxima = 3 mm." },
];

// ============================================================================
// TABLA IV - FACTORES DE TRANSMISION DE HAZ ANCHO A 511 keV (plomo, hormigon, hierro)
// ============================================================================

export const FUENTE_TABLA_IV = citaTG108(
  "6-7",
  "Table IV",
  "ALTA",
  "Calculos Monte Carlo (geometria de haz ancho infinito, esquema de reciprocidad) realizados por uno de los autores (D. Simpkin). Hormigon: densidad 2.35 g/cm^3. Espesor de plomo en mm; espesor de hormigon y hierro en cm."
);

export interface TransmisionPET511 {
  espesorPlomoMm: number;
  espesorHormigonCm: number;
  espesorHierroCm: number;
  transmisionPlomo: number;
  transmisionHormigon: number;
  transmisionHierro: number | null;
}

export const TRANSMISION_511KEV_TABLA_IV: TransmisionPET511[] = [
  { espesorPlomoMm: 0, espesorHormigonCm: 0, espesorHierroCm: 0, transmisionPlomo: 1.0, transmisionHormigon: 1.0, transmisionHierro: 1.0 },
  { espesorPlomoMm: 1, espesorHormigonCm: 1, espesorHierroCm: 1, transmisionPlomo: 0.8912, transmisionHormigon: 0.9583, transmisionHierro: 0.7484 },
  { espesorPlomoMm: 2, espesorHormigonCm: 2, espesorHierroCm: 2, transmisionPlomo: 0.7873, transmisionHormigon: 0.9088, transmisionHierro: 0.5325 },
  { espesorPlomoMm: 3, espesorHormigonCm: 3, espesorHierroCm: 3, transmisionPlomo: 0.6905, transmisionHormigon: 0.8519, transmisionHierro: 0.3614 },
  { espesorPlomoMm: 4, espesorHormigonCm: 4, espesorHierroCm: 4, transmisionPlomo: 0.6021, transmisionHormigon: 0.7889, transmisionHierro: 0.2353 },
  { espesorPlomoMm: 5, espesorHormigonCm: 5, espesorHierroCm: 5, transmisionPlomo: 0.5227, transmisionHormigon: 0.7218, transmisionHierro: 0.1479 },
  { espesorPlomoMm: 6, espesorHormigonCm: 6, espesorHierroCm: 6, transmisionPlomo: 0.4522, transmisionHormigon: 0.6528, transmisionHierro: 0.0905 },
  { espesorPlomoMm: 7, espesorHormigonCm: 7, espesorHierroCm: 7, transmisionPlomo: 0.3903, transmisionHormigon: 0.5842, transmisionHierro: 0.0542 },
  { espesorPlomoMm: 8, espesorHormigonCm: 8, espesorHierroCm: 8, transmisionPlomo: 0.3362, transmisionHormigon: 0.5180, transmisionHierro: 0.0319 },
  { espesorPlomoMm: 9, espesorHormigonCm: 9, espesorHierroCm: 9, transmisionPlomo: 0.2892, transmisionHormigon: 0.4558, transmisionHierro: 0.0186 },
  { espesorPlomoMm: 10, espesorHormigonCm: 10, espesorHierroCm: 10, transmisionPlomo: 0.2485, transmisionHormigon: 0.3987, transmisionHierro: 0.0107 },
  { espesorPlomoMm: 12, espesorHormigonCm: 12, espesorHierroCm: 12, transmisionPlomo: 0.1831, transmisionHormigon: 0.3008, transmisionHierro: 0.0035 },
  { espesorPlomoMm: 14, espesorHormigonCm: 14, espesorHierroCm: 14, transmisionPlomo: 0.1347, transmisionHormigon: 0.2243, transmisionHierro: 0.0011 },
  { espesorPlomoMm: 16, espesorHormigonCm: 16, espesorHierroCm: 16, transmisionPlomo: 0.0990, transmisionHormigon: 0.1662, transmisionHierro: 0.0004 },
  { espesorPlomoMm: 18, espesorHormigonCm: 18, espesorHierroCm: 18, transmisionPlomo: 0.0728, transmisionHormigon: 0.1227, transmisionHierro: 0.0001 },
  { espesorPlomoMm: 20, espesorHormigonCm: 20, espesorHierroCm: 20, transmisionPlomo: 0.0535, transmisionHormigon: 0.0904, transmisionHierro: null },
  { espesorPlomoMm: 25, espesorHormigonCm: 25, espesorHierroCm: 25, transmisionPlomo: 0.0247, transmisionHormigon: 0.0419, transmisionHierro: null },
  { espesorPlomoMm: 30, espesorHormigonCm: 30, espesorHierroCm: 30, transmisionPlomo: 0.0114, transmisionHormigon: 0.0194, transmisionHierro: null },
  { espesorPlomoMm: 40, espesorHormigonCm: 40, espesorHierroCm: 40, transmisionPlomo: 0.0024, transmisionHormigon: 0.0042, transmisionHierro: null },
  { espesorPlomoMm: 50, espesorHormigonCm: 50, espesorHierroCm: 50, transmisionPlomo: 0.0005, transmisionHormigon: 0.0009, transmisionHierro: null },
];

// ============================================================================
// TABLA V - PARAMETROS DE AJUSTE AL MODELO DE ARCHER (511 keV)
// ============================================================================
// Modelo: B = [(1+beta/alpha)*exp(alpha*gamma*x) - beta/alpha]^(-1/gamma)
// Invertido: x = (1/(alpha*gamma)) * ln{ [B^(-gamma) + (beta/alpha)] / (1+beta/alpha) }
// (forma citada por el propio TG-108, referenciando a Archer et al.)

export const FUENTE_TABLA_V = citaTG108(
  "7",
  "Table V",
  "MEDIA",
  "ADVERTENCIA DE UNIDAD: el encabezado de la tabla indica 'cm^-1' para alpha y beta en los tres materiales, pero la Tabla IV usa espesor de PLOMO en mm (no cm). No se pudo confirmar sin ambiguedad si alpha/beta de plomo estan realmente en mm^-1 en vez de cm^-1 (posible inconsistencia del documento original o de la extraccion). Los valores numericos se registran tal como aparecen impresos (confianza ALTA en la cifra), pero la unidad exacta para la fila de plomo queda PENDIENTE_DE_VERIFICACION."
);

export interface ArcherFitPET511 {
  material: "plomo" | "hormigon" | "hierro";
  alpha: number;
  beta: number;
  gamma: number;
  unidadAlphaBeta: string;
}

export const ARCHER_FIT_TABLA_V: ArcherFitPET511[] = [
  { material: "plomo", alpha: 1.543, beta: -0.4408, gamma: 2.136, unidadAlphaBeta: "cm^-1 (verificar si es mm^-1, ver nota FUENTE_TABLA_V)" },
  { material: "hormigon", alpha: 0.1539, beta: -0.1161, gamma: 2.0752, unidadAlphaBeta: "cm^-1" },
  { material: "hierro", alpha: 0.5704, beta: -0.3063, gamma: 0.6326, unidadAlphaBeta: "cm^-1" },
];

// ============================================================================
// LIMITES REGULATORIOS USADOS POR TG-108 (10 CFR 20, EE.UU. - marco DISTINTO
// de NCRP147/151 ya usados en este proyecto para otras modalidades)
// ============================================================================

export const FUENTE_LIMITES_REGULATORIOS_TG108 = citaTG108(
  "8",
  "Seccion 'Regulatory limits'",
  "ALTA",
  "10 CFR 20 (Code of Federal Regulations, EE.UU.). Estos valores son especificos de la metodologia TG-108 para PET/PET-CT y no deben combinarse con los P de NCRP147 (diagnostico por imagenes) ni NCRP151 (aceleradores) ya sembrados en este proyecto para otras modalidades."
);

export interface LimiteRegulatorioTG108 {
  codigo: string;
  descripcionEs: string;
  valorAnualMSv?: number;
  valorSemanalUSv?: number;
  valorPorHoraUSv?: number;
}

export const LIMITES_REGULATORIOS_TG108: LimiteRegulatorioTG108[] = [
  { codigo: "PUBLICO_ANUAL", descripcionEs: "Limite de dosis efectiva en areas no controladas (publico)", valorAnualMSv: 1, valorSemanalUSv: 20 },
  { codigo: "PUBLICO_POR_HORA", descripcionEs: "Limite de dosis efectiva en cualquier hora, areas no controladas", valorPorHoraUSv: 20 },
  { codigo: "OCUPACIONAL_LEGAL_ANUAL", descripcionEs: "Limite legal de dosis ocupacional en areas controladas (10 CFR 20)", valorAnualMSv: 50 },
  { codigo: "OCUPACIONAL_ALARA_ANUAL", descripcionEs: "Objetivo de diseno ALARA tipico usado en calculos de blindaje para areas controladas (no es el limite legal, es el nivel de diseno recomendado)", valorAnualMSv: 5, valorSemanalUSv: 100 },
];

// ============================================================================
// GLOSARIO DE PARAMETROS (Tabla VI)
// ============================================================================

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

// ============================================================================
// ECUACIONES DE CALCULO TG-108 (Ecs. 1-12)
// ============================================================================

export const FUENTE_ECUACIONES_TG108 = citaTG108("8-11", "Ecuaciones 1-12", "ALTA");

export interface EcuacionTG108 {
  numero: string;
  nombreEs: string;
  formula: string;
  notas?: string;
}

export const ECUACIONES_TG108: EcuacionTG108[] = [
  { numero: "Eq. 1", nombreEs: "Factor de reduccion por decaimiento radiactivo durante tiempo t", formula: "Rt = 1.443*(T1/2/t)*[1-exp(-0.693*t/T1/2)]", notas: "Para F-18 (T1/2=110 min): Rt=0.91 (t=30 min), 0.83 (t=60 min), 0.76 (t=90 min)." },
  { numero: "Eq. 2", nombreEs: "Dosis total en sala de captacion (uptake) a distancia d de un paciente", formula: "D(tU) = 0.092 uSv*m^2/(MBq*h) * A0[MBq] * tU[h] * RtU / d[m]^2", notas: "0.092 uSv*m^2/(MBq*h) = factor de dosis de paciente recomendado por el Task Group (factor de atenuacion corporal efectivo de 0.36 respecto de la constante de F-18 de 0.143 sin atenuar; 3.4 uSv*m^2/h / 37 MBq)." },
  { numero: "Eq. 3", nombreEs: "Dosis semanal en sala de captacion (Nw pacientes/semana)", formula: "Dsemanal = 0.092 * Nw * A0[MBq] * tU[h] * RtU / d[m]^2" },
  { numero: "Eq. 4", nombreEs: "Factor de transmision requerido, forma general (sala de captacion)", formula: "B = 10.9 * P[uSv] * d[m]^2 / (T * Nw * A0[MBq] * tU[h] * RtU)" },
  { numero: "Eq. 5", nombreEs: "Factor de transmision, area no controlada (P=20 uSv/semana), A0 en MBq", formula: "B = 218 * d^2 / (T * Nw * A0[MBq] * tU * RtU)" },
  { numero: "Eq. 6", nombreEs: "Factor de transmision, area no controlada, A0 en mCi", formula: "B = 5.89 * d^2 / (T * Nw * A0[mCi] * tU * RtU)" },
  { numero: "Eq. 7", nombreEs: "Factor de transmision, area controlada nivel ALARA (P=100 uSv/semana), A0 en MBq", formula: "B = 1090 * d^2 / (T * Nw * A0[MBq] * tU * RtU)" },
  { numero: "Eq. 8", nombreEs: "Factor de transmision, area controlada ALARA, A0 en mCi", formula: "B = 29.5 * d^2 / (T * Nw * A0[mCi] * tU * RtU)" },
  { numero: "Eq. 9", nombreEs: "Dosis semanal en sala de imagen (tomografo)", formula: "Dsemanal = 0.092 * Nw * A0 * 0.85 * FU * tI * RtI / d^2", notas: "El factor 0.85 corrige por el vaciado vesical (~15% de la actividad administrada se excreta antes de la imagen). FU = exp(-0.693*tU/T1/2)." },
  { numero: "Eq. 10", nombreEs: "Factor de transmision requerido, forma general (sala de imagen)", formula: "B = 10.9 * P[uSv] * d^2 / (T * Nw * A0 * 0.85 * FU * tI * RtI)" },
  { numero: "Eq. 11", nombreEs: "Factor de transmision, sala de imagen, area no controlada", formula: "B = 256 * d^2 / (T * Nw * A0 * FU * tI * RtI)" },
  { numero: "Eq. 12", nombreEs: "Factor de transmision, sala de imagen, area controlada ALARA", formula: "B = 1280 * d^2 / (T * Nw * A0 * FU * tI * RtI)" },
];

// ============================================================================
// EJEMPLOS DE CALCULO RESUELTOS (Examples 1-7) - referencia documental
// ============================================================================

export const FUENTE_EJEMPLOS_TG108 = citaTG108("9-15", "Examples 1-7", "ALTA");

export interface EjemploTG108 {
  codigo: string;
  descripcionEs: string;
  resultado: string;
  notas?: string;
}

export const EJEMPLOS_TG108: EjemploTG108[] = [
  {
    codigo: "EJEMPLO_1_SALA_CAPTACION",
    descripcionEs: "Factor de transmision requerido para un area no controlada (T=1) a 4 m del sillon de captacion. A0=555 MBq de F-18 FDG, Nw=40 pacientes/semana, tU=1 h.",
    resultado: "B = 218*(4^2)/(1*40*555*1*0.83) = 0.189. Usando Tabla IV: 1.2 cm de plomo o 15 cm de hormigon.",
  },
  {
    codigo: "EJEMPLO_2_SALA_IMAGEN",
    descripcionEs: "Dosis semanal a 3 m del paciente durante la adquisicion de imagen PET. A0=555 MBq, Nw=40, tU=60 min, tI=30 min.",
    resultado: "Dsemanal = 0.092*40*555*0.85*0.68*0.5*0.91/(3^2) = 59.7 uSv/semana. B = 20/59.7 = 0.34. Usando Tabla IV: 0.8 cm de plomo o 11 cm de hormigon.",
  },
  {
    codigo: "EJEMPLO_3_LAYOUT_COMPLETO",
    descripcionEs: "Diseno completo de una instalacion PET (Fig. 4): 40 pacientes/semana, 555 MBq de F-18 FDG, tU=1 h, tI=30 min. Tabla VII: calculo de dosis semanal y factor de transmision por punto de interes. Tabla VIII: espesor de plomo resultante por pared.",
    resultado: "Ver TABLA_VII_LAYOUT_EJEMPLO_3 y TABLA_VIII_BLINDAJE_EJEMPLO_3 mas abajo para los valores completos por punto de interes.",
  },
  {
    codigo: "EJEMPLO_4_SALA_ARRIBA",
    descripcionEs: "Blindaje requerido para una sala no controlada ARRIBA de la sala de captacion PET. A0=555 MBq, tU=1 h, Nw=40. Distancia entre pisos=4.3 m, losa de 10 cm de hormigon existente.",
    resultado: "d = 4.3-1+0.5 = 3.8 m. Dsemanal = 0.092*40*555*1*0.83/(3.8^2) = 117 uSv/semana. B=20/117=0.17 -> 1.3 cm Pb o 17 cm hormigon requeridos; la losa ya aporta 10 cm hormigon (=0.65 cm Pb equivalente); blindaje ADICIONAL requerido = 0.65 cm Pb o 7 cm hormigon.",
  },
  {
    codigo: "EJEMPLO_5_SALA_ABAJO",
    descripcionEs: "Blindaje requerido para una sala no controlada DEBAJO de la sala de captacion PET. Mismos parametros que Ejemplo 4.",
    resultado: "d = 4.3+1-1.7 = 3.6 m. Dsemanal = 0.092*40*555*1*0.83/(3.6^2) = 131 uSv/semana. B=20/131=0.15 -> 1.3 cm Pb o 17 cm hormigon; blindaje ADICIONAL requerido (tras descontar la losa existente) = 0.65 cm Pb o 7 cm hormigon.",
  },
  {
    codigo: "EJEMPLO_6_DISTANCIA_CONSOLA",
    descripcionEs: "Distancia minima requerida entre la consola de control y el paciente para que la dosis del operador sea menor a 5 mSv/ano (nivel ALARA, P=100 uSv/semana). 40 pacientes/semana, 555 MBq, tU=60 min, tI=30 min.",
    resultado: "d = 2.32 m (usando la ecuacion de dosis semanal con Nw=40, A0=555 MBq, factor 0.85, FU=0.68, tI=0.5 h, RtI=0.91, P=100 uSv).",
  },
  {
    codigo: "EJEMPLO_7_CAMARA_GAMMA_ADYACENTE",
    descripcionEs: "Blindaje requerido en una sala adyacente con una camara gamma (Tc-99m) para reducir la tasa de fondo por radiacion de aniquilacion de 511 keV de 592000 CPM a 1000 CPM.",
    resultado: "B = 1000/592000 = 0.0017. Usando la Fig. 1 (transmision de plomo): 3.9 cm de plomo requeridos.",
  },
];

// ============================================================================
// TABLA VII - EJEMPLO DE LAYOUT COMPLETO (Ejemplo 3, Fig. 4)
// ============================================================================

export const FUENTE_TABLA_VII = citaTG108(
  "11-12",
  "Table VII",
  "ALTA",
  "Calculo basado en: 40 pacientes/semana, 555 MBq por administracion, 1 h de captacion, 30 min de imagen. Los datos de fuente se midieron con las fuentes de transmision internas de la camara, que no aumentan significativamente la exposicion del personal."
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
  { sala: "Pasillo 1", distanciaCaptacionM: 2.5, distanciaTomografoM: 2.5, dosisObjetivoSemanalUSv: 100, factorOcupacion: 0.25, dosisSemanalCaptacionUSv: 277.8, dosisSemanalTomografoUSv: 101, dosisSemanalTotalUSv: 378.8, factorTransmisionRequerido: null, notas: "Factor de ocupacion incluido en el calculo de transmision, no modifica la dosis semanal total mostrada." },
  { sala: "Pasillo 2", distanciaCaptacionM: 9, distanciaTomografoM: 4, dosisObjetivoSemanalUSv: 20, factorOcupacion: 0.25, dosisSemanalCaptacionUSv: 21.6, dosisSemanalTomografoUSv: 39.6, dosisSemanalTotalUSv: 60.2, factorTransmisionRequerido: null },
  { sala: "Sala de control PET", distanciaCaptacionM: 9, distanciaTomografoM: 2.5, dosisObjetivoSemanalUSv: 100, factorOcupacion: 1, dosisSemanalCaptacionUSv: 21.4, dosisSemanalTomografoUSv: 101, dosisSemanalTotalUSv: 122.4, factorTransmisionRequerido: 0.817 },
  { sala: "Camara gamma", distanciaCaptacionM: 3, distanciaTomografoM: 10, dosisObjetivoSemanalUSv: 100, factorOcupacion: 1, dosisSemanalCaptacionUSv: 192.7, dosisSemanalTomografoUSv: 6.3, dosisSemanalTotalUSv: 199, factorTransmisionRequerido: 0.503 },
];

// ============================================================================
// TABLA VIII - ESPESOR DE PLOMO RESULTANTE POR PARED (Ejemplo 3, Fig. 4)
// ============================================================================

export const FUENTE_TABLA_VIII = citaTG108("12", "Table VIII", "ALTA");

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

// ============================================================================
// CONSIDERACIONES DE DISENO ADICIONALES (texto narrativo, no tabular)
// ============================================================================

export const CONSIDERACIONES_DISENO_TG108 = {
  fuente: citaTG108("12-14", "Design considerations / PET-CT installations", "ALTA"),
  puntos: [
    "Para una instalacion PET tipica (555 MBq administrados, 60 min de captacion, 40 pacientes/semana), la distancia requerida para mantener la dosis semanal por debajo de 20 uSv sin blindaje adicional es de 9.3 m.",
    "Losas de piso de 10 cm de hormigon (espesor tipico) proporcionan un factor de reduccion de dosis de 2.5 para radiacion de aniquilacion de 511 keV.",
    "Para instalaciones PET/CT, el componente CT se disena con los mismos criterios que cualquier instalacion de TC diagnostico; el blindaje de plomo tipico de una sala de TC (ej. 1.6 mm Pb) es insuficiente por si solo para los fotones de 511 keV (factor de transmision de solo 0.81), pero una sala ya blindada para el criterio de PET de 1 mSv/ano al publico normalmente NO requiere blindaje adicional por el componente CT salvo en areas controladas a mas de 3 m de la fuente, donde el CT puede pasar a ser el factor limitante.",
    "El tomografo PET puede requerir un nivel de radiacion ambiental menor a 0.1 mR/h para operar correctamente (especificacion de un fabricante), lo cual puede requerir consideracion de blindaje adicional entre salas adyacentes con fuentes radiactivas.",
    "Cámaras de centelleo (gamma) adyacentes a salas PET pueden sufrir incremento significativo de la tasa de fondo por fotones de 511 keV si el detector queda orientado directamente hacia el paciente PET; se recomienda no ubicar camaras SPECT junto a salas de captacion o imagen PET salvo que el detector pueda orientarse de forma que nunca apunte hacia la fuente durante la adquisicion.",
  ],
};
