// Modulo "Liberacion de Sala": evaluacion diaria de contaminacion superficial
// en Medicina Nuclear, dividida en dos areas independientes (Laboratorio y
// Sala de Pacientes), cada una con sus propios puntos de medicion fijos.
// Reutiliza el motor de calculo cientifico ya validado en src/lib/contamination.ts
// (CPS neto, Bq/cm2, clasificacion por semaforo) y los limites configurables
// por radionuclido de la tabla contamination_limits.

import {
  calcConteoNeto,
  calcActividadBqCm2,
  bqCm2ToBqM2,
  clasificarPorcentaje,
  CLASIFICACION_SEMAFORO,
  type Clasificacion,
} from "./contamination";

// Radionúclidos para monitoreo de liberación de sala. Sincronizado con RADIONUCLIDOS
// en contamination.ts. Incluye los radionúclidos activos en la práctica clínica del HHHA.
export const RC_RADIONUCLIDOS = ["TC-99M", "I-131", "I-123", "GA-67", "GA-68", "F-18", "LU-177", "OTRO"] as const;
export type RcRadionuclido = (typeof RC_RADIONUCLIDOS)[number];

export type RcAreaTipo = "laboratorio" | "sala_pacientes";

export const RC_AREA_LABELS: Record<RcAreaTipo, string> = {
  laboratorio: "Laboratorio",
  sala_pacientes: "Sala de Pacientes",
};

// Puntos de medicion fijos por area, segun especificacion del modulo.
export const RC_LABORATORIO_PUNTOS = [
  "Mesón de laboratorio",
  "Bandejas",
  "Mesa de punción",
  "Portajeringas",
  "Camilla de laboratorio",
  "Piso de Gammacámara",
] as const;

export const RC_SALA_PACIENTES_PUNTOS = [
  "Sala del paciente",
  "Cama",
  "Ropa de cama",
  "Almohada", // mismo criterio de contaminación que "Ropa de cama" (sección 13 del documento; sin límite independiente salvo referencia oficial que lo establezca)
  "Piso baño del paciente",
  "WC del paciente",
  "Lavamanos del paciente",
  "Piso baño del personal",
  "Lavamanos baño del personal",
  "Basurero cortopunzante",
] as const;

export function puntosFijosPorArea(area: RcAreaTipo): readonly string[] {
  return area === "laboratorio" ? RC_LABORATORIO_PUNTOS : RC_SALA_PACIENTES_PUNTOS;
}

// Parámetros por defecto del detector Geiger-Müller tipo pancake.
// Aplicados automáticamente para mantener consistencia con /api/contamination.
//
// IMPORTANTE – Base de calibración y limitaciones:
//   RC_DEFAULT_FACTOR_EFICIENCIA = 0,15 (15 %) está calibrado para Tc-99m a
//   contacto, detector tipo Ludlum 44-9 o equivalente. Para otros radionúclidos
//   la eficiencia varía significativamente:
//     - I-131  (364 keV γ):  ~8–12 % con detector GM pancake
//     - GA-68  (511 keV β⁺): variable; se requiere calibración específica
//     - LU-177 (208 keV γ):  ~10–15 %
//     - F-18   (511 keV):    ~5–10 %
//   El OPR debe ingresar la eficiencia real calibrada por instrumento/radionúclido
//   desde la matriz de calibración (waste_calibration_matrix) para cada medición
//   donde el radionúclido no sea Tc-99m.
//
//   RC_DEFAULT_AREA_MONITOREADA_CM2 = 15 cm² corresponde al área activa típica de
//   un detector GM pancake (diámetro ~4,4 cm → ~15 cm²). Verificar con la ficha
//   técnica del instrumento específico en uso en el HHHA.
export const RC_DEFAULT_FACTOR_EFICIENCIA = 0.15;
export const RC_DEFAULT_AREA_MONITOREADA_CM2 = 15;

export type RcEstadoGeneral = "conforme" | "requiere_descontaminacion" | "liberado" | "no_liberado";

export const RC_ESTADO_GENERAL_LABELS: Record<RcEstadoGeneral, string> = {
  conforme: "Conforme",
  requiere_descontaminacion: "Requiere descontaminación",
  liberado: "Liberado",
  no_liberado: "No liberado",
};

export type RcPointInput = {
  punto: string;
  cps_medida: number;
  cps_fondo: number;
  tasa_dosis_usv_h: number | null;
};

export type RcLimite = {
  limite_bq_m2: number;
  pct_registro: number;
  pct_investigacion: number;
  pct_intervencion: number;
};

export type RcPointResult = RcPointInput & {
  cps_neto: number;
  bq_cm2: number;
  bq_m2: number;
  pct_limite: number | null;
  clasificacion: Clasificacion;
  semaforo: "verde" | "amarillo" | "rojo";
  cumple: boolean;
};

