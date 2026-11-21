import * as React from "react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Info, XCircle, Inbox, Loader2 } from "lucide-react";

export type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_CONFIG: Record<AlertTone, { icon: typeof Info; bg: string; text: string; border: string }> = {
  info: { icon: Info, bg: "bg-info-subtle", text: "text-info", border: "border-info/30" },
  success: { icon: CheckCircle2, bg: "bg-success-subtle", text: "text-success", border: "border-success/30" },
  warning: { icon: AlertTriangle, bg: "bg-warning-subtle", text: "text-warning", border: "border-warning/30" },
  danger: { icon: XCircle, bg: "bg-danger-subtle", text: "text-danger", border: "border-danger/30" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const cfg = ALERT_CONFIG[tone];
  const Icon = cfg.icon;
  return (
    <div className={clsx("flex items-start gap-2 rounded-md border p-3 text-sm", cfg.bg, cfg.text, cfg.border, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-xs opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Sin datos",
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-4 w-4 animate-spin text-muted-foreground", className)} />;
}
