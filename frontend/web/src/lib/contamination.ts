export const RADIONUCLIDOS = ["TC-99M", "I-131", "GA-67", "F-18", "OTRO"] as const;

export const CONTAMINATION_SUGGESTION_FIELDS = [
    "area",
    "sala",
    "dependencia",
    "punto_medicion",
    "equipo",
    "superficie",
    "radionuclido",
    "instrumento",
    "numero_serie_detector",
    "responsable",
    "motivo",
    "accion_correctiva",
    "observaciones",
  ] as const;

export type ContaminationSuggestionField = (typeof CONTAMINATION_SUGGESTION_FIELDS)[number];

export const CONTAMINATION_SUGGESTION_FIELD_LABELS: Record<string, string> = {
    area: "Área",
    sala: "Sala",
    dependencia: "Dependencia",
    punto_medicion: "Punto de medición",
    equipo: "Equipo",
    superficie: "Superficie",
    radionuclido: "Radionúclido",
    instrumento: "Instrumento",
    numero_serie_detector: "N° de serie del detector",
    responsable: "Responsable",
    motivo: "Motivo",
    accion_correctiva: "Acción correctiva",
    observaciones: "Observaciones",
};

export const MESES = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ];

export function mesNombre(mes: number): string {
    return MESES[mes - 1] ?? "";
}

export function daysInMonth(year: number, month: number): number {
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
}

export function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

export function buildMonitorDate(year: number, month: number, day: number): string {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normText(s: string | null | undefined): string {
    return (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
}

export function buildDedupeKey(parts: {
    monitor_date: string;
    punto_medicion: string;
    radionuclido?: string | null;
    conteo_bruto_cps?: number | null;
}): string {
    return [
          parts.monitor_date,
          normText(parts.punto_medicion),
          normText(parts.radionuclido),
          parts.conteo_bruto_cps ?? "",
        ].join("|");
}

// ---------------------------------------------------------------------------
// Calculos cientificos validados para monitoreo de contaminacion superficial.
//
// Metodologia de referencia: IAEA Safety Reports Series No. 63 "Applying
// Radiation Safety Standards in Nuclear Medicine" y la practica estandar de
// fisica de la radiacion para instrumentos tipo GM/pancake:
//
//   Actividad superficial (Bq/cm2) = Tasa de conteo neta (cps) /
//                                     (Eficiencia del detector x Area monitoreada (cm2))
//
// donde tasa de conteo neta = conteo bruto (cps) - fondo (cps).
//
// Esta formula ya estaba correctamente implementada en la planilla original
// (columna BQ/CM), por lo que se preserva su logica, exponiendo eficiencia y
// area como campos configurables por registro/instrumento en vez de
// constantes ocultas en la formula.
// ---------------------------------------------------------------------------

export function calcConteoNeto(bruto: number, fondo: number): number {
    const neto = (bruto ?? 0) - (fondo ?? 0);
    return neto > 0 ? neto : 0;
}

export function calcActividadBqCm2(conteoNeto: number, eficiencia: number, areaCm2: number): number {
    if (!eficiencia || !areaCm2) return 0;
    return conteoNeto / (eficiencia * areaCm2);
}

export function bqCm2ToBqM2(bqCm2: number): number {
    return bqCm2 * 10000;
}

export type Clasificacion = "sin_contaminacion" | "bajo_referencia" | "cercano_limite" | "sobre_limite";

export const CLASIFICACION_LABELS: Record<Clasificacion, string> = {
    sin_contaminacion: "Sin contaminación detectable",
    bajo_referencia: "Bajo el nivel de referencia",
    cercano_limite: "Cercano al límite",
    sobre_limite: "Sobre el límite",
};

export const CLASIFICACION_SEMAFORO: Record<Clasificacion, "verde" | "amarillo" | "rojo"> = {
    sin_contaminacion: "verde",
    bajo_referencia: "verde",
    cercano_limite: "amarillo",
    sobre_limite: "rojo",
};

// Clasifica el resultado como fraccion (%) del limite de referencia
// configurable (limite_bq_m2), usando umbrales tambien configurables
// pct_registro / pct_investigacion / pct_intervencion (por defecto 5/30/50,
// consistentes con el esquema "Registro / Investigacion / Intervencion" de la
// planilla original). A diferencia de la planilla original -que aplicaba la
// misma formula, con un error de conversion de unidades (Bq/cm2 a Bq/m2), a
// las tres columnas por separado- aqui se calcula un unico porcentaje
// correcto y se compara contra los tres umbrales.
export function clasificarPorcentaje(
    pct: number,
    umbrales: { pct_registro: number; pct_investigacion: number; pct_intervencion: number }
  ): Clasificacion {
    if (pct < umbrales.pct_registro) return "sin_contaminacion";
    if (pct < umbrales.pct_investigacion) return "bajo_referencia";
    if (pct < umbrales.pct_intervencion) return "cercano_limite";
    return "sobre_limite";
}

// Factor de descontaminacion: relacion entre la actividad superficial inicial
// y la actividad remanente tras la limpieza. Corrige el error de la planilla
// original, que calculaba este factor como (conteo medido / fondo) del mismo
// punto y momento, sin relacion con una limpieza real.
export function calcFactorDescontaminacion(actividadInicial: number, actividadFinal: number): number | null {
    if (!actividadFinal || actividadFinal <= 0) return null;
    if (!actividadInicial || actividadInicial <= 0) return null;
    return actividadInicial / actividadFinal;
}

export function calcPctActividadResidual(actividadInicial: number, actividadFinal: number): number | null {
    if (!actividadInicial || actividadInicial <= 0) return null;
    return (actividadFinal / actividadInicial) * 100;
}

export type ContaminationRecord = {
    id: number;
    monitor_year: number;
    monitor_month: number;
    monitor_day: number;
    monitor_date: string;
    area: string | null;
    sala: string | null;
    dependencia: string | null;
    punto_medicion: string;
    equipo: string | null;
    superficie: string | null;
    radionuclido: string;
    instrumento: string | null;
    numero_serie_detector: string | null;
    factor_calibracion: number | null;
    factor_eficiencia: number;
    area_monitoreada_cm2: number;
    tiempo_medicion_seg: number | null;
    fondo_cps: number;
    conteo_bruto_cps: number;
    conteo_neto_cps: number;
    actividad_bq_cm2: number;
    actividad_bq_m2: number;
    tasa_dosis_usv_h: number | null;
    limite_bq_m2_aplicado: number | null;
    pct_limite: number | null;
    clasificacion: Clasificacion;
    semaforo: "verde" | "amarillo" | "rojo";
    requiere_limpieza: boolean;
    limpieza_realizada: boolean;
    conteo_post_limpieza_cps: number | null;
    actividad_post_limpieza_bq_cm2: number | null;
    factor_descontaminacion: number | null;
    pct_actividad_residual: number | null;
    accion_correctiva: string | null;
    estado: string;
    motivo: string | null;
    responsable: string;
    observaciones: string | null;
    created_at: string;
    updated_at: string;
};

export const ESTADO_OPTIONS = ["ABIERTO", "EN_PROCESO", "CERRADO"];
export const SUPERFICIE_OPTIONS = ["Metal", "Plástico", "Cerámica", "Piso", "Madera", "Piel/Guantes", "Otro"];

export const CONTAMINATION_SORT_FIELDS = [
    "monitor_date",
    "punto_medicion",
    "radionuclido",
    "actividad_bq_m2",
    "pct_limite",
    "clasificacion",
    "estado",
    "created_at",
  ] as const;
export type ContaminationSortField = (typeof CONTAMINATION_SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";
