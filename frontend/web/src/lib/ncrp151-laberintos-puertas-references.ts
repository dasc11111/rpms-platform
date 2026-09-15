/**
 * REFERENCIAS NORMATIVAS - NCRP Report No. 151
 * "Structural Shielding Design and Evaluation for Megavoltage X- and
 * Gamma-Ray Radiotherapy Facilities"
 * National Council on Radiation Protection and Measurements (NCRP),
 * 31 de diciembre de 2005.
 *
 * ALCANCE DE ESTE ARCHIVO: Ecuaciones y tablas de diseno de PUERTAS Y
 * LABERINTOS (Seccion 2.4, pag. 34-51) y de BARRERAS LAMINADAS (Seccion
 * 2.2.3, pag. 27-31) para salas de aceleradores lineales de radioterapia.
 * Complementa a ncrp151-acelerador-barreras-references.ts (barreras
 * primarias/secundarias "planas" y Tablas B.1-B.9) y a
 * ncrp151-shielding-references.ts (factores T y objetivos P). Tambien
 * incluye la Tabla 2.1 (comparacion medida de tecnicas de blindaje de
 * puerta) y la Tabla 3.1 (distribucion del factor de uso por angulo de
 * portico), de la Seccion 3.1.2.
 *
 * ============================================================================
 * FUENTE Y METODO DE VERIFICACION (anti-fabricacion, S1/S5/S24/S55/S61 del
 * Prompt Maestro)
 * ============================================================================
 * Documento releido directamente en la carpeta Drive del proyecto:
 * "NCRP 151 español.txt" (traduccion automatica de Google, "Machine
 * Translated by Google"). Texto releido integramente en esta sesion
 * (14/09/2026) para la Seccion 2.2.3 (pag. 27-31), Seccion 2.4 (pag.
 * 34-51) y Seccion 3.1.2 (pag. 54-55), con extraccion de texto completa
 * (no solo fragmentos) para minimizar el riesgo de mezclar filas/columnas
 * o perder el contexto de definicion de simbolos.
 *
 * ADVERTENCIA CRITICA SOBRE CORRUPCION DE OCR EN ECUACIONES DE NEUTRONES:
 * La traduccion automatica (Google Translate sobre un PDF escaneado)
 * destruye severamente el formato matematico (exponentes, fracciones,
 * subindices) de varias ecuaciones de neutrones. Criterio explicito
 * aplicado (S1, S5, S55: "NO inventes formulas"):
 *
 * - Ecuaciones cuyos simbolos SI son reconstruibles con confianza
 *   razonable a partir de la definicion textual explicita de cada
 *   variable (aunque el layout visual este roto): SE IMPLEMENTAN como
 *   funcion ejecutable, marcadas nivelConfianza "MEDIA" o "ALTA", con un
 *   comentario que muestra el texto crudo extraido junto a la formula
 *   reconstruida, para que cualquier persona pueda auditar la
 *   reconstruccion.
 * - Ecuaciones cuyo texto crudo contiene fragmentos sin sentido tecnico
 *   (palabras sueltas intercaladas, numeros partidos de forma ambigua,
 *   coeficientes que no se pueden asignar con certeza a un termino
 *   especifico de una suma): NO se implementan como funcion. Se preserva
 *   el texto crudo tal como se extrajo, se documentan las variables que SI
 *   se pudieron identificar con certeza, y se marca el estado como
 *   "PENDIENTE_DE_VERIFICACION" recomendando revision contra el documento
 *   original en ingles por un experto calificado. Las Ecuaciones 2.15, 2.16 y 2.18
 *   (metodo de Kersey) fueron reconstruidas con exito el 14/09/2026 a
 *   partir de una segunda lectura de "NCRP 151 espanol.md" (confianza
 *   MEDIA_ALTA; ver FUENTE_ECUACION_215/216/218 mas abajo). La Ecuacion
 *   2.19 (metodo de Kersey modificado, Wu y McGinley 2003), que
 *   inicialmente quedo PENDIENTE_DE_VERIFICACION por ambiguedad genuina
 *   en sus coeficientes numericos, fue resuelta el 15/09/2026 consultando
 *   directamente el PDF original "NCRP 151 espanol.pdf" (pagina 45/56 del
 *   documento), confirmando que el simbolo ambiguo "re2" corresponde a la
 *   variable "d2" ya definida en la Ecuacion 2.18 (confianza ALTA; ver
 *   FUENTE_ECUACION_219_DOSIS_NEUTRONES_KERSEY_MODIFICADO mas abajo).
 *   Ninguna ecuacion de este archivo permanece en estado
 *   PENDIENTE_DE_VERIFICACION tras esta revision.
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

function citaNCRP151(
  paginaAprox: string,
  tablaOSeccion: string,
  nivelConfianza: NivelConfianza = "ALTA",
  notas?: string
): FuenteCita {
  return { ...BASE_FUENTE_NCRP151, paginaAprox, tablaOEcuacion: tablaOSeccion, nivelConfianza, notas };
}

// ============================================================================
// SECCION 2.2.3 - BARRERAS LAMINADAS (pag. 27-31)
// ============================================================================
// Texto fuente (contexto): se usa cuando la barrera primaria no es
// hormigon homogeneo, sino una combinacion de hormigon con acero o plomo.
// Para energias de aceleracion >10 MV, la lamina metalica puede convertirse
// en fuente de fotoneutrones si el diseno compuesto no se calcula
// correctamente (McGinley et al., 1988; McGinley, 1992a; 1992b).

export const FUENTE_ECUACION_25_BARRERA_LAMINADA = citaNCRP151(
  "30",
  "Seccion 2.2.3, Ecuacion 2.5 (McGinley, 1992a)",
  "MEDIA",
  "Texto crudo extraido (formato matematico danado por la traduccion automatica): " +
    "'t1 – ... – ...t...2... = ...Do... R... Fmax... TVLx 10 TVLn (2.5) hn ...10... t tm 2 2 + + 0,3'. " +
    "Reconstruccion a partir de las definiciones explicitas de variables dadas inmediatamente " +
    "despues de la ecuacion en el texto: Hn = equivalente de dosis de neutrones por semana " +
    "(uSv/semana); Do = dosis de rayos X absorbida por semana en el isocentro (cGy/semana); " +
    "R = coeficiente de produccion de neutrones (uSv cGy-1 m-2); Fmax = area de campo maxima " +
    "en el isocentro (m2); tm = espesor de la losa de metal (m); t1 = espesor de la primera " +
    "losa de concreto (m); t2 = espesor de la segunda losa de concreto (m); TVLx = TVL en " +
    "hormigon para el haz de rayos X primario (m); TVLn = TVL en hormigon para neutrones (m); " +
    "0.3 = distancia de la superficie exterior de la barrera al punto de ocupacion (m). " +
    "Nota al pie 7 del documento: el denominador (tm/2 + t2 + 0.3) se entiende dividido por " +
    "1 m para que quede sin unidades. Formula reconstruida: " +
    "Hn = [Do * R * Fmax / (tm/2 + t2 + 0.3)^2] * 10^(-t1/TVLx) * 10^(-t2/TVLn). " +
    "REQUIERE VERIFICACION de un experto calificado contra el documento original en ingles " +
    "antes de uso clinico, dado el dano de OCR en el layout de la ecuacion original."
);

export interface ParametrosBarreraLaminada {
  doCGySemana: number; // dosis de rayos X absorbida por semana en el isocentro (cGy/semana)
  rMicroSvCGyM2: number; // coeficiente de produccion de neutrones (uSv cGy-1 m-2), Tabla informativa mas abajo
  fMaxM2: number; // area de campo maxima en el isocentro (m2)
  tmM: number; // espesor de la losa de metal (m)
  t1M: number; // espesor de la primera losa de concreto (m)
  t2M: number; // espesor de la segunda losa de concreto (m)
  tvlXM: number; // TVL en hormigon para el haz de rayos X primario (m)
  tvlNM: number; // TVL en hormigon para neutrones (m)
}

/**
 * Ecuacion 2.5 (reconstruida, nivelConfianza MEDIA - ver
 * FUENTE_ECUACION_25_BARRERA_LAMINADA para el texto crudo y el detalle de
 * la reconstruccion). Estima el equivalente de dosis de neutrones por
 * semana (uSv/semana) mas alla de una barrera laminada (metal entre dos
 * losas de hormigon) cuando el colimador esta abierto al tamano maximo.
 */
export function calcularDosisNeutronesBarreraLaminada(p: ParametrosBarreraLaminada): number {
  const denom = p.tmM / 2 + p.t2M + 0.3;
  const factorGeometrico = (p.doCGySemana * p.rMicroSvCGyM2 * p.fMaxM2) / (denom * denom);
  const atenuacionRX = Math.pow(10, -p.t1M / p.tvlXM);
  const atenuacionN = Math.pow(10, -p.t2M / p.tvlNM);
  return factorGeometrico * atenuacionRX * atenuacionN;
}

