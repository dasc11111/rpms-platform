"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  Download,
  Users,
  Activity,
  Zap,
  Trash2,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  Truck,
  GraduationCap,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AnnualReport {
  year: number;
  generated_at: string;
  institution: Record<string, string> | null;
  poe: {
    total_active: string;
    authorized: string;
    expired_auth: string;
    total_inactive: string;
  } | null;
  top_dose_workers: Array<{ name: string; rut: string; role: string; heff_msv: string }>;
  dosimetry: {
    workers_monitored: string;
    avg_heff_msv: string;
    max_heff_msv: string;
    exceeded_annual_limit: string;
    investigation_level: string;
    total_records: string;
  } | null;
  sources: {
    total: string;
    in_use: string;
    stored: string;
    decommissioned: string;
    isotopes_count: string;
  } | null;
  source_inventory: Array<{
    source_code: string;
    isotope: string;
    activity_gbq: number;
    activity_date: string;
    manufacturer: string;
    status: string;
  }>;
  waste: {
    total_packages: string;
    exempt: string;
    llw_bbna: string;
    ilw_mbna: string;
    authorized: string;
    pending_auth: string;
    disposed_this_year: string;
  } | null;
  incidents: {
    total: string;
    ines_0: string;
    ines_1: string;
    ines_gte2: string;
    closed: string;
    open: string;
  } | null;
  equipment: { total: string; operational: string; maintenance: string } | null;
  instruments: { total: string; calibrated: string; expired_cal: string } | null;
  compliance: {
    total_requirements: string;
    compliant: string;
    pending: string;
    overdue: string;
    compliance_pct: string;
  } | null;
  transport: { shipments_this_year: string; carriers: string } | null;
  training: { sessions_this_year: string; pending_renewals: string } | null;
}

