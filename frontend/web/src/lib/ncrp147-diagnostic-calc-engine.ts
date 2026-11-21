/**
* NCRP 147 (2004) - Motor de calculo: Blindaje para Diagnostico por Imagenes.
* Fuente primaria (Nivel 2, confianza ALTA): NCRP Report No. 147, "Structural
* Shielding Design for Medical X-Ray Imaging Facilities", Apendices A, B y C,
* y Seccion 4 (Tablas 4.5 y 4.7).
* Archivo verificado en Google Drive: NCRP_Report_147_AAPM.txt
* (ID 15jDKCXjVjKx437I5puWPaESRPtHYrSKM), paginas 118-121 (Tabla A.1),
* 133-134 (Tabla B.1), 147-148 (Tabla C.1), 43 (Tabla 4.5) y 46-47
* (Tabla 4.7). Los coeficientes de las Tablas A.1/B.1/C.1 fueron
* transcritos y verificados visualmente (zoom) linea por linea. Las
* Tablas 4.5 y 4.7 fueron extraidas por lectura directa del texto fuente
* (get_page_text) de la Seccion 4.1.6.1 y 4.1.7.3 del documento. NO se han
* inventado, interpolado ni estimado valores numericos.
*
* Eq. A.2 B(x) = [ (1 + b/a) * exp(a*g*x) - b/a ] ^ (-1/g)
* Eq. A.3 x = (1/(a*g)) * ln( (B^-g + b/a) / (1 + b/a) )
* donde a=alfa (mm^-1), b=beta (mm^-1), g=gamma (adimensional), x en mm.
*
* Barrera primaria (Apendice B): Kp(0)=K1_P*N*U/dP^2 (Eq B.6);
* BP(xbarrier)=(P/T)*dP^2/(K1_P*N*U) (Eq B.8); x=espesorRequeridoArcher(BP)
*
* Barrera secundaria (Apendice C): Ksec(0)=K1_sec*N/dsec^2 (Eq C.13);
* Bsec(xbarrier)=(P/T)*dsec^2/(K1_sec*N) (Eq C.15); x=espesorRequeridoArcher(Bsec)
*/

export interface CoeficientesArcher {
    alfa: number;
    beta: number;
    gamma: number;
}

export type MaterialNCRP147 =
    | "Plomo"
| "Hormigon"
| "Tablero de yeso"
| "Acero"
| "Vidrio plano"
| "Madera";

export const MATERIALES_NCRP147: MaterialNCRP147[] = [
    "Plomo",
    "Hormigon",
    "Tablero de yeso",
    "Acero",
    "Vidrio plano",
    "Madera",
    ];

export type DistribucionCargaTrabajoNCRP147 =
    | "Sala Rx (todas las barreras)"
| "Sala Rx (bucky de torax)"
| "Sala Rx (piso u otras barreras)"
| "Tubo de fluoroscopia (sala R&F)"
| "Tubo de Rx (sala R&F)"
| "Sala de torax"
| "Sala de mamografia"
| "Angiografia cardiaca"
| "Angiografia periferica (y neuroangiografia)";

export const DISTRIBUCIONES_CARGA_TRABAJO_NCRP147: DistribucionCargaTrabajoNCRP147[] = [
    "Sala Rx (todas las barreras)",
    "Sala Rx (bucky de torax)",
    "Sala Rx (piso u otras barreras)",
    "Tubo de fluoroscopia (sala R&F)",
    "Tubo de Rx (sala R&F)",
    "Sala de torax",
    "Sala de mamografia",
    "Angiografia cardiaca",
    "Angiografia periferica (y neuroangiografia)",
    ];

