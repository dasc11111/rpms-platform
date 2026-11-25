"use client";


import type { ComponentType } from "react";
import Link from "next/link";
import {
  FileText,
  FileUp,
  FilePlus2,
  Tag,
  ArrowRight,
  Upload,
  CheckCircle2,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Upload module definitions ────────────────────────────────────────────────

interface UploadModule {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  group: "dosimetria" | "dosimetros" | "otros";
  primary?: boolean;
}

const MODULES: UploadModule[] = [
  // ── Dosimetría personal ───────────────────────────────────────────────────
  {
    title: "Importar informe PDF de dosis",
    description: "Sube el PDF del proveedor (CCHEN, Dosimetría Sur, etc.) y el sistema extrae, valida y carga automáticamente los registros de dosis por trabajador.",
    href: "/dosimetry/import-pdf",
    icon: FileText,
    badge: "Recomendado",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    group: "dosimetria",
    primary: true,
  },
  {
    title: "Carga trimestral de dosis",
    description: "Registra manualmente o por lote los valores Hp(10), Hp(3) y acumulados del trimestre para todos los trabajadores vigilados.",
    href: "/dosimetry/import-quarterly",
    icon: FilePlus2,
    group: "dosimetria",
  },
  {
    title: "Ingreso manual de dosis",
    description: "Ingresa un registro individual de dosis en cualquier período, con validación inmediata contra límites regulatorios.",
    href: "/dosimetry/manual",
    icon: FileUp,
    group: "dosimetria",
  },
  // ── Dosímetros físicos ────────────────────────────────────────────────────
  {
    title: "Importar asignación de dosímetros desde PDF",
    description: "Sube el informe PDF del proveedor para asignar automáticamente códigos XA a trabajadores según RUT y nombre.",
    href: "/dosimeters/import-pdf",
    icon: Tag,
    badge: "Nuevo",
    badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    group: "dosimetros",
    primary: true,
  },
  // ── Otros documentos ─────────────────────────────────────────────────────
  {
    title: "Cargar documento de respaldo",
    description: "Sube cualquier documento relacionado con dosimetría: informes, certificados, autorizaciones CCHEN, resoluciones.",
    href: "/dosimetry/documents",
    icon: BookOpen,
    group: "otros",
  },
];

const GROUP_LABELS: Record<UploadModule["group"], string> = {
  dosimetria: "Dosimetría personal — registros de dosis",
  dosimetros: "Dosímetros físicos — asignación y control",
  otros: "Documentos y respaldos",
};

const GROUP_ICONS: Record<UploadModule["group"], ComponentType<{ className?: string }>> = {
  dosimetria: FileText,
  dosimetros: Tag,
  otros: BookOpen,
};

// ─── Recent activity stats (static KPIs, fetched server-side in real app) ────

const QUICK_LINKS = [
  { label: "Historial individual de trabajadores", href: "/dosimetry/worker-history", icon: BarChart3 },
  { label: "Estadísticas por servicio", href: "/dosimetry/stats", icon: BarChart3 },
  { label: "Registros trimestrales", href: "/dosimetry/quarterly", icon: CheckCircle2 },
  { label: "Devoluciones de dosímetros", href: "/dosimeters/alerts", icon: Tag },
];

// ─── Components ───────────────────────────────────────────────────────────────

function ModuleCard({ mod }: { mod: UploadModule }) {
  const Icon = mod.icon;
  return (
    <Link
      href={mod.href}
      className={cn(
        "group flex flex-col gap-3 p-5 rounded-xl border transition-all",
        mod.primary
          ? "border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 dark:bg-blue-900/10 dark:border-blue-800 dark:hover:border-blue-600"
          : "border-border bg-card hover:bg-muted/40 hover:border-muted-foreground/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn(
          "p-2.5 rounded-lg",
          mod.primary ? "bg-blue-100 dark:bg-blue-900/40" : "bg-muted"
        )}>
          <Icon className={cn("h-5 w-5", mod.primary ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground")} />
        </div>
        <div className="flex items-center gap-2">
          {mod.badge && (
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", mod.badgeColor)}>
              {mod.badge}
            </span>
          )}
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
      <div>
        <div className={cn("font-semibold text-sm", mod.primary ? "text-blue-900 dark:text-blue-100" : "text-foreground")}>
          {mod.title}
        </div>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {mod.description}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DosimetryUploadHubPage() {
  const groups = (["dosimetria", "dosimetros", "otros"] as const).filter(
    (g) => MODULES.some((m) => m.group === g)
  );

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40">
          <Upload className="h-7 w-7 text-blue-700 dark:text-blue-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de carga — Dosimetría</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importa informes de dosis, carga registros trimestrales o ingresa datos manualmente desde un único punto de acceso.
          </p>
        </div>
      </div>

      {/* Module groups */}
      {groups.map((group) => {
        const GroupIcon = GROUP_ICONS[group];
        const groupModules = MODULES.filter((m) => m.group === group);
        return (
          <section key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <GroupIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {GROUP_LABELS[group]}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {groupModules.map((mod) => (
                <ModuleCard key={mod.href} mod={mod} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/40 hover:border-muted-foreground/30 transition-colors text-xs text-muted-foreground hover:text-foreground group"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 group-hover:text-blue-600" />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Regulatory note */}
      <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1 leading-relaxed">
        <p>
          <strong>Obligatoriedad normativa:</strong> DS N°133/1984 y DS N°95/2005 MINSAL — Todo registro de dosis debe conservarse durante 30 años desde la fecha de la última entrada o hasta 50 años de edad del trabajador (lo que sea mayor).
        </p>
        <p>
          CCHEN ORD sobre archivo histórico de dosimetría personal · Límites DS 3/1985: Cat. A 50 mSv/año, Cat. B 15 mSv/año · ICRP 103 (2007).
        </p>
      </div>
    </div>
  );
}