export const FUENTE_TVLN_HORMIGON_BARRERA_LAMINADA = citaNCRP151(
  "30",
  "Seccion 2.2.3, parrafo y nota al pie 8 tras la Ecuacion 2.5",
  "ALTA",
  "Kase et al. (2003) midieron TVLn = 45 g/cm2 en hormigon ordinario para el espectro de baja " +
    "energia de neutrones producidos por aceleradores medicos (incluye implicitamente la dosis " +
    "equivalente de rayos gamma de captura de neutrones). Con densidad 2.3 g/cm3: 45/2.3 = " +
    "19.6 cm, redondeado a 25 cm como estimacion conservadora y segura, valida tanto para " +
    "hormigon ordinario como pesado (el contenido de hidrogeno no varia significativamente " +
    "entre ambos, Tabla B.3)."
);

export const TVL_NEUTRONES_HORMIGON_BARRERA_LAMINADA_CM = 25;

export interface CoeficienteProduccionNeutronesMcGinley1992 {
  material: "plomo" | "acero";
  energiaMV: number;
  rMicroSvCGyM2: number;
}

export const FUENTE_COEFICIENTES_R_MCGINLEY_1992 = citaNCRP151(
  "30",
  "Seccion 2.2.3, parrafo tras la Ecuacion 2.5 (McGinley, 1992a)",
  "ALTA",
  "Coeficientes R medidos por McGinley (1992a) para aceleradores de 18 MV (plomo y acero) y " +
    "15 MV (plomo)."
);

export const COEFICIENTES_PRODUCCION_NEUTRONES_MCGINLEY_1992: CoeficienteProduccionNeutronesMcGinley1992[] = [
  { material: "plomo", energiaMV: 18, rMicroSvCGyM2: 19 },
  { material: "acero", energiaMV: 18, rMicroSvCGyM2: 1.7 },
  { material: "plomo", energiaMV: 15, rMicroSvCGyM2: 3.5 },
];

export const FUENTE_ECUACION_26_DOSIS_TOTAL_LAMINADA = citaNCRP151(
  "31",
  "Seccion 2.2.3, Ecuacion 2.6",
  "ALTA",
  "Texto fuente: McGinley y Butker (1994) concluyeron, a partir de mediciones con laminados de " +
    "acero y hormigon a 15 y 18 MV, que si el componente de dosis equivalente de rayos X " +
    "transmitidos calculado (Htr) se multiplica por 2.7, se obtiene una estimacion conservadora " +
    "y segura del equivalente de dosis de fotones (Hphtr). Htr se obtiene de la Ecuacion 2.1 " +
    "reemplazando P por Htr. Si HTot > P, el calculo se repite reduciendo Htr hasta lograr el " +
    "objetivo de diseno de blindaje."
);

export interface ResultadoDosisTotalBarreraLaminada {
  hPhtrSvSemana: number;
  hNSvSemana: number;
  hTotSvSemana: number;
}

/**
 * Ecuacion 2.6: dosis equivalente total mas alla de una barrera laminada.
 * HTot = Hphtr + Hn, con Hphtr = 2.7 * Htr.
 * @param htrSvSemana Componente de dosis equivalente de rayos X transmitidos (Sv/semana), de la Ecuacion 2.1.
 * @param hnMicroSvSemana Componente de dosis equivalente de neutrones (uSv/semana), de calcularDosisNeutronesBarreraLaminada.
 */
export function calcularDosisTotalBarreraLaminada(
  htrSvSemana: number,
  hnMicroSvSemana: number
): ResultadoDosisTotalBarreraLaminada {
  const hPhtrSvSemana = 2.7 * htrSvSemana;
  const hNSvSemana = hnMicroSvSemana / 1e6; // conversion explicita uSv -> Sv, S24: nunca ocultar
  return {
    hPhtrSvSemana,
    hNSvSemana,
    hTotSvSemana: hPhtrSvSemana + hNSvSemana,
  };
}

// ============================================================================
// SECCION 2.4 - PUERTAS Y LABERINTOS (pag. 34-51)
// ============================================================================
// El diseno del laberinto se trata en dos apartados: aceleradores de baja
// energia (<=10 MV, Seccion 2.4.1) y de alta energia (>10 MV, Seccion
// 2.4.2), por las diferencias en tipos de radiacion secundaria producida.
// La geometria general (Pared G, Area A0/A1/Az, distancias dh/dr/dz/dzz,
// puntos A/B/C/D del laberinto) se define en la Figura 2.7 (baja energia) y
// Figura 2.8 (alta energia) del documento fuente.

// ----------------------------------------------------------------------------
// 2.4.1 Aceleradores de baja energia (<=10 MV)
// ----------------------------------------------------------------------------

export const FUENTE_ECUACION_29_DISPERSION_PARED_G = citaNCRP151(
  "35-36",
  "Seccion 2.4.1, Ecuacion 2.9 (modificacion de NCRP 1977 por Numark y Kase, 1985)",
  "MEDIA",
  "HS = equivalente de dosis por semana en la puerta del laberinto debido a la dispersion del " +
    "haz principal desde la Pared G. Variables: W = carga de trabajo (Gy/semana); UG = factor " +
    "de uso para la Pared G; alfa0 = coeficiente de reflexion en la primera superficie de " +
    "dispersion A0 (Tablas B.8a-f); A0 = area del haz en la primera superficie de dispersion " +
    "(m2); alfaZ = coeficiente de reflexion para la segunda reflexion (superficie Az, " +
    "tipicamente con energia ficticia de 0.5 MeV); Az = area de la secc. transversal de la " +
    "entrada interior del laberinto proyectada sobre la pared del laberinto (m2); dh = " +
    "distancia perpendicular desde el objetivo hasta la primera superficie de reflexion " +
    "(= dpp + 1 m); dr = distancia desde el centro del haz en el primer reflejo hasta el " +
    "punto b en la linea media del laberinto (m); dz = distancia en linea central a lo largo " +
    "del laberinto desde el punto b hasta la puerta (m). " +
    "Validez segun McGinley (2002): relacion altura/ancho del laberinto entre 1 y 2; " +
    "dz/sqrt(altura*ancho) entre 2 y 6 (concordancia dentro de un factor de 2 aun fuera de " +
    "este rango, para laberintos relativamente cortos)."
);

export interface ParametrosDispersionParedG {
  wGySemana: number;
  uG: number;
  alfa0: number;
  a0M2: number;
  alfaZ: number;
  azM2: number;
  dhM: number;
  drM: number;
  dzM: number;
}

/** Ecuacion 2.9: HS = (W * UG * alfa0 * A0 * alfaZ * Az) / (dh * dr * dz)^2 */
export function calcularDispersionParedGLaberinto(p: ParametrosDispersionParedG): number {
  const numerador = p.wGySemana * p.uG * p.alfa0 * p.a0M2 * p.alfaZ * p.azM2;
  const denominador = Math.pow(p.dhM * p.drM * p.dzM, 2);
  return numerador / denominador;
}

export const FUENTE_ECUACION_210_FUGA_DISPERSA_CABEZA = citaNCRP151(
  "37",
  "Seccion 2.4.1, Ecuacion 2.10 (McGinley y James, 1997)",
  "MEDIA",
  "HLS = equivalente de dosis por semana en la puerta debido a radiacion de fuga en cabeza que " +
    "golpea la Pared G y sufre una sola dispersion. Variables: Lf = relacion de radiacion de " +
    "fuga frontal a 1 m del objetivo (tomada como 1/1000 = 0.1%, IEC 2002); WL = carga de " +
    "trabajo para radiacion de fuga (Gy/semana, puede diferir de W, Seccion 3.2.2); UG = " +
    "factor de uso para la Pared G; alfa1 = coeficiente de reflexion para la dispersion de la " +
    "radiacion de fuga de la Pared G; A1 = area de la Pared G visible desde la puerta del " +
    "laberinto (m2); dsec = distancia desde el objetivo hasta la linea central del laberinto " +
    "en la Pared G (m); dzz = distancia de la linea central a lo largo del laberinto (m). " +
    "Nelson y LaRiviere (1984) basan alfa1 en una energia efectiva de 1.4 MeV para haces de " +
    "6 MV nominal (valores para 6 MV y 15 MV en Tabla B.8a)."
);

export interface ParametrosFugaDispersaCabeza {
  lf?: number; // por defecto 1/1000 (0.1%, IEC 2002)
  wlGySemana: number;
  uG: number;
  alfa1: number;
  a1M2: number;
  dsecM: number;
  dzzM: number;
}

/** Ecuacion 2.10: HLS = (Lf * WL * UG * alfa1 * A1) / (dsec * dzz)^2 */
export function calcularFugaDispersaCabezaLaberinto(p: ParametrosFugaDispersaCabeza): number {
  const lf = p.lf ?? 1 / 1000;
  const numerador = lf * p.wlGySemana * p.uG * p.alfa1 * p.a1M2;
  const denominador = Math.pow(p.dsecM * p.dzzM, 2);
  return numerador / denominador;
}

