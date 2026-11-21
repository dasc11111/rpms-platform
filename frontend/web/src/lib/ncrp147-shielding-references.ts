/**
 * REFERENCIAS NORMATIVAS - NCRP Report No. 147
 * "Structural Shielding Design for Medical X-Ray Imaging Facilities"
 * National Council on Radiation Protection and Measurements (NCRP), 2004
 * (Issued November 19, 2004; Revised March 18, 2005)
 *
 * Instruccion del usuario (12/09/2026): "Todo se debe alimentar de NCRP 147
 * o NCRP 151 dependiendo de la practica."
 *
 * ACTUALIZACION (13/09/2026): el usuario precisó la instruccion: "usa la
 * del ncrp 151 como fuente primaria para estos casos [medicina nuclear /
 * PET-PET-CT] y para diagnostico por imagen la ncrp 147." En consecuencia,
 * se revisa el alcance de este archivo:
 * - NCRP 147 (este archivo) es la fuente primaria de T (factor de
 *   ocupacion) y P (objetivo de diseno) EXCLUSIVAMENTE para PRACTICAS DE
 *   IMAGENOLOGIA DIAGNOSTICA CON RAYOS X (radiografia, fluoroscopia,
 *   angiografia, mamografia, CT diagnostico, dental, densitometria osea).
 * - YA NO se usa como fuente "universal" de T para todas las modalidades.
 *   Para MEDICINA NUCLEAR (PET, PET/CT, SPECT, gammacamara) la fuente
 *   primaria de T y P pasa a ser NCRP 151 (ver ncrp151-shielding-references.ts,
 *   creado el 13/09/2026 con la Tabla B.1 y los objetivos P verificados
 *   textualmente).
 * - NCRP 151 tambien se usara para ACELERADORES/RADIOTERAPIA DE
 *   MEGAVOLTAJE (TVL, modelo de barreras, laberintos) cuando se aborde esa
 *   fase; ese contenido especifico (Tablas B.2 en adelante, Capitulo 7)
 *   queda PENDIENTE de extraccion sistematica (ver
 *   NCRP151_TVL_Y_BARRERAS_PENDIENTE en ncrp151-shielding-references.ts).
 *
 * Fuente verificada releyendo el documento "NCRP_Report_147_AAPM.txt" en
 * la carpeta Drive del proyecto el 12/09/2026.
 * Clasificacion: Nivel 2 (organismo cientifico internacional de referencia,
 * co-desarrollado con AAPM). Nivel de confianza: ALTA (texto releido
 * directamente, cifras copiadas tal como aparecen en el documento).
 */

import type { FuenteCita, NivelConfianza } from "./blindaje-calc-engine";

const BASE_FUENTE_NCRP147 = {
      documento: "NCRP Report No. 147: Structural Shielding Design for Medical X-Ray Imaging Facilities",
      autores: "NCRP Scientific Committee 9 (co-desarrollado con AAPM)",
      publicacion: "National Council on Radiation Protection and Measurements, Bethesda, MD",
      anio: 2004,
      nivelJerarquia: "Nivel 2" as const,
};

function citaNCRP147(paginaAprox: string, tablaOSeccion: string, nivelConfianza: NivelConfianza = "ALTA", notas?: string): FuenteCita {
      return { ...BASE_FUENTE_NCRP147, paginaAprox, tablaOEcuacion: tablaOSeccion, nivelConfianza, notas };
}

// ============================================================================
// 1. OBJETIVOS DE DISENO DE BLINDAJE (SHIELDING DESIGN GOALS, P) - Seccion 1.4
// Fuente primaria de P para IMAGENOLOGIA DIAGNOSTICA CON RAYOS X.
// ============================================================================
export interface ObjetivoDisenoP {
      codigo: string;
      areaTipo: "controlada" | "no controlada";
      pMGyAirKermaSemana: number;
      pMGyAirKermaAnual: number;
      descripcion: string;
      fuente: FuenteCita;
}

