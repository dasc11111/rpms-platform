// Instrumentos de Proteccion Radiologica - tipos, constantes y logica de negocio
// (calculo de vencimientos, alertas y utilidades compartidas entre API y UI)

export type InstrumentStatus = "operativo" | "en_mantenimiento" | "fuera_servicio" | "dado_de_baja";

export const INSTRUMENT_STATUS_LABELS: Record<InstrumentStatus, string> = {
  operativo: "Operativo",
  en_mantenimiento: "En mantencion",
  fuera_servicio: "Fuera de servicio",
  dado_de_baja: "Dado de baja",
};

// Tipos de instrumento por defecto. La tabla instrument_types permite agregar
// nuevos tipos desde la UI sin modificar codigo ni arquitectura.
export const DEFAULT_INSTRUMENT_TYPES: string[] = [
  "Camara de Ionizacion",
  "Detector Geiger-Muller",
  "Dosimetro de Lectura Directa",
  "Activimetro",
  "Contador Proporcional",
  "Contador de Centelleo",
  "Monitor de Contaminacion Superficial",
  "Monitor de Tasa de Dosis",
  "Otros Detectores",
  ];

export const DEFAULT_CALIBRATION_COMPANIES: string[] = [
  "CCHEN",
  "Laboratorio Acreditado",
  "Fabricante",
  "Otro",
  ];

export type FailureStatus = "abierta" | "en_proceso" | "resuelta" | "cerrada";
export const FAILURE_STATUS_LABELS: Record<FailureStatus, string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};

export type MaintenanceType = "preventivo" | "correctivo";
export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  preventivo: "Preventivo",
  correctivo: "Correctivo",
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  certificado: "Certificado de calibracion",
  informe_tecnico: "Informe tecnico",
  fotografia: "Fotografia del instrumento",
  constancia_envio: "Constancia de envio",
  informe_recepcion: "Informe de recepcion",
  otro: "Otro",
};

// --- Calculo de vigencia / alertas de calibracion --------------------------

export type CalibrationAlertLevel = "verde" | "amarillo" | "rojo" | "vencida" | "sin_calibracion";

export const CALIBRATION_ALERT_LABELS: Record<CalibrationAlertLevel, string> = {
  verde: "Vigente",
  amarillo: "Proxima a vencer",
  rojo: "Vence en 30 dias o menos",
  vencida: "Calibracion vencida",
  sin_calibracion: "Sin calibracion registrada",
};

export const CALIBRATION_ALERT_COLORS: Record<CalibrationAlertLevel, string> = {
  verde: "text-success bg-success/10 border-success/30",
  amarillo: "text-warning bg-warning/10 border-warning/30",
  rojo: "text-danger bg-danger/10 border-danger/30",
  vencida: "text-danger bg-danger/20 border-danger/50 font-semibold",
  sin_calibracion: "text-muted-foreground bg-muted/40 border-muted",
};

// Umbrales de seguimiento (en dias restantes) usados por el motor de alertas
// y por los indicadores acumulativos del dashboard.
export const ALERT_THRESHOLDS = [180, 150, 120, 90, 60, 30] as const;
export const KPI_THRESHOLDS = [180, 120, 90, 60, 30] as const;

export function daysUntil(dateStr: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export function getCalibrationAlertLevel(
  expiryDate: string | null | undefined,
  now: Date = new Date()
  ): { level: CalibrationAlertLevel; daysRemaining: number | null } {
  const daysRemaining = daysUntil(expiryDate, now);
  if (daysRemaining === null) return { level: "sin_calibracion", daysRemaining: null };
  if (daysRemaining < 0) return { level: "vencida", daysRemaining };
  if (daysRemaining <= 30) return { level: "rojo", daysRemaining };
  if (daysRemaining <= 180) return { level: "amarillo", daysRemaining };
  return { level: "verde", daysRemaining };
}

// Bucket de seguimiento (180/150/120/90/60/30) usado para saber en que
// checkpoint de alerta se encuentra un instrumento proximo a vencer.
export function getTrackingCheckpoint(daysRemaining: number | null): number | null {
  if (daysRemaining === null || daysRemaining < 0) return null;
      for (const t of ALERT_THRESHOLDS) {
        if (daysRemaining <= t) return t;
      }
  return null;
}

export function slugifyType(input: string): string {
  return input
  .toString()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}

// --- Tipos de datos compartidos --------------------------------------------

export type InstrumentRow = {
  id: number;
  code: string;
  name: string;
  type_id: number | null;
  type_name?: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  service: string | null;
  unit: string | null;
  location: string | null;
  acquisition_date: string | null;
  provider: string | null;
  status: InstrumentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_calibration_date?: string | null;
  last_calibration_expiry?: string | null;
  last_calibration_company?: string | null;
  failures_open_count?: number;
  in_maintenance?: boolean;
};

export type CalibrationRow = {
  id: number;
  instrument_id: number;
  calibration_date: string;
  expiry_date: string | null;
  company_id: number | null;
  company_name: string | null;
  certificate_number: string | null;
  calibration_factor: number | null;
  magnitude: string | null;
  units: string | null;
  method: string | null;
  standard_used: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type FailureRow = {
  id: number;
  instrument_id: number;
  failure_date: string;
  failure_type: string | null;
  description: string;
  diagnosis: string | null;
  corrective_action: string | null;
  responsible: string | null;
  status: FailureStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRow = {
  id: number;
  instrument_id: number;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  company: string | null;
  responsible: string | null;
  notes: string | null;
  cost: number | null;
  created_at: string;
  updated_at: string;
};

export type InstrumentDocumentRow = {
  id: number;
  owner_type: "instrument" | "calibration" | "failure" | "maintenance";
  owner_id: number;
  category: string | null;
  original_name: string;
  blob_url: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type HistoryRow = {
  id: number;
  instrument_id: number;
  changed_by: string | null;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
};