export const FUENTE_ECUACION_211_DISPERSION_PACIENTE_LABERINTO = citaNCRP151(
  "38",
  "Seccion 2.4.1, Ecuacion 2.11 (McGinley y James, 1997)",
  "MEDIA",
  "Hps = equivalente de dosis por semana en la puerta debido a la radiacion dispersada por el " +
    "paciente. Variables: a(theta) = fraccion de dispersion del paciente en angulo theta " +
    "(Tabla B.4); W = carga de trabajo de la viga principal (Gy/semana); UG = factor de uso " +
    "de la Pared G; F = area de campo a media profundidad del paciente a 1 m (cm2), 400 = " +
    "referencia 20x20 cm; alfa1 = coeficiente de reflexion de la Pared G para la radiacion " +
    "dispersa del paciente; A1 = area de la Pared G visible desde la entrada exterior del " +
    "laberinto (m2); dsca = distancia desde el objetivo hasta el paciente (m); dsec = " +
    "distancia desde el paciente hasta la Pared G en la linea central del laberinto (m); " +
    "dzz = distancia en linea central a lo largo del laberinto desde A1 hasta la puerta (m). " +
    "Cuando la energia de punto final es >10 MV, esta radiacion se ignora habitualmente frente " +
    "a la fuga y los rayos gamma de captura de neutrones (Seccion 2.4.2)."
);

export interface ParametrosDispersionPacienteLaberinto {
  wGySemana: number;
  uG: number;
  aTheta: number; // fraccion de dispersion (Tabla B.4)
  fCm2?: number; // por defecto 400 (20x20 cm a 1 m)
  alfa1: number;
  a1M2: number;
  dscaM: number;
  dsecM: number;
  dzzM: number;
}

/** Ecuacion 2.11: Hps = (W * UG * a(theta) * F/400 * alfa1 * A1) / (dsca * dsec * dzz)^2 */
export function calcularDispersionPacienteLaberinto(p: ParametrosDispersionPacienteLaberinto): number {
  const fCm2 = p.fCm2 ?? 400;
  const numerador = p.wGySemana * p.uG * p.aTheta * (fCm2 / 400) * p.alfa1 * p.a1M2;
  const denominador = Math.pow(p.dscaM * p.dsecM * p.dzzM, 2);
  return numerador / denominador;
}

export const FUENTE_ECUACION_212_FUGA_TRANSMITIDA_LABERINTO = citaNCRP151(
  "38-39",
  "Seccion 2.4.1, Ecuacion 2.12",
  "ALTA",
  "HLT = equivalente de dosis por semana en la puerta debido a radiacion de fuga transmitida " +
    "a traves de la pared interior del laberinto (Pared Z). Lf = 1e-3 (conservador, IEC); " +
    "WL = carga de trabajo para radiacion de fuga (Gy/semana); UG = factor de uso para la " +
    "orientacion del portico G; B = factor de transmision para la Pared Z a lo largo del " +
    "camino oblicuo trazado por dL; dL = distancia desde el objetivo hasta el centro de la " +
    "puerta del laberinto a traves de la pared interior del laberinto (m)."
);

export interface ParametrosFugaTransmitidaLaberinto {
  lf?: number;
  wlGySemana: number;
  uG: number;
  b: number; // factor de transmision de la pared Z en el camino oblicuo dL
  dLM: number;
}

/** Ecuacion 2.12: HLT = (Lf * WL * UG * B) / dL^2 */
export function calcularFugaTransmitidaLaberinto(p: ParametrosFugaTransmitidaLaberinto): number {
  const lf = p.lf ?? 1 / 1000;
  return (lf * p.wlGySemana * p.uG * p.b) / (p.dLM * p.dLM);
}

export const FUENTE_ECUACION_213_DOSIS_TOTAL_PARED_G = citaNCRP151(
  "39",
  "Seccion 2.4.1, Ecuacion 2.13",
  "MEDIA",
  "HG = dosis equivalente total en la puerta del laberinto con el haz dirigido a la Pared G. " +
    "Texto fuente (orden alterado por la traduccion automatica): 'HG f HS HL+S + H+ ps HLT'. " +
    "Reconstruccion a partir del parrafo siguiente, que indica que f (fraccion del haz " +
    "principal transmitido a traves del paciente, ~0.25 para 6-10 MV con campo 40x40 cm2 y " +
    "maniqui 40x40x40 cm3, McGinley y James 1997) se aplica a los componentes que involucran " +
    "el haz dispersado tras atravesar/rodear al paciente antes de llegar a la Pared G (HS y " +
    "HLS): HG = f*(HS + HLS) + Hps + HLT. NOTA: el texto no aisla de forma inequivoca a que " +
    "termino(s) se aplica f; esta reconstruccion es la interpretacion mas consistente con la " +
    "definicion textual de f, pero se recomienda verificacion experta antes de uso clinico."
);

/** Ecuacion 2.13 (reconstruida, ver FUENTE_ECUACION_213_DOSIS_TOTAL_PARED_G). */
export function calcularDosisTotalParedG(
  f: number,
  hs: number,
  hls: number,
  hps: number,
  hlt: number
): number {
  return f * (hs + hls) + hps + hlt;
}

export const FUENTE_ECUACION_214_DOSIS_TOTAL_LABERINTO_BAJA_ENERGIA = citaNCRP151(
  "39",
  "Seccion 2.4.1, Ecuacion 2.14 (McGinley, 2002)",
  "ALTA",
  "Cuando los factores de uso para las 4 direcciones principales del haz (0/90/180/270 grados) " +
    "se toman como un cuarto cada uno, la dosis total equivalente en la puerta del laberinto " +
    "no es simplemente 4*HG, sino que se estima en 2.64*HG (factor de calidad = 1 para " +
    "fotones de aceleradores de baja energia, <=10 MV). Advertencia explicita del documento: " +
    "esta ecuacion debe usarse con precaucion si el diseno de la sala difiere de la Figura 2.7 " +
    "(condiciones de validez: 2 <= dz/sqrt(altura_laberinto * ancho_laberinto) <= 6, y " +
    "1 <= altura_laberinto/ancho_laberinto <= 2), o si la distribucion de factores de uso del " +
    "portico no es aproximadamente uniforme (p. ej., procedimientos de TBI)."
);

export interface ResultadoDosisLaberintoBajaEnergia {
  hTotSvSemana: number;
  advertenciaValidezGeometria?: string;
}

/**
 * Ecuacion 2.14: HTot = 2.64 * HG, con verificacion opcional de las
 * condiciones de validez geometrica indicadas por McGinley (2002) / NCRP (1977).
 */
export function calcularDosisTotalLaberintoBajaEnergia(
  hg: number,
  geometria?: { dzM: number; alturaLaberintoM: number; anchoLaberintoM: number }
): ResultadoDosisLaberintoBajaEnergia {
  const hTotSvSemana = 2.64 * hg;
  if (!geometria) return { hTotSvSemana };
  const { dzM, alturaLaberintoM, anchoLaberintoM } = geometria;
  const relacionAlturaAncho = alturaLaberintoM / anchoLaberintoM;
  const relacionDz = dzM / Math.sqrt(alturaLaberintoM * anchoLaberintoM);
  const advertencias: string[] = [];
  if (relacionAlturaAncho < 1 || relacionAlturaAncho > 2) {
    advertencias.push(
      `relacion altura/ancho del laberinto (${relacionAlturaAncho.toFixed(2)}) fuera del rango [1,2] recomendado por McGinley (2002).`
    );
  }
  if (relacionDz < 2 || relacionDz > 6) {
    advertencias.push(
      `dz / sqrt(altura*ancho) (${relacionDz.toFixed(2)}) fuera del rango [2,6] recomendado por NCRP (1977) / McGinley (2002). El texto fuente indica que la concordancia se mantiene dentro de un factor de 2 para la mayoria de los casos aun fuera de este rango, pero se recomienda verificacion adicional.`
    );
  }
  return {
    hTotSvSemana,
    advertenciaValidezGeometria: advertencias.length > 0 ? advertencias.join(" ") : undefined,
  };
}

// ----------------------------------------------------------------------------
// 2.4.2 Aceleradores de alta energia (>10 MV)
// ----------------------------------------------------------------------------
// Para energias >10 MV se deben considerar ademas los fotoneutrones y los
// rayos gamma de captura de neutrones (energia media 3.6 MeV en hormigon,
// Tochilin y LaRiviere, 1979; puede llegar a 10 MeV en laberintos muy
// cortos, NCRP 1984). Cuando la distancia de A a B (Figura 2.8) es >2.5 m,
// el campo de fotones esta dominado por los rayos gamma de captura y el
// componente de fotones dispersos (Seccion 2.4.1) puede ignorarse.

