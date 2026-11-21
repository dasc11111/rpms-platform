// Gestion de Asignacion de Dosimetros - tipos, constantes y logica de negocio
// compartida entre las rutas API y la interfaz de usuario del modulo.

export type DosimeterType =
  | "cuerpo_entero"
  | "cristalino"
  | "extremidades"
  | "ambiental"
  | "area"
  | "otro";

export const DOSIMETER_TYPE_LABELS: Record<DosimeterType, string> = {
  cuerpo_entero: "Cuerpo entero",
  cristalino: "Cristalino",
  extremidades: "Extremidades",
  ambiental: "Ambiental",
  area: "Area",
  otro: "Otro",
};

export type DosimeterStatus =
  | "disponible"
  | "asignado"
  | "devuelto"
  | "extraviado"
  | "en_laboratorio"
  | "fuera_de_servicio"
  | "danado";

export const DOSIMETER_STATUS_LABELS: Record<DosimeterStatus, string> = {
  disponible: "Disponible",
  asignado: "Asignado",
  devuelto: "Devuelto",
  extraviado: "Extraviado",
  en_laboratorio: "En laboratorio",
  fuera_de_servicio: "Fuera de servicio",
  danado: "Danado",
};

export const DOSIMETER_STATUS_COLORS: Record<DosimeterStatus, string> = {
  disponible: "text-success bg-success/10 border-success/30",
  asignado: "text-info bg-info/10 border-info/30",
  devuelto: "text-muted-foreground bg-muted/40 border-muted",
  extraviado: "text-danger bg-danger/20 border-danger/50 font-semibold",
  en_laboratorio: "text-warning bg-warning/10 border-warning/30",
  fuera_de_servicio: "text-danger bg-danger/10 border-danger/30",
  danado: "text-danger bg-danger/10 border-danger/30",
};

// --- Calculo de trimestre calendario ----------------------------------------

export function getQuarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function getCurrentQuarter(now: Date = new Date()): { year: number; quarter: number } {
  return { year: now.getFullYear(), quarter: getQuarterOf(now) };
}

export function getQuarterDateRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start, end };
}

export function quarterLabel(year: number, quarter: number): string {
  const names = ["Primer", "Segundo", "Tercer", "Cuarto"];
  return `${names[quarter - 1] ?? quarter} trimestre ${year}`;
}

// --- Calculo de dias de atraso en devolucion --------------------------------

export function daysOverdue(estimatedReturnDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!estimatedReturnDate) return null;
  const d = new Date(estimatedReturnDate);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((start.getTime() - end.getTime()) / msPerDay);
}

export function isOverdue(dosimeter: { status: string; estimated_return_date: string | null; actual_return_date: string | null }, now: Date = new Date()): boolean {
  if (dosimeter.status !== "asignado") return false;
  if (dosimeter.actual_return_date) return false;
  const overdue = daysOverdue(dosimeter.estimated_return_date, now);
  return overdue !== null && overdue > 0;
}

// --- Tipos de datos compartidos --------------------------------------------

export type DosimeterRow = {
  id: number;
  code: string;
  type: DosimeterType;
  status: DosimeterStatus;
  worker_rut: string | null;
  worker_name: string | null;
  service: string | null;
  unit: string | null;
  delivery_date: string | null;
  estimated_return_date: string | null;
  actual_return_date: string | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
};

export type DosimeterAssignmentRow = {
  id: number;
  dosimeter_id: number;
  worker_rut: string;
  worker_name: string | null;
  service: string | null;
  unit: string | null;
  delivery_date: string | null;
  estimated_return_date: string | null;
  actual_return_date: string | null;
  status_at_close: string | null;
  observations: string | null;
  closed_at: string | null;
  created_at: string;
};

export type DosimeterHistoryRow = {
  id: number;
  dosimeter_id: number;
  changed_by: string | null;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
};
