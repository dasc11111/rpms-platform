import { AlertTriangle, Ban, ClipboardCheck, FileWarning, GraduationCap, Package, PauseCircle, Radio, Radiation, Search, ShieldAlert, ShieldCheck, ShieldX, UserCog, Users, XCircle, AlertCircle, Info } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DoseChart } from "@/components/dashboard/dose-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { CopilotSuggestions } from "@/components/dashboard/copilot-suggestions";
import { WorkersByService } from "@/components/dashboard/workers-by-service";
import { ExpiringAuthorizationsTable } from "@/components/dashboard/expiring-authorizations-table";
import { sql } from "@/lib/db";
import { buildAuthSummary, type WorkerAuthSummary } from "@/lib/authorization";
import { computeDosimeterAlerts, ALERT_SEVERITY_LABEL, ALERT_SEVERITY_CLASS } from "@/lib/dosimeter-alerts";
import { getNotReturned } from "@/lib/dosimetry";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const now = new Date().toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" });

  const { rows: statusByService } = await sql`
    SELECT status, COALESCE(NULLIF(TRIM(service), ''), 'Sin servicio') as service, COUNT(*)::int as count
    FROM workers
    WHERE status <> 'inactive'
    GROUP BY status, 2
  `;

  const serviceTotals = new Map<string, number>();
  let totalActive = 0;
  let totalSuspended = 0;

  for (const row of statusByService as any[]) {
    const count = Number(row.count) || 0;
    if (row.status === "active") {
      totalActive += count;
      const label = String(row.service).trim().toUpperCase();
      serviceTotals.set(label, (serviceTotals.get(label) ?? 0) + count);
    } else if (row.status === "suspended") {
      totalSuspended += count;
    }
  }

  const byService = Array.from(serviceTotals.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));

  const { rows: authRows } = await sql`
    SELECT rut, name, email, course_pr_completed, authorization_number, authorization_expiry_date
    FROM workers
    WHERE status <> 'inactive'
  `;

  const totalWorkers = authRows.length;
  let totalCoursePR = 0;
  let totalVigente = 0;
  let totalProximaVencer = 0;
  let totalVencida = 0;
  let totalSinAutorizacion = 0;
  const summaries: WorkerAuthSummary[] = [];

  for (const r of authRows as any[]) {
    if (r.course_pr_completed) totalCoursePR++;
    const summary = buildAuthSummary(r);
    summaries.push(summary);
    if (summary.status === "vigente") totalVigente++;
    else if (summary.status === "proxima_vencer") totalProximaVencer++;
    else if (summary.status === "vencida") totalVencida++;
    else totalSinAutorizacion++;
  }

  const coursePrPct = totalWorkers > 0 ? Math.round((totalCoursePR / totalWorkers) * 100) : 0;

  const expiringSoon = summaries
    .filter((s) => s.status === "proxima_vencer" || s.status === "vencida")
    .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));

  const dosimeterAlerts = await computeDosimeterAlerts();
  const topDosimeterAlerts = dosimeterAlerts.slice(0, 6);

  // Hoja 'No devueltos' de la planilla oficial: se reutiliza el mismo calculo
  // en vivo que alimenta la vista de Dosimetria, para que el KPI del
  // Dashboard nunca quede desincronizado del detalle.
  let pendingReturnCount = 0;
  let lostCount = 0;
  try {
    const notReturned = await getNotReturned();
    pendingReturnCount = notReturned.filter((r) => !r.extraviado).length;
    lostCount = notReturned.filter((r) => r.extraviado).length;
  } catch {}

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
        <KPICard label="Con Curso PR" value={totalCoursePR} href="/workers" icon={GraduationCap} hint={`${coursePrPct}% del total`} />
        <KPICard label="Autorización vigente" value={totalVigente} href="/workers" icon={ShieldCheck} />
        <KPICard label="Autoriz. próx. vencer" value={totalProximaVencer} href="/workers" icon={UserCog} tone="warning" />
        <KPICard label="Autorización vencida" value={totalVencida} href="/workers" icon={ShieldX} tone="danger" />
        <KPICard label="Sin autorización" value={totalSinAutorizacion} href="/workers" icon={XCircle} tone="warning" />
        <KPICard label="Dosím. pend. devolver" value={pendingReturnCount} href="/dosimetry?tab=no-devueltos" icon={Package} tone="warning" />
        <KPICard label="Dosím. extraviados" value={lostCount} href="/dosimetry?tab=no-devueltos" icon={Search} tone="danger" />
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
            <p className="text-xs text-muted-foreground">Autorizaciones: {totalProximaVencer + totalVencida} · Licencias: 5 · Calibraciones: 18 · QA: 7</p>
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
      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Alertas dosimétricas</h2>
          {dosimeterAlerts.length > 6 && (
            <Link href="/dosimeters/alerts" className="text-xs text-accent hover:underline">
              Ver todas ({dosimeterAlerts.length})
            </Link>
          )}
        </div>
        {topDosimeterAlerts.length > 0 ? (
          <div className="space-y-2">
            {topDosimeterAlerts.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="flex items-start gap-2 rounded-md border border-border/60 p-2 text-xs hover:bg-muted/40"
              >
                {a.severity === "alta" ? (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" strokeWidth={2} />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", ALERT_SEVERITY_CLASS[a.severity])}>
                      {ALERT_SEVERITY_LABEL[a.severity]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin alertas dosimétricas activas.</p>
        )}
      </div>
      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-1">Autorizaciones próximas a vencer</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Semáforo: verde más de 120 días · amarillo 120 días o menos · rojo 90 días o menos (incluye vencidas).
          Ordenadas de menor a mayor cantidad de días restantes. El correo se muestra para copiarlo y contactar manualmente.
        </p>
        <ExpiringAuthorizationsTable items={expiringSoon} />
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Trabajadores activos por servicio</h2>
        <WorkersByService data={byService} />
      </div>
    </div>
  );
}
