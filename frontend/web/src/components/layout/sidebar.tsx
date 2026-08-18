"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tag, Activity, AlertTriangle, BarChart3, Biohazard, ClipboardList, FileText, Home, Radiation, Radio, Settings, ShieldAlert, Stethoscope, Syringe, Trash2, Truck, UserCog, Users, Wrench, Recycle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/workers", label: "Trabajadores", icon: Users },
  { href: "/dosimetry", label: "Dosimetría", icon: Activity },
  { href: "/dosimeters", label: "Dosímetros", icon: Tag },
  { href: "/nuclear-medicine", label: "Medicina Nuclear", icon: Stethoscope },
  { href: "/i131", label: "Administración I-131", icon: Syringe },
  { href: "/contamination", label: "Contaminación", icon: Biohazard },
  { href: "/room-release", label: "Liberación de Sala", icon: Trash2 },
  { href: "/waste-management", label: "Gestión de Residuos", icon: Recycle },
  { href: "/equipment", label: "Equipos", icon: Radio },
  { href: "/transport", label: "Transporte de Material Radiactivo", icon: Truck },
  { href: "/radioterapia", label: "Radioterapia (SIGR)", icon: Radiation },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/incidents", label: "Incidentes", icon: AlertTriangle },
  { href: "/compliance", label: "Cumplimiento", icon: ShieldAlert },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/instruments", label: "Instrumentos", icon: Wrench },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

const SUPER_ADMIN_NAV = [
  { href: "/admin/users", label: "Administración de Usuarios", icon: UserCog },
  { href: "/admin/audit", label: "Auditoría", icon: ClipboardList },
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
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "bg-accent-subtle text-foreground"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
