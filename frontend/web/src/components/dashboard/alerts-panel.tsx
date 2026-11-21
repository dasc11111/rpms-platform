import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardAlert {
  id: string;
  severity: "critical" | "high" | "medium" | "info";
  title: string;
  description: string;
  dueLabel?: string;
  href: string;
}

const ICON = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  info: Info,
};

const TONE: Record<DashboardAlert["severity"], string> = {
  critical: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
  high: "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
  medium: "text-yellow-500 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20",
  info: "text-accent bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
};

interface Props {
  alerts?: DashboardAlert[];
}

export function AlertsPanel({ alerts }: Props) {
  const items = alerts ?? [];

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
        <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm text-green-700 dark:text-green-400">Sin alertas regulatorias activas.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => {
        const Icon = ICON[a.severity];
        return (
          <Link
            href={a.href}
            key={a.id}
            className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-2.5 hover:border-accent"
          >
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", TONE[a.severity])}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{a.title}</span>
              <span className="text-[11px] text-muted-foreground">{a.description}</span>
            </div>
            {a.dueLabel && (
              <span className="ml-2 shrink-0 self-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {a.dueLabel}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
