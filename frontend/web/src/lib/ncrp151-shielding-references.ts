/**
 * REFERENCIAS NORMATIVAS - NCRP Report No. 151
 * "Structural Shielding Design and Evaluation for Megavoltage X- and
 * Gamma-Ray Radiotherapy Facilities"
 * National Council on Radiation Protection and Measurements (NCRP),
 * 31 de diciembre de 2005.
 *
 * Instruccion del usuario (13/09/2026): "usa la del ncrp 151 como fuente
 * primaria para estos casos [medicina nuclear / PET-PET-CT] y para
 * diagnostico por imagen la ncrp 147." Esta instruccion reemplaza la
 * convencion anterior (documentada en ncrp147-shielding-references.ts y en
 * blindaje-calc-engine.ts, Seccion 10), que usaba NCRP 147 como fuente
 * "universal" de T. A partir de esta fecha:
 * - NCRP 151 (este archivo) es la fuente primaria del factor de ocupacion
 *   (T) y del objetivo de diseno de blindaje (P) para MEDICINA NUCLEAR
 *   (PET, PET/CT, SPECT, gammacamara, salas de captacion/espera/inyeccion).
 * - NCRP 147 sigue siendo la fuente primaria de T y P para IMAGENOLOGIA
 *   DIAGNOSTICA CON RAYOS X (radiografia, fluoroscopia, angiografia,
 *   mamografia, CT diagnostico, dental, densitometria osea).
 * - NCRP 151 tambien seguira siendo la fuente para ACELERADORES /
 *   RADIOTERAPIA DE MEGAVOLTAJE (TVL, modelo de barreras, laberintos),
 *   cuando se aborde esa fase; ese contenido (Tablas B.2 en adelante,
 *   Capitulo 7) queda PENDIENTE de extraccion para esta implementacion.
 *
 * ============================================================================
 * FUENTE Y METODO DE VERIFICACION (anti-fabricacion, S61 del Prompt Maestro)
 * ============================================================================
 * Documento releido directamente en la carpeta Drive del proyecto:
 * "NCRP 151 español.txt" (version en espanol, traduccion automatica de
 * Google indicada en el propio documento: "Machine Translated by Google").
 *
 * Hallazgo relevante de esta sesion: en una sesion previa se habia concluido
 * erroneamente que el archivo NCRP151 estaba truncado (terminaba en medio de
 * la Seccion 7.2.5). Se determino en esta sesion que esa conclusion era un
 * artefacto de la carga diferida (lazy-loading) del visor de texto de
 * Google Drive, que solo agrega contenido al DOM a medida que se hace scroll.
 * Se confirmo que el documento esta COMPLETO (~240 paginas) recorriendo
 * manualmente el indice: Apendice A (pag. 158), Apendice B "Datos de apoyo
 * (tablas)" (pag. 160), Apendice C (pag. 175-176), Glosario (pag. 198),
 * Referencias (pag. 210), Indice (pag. 237).
 *
 * Clasificacion: Nivel 2 (organismo cientifico internacional de
 * referencia). Nivel de confianza: ALTA (texto releido directamente,
 * cifras copiadas tal como aparecen en el documento, con pagina/seccion).
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
// 1. FACTORES DE OCUPACION (T) - Tabla B.1, Apendice B (pag. 160)
// ============================================================================
// Texto fuente (traduccion del documento, releido y verificado el
// 13/09/2026): "TABLA B.1-Factores de ocupacion sugeridos (para usar como
// guia en la planificacion del blindaje cuando no se dispone de otras
// fuentes de datos de ocupacion)."
//
// NOTA DE APLICABILIDAD: esta tabla fue redactada originalmente para
// instalaciones de radioterapia de megavoltaje (algunas categorias
// mencionan explicitamente "bovedas de tratamiento"). Por instruccion
// expresa del usuario (13/09/2026), se adopta como fuente primaria del
// factor T tambien para medicina nuclear (PET/PET-CT), en la misma linea
// que el material de curso revisado en esta sesion, que ya usaba esta
// tabla generica adaptandola a la practica de medicina nuclear. Esta
// adaptacion queda documentada explicitamente en la Seccion 3 de este
// archivo (MAPEO_OCUPACION_NCRP151_MEDICINA_NUCLEAR), nunca oculta (S24).

export const FUENTE_TABLA_B1_OCUPACION = citaNCRP151(
    "160",
    "Apendice B, Tabla B.1",
    "ALTA",
    "T = fraccion de tiempo de ocupacion sugerida cuando no se dispone de otra fuente de datos de ocupacion."
  );

export interface FactorOcupacionNCRP151 {
    codigo: string;
    ubicacionEs: string;
    factorT: number;
    notas?: string;
}

export const FACTORES_OCUPACION_NCRP151: FactorOcupacionNCRP151[] = [
  {
        codigo: "T1_OCUPACION_TOTAL",
        ubicacionEs:
                "Areas de ocupacion total (ocupadas a tiempo completo por una persona): oficinas administrativas o de oficina; areas de planificacion de tratamiento; salas de control de tratamiento; estaciones de enfermeria; areas de recepcionista; salas de espera atendidas; espacio ocupado en un edificio cercano",
        factorT: 1,
  },
  {
        codigo: "T2_SALA_TRATAMIENTO_EXAMEN_ADYACENTE",
        ubicacionEs: "Sala de tratamiento adyacente, sala de examen de pacientes adyacente a la boveda blindada",
        factorT: 1 / 2,
        notas:
                "Nota (a) del original: cuando se usa un factor de ocupacion bajo para una habitacion inmediatamente adyacente, debe tenerse cuidado de considerar tambien las areas mas alejadas, que pueden tener un factor mayor y ser mas importantes para el diseno pese a la mayor distancia.",
  },
  {
        codigo: "T3_PASILLOS_SALONES_EMPLEADOS_BANOS_PERSONAL",
        ubicacionEs: "Pasillos, salones para empleados, banos para el personal",
        factorT: 1 / 5,
  },
  {
        codigo: "T4_PUERTAS_BOVEDA_TRATAMIENTO",
        ubicacionEs: "Puertas de boveda de tratamiento",
        factorT: 1 / 8,
        notas:
                "Nota (b) del original: a menudo se puede suponer que el factor de ocupacion para el area justo afuera de la puerta de una boveda de tratamiento es mas bajo que el factor de ocupacion del espacio de trabajo desde el cual se abre.",
  },
  {
        codigo: "T5_BANOS_PUBLICOS_AREAS_NO_ATENDIDAS",
        ubicacionEs:
                "Banos publicos, salas de venta desatendidas, areas de almacenamiento, areas al aire libre con asientos, salas de espera desatendidas, areas de espera de pacientes, aticos, armarios de conserjeria",
        factorT: 1 / 20,
  },
  {
        codigo: "T6_TRANSITO_EXTERIOR_ESTACIONAMIENTOS",
        ubicacionEs:
                "Areas al aire libre con solo transito transitorio de peatones o vehiculos, estacionamientos desatendidos, areas de descenso de vehiculos (desatendidos), escaleras, ascensores desatendidos",
        factorT: 1 / 40,
  },
  ];

export function obtenerFactorOcupacionNCRP151(codigo: string): FactorOcupacionNCRP151 | undefined {
    return FACTORES_OCUPACION_NCRP151.find((f) => f.codigo === codigo);
}

// ============================================================================
// 2. OBJETIVOS DE DISENO DE BLINDAJE (P) - verificados en ejemplos numericos
// del Capitulo 7 (releidos textualmente el 13/09/2026)
// ============================================================================
// Texto fuente (ejemplos numericos, citas literales traducidas):
// - Seccion 7.1.9 (pag. ~125): "...esta area no esta controlada... El
//   objetivo del diseno de blindaje es P = 20 uSv semana-1."
// - Seccion 7.1.8 (pag. ~121): "...es un area controlada con ocupacion
//   total. Los valores de los datos de entrada son: P = 0,1 x 10-3 Sv
//   semana-1" (= 100 uSv/semana).
// - Seccion 7.1.13 (pag. ~137): "...el objetivo del diseno de blindaje es
//   P = 0,1 mSv semana-1" (area controlada, entrada de laberinto).
// Estos valores estan expresados en DOSIS EQUIVALENTE (Sv), a diferencia de
// NCRP 147 (kerma en aire, mGy). Coinciden numericamente con los mismos
// valores de AAPM TG-108 (20 y 100 uSv/semana) porque ambas fuentes derivan
// de los mismos limites NCRP (1993) de 1 y 5 mSv/ano, y ambas los expresan
// ya en dosis equivalente/efectiva.

export const FUENTE_P_NCRP151 = citaNCRP151(
    "121, 125, 137",
    "Ejemplos, Secciones 7.1.8, 7.1.9 y 7.1.13",
    "ALTA",
    "Valores de P declarados explicitamente en los ejemplos numericos del Capitulo 7. No se localizo (en esta sesion) la tabla formal de objetivos de diseno del Capitulo 1/2 del documento; los valores citados aqui provienen de enunciados textuales de ejemplos, no de una tabla resumen. Revisar y completar si se ubica la seccion formal."
  );

export interface ObjetivoDisenoPNCRP151 {
    codigo: string;
    areaTipo: "controlada" | "no controlada";
    pSvSemana: number;
    descripcion: string;
    fuente: FuenteCita;
}

export const OBJETIVOS_DISENO_P_NCRP151: ObjetivoDisenoPNCRP151[] = [
  {
        codigo: "NCRP151_CONTROLADA",
        areaTipo: "controlada",
        pSvSemana: 0.0001, // 0.1 mSv/semana = 100 uSv/semana
        descripcion:
                "Objetivo de diseno para areas controladas (ocupacion total, personal ocupacionalmente expuesto), declarado explicitamente como P = 0,1 mSv/semana (100 uSv/semana) en los ejemplos numericos del Capitulo 7 (Secciones 7.1.8 y 7.1.13).",
        fuente: FUENTE_P_NCRP151,
  },
  {
        codigo: "NCRP151_NO_CONTROLADA",
        areaTipo: "no controlada",
        pSvSemana: 0.00002, // 0.02 mSv/semana = 20 uSv/semana
        descripcion:
                "Objetivo de diseno para areas no controladas (publico, pacientes, personal que no trabaja rutinariamente con radiacion), declarado explicitamente como P = 20 uSv/semana en el ejemplo numerico del Capitulo 7 (Seccion 7.1.9).",
        fuente: FUENTE_P_NCRP151,
  },
  ];

/**
 * NOTA CRITICA DE UNIDADES: los valores P de NCRP 151 citados arriba estan
 * en DOSIS EQUIVALENTE (Sv), igual que AAPM TG-108, a diferencia de NCRP 147
 * (kerma en aire, mGy). Ver advertenciaUnidadesP() en
 * ncrp147-shielding-references.ts para la comparacion completa.
 */
