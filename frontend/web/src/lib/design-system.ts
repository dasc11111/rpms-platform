// RPMS Design System — tokens institucionales
// Fuente unica de verdad para tipografia, espaciado, semaforo y paleta de graficos.
// Los colores base (background, surface, accent, success, warning, danger, info)
// viven como variables CSS en globals.css + tailwind.config.js. Este archivo
// complementa esos tokens y NO debe duplicarse: todos los modulos deben importar
// desde aqui en vez de definir sus propios colores o escalas.

export const DS_NAME = "RPMS Design System";
export const DS_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------
export const TYPOGRAPHY = {
  fontPrimary: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontMono: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
  scale: {
    display: "text-2xl md:text-3xl font-bold tracking-tight",
    h1: "text-xl md:text-2xl font-bold tracking-tight",
    h2: "text-lg md:text-xl font-semibold tracking-tight",
    h3: "text-base md:text-lg font-semibold",
    subtitle: "text-sm font-medium text-muted-foreground",
    body: "text-sm",
    bodyLg: "text-base",
    small: "text-xs",
    kpiValue: "text-2xl md:text-3xl font-bold tabular-nums",
    kpiLabel: "text-xs font-medium text-muted-foreground uppercase tracking-wide",
    tableHeader: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
    tableCell: "text-sm",
    printBody: "text-[11pt] leading-snug text-black",
    printHeader: "text-[14pt] font-bold text-black",
  },
} as const;

// ---------------------------------------------------------------------------
// Espaciado (escala consistente, multiplos de 4px via clases Tailwind)
// ---------------------------------------------------------------------------
export const SPACING = {
  xs: "gap-1 p-1",
  sm: "gap-2 p-2",
  md: "gap-4 p-4",
  lg: "gap-6 p-6",
  xl: "gap-8 p-8",
  pageX: "px-4 md:px-6 lg:px-8",
  pageY: "py-6",
  cardPadding: "p-4 md:p-5",
  sectionGap: "space-y-6",
} as const;

// ---------------------------------------------------------------------------
// Radios y elevacion
// ---------------------------------------------------------------------------
export const RADIUS = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

export const ELEVATION = {
  flat: "border border-border bg-surface",
  card: "border border-border bg-surface shadow-sm",
  elevated: "border border-border bg-surface-elevated shadow-md",
  overlay: "border border-border bg-surface-overlay shadow-xl",
} as const;

// ---------------------------------------------------------------------------
// Semaforo institucional unico — usado en TODA la plataforma
// ---------------------------------------------------------------------------
export type SemaphoreLevel = "ok" | "warning" | "urgent" | "critical" | "unknown" | "disabled";

export interface SemaphoreConfig {
  level: SemaphoreLevel;
  label: string;
  emoji: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  chart: string;
}

export const SEMAPHORE: Record<SemaphoreLevel, SemaphoreConfig> = {
  ok: { level: "ok", label: "Correcto", emoji: "🟢", dot: "bg-success", badgeBg: "bg-success-subtle", badgeText: "text-success", chart: "#10b981" },
  warning: { level: "warning", label: "Atencion", emoji: "🟡", dot: "bg-warning", badgeBg: "bg-warning-subtle", badgeText: "text-warning", chart: "#f59e0b" },
  urgent: { level: "urgent", label: "Proximo vencimiento", emoji: "🟠", dot: "bg-orange-500", badgeBg: "bg-orange-500/10", badgeText: "text-orange-500", chart: "#f97316" },
  critical: { level: "critical", label: "Critico", emoji: "🔴", dot: "bg-danger", badgeBg: "bg-danger-subtle", badgeText: "text-danger", chart: "#ef4444" },
  unknown: { level: "unknown", label: "Sin informacion", emoji: "⚪", dot: "bg-muted-foreground/40", badgeBg: "bg-muted", badgeText: "text-muted-foreground", chart: "#9ca3af" },
  disabled: { level: "disabled", label: "Deshabilitado", emoji: "⚫", dot: "bg-muted-foreground/20", badgeBg: "bg-muted", badgeText: "text-muted-foreground", chart: "#6b7280" },
};

// Deriva el nivel de semaforo a partir de dias restantes (vencimientos,
// calibraciones, capacitaciones, mantenciones, etc.)
export function semaphoreFromDaysRemaining(days: number | null | undefined, opts?: { urgentDays?: number; warningDays?: number }): SemaphoreLevel {
  if (days === null || days === undefined) return "unknown";
  const urgentDays = opts?.urgentDays ?? 15;
  const warningDays = opts?.warningDays ?? 30;
  if (days < 0) return "critical";
  if (days <= urgentDays) return "urgent";
  if (days <= warningDays) return "warning";
  return "ok";
}

// Mapea estados textuales comunes de la plataforma a un nivel de semaforo
export function semaphoreFromStatus(status: string | null | undefined): SemaphoreLevel {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (["conforme", "operativo", "activo", "vigente", "cerrado", "aprobado", "completado"].includes(s)) return "ok";
  if (["observado", "en revision", "pendiente", "programado"].includes(s)) return "warning";
  if (["por vencer", "proximo", "próximo"].includes(s)) return "urgent";
  if (["no conforme", "fuera de servicio", "vencido", "critico", "crítico", "rechazado", "abierto"].includes(s)) return "critical";
  if (["inactivo", "deshabilitado", "dado de baja"].includes(s)) return "disabled";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Paleta estandar para graficos (biblioteca unica, orden fijo de series)
// ---------------------------------------------------------------------------
export const CHART_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

// ---------------------------------------------------------------------------
// Breakpoints de referencia (coinciden con Tailwind por defecto)
// ---------------------------------------------------------------------------
export const BREAKPOINTS = {
  notebook: "1366px",
  desktop: "1920px",
  qhd: "2560px",
  tablet: "768px",
  mobileFuture: "390px",
} as const;