export const TABLA_A1_TRANSMISION_PRIMARIA_POR_KVP: Record<number, Partial<Record<MaterialNCRP147, CoeficientesArcher>>> = {
    25: { Plomo: { alfa: 49.52, beta: 194.0, gamma: 0.3037 }, Hormigon: { alfa: 0.3904, beta: 0.1645, gamma: 0.2757 }, "Tablero de yeso": { alfa: 0.1576, beta: 0.7175, gamma: 0.3048 }, Acero: { alfa: 9.364, beta: 41.25, gamma: 0.3202 }, "Vidrio plano": { alfa: 0.3804, beta: 0.1543, gamma: 0.2869 }, Madera: { alfa: 0.02230, beta: 0.04340, gamma: 0.1937 } },
    30: { Plomo: { alfa: 38.80, beta: 178.0, gamma: 0.3473 }, Hormigon: { alfa: 0.3173, beta: 0.1698, gamma: 0.3593 }, "Tablero de yeso": { alfa: 0.1208, beta: 0.7043, gamma: 0.3613 }, Acero: { alfa: 7.406, beta: 41.93, gamma: 0.3959 }, "Vidrio plano": { alfa: 0.3061, beta: 0.1599, gamma: 0.3693 }, Madera: { alfa: 0.02166, beta: 0.03966, gamma: 0.2843 } },
    35: { Plomo: { alfa: 29.55, beta: 164.7, gamma: 0.3948 }, Hormigon: { alfa: 0.2528, beta: 0.1807, gamma: 0.4648 }, "Tablero de yeso": { alfa: 0.08878, beta: 0.6988, gamma: 0.4245 }, Acero: { alfa: 5.716, beta: 43.41, gamma: 0.4857 }, "Vidrio plano": { alfa: 0.2396, beta: 0.1694, gamma: 0.4683 }, Madera: { alfa: 0.01901, beta: 0.03873, gamma: 0.3732 } },
    40: { Plomo: { alfa: 0.1297, beta: 0.1780, gamma: 0.2189 } },
    45: { Plomo: { alfa: 0.1095, beta: 0.1741, gamma: 0.2269 } },
    50: { Plomo: { alfa: 8.801, beta: 27.28, gamma: 0.2957 }, Hormigon: { alfa: 0.09032, beta: 0.1712, gamma: 0.2324 }, "Tablero de yeso": { alfa: 0.03883, beta: 0.08730, gamma: 0.5105 }, Acero: { alfa: 1.817, beta: 4.840, gamma: 0.4021 }, "Vidrio plano": { alfa: 0.09721, beta: 0.1799, gamma: 0.4912 }, Madera: { alfa: 0.01076, beta: 0.001862, gamma: 1.170 } },
    55: { Plomo: { alfa: 7.839, beta: 25.92, gamma: 0.3499 }, Hormigon: { alfa: 0.07422, beta: 0.1697, gamma: 0.2454 }, "Tablero de yeso": { alfa: 0.03419, beta: 0.08315, gamma: 0.5606 }, Acero: { alfa: 1.493, beta: 4.515, gamma: 0.4293 }, "Vidrio plano": { alfa: 0.08552, beta: 0.1661, gamma: 0.5112 }, Madera: { alfa: 0.01012, beta: 0.001404, gamma: 1.269 } },
    60: { Plomo: { alfa: 6.951, beta: 24.89, gamma: 0.4198 }, Hormigon: { alfa: 0.06251, beta: 0.1692, gamma: 0.2733 }, "Tablero de yeso": { alfa: 0.02985, beta: 0.07961, gamma: 0.6169 }, Acero: { alfa: 1.183, beta: 4.219, gamma: 0.4571 }, "Vidrio plano": { alfa: 0.07452, beta: 0.1539, gamma: 0.5304 }, Madera: { alfa: 0.009512, beta: 0.000967, gamma: 1.333 } },
    65: { Plomo: { alfa: 6.130, beta: 24.09, gamma: 0.5019 }, Hormigon: { alfa: 0.05528, beta: 0.1696, gamma: 0.3217 }, "Tablero de yeso": { alfa: 0.02609, beta: 0.07597, gamma: 0.6756 }, Acero: { alfa: 0.9172, beta: 3.982, gamma: 0.4922 }, "Vidrio plano": { alfa: 0.06514, beta: 0.1443, gamma: 0.5582 }, Madera: { alfa: 0.008990, beta: 0.000647, gamma: 1.353 } },
    70: { Plomo: { alfa: 5.369, beta: 23.49, gamma: 0.5881 }, Hormigon: { alfa: 0.05087, beta: 0.1696, gamma: 0.3847 }, "Tablero de yeso": { alfa: 0.02302, beta: 0.07163, gamma: 0.7299 }, Acero: { alfa: 0.7149, beta: 3.798, gamma: 0.5378 }, "Vidrio plano": { alfa: 0.05791, beta: 0.1357, gamma: 0.5967 }, Madera: { alfa: 0.008550, beta: 0.000539, gamma: 1.194 } },
    75: { Plomo: { alfa: 4.666, beta: 22.69, gamma: 0.6618 }, Hormigon: { alfa: 0.04797, beta: 0.1663, gamma: 0.4492 }, "Tablero de yeso": { alfa: 0.02066, beta: 0.06649, gamma: 0.7750 }, Acero: { alfa: 0.5793, beta: 3.629, gamma: 0.5908 }, "Vidrio plano": { alfa: 0.05291, beta: 0.1280, gamma: 0.6478 }, Madera: { alfa: 0.008203, beta: 0.000642, gamma: 1.062 } },
    80: { Plomo: { alfa: 4.040, beta: 21.69, gamma: 0.7187 }, Hormigon: { alfa: 0.04583, beta: 0.1549, gamma: 0.4926 }, "Tablero de yeso": { alfa: 0.01886, beta: 0.06093, gamma: 0.8103 }, Acero: { alfa: 0.4921, beta: 3.428, gamma: 0.6427 }, "Vidrio plano": { alfa: 0.04955, beta: 0.1208, gamma: 0.7097 }, Madera: { alfa: 0.007903, beta: 0.000864, gamma: 0.9703 } },
    85: { Plomo: { alfa: 3.504, beta: 20.37, gamma: 0.7550 }, Hormigon: { alfa: 0.04398, beta: 0.1348, gamma: 0.4943 }, "Tablero de yeso": { alfa: 0.01746, beta: 0.05558, gamma: 0.8392 }, Acero: { alfa: 0.4355, beta: 3.178, gamma: 0.6861 }, "Vidrio plano": { alfa: 0.04721, beta: 0.1140, gamma: 0.7786 }, Madera: { alfa: 0.007686, beta: 0.001056, gamma: 1.015 } },
    90: { Plomo: { alfa: 3.067, beta: 18.83, gamma: 0.7726 }, Hormigon: { alfa: 0.04228, beta: 0.1137, gamma: 0.4690 }, "Tablero de yeso": { alfa: 0.01633, beta: 0.05039, gamma: 0.8585 }, Acero: { alfa: 0.3971, beta: 2.913, gamma: 0.7204 }, "Vidrio plano": { alfa: 0.04550, beta: 0.1077, gamma: 0.8522 }, Madera: { alfa: 0.007511, beta: 0.001159, gamma: 1.081 } },
    95: { Plomo: { alfa: 2.731, beta: 17.07, gamma: 0.7714 }, Hormigon: { alfa: 0.04068, beta: 0.09705, gamma: 0.4406 }, "Tablero de yeso": { alfa: 0.01543, beta: 0.04571, gamma: 0.8763 }, Acero: { alfa: 0.3681, beta: 2.654, gamma: 0.7461 }, "Vidrio plano": { alfa: 0.04410, beta: 0.1013, gamma: 0.9222 }, Madera: { alfa: 0.007345, beta: 0.001133, gamma: 1.116 } },
    100: { Plomo: { alfa: 2.500, beta: 15.28, gamma: 0.7557 }, Hormigon: { alfa: 0.03925, beta: 0.08567, gamma: 0.4273 }, "Tablero de yeso": { alfa: 0.01466, beta: 0.04171, gamma: 0.8939 }, Acero: { alfa: 0.3415, beta: 2.420, gamma: 0.7645 }, "Vidrio plano": { alfa: 0.04278, beta: 0.09466, gamma: 0.9791 }, Madera: { alfa: 0.007230, beta: 0.000934, gamma: 1.309 } },
    105: { Plomo: { alfa: 2.364, beta: 13.41, gamma: 0.7239 }, Hormigon: { alfa: 0.03808, beta: 0.07862, gamma: 0.4394 }, "Tablero de yeso": { alfa: 0.01397, beta: 0.03815, gamma: 0.9080 }, Acero: { alfa: 0.3135, beta: 2.227, gamma: 0.7788 }, "Vidrio plano": { alfa: 0.04143, beta: 0.08751, gamma: 1.014 }, Madera: { alfa: 0.007050, beta: 0.000620, gamma: 1.365 } },
    110: { Plomo: { alfa: 2.296, beta: 11.70, gamma: 0.6827 }, Hormigon: { alfa: 0.03715, beta: 0.07436, gamma: 0.4752 }, "Tablero de yeso": { alfa: 0.01336, beta: 0.03521, gamma: 0.9244 }, Acero: { alfa: 0.2849, beta: 2.061, gamma: 0.7897 }, "Vidrio plano": { alfa: 0.04008, beta: 0.08047, gamma: 1.030 }, Madera: { alfa: 0.006921, beta: -0.0001976, gamma: 3.309 } },
    115: { Plomo: { alfa: 2.265, beta: 10.21, gamma: 0.6363 }, Hormigon: { alfa: 0.03636, beta: 0.07201, gamma: 0.5319 }, "Tablero de yeso": { alfa: 0.01283, beta: 0.03271, gamma: 0.9423 }, Acero: { alfa: 0.2579, beta: 1.922, gamma: 0.8008 }, "Vidrio plano": { alfa: 0.03878, beta: 0.07394, gamma: 1.033 }, Madera: { alfa: 0.006864, beta: -0.0003908, gamma: 0.6469 } },
    120: { Plomo: { alfa: 2.246, beta: 8.950, gamma: 0.5873 }, Hormigon: { alfa: 0.03566, beta: 0.07109, gamma: 0.6073 }, "Tablero de yeso": { alfa: 0.01235, beta: 0.03047, gamma: 0.9566 }, Acero: { alfa: 0.2336, beta: 1.797, gamma: 0.8116 }, "Vidrio plano": { alfa: 0.03758, beta: 0.06808, gamma: 1.031 }, Madera: { alfa: 0.006726, beta: -0.0008308, gamma: 1.006 } },
    125: { Plomo: { alfa: 2.219, beta: 7.923, gamma: 0.5386 }, Hormigon: { alfa: 0.03502, beta: 0.07113, gamma: 0.6974 }, "Tablero de yeso": { alfa: 0.01192, beta: 0.02863, gamma: 0.9684 }, Acero: { alfa: 0.2130, beta: 1.677, gamma: 0.8217 }, "Vidrio plano": { alfa: 0.03652, beta: 0.06304, gamma: 1.031 }, Madera: { alfa: 0.006584, beta: -0.001214, gamma: 1.192 } },
    130: { Plomo: { alfa: 2.170, beta: 7.094, gamma: 0.4909 }, Hormigon: { alfa: 0.03445, beta: 0.07160, gamma: 0.7969 }, "Tablero de yeso": { alfa: 0.01155, beta: 0.02702, gamma: 0.9802 }, Acero: { alfa: 0.1969, beta: 1.557, gamma: 0.8309 }, "Vidrio plano": { alfa: 0.03561, beta: 0.05874, gamma: 1.037 }, Madera: { alfa: 0.006472, beta: -0.001539, gamma: 1.285 } },
    135: { Plomo: { alfa: 2.102, beta: 6.450, gamma: 0.4469 }, Hormigon: { alfa: 0.03394, beta: 0.07263, gamma: 0.9099 }, "Tablero de yeso": { alfa: 0.01122, beta: 0.02561, gamma: 0.9901 }, Acero: { alfa: 0.1838, beta: 1.440, gamma: 0.8391 }, "Vidrio plano": { alfa: 0.03481, beta: 0.05519, gamma: 1.049 }, Madera: { alfa: 0.006306, beta: -0.001731, gamma: 1.465 } },
    140: { Plomo: { alfa: 2.009, beta: 5.916, gamma: 0.4018 }, Hormigon: { alfa: 0.03345, beta: 0.07476, gamma: 1.047 }, "Tablero de yeso": { alfa: 0.01088, beta: 0.02436, gamma: 0.9964 }, Acero: { alfa: 0.1724, beta: 1.328, gamma: 0.8458 }, "Vidrio plano": { alfa: 0.03407, beta: 0.05145, gamma: 1.057 }, Madera: { alfa: 0.006191, beta: -0.001849, gamma: 1.530 } },
    145: { Plomo: { alfa: 1.895, beta: 5.498, gamma: 0.3580 }, Hormigon: { alfa: 0.03296, beta: 0.07875, gamma: 1.224 }, "Tablero de yeso": { alfa: 0.01056, beta: 0.02313, gamma: 0.9987 }, Acero: { alfa: 0.1616, beta: 1.225, gamma: 0.8519 }, "Vidrio plano": { alfa: 0.03336, beta: 0.04795, gamma: 1.063 }, Madera: { alfa: 0.006115, beta: -0.001869, gamma: 1.498 } },
    150: { Plomo: { alfa: 1.757, beta: 5.177, gamma: 0.3156 }, Hormigon: { alfa: 0.03243, beta: 0.08599, gamma: 1.467 }, "Tablero de yeso": { alfa: 0.01030, beta: 0.02198, gamma: 1.013 }, Acero: { alfa: 0.1501, beta: 1.132, gamma: 0.8566 }, "Vidrio plano": { alfa: 0.03266, beta: 0.04491, gamma: 1.073 }, Madera: { alfa: 0.006020, beta: -0.001752, gamma: 1.483 } },
};

