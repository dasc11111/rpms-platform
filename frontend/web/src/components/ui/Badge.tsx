import * as React from "react";
import { clsx } from "clsx";
import { SEMAPHORE, semaphoreFromStatus } from "@/lib/design-system";
import type { SemaphoreLevel } from "@/lib/design-system";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent-subtle text-accent",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
};

export function Badge({
  className,
  tone = "neutral",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_CLASSES[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function SemaphoreDot({ level, className }: { level: SemaphoreLevel; className?: string }) {
  const cfg = SEMAPHORE[level];
  return <span title={cfg.label} className={clsx("inline-block h-2.5 w-2.5 rounded-full", cfg.dot, className)} />;
}

export function StatusBadge({
  status,
  level,
  className,
}: {
  status?: string | null;
  level?: SemaphoreLevel;
  className?: string;
}) {
  const resolved: SemaphoreLevel = level ?? semaphoreFromStatus(status ?? null);
  const cfg = SEMAPHORE[resolved];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.badgeBg, cfg.badgeText, className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {status ?? cfg.label}
    </span>
  );
}