export function advertenciaUnidadesP151(): string {
    return "Los P de NCRP 151 (verificados en ejemplos del Capitulo 7) estan expresados en dosis equivalente (Sv/semana), igual unidad fisica que los P de AAPM TG-108. Difieren de NCRP 147, cuyos P estan en kerma en aire (mGy/semana). Numericamente 0.02/0.1 mSv = 20/100 uSv coincide con NCRP147 y AAPM TG-108 porque las tres fuentes derivan de los mismos limites NCRP (1993) de 1 y 5 mSv/ano.";
}

// ============================================================================
// 3. ADAPTACION DOCUMENTADA: MAPEO DE OCUPACION NCRP151 -> MEDICINA NUCLEAR
// ============================================================================
// La Tabla B.1 de NCRP 151 no fue redactada especificamente para medicina
// nuclear (menciona "bovedas de tratamiento" de radioterapia). El material
// de curso "Diseno de blindaje para una sala PET-CT" (extraido previamente
// de la carpeta Drive del proyecto) adapta esta misma tabla generica a
// ambientes de medicina nuclear. Por instruccion del usuario (13/09/2026),
// se formaliza aqui esa adaptacion como catalogo auxiliar, dejando
// explicito que es una ADAPTACION (no una cita literal de NCRP 151 para
// medicina nuclear) y conservando la trazabilidad al codigo T de origen de
// la Tabla B.1.
export interface MapeoOcupacionMedicinaNuclear {
    ambiente: string;
    codigoOrigenNCRP151: string;
    factorT: number;
    justificacion: string;
}