export const OBJETIVOS_DISENO_P_NCRP147: ObjetivoDisenoP[] = [
    {
            codigo: "NCRP147_CONTROLADA",
            areaTipo: "controlada",
            pMGyAirKermaSemana: 0.1,
            pMGyAirKermaAnual: 5,
            descripcion:
                      "Objetivo de diseno para areas controladas (personal ocupacionalmente expuesto). Fraccion (1/2) del limite de dosis efectiva acumulativa de 10 mSv/ano de NCRP (1993); permite acceso continuo de trabajadoras embarazadas segun el limite mensual de 0.5 mSv al feto.",
            fuente: citaNCRP147("3-4", "Seccion 1.4.1"),
    },
    {
            codigo: "NCRP147_NO_CONTROLADA",
            areaTipo: "no controlada",
            pMGyAirKermaSemana: 0.02,
            pMGyAirKermaAnual: 1,
            descripcion:
                      "Objetivo de diseno para areas no controladas (publico, pacientes, visitantes, personal que no trabaja rutinariamente con radiacion). Basado en el limite de dosis efectiva de 1 mSv en cualquier ano para miembros del publico (ICRP 1991; NCRP 1993).",
            fuente: citaNCRP147("4-5", "Seccion 1.4.2"),
    },
    ];

/**
 * NOTA CRITICA DE UNIDADES: los valores P de NCRP 147 estan en KERMA EN AIRE
 * (mGy/semana), NO en dosis equivalente efectiva (Sv), a diferencia de los
 * valores P de AAPM TG-108 y NCRP 151 (ver ncrp151-shielding-references.ts)
 * que estan en dosis efectiva/equivalente (uSv/semana). Numericamente
 * coinciden en magnitud (0.02 mGy/sem = 20 uGy/sem vs 20 uSv/sem; 0.1
 * mGy/sem = 100 uGy/sem vs 100 uSv/sem) porque todas derivan de las mismas
 * recomendaciones NCRP (1993) de 5 mSv/ano y 1 mSv/ano, pero kerma en aire y
 * dosis efectiva NO son la misma magnitud fisica. Esta equivalencia numerica
 * no debe generalizarse a otras energias o geometrias sin evaluacion experta.
 */
export function advertenciaUnidadesP(): string {
      return "Los P de NCRP 147 son kerma en aire (mGy/semana); los P de AAPM TG-108 y NCRP 151 son dosis efectiva/equivalente (uSv/semana). Coinciden numericamente a 0.02/0.1 mGy=20/100 uGy=20/100 uSv por derivar de los mismos limites NCRP 1993, pero son magnitudes fisicas distintas.";
}

// ============================================================================
// 2. FACTORES DE OCUPACION (T) - Tabla 4.1, Seccion 4.1.3 (pag. 29-31)
// Fuente primaria de T EXCLUSIVAMENTE para IMAGENOLOGIA DIAGNOSTICA CON
// RAYOS X. Para medicina nuclear (PET/PET-CT), ver FACTORES_OCUPACION_NCRP151
// en ncrp151-shielding-references.ts (instruccion del usuario, 13/09/2026).
// ============================================================================

export const FUENTE_TABLA_4_1_OCUPACION = citaNCRP147(
      "29-31",
      "Tabla 4.1 y Seccion 4.1.3",
      "ALTA",
      "T = fraccion promedio de tiempo en que la persona mas expuesta esta presente mientras la fuente esta activa."
    );

export interface FactorOcupacionNCRP147 {
      codigo: string;
      ubicacionEs: string;
      ubicacionOriginalEn: string;
      factorT: number;
      notas?: string;
}