// ============================================================================
// ECUACIONES 2.15 Y 2.16 - RECONSTRUIDAS (14/09/2026)
// Segunda lectura de "NCRP 151 espanol.md" (carpeta Drive del proyecto),
// que preserva mejor el contexto textual de las variables que la version
// .txt usada en la sesion anterior (misma traduccion automatica de Google
// sobre el mismo PDF escaneado). Se pudo reconstruir ambas ecuaciones con
// confianza MEDIA_ALTA cruzando los fragmentos numericos crudos contra las
// definiciones explicitas de variables en la prosa inmediatamente posterior
// a cada ecuacion (S1, S5, S55, S61 del Prompt Maestro). La incertidumbre
// remanente (orden de los coeficientes 5.4/1.3 en la Ec. 2.16) se documenta
// explicitamente y nunca se oculta (S24).
// ============================================================================
export const FUENTE_ECUACION_215_DOSIS_GAMMA_CAPTURA_H = citaNCRP151(
  "40-41",
  "Seccion 2.4.2.1, Ecuacion 2.15 (McGinley et al., 1995)",
  "MEDIA_ALTA",
  "Reconstruida el 14/09/2026 a partir de una segunda lectura de 'NCRP 151 espanol.md' " +
    "(carpeta Drive del proyecto), que preservo mejor el contexto de variables que la version " +
    ".txt usada previamente. Texto crudo: 're -- ----2---------- h k 10 T VD A (2.15)'. " +
    "Formula reconstruida: h = K * phi_A * 10^(-d2/TVD). K = razon entre la dosis " +
    "equivalente de rayos gamma de captura de neutrones (Sv) y la fluencia total de " +
    "neutrones en la ubicacion A, valor promedio reportado 6.9e-16 Sv*m2 por unidad de " +
    "fluencia de neutrones (mediciones en 22 instalaciones de aceleradores, McGinley, " +
    "comunicacion personal 1998); phi_A = fluencia de neutrones total en A por unidad " +
    "de dosis absorbida (Gy) de rayos X en el isocentro (Ecuacion 2.16); d2 = distancia " +
    "desde A hasta la puerta (m); TVD = distancia de valor decimo, ~5.4 m para haces de " +
    "18 a 25 MV, ~3.9 m para haces de 15 MV. Se eleva de PENDIENTE_DE_VERIFICACION a " +
    "IMPLEMENTADA (confianza MEDIA_ALTA); se recomienda verificacion puntual contra el " +
    "PDF original en ingles por un experto calificado antes de uso clinico critico (S1, " +
    "S5, S55, S61 del Prompt Maestro)."
);

export const NCRP151_K_GAMMA_CAPTURA_SV_M2 = 6.9e-16;
export const NCRP151_TVD_GAMMA_CAPTURA_M = { de18a25MV: 5.4, de15MV: 3.9 };

/**
 * Ecuacion 2.15: dosis equivalente de rayos gamma de captura de neutrones en
 * la puerta del laberinto, por unidad de dosis absorbida (Gy) de rayos X en
 * el isocentro. h = K * phi_A * 10^(-d2/TVD)
 * Nivel de confianza: MEDIA_ALTA (ver FUENTE_ECUACION_215_DOSIS_GAMMA_CAPTURA_H).
 */
export function calcularDosisGammaCapturaEnPuerta(
  kSvM2: number,
  phiA: number,
  d2M: number,
  tvdM: number
): number {
  return kSvM2 * phiA * Math.pow(10, -d2M / tvdM);
}


export const FUENTE_ECUACION_216_FLUENCIA_NEUTRONES_UBICACION_A = citaNCRP151(
  "41-42",
  "Seccion 2.4.2.1, Ecuacion 2.16 (McCall et al., 1999; NCRP, 1984)",
  "MEDIA_ALTA",
  "Reconstruida el 14/09/2026 (misma sesion y fuente que la Ecuacion 2.15). Texto " +
    "crudo: 'beta 5.4 beta = ----qn---- + ----qn--- 1.3 Qn A + ---------------- (2.16) " +
    "4*pi*d1^2 2*pi*Sr 2*pi*Sr'. La prosa inmediatamente posterior identifica " +
    "explicitamente tres terminos (directo, disperso, termico) y confirma que 'el " +
    "factor 1/(2*pi) en los terminos disperso y termico representa la fraccion de " +
    "neutrones que entra al laberinto'. Formula reconstruida: phi_A = Qn * [ " +
    "beta/(4*pi*d1^2) + 5.4/(2*pi*Sr) + 1.3/(2*pi*Sr) ]. ADVERTENCIA (no se oculta, " +
    "S24): no se pudo confirmar con absoluta certeza si el coeficiente 5.4 " +
    "corresponde al termino disperso y 1.3 al termico, o viceversa; el resultado " +
    "numerico de phi_A es identico en ambos casos porque ambos coeficientes dividen " +
    "por el mismo denominador (2*pi*Sr). beta = factor de transmision de neutrones a " +
    "traves del blindaje del cabezal (1 para plomo, 0.85 para tungsteno); d1 = " +
    "distancia desde el isocentro hasta la ubicacion A (m); Qn = fuerza de fuente de " +
    "neutrones (neutrones/Gy de dosis de rayos X en el isocentro, Tabla B.9); Sr = " +
    "superficie total de la sala de tratamiento (m2). Se eleva de " +
    "PENDIENTE_DE_VERIFICACION a IMPLEMENTADA (confianza MEDIA_ALTA); se recomienda " +
    "verificacion puntual contra el PDF original en ingles antes de uso clinico " +
    "critico (S1, S5, S55, S61 del Prompt Maestro)."
);

/**
 * Ecuacion 2.16: fluencia de neutrones total en la ubicacion A del laberinto
 * (entrada del laberinto interior), por unidad de dosis absorbida (Gy) de rayos
 * X en el isocentro.
 * phi_A = Qn * [ beta/(4*pi*d1^2) + 5.4/(2*pi*Sr) + 1.3/(2*pi*Sr) ]
 * Nivel de confianza: MEDIA_ALTA (ver FUENTE_ECUACION_216_FLUENCIA_NEUTRONES_UBICACION_A).
 */
export function calcularFluenciaNeutronesUbicacionA(
  qnNeutronesPorGy: number,
  beta: number,
  d1M: number,
  srM2: number
): number {
  const directo = beta / (4 * Math.PI * d1M * d1M);
  const disperso = 5.4 / (2 * Math.PI * srM2);
  const termico = 1.3 / (2 * Math.PI * srM2);
  return qnNeutronesPorGy * (directo + disperso + termico);
}

export const FUENTE_ECUACION_217_DOSIS_GAMMA_CAPTURA_PUERTA = citaNCRP151(
  "43",
  "Seccion 2.4.2.1, Ecuacion 2.17",
  "ALTA",
  "Hcg = dosis equivalente semanal en la puerta debido a rayos gamma de captura de neutrones " +
    "(Sv/semana) = WL (carga de trabajo de radiacion de fuga, Gy/semana) * h. La Ecuacion " +
    "2.15 (que provee h) fue elevada de PENDIENTE_DE_VERIFICACION a IMPLEMENTADA el " +
    "14/09/2026 (confianza MEDIA_ALTA, ver FUENTE_ECUACION_215_DOSIS_GAMMA_CAPTURA_H y " +
    "calcularDosisGammaCapturaEnPuerta). Esta funcion permite calcular Hcg una vez que " +
    "'h' se obtenga de calcularDosisGammaCapturaEnPuerta, de medicion directa, o de " +
    "software de terceros validado."
);

/** Ecuacion 2.17: Hcg = WL * h. El parametro hSvPorGy debe provenir de una fuente verificada (ver advertencia en FUENTE_ECUACION_217_DOSIS_GAMMA_CAPTURA_PUERTA). */
export function calcularDosisGammaCapturaPuerta(wlGySemana: number, hSvPorGy: number): number {
  return wlGySemana * hSvPorGy;
}

export const NCRP151_TVD_KERSEY_LABERINTO_M = 5;
export const FUENTE_TVD_KERSEY = citaNCRP151(
  "43-44",
  "Seccion 2.4.2.2.1, Metodo de Kersey, parrafo tras la Ecuacion 2.18",
  "ALTA",
  "Para el metodo de Kersey (1979), el laberinto tiene una distancia de valor decimo (TVD) de " +
    "5 m para la atenuacion de neutrones en el laberinto. McGinley y Butker (1991) encontraron " +
    "que la TVD real para los neutrones del laberinto era ~16% menor que 5 m en 13 " +
    "instalaciones evaluadas (aceleradores de 15 a 18 MV); por lo tanto 5 m es un valor " +
    "prudentemente seguro. Tambien encontraron que un segundo giro en el laberinto reduce el " +
    "nivel de neutrones en un factor de al menos 3 respecto del valor de la ecuacion de Kersey."
);