export const MAPEO_OCUPACION_NCRP151_MEDICINA_NUCLEAR: MapeoOcupacionMedicinaNuclear[] = [
  {
        ambiente: "Consultorio / oficina administrativa",
        codigoOrigenNCRP151: "T1_OCUPACION_TOTAL",
        factorT: 1,
        justificacion: "Ocupacion a tiempo completo por una persona, equivalente a oficina administrativa de la Tabla B.1.",
  },
  {
        ambiente: "Sala de espera de pacientes inyectados / sala de captacion adyacente",
        codigoOrigenNCRP151: "T2_SALA_TRATAMIENTO_EXAMEN_ADYACENTE",
        factorT: 1 / 2,
        justificacion: "Equivalente funcional a 'sala de examen de pacientes adyacente a la boveda blindada' de la Tabla B.1.",
  },
  {
        ambiente: "Pasillo / bano de personal",
        codigoOrigenNCRP151: "T3_PASILLOS_SALONES_EMPLEADOS_BANOS_PERSONAL",
        factorT: 1 / 5,
        justificacion: "Correspondencia directa con la categoria de la Tabla B.1.",
  },
  {
        ambiente: "Puerta de sala de captacion / inyeccion / PET-CT",
        codigoOrigenNCRP151: "T4_PUERTAS_BOVEDA_TRATAMIENTO",
        factorT: 1 / 8,
        justificacion:
                "Adaptacion directa de 'puertas de boveda de tratamiento' a puertas de salas de manejo de fuentes no selladas en medicina nuclear.",
  },
  {
        ambiente: "Bano publico / deposito / transito exterior con asientos",
        codigoOrigenNCRP151: "T5_BANOS_PUBLICOS_AREAS_NO_ATENDIDAS",
        factorT: 1 / 20,
        justificacion: "Correspondencia directa con la categoria de la Tabla B.1.",
  },
  {
        ambiente: "Transito exterior transitorio / estacionamiento desatendido",
        codigoOrigenNCRP151: "T6_TRANSITO_EXTERIOR_ESTACIONAMIENTOS",
        factorT: 1 / 40,
        justificacion: "Correspondencia directa con la categoria de la Tabla B.1.",
  },
  ];