export const FACTORES_OCUPACION_NCRP147: FactorOcupacionNCRP147[] = [
    {
            codigo: "T1_OFICINAS_TRABAJO_CONTINUO",
            ubicacionEs:
                      "Oficinas administrativas o de secretaria; laboratorios, farmacias y otras areas de trabajo ocupadas completamente por una persona; areas de recepcion, salas de espera atendidas, salas de juego infantil techadas, salas de rayos X adyacentes, areas de lectura de peliculas, estaciones de enfermeria, salas de control de rayos X",
            ubicacionOriginalEn:
                      "Administrative or clerical offices; laboratories, pharmacies and other work areas fully occupied by an individual; receptionist areas, attended waiting rooms, children's indoor play areas, adjacent x-ray rooms, film reading areas, nurse's stations, x-ray control rooms",
            factorT: 1,
    },
    {
            codigo: "T2_SALAS_EXAMEN_TRATAMIENTO",
            ubicacionEs: "Salas usadas para examenes y tratamientos de pacientes",
            ubicacionOriginalEn: "Rooms used for patient examinations and treatments",
            factorT: 1 / 2,
    },
    {
            codigo: "T3_PASILLOS_HABITACIONES_EMPLEADOS",
            ubicacionEs: "Pasillos, habitaciones de pacientes, salas de descanso de empleados, banos de personal",
            ubicacionOriginalEn: "Corridors, patient rooms, employee lounges, staff rest rooms",
            factorT: 1 / 5,
    },
    {
            codigo: "T4_PUERTAS_PASILLO",
            ubicacionEs: "Puertas de pasillo",
            ubicacionOriginalEn: "Corridor doors",
            factorT: 1 / 8,
            notas: "El factor de ocupacion justo afuera de una puerta de pasillo puede razonablemente asumirse menor que el del pasillo mismo.",
    },
    {
            codigo: "T5_BANOS_PUBLICOS_AREAS_NO_ATENDIDAS",
            ubicacionEs:
                      "Banos publicos, areas de maquinas expendedoras no atendidas, salas de almacenamiento, areas exteriores con asientos, salas de espera no atendidas, areas de espera de pacientes",
            ubicacionOriginalEn:
                      "Public toilets, unattended vending areas, storage rooms, outdoor areas with seating, unattended waiting rooms, patient holding areas",
            factorT: 1 / 20,
    },
    {
            codigo: "T6_AREAS_EXTERIORES_TRANSITO",
            ubicacionEs:
                      "Areas exteriores con solo transito peatonal o vehicular transitorio, estacionamientos no atendidos, areas de descenso vehicular (no atendidas), aticos, escaleras, ascensores no atendidos, cuartos de aseo",
            ubicacionOriginalEn:
                      "Outdoor areas with only transient pedestrian or vehicular traffic, unattended parking lots, vehicular drop off areas (unattended), attics, stairways, unattended elevators, janitor's closets",
            factorT: 1 / 40,
    },
    ];

export const NOTA_T_AREAS_CONTROLADAS_Y_ADYACENTES_NO_RELACIONADAS = citaNCRP147(
      "31-32",
      "Seccion 4.1.3, parrafos finales",
      "ALTA",
      "Salas de rayos X y cabinas de control (areas controladas) se disenan con T=1. Espacios de oficinas/edificios no relacionados y adyacentes, fuera del control del administrador de la instalacion, deben normalmente considerarse T=1 (totalmente ocupados)."
    );

export function obtenerFactorOcupacionNCRP147(codigo: string): FactorOcupacionNCRP147 | undefined {
      return FACTORES_OCUPACION_NCRP147.find((f) => f.codigo === codigo);
}

// ============================================================================
// 3. NCRP REPORT No. 151 - MEDICINA NUCLEAR Y RADIOTERAPIA DE MEGAVOLTAJE
// ============================================================================
// Implementado el 13/09/2026 en el archivo separado
// ncrp151-shielding-references.ts: contiene FACTORES_OCUPACION_NCRP151
// (Tabla B.1, verificada textualmente) y OBJETIVOS_DISENO_P_NCRP151
// (verificados en ejemplos numericos del Capitulo 7). El contenido
// especifico de aceleradores (TVL de barrera, modelo Bpri/Bw, laberintos)
// permanece pendiente de extraccion sistematica; ver
// NCRP151_TVL_Y_BARRERAS_PENDIENTE en ese mismo archivo.
export const NCRP151_REFERENCIA = {
      estado: "PARCIALMENTE_EXTRAIDO" as const,
      archivo: "ncrp151-shielding-references.ts",
      contenidoDisponible: ["FACTORES_OCUPACION_NCRP151 (Tabla B.1, pag. 160)", "OBJETIVOS_DISENO_P_NCRP151 (ejemplos Cap. 7)"],
      contenidoPendiente: ["TVL de barrera primaria/secundaria por energia y material (Tablas B.2 en adelante)", "Modelo de calculo de barreras y laberintos (Capitulo 2 y 7)"],
};


// ============================================================================
// 4. SELECTOR DE CRITERIO DE DISENO (P) PARA IMAGENOLOGIA DIAGNOSTICA
// ============================================================================
// Decision del usuario (16/09/2026): mantener AMBOS conjuntos de valores de
// criterio de diseno como OPCIONES SELECCIONABLES en la interfaz, en vez de
// que el sistema elija uno solo por su cuenta. Contexto: el documento
// maestro (docs/BLINDAJE_MASTER_MATRICES.md) tenia sembrado un valor de
// "25/2.5 uSv/h" para diagnostico por imagenes que no se pudo verificar
// releyendo el texto de NCRP 147 (paginas 3-5): el texto real establece
// P = 0.1 mGy/semana (5 mGy/ano) controlada y P = 0.02 mGy/semana
// (1 mGy/ano) no controlada, en KERMA EN AIRE (ver OBJETIVOS_DISENO_P_NCRP147
// arriba, y advertenciaUnidadesP()). En vez de descartar el valor
// "25/2.5 uSv/h" (que pudo originarse en otra fuente, guia de fabricante,
// o una simplificacion practica usada previamente en el proyecto), se deja
// disponible como opcion alternativa, marcada con su nivel de confianza
// real y con el motivo de la advertencia, para que el usuario elija en cada
// proyecto cual criterio aplicar. No se fabrica un origen para el valor
// alternativo: su fuente_documento se deja explicitamente como
// "ORIGEN_NO_VERIFICADO".
export type OrigenCriterioDiseno = "NCRP147_VERIFICADO" | "ORIGEN_NO_VERIFICADO";

