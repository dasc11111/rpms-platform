import Link from "next/link";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { computeDosimeterAlerts, ALERT_SEVERITY_LABEL, ALERT_SEVERITY_CLASS, type DosimeterAlertSeverity } from "@/lib/dosimeter-alerts";
import { DosimetersSubnav } from "@/components/dosimeters/dosimeters-subnav";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICON: Record<DosimeterAlertSeverity, any> = { alta: AlertCircle, media: AlertTriangle, baja: Info };

export default async function DosimeterAlertsPage() {
  const alerts = await computeDosimeterAlerts();
  const alta = alerts.filter((a) => a.severity === "alta").length;
  const media = alerts.filter((a) => a.severity === "media").length;
  const baja = alerts.filter((a) => a.severity === "baja").length;

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <h1 className="text-lg font-semibold mb-1">Dosimetros</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Analisis automatico de dosis, devoluciones de dosimetros y reportes faltantes, en base a los reportes trimestrales importados.
      </p>

      <DosimetersSubnav active="alertas" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <KPICard label="Alertas altas" value={alta} icon={AlertCircle} tone="danger" href="/dosimeters/alerts" />
        <KPICard label="Alertas medias" value={media} icon={AlertTriangle} tone="warning" href="/dosimeters/alerts" />
        <KPICard label="Alertas bajas" value={baja} icon={Info} href="/dosimeters/alerts" />
      </div>

      <div className="flex flex-col gap-2">
        {alerts.map((a) => {
          const Icon = ICON[a.severity];
          return (
            <Link
              href={a.href}
              key={a.id}
              className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-3 hover:border-accent"
            >
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", ALERT_SEVERITY_CLASS[a.severity])}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{a.title}</span>
                <span className="text-xs text-muted-foreground">{a.description}</span>
              </div>
              <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", ALERT_SEVERITY_CLASS[a.severity])}>
                {ALERT_SEVERITY_LABEL[a.severity]}
              </span>
            </Link>
          );
        })}
        {alerts.length === 0 && <p className="text-xs text-muted-foreground">No hay alertas dosimetricas activas.</p>}
      </div>
    </div>
  );
}