export const FUENTE_ECUACION_220_TVD_LABERINTO = citaNCRP151(
  "45",
  "Seccion 2.4.2.2.2, Ecuacion 2.20 (Wu y McGinley, 2003)",
  "MEDIA",
  "Texto crudo: 'TVD 2=.06 S1 (2.20)'. El parrafo inmediatamente anterior indica " +
    "explicitamente que la TVD 'varia como la raiz cuadrada del area de la seccion transversal " +
    "a lo largo del laberinto S1 (m2)'. Reconstruccion: TVD = 2.06 * sqrt(S1), con TVD en metros."
);

/** Ecuacion 2.20: TVD = 2.06 * sqrt(S1) */
export function calcularTVDLaberintoAltaEnergia(s1M2: number): number {
  return 2.06 * Math.sqrt(s1M2);
}

export const FUENTE_ECUACION_221_DOSIS_NEUTRONES_PUERTA = citaNCRP151(
  "45",
  "Seccion 2.4.2.2.2, Ecuacion 2.21",
  "ALTA",
  "Hn = WL * Hn,D. Hn,D (equivalente de dosis de neutrones en la entrada del laberinto por " +
    "unidad de dosis absorbida de rayos X en el isocentro, Sv/Gy) debe provenir de una fuente " +
    "verificada (Ecuacion 2.18 -Kersey-, o Ecuacion 2.19 -Kersey modificada-, ambas " +
    "ya implementadas con confianza MEDIA_ALTA y ALTA respectivamente (ver " +
    "calcularDosisNeutronesKersey y calcularDosisNeutronesKerseyModificado), o " +
    "de medicion directa)."
);

/** Ecuacion 2.21: Hn = WL * Hn,D. hnDSvPorGy debe provenir de una fuente verificada. */
export function calcularDosisNeutronesPuertaSemanal(wlGySemana: number, hnDSvPorGy: number): number {
  return wlGySemana * hnDSvPorGy;
}

export const FUENTE_ECUACION_222_DOSIS_TOTAL_PUERTA_ALTA_ENERGIA = citaNCRP151(
  "45",
  "Seccion 2.4.2.3, Ecuacion 2.22",
  "ALTA",
  "Hw = HTot (Ecuacion 2.14, fuga y dispersion) + Hcg (Ecuacion 2.17, rayos gamma de captura) " +
    "+ Hn (Ecuacion 2.21, neutrones). El texto fuente indica que para la mayoria de los " +
    "laberintos con energias >10 MV, HTot es un orden de magnitud menor que Hcg + Hn y por lo " +
    "tanto casi siempre insignificante en la practica; sin embargo esta funcion NO omite el " +
    "termino (S24: nunca ocultar un componente de la dosis)."
);

/** Ecuacion 2.22: Hw = HTot + Hcg + Hn */
export function calcularDosisTotalPuertaAltaEnergia(hTotSvSemana: number, hCgSvSemana: number, hNSvSemana: number): number {
  return hTotSvSemana + hCgSvSemana + hNSvSemana;
}

// ============================================================================
// ECUACION 2.18 - RECONSTRUIDA (14/09/2026), misma fuente y sesion que las
// Ecuaciones 2.15 y 2.16. La Ecuacion 2.19 permanece PENDIENTE_DE_VERIFICACION
// (ver detalle enriquecido mas abajo) porque persiste ambiguedad genuina en
// los coeficientes numericos exactos, incluso con la mejor fuente disponible.
// ============================================================================

export const FUENTE_ECUACION_218_KERSEY = citaNCRP151(
  "43-44",
  "Seccion 2.4.2.2.1, Metodo de Kersey (Kersey, 1979), Ecuacion 2.18",
  "MEDIA_ALTA",
  "Reconstruida el 14/09/2026 a partir de una segunda lectura de 'NCRP 151 " +
    "espanol.md'. Texto crudo: 're 2 -- 2 = S0 d0 ---- --- - 5-Hn,D H0 ( ) " +
    "--Sea-sp-1m-tl -ai dc-e -1a t (2.18) o c Edido neo n l 10 d e'. Aunque el " +
    "fragmento central esta danado, los tokens numericos y de variables (S0, d0, " +
    "exponente 2, base 10, TVD=5) coinciden exactamente con las variables " +
    "definidas explicitamente en la prosa: H0 = dosis equivalente de neutrones " +
    "total (directa+dispersa+termica) a d0=1.41 m del objetivo, por unidad de " +
    "dosis absorbida de rayos X en el isocentro (mSv/Gy, Tabla B.9); S0/S1 = " +
    "relacion entre el area de la entrada del laberinto interior y el area de la " +
    "seccion transversal a lo largo del laberinto; d1 = distancia desde el " +
    "isocentro hasta el punto A (donde el isocentro es apenas visible); d2 = " +
    "distancia de A a la puerta (o A a B a C a D si hay multiples giros), en " +
    "metros; TVD = 5 m fijo para este metodo (confirmado explicitamente en el " +
    "texto: 'el laberinto tiene una distancia de valor decimo de 5 m para la " +
    "atenuacion de neutrones', ver NCRP151_TVD_KERSEY_LABERINTO_M). Formula " +
    "reconstruida: Hn,D = H0 * (S0/S1) * (d0/d1)^2 * 10^(-d2/5). McGinley y Butker " +
    "(1991) reportan que la razon [Hn,D calculado]/[Hn,D medido] vario entre 0.82 " +
    "y 2.3 para 13 instalaciones evaluadas (aceleradores de 15 a 18 MV). Se eleva " +
    "de PENDIENTE_DE_VERIFICACION a IMPLEMENTADA (confianza MEDIA_ALTA); se " +
    "recomienda verificacion puntual contra el PDF original en ingles antes de " +
    "uso clinico critico (S1, S5, S55, S61 del Prompt Maestro)."
);

/**
 * Ecuacion 2.18 (Metodo de Kersey, 1979): dosis equivalente de neutrones en
 * la entrada exterior del laberinto (o en la puerta), por unidad de dosis
 * absorbida de rayos X en el isocentro.
 * Hn,D = H0 * (S0/S1) * (d0/d1)^2 * 10^(-d2/5)
 * Nivel de confianza: MEDIA_ALTA (ver FUENTE_ECUACION_218_KERSEY). El TVD de 5 m
 * es fijo para este metodo (NCRP151_TVD_KERSEY_LABERINTO_M).
 */
export function calcularDosisNeutronesKersey(
  h0MSvPorGy: number,
  s0M2: number,
  s1M2: number,
  d0M: number,
  d1M: number,
  d2M: number
): number {
  const tvdM = NCRP151_TVD_KERSEY_LABERINTO_M;
  return h0MSvPorGy * (s0M2 / s1M2) * Math.pow(d0M / d1M, 2) * Math.pow(10, -d2M / tvdM);
}


export const FUENTE_ECUACION_219_DOSIS_NEUTRONES_KERSEY_MODIFICADO = citaNCRP151(
  "45",
  "Seccion 2.4.2.2.2, Metodo de Kersey modificado (Ec. 2.19)",
  "ALTA",
  "Reconstruccion completa lograda el 15/09/2026 mediante lectura directa del PDF " +
    "original 'NCRP 151 espanol.pdf' (pagina 56 del archivo, pagina impresa 45), en " +
    "lugar de la version .md previamente revisada (cuyo OCR fragmentaba la ecuacion en " +
    "una linea desordenada mezclando las Ecuaciones 2.19 a 2.22). El simbolo ambiguo " +
    "detectado en revisiones anteriores ('re' con subindice 2) se identifico con " +
    "certeza como 'd2' (distancia en metros desde el punto A -donde el isocentro " +
    "apenas deja de ser visible- hasta la puerta, pasando por B/C/D segun el numero de " +
    "curvas del laberinto), la misma variable ya definida y utilizada en la Ecuacion " +
    "2.18 (metodo de Kersey, ver calcularDosisNeutronesKersey) en la pagina anterior " +
    "del mismo documento (confirmado visualmente: el parrafo que antecede a la " +
    "Ecuacion 2.19 la describe explicitamente como un refinamiento del analisis de " +
    "datos medidos que produjo la Ecuacion 2.18, reutilizando la misma geometria de la " +
    "Figura 2.8, y la definicion de 'd2' aparece literalmente en el texto de la pagina " +
    "de la Ecuacion 2.18: 'd2 es la distancia en metros de A a B' o, para laberintos " +
    "con dos curvas, 'de A a C mas la longitud de C a D'). Se eleva de " +
    "PENDIENTE_DE_VERIFICACION a IMPLEMENTADA (confianza ALTA); se recomienda de todas " +
    "formas una verificacion puntual contra el documento original en ingles por un " +
    "experto calificado antes de uso clinico critico (S1, S5, S55, S61 del Prompt " +
    "Maestro)."
);

/** Constante empirica de la Ecuacion 2.19 (Sv por neutron por m2). */
export const NCRP151_K_NEUTRONES_KERSEY_MODIFICADO_SV_M2 = 2.4e-15;