// 4. NCRP 151 PARA ACELERADORES / RADIOTERAPIA DE MEGAVOLTAJE
// ============================================================================
// ACTUALIZACION (13/09/2026): las Tablas B.2 a B.7 (TVL de barrera primaria,
// propiedades de materiales, fraccion de dispersion del paciente, TVL de
// dispersion y de fuga) y las ecuaciones 2.1, 2.2, 2.3, 2.7 y 2.8 del
// Capitulo 2 fueron extraidas y transcritas en un archivo dedicado:
// ./ncrp151-acelerador-barreras-references.ts
// Esto resuelve el placeholder que existia previamente en esta constante.
// Lo que SIGUE pendiente (no incluido en ese archivo): puertas, laberintos y
// neutrones (Seccion 2.4.2 en adelante: metodo de Kersey, rayos gamma de
// captura, Tablas B.8a/b/c de albedo y B.9 de rendimiento de fotoneutrones).
// Ver NCRP151_LABERINTOS_Y_NEUTRONES_PENDIENTE en ese mismo archivo.
export const NCRP151_TVL_Y_BARRERAS_PENDIENTE = {
  estado: "RESUELTO_PARCIALMENTE" as const,
  advertencia:
    "Las Tablas B.2 a B.7 (barreras primaria y secundaria) y las Ecuaciones 2.1, 2.2, 2.3, 2.7 y 2.8 ya fueron extraidas: ver ./ncrp151-acelerador-barreras-references.ts. Lo que sigue pendiente es el diseno de puertas/laberintos y el calculo de neutrones (Seccion 2.4.2 en adelante, Tablas B.8 y B.9), documentado como NCRP151_LABERINTOS_Y_NEUTRONES_PENDIENTE en ese mismo archivo.",
};
