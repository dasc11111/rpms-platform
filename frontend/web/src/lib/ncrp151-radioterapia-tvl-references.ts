/**
 * BLINDAJE - NCRP 151: BLINDAJE DE ACELERADORES LINEALES (RADIOTERAPIA MEGAVOLTAJE)
 *
 * FUENTE PRIMARIA DE ESTE ARCHIVO
 * NCRP Report No. 151, "Structural Shielding Design and Evaluation for
 * Megavoltage X- and Gamma-Ray Radiotherapy Facilities", National Council
 * on Radiation Protection and Measurements (NCRP), 31 de diciembre de 2005.
 * Version traducida (maquina) disponible en la carpeta Drive del proyecto
 * ("NCRP 151 espanol.txt"), releida y re-extraida textualmente el
 * 13/09/2026 exclusivamente para esta implementacion (Secciones 1, 2, 3 y
 * Apendice B, Tablas B.1 a B.9).
 *
 * ADVERTENCIA DE ALCANCE: este archivo corresponde al USO ORIGINAL del
 * documento NCRP 151 (blindaje de aceleradores lineales de megavoltaje,
 * radioterapia externa). Esto es distinto del uso ADAPTADO de NCRP 151
 * para medicina nuclear / PET-CT definido por instruccion explicita del
 * usuario el 13/09/2026 (ver ncrp151-shielding-references.ts). Ambos usos
 * coexisten y deben mantenerse separados.
 *
 * REGLAS ANTI-FABRICACION: todo valor numerico proviene textualmente del
 * documento fuente citado arriba. Cuando el OCR o traduccion automatica
 * del documento fuente presenta ambiguedad (por ejemplo, nombres de
 * modelos comerciales de aceleradores en la Tabla B.9), se deja
 * advertencia explicita en vez de adivinar el valor correcto.
 *
 * Este archivo NO implementa todavia las ecuaciones de laberinto o puerta
 * para neutrones y rayos gamma de captura (Secciones 2.4.2 y siguientes).
 * Esas ecuaciones requieren geometria detallada del laberinto que aun no
 * esta modelada en el wizard. Quedan documentadas como pendientes.
 */

import type { FuenteCita, NivelConfianza } from "./blindaje-calc-engine";

const BASE_FUENTE_NCRP151_RT: Omit<FuenteCita, "paginaAprox" | "tablaOEcuacion" | "notas" | "nivelConfianza"> = {
    documento: "NCRP Report No. 151 - Structural Shielding Design and Evaluation for Megavoltage X- and Gamma-Ray Radiotherapy Facilities",
    autores: "National Council on Radiation Protection and Measurements (NCRP)",
    publicacion: "NCRP, 31 de diciembre de 2005",
    anio: 2005,
    nivelJerarquia: "Nivel 2",
};

function citaNCRP151RT(paginaAprox: string, tablaOEcuacion: string, nivelConfianza: NivelConfianza = "ALTA", notas?: string): FuenteCita {
    return { ...BASE_FUENTE_NCRP151_RT, paginaAprox, tablaOEcuacion, nivelConfianza, notas };
}

// ============================================================================
// TABLA B.1 (pag. 160) - FACTORES DE OCUPACION SUGERIDOS PARA RADIOTERAPIA
// (uso ORIGINAL del documento; no confundir con la adaptacion a medicina
// nuclear de ncrp151-shielding-references.ts)
// ============================================================================

export interface FactorOcupacionNCRP151Radioterapia {
    codigo: string;
    ubicacionEs: string;
    factorT: number;
    notas?: string;
}

export const FUENTE_TABLA_B1_RADIOTERAPIA = citaNCRP151RT("160", "Apendice B, Tabla B.1");

export const FACTORES_OCUPACION_NCRP151_RADIOTERAPIA: FactorOcupacionNCRP151Radioterapia[] = [
  { codigo: "T1_OCUPACION_TOTAL", ubicacionEs: "Areas de ocupacion total: oficinas administrativas, salas de planificacion de tratamiento, salas de control de tratamiento, estaciones de enfermeria, recepcion, salas de espera atendidas, espacio ocupado en edificio cercano", factorT: 1 },
  { codigo: "T2_SALA_ADYACENTE", ubicacionEs: "Sala de tratamiento adyacente, sala de examen de pacientes adyacente a la boveda blindada", factorT: 0.5 },
  { codigo: "T3_PASILLOS_EMPLEADOS", ubicacionEs: "Pasillos, salones para empleados, banos para el personal", factorT: 0.2 },
  { codigo: "T4_PUERTAS_BOVEDA", ubicacionEs: "Puertas de boveda de tratamiento", factorT: 0.125, notas: "El area justo afuera de la puerta puede tener un factor de ocupacion menor que el del espacio de trabajo desde el cual se abre (NCRP151, pag. 160)." },
  { codigo: "T5_BANOS_PUBLICOS", ubicacionEs: "Banos publicos, salas de venta desatendidas, areas de almacenamiento, areas al aire libre con asientos, salas de espera desatendidas, areas de espera de pacientes, aticos, armarios de conserjeria", factorT: 0.05 },
  { codigo: "T6_TRANSITO_EXTERIOR", ubicacionEs: "Areas al aire libre con solo transito transitorio de peatones o vehiculos, estacionamientos desatendidos, areas de descenso de vehiculos desatendidos, escaleras, ascensores desatendidos", factorT: 0.025 },
  ];

