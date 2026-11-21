import { AlertTriangle, Ban, ClipboardCheck, FileWarning, FlaskConical, GraduationCap, PauseCircle, Radio, Radiation, ShieldAlert, ShieldCheck, ShieldX, UserCog, Users, XCircle, Zap } from "lucide-react";
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

  // KPIs de nuevos módulos — fuentes, radiofármacos, blindajes, QC MN, dosímetros
  let fuentesInventarioVencido = 0;
  let radiofarmacosExpiring = 0;
  let blindajesEnRevision = 0;
  let qcFallidos = 0;
  let dosimetrosProblema = 0;

  try {
    const { rows: srcRows } = await sql`
      SELECT COUNT(*)::int AS overdue FROM radioactive_sources
      WHERE next_inventory_date < CURRENT_DATE AND status IN ('in_use','stored')
    `;
    fuentesInventarioVencido = Number((srcRows[0] as any)?.overdue ?? 0);
  } catch { /* tabla no creada */ }

  try {
    const { rows: rfRows } = await sql`
      SELECT COUNT(*)::int AS expiring FROM radiopharmaceuticals
      WHERE status = 'active' AND expiry_datetime < now() + INTERVAL '24 hours'
    `;
    radiofarmacosExpiring = Number((rfRows[0] as any)?.expiring ?? 0);
  } catch { /* tabla no creada */ }

  try {
    const { rows: shRows } = await sql`
      SELECT COUNT(*)::int AS review FROM shielding WHERE status IN ('review','failed')
    `;
    blindajesEnRevision = Number((shRows[0] as any)?.review ?? 0);
  } catch { /* tabla no creada */ }

  try {
    const { rows: qcRows } = await sql`
      SELECT COUNT(*)::int AS fails FROM qc_records
      WHERE pass = false AND performed_at > now() - INTERVAL '30 days'
    `;
    qcFallidos = Number((qcRows[0] as any)?.fails ?? 0);
  } catch { /* tabla no creada */ }

  try {
    const { rows: dosRows } = await sql`
      SELECT COUNT(*)::int AS problems FROM dosimeters
      WHERE status IN ('lost','damaged')
    `;
    dosimetrosProblema = Number((dosRows[0] as any)?.problems ?? 0);
  } catch { /* tabla no creada */ }

  // Dosis colectiva mensual (últimos 6 meses) para DoseChart
  interface DosePoint { month: string; dosis_total: number; trabajadores: number; dosis_max: number; }
  let doseData: DosePoint[] = [];
  try {
    const { rows: doseRows } = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', month_year), 'Mon YY') AS month,
        ROUND(SUM(total_dose_msv)::numeric, 2)::float AS dosis_total,
        COUNT(DISTINCT worker_rut)::int AS trabajadores,
        ROUND(MAX(total_dose_msv)::numeric, 2)::float AS dosis_max
      FROM worker_dose_summary_monthly
      WHERE month_year >= DATE_TRUNC('month', now()) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month', month_year)
      ORDER BY DATE_TRUNC('month', month_year) ASC
    `;
    doseData = doseRows as DosePoint[];
  } catch { /* tabla no creada aún */ }

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
        <KPICard label="Inv. fuentes vencido" value={fuentesInventarioVencido} href="/sources" icon={Zap} tone={fuentesInventarioVencido > 0 ? "danger" : "default"} />
        <KPICard label="Radiofárm. por vencer" value={radiofarmacosExpiring} href="/radiopharmacy" icon={FlaskConical} tone={radiofarmacosExpiring > 0 ? "warning" : "default"} />
        <KPICard label="Blindajes en revisión" value={blindajesEnRevision} href="/shielding" icon={ShieldAlert} tone={blindajesEnRevision > 0 ? "warning" : "default"} />
        <KPICard label="CC MN fallidos (30d)" value={qcFallidos} href="/quality-control" icon={ShieldAlert} tone={qcFallidos > 0 ? "danger" : "default"} />
        <KPICard label="Dosímetros con problema" value={dosimetrosProblema} href="/dosimeters" icon={AlertTriangle} tone={dosimetrosProblema > 0 ? "danger" : "default"} />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Dosis colectiva mensual</h2>
          <DoseChart data={doseData} />
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