/** Coeficiente adimensional del primer termino exponencial de la Ecuacion 2.19. */
export const NCRP151_COEFICIENTE_TERMINO1_KERSEY_MODIFICADO = 1.64;

/**
 * Distancia caracteristica (HVL corto, en metros) del primer termino exponencial de
 * la Ecuacion 2.19, leida directamente del PDF original (pagina 45): "1,9" m.
 */
export const NCRP151_HVL_CORTO_KERSEY_MODIFICADO_M = 1.9;

/**
 * Ecuacion 2.19 (metodo de Kersey modificado, Wu y McGinley 2003):
 * Hn,D = 2.4e-15 * A_phi * sqrt(S0/S1) * (1.64 * 10^(-d2/1.9) + 10^(-d2/TVD))
 * donde TVD se calcula segun la Ecuacion 2.20 (calcularTVDLaberintoAltaEnergia).
 *
 * @param aPhiM2PorGy fluencia de neutrones por unidad de dosis absorbida de fotones
 *   en el isocentro (m-2 Gy-1), segun la Ecuacion 2.16
 * @param s0M2 area de la seccion transversal de la entrada interior del laberinto (m2)
 * @param s1M2 area de la seccion transversal a lo largo del laberinto (m2)
 * @param d2M distancia en metros desde el punto A (donde el isocentro apenas deja de
 *   ser visible) hasta la puerta, medida a lo largo de la linea central del laberinto
 *   (Figura 2.8)
 * @returns Hn,D: equivalente de dosis de neutrones en la entrada del laberinto, en
 *   sievert por unidad de dosis absorbida de rayos X (gray) en el isocentro
 */
export function calcularDosisNeutronesKerseyModificado(
  aPhiM2PorGy: number,
  s0M2: number,
  s1M2: number,
  d2M: number
): number {
  const k = NCRP151_K_NEUTRONES_KERSEY_MODIFICADO_SV_M2;
  const coefTermino1 = NCRP151_COEFICIENTE_TERMINO1_KERSEY_MODIFICADO;
  const hvlCortoM = NCRP151_HVL_CORTO_KERSEY_MODIFICADO_M;
  const tvdM = calcularTVDLaberintoAltaEnergia(s1M2);
  return (
    k *
    aPhiM2PorGy *
    Math.sqrt(s0M2 / s1M2) *
    (coefTermino1 * Math.pow(10, -d2M / hvlCortoM) + Math.pow(10, -d2M / tvdM))
  );
}


// ============================================================================
// TABLA 2.1 (pag. 48) - COMPARACION MEDIDA DE TECNICAS DE BLINDAJE DE PUERTA
// DE LABERINTO (McGinley y Miner, 1995)
// ============================================================================
// Condiciones de medicion: acelerador nominal de 18 MV, longitud de laberinto
// (d2) = 6.5 m, tasa de dosis absorbida de rayos X en el isocentro de
// 6.67e-2 Gy/s (4 Gy/min). Unidades de la tabla: Sv/h por unidad de tasa de
// dosis absorbida (Gy/h) de rayos X en el isocentro (Sv/Gy).
// Nota (a): tasas de dosis equivalente de neutrones medidas con rem-meter
// calibrado con fuente de neutrones de 252Cf moderada por agua pesada.

export const FUENTE_TABLA_21_COMPARACION_PUERTAS = citaNCRP151(
  "48",
  "Tabla 2.1 (McGinley y Miner, 1995)",
  "ALTA",
  "Acelerador nominal 18 MV, longitud de laberinto d2 = 6.5 m, tasa de dosis en isocentro " +
    "6.67e-2 Gy/s (4 Gy/min)."
);

export interface FilaComparacionPuertaLaberinto {
  tipoLaberintoYPuerta: string;
  capturaGammaSvGy: number;
  neutronesSvGy: number;
  totalSvGy: number;
  descripcionTecnica?: string;
}

export const COMPARACION_TECNICAS_PUERTA_LABERINTO_TABLA21: FilaComparacionPuertaLaberinto[] = [
  { tipoLaberintoYPuerta: "Convencional", capturaGammaSvGy: 5.8e-7, neutronesSvGy: 17.4e-7, totalSvGy: 23.3e-7 },
  {
    tipoLaberintoYPuerta: "Apertura interior reducida",
    capturaGammaSvGy: 2.6e-7,
    neutronesSvGy: 5.8e-7,
    totalSvGy: 8.4e-7,
    descripcionTecnica: "Abertura interior del laberinto reducida a (1.22 x 2.13) m2, con hormigon de 45.7 cm de espesor rodeando la abertura.",
  },
  {
    tipoLaberintoYPuerta: "Puerta interior de boro",
    capturaGammaSvGy: 1.9e-7,
    neutronesSvGy: 4.8e-7,
    totalSvGy: 6.7e-7,
    descripcionTecnica: "Panel de 7 mm de espesor con 8.9% en peso de boro (Boraflex) en la entrada interior del laberinto.",
  },
  {
    tipoLaberintoYPuerta: "Puerta interior BPE",
    capturaGammaSvGy: 1.0e-7,
    neutronesSvGy: 1.5e-7,
    totalSvGy: 2.6e-7,
    descripcionTecnica: "Puerta de polietileno de 5 cm de espesor (5% de boro) en la entrada interior del laberinto. Tecnica con mayor reduccion; solo requirio una lamina de plomo relativamente delgada (~1 cm) en la puerta exterior del laberinto.",
  },
];

// ============================================================================
// TABLA 3.1 (pag. 55) - DISTRIBUCION DEL FACTOR DE USO DE ALTA ENERGIA (MODO
// DE RAYOS X DUAL) EN INTERVALOS DE ANGULO DE PORTICO DE 90 Y 45 GRADOS
// ============================================================================
// Fuente de los datos: Rodgers, J.E. (2001), comunicacion personal
// (Universidad de Georgetown, Washington). Nuevo analisis no publicado de
// los datos de la encuesta en Kleck y Elsalim (1994).
// NOTA: se transcriben literalmente los porcentajes del documento. La suma
// de los valores de 90 grados (31.0 + 21.3*2 + 26.3 = 99.9) y de 45 grados
// (25.6 + 5.8*2 + 15.9*2 + 4.0*2 + 23 = 100.0) no da exactamente 100% en el
// caso de 90 grados por redondeo en la fuente original; no se ajusta el
// valor para forzar la suma a 100 (S24: no ocultar ni corregir datos de la
// fuente sin indicarlo explicitamente).

export const FUENTE_TABLA_31_FACTOR_USO_ANGULO = citaNCRP151(
  "55",
  "Tabla 3.1",
  "ALTA",
  "Rodgers, J.E. (2001), comunicacion personal (Universidad de Georgetown, Washington). " +
    "Nuevo analisis no publicado de los datos de encuesta en Kleck y Elsalim (1994). La suma " +
    "de los valores del intervalo de 90 grados en el documento fuente es 99.9% (no 100.0%) " +
    "por redondeo; se preserva tal como aparece en la fuente."
);

export interface FactorUsoAnguloPortico {
  centroIntervaloGrados: number;
  anchoIntervaloGrados: 90 | 45;
  usoPorcentaje: number;
  etiqueta: string;
}

export const FACTOR_USO_ANGULO_PORTICO_TABLA31: FactorUsoAnguloPortico[] = [
  // Intervalo de 90 grados
  { centroIntervaloGrados: 0, anchoIntervaloGrados: 90, usoPorcentaje: 31.0, etiqueta: "0 grados (abajo)" },
  { centroIntervaloGrados: 90, anchoIntervaloGrados: 90, usoPorcentaje: 21.3, etiqueta: "90 grados" },
  { centroIntervaloGrados: 270, anchoIntervaloGrados: 90, usoPorcentaje: 21.3, etiqueta: "270 grados" },
  { centroIntervaloGrados: 180, anchoIntervaloGrados: 90, usoPorcentaje: 26.3, etiqueta: "180 grados (arriba)" },
  // Intervalo de 45 grados
  { centroIntervaloGrados: 0, anchoIntervaloGrados: 45, usoPorcentaje: 25.6, etiqueta: "0 grados (abajo)" },
  { centroIntervaloGrados: 45, anchoIntervaloGrados: 45, usoPorcentaje: 5.8, etiqueta: "45 grados" },
  { centroIntervaloGrados: 315, anchoIntervaloGrados: 45, usoPorcentaje: 5.8, etiqueta: "315 grados" },
  { centroIntervaloGrados: 90, anchoIntervaloGrados: 45, usoPorcentaje: 15.9, etiqueta: "90 grados" },
  { centroIntervaloGrados: 270, anchoIntervaloGrados: 45, usoPorcentaje: 15.9, etiqueta: "270 grados" },
  { centroIntervaloGrados: 135, anchoIntervaloGrados: 45, usoPorcentaje: 4.0, etiqueta: "135 grados" },
  { centroIntervaloGrados: 225, anchoIntervaloGrados: 45, usoPorcentaje: 4.0, etiqueta: "225 grados" },
  { centroIntervaloGrados: 180, anchoIntervaloGrados: 45, usoPorcentaje: 23.0, etiqueta: "180 grados (arriba)" },
];

