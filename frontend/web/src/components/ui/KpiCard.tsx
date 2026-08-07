import * as React from "react";
import { clsx } from "clsx";
import { Card } from "./Card";
import { SEMAPHORE } from "@/lib/design-system";
import type { SemaphoreLevel } from "@/lib/design-system";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  level?: SemaphoreLevel;
  trend?: { value: number; label?: string };
  className?: string;
}

export function KpiCard({ label, value, icon, level, trend, className }: KpiCardProps) {
  const cfg = level ? SEMAPHORE[level] : null;
  return (
    <Card className={clsx("p-4 md:p-5", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums md:text-3xl">{value}</p>
          {trend ? (
            <p className={clsx("mt-1 text-xs font-medium", trend.value >= 0 ? "text-success" : "text-danger")}>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label ?? ""}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className={clsx("flex h-10 w-10 items-center justify-center rounded-md", cfg ? cfg.badgeBg : "bg-accent-subtle")}>
            <span className={clsx(cfg ? cfg.badgeText : "text-accent")}>{icon}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
