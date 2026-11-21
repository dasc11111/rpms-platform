import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "info";

interface Alert {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  dueLabel: string;
  href: string;
}

// Alertas dinámicas que llegan desde el dashboard server component
export interface DynamicAlert {
  id: string;
  type: "danger" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  regulation?: string;
  action?: string;
}

// Convierte alertas dinámicas al formato interno del panel
function toAlert(a: DynamicAlert): Alert {
  return {
    id: a.id,
    severity: a.type === "danger" ? "critical" : a.type === "warning" ? "high" : "info",
    title: a.title,
    description: a.regulation ? `${a.module} · ${a.regulation}` : a.module,
    dueLabel: a.detail,
    href: a.action ?? "/compliance",
  };
}

const STATIC_ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "critical",
    title: "Reporte trimestral SEREMI Q3-2026",
    description: "Envío obligatorio de comunicación de dosis del trimestre.",
    dueLabel: "vence en 3 días",
    href: "/compliance/reports/seremi-q3-2026",
  },
  {
    id: "a2",
    severity: "high",
    title: "Renovación autorización OPR: 2 personas",
    description: "Curso obligatorio de recertificación en agosto.",
    dueLabel: "vence en 47 días",
    href: "/workers?filter=authorization_expiring",
  },
  {
    id: "a3",
    severity: "medium",
    title: "Residuo I-131 lote #22",
    description: "Lista para disposición tras período de decaimiento.",
    dueLabel: "acción sugerida hoy",
    href: "/sources/waste/lot-22",
  },
  {
    id: "a4",
    severity: "info",
    title: "3 documentos clasificados por Copilot",
    description: "Requieren confirmación humana.",
    dueLabel: "sin urgencia",
    href: "/documents?status=pending_review",
  },
];

const ICON: Record<Severity, typeof AlertCircle> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  info: Info,
};

const TONE: Record<Severity, string> = {
  critical: "text-danger bg-danger-subtle",
  high: "text-warning bg-warning-subtle",
  medium: "text-warning bg-warning-subtle",
  info: "text-info bg-info-subtle",
};

interface AlertsPanelProps {
  /** Alertas dinámicas desde el servidor. Si no se pasan, usa datos de muestra. */
  alerts?: DynamicAlert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const items: Alert[] =
    alerts && alerts.length > 0
      ? alerts.map(toAlert)
      : STATIC_ALERTS;

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-green-600 font-medium">
        ✓ Sin alertas regulatorias activas
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((alert) => {
        const Icon = ICON[alert.severity];
        return (
          <Link
            key={alert.id}
            href={alert.href}
            className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-2.5 transition-colors hover:border-accent"
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                TONE[alert.severity],
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{alert.title}</span>
                <span className={cn(
                  "shrink-0 text-[10px] font-medium",
                  alert.severity === "critical" && "text-danger",
                  alert.severity === "high" && "text-warning",
                  alert.severity === "medium" && "text-warning",
                  alert.severity === "info" && "text-muted-foreground",
                )}>
                  {alert.dueLabel}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">{alert.description}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