/**
* TABLA B.1 (NCRP 147, pag. 133-134) - Ajustes de transmision de haz PRIMARIO
* por DISTRIBUCION DE CARGA DE TRABAJO clinica (Tabla 4.2, encuesta AAPM TG9 /
* Simpkin 1996a). Usar junto a Eq. B.8/B.9 para el diseno de barreras
* primarias por tipo de sala.
*/
export const TABLA_B1_TRANSMISION_PRIMARIA_POR_CARGA: Record<DistribucionCargaTrabajoNCRP147, Record<MaterialNCRP147, CoeficientesArcher>> = {
    "Sala Rx (todas las barreras)": { Plomo: { alfa: 2.346, beta: 15.90, gamma: 0.4982 }, Hormigon: { alfa: 0.03626, beta: 0.1429, gamma: 0.4932 }, "Tablero de yeso": { alfa: 0.01420, beta: 0.05781, gamma: 0.7445 }, Acero: { alfa: 0.2163, beta: 3.101, gamma: 0.5745 }, "Vidrio plano": { alfa: 0.03907, beta: 0.1069, gamma: 0.5940 }, Madera: { alfa: 0.007616, beta: 0.000767, gamma: 1.027 } },
    "Sala Rx (bucky de torax)": { Plomo: { alfa: 2.264, beta: 13.08, gamma: 0.5600 }, Hormigon: { alfa: 0.03552, beta: 0.1177, gamma: 0.6007 }, "Tablero de yeso": { alfa: 0.01278, beta: 0.04848, gamma: 0.8609 }, Acero: { alfa: 0.2179, beta: 2.677, gamma: 0.7209 }, "Vidrio plano": { alfa: 0.03762, beta: 0.09751, gamma: 0.7867 }, Madera: { alfa: 0.007142, beta: 0.000308, gamma: 1.617 } },
    "Sala Rx (piso u otras barreras)": { Plomo: { alfa: 2.651, beta: 16.56, gamma: 0.4585 }, Hormigon: { alfa: 0.03994, beta: 0.1448, gamma: 0.4231 }, "Tablero de yeso": { alfa: 0.01679, beta: 0.06124, gamma: 0.7356 }, Acero: { alfa: 0.2535, beta: 2.740, gamma: 0.4297 }, "Vidrio plano": { alfa: 0.04361, beta: 0.1082, gamma: 0.5463 }, Madera: { alfa: 0.007915, beta: 0.000880, gamma: 0.9790 } },
    "Tubo de fluoroscopia (sala R&F)": { Plomo: { alfa: 2.347, beta: 12.67, gamma: 0.6149 }, Hormigon: { alfa: 0.03616, beta: 0.09721, gamma: 0.5186 }, "Tablero de yeso": { alfa: 0.01340, beta: 0.04283, gamma: 0.8796 }, Acero: { alfa: 0.2323, beta: 2.190, gamma: 0.6509 }, "Vidrio plano": { alfa: 0.03901, beta: 0.08588, gamma: 0.8081 }, Madera: { alfa: 0.007089, beta: 0.000474, gamma: 1.580 } },
    "Tubo de Rx (sala R&F)": { Plomo: { alfa: 2.295, beta: 13.00, gamma: 0.5573 }, Hormigon: { alfa: 0.03549, beta: 0.1164, gamma: 0.5774 }, "Tablero de yeso": { alfa: 0.01300, beta: 0.04778, gamma: 0.8485 }, Acero: { alfa: 0.2126, beta: 2.568, gamma: 0.6788 }, "Vidrio plano": { alfa: 0.03778, beta: 0.09365, gamma: 0.7483 }, Madera: { alfa: 0.007162, beta: 0.000411, gamma: 1.541 } },
    "Sala de torax": { Plomo: { alfa: 2.283, beta: 10.74, gamma: 0.6370 }, Hormigon: { alfa: 0.03622, beta: 0.07766, gamma: 0.5404 }, "Tablero de yeso": { alfa: 0.01286, beta: 0.03505, gamma: 0.9356 }, Acero: { alfa: 0.2500, beta: 1.989, gamma: 0.7721 }, "Vidrio plano": { alfa: 0.03866, beta: 0.07721, gamma: 0.9843 }, Madera: { alfa: 0.007650, beta: -0.000980, gamma: 0.08083 } },
    "Sala de mamografia": { Plomo: { alfa: 30.60, beta: 177.6, gamma: 0.3308 }, Hormigon: { alfa: 0.2577, beta: 1.765, gamma: 0.3644 }, "Tablero de yeso": { alfa: 0.09148, beta: 0.7090, gamma: 0.3459 }, Acero: { alfa: 5.998, beta: 42.91, gamma: 0.3927 }, "Vidrio plano": { alfa: 0.2467, beta: 1.654, gamma: 0.3694 }, Madera: { alfa: 0.01914, beta: 0.04166, gamma: 0.2858 } },
    "Angiografia cardiaca": { Plomo: { alfa: 2.389, beta: 14.26, gamma: 0.5948 }, Hormigon: { alfa: 0.03717, beta: 0.1087, gamma: 0.4879 }, "Tablero de yeso": { alfa: 0.01409, beta: 0.04814, gamma: 0.8419 }, Acero: { alfa: 0.2533, beta: 2.461, gamma: 0.6243 }, "Vidrio plano": { alfa: 0.04025, beta: 0.09482, gamma: 0.7523 }, Madera: { alfa: 0.007303, beta: 0.000722, gamma: 1.204 } },
    "Angiografia periferica (y neuroangiografia)": { Plomo: { alfa: 2.728, beta: 18.52, gamma: 0.4614 }, Hormigon: { alfa: 0.04292, beta: 0.1538, gamma: 0.4236 }, "Tablero de yeso": { alfa: 0.01774, beta: 0.06449, gamma: 0.7158 }, Acero: { alfa: 0.3670, beta: 3.260, gamma: 0.5036 }, "Vidrio plano": { alfa: 0.04642, beta: 0.1203, gamma: 0.5763 }, Madera: { alfa: 0.008103, beta: 0.000844, gamma: 0.9754 } },
};

