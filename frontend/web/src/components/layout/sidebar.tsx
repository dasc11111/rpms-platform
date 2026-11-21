"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tag, Activity, AlertTriangle, BarChart3, Biohazard, ClipboardList,
  FileText, Flame, FlaskConical, GraduationCap, Home, Radiation, Radio, Recycle,
  ScanLine, Settings, ShieldAlert, ShieldCheck, Stethoscope, Syringe,
  Trash2, Truck, UserCog, Users, Wrench, CheckSquare, Zap, MapPin, Gauge, ArrowRightLeft, LogIn, BookOpen, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

const NAV = [
  // ── Core ──────────────────────────────────────────────
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/workers", label: "Trabajadores", icon: Users },
  { href: "/dosimetry", label: "Dosimetría", icon: Activity },
  { href: "/dosimeters", label: "Dosímetros", icon: Tag },

  { href: "/dosimetry/worker-history", label: "Dosis Individual", icon: Activity },

  // ── Medicina Nuclear ───────────────────────────────────
  { href: "/nuclear-medicine", label: "Medicina Nuclear", icon: Stethoscope },
  { href: "/petct", label: "PET/CT Exámenes", icon: ScanLine },
  { href: "/quality-control", label: "Control de Calidad", icon: CheckSquare },
  { href: "/i131", label: "Administración I-131", icon: Syringe },
  { href: "/radiopharmacy", label: "Radiofarmacia", icon: FlaskConical },

  // ── Protección Radiológica ─────────────────────────────
  { href: "/contamination", label: "Contaminación", icon: Biohazard },
  { href: "/classified-zones", label: "Zonas Clasificadas", icon: MapPin },
  { href: "/zone-access", label: "Control de Acceso", icon: LogIn },
  { href: "/area-monitoring", label: "Monitoreo de Área", icon: Gauge },
  { href: "/room-release", label: "Liberación de Sala", icon: Radiation },

  // ── Residuos Radiactivos ───────────────────────────────
  { href: "/waste", label: "Residuos IAEA GSG-1", icon: Trash2 },
  { href: "/waste-management", label: "Gestión de Residuos", icon: Recycle },
  { href: "/waste-expert", label: "Residuos (Sistema Experto)", icon: FlaskConical },
  { href: "/waste-records", label: "Registros de Residuos", icon: Trash2 },

  // ── Equipos y Fuentes ──────────────────────────────────
  { href: "/equipment", label: "Equipos", icon: Radio },
  { href: "/instruments", label: "Instrumentos", icon: Wrench },
  { href: "/instruments/operational-check", label: "Verif. Operacional", icon: CheckSquare },
  { href: "/sources", label: "Fuentes Radiactivas", icon: Zap },
  { href: "/sources/movements", label: "Movimientos IMAR", icon: ArrowRightLeft },

  // ── Radioterapia / Linac ───────────────────────────────
  { href: "/linac", label: "Linac / CML", icon: Zap },
  { href: "/radioterapia", label: "Radioterapia (SIGR)", icon: Radiation },
  { href: "/blindaje", label: "Blindaje y Diseño", icon: ShieldCheck },

  // ── Transporte ────────────────────────────────────────
  { href: "/transport", label: "Transporte Radiactivo", icon: Truck },

  // ── Gestión Normativa ─────────────────────────────────
  { href: "/alara", label: "Programa ALARA", icon: TrendingDown },
  { href: "/emergency", label: "Plan de Contingencia", icon: Flame },
  { href: "/incidents", label: "Incidentes", icon: AlertTriangle },
  { href: "/logbook", label: "Libro de Novedades", icon: BookOpen },
  { href: "/compliance", label: "Cumplimiento NS-06.0", icon: ShieldAlert },
  { href: "/training", label: "Capacitación", icon: GraduationCap },

  // ── Documentos y Reportes ─────────────────────────────
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
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
