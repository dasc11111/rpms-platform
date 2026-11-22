"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tag, Activity, AlertTriangle, Atom, Award, BarChart3, Beaker, Bell, Biohazard, Building2, CalendarClock, ClipboardCheck, ClipboardList, Search,
  FileText, Flame, FlaskConical, GitBranch, GraduationCap, Hammer, Home, Radiation, Radio, Recycle,
  ScanLine, Settings, ShieldAlert, ShieldCheck, Stethoscope, Syringe,
  Trash2, Truck, UserCog, Users, Warehouse, Wrench, CheckSquare, Zap, MapPin, Gauge, ArrowRightLeft, LogIn, BookOpen, TrendingDown, TrendingUp, Send, Shield, FileCheck, Mail, Clock, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

const NAV = [
  // ── Core ──────────────────────────────────────────────
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/dashboard", label: "Resumen Ejecutivo", icon: Gauge },
  { href: "/alerts", label: "Alertas del Sistema", icon: Bell },
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/expiries", label: "Vencimientos", icon: CalendarClock },
  { href: "/search", label: "Búsqueda Global", icon: Search },
  { href: "/workers", label: "Trabajadores", icon: Users },
  { href: "/medical-exams", label: "Exámenes Médicos POE", icon: Stethoscope },
  { href: "/dosimetry", label: "Dosimetría", icon: Activity },
  { href: "/dosimeters", label: "Dosímetros", icon: Tag },

  { href: "/dosimetry/worker-history", label: "Dosis Individual", icon: Activity },
  { href: "/dosimetry/annual-summary", label: "Resumen Anual Dosis", icon: BarChart3 },
  { href: "/dosimetry/not-returned", label: "Dosímetros No Devueltos", icon: AlertTriangle },
  { href: "/dosimetry/late-returns", label: "Devueltos Fuera de Plazo", icon: Clock },
  { href: "/dosimetry/returns", label: "Lista de Devolución", icon: Package },
  { href: "/dosimetry/stats", label: "Estadísticas Dosis", icon: BarChart3 },
  { href: "/internal-dosimetry", label: "Dosimetría Interna", icon: Atom },

  // ── Medicina Nuclear ───────────────────────────────────
  { href: "/nuclear-medicine", label: "Medicina Nuclear", icon: Stethoscope },
  { href: "/petct", label: "PET/CT Exámenes", icon: ScanLine },
  { href: "/quality-control", label: "Control de Calidad", icon: CheckSquare },
  { href: "/i131", label: "Administración I-131", icon: Syringe },
  { href: "/i131/stats", label: "Estadísticas I-131", icon: BarChart3 },
  { href: "/radiopharmacy", label: "Radiofarmacia", icon: FlaskConical },

  // ── Protección Radiológica ─────────────────────────────
  { href: "/contamination", label: "Contaminación", icon: Biohazard },
  { href: "/contamination/stats", label: "Estadísticas Contaminación", icon: BarChart3 },
  { href: "/classified-zones", label: "Zonas Clasificadas", icon: MapPin },
  { href: "/zone-access", label: "Control de Acceso", icon: LogIn },
  { href: "/area-monitoring", label: "Monitoreo de Área", icon: Gauge },
  { href: "/room-release", label: "Liberación de Sala", icon: Radiation },

  // ── Residuos Radiactivos ───────────────────────────────
  { href: "/waste", label: "Residuos IAEA GSG-1", icon: Trash2 },
  { href: "/waste-management", label: "Gestión de Residuos", icon: Recycle },
  { href: "/waste-expert", label: "Residuos (Sistema Experto)", icon: FlaskConical },
  { href: "/waste-records", label: "Registros de Residuos", icon: Trash2 },
  { href: "/waste-calibration", label: "Calibración Detectores", icon: FlaskConical },
  { href: "/waste-contamination-criteria", label: "Criterios Contaminación", icon: ShieldAlert },
  { href: "/waste-release-criteria", label: "Criterios Liberación", icon: Recycle },
  { href: "/waste-items", label: "Fichas de Residuos", icon: Trash2 },
  { href: "/waste-labels", label: "Rótulos de Residuos", icon: Tag },
  { href: "/waste-storage", label: "Almacenamiento Temporal", icon: Warehouse },
  { href: "/waste-storage/dashboard", label: "Dashboard Almacenamiento", icon: BarChart3 },

  // ── Equipos y Fuentes ──────────────────────────────────
  { href: "/equipment", label: "Equipos", icon: Radio },
  { href: "/instruments", label: "Instrumentos", icon: Wrench },
  { href: "/instruments/operational-check", label: "Verif. Operacional", icon: CheckSquare },
  { href: "/instruments/calibrations", label: "Estado Calibraciones", icon: Award },
  { href: "/calibrations-overview", label: "Resumen Calibraciones", icon: Award },
  { href: "/instruments/maintenances", label: "Estado Mantenimientos", icon: Hammer },
  { href: "/maintenances-overview", label: "Resumen Mantenimientos", icon: Wrench },
  { href: "/sources", label: "Fuentes Radiactivas", icon: Zap },
  { href: "/sources/movements", label: "Movimientos IMAR", icon: ArrowRightLeft },

  // ── Radioterapia / Linac ───────────────────────────────
  { href: "/linac", label: "Linac / CML", icon: Zap },
  { href: "/linac/dashboard", label: "Dashboard LINAC", icon: BarChart3 },
  { href: "/radioterapia", label: "Radioterapia (SIGR)", icon: Radiation },
  { href: "/blindaje", label: "Blindaje y Diseño", icon: ShieldCheck },

  // ── Transporte ────────────────────────────────────────
  { href: "/transport", label: "Transporte Radiactivo", icon: Truck },
  { href: "/transport/dashboard", label: "Dashboard Transporte", icon: BarChart3 },

  // ── Gestión Normativa ─────────────────────────────────
  { href: "/alara", label: "Programa ALARA", icon: TrendingDown },
  { href: "/emergency", label: "Plan de Contingencia", icon: Flame },
  { href: "/incidents", label: "Incidentes", icon: AlertTriangle },
  { href: "/logbook", label: "Libro de Novedades", icon: BookOpen },
  { href: "/compliance", label: "Cumplimiento NS-06.0", icon: ShieldAlert },
  { href: "/changes", label: "Gestión de Cambios", icon: GitBranch },
  { href: "/radiation-program", label: "Programa PR (PPR)", icon: BookOpen },
  { href: "/improvement-plans", label: "Planes de Mejora PR", icon: TrendingUp },
  { href: "/capa", label: "CAPA — No Conformidades", icon: ClipboardCheck },
  { href: "/indicators", label: "Indicadores Desempeño PR", icon: BarChart3 },
  { href: "/objectives", label: "Objetivos PR y Plan Anual", icon: CheckSquare },
  { href: "/service-providers", label: "Proveedores de Servicio PR", icon: Building2 },
  { href: "/cchen-declarations", label: "Declaración Anual Dosis CCHEN", icon: Send },
  { href: "/cchen-inspections", label: "Inspecciones CCHEN", icon: Shield },
  { href: "/operating-licenses", label: "Licencias de Operación CCHEN", icon: FileCheck },
  { href: "/emergency-drills", label: "Simulacros de Emergencia", icon: Flame },
  { href: "/cchen-communications", label: "Comunicaciones CCHEN", icon: Mail },
  { href: "/ppe-radiation", label: "EPP Radiológico", icon: ShieldAlert },
  { href: "/personal-contamination", label: "Contaminación Personal", icon: Biohazard },
  { href: "/personal-dosimetry", label: "Dosimetría Personal", icon: Activity },
  { href: "/radioactive-sources", label: "Fuentes Radiactivas", icon: Atom },
  { href: "/radioactive-waste", label: "Residuos Radiactivos", icon: Recycle },
  { href: "/equipment-calibration", label: "Calibración y Control Calidad", icon: Gauge },
  { href: "/leak-tests", label: "Pruebas de Estanqueidad", icon: Beaker },
  { href: "/instruments-maintenance", label: "Calibraciones y Mantenciones", icon: Wrench },
  { href: "/room-clearance", label: "Liberación de Salas MN", icon: ScanLine },
  { href: "/room-clearance/stats", label: "Estadísticas Liberación Salas", icon: BarChart3 },
  { href: "/radionuclides", label: "Catálogo de Radionúclidos", icon: Atom },
  { href: "/training", label: "Capacitación", icon: GraduationCap },
  { href: "/committee", label: "Comité PR — Sesiones", icon: Users },
  { href: "/inspections", label: "Inspecciones CCHEN", icon: ShieldCheck },
  { href: "/environmental-monitoring", label: "Monitoreo Ambiental", icon: MapPin },
  { href: "/licenses", label: "Autorizaciones CCHEN", icon: FileText },
  { href: "/public-dose", label: "Dosis a Miembros Público", icon: Users },
  { href: "/ppe", label: "EPP Radiológico", icon: ShieldAlert },
  { href: "/spills", label: "Derrames Radiactivos", icon: Biohazard },

  // ── Documentos y Reportes ─────────────────────────────
  { href: "/management-report", label: "Informe de Gestión", icon: BarChart3 },
  { href: "/procedures", label: "Procedimientos", icon: ClipboardList },
  { href: "/audits", label: "Auditorías Internas PR", icon: ClipboardCheck },
  { href: "/risks", label: "Riesgos Radiológicos", icon: ShieldAlert },
  { href: "/training", label: "Capacitación PR", icon: GraduationCap },
  { href: "/equipment", label: "Equipos y Mantención", icon: Wrench },
  { href: "/waste", label: "Residuos Radiactivos", icon: Recycle },
  { href: "/sources", label: "Fuentes Radiactivas", icon: Atom },
  { href: "/regulatory-reports", label: "Reportes CCHEN", icon: Send },
  { href: "/incidents", label: "Incidentes Radiológicos", icon: Flame },
  { href: "/vendors", label: "Proveedores", icon: Building2 },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/annual-report", label: "Informe Anual Integrado", icon: FileText },
  { href: "/reports/annual-cchen", label: "Informe Anual CCHEN", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

const SUPER_ADMIN_NAV = [
  { href: "/admin/users", label: "Administración de Usuarios", icon: UserCog },
  { href: "/admin/audit", label: "Auditoría del Sistema", icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = user?.role === "super_admin" ? [...NAV, ...SUPER_ADMIN_NAV] : NAV;

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Radio className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold">RPMS</span>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-2 py-4 scrollbar-thin">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                active && "bg-accent-subtle text-foreground font-medium",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer con usuario */}
      {user && (
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-[11px] font-medium text-foreground">{user.name}</span>
              <span className="truncate text-[10px] text-muted-foreground capitalize">{user.role?.replace("_", " ")}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
