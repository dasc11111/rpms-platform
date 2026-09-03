// ============================================================================
// Sistema Experto de Gestion de Desechos Radiactivos - Medicina Nuclear
// FASE D: UI - Etiquetas, tonos y opciones para la capa de presentacion.
//
// Este archivo NO contiene logica de decision (esa vive en waste-expert.ts
// y en las rutas API). Solo traduce los valores tecnicos (estados, tipos,
// enums) a etiquetas legibles y a los tonos visuales del design system
// (secciones 6, 9, 10, 31 del Prompt Maestro Definitivo).
// ============================================================================

import type { BadgeTone } from "@/components/ui/Badge";
import type { SemaphoreLevel } from "@/lib/design-system";
import type { WasteItemEstado } from "@/lib/waste-expert";

export const WASTE_ITEM_ESTADO_META: Record<
  WasteItemEstado,
{ label: string; emoji: string; badgeTone: BadgeTone; level: SemaphoreLevel }
  > = {
  registrado: { label: "Registrado", emoji: "🔵", badgeTone: "info", level: "unknown" },
  en_decaimiento: { label: "En decaimiento", emoji: "🟠", badgeTone: "warning", level: "warning" },
  pendiente_medicion: { label: "Pendiente de medición", emoji: "🟡", badgeTone: "warning", level: "warning" },
  pendiente_verificacion: { label: "Pendiente de verificación", emoji: "🟡", badgeTone: "warning", level: "warning" },
  disponible_evaluacion_final: { label: "Disponible evaluación final", emoji: "🟢", badgeTone: "success", level: "ok" },
  liberado: { label: "Liberado", emoji: "🟢", badgeTone: "success", level: "ok" },
  no_cumple: { label: "No cumple criterio", emoji: "🔴", badgeTone: "danger", level: "critical" },
  bloqueado: { label: "Bloqueado", emoji: "⚫", badgeTone: "neutral", level: "disabled" },
};

export function wasteEstadoLabel(estado: string | null | undefined): string {
  if (!estado) return "—";
  const meta = WASTE_ITEM_ESTADO_META[estado as WasteItemEstado];
  return meta ? `${meta.emoji} ${meta.label}` : estado;
}

export const TIPO_RESIDUO_OPTIONS: { value: string; label: string }[] = [
  { value: "solido", label: "Sólido" },
  { value: "liquido", label: "Líquido" },
  { value: "vial", label: "Vial" },
  { value: "jeringa", label: "Jeringa" },
  { value: "aguja", label: "Aguja" },
  { value: "algodon", label: "Algodón" },
  { value: "absorbente", label: "Absorbente" },
  { value: "guantes", label: "Guantes" },
  { value: "epp", label: "EPP" },
  { value: "ropa", label: "Ropa" },
  { value: "radiofarmaco", label: "Radiofármaco" },
  { value: "fuente", label: "Fuente" },
  { value: "generador", label: "Generador" },
  { value: "superficie_contaminada", label: "Superficie contaminada" },
  { value: "equipo", label: "Equipo" },
  { value: "otro", label: "Otro" },
  ];

export function tipoResiduoLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return TIPO_RESIDUO_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const UNIDAD_ACTIVIDAD_OPTIONS = ["mCi", "Ci", "uCi", "Bq", "kBq", "MBq", "GBq"];

export const TIPO_MEDICION_OPTIONS: { value: string; label: string }[] = [
  { value: "directa", label: "Medición directa (contaminación)" },
  { value: "wipe", label: "Wipe test (contaminación removible)" },
  { value: "tasa_dosis", label: "Tasa de dosis" },
  ];

export function tipoMedicionLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return TIPO_MEDICION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const AREA_TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: "ventana_detector", label: "Ventana del detector" },
  { value: "area_activa", label: "Área activa del detector" },
  { value: "area_efectiva", label: "Área efectiva de calibración" },
  { value: "area_superficie_evaluada", label: "Área de superficie evaluada" },
  { value: "area_total_objeto", label: "Área total del objeto" },
  ];

export function areaTipoLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return AREA_TIPO_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const DECISION_METROLOGICA_LABELS: Record<string, string> = {
  NO_DISTINGUIBLE_DEL_FONDO: "No distinguible del fondo",
  DETECTADO: "Detectado (bajo límite de cuantificación)",
  CUANTIFICABLE: "Cuantificable",
  CUANTIFICABLE_CON_INCERTIDUMBRE_RELEVANTE: "Cuantificable, incertidumbre relevante",
  INFORMACION_INSUFICIENTE: "Información insuficiente",
};

export function decisionMetrologicaLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return DECISION_METROLOGICA_LABELS[value] ?? value;
}

export function cumpleCriterioLabel(value: boolean | null | undefined): string {
  if (value === true) return "Cumple";
  if (value === false) return "No cumple";
  return "Sin evaluar";
}

export function fmtDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function fmtNumber(value: unknown, digits = 4): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("es-CL", { maximumFractionDigits: digits });
}
