import { Activity, AlertTriangle, Ban, Calendar, ClipboardCheck, FileWarning, Package, PauseCircle, Radio, Radiation, Search, ShieldAlert, UserCog, Users, Wrench, XCircle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DoseChart } from "@/components/dashboard/dose-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { CopilotSuggestions } from "@/components/dashboard/copilot-suggestions";
import { WorkersByService } from "@/components/dashboard/workers-by-service";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const now = new Date().toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" });

  const { rows: statusByService } = await sql`
    SELECT status, COALESCE(NULLIF(TRIM(service), ''), 'Sin servicio') as service, COUNT(*)::int as count
    FROM workers
    WHERE status <> 'inactive'
    GROUP BY status, 2
  `;

  const byService: { service: string; count: number }[] = [];
  const serviceTotals = new Map<string, number>();
  let totalActive = 0;
  let totalSuspended = 0;

  for (const row of statusByService as any[]) {
    const count = Number(row.count) || 0;
    if (row.status === "active") {
      totalActive += count;
      serviceTotals.set(row.service, (serviceTotals.get(row.service) ?? 0) + count);
    } else if (row.status === "suspended") {
      totalSuspended += count;
    }
  }

  for (const [service, count] of serviceTotals.entries()) {
    byService.push({ service, count });
  }
  byService.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Buenos días, Javiera.</h1>
          <p className="text-xs text-muted-foreground">Estado a {now}</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <KPICard label="Trabajadores activos" value={totalActive} href="/workers" icon={Users} />
        <KPICard label="Suspendidos" value={totalSuspended} href="/workers" icon={PauseCircle} tone="warning" />
        <KPICard label="Dosím. pend. devolver" value={7} href="/dosimetry" icon={Package} tone="warning" />
        <KPICard label="Dosím. extraviados" value={2} href="/dosimetry" icon={Search} tone="danger" />
        <KPICard label="Sin autorización" value={3} href="/workers" icon={XCircle} tone="danger" />
        <KPICard label="Autoriz. próx. vencer" value={12} href="/workers" icon={UserCog} tone="warning" />
        <KPICard label="Equipos pendientes" value={5} href="/equipment" icon={Radio} />
        <KPICard label="Equipos fuera servicio" value={2} href="/equipment" icon={Ban} tone="warning" />
        <KPICard label="Blindajes pendientes" value={1} href="/compliance" icon={ShieldAlert} tone="warning" />
        <KPICard label="QA pendientes" value={8} href="/equipment" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Inspecciones pendientes" value={4} href="/compliance" icon={FileWarning} tone="warning" />
        <KPICard label="Incidentes abiertos" value={3} href="/incidents" icon={AlertTriangle} tone="danger" />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Dosis colectiva mensual</h2>
          <DoseChart />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Vencimientos próximos 90 días</h2>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Autorizaciones: 12 · Licencias: 5 · Calibraciones: 18 · QA: 7</p>
          </div>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Alertas regulatorias</h2>
          <AlertsPanel />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Radiation className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
            <h2 className="text-sm font-semibold">Copilot — Recomendado hoy</h2>
          </div>
          <CopilotSuggestions />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Trabajadores activos por servicio</h2>
        <WorkersByService data={byService} />
      </div>
    </div>
  );
}
