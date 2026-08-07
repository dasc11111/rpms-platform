// Biblioteca unica de iconos institucionales del RPMS / SIGR.
// Nunca importar iconos "sueltos" de lucide-react directamente en un modulo:
// siempre referenciar este registro para mantener consistencia visual en
// toda la plataforma (Dashboard, Radioterapia, Acelerador, QC, Dosimetria, etc.)

import {
  LayoutDashboard,
  Radiation,
  Zap,
  ClipboardCheck,
  FlaskConical,
  ShieldCheck,
  Gauge,
  Warehouse,
  Wrench,
  FileText,
  BarChart3,
  Users,
  AlertTriangle,
  Siren,
  AlertOctagon,
  ClipboardList,
  Settings,
  Calendar,
  Building2,
  DoorClosed,
  User,
  HardHat,
  Building,
  FolderOpen,
  File,
  FileSpreadsheet,
  FileDown,
  QrCode,
  PenTool,
  History,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  radioterapia: Radiation,
  acelerador: Zap,
  qc: ClipboardCheck,
  aceptacion: ClipboardCheck,
  comisionamiento: FlaskConical,
  dosimetria: Gauge,
  proteccionRadiologica: ShieldCheck,
  instrumentos: Gauge,
  blindajes: Warehouse,
  mantenimiento: Wrench,
  documentos: FileText,
  reportes: BarChart3,
  usuarios: Users,
  alertas: AlertTriangle,
  emergencias: Siren,
  incidentes: AlertOctagon,
  auditorias: ClipboardList,
  configuracion: Settings,
  calendario: Calendar,
  hospital: Building2,
  bunker: DoorClosed,
  paciente: User,
  equipo: HardHat,
  empresa: Building,
  archivo: FolderOpen,
  pdf: File,
  excel: FileSpreadsheet,
  csv: FileDown,
  qr: QrCode,
  firma: PenTool,
  historial: History,
  timeline: History,
};

export type IconKey = keyof typeof ICONS;

export function getIcon(key: IconKey): LucideIcon {
  return ICONS[key] ?? FileText;
}
