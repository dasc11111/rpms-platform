/**
 * Utilidades de calculo automatico para el control de Autorizaciones de
 * Desempeno y el semaforo visual de vencimientos.
 *
 * Los dias restantes y el estado de la autorizacion NUNCA se almacenan en
 * la base de datos: se derivan siempre en tiempo real a partir de la fecha
 * de vencimiento (formato ISO "YYYY-MM-DD"), tal como exige el negocio
 * (no se ingresan manualmente).
 */

export type SemaphoreLevel = "none" | "green" | "yellow" | "red";
export type AuthStatus = "sin_autorizacion" | "vigente" | "proxima_vencer" | "vencida";

/** Dias restantes hasta la fecha de vencimiento (negativo si ya vencio, null si no hay fecha). */
export function daysRemaining(expiryDate: string | null | undefined, from: Date = new Date()): number | null {
  if (!expiryDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(expiryDate).trim());
  if (!match) return null;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diffMs = target.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/** Nivel del semaforo visual: verde (>120d), amarillo (91-120d), rojo (<=90d, incluye vencidas). */
export function getSemaphoreLevel(days: number | null): SemaphoreLevel {
  if (days === null) return "none";
  if (days <= 90) return "red";
  if (days <= 120) return "yellow";
  return "green";
}

/** Estado de negocio de la autorizacion, usado en las tarjetas del Dashboard. */
export function getAuthStatus(days: number | null): AuthStatus {
  if (days === null) return "sin_autorizacion";
  if (days < 0) return "vencida";
  if (days <= 120) return "proxima_vencer";
  return "vigente";
}

export const AUTH_STATUS_LABEL: Record<AuthStatus, string> = {
  sin_autorizacion: "Sin autorización",
  vigente: "Vigente",
  proxima_vencer: "Próxima a vencer",
  vencida: "Vencida",
};

export const SEMAPHORE_LABEL: Record<SemaphoreLevel, string> = {
  none: "Sin datos",
  green: "Vigente",
  yellow: "Próxima a vencer",
  red: "Crítica / vencida",
};

export const SEMAPHORE_DOT_CLASS: Record<SemaphoreLevel, string> = {
  none: "bg-muted-foreground/40",
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-danger",
};

export const SEMAPHORE_TEXT_CLASS: Record<SemaphoreLevel, string> = {
  none: "text-muted-foreground",
  green: "text-success",
  yellow: "text-warning",
  red: "text-danger",
};

/** Texto legible de dias restantes, ej. "45 dias" o "Vencida hace 12 dias". */
export function formatDaysRemaining(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoy";
  return `${days} día${days === 1 ? "" : "s"}`;
}

export type WorkerAuthInput = {
  rut: string;
  name: string;
  email?: string | null;
  authorization_number?: string | null;
  authorization_expiry_date?: string | null;
};

export type WorkerAuthSummary = {
  rut: string;
  name: string;
  email: string | null;
  authorization_number: string | null;
  authorization_expiry_date: string | null;
  days: number | null;
  semaphore: SemaphoreLevel;
  status: AuthStatus;
};

/** Construye el resumen de autorizacion derivado para un trabajador. Calculo puro, barato y memoizable. */
export function buildAuthSummary(w: WorkerAuthInput, from: Date = new Date()): WorkerAuthSummary {
  const days = daysRemaining(w.authorization_expiry_date, from);
  return {
    rut: w.rut,
    name: w.name,
    email: w.email ?? null,
    authorization_number: w.authorization_number ?? null,
    authorization_expiry_date: w.authorization_expiry_date ?? null,
    days,
    semaphore: getSemaphoreLevel(days),
    status: getAuthStatus(days),
  };
}
