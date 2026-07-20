import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = { default: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info" };

export function KPICard({
  label,
  value,
  href,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone?: string;
  /** Texto corto opcional debajo del valor, ej. un porcentaje derivado. No afecta tarjetas que no lo usan. */
  hint?: string;
}) {
  return (
    <Link href={href} className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3 hover:border-accent">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", TONE[tone])} strokeWidth={2} />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-semibold tabular-nums", TONE[tone])}>{value}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </Link>
  );
}