/**
* TABLA C.1 (NCRP 147, pag. 147-148) - Ajustes de transmision de radiacion
* SECUNDARIA (dispersa + fuga), por potencial operativo (kVp) y por
* distribucion de carga de trabajo clinica. Usar junto a Eq. C.13/C.15.
*/
export const TABLA_C1_TRANSMISION_SECUNDARIA_POR_KVP: Record<number, Record<MaterialNCRP147, CoeficientesArcher>> = {
    30: { Plomo: { alfa: 38.79, beta: 180.0, gamma: 0.3560 }, Hormigon: { alfa: 0.3174, beta: 1.725, gamma: 0.3705 }, "Tablero de yeso": { alfa: 0.1198, beta: 0.7137, gamma: 0.3703 }, Acero: { alfa: 7.408, beta: 42.49, gamma: 0.4061 }, "Vidrio plano": { alfa: 0.3060, beta: 1.620, gamma: 0.3793 }, Madera: { alfa: 0.02159, beta: 0.03971, gamma: 0.2852 } },
    50: { Plomo: { alfa: 8.801, beta: 27.28, gamma: 0.2957 }, Hormigon: { alfa: 0.09030, beta: 0.1712, gamma: 0.2324 }, "Tablero de yeso": { alfa: 0.03880, beta: 0.08730, gamma: 0.5105 }, Acero: { alfa: 1.817, beta: 4.840, gamma: 0.4021 }, "Vidrio plano": { alfa: 0.09721, beta: 0.1799, gamma: 0.4912 }, Madera: { alfa: 0.01076, beta: 0.001862, gamma: 1.170 } },
    70: { Plomo: { alfa: 5.369, beta: 23.49, gamma: 0.5883 }, Hormigon: { alfa: 0.05090, beta: 0.1697, gamma: 0.3849 }, "Tablero de yeso": { alfa: 0.02300, beta: 0.07160, gamma: 0.7300 }, Acero: { alfa: 0.7149, beta: 3.798, gamma: 0.5381 }, "Vidrio plano": { alfa: 0.05791, beta: 0.1357, gamma: 0.5968 }, Madera: { alfa: 0.008550, beta: 0.000539, gamma: 1.194 } },
    100: { Plomo: { alfa: 2.507, beta: 15.33, gamma: 0.9124 }, Hormigon: { alfa: 0.03950, beta: 0.08440, gamma: 0.5191 }, "Tablero de yeso": { alfa: 0.01470, beta: 0.04000, gamma: 0.9752 }, Acero: { alfa: 0.3424, beta: 2.456, gamma: 0.9388 }, "Vidrio plano": { alfa: 0.04279, beta: 0.08948, gamma: 1.029 }, Madera: { alfa: 0.007230, beta: 0.000894, gamma: 1.316 } },
    125: { Plomo: { alfa: 2.233, beta: 7.888, gamma: 0.7295 }, Hormigon: { alfa: 0.03510, beta: 0.06600, gamma: 0.7832 }, "Tablero de yeso": { alfa: 0.01200, beta: 0.02670, gamma: 1.079 }, Acero: { alfa: 0.2138, beta: 1.690, gamma: 1.086 }, "Vidrio plano": { alfa: 0.03654, beta: 0.05790, gamma: 1.093 }, Madera: { alfa: 0.006587, beta: -0.00114, gamma: 1.172 } },
    150: { Plomo: { alfa: 1.791, beta: 5.478, gamma: 0.5678 }, Hormigon: { alfa: 0.03240, beta: 0.07750, gamma: 1.566 }, "Tablero de yeso": { alfa: 0.01040, beta: 0.02020, gamma: 1.135 }, Acero: { alfa: 0.1511, beta: 1.124, gamma: 1.151 }, "Vidrio plano": { alfa: 0.03267, beta: 0.04074, gamma: 1.134 }, Madera: { alfa: 0.006027, beta: -0.00163, gamma: 1.440 } },
};