function SectionCard({
  title,
  icon,
  children,
  status,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  status?: "ok" | "warning" | "danger" | null;
}) {
  return (
    <div
      className={cn(
        "bg-card border rounded-xl overflow-hidden",
        status === "danger" ? "border-red-300 dark:border-red-700" :
        status === "warning" ? "border-amber-300 dark:border-amber-700" :
        "border-border"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 border-b",
          status === "danger" ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" :
          status === "warning" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" :
          "bg-muted/30 border-border"
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
        {status === "danger" && <XCircle className="h-4 w-4 text-red-500 ml-auto" />}
        {status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" />}
        {status === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number | null; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold text-sm", highlight && "text-red-600 dark:text-red-400")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function AnnualCCHENReportPage() {
  const [data, setData] = useState<AnnualReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/annual-cchen?year=${y}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const exceeded = parseInt(data?.dosimetry?.exceeded_annual_limit ?? "0");
  const openIncidents = parseInt(data?.incidents?.open ?? "0");
  const igesGte2 = parseInt(data?.incidents?.ines_gte2 ?? "0");
  const expiredCal = parseInt(data?.instruments?.expired_cal ?? "0");
  const overdueComp = parseInt(data?.compliance?.overdue ?? "0");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/reports" className="flex items-center gap-1 hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" />
              Reportes
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Informe Anual CCHEN</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reporte consolidado de Protección Radiológica — NS-06.0 §17 · DS 3/1985
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => load(year)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">Generando informe…</div>
      ) : !data ? (
        <div className="text-center py-20 text-muted-foreground">Error al cargar datos</div>
      ) : (
        <div className="space-y-5">
          {/* Report header info */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-6 w-6 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">
                  Informe Anual de Protección Radiológica — Año {data.year}
                </p>
                {data.institution && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {data.institution.name ?? "Institución"} · {data.institution.address ?? ""}
                    {data.institution.cchen_license_number &&
                      ` · Licencia CCHEN N° ${data.institution.cchen_license_number}`}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Generado: {new Date(data.generated_at).toLocaleString("es-CL")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* POE */}
            <SectionCard
              title="Personal Ocupacionalmente Expuesto (POE)"
              icon={<Users className="h-4 w-4" />}
              status={parseInt(data.poe?.expired_auth ?? "0") > 0 ? "warning" : "ok"}
            >
              {data.poe ? (
                <div className="space-y-0.5">
                  <Stat label="Total activos" value={data.poe.total_active} />
                  <Stat label="Con autorización CCHEN vigente" value={data.poe.authorized} />
                  <Stat
                    label="Autorizaciones vencidas"
                    value={data.poe.expired_auth}
                    highlight={parseInt(data.poe.expired_auth) > 0}
                  />
                  <Stat label="Desvinculados en el período" value={data.poe.total_inactive} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Dosimetría */}
            <SectionCard
              title="Dosimetría Personal"
              icon={<Activity className="h-4 w-4" />}
              status={exceeded > 0 ? "danger" : parseInt(data.dosimetry?.investigation_level ?? "0") > 0 ? "warning" : "ok"}
            >
              {data.dosimetry ? (
                <div className="space-y-0.5">
                  <Stat label="Trabajadores monitorizados" value={data.dosimetry.workers_monitored} />
                  <Stat label="Registros procesados" value={data.dosimetry.total_records} />
                  <Stat label="Heff promedio (mSv)" value={data.dosimetry.avg_heff_msv} />
                  <Stat label="Heff máxima registrada (mSv)" value={data.dosimetry.max_heff_msv} />
                  <Stat
                    label="Superaron límite 20 mSv/año"
                    value={data.dosimetry.exceeded_annual_limit}
                    highlight={exceeded > 0}
                  />
                  <Stat
                    label="En nivel investigación (≥15 mSv)"
                    value={data.dosimetry.investigation_level}
                    highlight={parseInt(data.dosimetry.investigation_level) > 0}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Fuentes */}
            <SectionCard
              title="Inventario de Material Radiactivo"
              icon={<Zap className="h-4 w-4" />}
            >
              {data.sources ? (
                <>
                  <div className="space-y-0.5 mb-3">
                    <Stat label="Total fuentes" value={data.sources.total} />
                    <Stat label="En uso" value={data.sources.in_use} />
                    <Stat label="Almacenadas" value={data.sources.stored} />
                    <Stat label="Radioisótopos distintos" value={data.sources.isotopes_count} />
                  </div>
                  {data.source_inventory.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Fuentes activas</p>
                      <div className="space-y-1">
                        {data.source_inventory.slice(0, 8).map((s, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="font-mono">{s.source_code}</span>
                            <span>{s.isotope}</span>
                            <span className="text-muted-foreground">{s.activity_gbq} GBq</span>
                          </div>
                        ))}
                        {data.source_inventory.length > 8 && (
                          <p className="text-xs text-muted-foreground">
                            + {data.source_inventory.length - 8} más…
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Residuos */}
            <SectionCard
              title="Residuos Radiactivos"
              icon={<Trash2 className="h-4 w-4" />}
              status={parseInt(data.waste?.pending_auth ?? "0") > 0 ? "warning" : "ok"}
            >
              {data.waste ? (
                <div className="space-y-0.5">
                  <Stat label="Total paquetes" value={data.waste.total_packages} />
                  <Stat label="Exentos de regulación" value={data.waste.exempt} />
                  <Stat label="BBNA (baja actividad)" value={data.waste.llw_bbna} />
                  <Stat label="MBNA (media actividad)" value={data.waste.ilw_mbna} />
                  <Stat label="Autorizados para disposición" value={data.waste.authorized} />
                  <Stat
                    label="Pendientes de autorización"
                    value={data.waste.pending_auth}
                    highlight={parseInt(data.waste.pending_auth) > 0}
                  />
                  <Stat label="Dispuestos en el período" value={data.waste.disposed_this_year} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Incidentes */}
            <SectionCard
              title="Incidentes Radiológicos (INES)"
              icon={<AlertTriangle className="h-4 w-4" />}
              status={igesGte2 > 0 ? "danger" : openIncidents > 0 ? "warning" : "ok"}
            >
              {data.incidents ? (
                <div className="space-y-0.5">
                  <Stat label="Total incidentes en el período" value={data.incidents.total} />
                  <Stat label="INES 0 (sin impacto en seguridad)" value={data.incidents.ines_0} />
                  <Stat label="INES 1 (anomalía)" value={data.incidents.ines_1} />
                  <Stat
                    label="INES ≥ 2 (incidente/accidente)"
                    value={data.incidents.ines_gte2}
                    highlight={igesGte2 > 0}
                  />
                  <Stat label="Cerrados" value={data.incidents.closed} />
                  <Stat
                    label="Abiertos (sin cerrar)"
                    value={data.incidents.open}
                    highlight={openIncidents > 0}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Equipos e Instrumentos */}
            <SectionCard
              title="Equipos e Instrumentos"
              icon={<Wrench className="h-4 w-4" />}
              status={expiredCal > 0 ? "warning" : "ok"}
            >
              <div className="space-y-0.5 mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Equipos</p>
                {data.equipment ? (
                  <>
                    <Stat label="Total equipos" value={data.equipment.total} />
                    <Stat label="Operativos" value={data.equipment.operational} />
                    <Stat label="En mantención" value={data.equipment.maintenance} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground mb-1">Instrumentos de medición</p>
                {data.instruments ? (
                  <>
                    <Stat label="Total instrumentos" value={data.instruments.total} />
                    <Stat label="Calibración vigente" value={data.instruments.calibrated} />
                    <Stat
                      label="Calibración vencida"
                      value={data.instruments.expired_cal}
                      highlight={expiredCal > 0}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                )}
              </div>
            </SectionCard>

            {/* Cumplimiento NS-06.0 */}
            <SectionCard
              title="Cumplimiento NS-06.0 CCHEN"
              icon={<ShieldAlert className="h-4 w-4" />}
              status={overdueComp > 0 ? "danger" : parseInt(data.compliance?.pending ?? "0") > 0 ? "warning" : "ok"}
            >
              {data.compliance ? (
                <>
                  <div className="space-y-0.5 mb-3">
                    <Stat label="Requisitos totales" value={data.compliance.total_requirements} />
                    <Stat label="Cumplidos" value={data.compliance.compliant} />
                    <Stat label="Pendientes" value={data.compliance.pending} />
                    <Stat
                      label="Vencidos (crítico)"
                      value={data.compliance.overdue}
                      highlight={overdueComp > 0}
                    />
                  </div>
                  {data.compliance.compliance_pct && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Índice de cumplimiento</span>
                        <span className="font-mono font-semibold">{data.compliance.compliance_pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            parseFloat(data.compliance.compliance_pct) >= 90 ? "bg-green-500" :
                            parseFloat(data.compliance.compliance_pct) >= 70 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: `${Math.min(parseFloat(data.compliance.compliance_pct), 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Transporte */}
            <SectionCard
              title="Transporte de Material Radiactivo"
              icon={<Truck className="h-4 w-4" />}
            >
              {data.transport ? (
                <div className="space-y-0.5">
                  <Stat label="Envíos en el período" value={data.transport.shipments_this_year} />
                  <Stat label="Transportistas distintos" value={data.transport.carriers} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Capacitación */}
            <SectionCard
              title="Capacitación en Protección Radiológica"
              icon={<GraduationCap className="h-4 w-4" />}
              status={parseInt(data.training?.pending_renewals ?? "0") > 0 ? "warning" : "ok"}
            >
              {data.training ? (
                <div className="space-y-0.5">
                  <Stat label="Sesiones realizadas en el período" value={data.training.sessions_this_year} />
                  <Stat
                    label="Capacitaciones próximas a vencer"
                    value={data.training.pending_renewals}
                    highlight={parseInt(data.training.pending_renewals) > 0}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </SectionCard>

            {/* Institución */}
            {data.institution && (
              <SectionCard
                title="Datos de la Institución"
                icon={<Building2 className="h-4 w-4" />}
              >
                <div className="space-y-0.5">
                  {Object.entries(data.institution)
                    .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
                    .map(([key, val]) => (
                      <Stat key={key} label={key.replace(/_/g, " ")} value={String(val ?? "—")} />
                    ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Firma / envío */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm space-y-2 print:block">
            <p className="font-semibold">Declaración del Encargado de Protección Radiológica</p>
            <p className="text-muted-foreground text-xs">
              Certifico que la información contenida en este informe es fidedigna y corresponde
              al período {data.year}, siendo responsable de su contenido conforme a lo establecido
              en la NS-06.0 de la CCHEN y el DS 3/1985 del MINSAL.
            </p>
            <div className="grid grid-cols-3 gap-6 mt-4 pt-4 border-t border-border">
              {["Nombre y firma EPR", "RUT", "Fecha de envío a CCHEN"].map((f) => (
                <div key={f} className="border-b border-foreground pb-6">
                  <p className="text-xs text-muted-foreground mt-2">{f}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Regulatory note */}
          <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
            <p>
              <strong>Base normativa:</strong> NS-06.0 §17 CCHEN — Informe anual de operación ·
              DS 3/1985 (MINSAL) · DS 133/1984 · IAEA Safety GSG-1
            </p>
            <p>El informe debe enviarse al CCHEN antes del 31 de marzo del año siguiente al período reportado.</p>
          </div>
        </div>
      )}
    </div>
  );
}
