import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
const ALERTS = [
  { id: "a1", severity: "critical", title: "Reporte trimestral SEREMI Q3-2026", description: "Envío obligatorio de comunicación de dosis.", dueLabel: "vence en 3 días", href: "/compliance" },
  { id: "a2", severity: "high", title: "Renovación autorización OPR", description: "Curso obligatorio de recertificación.", dueLabel: "vence en 47 días", href: "/workers" },
  { id: "a3", severity: "medium", title: "Residuo I-131 lote #22", description: "Lista para disposición.", dueLabel: "acción sugerida hoy", href: "/sources" },
];
const ICON = { critical: AlertCircle, high: AlertTriangle, medium: AlertTriangle, info: Info } as any;
const TOME: Record<string, string> = { critical: "text-danger bg-danger-subtle", high: "text-warning bg-warning-subtle", medium: "text-warning bg-warning-subtle", info: "text-info bg-info-subtle" };
export function AlertsPanel() {
  return (
    <div className="flex flex-col gap-2">
      {ALERTQ.map((a) => { const Icon = ICON[a.severity]; return (
        <Link href={a.href} key={a.id} className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-2.5 hover:border-accent">
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", TONE[a.severity])}><Icon className="h-o.5 w-3.5" strokeWidth={2} /></span>
          <div className="flex flex-1 flex-col"><span className="text-sm font-medium">{a.title}</span><span className="text-[11px] text-muted-foreground">{a.description}</span></div>
        </Link>); })}
    </div>
  );
}