export const TABLA_C1_TRANSMISION_SECUNDARIA_POR_CARGA: Record<DistribucionCargaTrabajoNCRP147, Record<MaterialNCRP147, CoeficientesArcher>> = {
    "Sala Rx (todas las barreras)": { Plomo: { alfa: 2.298, beta: 17.38, gamma: 0.6193 }, Hormigon: { alfa: 0.03610, beta: 0.1433, gamma: 0.5600 }, "Tablero de yeso": { alfa: 0.01380, beta: 0.05700, gamma: 0.7937 }, Acero: { alfa: 0.2191, beta: 3.490, gamma: 0.7358 }, "Vidrio plano": { alfa: 0.03873, beta: 0.1054, gamma: 0.6397 }, Madera: { alfa: 0.007552, beta: 0.000737, gamma: 1.044 } },
    "Sala Rx (bucky de torax)": { Plomo: { alfa: 2.256, beta: 13.80, gamma: 0.8837 }, Hormigon: { alfa: 0.03560, beta: 0.1079, gamma: 0.7705 }, "Tablero de yeso": { alfa: 0.01270, beta: 0.04450, gamma: 1.049 }, Acero: { alfa: 0.2211, beta: 2.836, gamma: 1.123 }, "Vidrio plano": { alfa: 0.03749, beta: 0.08710, gamma: 0.9086 }, Madera: { alfa: 0.007058, beta: 0.000229, gamma: 1.875 } },
    "Sala Rx (piso u otras barreras)": { Plomo: { alfa: 2.513, beta: 17.34, gamma: 0.4994 }, Hormigon: { alfa: 0.03920, beta: 0.1464, gamma: 0.4486 }, "Tablero de yeso": { alfa: 0.01640, beta: 0.06080, gamma: 0.7472 }, Acero: { alfa: 0.2440, beta: 3.012, gamma: 0.5019 }, "Vidrio plano": { alfa: 0.04299, beta: 0.1070, gamma: 0.5538 }, Madera: { alfa: 0.007887, beta: 0.000877, gamma: 0.9800 } },
    "Tubo de fluoroscopia (sala R&F)": { Plomo: { alfa: 2.322, beta: 12.91, gamma: 0.7575 }, Hormigon: { alfa: 0.03630, beta: 0.09360, gamma: 0.5955 }, "Tablero de yeso": { alfa: 0.01330, beta: 0.04100, gamma: 0.9566 }, Acero: { alfa: 0.2331, beta: 2.213, gamma: 0.8051 }, "Vidrio plano": { alfa: 0.03886, beta: 0.08091, gamma: 0.8520 }, Madera: { alfa: 0.007057, beta: 0.000422, gamma: 1.664 } },
    "Tubo de Rx (sala R&F)": { Plomo: { alfa: 2.272, beta: 13.60, gamma: 0.7184 }, Hormigon: { alfa: 0.03560, beta: 0.1114, gamma: 0.6620 }, "Tablero de yeso": { alfa: 0.01290, beta: 0.04570, gamma: 0.9355 }, Acero: { alfa: 0.2149, beta: 2.695, gamma: 0.8768 }, "Vidrio plano": { alfa: 0.03762, beta: 0.08857, gamma: 0.8087 }, Madera: { alfa: 0.007102, beta: 0.000345, gamma: 1.698 } },
    "Sala de torax": { Plomo: { alfa: 2.288, beta: 9.848, gamma: 1.054 }, Hormigon: { alfa: 0.03640, beta: 0.06590, gamma: 0.7543 }, "Tablero de yeso": { alfa: 0.01300, beta: 0.02970, gamma: 1.195 }, Acero: { alfa: 0.2518, beta: 1.829, gamma: 1.273 }, "Vidrio plano": { alfa: 0.03866, beta: 0.06270, gamma: 1.128 }, Madera: { alfa: 0.007485, beta: -0.000810, gamma: 0.09459 } },
    "Sala de mamografia": { Plomo: { alfa: 29.91, beta: 184.4, gamma: 0.3550 }, Hormigon: { alfa: 0.2539, beta: 1.8411, gamma: 0.3924 }, "Tablero de yeso": { alfa: 0.08830, beta: 0.7526, gamma: 0.3786 }, Acero: { alfa: 5.798, beta: 44.12, gamma: 0.4124 }, "Vidrio plano": { alfa: 0.2404, beta: 1.709, gamma: 0.3918 }, Madera: { alfa: 0.01888, beta: 0.04172, gamma: 0.2903 } },
    "Angiografia cardiaca": { Plomo: { alfa: 2.354, beta: 14.94, gamma: 0.7481 }, Hormigon: { alfa: 0.03710, beta: 0.1067, gamma: 0.5733 }, "Tablero de yeso": { alfa: 0.01390, beta: 0.04640, gamma: 0.9185 }, Acero: { alfa: 0.2530, beta: 2.592, gamma: 0.7999 }, "Vidrio plano": { alfa: 0.04001, beta: 0.09030, gamma: 0.8019 }, Madera: { alfa: 0.007266, beta: 0.000674, gamma: 1.235 } },
    "Angiografia periferica (y neuroangiografia)": { Plomo: { alfa: 2.661, beta: 19.54, gamma: 0.5094 }, Hormigon: { alfa: 0.04219, beta: 0.1559, gamma: 0.4472 }, "Tablero de yeso": { alfa: 0.01747, beta: 0.06422, gamma: 0.7299 }, Acero: { alfa: 0.3579, beta: 3.466, gamma: 0.5600 }, "Vidrio plano": { alfa: 0.04612, beta: 0.1198, gamma: 0.5907 }, Madera: { alfa: 0.008079, beta: 0.000847, gamma: 0.9742 } },
};

