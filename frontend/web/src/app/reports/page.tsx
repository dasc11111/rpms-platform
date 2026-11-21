import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import { FileText, Users, AlertTriangle, Activity, Shield, Package, Download, FileSpreadsheet } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Resumen ejecutivo con datos reales de la BD
  let totalWorkers = 0;
  let courseCompleted = 0;
  let authVigente = 0;
  let totalIncidents = 0;
  let highSeverityIncidents = 0;
  let openIncidents = 0;
  let totalDosimetry = 0;
  let exceedanceCount = 0;
  let qcFailLast30 = 0;
  let sourcesOverdue = 0;
  let dosimetersIssue = 0;
  let complianceReqs = 0;
  let complianceMet = 0;

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE course_pr_completed = true)::int as course_ok,
        COUNT(*) FILTER (WHERE authorization_expiry_date >= CURRENT_DATE AND authorization_number IS NOT NULL)::int as vigente
      FROM workers WHERE status <> 'inactive'
    `;
    totalWorkers = Number((rows[0] as any)?.total ?? 0);
    courseCompleted = Number((rows[0] as any)?.course_ok ?? 0);
    authVigente = Number((rows[0] as any)?.vigente ?? 0);
  } catch { /* tabla no existe */ }

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE severity = 'high')::int as high_sev,
        COUNT(*) FILTER (WHERE status = 'open' OR status = 'investigating')::int as open_inc
      FROM incidents
    `;
    totalIncidents = Number((rows[0] as any)?.total ?? 0);
    highSeverityIncidents = Number((rows[0] as any)?.high_sev ?? 0);
    openIncidents = Number((rows[0] as any)?.open_inc ?? 0);
  } catch { /* tabla no existe */ }

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int as total FROM dosimetry_readings
    `;
    totalDosimetry = Number((rows[0] as any)?.total ?? 0);
  } catch { /* tabla no existe */ }

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS fails FROM qc_records
      WHERE pass = false AND performed_at > now() - INTERVAL '30 days'
    `;
    qcFailLast30 = Number((rows[0] as any)?.fails ?? 0);
  } catch { /* tabla no existe */ }

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS overdue FROM radioactive_sources
      WHERE next_inventory_date < CURRENT_DATE AND status IN ('in_use','stored')
    `;
    sourcesOverdue = Number((rows[0] as any)?.overdue ?? 0);
  } catch { /* tabla no existe */ }

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS problems FROM dosimeters
      WHERE status IN ('lost','damaged')
    `;
    dosimetersIssue = Number((rows[0] as any)?.problems ?? 0);
  } catch { /* tabla no existe */ }

  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'ok')::int as met
      FROM compliance_requirements
    `;
    complianceReqs = Number((rows[0] as any)?.total ?? 0);
    complianceMet = Number((rows[0] as any)?.met ?? 0);
  } catch { /* tabla no existe */ }

  const compliancePct = complianceReqs > 0 ? Math.round((complianceMet / complianceReqs) * 100) : null;
  const coursePct = totalWorkers > 0 ? Math.round((courseCompleted / totalWorkers) * 100) : 0;
  const authPct = totalWorkers > 0 ? Math.round((authVigente / totalWorkers) * 100) : 0;

  const today = new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });
  const year = new Date().getFullYear();
  const month = new Date().toLocaleDateString("es-CL", { month: "long" });

  const period = new Date().toISOString().slice(0, 7); // "2026-11"

  const REPORT_TYPES: {
    id: string; name: string; desc: string;
    icon: ComponentType<{ className?: string }>;
    regulacion: string; frecuencia: string; estado: string; ok: boolean;
    apiType: string; jsonHref: string; csvHref: string;
  }[] = [
    {
      id: "dosimetrico",
      name: "Informe Dosimétrico Mensual",
      desc: `Registros de dosis personal, lecturas dosimetrías y comparación con límites DS 3/1985. ${totalDosimetry} registros totales.`,
      icon: Activity,
      regulacion: "DS 3/1985 MINSAL · CCHEN",
      frecuencia: "Mensual",
      estado: "Disponible",
      ok: true,
      apiType: "dosimetry_monthly",
      jsonHref: `/api/reports/generate?type=dosimetry_monthly&period=${period}`,
      csvHref: `/api/reports/generate?type=dosimetry_monthly&period=${period}&format=csv`,
    },
    {
      id: "cumplimiento",
      name: "Reporte de Cumplimiento Normativo",
      desc: `${complianceMet} de ${complianceReqs} requisitos cumplidos${compliancePct !== null ? ` (${compliancePct}%)` : ""}. NS-06.0 CCHEN, DS 133/1984.`,
      icon: Shield,
      regulacion: "NS-06.0 CCHEN · DS 133/1984",
      frecuencia: "Trimestral",
      estado: compliancePct !== null && compliancePct < 80 ? "Atención" : "Disponible",
      ok: compliancePct === null || compliancePct >= 80,
      apiType: "compliance_matrix",
      jsonHref: `/api/reports/generate?type=compliance_matrix`,
      csvHref: `/api/reports/generate?type=compliance_matrix&format=csv`,
    },
    {
      id: "incidentes",
      name: "Resumen de Incidentes",
      desc: `${totalIncidents} incidentes totales, ${highSeverityIncidents} de alta severidad, ${openIncidents} abiertos/investigando.`,
      icon: AlertTriangle,
      regulacion: "NS-06.0 §16 CCHEN · IAEA INES",
      frecuencia: "Mensual",
      estado: openIncidents > 0 ? "Con alertas" : "Disponible",
      ok: openIncidents === 0,
      apiType: "incident_summary",
      jsonHref: `/api/reports/generate?type=incident_summary`,
      csvHref: `/api/reports/generate?type=incident_summary&format=csv`,
    },
    {
      id: "trabajadores",
      name: "Registro de Trabajadores",
      desc: `${totalWorkers} trabajadores. Curso PR: ${coursePct}%. Autorizaciones vigentes: ${authPct}%.`,
      icon: Users,
      regulacion: "NS-06.0 §8 CCHEN · DS 133/1984",
      frecuencia: "Mensual",
      estado: authPct < 80 ? "Atención" : "Disponible",
      ok: authPct >= 80,
      apiType: "worker_registry",
      jsonHref: `/api/reports/generate?type=worker_registry`,
      csvHref: `/api/reports/generate?type=worker_registry&format=csv`,
    },
    {
      id: "qc",
      name: "Control de Calidad Medicina Nuclear",
      desc: `${qcFailLast30} pruebas CC fallidas últimos 30 días. Protocolos Captus 3000, Atomlab 500, Gamma Cámara SPECT/CT.`,
      icon: Shield,
      regulacion: "IAEA SRS No.6 · NCRP 182 · NS-06.0 §14",
      frecuencia: "Mensual",
      estado: qcFailLast30 > 0 ? "Con fallas" : "Disponible",
      ok: qcFailLast30 === 0,
      apiType: "qc_summary",
      jsonHref: `/api/reports/generate?type=qc_summary`,
      csvHref: `/api/reports/generate?type=qc_summary&format=csv`,
    },
    {
      id: "fuentes",
      name: "Inventario de Fuentes Radiactivas",
      desc: `${sourcesOverdue} fuentes con inventario vencido. Reporte obligatorio a CCHEN según NS-06.0 §10.`,
      icon: Package,
      regulacion: "NS-06.0 §10 CCHEN · DS 133/1984",
      frecuencia: "Semestral",
      estado: sourcesOverdue > 0 ? "Con alertas" : "Disponible",
      ok: sourcesOverdue === 0,
      apiType: "source_inventory",
      jsonHref: `/api/reports/generate?type=source_inventory`,
      csvHref: `/api/reports/generate?type=source_inventory&format=csv`,
    },
    {
      id: "dosimetros_trim",
      name: "Dosimetría Trimestral Acumulada",
      desc: "Dosis acumulada por trimestre, niveles de investigación (NI) y comparación con límites ICRP 103.",
      icon: FileSpreadsheet,
      regulacion: "DS 3/1985 MINSAL · NS-06.0 §11",
      frecuencia: "Trimestral",
      estado: "Disponible",
      ok: true,
      apiType: "dosimetry_quarterly",
      jsonHref: `/api/reports/generate?type=dosimetry_quarterly`,
      csvHref: `/api/reports/generate?type=dosimetry_quarterly&format=csv`,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes — RPMS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generados automáticamente desde los datos del sistema. Estado a {today}.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="Tipos de reporte" value={REPORT_TYPES.length} href="/reports" icon={FileText} tone="default" />
        <KPICard label="Con alertas" value={REPORT_TYPES.filter((r) => !r.ok).length} href="/reports" icon={AlertTriangle} tone={REPORT_TYPES.some((r) => !r.ok) ? "warning" : "default"} />
        <KPICard label="Cumplimiento" value={complianceMet} href="/compliance" icon={Shield} hint={compliancePct !== null ? `${compliancePct}% de ${complianceReqs}` : undefined} tone={compliancePct !== null && compliancePct < 80 ? "danger" : "default"} />
        <KPICard label="Trabajadores" value={totalWorkers} href="/workers" icon={Users} hint={`${authPct}% autorizados`} />
      </div>

      {/* Resumen ejecutivo */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-1">Resumen Ejecutivo — {month} {year}</h2>
        <p className="text-xs text-muted-foreground mb-4">Hospital Dr. Hernán Henríquez Aravena — Medicina Nuclear / Protección Radiológica</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Trabajadores activos</span>
            <span className="font-semibold">{totalWorkers}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Con Curso PR</span>
            <span className="font-semibold">{courseCompleted} ({coursePct}%)</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Autorizaciones vigentes</span>
            <span className="font-semibold">{authVigente} ({authPct}%)</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Incidentes totales</span>
            <span className="font-semibold">{totalIncidents}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Incidentes abiertos</span>
            <span className={`font-semibold ${openIncidents > 0 ? "text-red-600" : ""}`}>{openIncidents}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">CC MN fallidos (30d)</span>
            <span className={`font-semibold ${qcFailLast30 > 0 ? "text-red-600" : ""}`}>{qcFailLast30}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Fuentes inv. vencido</span>
            <span className={`font-semibold ${sourcesOverdue > 0 ? "text-red-600" : ""}`}>{sourcesOverdue}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Dosímetros con problema</span>
            <span className={`font-semibold ${dosimetersIssue > 0 ? "text-red-600" : ""}`}>{dosimetersIssue}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span className="text-muted-foreground">Cumplimiento normativo</span>
            <span className={`font-semibold ${compliancePct !== null && compliancePct < 80 ? "text-amber-600" : ""}`}>
              {compliancePct !== null ? `${compliancePct}%` : "N/D"}
            </span>
          </div>
        </div>
      </div>

      {/* Catálogo de reportes */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Catálogo de Reportes</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {REPORT_TYPES.map((rep) => {
            const Icon = rep.icon;
            return (
              <div key={rep.id} className={`rounded-xl border p-4 ${rep.ok ? "border-border bg-surface" : "border-amber-200 bg-amber-50/50"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${rep.ok ? "bg-accent/10 text-accent" : "bg-amber-100 text-amber-700"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm">{rep.name}</h3>
                      <span className={`shrink-0 inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${rep.ok ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                        {rep.estado}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rep.desc}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>📋 {rep.regulacion}</span>
                      <span>🗓 {rep.frecuencia}</span>
                    </div>
                    {/* Botones de exportación */}
                    <div className="flex gap-2 mt-3">
                      <a
                        href={rep.csvHref}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        title="Descargar CSV"
                      >
                        <Download className="h-3 w-3" />
                        CSV
                      </a>
                      <a
                        href={rep.jsonHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        title="Ver JSON"
                      >
                        <FileText className="h-3 w-3" />
                        JSON
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Requerimientos regulatorios de reporte */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold mb-3">Plazos y Obligaciones de Reporte CCHEN / MINSAL</h3>
        <div className="grid gap-2 text-xs md:grid-cols-2">
          {[
            { plazo: "Inmediato (< 24h)", desc: "Eventos INES ≥ 1, sobreexposición accidental, pérdida de fuente sellada", ref: "NS-06.0 §16" },
            { plazo: "72 horas", desc: "Accidentes con exposición que supera límites anuales, contaminación mayor", ref: "DS 133/1984 Art. 72" },
            { plazo: "Mensual", desc: "Registro dosimétrico individual, registro de administraciones I-131", ref: "DS 3/1985 MINSAL" },
            { plazo: "Trimestral", desc: "Informe de cumplimiento al CCHEN, estado de autorizaciones", ref: "NS-06.0 §8" },
            { plazo: "Semestral", desc: "Inventario de fuentes radiactivas, estado de blindajes", ref: "NS-06.0 §10" },
            { plazo: "Anual", desc: "Informe anual de protección radiológica al CCHEN y Servicio de Salud", ref: "DS 133/1984 Art. 68" },
          ].map((item) => (
            <div key={item.plazo} className="flex gap-2 py-1.5 border-b border-border/50 last:border-0">
              <span className="font-mono text-accent shrink-0 font-medium w-28">{item.plazo}</span>
              <div>
                <div>{item.desc}</div>
                <div className="text-muted-foreground">{item.ref}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