// ============================================================================
// SECCION 2.4.3 - PROTECCION DE LA PUERTA: TVL DE REFERENCIA PARA EL
// BLINDAJE DE LA PUERTA DEL LABERINTO (pag. 46)
// ============================================================================

export const FUENTE_TVL_PROTECCION_PUERTA = citaNCRP151(
  "46",
  "Seccion 2.4.3",
  "ALTA",
  "Energia promedio de los rayos gamma de captura de neutrones = 3.6 MeV (Tochilin y " +
    "LaRiviere, 1979), puede alcanzar 10 MeV en laberintos muy cortos (NCRP, 1984). Energia " +
    "de neutrones promedio en la entrada del laberinto ~100 keV."
);

export const TVL_PLOMO_GAMMA_CAPTURA_PUERTA_CM = 6.1;
export const TVL_POLIETILENO_NEUTRONES_100KEV_PUERTA_CM = 4.5;
export const TVL_BPE_5PORCIENTO_BORO_NEUTRONES_2MEV_CM = 3.8;
export const TVL_BPE_5PORCIENTO_BORO_NEUTRONES_TERMICOS_CM = 1.2;
export const TVL_BPE_RECOMENDADO_CONSERVADOR_DISENO_PUERTA_CM = 4.5;

// ============================================================================
// SECCION 2.4.4 - DISENOS ALTERNATIVOS DE PUERTAS Y LABERINTOS (pag. 46-48)
// ============================================================================
// El procedimiento estandar para el diseno de puertas de laberintos tipicos
// puede resultar en una puerta pesada y costosa que requiere un abridor
// motorizado. McGinley y Miner (1995) investigaron tres tecnicas para evitar
// que los neutrones salgan de la sala de tratamiento y entren en el
// laberinto, permitiendo reducir o eliminar el blindaje de la puerta.

export const FUENTE_DISENOS_ALTERNATIVOS_PUERTA = citaNCRP151(
  "46-48",
  "Seccion 2.4.4 (McGinley y Miner, 1995)",
  "ALTA",
  "Tres tecnicas para mantener los neutrones fuera del laberinto y asi reducir o " +
    "eliminar el blindaje de la puerta."
);

export type TecnicaAlternativaPuertaLaberinto =
  | "REDUCCION_ABERTURA_INTERIOR"
  | "PUERTA_LIGERA_BORO_TERMICO"
  | "PUERTA_BPE";

export interface DescripcionTecnicaAlternativaPuerta {
  tecnica: TecnicaAlternativaPuertaLaberinto;
  descripcion: string;
}

export const TECNICAS_ALTERNATIVAS_PUERTA_LABERINTO_MCGINLEY_MINER_1995: DescripcionTecnicaAlternativaPuerta[] = [
  {
    tecnica: "REDUCCION_ABERTURA_INTERIOR",
    descripcion:
      "Reducir el area de la abertura en la entrada interior del laberinto. En el estudio " +
      "de referencia, la abertura se redujo a (1.22 x 2.13) m2, con hormigon de 45.7 cm de " +
      "espesor rodeando la abertura (ver tambien COMPARACION_TECNICAS_PUERTA_LABERINTO_TABLA21).",
  },
  {
    tecnica: "PUERTA_LIGERA_BORO_TERMICO",
    descripcion:
      "Anadir una puerta ligera que contenga un absorbedor de neutrones termicos (9% de " +
      "boro en peso) en la entrada interior del laberinto. En el estudio de referencia se " +
      "empleo un panel de 7 mm de espesor con 8.9% en peso de boro (Boraflex(R)).",
  },
  {
    tecnica: "PUERTA_BPE",
    descripcion:
      "Colocar una puerta de BPE (5% de boro) en la entrada interior del laberinto. En el " +
      "estudio de referencia se empleo una puerta de polietileno de 5 cm de espesor (5% de " +
      "boro); esta tecnica produjo la mayor reduccion en la dosis equivalente total y solo " +
      "requirio una lamina de plomo relativamente delgada (~1 cm) en la puerta exterior del " +
      "laberinto.",
  },
];

export const NOTA_EFECTIVIDAD_BPE_VS_POLIETILENO_SIN_BORO =
  "El polietileno borado (BPE, 5% en peso) es solo un poco menos efectivo que el " +
  "polietileno sin boro en el blindaje de neutrones rapidos, pero es mucho mas efectivo " +
  "para los neutrones termicos en comparacion con el polietileno sin boro.";

// ----------------------------------------------------------------------------
// Disposicion recomendada de blindaje de puerta para laberintos largos
// (longitud del orden de 8 m o mas): plomo - BPE - plomo.
// ----------------------------------------------------------------------------

export const FUENTE_DISPOSICION_PLOMO_BPE_PUERTA_LABERINTOS_LARGOS = citaNCRP151(
  "47",
  "Seccion 2.4.4",
  "ALTA",
  "Aplica a salas de acelerador con longitud de laberinto del orden de 8 m o mas."
);

export const ESPESOR_PLOMO_INTERIOR_PUERTA_LABERINTO_LARGO_CM_MIN = 0.6;
export const ESPESOR_PLOMO_INTERIOR_PUERTA_LABERINTO_LARGO_CM_MAX = 1.2;
export const ESPESOR_BPE_PUERTA_LABERINTO_LARGO_CM_MIN = 2;
export const ESPESOR_BPE_PUERTA_LABERINTO_LARGO_CM_MAX = 4;

export const DISPOSICION_CAPAS_PUERTA_LABERINTO_LARGO_SUGERIDA = [
  "plomo (lado de la fuente / interior de la sala)",
  "BPE",
  "plomo (lado exterior, frecuentemente innecesario si el laberinto es largo)",
] as const;

export const NOTA_RAZON_DISPOSICION_PLOMO_BPE_PLOMO =
  "El plomo en el lado de la fuente del BPE reduce la energia de los neutrones por " +
  "dispersion inelastica y, por lo tanto, hace que el BPE sea mas efectivo en el blindaje " +
  "de neutrones. El plomo en el exterior del BPE sirve para atenuar los rayos gamma de " +
  "captura de neutrones del BPE, con una energia de 478 keV. A menudo el plomo exterior no " +
  "sera necesario cuando el laberinto sea lo suficientemente largo para atenuar los " +
  "neutrones lo suficiente antes de que encuentren la puerta (McCall, 1997).";

export const FUENTE_CONFIRMACION_LALONDE_UWAMINO = citaNCRP151(
  "47-48",
  "Seccion 2.4.4",
  "ALTA",
  "Lalonde (1997) y Uwamino et al. (1986): mediciones confirmatorias en la entrada " +
    "exterior del laberinto."
);

export const NOTA_CONFIRMACION_LALONDE_UWAMINO =
  "Lalonde (1997) y Uwamino et al. (1986) llegaron a conclusiones similares a las de " +
  "McGinley y Miner (1995), basadas en mediciones realizadas en la entrada exterior del " +
  "laberinto cuando la entrada interior del laberinto estaba bloqueada con 2.25 cm de " +
  "polietileno mas un panel de boro de 3 mm de espesor (Lalonde, 1997), o con 11.5 cm de " +
  "polietileno (Uwamino et al., 1986). Ademas, Lalonde (1997) informo que revestir las " +
  "paredes del laberinto con un material moderador de neutrones, como el polietileno, era " +
  "menos eficaz en las instalaciones de los aceleradores.";

// ============================================================================
// SECCION 2.4.5 - PUERTA CON BLINDAJE DIRECTO (SIN LABERINTO) (pag. 48-51)
// ============================================================================
// Alternativa al diseno con laberinto: en algunos casos se opta por ahorrar
// el espacio necesario para un laberinto y utilizar una puerta de proteccion
// directa pesada (McGinley, 2001a).

export const FUENTE_PUERTA_BLINDAJE_DIRECTO = citaNCRP151(
  "48",
  "Seccion 2.4.5",
  "ALTA",
  "La puerta con blindaje directo debe tener el mismo valor de blindaje que la barrera " +
    "secundaria adyacente."
);

export const MATERIAL_HABITUAL_PUERTA_BLINDAJE_DIRECTO =
  "La eleccion habitual de materiales de blindaje es un laminado de plomo y acero " +
  "(carcasa de la puerta), con la adicion de BPE si hay fotoneutrones presentes. La " +
  "concentracion de boro en el BPE suele ser del 5% en peso.";

export const PESO_MAXIMO_PRACTICO_PUERTA_BATIENTE_120CM_KG_MIN = 8000;
export const PESO_MAXIMO_PRACTICO_PUERTA_BATIENTE_120CM_KG_MAX = 9000;
export const ANCHO_PUERTA_REFERENCIA_LIMITE_PESO_CM = 120; // 4 pies