/**
* TABLA 4.5 (NCRP 147, pag. 43) - Kerma en aire PRIMARIO no blindado por
* paciente [K1_P, en mGy paciente^-1] a distancia de haz primario dP = 1 m,
* para las distribuciones de carga de trabajo que dan lugar a barreras
* PRIMARIAS (las demas modalidades usan el receptor de imagen como tope de
* haz primario y solo requieren blindaje secundario). Wnorm es la carga de
* trabajo normalizada (mA min paciente^-1) de la encuesta AAPM TG9
* (Simpkin, 1996a); permite aplicar el factor de escala Wsite/Wnorm (Ec. 4.2)
* si la carga real del sitio difiere del valor de la encuesta.
* Extraido por lectura directa del texto fuente (get_page_text), sin zoom
* visual (no contiene coeficientes alfa/beta/gamma, solo valores tabulares).
*/
export const TABLA_4_5_KERMA_PRIMARIO_NO_BLINDADO: Partial<Record<DistribucionCargaTrabajoNCRP147, { wNormMAminPorPaciente: number; k1PmGyPorPacienteA1m: number }>> = {
    "Sala Rx (bucky de torax)": { wNormMAminPorPaciente: 0.6, k1PmGyPorPacienteA1m: 2.3 },
    "Sala Rx (piso u otras barreras)": { wNormMAminPorPaciente: 1.9, k1PmGyPorPacienteA1m: 5.2 },
    "Tubo de Rx (sala R&F)": { wNormMAminPorPaciente: 1.5, k1PmGyPorPacienteA1m: 5.9 },
    "Sala de torax": { wNormMAminPorPaciente: 0.22, k1PmGyPorPacienteA1m: 1.2 },
};