// ============================================================================
// TABLA B.2 (pag. 161) - TVL DE BARRERA PRIMARIA
// Hormigon ordinario (2.35 g/cm3), acero (7.87 g/cm3), plomo (11.35 g/cm3).
// Valores en centimetros. TVL1 = primera capa, TVLe = capa de equilibrio.
// ============================================================================

export type MaterialBlindajeNCRP151 = "hormigon" | "acero" | "plomo";

export interface FilaTVLBarreraPrimaria {
    energiaEtiqueta: string;
    material: MaterialBlindajeNCRP151;
    tvl1Cm: number;
    tvlECm: number;
}

export const FUENTE_TABLA_B2 = citaNCRP151RT("161", "Apendice B, Tabla B.2", "ALTA", "Valores de hormigon adaptados de Nelson y LaRiviere (1984) con extrapolacion a 4 MV y Kirn y Kennedy (1954) para 30 MV. TVL de plomo y acero adaptados del Informe NCRP No. 49 y Wachsmann y Drexler (1975).");

export const TVL_BARRERA_PRIMARIA_NCRP151: FilaTVLBarreraPrimaria[] = [
  { energiaEtiqueta: "4MV", material: "hormigon", tvl1Cm: 35, tvlECm: 30 },
  { energiaEtiqueta: "4MV", material: "acero", tvl1Cm: 9.9, tvlECm: 9.9 },
  { energiaEtiqueta: "4MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "6MV", material: "hormigon", tvl1Cm: 37, tvlECm: 33 },
  { energiaEtiqueta: "6MV", material: "acero", tvl1Cm: 10, tvlECm: 10 },
  { energiaEtiqueta: "6MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "10MV", material: "hormigon", tvl1Cm: 41, tvlECm: 37 },
  { energiaEtiqueta: "10MV", material: "acero", tvl1Cm: 11, tvlECm: 11 },
  { energiaEtiqueta: "10MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "15MV", material: "hormigon", tvl1Cm: 44, tvlECm: 41 },
  { energiaEtiqueta: "15MV", material: "acero", tvl1Cm: 11, tvlECm: 11 },
  { energiaEtiqueta: "15MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "18MV", material: "hormigon", tvl1Cm: 45, tvlECm: 43 },
  { energiaEtiqueta: "18MV", material: "acero", tvl1Cm: 11, tvlECm: 11 },
  { energiaEtiqueta: "18MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "20MV", material: "hormigon", tvl1Cm: 46, tvlECm: 44 },
  { energiaEtiqueta: "20MV", material: "acero", tvl1Cm: 11, tvlECm: 11 },
  { energiaEtiqueta: "20MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "25MV", material: "hormigon", tvl1Cm: 49, tvlECm: 46 },
  { energiaEtiqueta: "25MV", material: "acero", tvl1Cm: 11, tvlECm: 11 },
  { energiaEtiqueta: "25MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "30MV", material: "hormigon", tvl1Cm: 51, tvlECm: 49 },
  { energiaEtiqueta: "30MV", material: "acero", tvl1Cm: 11, tvlECm: 11 },
  { energiaEtiqueta: "30MV", material: "plomo", tvl1Cm: 5.7, tvlECm: 5.7 },
  { energiaEtiqueta: "Co-60", material: "hormigon", tvl1Cm: 21, tvlECm: 21 },
  { energiaEtiqueta: "Co-60", material: "acero", tvl1Cm: 7.0, tvlECm: 7.0 },
  { energiaEtiqueta: "Co-60", material: "plomo", tvl1Cm: 4.0, tvlECm: 4.0 },
  ];

// ============================================================================
// TABLA B.3 (pag. 162) - PROPIEDADES DE MATERIALES DE BLINDAJE
// (adaptado de Profio, 1979)
// ============================================================================

export interface PropiedadMaterialNCRP151 {
    material: string;
    densidadGCm3Texto: string;
    numeroAtomicoEfectivo: string;
    activacionNeutronesTermicos: string;
    costoRelativo: string;
}

export const FUENTE_TABLA_B3 = citaNCRP151RT("162", "Apendice B, Tabla B.3");

export const PROPIEDADES_MATERIALES_NCRP151: PropiedadMaterialNCRP151[] = [
  { material: "Hormigon ordinario", densidadGCm3Texto: "2.2 - 2.4", numeroAtomicoEfectivo: "11", activacionNeutronesTermicos: "Pequena", costoRelativo: "$$" },
  { material: "Hormigon pesado", densidadGCm3Texto: "3.7 - 4.8", numeroAtomicoEfectivo: "~26", activacionNeutronesTermicos: "Variable (depende de aditivos)", costoRelativo: "$$$$" },
  { material: "Plomo", densidadGCm3Texto: "11.35", numeroAtomicoEfectivo: "82", activacionNeutronesTermicos: "Depende de impurezas", costoRelativo: "$$$" },
  { material: "Acero (hierro)", densidadGCm3Texto: "7.87", numeroAtomicoEfectivo: "26", activacionNeutronesTermicos: "Moderado", costoRelativo: "$$" },
  { material: "Polietileno", densidadGCm3Texto: "0.95", numeroAtomicoEfectivo: "5.5", activacionNeutronesTermicos: "Nulo", costoRelativo: "$$$" },
  ];

export const CONCENTRACION_HIDROGENO_HORMIGON_ATOMOS_CM3_X1E22 = { min: 0.8, max: 2.4 };
export const CONCENTRACION_HIDROGENO_POLIETILENO_ATOMOS_CM3_X1E22 = 8;

// ============================================================================
// TABLA B.4 (pag. 163) - FRACCIONES DE DISPERSION a(theta) A 1 m DE UN
// MANIQUI DE TAMANO HUMANO, distancia objetivo-maniqui 1 m, campo 400 cm2.
// (McGinley, 2002; Taylor et al., 1999)
// ============================================================================

export interface FilaFraccionDispersion {
    anguloGrados: number;
    a6MV: number;
    a10MV: number;
    a18MV: number;
    a24MV: number;
}

export const FUENTE_TABLA_B4 = citaNCRP151RT("163", "Apendice B, Tabla B.4");

export const FRACCIONES_DISPERSION_PACIENTE_NCRP151: FilaFraccionDispersion[] = [
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
// TABLA B.5a (pag. 164) - TVL EN HORMIGON (cm) PARA RADIACION DISPERSADA
// POR EL PACIENTE, EN FUNCION DEL ANGULO DE DISPERSION Y LA ENERGIA.
// Basado en Figuras 10 y 15 del Informe NCRP No. 49 y Abrath et al. (1983).
// ============================================================================

export interface FilaTVLDispersionHormigon {
    anguloGrados: number;
    co60: number;
    mv4: number;
    mv6: number;
    mv10: number;
    mv15: number;
    mv18: number;
    mv20: number;
    mv24: number;
}

export const FUENTE_TABLA_B5A = citaNCRP151RT("164", "Apendice B, Tabla B.5a");

export const TVL_DISPERSION_HORMIGON_NCRP151: FilaTVLDispersionHormigon[] = [
  { anguloGrados: 15, co60: 22, mv4: 30, mv6: 34, mv10: 39, mv15: 42, mv18: 44, mv20: 46, mv24: 49 },
  { anguloGrados: 30, co60: 21, mv4: 25, mv6: 26, mv10: 28, mv15: 31, mv18: 32, mv20: 33, mv24: 36 },
  { anguloGrados: 45, co60: 20, mv4: 22, mv6: 23, mv10: 25, mv15: 26, mv18: 27, mv20: 27, mv24: 29 },
  { anguloGrados: 60, co60: 19, mv4: 21, mv6: 21, mv10: 22, mv15: 23, mv18: 23, mv20: 24, mv24: 24 },
  { anguloGrados: 90, co60: 15, mv4: 17, mv6: 17, mv10: 18, mv15: 18, mv18: 19, mv20: 19, mv24: 19 },
  { anguloGrados: 135, co60: 13, mv4: 14, mv6: 15, mv10: 15, mv15: 15, mv18: 15, mv20: 15, mv24: 16 },
  ];

// ============================================================================
// TABLA B.5b (pag. 165) - TVL1/TVL2 EN PLOMO (cm) PARA RADIACION DISPERSADA
// POR EL PACIENTE (basado en Nogueira y Biggs, 2002; actualizado por
// Biggs, 2005, comunicacion personal).
// ============================================================================

export interface FilaTVLDispersionPlomo {
    anguloGrados: number;
    tvl1_4MV: number;
    tvl2_4MV: number;
    tvl1_6MV: number;
    tvl2_6MV: number;
    tvl1_10MV: number;
    tvl2_10MV: number;
}

export const FUENTE_TABLA_B5B = citaNCRP151RT("165", "Apendice B, Tabla B.5b");

export const TVL_DISPERSION_PLOMO_NCRP151: FilaTVLDispersionPlomo[] = [
  { anguloGrados: 30, tvl1_4MV: 3.3, tvl2_4MV: 3.7, tvl1_6MV: 3.8, tvl2_6MV: 4.4, tvl1_10MV: 4.3, tvl2_10MV: 4.5 },
  { anguloGrados: 45, tvl1_4MV: 2.4, tvl2_4MV: 3.1, tvl1_6MV: 2.8, tvl2_6MV: 3.4, tvl1_10MV: 3.1, tvl2_10MV: 3.6 },
  { anguloGrados: 60, tvl1_4MV: 1.8, tvl2_4MV: 2.5, tvl1_6MV: 1.9, tvl2_6MV: 2.6, tvl1_10MV: 2.1, tvl2_10MV: 2.7 },
  { anguloGrados: 75, tvl1_4MV: 1.3, tvl2_4MV: 1.9, tvl1_6MV: 1.4, tvl2_6MV: 1.9, tvl1_10MV: 1.5, tvl2_10MV: 1.9 },
  { anguloGrados: 90, tvl1_4MV: 0.9, tvl2_4MV: 1.3, tvl1_6MV: 1.0, tvl2_6MV: 1.5, tvl1_10MV: 1.2, tvl2_10MV: 1.6 },
  { anguloGrados: 105, tvl1_4MV: 0.7, tvl2_4MV: 1.2, tvl1_6MV: 0.7, tvl2_6MV: 1.2, tvl1_10MV: 0.95, tvl2_10MV: 1.4 },
  { anguloGrados: 120, tvl1_4MV: 0.5, tvl2_4MV: 0.8, tvl1_6MV: 0.5, tvl2_6MV: 0.8, tvl1_10MV: 0.8, tvl2_10MV: 1.4 },
  ];

// ============================================================================
// TABLA B.6 (pag. 166) - ENERGIA MEDIA (MeV) DE LA RADIACION DISPERSADA POR
// EL PACIENTE EN FUNCION DEL ANGULO DE DISPERSION Y LA ENERGIA DE PUNTO FINAL
// (adaptado por McGinley, 2002, de Taylor et al., 1999)
// ============================================================================

export interface FilaEnergiaMediaDispersion {
    energiaPuntoFinalMV: number;
    porAngulo: { angulo0: number; angulo10: number; angulo20: number; angulo30: number; angulo40: number; angulo50: number; angulo70: number; angulo90: number };
}

export const FUENTE_TABLA_B6 = citaNCRP151RT("166", "Apendice B, Tabla B.6");

export const ENERGIA_MEDIA_DISPERSION_NCRP151: FilaEnergiaMediaDispersion[] = [
  { energiaPuntoFinalMV: 6, porAngulo: { angulo0: 1.6, angulo10: 1.4, angulo20: 1.2, angulo30: 0.9, angulo40: 0.7, angulo50: 0.5, angulo70: 0.4, angulo90: 0.2 } },
  { energiaPuntoFinalMV: 10, porAngulo: { angulo0: 2.7, angulo10: 2.0, angulo20: 1.3, angulo30: 1.0, angulo40: 0.7, angulo50: 0.5, angulo70: 0.4, angulo90: 0.2 } },
  { energiaPuntoFinalMV: 18, porAngulo: { angulo0: 5.0, angulo10: 3.2, angulo20: 2.1, angulo30: 1.3, angulo40: 0.9, angulo50: 0.6, angulo70: 0.4, angulo90: 0.3 } },
  { energiaPuntoFinalMV: 24, porAngulo: { angulo0: 5.6, angulo10: 3.9, angulo20: 2.7, angulo30: 1.7, angulo40: 1.1, angulo50: 0.8, angulo70: 0.5, angulo90: 0.3 } },
  ];

// ============================================================================
// TABLA B.7 (pag. 167) - TVL PARA RADIACION DE FUGA EN HORMIGON ORDINARIO
// ============================================================================

export interface FilaTVLFuga {
    energiaEtiqueta: string;
    tvl1Cm: number;
    tvlECm: number;
}

export const FUENTE_TABLA_B7 = citaNCRP151RT("167", "Apendice B, Tabla B.7");

export const TVL_FUGA_HORMIGON_NCRP151: FilaTVLFuga[] = [
  { energiaEtiqueta: "4MV", tvl1Cm: 33, tvlECm: 28 },
  { energiaEtiqueta: "6MV", tvl1Cm: 34, tvlECm: 29 },
  { energiaEtiqueta: "10MV", tvl1Cm: 35, tvlECm: 31 },
  { energiaEtiqueta: "15MV", tvl1Cm: 36, tvlECm: 33 },
  { energiaEtiqueta: "18MV", tvl1Cm: 36, tvlECm: 34 },
  { energiaEtiqueta: "20MV", tvl1Cm: 36, tvlECm: 34 },
  { energiaEtiqueta: "25MV", tvl1Cm: 37, tvlECm: 35 },
  { energiaEtiqueta: "30MV", tvl1Cm: 37, tvlECm: 36 },
  { energiaEtiqueta: "Co-60", tvl1Cm: 21, tvlECm: 21 },
  ];

// ============================================================================
// TABLAS B.8a-f (pag. 168-171) - ALBEDO DE DOSIS DIFERENCIAL (COEFICIENTE DE
// REFLEXION DE LA PARED). Los valores de la tabla se multiplican por 1e-3.
// Angulos de reflexion medidos desde la normal a la pared.
// ============================================================================

export type MaterialReflexionNCRP151 = "hormigon" | "hierro" | "plomo";

export interface FilaAlbedoReflexion {
    material: MaterialReflexionNCRP151;
    anguloIncidenciaGrados: 0 | 45;
    energiaEtiqueta: string;
    refl0: number;
    refl30: number;
    refl45: number;
    refl60: number;
    refl75: number;
}

export const FUENTE_TABLA_B8 = citaNCRP151RT("168-171", "Apendice B, Tablas B.8a a B.8f", "MEDIA", "El propio NCRP151 advierte incertidumbres del orden de +/-50% en estos valores de albedo debido tanto a los calculos Monte Carlo como a las interpolaciones graficas usadas para construir la tabla.");

export const ALBEDO_REFLEXION_NCRP151: FilaAlbedoReflexion[] = [
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "30MV", refl0: 3.0, refl30: 2.7, refl45: 2.6, refl60: 2.2, refl75: 1.5 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "24MV", refl0: 3.2, refl30: 3.2, refl45: 2.8, refl60: 2.3, refl75: 1.5 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "18MV", refl0: 3.4, refl30: 3.4, refl45: 3.0, refl60: 2.5, refl75: 1.6 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "10MV", refl0: 4.3, refl30: 4.1, refl45: 3.8, refl60: 3.1, refl75: 2.1 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "6MV", refl0: 5.3, refl30: 5.2, refl45: 4.7, refl60: 4.0, refl75: 2.7 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "4MV", refl0: 6.7, refl30: 6.4, refl45: 5.8, refl60: 4.9, refl75: 3.1 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "Co-60", refl0: 7.0, refl30: 6.5, refl45: 6.0, refl60: 5.5, refl75: 3.8 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "0.5MeV", refl0: 19.0, refl30: 17.0, refl45: 15.0, refl60: 13.0, refl75: 8.0 },
  { material: "hormigon", anguloIncidenciaGrados: 0, energiaEtiqueta: "0.25MeV", refl0: 32.0, refl30: 28.0, refl45: 25.0, refl60: 22.0, refl75: 13.0 },
  ];

export const ALBEDO_REFLEXION_45DEG_HORMIGON_NCRP151: FilaAlbedoReflexion[] = [
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "30MV", refl0: 4.8, refl30: 5.0, refl45: 4.9, refl60: 4.0, refl75: 3.0 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "24MV", refl0: 3.7, refl30: 3.9, refl45: 3.9, refl60: 3.7, refl75: 3.4 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "18MV", refl0: 4.5, refl30: 4.6, refl45: 4.6, refl60: 4.3, refl75: 4.0 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "10MV", refl0: 5.1, refl30: 5.7, refl45: 5.8, refl60: 6.0, refl75: 6.0 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "6MV", refl0: 6.4, refl30: 7.1, refl45: 7.3, refl60: 7.7, refl75: 8.0 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "4MV", refl0: 7.6, refl30: 8.5, refl45: 9.0, refl60: 9.2, refl75: 9.5 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "Co-60", refl0: 9.0, refl30: 10.2, refl45: 11.0, refl60: 11.5, refl75: 12.0 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "0.5MeV", refl0: 22.0, refl30: 22.5, refl45: 22.0, refl60: 20.0, refl75: 18.0 },
  { material: "hormigon", anguloIncidenciaGrados: 45, energiaEtiqueta: "0.25MeV", refl0: 36.0, refl30: 34.5, refl45: 31.0, refl60: 25.0, refl75: 18.0 },
  ];

export const ALBEDO_REFLEXION_HIERRO_NCRP151: FilaAlbedoReflexion[] = [
  { material: "hierro", anguloIncidenciaGrados: 0, energiaEtiqueta: "30MV", refl0: 5.5, refl30: 4.7, refl45: 4.4, refl60: 3.8, refl75: 2.3 },
  { material: "hierro", anguloIncidenciaGrados: 0, energiaEtiqueta: "18MV", refl0: 5.1, refl30: 4.5, refl45: 4.3, refl60: 3.8, refl75: 2.4 },
  { material: "hierro", anguloIncidenciaGrados: 0, energiaEtiqueta: "10MV", refl0: 5.0, refl30: 4.5, refl45: 4.3, refl60: 3.9, refl75: 2.5 },
  { material: "hierro", anguloIncidenciaGrados: 0, energiaEtiqueta: "6MV", refl0: 5.5, refl30: 4.9, refl45: 4.7, refl60: 4.2, refl75: 2.8 },
  { material: "hierro", anguloIncidenciaGrados: 0, energiaEtiqueta: "4MV", refl0: 6.0, refl30: 5.4, refl45: 5.1, refl60: 4.8, refl75: 3.1 },
  { material: "hierro", anguloIncidenciaGrados: 45, energiaEtiqueta: "30MV", refl0: 6.6, refl30: 6.5, refl45: 6.3, refl60: 5.5, refl75: 4.6 },
  { material: "hierro", anguloIncidenciaGrados: 45, energiaEtiqueta: "18MV", refl0: 6.5, refl30: 6.4, refl45: 6.2, refl60: 6.0, refl75: 5.6 },
  { material: "hierro", anguloIncidenciaGrados: 45, energiaEtiqueta: "10MV", refl0: 6.1, refl30: 6.8, refl45: 7.1, refl60: 7.2, refl75: 7.2 },
  { material: "hierro", anguloIncidenciaGrados: 45, energiaEtiqueta: "6MV", refl0: 6.0, refl30: 7.0, refl45: 8.5, refl60: 9.0, refl75: 9.5 },
  { material: "hierro", anguloIncidenciaGrados: 45, energiaEtiqueta: "4MV", refl0: 7.1, refl30: 8.1, refl45: 10.0, refl60: 10.6, refl75: 11.5 },
  ];

export const ALBEDO_REFLEXION_PLOMO_NCRP151: FilaAlbedoReflexion[] = [
  { material: "plomo", anguloIncidenciaGrados: 0, energiaEtiqueta: "30MV", refl0: 3.5, refl30: 3.0, refl45: 2.7, refl60: 2.4, refl75: 1.5 },
  { material: "plomo", anguloIncidenciaGrados: 0, energiaEtiqueta: "18MV", refl0: 3.9, refl30: 3.4, refl45: 3.2, refl60: 2.8, refl75: 1.8 },
  { material: "plomo", anguloIncidenciaGrados: 0, energiaEtiqueta: "10MV", refl0: 4.5, refl30: 3.9, refl45: 3.6, refl60: 3.2, refl75: 2.2 },
  { material: "plomo", anguloIncidenciaGrados: 0, energiaEtiqueta: "6MV", refl0: 5.0, refl30: 4.5, refl45: 4.2, refl60: 3.8, refl75: 2.6 },
  { material: "plomo", anguloIncidenciaGrados: 0, energiaEtiqueta: "4MV", refl0: 5.9, refl30: 5.2, refl45: 4.7, refl60: 4.2, refl75: 3.0 },
  { material: "plomo", anguloIncidenciaGrados: 45, energiaEtiqueta: "30MV", refl0: 4.1, refl30: 4.2, refl45: 4.1, refl60: 3.7, refl75: 3.2 },
  { material: "plomo", anguloIncidenciaGrados: 45, energiaEtiqueta: "18MV", refl0: 4.9, refl30: 5.0, refl45: 5.0, refl60: 4.8, refl75: 4.5 },
  { material: "plomo", anguloIncidenciaGrados: 45, energiaEtiqueta: "10MV", refl0: 5.4, refl30: 5.8, refl45: 6.0, refl60: 5.9, refl75: 5.8 },
  { material: "plomo", anguloIncidenciaGrados: 45, energiaEtiqueta: "6MV", refl0: 6.5, refl30: 6.8, refl45: 7.0, refl60: 7.3, refl75: 7.8 },
  { material: "plomo", anguloIncidenciaGrados: 45, energiaEtiqueta: "4MV", refl0: 6.5, refl30: 7.6, refl45: 8.3, refl60: 8.6, refl75: 9.0 },
  ];

// ============================================================================
// TABLA B.9 (pag. 172-173) - FUERZA DE FUENTE DE NEUTRONES (Qn, en unidades
// de 1e12 neutrones por gray de dosis absorbida de rayos X en el isocentro)
// y dosis equivalente de neutrones (H0, mSv/Gy) a 1.41 m del objetivo, por
// modelo de acelerador (McGinley, 2002; Followill et al., 2003).
//
// ADVERTENCIA DE CALIDAD DE FUENTE: esta tabla se extrajo de una version
// traducida automaticamente (Google Translate) de un documento escaneado.
// Algunos nombres de modelo comercial pueden estar corrompidos por errores
// de OCR/traduccion. Antes de usar el nombre de un modelo especifico para
// un caso real, verificar contra el articulo original en ingles. Los
// valores numericos Qn/H0 se transcriben tal cual del texto disponible.
// ============================================================================

export interface FilaFuenteNeutronesNCRP151 {
    vendedor: string;
    modelo: string;
    energiaNominalMV: number;
    qnX1e12: number;
    h0MSvGy?: number;
    referencia: string;
    notas?: string;
}

export const FUENTE_TABLA_B9 = citaNCRP151RT("172-173", "Apendice B, Tabla B.9", "MEDIA", "Ver advertencia de calidad de fuente en el comentario de esta seccion.");

export const FUERZA_FUENTE_NEUTRONES_NCRP151: FilaFuenteNeutronesNCRP151[] = [
  { vendedor: "Varian", modelo: "1800", energiaNominalMV: 18, qnX1e12: 1.22, h0MSvGy: 1.02, referencia: "McGinley (2002)" },
  { vendedor: "Varian", modelo: "1800", energiaNominalMV: 15, qnX1e12: 0.76, h0MSvGy: 0.79, referencia: "McGinley (2002)" },
  { vendedor: "Varian", modelo: "1800", energiaNominalMV: 10, qnX1e12: 0.06, h0MSvGy: 0.04, referencia: "McGinley (2002)" },
  { vendedor: "Varian", modelo: "2100C", energiaNominalMV: 18, qnX1e12: 0.96, referencia: "Followill et al. (2003)" },
  { vendedor: "Varian", modelo: "2100C", energiaNominalMV: 18, qnX1e12: 0.87, referencia: "Followill et al. (2003)", notas: "Segunda unidad del mismo modelo y energia." },
  { vendedor: "Varian", modelo: "2300CD", energiaNominalMV: 18, qnX1e12: 0.95, referencia: "Followill et al. (2003)" },
  { vendedor: "Varian", modelo: "2500", energiaNominalMV: 24, qnX1e12: 0.77, referencia: "Followill et al. (2003)" },
  { vendedor: "Siemens", modelo: "KD", energiaNominalMV: 20, qnX1e12: 0.92, h0MSvGy: 1.1, referencia: "McGinley (2002)" },
  { vendedor: "Siemens", modelo: "MD", energiaNominalMV: 15, qnX1e12: 0.2, h0MSvGy: 0.17, referencia: "McGinley (2002) / Followill et al. (2003)" },
  { vendedor: "Siemens", modelo: "MD2", energiaNominalMV: 10, qnX1e12: 0.08, referencia: "Followill et al. (2003)" },
  { vendedor: "Siemens", modelo: "KD", energiaNominalMV: 18, qnX1e12: 0.88, referencia: "Followill et al. (2003)" },
  { vendedor: "Siemens", modelo: "Primus", energiaNominalMV: 15, qnX1e12: 0.12, referencia: "Followill et al. (2003)" },
  { vendedor: "Siemens", modelo: "Primus", energiaNominalMV: 15, qnX1e12: 0.21, referencia: "Followill et al. (2003)", notas: "Segunda unidad del mismo modelo y energia." },
  { vendedor: "Siemens", modelo: "MODELO NO IDENTIFICABLE CON CERTEZA (OCR corrupto, ver advertencia)", energiaNominalMV: 10, qnX1e12: 0.02, referencia: "Followill et al. (2003)", notas: "El nombre de modelo en el texto fuente aparecia como una frase sin sentido tecnico; se omite el nombre y se conserva solo el valor numerico con esta advertencia explicita." },
  { vendedor: "Philips/Elekta", modelo: "SL25", energiaNominalMV: 25, qnX1e12: 2.37, h0MSvGy: 2.0, referencia: "McGinley (2002)" },
  { vendedor: "Philips/Elekta", modelo: "SL20", energiaNominalMV: 20, qnX1e12: 0.69, h0MSvGy: 0.44, referencia: "McGinley (2002)" },
  { vendedor: "Philips/Elekta", modelo: "SL20 o SL25", energiaNominalMV: 18, qnX1e12: 0.46, referencia: "Followill et al. (2003)" },
  { vendedor: "Philips/Elekta", modelo: "SL25", energiaNominalMV: 25, qnX1e12: 1.44, referencia: "Followill et al. (2003)" },
  { vendedor: "GE", modelo: "Saturne41", energiaNominalMV: 12, qnX1e12: 0.24, h0MSvGy: 0.09, referencia: "McGinley (2002)" },
  { vendedor: "GE", modelo: "Saturne41", energiaNominalMV: 15, qnX1e12: 0.47, h0MSvGy: 0.32, referencia: "McGinley (2002)" },
  { vendedor: "GE", modelo: "Saturne43", energiaNominalMV: 18, qnX1e12: 1.50, h0MSvGy: 0.55, referencia: "McGinley (2002)" },
  { vendedor: "GE", modelo: "Saturne43", energiaNominalMV: 18, qnX1e12: 1.32, referencia: "Followill et al. (2003)" },
  { vendedor: "GE", modelo: "Saturne43", energiaNominalMV: 25, qnX1e12: 2.4, h0MSvGy: 1.38, referencia: "McGinley (2002)" },
  ];

// ============================================================================
// SECCION 2.2/2.3 (pag. 22-33) - FORMULAS DE TRANSMISION DE BARRERA
// Ecuaciones 2.1 (barrera primaria), 2.7 (dispersion del paciente) y 2.8
// (fuga), extraidas limpiamente del texto. La conversion TVL/espesor
// (Ecuaciones 2.2 a 2.4) presentaba glifos matematicos corrompidos por el
// OCR de la fuente; se implementa aqui el modelo TVL estandar de NCRP
// (B = 10^-[1+(t-TVL1)/TVLe]), reconocido de forma independiente y
// consistente con la prosa descriptiva extraida limpiamente alrededor de
// esas ecuaciones, pero se marca con confianza MEDIA y se recomienda
// verificacion manual contra el PDF original en ingles antes de uso en un
// caso real (S61, anti-fabricacion).
// ============================================================================

export const FUENTE_EQ21_BARRERA_PRIMARIA = citaNCRP151RT("22-23", "Ecuacion 2.1");
export const FUENTE_EQ24_MODELO_TVL = citaNCRP151RT("23", "Ecuaciones 2.2 a 2.4", "MEDIA", "OCR de los glifos matematicos exactos corrompido; formula reconstruida a partir del modelo TVL estandar NCRP, verificar contra el PDF original antes de uso en un caso real.");
export const FUENTE_EQ27_DISPERSION_PACIENTE = citaNCRP151RT("32", "Ecuacion 2.7");
export const FUENTE_EQ28_FUGA = citaNCRP151RT("33", "Ecuacion 2.8");

/**
 * Ecuacion 2.1: factor de transmision requerido para la barrera primaria.
 * Bpri = P * d^2 / (W * U * T)
 */
export function calcularTransmisionBarreraPrimaria(pSvSemana: number, dMetros: number, wGySemana: number, u: number, t: number): number {
    return (pSvSemana * Math.pow(dMetros, 2)) / (wGySemana * u * t);
}

/**
 * Modelo TVL estandar (ver advertencia de confianza MEDIA arriba): dado un
 * factor de transmision objetivo B, retorna el espesor de barrera (misma
 * unidad que TVL1/TVLe, tipicamente cm).
 * t = TVL1 * [1 + (log10(1/B) - 1)] cuando log10(1/B) > 1, usando TVLe para
 * las capas mas alla de la primera.
 */
export function espesorRequeridoTVL(bObjetivo: number, tvl1: number, tvlE: number): number {
    const logInvB = Math.log10(1 / bObjetivo);
    if (logInvB <= 1) {
          return tvl1 * logInvB;
    }
    return tvl1 + (logInvB - 1) * tvlE;
}

/**
 * Inversa: dado un espesor de barrera, retorna el factor de transmision B.
 * B = 10^-[1 + (t - TVL1)/TVLe] para t > TVL1; B = 10^-(t/TVL1) para t <= TVL1.
 */
export function transmisionDadoEspesorTVL(tCm: number, tvl1: number, tvlE: number): number {
    if (tCm <= tvl1) {
          return Math.pow(10, -(tCm / tvl1));
    }
    return Math.pow(10, -(1 + (tCm - tvl1) / tvlE));
}

/**
 * Ecuacion 2.7: factor de transmision requerido para la barrera secundaria
 * por radiacion dispersada del paciente.
 * Bps = P * dsca^2 * dsec^2 * 400 / (a * W * T * F)
 * F en cm2 (area de campo a la mitad de profundidad del paciente a 1 m).
 */
export function calcularTransmisionDispersionPaciente(pSvSemana: number, dScaMetros: number, dSecMetros: number, aFraccionDispersion: number, wGySemana: number, t: number, fCm2: number): number {
    return (pSvSemana * Math.pow(dScaMetros, 2) * Math.pow(dSecMetros, 2) * 400) / (aFraccionDispersion * wGySemana * t * fCm2);
}

/**
 * Ecuacion 2.8: factor de transmision requerido para la barrera secundaria
 * por radiacion de fuga (se asume fuga = 0.1% del haz util, factor de uso
 * de fuga = 1).
 * BL = P * dL^2 / (1e-3 * W)
 */
export function calcularTransmisionFuga(pSvSemana: number, dLMetros: number, wGySemana: number): number {
    return (pSvSemana * Math.pow(dLMetros, 2)) / (1e-3 * wGySemana);
}

// ============================================================================
// PENDIENTE PARA FASES POSTERIORES (documentado, no implementado; S1/S61)
// ============================================================================
// - Seccion 2.4 completa (puertas y laberintos): Ecuaciones 2.9 a 2.22,
//   incluyendo coeficientes de reflexion (ya tabulados arriba en
//   ALBEDO_REFLEXION_*), fuerza de fuente de neutrones (ya tabulada en
//   FUERZA_FUENTE_NEUTRONES_NCRP151) y el metodo de Kersey modificado.
//   Requiere modelar geometria de laberinto (tramos, areas de secciones
//   transversales, angulos) en el wizard antes de poder calcular.
// - Seccion 2.2.3 (barreras laminadas, Ecuacion 2.5-2.6) para blindajes
//   compuestos hormigon+plomo/acero en energias >10 MV.
// - Seccion 3 completa (cargas de trabajo y factores de uso por
//   procedimiento especial: TBI, IMRT, SRS/SRT) mas alla de lo ya descrito
//   en comentarios de esta seccion.
// - Tabla 3.1 (distribucion de factor de uso por angulo de portico,
//   pag. 55): no transcrita numericamente en esta fase.
// - Seccion 5 (skyshine, radiacion dispersada lateralmente, activacion,
//   ozono): no transcrita numericamente en esta fase.
//
// Este archivo se limita, por ahora, a: factores de ocupacion (Tabla B.1),
// TVL de barrera primaria (Tabla B.2), propiedades de materiales (Tabla
// B.3), fracciones y TVL de dispersion del paciente (Tablas B.4, B.5a,
// B.5b, B.6), TVL de fuga (Tabla B.7), coeficientes de reflexion (Tablas
// B.8a-f) y fuerza de fuente de neutrones (Tabla B.9), junto con las
// formulas de transmision de barrera primaria/secundaria (Ecuaciones 2.1,
// 2.7, 2.8) y el modelo TVL estandar de conversion espesor-transmision.

export const NOTA_ALCANCE_ARCHIVO =
    "Este archivo cubre barreras primarias y secundarias (fuga y dispersion del paciente) para aceleradores de megavoltaje segun NCRP 151. NO cubre (todavia) laberintos/puertas, barreras laminadas, ni procedimientos especiales (TBI/IMRT/SRS). No debe usarse para presentar un diseno de blindaje completo de una sala de aceleradores sin complementar con esas secciones pendientes.";
