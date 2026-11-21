"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, AlertCircle, AlertTriangle, Award, Bell, CheckCircle2,
  Flame, GraduationCap, HeartPulse, Loader2, RefreshCw, Shield,
  ShieldAlert, Trash2, Users, Wrench, Zap, Info, Clock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryData {
  generated_at: string;
  health: { status: "ok" | "warning" | "danger"; danger_signals: number; warning_signals: number };
  workers:     { active: string; suspended: string; inactive: string; expired_auth: string; expiring_soon: string } | null;
  dosimetry:   { workers_this_month: string; collective_dose: string; avg_dose: string; max_dose: string; above_annual_limit: string } | null;
  instruments: { total: string; calibrated: string; expired: string; expiring_soon: string } | null;
  incidents:   { last_30_days: string; high_severity: string; open: string; high_severity_30d: string } | null;
  compliance:  { total: string; compliant: string; overdue: string; pending: string; critical_pending: string; pct: string } | null;
  training:    { pending_renewals: string; completed_this_year: string; workers_with_pending: string } | null;
  sources:     { total: string; in_use: string; stored: string; decommissioned: string; isotopes: string } | null;
  waste:       { total: string; pending_auth: string; in_storage: string; regulated: string } | null;
  notifications: { unread: string; danger: string; warning: string } | null;
  i131:        { last_24h: string; last_30_days: string; hospitalized_now: string } | null;
  emergency:   { active_plans: string; overdue_drills: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function n(v: string | undefined | null, fallback = "—"): string | number {
  if (v == null) return fallback;
  const num = parseInt(String(v));
  return isNaN(num) ? fallback : num;
}

function f(v: string | undefined | null, decimals = 1): string {
  if (v == null) return "—";
  const num = parseFloat(String(v));
  return isNaN(num) ? "—" : num.toFixed(decimals);
}

// ─── Components ──────────────────────────────────────────────────────────────

function ModuleCard({
  title, href, icon: Icon, iconColor = "text-blue-600",
  status = "ok", children,
}: {
  title: string; href: string;
  icon: React.ComponentType<{ className?: string }>; iconColor?: string;
  status?: "ok" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block group">
      <div className={cn(
        "rounded-xl border p-4 h-full transition-all hover:shadow-md",
        status === "danger"  ? "border-red-300 bg-red-50/50"    :
        status === "warning" ? "border-amber-300 bg-amber-50/50" :
        status === "ok"      ? "border-green-300 bg-green-50/30" :
        "border-border bg-card"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
              status === "danger"  ? "bg-red-100" :
              status === "warning" ? "bg-amber-100" :
              status === "ok"      ? "bg-green-100" : "bg-blue-100"
            )}>
              <Icon className={cn("w-4 h-4",
                status === "danger"  ? "text-red-600"   :
                status === "warning" ? "text-amber-600"  :
                status === "ok"      ? "text-green-600"  : iconColor
              )} />
            </div>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          {status === "danger"  && <AlertCircle  className="w-4 h-4 text-red-500" />}
          {status === "warning" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
          {status === "ok"      && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
        <div className="space-y-1">{children}</div>
      </div>
    </Link>
  );
}

function KV({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className={cn("text-xs font-mono font-semibold ml-2 shrink-0", alert ? "text-red-700" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function HealthBadge({ status }: { status: "ok" | "warning" | "danger" }) {
  const cfg = {
    ok:      { label: "OPERATIVO",   cls: "bg-green-100 text-green-800 border-green-300" },
    warning: { label: "ATENCIÓN",    cls: "bg-amber-100 text-amber-800 border-amber-300" },
    danger:  { label: "ALERTA",      cls: "bg-red-100 text-red-800 border-red-300" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border", cfg.cls)}>
      <span className={cn("w-2 h-2 rounded-full",
        status === "ok" ? "bg-green-500 animate-pulse" :
        status === "warning" ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-pulse"
      )} />
      {cfg.label}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/summary");
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const timer = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Cargando resumen ejecutivo…
      </div>
    );
  }

  const d = data!;
  const health = d.health ?? { status: "neutral" as const, danger_signals: 0, warning_signals: 0 };
  const compliancePct = parseFloat(d.compliance?.pct ?? "0");

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Resumen Ejecutivo
            {data && <HealthBadge status={health.status as "ok" | "warning" | "danger"} />}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vista operacional en tiempo real · Sistema RPMS
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lastFetch && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {lastFetch.toLocaleTimeString("es-CL")}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 border rounded-lg hover:bg-muted"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Health summary bar */}
      <div className={cn(
        "rounded-xl border p-4 flex flex-wrap items-center gap-4 text-sm",
        health.status === "danger"  ? "bg-red-50 border-red-300"   :
        health.status === "warning" ? "bg-amber-50 border-amber-300" :
        "bg-green-50 border-green-300"
      )}>
        <div className="flex items-center gap-2">
          {health.status === "danger"  && <AlertCircle  className="w-5 h-5 text-red-600" />}
          {health.status === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600" />}
          {health.status === "ok"      && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          <span className="font-semibold">
            {health.status === "danger"  ? `${health.danger_signals} señal(es) crítica(s) detectada(s)` :
             health.status === "warning" ? `${health.warning_signals} condicion(es) de atención` :
             "Todos los indicadores en rango normal"}
          </span>
        </div>
        <div className="flex gap-3 ml-auto text-xs flex-wrap">
          <Link href="/alerts"        className="text-blue-600 hover:underline">Ver alertas →</Link>
          <Link href="/expiries"      className="text-blue-600 hover:underline">Vencimientos →</Link>
          <Link href="/notifications" className="text-blue-600 hover:underline">
            Notificaciones
            {parseInt(d.notifications?.unread ?? "0") > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full px-1 font-bold">
                {d.notifications?.unread}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {/* Trabajadores */}
        <ModuleCard
          title="Trabajadores POE"
          href="/workers"
          icon={Users}
          status={parseInt(d.workers?.expired_auth ?? "0") > 0 ? "danger" :
                 parseInt(d.workers?.expiring_soon ?? "0") > 0 ? "warning" : "ok"}
        >
          <KV label="Activos" value={n(d.workers?.active)} />
          <KV label="Suspendidos" value={n(d.workers?.suspended)} />
          <KV label="Auth. vencida" value={n(d.workers?.expired_auth)} alert={parseInt(d.workers?.expired_auth ?? "0") > 0} />
          <KV label="Por vencer (30d)" value={n(d.workers?.expiring_soon)} alert={parseInt(d.workers?.expiring_soon ?? "0") > 0} />
        </ModuleCard>

        {/* Dosimetría */}
        <ModuleCard
          title="Dosimetría (mes)"
          href="/dosimetry"
          icon={Activity}
          status={parseInt(d.dosimetry?.above_annual_limit ?? "0") > 0 ? "danger" : "neutral"}
        >
          <KV label="Monitorizados" value={n(d.dosimetry?.workers_this_month)} />
          <KV label="Dosis media (mSv)" value={f(d.dosimetry?.avg_dose, 2)} />
          <KV label="Dosis máxima (mSv)" value={f(d.dosimetry?.max_dose, 2)} />
          <KV label="> límite anual" value={n(d.dosimetry?.above_annual_limit)} alert={parseInt(d.dosimetry?.above_annual_limit ?? "0") > 0} />
        </ModuleCard>

        {/* Instrumentos */}
        <ModuleCard
          title="Instrumentos"
          href="/instruments/calibrations"
          icon={Wrench}
          status={parseInt(d.instruments?.expired ?? "0") > 0 ? "danger" :
                 parseInt(d.instruments?.expiring_soon ?? "0") > 0 ? "warning" : "ok"}
        >
          <KV label="Total" value={n(d.instruments?.total)} />
          <KV label="Calibración vigente" value={n(d.instruments?.calibrated)} />
          <KV label="Calibración vencida" value={n(d.instruments?.expired)} alert={parseInt(d.instruments?.expired ?? "0") > 0} />
          <KV label="Por vencer (30d)" value={n(d.instruments?.expiring_soon)} alert={parseInt(d.instruments?.expiring_soon ?? "0") > 0} />
        </ModuleCard>

        {/* Incidentes */}
        <ModuleCard
          title="Incidentes"
          href="/incidents"
          icon={AlertTriangle}
          iconColor="text-orange-600"
          status={parseInt(d.incidents?.high_severity_30d ?? "0") > 0 ? "danger" :
                 parseInt(d.incidents?.open ?? "0") > 0 ? "warning" : "ok"}
        >
          <KV label="Últimos 30 días" value={n(d.incidents?.last_30_days)} />
          <KV label="Abiertos" value={n(d.incidents?.open)} alert={parseInt(d.incidents?.open ?? "0") > 0} />
          <KV label="INES ≥2 (total)" value={n(d.incidents?.high_severity)} alert={parseInt(d.incidents?.high_severity ?? "0") > 0} />
          <KV label="INES ≥2 (30d)" value={n(d.incidents?.high_severity_30d)} alert={parseInt(d.incidents?.high_severity_30d ?? "0") > 0} />
        </ModuleCard>

        {/* Cumplimiento */}
        <ModuleCard
          title="Cumplimiento NS-06.0"
          href="/compliance"
          icon={ShieldAlert}
          status={parseInt(d.compliance?.overdue ?? "0") > 0 ? "danger" :
                 parseInt(d.compliance?.critical_pending ?? "0") > 0 ? "warning" :
                 compliancePct >= 90 ? "ok" : "warning"}
        >
          <KV label="Requisitos" value={n(d.compliance?.total)} />
          <KV label="Cumplidos" value={n(d.compliance?.compliant)} />
          <KV label="Vencidos" value={n(d.compliance?.overdue)} alert={parseInt(d.compliance?.overdue ?? "0") > 0} />
          <KV label="% cumplimiento" value={d.compliance?.pct ? `${d.compliance.pct}%` : "—"} />
        </ModuleCard>

        {/* Capacitación */}
        <ModuleCard
          title="Capacitación"
          href="/training"
          icon={GraduationCap}
          iconColor="text-green-600"
          status={parseInt(d.training?.pending_renewals ?? "0") > 2 ? "warning" : "neutral"}
        >
          <KV label="Por renovar" value={n(d.training?.pending_renewals)} alert={parseInt(d.training?.pending_renewals ?? "0") > 0} />
          <KV label="TOE afectados" value={n(d.training?.workers_with_pending)} />
          <KV label="Completadas (año)" value={n(d.training?.completed_this_year)} />
        </ModuleCard>

        {/* Fuentes */}
        <ModuleCard
          title="Fuentes Radiactivas"
          href="/sources"
          icon={Zap}
          iconColor="text-purple-600"
          status="neutral"
        >
          <KV label="Total fuentes" value={n(d.sources?.total)} />
          <KV label="En uso" value={n(d.sources?.in_use)} />
          <KV label="Almacenadas" value={n(d.sources?.stored)} />
          <KV label="Radioisótopos" value={n(d.sources?.isotopes)} />
        </ModuleCard>

        {/* Residuos */}
        <ModuleCard
          title="Residuos Radiactivos"
          href="/waste-management"
          icon={Trash2}
          iconColor="text-orange-600"
          status={parseInt(d.waste?.pending_auth ?? "0") > 0 ? "warning" : "neutral"}
        >
          <KV label="Total paquetes" value={n(d.waste?.total)} />
          <KV label="En almacenamiento" value={n(d.waste?.in_storage)} />
          <KV label="Pendiente auth." value={n(d.waste?.pending_auth)} alert={parseInt(d.waste?.pending_auth ?? "0") > 0} />
          <KV label="Regulados" value={n(d.waste?.regulated)} />
        </ModuleCard>

        {/* I-131 */}
        <ModuleCard
          title="Administración I-131"
          href="/i131"
          icon={HeartPulse}
          iconColor="text-pink-600"
          status={parseInt(d.i131?.hospitalized_now ?? "0") > 0 ? "warning" : "neutral"}
        >
          <KV label="Últimas 24h" value={n(d.i131?.last_24h)} />
          <KV label="Últimos 30 días" value={n(d.i131?.last_30_days)} />
          <KV label="Hospitalizados ahora" value={n(d.i131?.hospitalized_now)} alert={parseInt(d.i131?.hospitalized_now ?? "0") > 0} />
        </ModuleCard>

        {/* Emergencias */}
        <ModuleCard
          title="Planes de Emergencia"
          href="/emergency"
          icon={Flame}
          iconColor="text-red-600"
          status={parseInt(d.emergency?.overdue_drills ?? "0") > 0 ? "warning" : "ok"}
        >
          <KV label="Planes activos" value={n(d.emergency?.active_plans)} />
          <KV label="Simulacros atrasados" value={n(d.emergency?.overdue_drills)} alert={parseInt(d.emergency?.overdue_drills ?? "0") > 0} />
        </ModuleCard>

        {/* Notificaciones */}
        <ModuleCard
          title="Notificaciones"
          href="/notifications"
          icon={Bell}
          iconColor="text-blue-600"
          status={parseInt(d.notifications?.danger ?? "0") > 0 ? "danger" :
                 parseInt(d.notifications?.warning ?? "0") > 0 ? "warning" : "ok"}
        >
          <KV label="Sin leer" value={n(d.notifications?.unread)} alert={parseInt(d.notifications?.unread ?? "0") > 0} />
          <KV label="Peligro" value={n(d.notifications?.danger)} alert={parseInt(d.notifications?.danger ?? "0") > 0} />
          <KV label="Advertencia" value={n(d.notifications?.warning)} alert={parseInt(d.notifications?.warning ?? "0") > 0} />
        </ModuleCard>

        {/* Informe de Gestión */}
        <ModuleCard
          title="Informe de Gestión"
          href="/management-report"
          icon={Award}
          iconColor="text-indigo-600"
          status="neutral"
        >
          <div className="text-xs text-muted-foreground leading-relaxed">
            Resumen ejecutivo consolidado por año para la jefatura y CCHEN.
          </div>
          <div className="mt-2">
            <span className="text-xs text-blue-600 font-medium">Ver informe completo →</span>
          </div>
        </ModuleCard>

      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <span>Actualización automática cada 5 minutos · DS 3/1985 · NS-06.0 CCHEN</span>
        <div className="flex gap-3">
          <Link href="/alerts"           className="hover:text-foreground">Alertas</Link>
          <Link href="/expiries"         className="hover:text-foreground">Vencimientos</Link>
          <Link href="/management-report" className="hover:text-foreground">Informe Gestión</Link>
          <Link href="/reports/annual-cchen" className="hover:text-foreground">Informe CCHEN</Link>
        </div>
      </div>
    </div>
  );
}