/**
* TABLA 4.7 (NCRP 147, pag. 46-47) - Kerma en aire SECUNDARIO (fuga,
* dispersion y total) no blindado por paciente [mGy paciente^-1], evaluado a
* dS = dL = 1 m, para cada una de las 9 distribuciones de carga de trabajo
* clinica. La columna "lateral" usa dispersion a 90 grados (side-scatter);
* la columna "frontalTrasera" usa dispersion a 135 grados (conservador,
* tambien aplicado a 30 grados). F = area del campo primario (cm2) a
* distancia dF (m) del tubo, incluidos por referencia (usados para calcular
* la fraccion de dispersion a1, Seccion 4.1.7.2). Los factores tecnicos de
* fuga son 150 kVp a 3.3 mA (0.876 mGy/h a 1 m) para todos los tubos excepto
* mamografia (50 kVp a 5 mA).
* Extraido por lectura directa del texto fuente (get_page_text), sin zoom
* visual (no contiene coeficientes alfa/beta/gamma, solo valores tabulares).
*/
export const TABLA_4_7_KERMA_SECUNDARIO_NO_BLINDADO: Record<DistribucionCargaTrabajoNCRP147, {
    wNormMAminPorPaciente: number;
    areaCampoCm2: number;
    distanciaCampoDfMetros: number;
    fugaMGyPorPaciente: number;
    dispersionLateralMGyPorPaciente: number;
    fugaMasLateralMGyPorPaciente: number;
    dispersionFrontalTraseraMGyPorPaciente: number;
    fugaMasFrontalTraseraMGyPorPaciente: number;
}> = {
    "Sala Rx (todas las barreras)": { wNormMAminPorPaciente: 2.5, areaCampoCm2: 1000, distanciaCampoDfMetros: 1.00, fugaMGyPorPaciente: 5.3e-4, dispersionLateralMGyPorPaciente: 3.4e-2, fugaMasLateralMGyPorPaciente: 3.4e-2, dispersionFrontalTraseraMGyPorPaciente: 4.8e-2, fugaMasFrontalTraseraMGyPorPaciente: 4.9e-2 },
    "Sala Rx (bucky de torax)": { wNormMAminPorPaciente: 0.60, areaCampoCm2: 1535, distanciaCampoDfMetros: 1.83, fugaMGyPorPaciente: 3.9e-4, dispersionLateralMGyPorPaciente: 4.9e-3, fugaMasLateralMGyPorPaciente: 5.3e-3, dispersionFrontalTraseraMGyPorPaciente: 6.9e-3, fugaMasFrontalTraseraMGyPorPaciente: 7.3e-3 },
    "Sala Rx (piso u otras barreras)": { wNormMAminPorPaciente: 1.9, areaCampoCm2: 1000, distanciaCampoDfMetros: 1.00, fugaMGyPorPaciente: 1.4e-4, dispersionLateralMGyPorPaciente: 2.3e-2, fugaMasLateralMGyPorPaciente: 2.3e-2, dispersionFrontalTraseraMGyPorPaciente: 3.3e-2, fugaMasFrontalTraseraMGyPorPaciente: 3.3e-2 },
    "Tubo de fluoroscopia (sala R&F)": { wNormMAminPorPaciente: 13, areaCampoCm2: 730, distanciaCampoDfMetros: 0.80, fugaMGyPorPaciente: 1.2e-2, dispersionLateralMGyPorPaciente: 3.1e-1, fugaMasLateralMGyPorPaciente: 3.2e-1, dispersionFrontalTraseraMGyPorPaciente: 4.4e-1, fugaMasFrontalTraseraMGyPorPaciente: 4.6e-1 },
    "Tubo de Rx (sala R&F)": { wNormMAminPorPaciente: 1.5, areaCampoCm2: 1000, distanciaCampoDfMetros: 1.00, fugaMGyPorPaciente: 9.4e-4, dispersionLateralMGyPorPaciente: 2.8e-2, fugaMasLateralMGyPorPaciente: 2.9e-2, dispersionFrontalTraseraMGyPorPaciente: 3.9e-2, fugaMasFrontalTraseraMGyPorPaciente: 4.0e-2 },
    "Sala de torax": { wNormMAminPorPaciente: 0.22, areaCampoCm2: 1535, distanciaCampoDfMetros: 2.00, fugaMGyPorPaciente: 3.8e-4, dispersionLateralMGyPorPaciente: 2.3e-3, fugaMasLateralMGyPorPaciente: 2.7e-3, dispersionFrontalTraseraMGyPorPaciente: 3.2e-3, fugaMasFrontalTraseraMGyPorPaciente: 3.6e-3 },
    "Sala de mamografia": { wNormMAminPorPaciente: 6.7, areaCampoCm2: 720, distanciaCampoDfMetros: 0.58, fugaMGyPorPaciente: 1.1e-5, dispersionLateralMGyPorPaciente: 1.1e-2, fugaMasLateralMGyPorPaciente: 1.1e-2, dispersionFrontalTraseraMGyPorPaciente: 4.9e-2, fugaMasFrontalTraseraMGyPorPaciente: 4.9e-2 },
    "Angiografia cardiaca": { wNormMAminPorPaciente: 160, areaCampoCm2: 730, distanciaCampoDfMetros: 0.90, fugaMGyPorPaciente: 8.8e-2, dispersionLateralMGyPorPaciente: 2.6, fugaMasLateralMGyPorPaciente: 2.7, dispersionFrontalTraseraMGyPorPaciente: 3.7, fugaMasFrontalTraseraMGyPorPaciente: 3.8 },
    "Angiografia periferica (y neuroangiografia)": { wNormMAminPorPaciente: 64, areaCampoCm2: 730, distanciaCampoDfMetros: 0.90, fugaMGyPorPaciente: 3.4e-3, dispersionLateralMGyPorPaciente: 6.6e-1, fugaMasLateralMGyPorPaciente: 6.6e-1, dispersionFrontalTraseraMGyPorPaciente: 9.5e-1, fugaMasFrontalTraseraMGyPorPaciente: 9.5e-1 },
};