export interface OpcionCriterioDisenoDiagnostico {
  codigo: string;
  etiquetaEs: string;
  origen: OrigenCriterioDiseno;
  areaControladaValor: number;
  areaNoControladaValor: number;
  unidad: string;
  nivelConfianza: NivelConfianza;
  notas: string;
}

export const OPCIONES_CRITERIO_DISENO_DIAGNOSTICO: OpcionCriterioDisenoDiagnostico[] = [
  {
    codigo: "NCRP147_KERMA_AIRE",
    etiquetaEs: "NCRP 147 (verificado): P = 0,1 / 0,02 mGy·semana⁻¹ (kerma en aire)",
    origen: "NCRP147_VERIFICADO",
    areaControladaValor: 0.1,
    areaNoControladaValor: 0.02,
    unidad: "mGy/semana (kerma en aire)",
    nivelConfianza: "ALTA",
    notas: "Copiado textualmente de NCRP 147, Seccion 1.4.1 (pag. 3-4) y 1.4.2 (pag. 4-5). Equivalente anual: 5 mGy/ano controlada, 1 mGy/ano no controlada.",
  },
  {
    codigo: "LEGADO_25_2_5_USVH",
    etiquetaEs: "Criterio alternativo (origen no verificado): 25 / 2,5 uSv/h",
    origen: "ORIGEN_NO_VERIFICADO",
    areaControladaValor: 25,
    areaNoControladaValor: 2.5,
    unidad: "uSv/h (tasa de dosis)",
    nivelConfianza: "BAJA",
    notas: "Valor sembrado originalmente en docs/BLINDAJE_MASTER_MATRICES.md sin haberse podido localizar en el texto de NCRP 147 tras relectura directa (16/09/2026). Se conserva como opcion seleccionable por decision explicita del usuario, no como valor verificado. Si se identifica su fuente real (otra norma, guia de fabricante, o simplificacion practica), debe actualizarse este registro con la cita correspondiente.",
  },
];

export function obtenerOpcionCriterioDiseno(codigo: string): OpcionCriterioDisenoDiagnostico | undefined {
  return OPCIONES_CRITERIO_DISENO_DIAGNOSTICO.find((o) => o.codigo === codigo);
}


// ============================================================================
// 5. MATERIALES DE BARRERA (Tabla A.1, Apendice A, pag. 118) - lista de
// materiales para los cuales NCRP 147 entrega parametros de ajuste de
// transmision (alfa, beta, gamma) para haces primarios de rayos X: plomo,
// hormigon, tablero de yeso (gypsum wallboard), acero, vidrio plano y
// madera. Fuente primaria EXCLUSIVAMENTE para IMAGENOLOGIA DIAGNOSTICA CON
// RAYOS X (facility_type = diagnostico). No se incluyen los coeficientes
// numericos alfa/beta/gamma (serian necesarios para un motor de calculo
// completo de espesor por kVp, pendiente de una fase posterior); esta lista
// solo identifica los NOMBRES de materiales verificados en la norma, para
// evitar que el campo de material quede en texto libre sin ningun respaldo.
// ============================================================================
export const FUENTE_TABLA_A1_MATERIALES = citaNCRP147(
        "118",
        "Tabla A.1, Apendice A",
        "ALTA",
        "Tabla A.1: 'Fits of transmission for broad primary x-ray beams (for lead, concrete, gypsum wallboard, steel, plate glass, and wood) to Equation A.2'."
      );

export const MATERIALES_BARRERA_NCRP147: string[] = [
        "Plomo",
        "Hormigon",
        "Tablero de yeso (gypsum wallboard)",
        "Acero",
        "Vidrio plano (plate glass)",
        "Madera",
      ];
