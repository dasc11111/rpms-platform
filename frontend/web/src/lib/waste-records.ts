/**
 * RPMS – Módulo D: Gestión de Residuos Radiactivos
 * Referencia normativa: DS 133/1984, CCHEN "Reglamento sobre Gestión de Residuos Radiactivos"
 * Estándar internacional: IAEA GSR Part 5, SSG-45
 *
 * NOTA OPR: Los valores de actividad específica de exención y los periodos
 * de retención deben verificarse contra la autorización CCHEN vigente del
 * establecimiento antes de su uso en decisiones clínicas.
 */

// ─── Constantes normativas ──────────────────────────────────────────────────────────────────────────────────

/** Radionúclidos habituales en medicina nuclear (Chile) */
export const RADIONUCLIDES = [
  "Tc-99m",
  "I-131",
  "I-123",
  "Ga-67",
  "Tl-201",
  "F-18",
  "Lu-177",
  "Y-90",
  "Ra-223",
  "Sm-153",
] as const;
export type Radionuclide = (typeof RADIONUCLIDES)[number];

/** Vidas medias físicas en horas (fuente: IAEA Nuclear Data) */
export const HALF_LIFE_HOURS: Record<Radionuclide, number> = {
  "Tc-99m": 6.01,
  "I-131": 192.6,
  "I-123": 13.22,
  "Ga-67": 78.26,
  "Tl-201": 73.06,
  "F-18": 1.83,
  "Lu-177": 162.7,
  "Y-90": 64.1,
  "Ra-223": 274.8,
  "Sm-153": 46.3,
};

export const RETENTION_HALF_LIVES = 10;

export const WASTE_CATEGORIES = [
  "solido_seco",
  "liquido_acuoso",
  "organico_liquido",
  "biologico",
  "sharps",
  "fuente_sellada_desechada",
  "otro",
] as const;
export type WasteCategory = (typeof WASTE_CATEGORIES)[number];

export const WASTE_CATEGORY_LABELS: Record<WasteCategory, string> = {
  solido_seco: "Sólido seco (ropa, papel, plástico)",
  liquido_acuoso: "Líquido acuoso (orina, soluciones)",
  organico_liquido: "Líquido orgánico",
  biologico: "Residuo biológico",
  sharps: "Material cortopunzante",
  fuente_sellada_desechada: "Fuente sellada en desuso",
  otro: "Otro",
};

export const DISPOSAL_ROUTES = [
  "retencion_decaimiento",
  "transferencia_cchen",
  "proveedor_autorizado",
  "alcantarillado_autorizado",
  "residuo_convencional",
] as const;
export type DisposalRoute = (typeof DISPOSAL_ROUTES)[number];

export const DISPOSAL_ROUTE_LABELS: Record<DisposalRoute, string> = {
  retencion_decaimiento: "Retención hasta decaimiento (≥10 T½)",
  transferencia_cchen: "Transferencia a CCHEN",
  proveedor_autorizado: "Proveedor autorizado de residuos",
  alcantarillado_autorizado: "Descarga a alcantarillado (autorizado)",
  residuo_convencional: "Disposición como residuo convencional",
};

export const WASTE_STATES = [
  "en_almacenamiento",
  "en_decaimiento",
  "liberado",
  "transferido",
  "descartado",
] as const;
export type WasteState = (typeof WASTE_STATES)[number];

export const WASTE_STATE_LABELS: Record<WasteState, string> = {
  en_almacenamiento: "En almacenamiento",
  en_decaimiento: "En decaimiento activo",
  liberado: "Liberado (cumple criterio)",
  transferido: "Transferido a tercero",
  descartado: "Descartado como convencional",
};

// ─── Tipos principales ──────────────────────────────────────────────────────────────────────────────────

export interface WasteRecord {
  id: string;
  dedupe_key: string;
  container_label: string;
  radionuclide: Radionuclide;
  waste_category: WasteCategory;
  initial_activity_mbq: number;
  initial_activity_date: string;
  mass_or_volume_kg: number | null;
  container_count: number;
  origin_area: string;
  associated_patient_id: string | null;
  generated_by: string;
  notes: string | null;
  state: WasteState;
  disposal_route: DisposalRoute | null;
  release_date: string | null;
  released_by: string | null;
  release_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Campos calculados ──────────────────────────────────────────────────────────────────────────────────

export interface WasteDerived {
  current_activity_mbq: number;
  activity_pct_initial: number;
  retention_deadline: string;
  hours_until_release: number;
  days_until_release: number;
  can_release: boolean;
  semaphore: "verde" | "amarillo" | "rojo";
  semaphore_label: string;
}

/**
 * Calculates derived radiometric values for a waste record.
 * Uses: A(t) = A₀ · 2^(−t/T½)
 */
export function calcWasteDerived(record: WasteRecord): WasteDerived {
  const t_half_h = HALF_LIFE_HOURS[record.radionuclide];
  const t_retention_h = RETENTION_HALF_LIVES * t_half_h;
  const initial_date = new Date(record.initial_activity_date);
  const now = new Date();
  const elapsed_h = (now.getTime() - initial_date.getTime()) / (1000 * 3600);
  const current_activity_mbq = record.initial_activity_mbq * Math.pow(2, -elapsed_h / t_half_h);
  const activity_pct_initial = (current_activity_mbq / record.initial_activity_mbq) * 100;
  const retention_deadline = new Date(initial_date.getTime() + t_retention_h * 3600 * 1000);
  const hours_until_release = Math.max(0, (retention_deadline.getTime() - now.getTime()) / (1000 * 3600));
  const days_until_release = hours_until_release / 24;
  const can_release = elapsed_h >= t_retention_h;
  let semaphore: "verde" | "amarillo" | "rojo";
  let semaphore_label: string;
  if (can_release) {
    semaphore = "verde";
    semaphore_label = "Listo para liberación";
  } else if (days_until_release <= 3) {
    semaphore = "amarillo";
    semaphore_label = `Liberable en ${days_until_release.toFixed(1)} días`;
  } else {
    semaphore = "rojo";
    semaphore_label = `Retener ${days_until_release.toFixed(0)} días más`;
  }
  return {
    current_activity_mbq, activity_pct_initial,
    retention_deadline: retention_deadline.toISOString(),
    hours_until_release, days_until_release, can_release,
    semaphore, semaphore_label,
  };
}

// ─── Clave de deduplicación ──────────────────────────────────────────────────────────────────────────────────

export function buildWasteDedupeKey(container_label: string, radionuclide: string, initial_activity_date: string): string {
  const d = new Date(initial_activity_date);
  const dateStr = d.toISOString().slice(0, 10);
  const safe = container_label.replace(/\s+/g, "_").toUpperCase();
  return `${safe}__${radionuclide}__${dateStr}`;
}

// ─── Formulario de entrada ──────────────────────────────────────────────────────────────────────────────────

export interface WasteFormInput {
  container_label: string;
  radionuclide: Radionuclide;
  waste_category: WasteCategory;
  initial_activity_mbq: number;
  initial_activity_date: string;
  mass_or_volume_kg: number | null;
  container_count: number;
  origin_area: string;
  associated_patient_id: string | null;
  generated_by: string;
  notes: string | null;
  disposal_route: DisposalRoute | null;
}

export const ORIGIN_AREA_OPTIONS = [
  "Sala caliente",
  "Sala de administración",
  "Sala de cámaras",
  "Baño pacientes ambulatorios",
  "Habitación de hospitalización",
  "Laboratorio de radiofarmacia",
  "Área de desechos",
] as const;
