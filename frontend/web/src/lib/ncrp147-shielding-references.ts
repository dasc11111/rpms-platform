/**
 * REFERENCIAS NORMATIVAS COMPARTIDAS - NCRP Report No. 147
 * "Structural Shielding Design for Medical X-Ray Imaging Facilities"
 * National Council on Radiation Protection and Measurements (NCRP), 2004
 * (Issued November 19, 2004; Revised March 18, 2005)
 *
 * Instruccion del usuario (12/09/2026): "Todo se debe alimentar de NCRP 147
 * o NCRP 151 dependiendo de la practica." En consecuencia:
 *   - NCRP 147 (este archivo) se usa para PRACTICAS DE IMAGENOLOGIA
 *     DIAGNOSTICA CON RAYOS X (radiografia, fluoroscopia, angiografia,
 *     mamografia, CT, dental, densitometria osea) y, en tanto NCRP 147
 *     es la fuente generica de factores de ocupacion (T) para instalaciones
 *     de salud, tambien se adopta aqui como fuente UNIVERSAL del factor de
 *     ocupacion T para TODAS las modalidades de este sistema (incluida
 *     medicina nuclear / PET), dado que dichos factores dependen del tipo
 *     de area adyacente y no de la modalidad que genera la radiacion.
 *   - NCRP 151 ("Structural Shielding Design and Evaluation for Megavoltage
 *     X-Ray and Gamma-Ray Radiotherapy Facilities") se usara para
 *     ACELERADORES/RADIOTERAPIA DE MEGAVOLTAJE. Ese documento fue
 *     localizado en la carpeta Drive del proyecto (archivos "NCRP REPORT
 *     No.151.txt", "NCRP 151 español.txt", etc.) pero AUN NO ha sido
 *     releido ni extraido textualmente para esta implementacion. NO se
 *     fabrica ningun valor de NCRP 151 en este archivo. Su extraccion e
 *     incorporacion queda PENDIENTE para cuando se aborde la Fase de
 *     aceleradores/radioterapia, respetando el orden de fases del Prompt
 *     Maestro.
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
 * valores P de AAPM TG-108 (blindaje-calc-engine.ts) que ya estan en dosis
 * efectiva (uSv/semana). Numericamente coinciden en magnitud (0.02 mGy/sem
 * = 20 uGy/sem vs 20 uSv/sem; 0.1 mGy/sem = 100 uGy/sem vs 100 uSv/sem)
 * porque ambas fuentes derivan de las mismas recomendaciones NCRP (1993) de
 * 5 mSv/ano y 1 mSv/ano, pero kerma en aire y dosis efectiva NO son la misma
 * magnitud fisica. Esta equivalencia numerica no debe generalizarse a otras
 * energias o geometrias sin evaluacion experta.
 */
export function advertenciaUnidadesP(): string {
    return "Los P de NCRP 147 son kerma en aire (mGy/semana); los P de AAPM TG-108 son dosis efectiva (uSv/semana). Coinciden numericamente a 0.02/0.1 mGy=20/100 uGy=20/100 uSv por derivar de los mismos limites NCRP 1993, pero son magnitudes fisicas distintas.";
}

// ============================================================================
// 2. FACTORES DE OCUPACION (T) - Tabla 4.1, Seccion 4.1.3 (pag. 29-31)
// Fuente generica, independiente de la modalidad que genera la radiacion.
// Se usa como fuente UNIVERSAL de T en todo el sistema (instruccion del
// usuario del 12/09/2026).
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
// 3. NCRP REPORT No. 151 - RADIOTERAPIA DE MEGAVOLTAJE (PENDIENTE)
// ============================================================================
export const NCRP151_PENDIENTE = {
    estado: "PENDIENTE_DE_EXTRACCION" as const,
    documentosLocalizadosEnDrive: [
          "NCRP REPORT No.151.txt",
          "NCRP REPORT No.151 (1).txt",
          "NCRP REPORT No.151 (2).txt",
          "NCRP 151 español.txt",
          "NCRP 151 Structural Shielding Desing.txt",
          "NCRP151 Structural Shielding Desing.txt",
        ],
    advertencia:
          "No usar este objeto como fuente de valores numericos: es un registro de trazabilidad de que el documento existe y esta pendiente de lectura antes de implementar la Fase de aceleradores/radioterapia. NO se ha fabricado ningun valor de NCRP 151.",
};
