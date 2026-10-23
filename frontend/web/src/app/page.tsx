import { Activity, AlertTriangle, Ban, ClipboardCheck, FileWarning, GraduationCap, Package, PauseCircle, Radio, Radiation, Search, ShieldAlert, ShieldCheck, ShieldX, UserCog, Users, XCircle, AlertCircle, Info } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DoseChart } from "@/components/dashboard/dose-chart";
import { AlertsPanel, type DashboardAlert } from "@/components/dashboard/alerts-panel";
import { CopilotSuggestions, type CopilotSuggestion } from "@/components/dashboard/copilot-suggestions";
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

  // Incidentes abiertos (real DB)
  let incidentesAbiertos = 0;
  try {
    const { rows: incRows } = await sql`
      SELECT COUNT(*)::int as count FROM nm_incidents WHERE status = 'abierto'
    `;
    incidentesAbiertos = Number((incRows[0] as any)?.count ?? 0);
  } catch {}

  // Cumplimiento normativo (real DB)
  let complianceVencido = 0;
  let compliancePendiente = 0;
  try {
    const { rows: compRows } = await sql`
      SELECT status, COUNT(*)::int as count FROM compliance_requirements GROUP BY status
    `;
    for (const r of compRows as any[]) {
      if (r.status === "vencido") complianceVencido = Number(r.count ?? 0);
      if (r.status === "pendiente") compliancePendiente = Number(r.count ?? 0);
    }
  } catch {}

  // Instrumentos (real DB)
  let instrumentosMantenimiento = 0;
  let instrumentosFueraServicio = 0;
  let instrumentosCalibVencida = 0;
  let calibracionesProx90 = 0;
  try {
    const { rows: instrRows } = await sql`
      SELECT status, COUNT(*)::int as count FROM instruments GROUP BY status
    `;
    for (const r of instrRows as any[]) {
      if (r.status === "en_mantenimiento") instrumentosMantenimiento = Number(r.count ?? 0);
      if (r.status === "fuera_servicio") instrumentosFueraServicio = Number(r.count ?? 0);
    }
    const { rows: calibRows } = await sql`
      SELECT COUNT(*)::int as count FROM instruments i
      WHERE i.status = 'operativo'
        AND NOT EXISTS (
          SELECT 1 FROM calibrations c
          WHERE c.instrument_id = i.id AND c.expiry_date >= CURRENT_DATE
        )
    `;
    instrumentosCalibVencida = Number((calibRows[0] as any)?.count ?? 0);
    // Calibraciones próximas a vencer (90 días)
    const { rows: calibProxRows } = await sql`
      SELECT COUNT(DISTINCT i.id)::int as count FROM instruments i
      JOIN LATERAL (
        SELECT expiry_date FROM calibrations c WHERE c.instrument_id = i.id
        ORDER BY c.calibration_date DESC LIMIT 1
      ) lc ON true
      WHERE lc.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
    `;
    calibracionesProx90 = Number((calibProxRows[0] as any)?.count ?? 0);
  } catch {}

  // Control de Calidad — pruebas vencidas (PET/CT + Activímetro + Gammacamara + SPECT)
  let qcPetctVencidas = 0;
  let qcActivimetroVencidas = 0;
  let qcGammacamaraVencidas = 0;
  let qcSpectVencidas = 0;
  try {
    // PET/CT: contar combinaciones equipo+prueba con última prueba vencida
    const { rows: petctDue } = await sql`
      WITH latest AS (
        SELECT
          r.equipment_id,
          r.test_type,
          MAX(r.performed_at) AS last_performed
        FROM qc_petct_records r
        WHERE r.status = 'final'
        GROUP BY r.equipment_id, r.test_type
      )
      SELECT COUNT(*) AS count
      FROM latest l
      JOIN qc_petct_tolerances t ON t.test_type = l.test_type AND t.active = true
      WHERE (l.last_performed + (t.frequency_days * INTERVAL '1 day')) < NOW()
        AND t.frequency_days IS NOT NULL
    `;
    qcPetctVencidas = Number((petctDue[0] as any)?.count ?? 0);
  } catch {}

  try {
    // Activímetro: contar combinaciones equipo+prueba con última prueba vencida
    const { rows: activDue } = await sql`
      WITH latest AS (
        SELECT
          r.equipment_id,
          r.test_type,
          MAX(r.performed_at) AS last_performed
        FROM qc_activimetro_records r
        WHERE r.status = 'final'
        GROUP BY r.equipment_id, r.test_type
      )
      SELECT COUNT(*) AS count
      FROM latest l
      JOIN qc_activimetro_tolerances t ON t.test_type = l.test_type AND t.active = true
      WHERE (l.last_performed + (t.frequency_days * INTERVAL '1 day')) < NOW()
        AND t.frequency_days IS NOT NULL
    `;
    qcActivimetroVencidas = Number((activDue[0] as any)?.count ?? 0);
  } catch {}

  try {
    // Gammacamara: contar combinaciones instrumento+prueba+modo con última prueba vencida
    const { rows: gammaDue } = await sql`
      WITH latest AS (
        SELECT r.instrument_id, r.test_type, r.test_mode, MAX(r.test_date) AS last_test_date
        FROM qc_gammacamara_tests r
        WHERE r.instrument_id IS NOT NULL
        GROUP BY r.instrument_id, r.test_type, r.test_mode
      )
      SELECT COUNT(*) AS count
      FROM latest l
      JOIN qc_gammacamara_tolerances t ON t.test_type = l.test_type AND t.test_mode = l.test_mode AND t.active = true
      WHERE t.frequency_days IS NOT NULL
        AND (l.last_test_date + (t.frequency_days * INTERVAL '1 day')) < NOW()
    `;
    qcGammacamaraVencidas = Number((gammaDue[0] as any)?.count ?? 0);
  } catch {}

  try {
    // SPECT: contar combinaciones instrumento+prueba con última prueba vencida
    const { rows: spectDue } = await sql`
      WITH latest AS (
        SELECT r.instrument_id, r.test_type, MAX(r.test_date) AS last_test_date
        FROM qc_spect_tests r
        WHERE r.instrument_id IS NOT NULL
        GROUP BY r.instrument_id, r.test_type
      )
      SELECT COUNT(*) AS count
      FROM latest l
      JOIN qc_spect_tolerances t ON t.test_type = l.test_type AND t.active = true
      WHERE t.frequency_days IS NOT NULL
        AND (l.last_test_date + (t.frequency_days * INTERVAL '1 day')) < NOW()
    `;
    qcSpectVencidas = Number((spectDue[0] as any)?.count ?? 0);
  } catch {}

  // ── Build real dashboard alerts from DB data ────────────────────────────────
  const dashboardAlerts: DashboardAlert[] = [];

  if (totalVencida > 0) {
    dashboardAlerts.push({
      id: "auth-vencida",
      severity: "critical",
      title: `${totalVencida} autorización${totalVencida > 1 ? "es" : ""} vencida${totalVencida > 1 ? "s" : ""}`,
      description: "Trabajadores con autorización OPR vencida requieren acción inmediata.",
      href: "/workers",
    });
  }

  if (complianceVencido > 0) {
    dashboardAlerts.push({
      id: "compliance-vencido",
      severity: "critical",
      title: `${complianceVencido} requisito${complianceVencido > 1 ? "s" : ""} normativo${complianceVencido > 1 ? "s" : ""} vencido${complianceVencido > 1 ? "s" : ""}`,
      description: "Requisitos DS 133/1984 / DS 3/1985 / Ley 18.302 vencidos sin renovar.",
      href: "/compliance",
    });
  }

  if (instrumentosCalibVencida > 0) {
    dashboardAlerts.push({
      id: "calib-vencida",
      severity: instrumentosCalibVencida > 2 ? "critical" : "high",
      title: `${instrumentosCalibVencida} instrumento${instrumentosCalibVencida > 1 ? "s" : ""} sin calibración vigente`,
      description: "Instrumentos operativos sin certificado de calibración activo.",
      href: "/instruments",
    });
  }

  if (totalProximaVencer > 0) {
    dashboardAlerts.push({
      id: "auth-proxima",
      severity: "high",
      title: `${totalProximaVencer} autorización${totalProximaVencer > 1 ? "es" : ""} próxima a vencer`,
      description: "Gestionar renovación de autorizaciones OPR antes del vencimiento.",
      dueLabel: "≤ 90 días",
      href: "/workers",
    });
  }

  if (compliancePendiente > 0) {
    dashboardAlerts.push({
      id: "compliance-pendiente",
      severity: "medium",
      title: `${compliancePendiente} requisito${compliancePendiente > 1 ? "s" : ""} normativo${compliancePendiente > 1 ? "s" : ""} pendiente${compliancePendiente > 1 ? "s" : ""}`,
      description: "Requieren revisión y actualización de evidencia.",
      href: "/compliance",
    });
  }

  if (calibracionesProx90 > 0) {
    dashboardAlerts.push({
      id: "calib-proxima",
      severity: "medium",
      title: `${calibracionesProx90} calibración${calibracionesProx90 > 1 ? "es" : ""} próxima${calibracionesProx90 > 1 ? "s" : ""} a vencer`,
      description: "Coordinar calibración de instrumentos antes del vencimiento.",
      dueLabel: "≤ 90 días",
      href: "/instruments",
    });
  }

  if (qcPetctVencidas > 0) {
    dashboardAlerts.push({
      id: "qc-petct-vencidas",
      severity: qcPetctVencidas > 3 ? "critical" : "high",
      title: `${qcPetctVencidas} prueba${qcPetctVencidas > 1 ? "s" : ""} de QC PET/CT vencida${qcPetctVencidas > 1 ? "s" : ""}`,
      description: "Controles de calidad PET/CT fuera de frecuencia establecida.",
      href: "/quality-control/petct/compliance",
    });
  }

  if (qcActivimetroVencidas > 0) {
    dashboardAlerts.push({
      id: "qc-activimetro-vencidas",
      severity: "high",
      title: `${qcActivimetroVencidas} prueba${qcActivimetroVencidas > 1 ? "s" : ""} de QC Activímetro vencida${qcActivimetroVencidas > 1 ? "s" : ""}`,
      description: "Controles de calidad del activímetro fuera de frecuencia establecida.",
      href: "/quality-control/activimetro/dashboard",
    });
  }

  if (qcGammacamaraVencidas > 0) {
    dashboardAlerts.push({
      id: "qc-gammacamara-vencidas",
      severity: qcGammacamaraVencidas > 3 ? "critical" : "high",
      title: `${qcGammacamaraVencidas} prueba${qcGammacamaraVencidas > 1 ? "s" : ""} de QC Gammacámara vencida${qcGammacamaraVencidas > 1 ? "s" : ""}`,
      description: "Pruebas de uniformidad, resolución o sensibilidad fuera de frecuencia IAEA TECDOC-602.",
      href: "/quality-control/gammacamara",
    });
  }

  if (qcSpectVencidas > 0) {
    dashboardAlerts.push({
      id: "qc-spect-vencidas",
      severity: qcSpectVencidas > 3 ? "critical" : "high",
      title: `${qcSpectVencidas} prueba${qcSpectVencidas > 1 ? "s" : ""} de QC SPECT vencida${qcSpectVencidas > 1 ? "s" : ""}`,
      description: "Centro de rotación o uniformidad tomográfica SPECT fuera de frecuencia IAEA TECDOC-602.",
      href: "/quality-control/spect",
    });
  }

  // ── Build copilot suggestions based on real data ──────────────────────────
  const copilotSuggestions: CopilotSuggestion[] = [];

  if (incidentesAbiertos > 0) {
    copilotSuggestions.push({
      id: "close-incidents",
      title: `Revisar ${incidentesAbiertos} incidente${incidentesAbiertos > 1 ? "s" : ""} abierto${incidentesAbiertos > 1 ? "s" : ""}`,
      action: "Verificar estado de investigación y acciones correctivas.",
      href: "/incidents",
    });
  }

  if (pendingReturnCount > 0) {
    copilotSuggestions.push({
      id: "dosimetros-devolver",
      title: `Gestionar ${pendingReturnCount} dosímetro${pendingReturnCount > 1 ? "s" : ""} pendiente${pendingReturnCount > 1 ? "s" : ""} de devolución`,
      action: "Contactar trabajadores o laboratorio de dosimetría.",
      href: "/dosimetry",
    });
  }

  if (complianceVencido > 0 || compliancePendiente > 0) {
    copilotSuggestions.push({
      id: "compliance-action",
      title: "Actualizar requisitos normativos",
      action: `${complianceVencido} vencidos y ${compliancePendiente} pendientes requieren atención.`,
      href: "/compliance",
    });
  }

  if (instrumentosCalibVencida > 0) {
    copilotSuggestions.push({
      id: "calibration-action",
      title: `Programar calibración para ${instrumentosCalibVencida} instrumento${instrumentosCalibVencida > 1 ? "s" : ""}`,
      action: "Coordinar con el proveedor de calibración acreditado.",
      href: "/instruments",
    });
  }

  if (qcPetctVencidas > 0) {
    copilotSuggestions.push({
      id: "qc-petct-action",
      title: `Realizar ${qcPetctVencidas} control${qcPetctVencidas > 1 ? "es" : ""} de calidad PET/CT vencido${qcPetctVencidas > 1 ? "s" : ""}`,
      action: "Revisar pruebas PET, CT e interacción con el Físico Médico responsable.",
      href: "/quality-control/petct/compliance",
    });
  }

  if (qcActivimetroVencidas > 0) {
    copilotSuggestions.push({
      id: "qc-activimetro-action",
      title: `Realizar ${qcActivimetroVencidas} control${qcActivimetroVencidas > 1 ? "es" : ""} de calidad de activímetro vencido${qcActivimetroVencidas > 1 ? "s" : ""}`,
      action: "Registrar pruebas de constancia, linealidad y exactitud del activímetro.",
      href: "/quality-control/activimetro/dashboard",
    });
  }

  if (qcGammacamaraVencidas > 0) {
    copilotSuggestions.push({
      id: "qc-gammacamara-action",
      title: `Realizar ${qcGammacamaraVencidas} control${qcGammacamaraVencidas > 1 ? "es" : ""} de calidad de gammacámara vencido${qcGammacamaraVencidas > 1 ? "s" : ""}`,
      action: "Registrar pruebas de uniformidad, resolución y sensibilidad según IAEA TECDOC-602.",
      href: "/quality-control/gammacamara",
    });
  }

  if (qcSpectVencidas > 0) {
    copilotSuggestions.push({
      id: "qc-spect-action",
      title: `Realizar ${qcSpectVencidas} control${qcSpectVencidas > 1 ? "es" : ""} de calidad SPECT vencido${qcSpectVencidas > 1 ? "s" : ""}`,
      action: "Verificar centro de rotación y uniformidad tomográfica con el Físico Médico.",
      href: "/quality-control/spect",
    });
  }

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
        <KPICard label="Instrumentos en mantención" value={instrumentosMantenimiento} href="/instruments" icon={Radio} tone={instrumentosMantenimiento > 0 ? "warning" : undefined} />
        <KPICard label="Instrumentos fuera servicio" value={instrumentosFueraServicio} href="/instruments" icon={Ban} tone={instrumentosFueraServicio > 0 ? "danger" : undefined} />
        <KPICard label="Req. normativos vencidos" value={complianceVencido} href="/compliance" icon={ShieldAlert} tone={complianceVencido > 0 ? "danger" : undefined} />
        <KPICard label="Req. normativos pendientes" value={compliancePendiente} href="/compliance" icon={FileWarning} tone={compliancePendiente > 0 ? "warning" : undefined} />
        <KPICard label="Calibraciones vencidas" value={instrumentosCalibVencida} href="/instruments" icon={ClipboardCheck} tone={instrumentosCalibVencida > 0 ? "warning" : undefined} />
        <KPICard label="Incidentes abiertos" value={incidentesAbiertos} href="/incidents" icon={AlertTriangle} tone={incidentesAbiertos > 0 ? "danger" : undefined} />
        <KPICard label="QC PET/CT vencidas" value={qcPetctVencidas} href="/quality-control/petct/compliance" icon={Activity} tone={qcPetctVencidas > 0 ? "danger" : undefined} hint="pruebas sin realizar" />
        <KPICard label="QC Activímetro vencidas" value={qcActivimetroVencidas} href="/quality-control/activimetro/dashboard" icon={Activity} tone={qcActivimetroVencidas > 0 ? "warning" : undefined} hint="pruebas sin realizar" />
        <KPICard label="QC Gammacámara vencidas" value={qcGammacamaraVencidas} href="/quality-control/gammacamara" icon={Activity} tone={qcGammacamaraVencidas > 0 ? "danger" : undefined} hint="pruebas sin realizar" />
        <KPICard label="QC SPECT vencidas" value={qcSpectVencidas} href="/quality-control/spect" icon={Activity} tone={qcSpectVencidas > 0 ? "warning" : undefined} hint="pruebas sin realizar" />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Dosis colectiva mensual</h2>
          <DoseChart />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Vencimientos próximos 90 días</h2>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Autorizaciones: {totalProximaVencer + totalVencida} · Calibraciones: {calibracionesProx90} · Req. normativos vencidos: {complianceVencido}</p>
          </div>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Alertas regulatorias</h2>
          <AlertsPanel alerts={dashboardAlerts} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Radiation className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
            <h2 className="text-sm font-semibold">Copilot — Recomendado hoy</h2>
          </div>
          <CopilotSuggestions suggestions={copilotSuggestions} />
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