export const NOTA_ALTERNATIVA_PUERTA_PESADA =
  "Estas puertas son muy pesadas. La limitacion practica para una puerta de 120 cm " +
  "(4 pies) de ancho esta en el rango de 8000 a 9000 kg para una puerta batiente. Mas " +
  "alla de ese peso, es necesario utilizar dos puertas mas estrechas o una puerta " +
  "corredera. Las puertas corredizas pueden colgarse de un riel o enrollarse sobre un " +
  "soporte de acero en el piso. Esta eleccion es una decision de ingenieria y diferentes " +
  "fabricantes tendran opiniones diferentes. Debido al peso, es imperativo planificar el " +
  "acceso al paciente en caso de falla electrica o del mecanismo de accionamiento (p. ej. " +
  "una escotilla de escape en otra barrera), e instituir programas de mantenimiento " +
  "preventivo e inspeccion periodica (ACR, 2000).";

// ----------------------------------------------------------------------------
// 2.4.5.1 - Problemas de diseno con puertas de blindaje directo (pag. 48-50,
// Figuras 2.9, 2.10 y 2.11)
// ----------------------------------------------------------------------------

export const FUENTE_PROBLEMAS_DISENO_PUERTA_BLINDAJE_DIRECTO = citaNCRP151(
  "48-50",
  "Seccion 2.4.5.1 (Figuras 2.9, 2.10, 2.11)",
  "ALTA",
  "McGinley (2001a) revisa en detalle los problemas practicos de estos enfoques; estas " +
    "puertas solo deben ser disenadas por personal con mucha experiencia."
);

export const NOTA_PROBLEMA_GEOMETRICO_PUERTA_BLINDAJE_DIRECTO =
  "El problema geometrico basico se ilustra en la Figura 2.10: tres rayos de fuga desde " +
  "el isocentro (marcados A, B y C) atraviesan la puerta en distintos angulos y espesores. " +
  "El rayo A atraviesa plomo y BPE de espesor reducido. El rayo B atraviesa hormigon " +
  "reducido (~41 cm / 16 pulgadas) frente al espesor completo de la pared (104 cm / 41 " +
  "pulgadas). El rayo C se encuentra en el punto donde el espesor inclinado del recorrido " +
  "alcanza el espesor total de hormigon de la pared (104 cm). Este es un problema general " +
  "de las puertas con proteccion directa y no se puede resolver unicamente ajustando la " +
  "posicion del plomo y el BPE dentro de la puerta.";

export const NOTA_DISPOSICION_PREFERIDA_CAPAS_PUERTA_BLINDAJE_DIRECTO =
  "La disposicion preferida para el blindaje real de la puerta es con el plomo en el lado " +
  "de la sala del acelerador y el BPE en el exterior.";

export type SolucionProblemaGeometricoPuertaDirecta =
  | "PUERTA_SOLAPADA_CON_PARED_MAS_GRANDE"
  | "TOPE_DE_PUERTA_BLINDADO";

export interface DescripcionSolucionGeometricaPuertaDirecta {
  solucion: SolucionProblemaGeometricoPuertaDirecta;
  descripcion: string;
}

export const SOLUCIONES_PROBLEMA_GEOMETRICO_PUERTA_BLINDAJE_DIRECTO: DescripcionSolucionGeometricaPuertaDirecta[] = [
  {
    solucion: "PUERTA_SOLAPADA_CON_PARED_MAS_GRANDE",
    descripcion:
      "Hacer que la puerta se solape con una pared mucho mas grande. Aumenta " +
      "significativamente los problemas de peso y accionamiento mecanico, asi como el " +
      "tiempo de apertura y los gastos, por lo que es una alternativa menos deseable.",
  },
  {
    solucion: "TOPE_DE_PUERTA_BLINDADO",
    descripcion:
      "Hacer un tope de puerta blindado (jamba blindada), como se muestra en la Figura " +
      "2.11. Puede ser necesario agregar plomo y BPE en la superficie de la pared de " +
      "concreto. Solo es posible proteger el espacio entre la puerta y la pared en el lado " +
      "de la jamba de la puerta, por lo que es importante colocar la puerta de modo que la " +
      "radiacion de fuga directa del acelerador golpee el lado del tope en lugar del lado " +
      "conectado con el operador.",
  },
];

export const NOTA_DESDE_EL_PUNTO_DE_VISTA_DEL_BLINDAJE =
  "Desde el punto de vista del blindaje, ambas soluciones (puerta solapada o tope de " +
  "puerta blindado) son igualmente buenas; la eleccion puede hacerse por motivos " +
  "arquitectonicos o de otro tipo.";

// ----------------------------------------------------------------------------
// 2.4.5.2 - Rayos gamma de captura de neutrones con puertas de blindaje
// directo (pag. 50-51)
// ----------------------------------------------------------------------------

export const FUENTE_CAPTURA_GAMMA_PUERTA_BLINDAJE_DIRECTO = citaNCRP151(
  "50-51",
  "Seccion 2.4.5.2",
  "ALTA",
  "McGinley y Miner (1995): no hay mediciones conocidas de la intensidad de rayos gamma " +
    "de captura de neutrones dentro de una sala de terapia; los calculos son, en el mejor " +
    "de los casos, estimaciones."
);

export const ENERGIA_GAMMA_CAPTURA_BORO_KEV = 480;
export const ESPESOR_PLOMO_ATENUACION_100X_GAMMA_CAPTURA_BORO_CM = 1.9; // 3/4 pulgada

export const NOTA_GAMMA_CAPTURA_BORO_PUERTA_BLINDAJE_DIRECTO =
  "Algunos disenadores agregan plomo en el exterior para atenuar los rayos gamma de " +
  "captura de neutrones del BPE. Los rayos gamma de captura de neutrones del boro tienen " +
  "solo 480 keV, y 1.9 cm (3/4 de pulgada) de plomo reducen su intensidad en mas de un " +
  "factor de 100. El plomo en el interior reduce la energia de los neutrones por " +
  "dispersion inelastica, lo que hace al BPE mas eficaz. Nuevamente, es importante que la " +
  "radiacion de fuga del acelerador golpee la puerta del lado de la jamba en lugar del " +
  "lado del operador, ya que ese es el lado mas facil de proteger.";

export const NOTA_RECOMENDACION_CONSERVADORA_BLINDAJE_GAMMA_CAPTURA =
  "McGinley y Miner (1995) concluyeron que, dado que no hay mediciones conocidas de la " +
  "intensidad de rayos gamma de captura de neutrones dentro de una sala de terapia y los " +
  "calculos son, en el mejor de los casos, estimaciones, un enfoque conservador y seguro " +
  "es calcular el blindaje de la puerta para la radiacion de fuga y luego agregar 1 HVL.";

export const TVL_HORMIGON_GAMMA_CAPTURA_7_2MEV_CM = 38; // ~15 pulgadas
export const ENERGIA_GAMMA_CAPTURA_CONSERVADORA_HORMIGON_MEV = 7.2;

export const NOTA_NO_NECESARIO_PARA_MUROS_SECUNDARIOS_HORMIGON =
  "No es necesario tomar la misma precaucion (agregar 1 HVL) para los muros secundarios " +
  "de hormigon, ya que el blindaje de rayos gamma de captura de neutrones del hormigon " +
  "sera conservadoramente seguro si se supone que todas las capturas de neutrones dan " +
  "como resultado rayos gamma de 7.2 MeV. Esto implica un TVL en hormigon de ~38 cm (15 " +
  "pulgadas), similar al de los rayos X de fuga (Tabla B.7). Por lo tanto, un blindaje " +
  "adecuado para uno producira una barrera adecuada para el otro.";

// ----------------------------------------------------------------------------
// 2.4.5.3 - Diseno de cuarto alternativo para puertas con blindaje directo
// (pag. 51)
// ----------------------------------------------------------------------------

export const FUENTE_DISENO_CUARTO_ALTERNATIVO_PUERTA_DIRECTA = citaNCRP151(
  "51",
  "Seccion 2.4.5.3",
  "ALTA",
  "Barish (2005): metodo de diseno de salas con el portico orientado para reducir el " +
    "grosor de la puerta con blindaje directo."
);

export const NOTA_DISENO_CUARTO_ALTERNATIVO_BARISH_2005 =
  "Barish (2005) describe un metodo de diseno de salas en el que la unidad de terapia se " +
  "coloca con la parte posterior del portico orientada hacia el lado de la puerta de la " +
  "sala. Se construye una pared corta para atenuar el componente de radiacion de fuga de " +
  "la radiacion secundaria que llega a la puerta. Se afirma que este enfoque reduce el " +
  "grosor de la puerta en aproximadamente un 50%, lo que da como resultado reducciones de " +
  "costos significativas, asi como reducciones en la complejidad de la construccion, el " +
  "funcionamiento y el mantenimiento.";