// Evalua un unico punto de medicion: calcula CPS neto, Bq/cm2, clasificacion
// por semaforo y si "cumple" (verde/amarillo se consideran conformes; solo
// "sobre_limite" -rojo- se considera No cumple).
export function evaluarPuntoRoomClearance(input: RcPointInput, limite: RcLimite | null): RcPointResult {
  const cps_neto = calcConteoNeto(input.cps_medida, input.cps_fondo);
  const bq_cm2 = calcActividadBqCm2(cps_neto, RC_DEFAULT_FACTOR_EFICIENCIA, RC_DEFAULT_AREA_MONITOREADA_CM2);
  const bq_m2 = bqCm2ToBqM2(bq_cm2);

  let pct_limite: number | null = null;
  let clasificacion: Clasificacion = "sin_contaminacion";
  if (limite) {
    pct_limite = limite.limite_bq_m2 ? (bq_m2 / limite.limite_bq_m2) * 100 : 0;
    clasificacion = clasificarPorcentaje(pct_limite, limite);
  }
  const semaforo = CLASIFICACION_SEMAFORO[clasificacion];
  const cumple = clasificacion !== "sobre_limite";

  return { ...input, cps_neto, bq_cm2, bq_m2, pct_limite, clasificacion, semaforo, cumple };
}

export type RcResumenArea = {
  total_puntos: number;
  puntos_contaminados: number;
  punto_mayor_contaminacion: string | null;
  mayor_tasa_dosis_usv_h: number | null;
  max_bq_cm2: number;
  estado_general: RcEstadoGeneral;
};

// Genera el "Estado General" automático de un área (Laboratorio o Sala de
// Pacientes) a partir de sus puntos ya evaluados.
//
// Regla aplicada (por orden de precedencia):
//   1. Si hay ≥1 punto "sobre_limite" (rojo):
//      → "no_liberado" (área no liberable).
//      Si además "limpiezaRealizada" es true, el estado es "requiere_descontaminacion"
//      como señal de flujo de trabajo (indica que ya se intentó una limpieza pero no
//      fue suficiente — el área SIGUE SIN PODERSE LIBERAR hasta nueva medición).
//      NOTA: ambos estados implican que el área NO puede liberarse; la distinción es
//      de flujo interno para el registro de acciones correctivas.
//   2. Si hay puntos "cercano_limite" (amarillo) pero ninguno rojo:
//      → "conforme" (área con monitoreo; no requiere acción inmediata).
//   3. Si todos los puntos son verdes:
//      → "liberado" (área apta para uso sin restricción radiológica).
export function calcularResumenArea(puntos: RcPointResult[], limpiezaRealizada = false): RcResumenArea {
  const total_puntos = puntos.length;
  const contaminados = puntos.filter(
    (p) => p.clasificacion === "sobre_limite" || p.clasificacion === "cercano_limite"
  );
  const sobreLimite = puntos.filter((p) => p.clasificacion === "sobre_limite");

  let punto_mayor_contaminacion: string | null = null;
  let max_bq_cm2 = 0;
  let mayor_tasa_dosis_usv_h: number | null = null;

  for (const p of puntos) {
    if (p.bq_cm2 >= max_bq_cm2) {
      max_bq_cm2 = p.bq_cm2;
      punto_mayor_contaminacion = p.punto;
    }
    if (
      p.tasa_dosis_usv_h !== null &&
      (mayor_tasa_dosis_usv_h === null || p.tasa_dosis_usv_h > mayor_tasa_dosis_usv_h)
    ) {
      mayor_tasa_dosis_usv_h = p.tasa_dosis_usv_h;
    }
  }

  let estado_general: RcEstadoGeneral;
  if (sobreLimite.length > 0) {
    estado_general = limpiezaRealizada ? "requiere_descontaminacion" : "no_liberado";
  } else if (contaminados.length > 0) {
    estado_general = "conforme";
  } else {
    estado_general = total_puntos > 0 ? "liberado" : "conforme";
  }

  return {
    total_puntos,
    puntos_contaminados: contaminados.length,
    punto_mayor_contaminacion: total_puntos > 0 ? punto_mayor_contaminacion : null,
    mayor_tasa_dosis_usv_h,
    max_bq_cm2,
    estado_general,
  };
}

// Recomendacion automatica de descontaminacion para un punto fuera de norma,
// mostrada en la alerta visual roja.
export function recomendacionDescontaminacion(punto: string, area: RcAreaTipo): string {
  return `Se detectó contaminación sobre el límite permitido en "${punto}" (${RC_AREA_LABELS[area]}). Se recomienda descontaminar la superficie, repetir la medición y no liberar el área hasta confirmar que el nivel es conforme.`;
}

export type RcEvaluationRow = {
  id: number;
  eval_date: string;
  responsable: string;
  radionuclido: string;
  instrumento_utilizado: string | null;
  observaciones_generales: string | null;
  estado_general_laboratorio: RcEstadoGeneral;
  resumen_laboratorio: RcResumenArea;
  estado_general_sala: RcEstadoGeneral;
  resumen_sala: RcResumenArea;
  usuario: string | null;
  version_formulario: string;
  created_at: string;
  updated_at: string;
};

export const RC_VERSION_FORMULARIO = "1.0";