/**
* Ecuacion A.2: transmision B(x) para un espesor x (mm) dado un set de
* coeficientes de Archer (alfa, beta, gamma).
*/
export function transmisionArcher(espesorMm: number, coef: CoeficientesArcher): number {
    const { alfa, beta, gamma } = coef;
    const r = beta / alfa;
    const base = (1 + r) * Math.exp(alfa * gamma * espesorMm) - r;
    return Math.pow(base, -1 / gamma);
}

/**
* Ecuacion A.3: espesor x (mm) requerido para alcanzar una transmision B dada.
*/
export function espesorRequeridoArcher(transmisionB: number, coef: CoeficientesArcher): number {
    const { alfa, beta, gamma } = coef;
    const r = beta / alfa;
    const numerador = Math.pow(transmisionB, -gamma) + r;
    const denominador = 1 + r;
    return (1 / (alfa * gamma)) * Math.log(numerador / denominador);
}

export interface ParametrosBarreraPrimariaNCRP147 {
    k1PmGyPorPacienteA1m: number;
    nPacientesPorSemana: number;
    factorUsoU: number;
    distanciaMetros: number;
    objetivoDisenoPmGyPorSemana: number;
    factorOcupacionT: number;
    coeficientes: CoeficientesArcher;
}

export interface ResultadoBarreraNCRP147 {
    kermaNoAtenuadoMGyPorSemana: number;
    transmisionRequerida: number;
    espesorRequeridoMm: number;
}

/**
* Espesor de barrera PRIMARIA requerido (Apendice B, Eq. B.6, B.8, B.9).
*/
export function calcularBarreraPrimariaNCRP147(p: ParametrosBarreraPrimariaNCRP147): ResultadoBarreraNCRP147 {
    const kermaNoAtenuado = (p.k1PmGyPorPacienteA1m * p.nPacientesPorSemana * p.factorUsoU) / (p.distanciaMetros * p.distanciaMetros);
    const transmisionRequerida = (p.objetivoDisenoPmGyPorSemana / p.factorOcupacionT) / kermaNoAtenuado;
    const espesorRequeridoMm = espesorRequeridoArcher(transmisionRequerida, p.coeficientes);
    return { kermaNoAtenuadoMGyPorSemana: kermaNoAtenuado, transmisionRequerida, espesorRequeridoMm };
}

export interface ParametrosBarreraSecundariaNCRP147 {
    k1SecMGyPorPacienteA1m: number;
    nPacientesPorSemana: number;
    distanciaMetros: number;
    objetivoDisenoPmGyPorSemana: number;
    factorOcupacionT: number;
    coeficientes: CoeficientesArcher;
}

/**
* Espesor de barrera SECUNDARIA requerido (Apendice C, Eq. C.13, C.15).
* No incluye factor de uso U: la radiacion secundaria se asume presente
* independientemente del factor de uso del haz primario.
*/
export function calcularBarreraSecundariaNCRP147(p: ParametrosBarreraSecundariaNCRP147): ResultadoBarreraNCRP147 {
    const kermaNoAtenuado = (p.k1SecMGyPorPacienteA1m * p.nPacientesPorSemana) / (p.distanciaMetros * p.distanciaMetros);
    const transmisionRequerida = (p.objetivoDisenoPmGyPorSemana / p.factorOcupacionT) / kermaNoAtenuado;
    const espesorRequeridoMm = espesorRequeridoArcher(transmisionRequerida, p.coeficientes);
    return { kermaNoAtenuadoMGyPorSemana: kermaNoAtenuado, transmisionRequerida, espesorRequeridoMm };
}
