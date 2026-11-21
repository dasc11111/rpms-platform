import { AlertTriangle, Ban, ClipboardCheck, FileWarning, GraduationCap, PauseCircle, Radio, Radiation, ShieldAlert, ShieldCheck, ShieldX, UserCog, Users, XCircle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DoseChart } from "@/components/dashboard/dose-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { CopilotSuggestions } from "@/components/dashboard/copilot-suggestions";
import { WorkersByService } from "@/components/dashboard/workers-by-service";
import { ExpiringAuthorizationsTable } from "@/components/dashboard/expiring-authorizations-table";
import { sql } from "@/lib/db";
import { buildAuthSummary, type WorkerAuthSummary } from "@/lib/authorization";

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

  // Curso de Proteccion Radiologica (Curso PR) y Autorizaciones de Desempeno:
  // una sola consulta liviana; todo el resto (dias restantes, semaforo, estado
  // y KPIs) se DERIVA en memoria con funciones puras de src/lib/authorization.ts.
  // Esto evita N+1 queries y mantiene el Dashboard 100% automatico: al ser un
  // Server Component "force-dynamic", cada vez que un modulo llama router.refresh()
  // tras crear/editar/eliminar un registro, esta pagina se vuelve a renderizar
  // desde cero contra la base de datos, sin necesidad de ningun boton "Actualizar".
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

  // KPIs de módulos secundarios (con fallback a 0 si la tabla no existe aún)
  let equiposPendientes = 0;
  let equiposFueraServicio = 0;
  let incidentesAbiertos = 0;
  let incidentesEnInvestigacion = 0;
  let instrVencidos = 0;
  let instrPorVencer = 0;

  try {
    const { rows: eqRows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int        AS pending,
        COUNT(*) FILTER (WHERE status = 'out_of_service')::int AS out_of_service
      FROM equipment
    `;
    equiposPendientes = Number((eqRows[0] as any)?.pending ?? 0);
    equiposFueraServicio = Number((eqRows[0] as any)?.out_of_service ?? 0);
  } catch { /* tabla no creada */ }

  try {
    const { rows: incRows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int          AS open,
        COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating
      FROM incidents
    `;
    incidentesAbiertos = Number((incRows[0] as any)?.open ?? 0);
    incidentesEnInvestigacion = Number((incRows[0] as any)?.investigating ?? 0);
  } catch { /* tabla no creada */ }

  try {
    const { rows: insRows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'expired')::int   AS expired,
        COUNT(*) FILTER (WHERE status = 'expiring')::int  AS expiring
      FROM instruments
    `;
    instrVencidos = Number((insRows[0] as any)?.expired ?? 0);
    instrPorVencer = Number((insRows[0] as any)?.expiring ?? 0);
  } catch { /* tabla no creada */ }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sistema de Protección Radiológica</h1>
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
        <KPICard label="Equipos pendientes QA" value={equiposPendientes} href="/equipment" icon={Radio} tone="warning" />
        <KPICard label="Equipos fuera servicio" value={equiposFueraServicio} href="/equipment" icon={Ban} tone="danger" />
        <KPICard label="Instrum. por vencer" value={instrPorVencer} href="/instruments" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Instrum. vencidos" value={instrVencidos} href="/instruments" icon={ShieldAlert} tone="danger" />
        <KPICard label="Incidentes abiertos" value={incidentesAbiertos} href="/incidents" icon={AlertTriangle} tone="danger" />
        <KPICard label="En investigación" value={incidentesEnInvestigacion} href="/incidents" icon={FileWarning} tone="warning" />
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
