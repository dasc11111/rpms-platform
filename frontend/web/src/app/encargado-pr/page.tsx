"use client";

export const dynamic = "force-dynamic";

// §155 — Portal del Encargado de Protección Radiológica
// Dashboard ejecutivo consolidado para el Encargado PR
// DS 3/1985 Arts. 24-30 · CCHEN NS-05.0 · Requisitos de gestión operacional

import { useState, useEffect, useCallback } from "react";
import {
  Shield, AlertTriangle, CheckCircle2, Clock, Users,
  Activity, FileText, Radiation, RefreshCw, TrendingUp,
  TrendingDown, AlertCircle, Bell, Calendar, ExternalLink,
  BarChart3, Zap, Baby, Trash2, Settings,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  poe: {
    total: number;
    monitored: number;
    above_75pct: number;
    above_limit: number;
    pregnant: number;
  };
  equipment: {
    total: number;
    due_calibration: number;
    overdue_calibration: number;
    due_maintenance: number;
  };
  zones: {
    total_entries_today: number;
    active_now: number;
    without_dosimeter: number;
  };
  special_surveillance: {
    active: number;
    alarm_amber: number;
    alarm_red: number;
    pending_cchen: number;
  };
  f01: {
    year: number;
    status: string;
    days_to_deadline: number;
  } | null;
  incidents: {
    open: number;
    this_month: number;
  };
}

interface Alert {
  level: "critical" | "warning" | "info";
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  label, value, unit, icon: Icon, href, color, alert,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  icon: React.ElementType;
  href: string;
  color: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className={cn(
      "rounded-xl border p-4 flex flex-col gap-2 hover:shadow-md transition-shadow",
      alert ? "border-red-300 bg-red-50" : "bg-card"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-3xl font-bold", alert ? "text-red-700" : "")}>{value ?? "—"}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </Link>
  );
}

// ─── Alert Item ───────────────────────────────────────────────────────────────

function AlertItem({ alert }: { alert: Alert }) {
  const Icon = alert.icon;
  return (
    <Link href={alert.href} className={cn(
      "flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors",
      alert.level === "critical" ? "bg-red-50 border-red-200" :
      alert.level === "warning"  ? "bg-amber-50 border-amber-200" :
      "bg-blue-50 border-blue-200"
    )}>
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
        alert.level === "critical" ? "bg-red-100 text-red-700" :
        alert.level === "warning"  ? "bg-amber-100 text-amber-700" :
        "bg-blue-100 text-blue-700"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-sm",
          alert.level === "critical" ? "text-red-800" :
          alert.level === "warning"  ? "text-amber-800" : "text-blue-800"
        )}>{alert.title}</p>
        <p className={cn("text-xs mt-0.5",
          alert.level === "critical" ? "text-red-700" :
          alert.level === "warning"  ? "text-amber-700" : "text-blue-700"
        )}>{alert.description}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground mt-1 flex-shrink-0" />
    </Link>
  );
}

// ─── Quick Link ───────────────────────────────────────────────────────────────

function QuickLink({ href, label, icon: Icon, desc }: { href: string; label: string; icon: React.ElementType; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EncargadoPRPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Compose dashboard from multiple APIs
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poeR, equipR, zoneR, survR, f01R, incR] = await Promise.allSettled([
        fetch("/api/dosimetry?summary=1").then(r => r.json()),
        fetch("/api/calibrations-overview").then(r => r.json()),
        fetch("/api/zone-access?summary=1").then(r => r.json()),
        fetch("/api/special-surveillance").then(r => r.json()),
        fetch("/api/f01-cchen").then(r => r.json()),
        fetch("/api/incidents?summary=1").then(r => r.json()),
      ]);

      const poeData   = poeR.status === "fulfilled"  ? poeR.value  : {};
      const equipData = equipR.status === "fulfilled" ? equipR.value : {};
      const zoneData  = zoneR.status === "fulfilled"  ? zoneR.value  : {};
      const survData  = survR.status === "fulfilled"  ? survR.value  : {};
      const f01Data   = f01R.status === "fulfilled"   ? f01R.value   : {};
      const incData   = incR.status === "fulfilled"   ? incR.value   : {};

      const survRecords: Array<{ alarm_level: string }> = survData.records ?? [];
      const survStats   = survData.stats ?? {};
      const survAlarms  = survData.alarms ?? [];

      setData({
        poe: {
          total:       poeData.total_workers ?? poeData.stats?.total ?? 0,
          monitored:   poeData.monitored ?? poeData.stats?.with_dosimeter ?? 0,
          above_75pct: poeData.above_75pct ?? 0,
          above_limit: poeData.above_limit ?? poeData.stats?.over_limit ?? 0,
          pregnant:    Number(survStats.pregnant ?? 0),
        },
        equipment: {
          total:               equipData.total ?? 0,
          due_calibration:     equipData.due_soon ?? 0,
          overdue_calibration: equipData.overdue ?? 0,
          due_maintenance:     equipData.due_maintenance ?? 0,
        },
        zones: {
          total_entries_today: zoneData.summary?.today_entries ?? zoneData.today ?? 0,
          active_now:          zoneData.summary?.active_now ?? zoneData.active_now ?? 0,
          without_dosimeter:   zoneData.summary?.without_dosimeter ?? 0,
        },
        special_surveillance: {
          active:        Number(survStats.active ?? 0),
          alarm_amber:   survAlarms.filter((a: { alarm_level: string }) => a.alarm_level === "amber").length,
          alarm_red:     survAlarms.filter((a: { alarm_level: string }) => a.alarm_level === "red").length,
          pending_cchen: Number(survStats.pending_cchen ?? 0),
        },
        f01: f01Data.deadline ? {
          year:             f01Data.deadline.year,
          status:           f01Data.deadline.status,
          days_to_deadline: f01Data.deadline.days_remaining,
        } : null,
        incidents: {
          open:       incData.open ?? 0,
          this_month: incData.this_month ?? 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build alerts list
  const alerts: Alert[] = [];
  if (data) {
    if (data.poe.above_limit > 0) alerts.push({
      level: "critical", icon: AlertCircle,
      title: `${data.poe.above_limit} POE sobre límite anual (20 mSv)`,
      description: "Revisar inmediatamente. Reasignar tareas y notificar a CCHEN.",
      href: "/dosimetry",
    });
    if (data.special_surveillance.alarm_red > 0) alerts.push({
      level: "critical", icon: Baby,
      title: `${data.special_surveillance.alarm_red} vigilancia especial en zona crítica (>90%)`,
      description: "Embarazada/menor/estudiante superando el 90% del límite de dosis especial.",
      href: "/special-surveillance",
    });
    if (data.equipment.overdue_calibration > 0) alerts.push({
      level: "critical", icon: Zap,
      title: `${data.equipment.overdue_calibration} equipo(s) con calibración vencida`,
      description: "Equipos sin calibración vigente no pueden operar (DS 3/1985 Art. 54).",
      href: "/instruments-maintenance",
    });
    if (data.f01 && data.f01.status === "overdue") alerts.push({
      level: "critical", icon: FileText,
      title: `Informe F-01 CCHEN vencido — Año ${data.f01.year}`,
      description: "El informe anual no fue presentado a CCHEN. Riesgo de sanción.",
      href: "/f01-cchen",
    });
    if (data.poe.above_75pct > 0) alerts.push({
      level: "warning", icon: Activity,
      title: `${data.poe.above_75pct} POE sobre el 75% del límite anual`,
      description: "Monitoreo reforzado requerido (CCHEN NS-05.0 §8.3).",
      href: "/dosimetry",
    });
    if (data.special_surveillance.alarm_amber > 0) alerts.push({
      level: "warning", icon: Baby,
      title: `${data.special_surveillance.alarm_amber} vigilancia especial en zona ámbar (>75%)`,
      description: "Revisar condiciones de trabajo y restricciones.",
      href: "/special-surveillance",
    });
    if (data.equipment.due_calibration > 0) alerts.push({
      level: "warning", icon: Zap,
      title: `${data.equipment.due_calibration} equipo(s) con calibración próxima a vencer`,
      description: "Coordinar calibración antes del vencimiento.",
      href: "/instruments-maintenance",
    });
    if (data.f01 && data.f01.status === "urgent") alerts.push({
      level: "warning", icon: Clock,
      title: `Informe F-01 vence en ${data.f01.days_to_deadline} días (31 de marzo)`,
      description: "Complete y envíe el informe anual a CCHEN.",
      href: "/f01-cchen",
    });
    if (data.special_surveillance.pending_cchen > 0) alerts.push({
      level: "info", icon: Bell,
      title: `${data.special_surveillance.pending_cchen} casos sin notificar a CCHEN`,
      description: "Embarazadas y menores deben ser notificados a CCHEN al ser declarados.",
      href: "/special-surveillance",
    });
    if (data.zones.without_dosimeter > 0) alerts.push({
      level: "info", icon: Radiation,
      title: `${data.zones.without_dosimeter} ingresos a zona sin dosímetro registrado`,
      description: "DS 3/1985 Art. 32: Todo ingreso a zona controlada debe registrar dosímetro.",
      href: "/zone-access",
    });
  }

  const today = new Date();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Portal del Encargado PR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §155 — Dashboard ejecutivo · DS 3/1985 Arts. 24-30 · CCHEN NS-05.0
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{fmtDate(today)}</p>
        </div>
        <button onClick={load} className={cn("p-2 rounded-lg border hover:bg-muted text-muted-foreground", loading ? "animate-spin" : "")}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alerts panel */}
      {!loading && alerts.length > 0 && (
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-card px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Alertas y acciones requeridas
            </h2>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border",
              alerts.some(a => a.level === "critical") ? "bg-red-100 text-red-700 border-red-300" : "bg-amber-100 text-amber-700 border-amber-300"
            )}>
              {alerts.filter(a => a.level === "critical").length} críticas · {alerts.filter(a => a.level === "warning").length} advertencias
            </span>
          </div>
          <div className="p-3 space-y-2 bg-card">
            {alerts.map((alert, i) => <AlertItem key={i} alert={alert} />)}
          </div>
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="rounded-xl border bg-green-50 border-green-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Sin alertas activas</p>
            <p className="text-xs text-green-700 mt-0.5">Todos los indicadores se encuentran dentro de los parámetros aceptables.</p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> INDICADORES PRINCIPALES
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-muted/20 h-24 animate-pulse" />
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile label="POE Total" value={data.poe.total} icon={Users}
              href="/dosimetry" color="bg-blue-100 text-blue-700" />
            <KpiTile label="POE Sobre 75% límite" value={data.poe.above_75pct} icon={Activity}
              href="/dosimetry" color="bg-amber-100 text-amber-700"
              alert={data.poe.above_75pct > 0} />
            <KpiTile label="POE Sobre límite" value={data.poe.above_limit} icon={AlertCircle}
              href="/dosimetry" color="bg-red-100 text-red-700"
              alert={data.poe.above_limit > 0} />
            <KpiTile label="Vigilancia especial" value={data.special_surveillance.active} icon={Baby}
              href="/special-surveillance" color="bg-pink-100 text-pink-700" />
            <KpiTile label="Equipos c/calib. vencida" value={data.equipment.overdue_calibration} icon={Zap}
              href="/instruments-maintenance" color="bg-red-100 text-red-700"
              alert={data.equipment.overdue_calibration > 0} />
            <KpiTile label="Equipos c/calib. próxima" value={data.equipment.due_calibration} icon={Clock}
              href="/instruments-maintenance" color="bg-amber-100 text-amber-700" />
            <KpiTile label="Ingresos zona hoy" value={data.zones.total_entries_today} icon={Radiation}
              href="/zone-access" color="bg-teal-100 text-teal-700" />
            <KpiTile label="Incidentes abiertos" value={data.incidents.open} icon={AlertTriangle}
              href="/incidents" color="bg-orange-100 text-orange-700"
              alert={data.incidents.open > 0} />
          </div>
        )}
      </div>

      {/* F-01 Deadline */}
      {data?.f01 && (
        <div className={cn(
          "rounded-xl border p-4 flex items-center gap-4",
          data.f01.status === "overdue" ? "bg-red-50 border-red-300" :
          data.f01.status === "urgent"  ? "bg-amber-50 border-amber-300" : "bg-muted/30"
        )}>
          <FileText className={cn("w-6 h-6 flex-shrink-0",
            data.f01.status === "overdue" ? "text-red-600" :
            data.f01.status === "urgent"  ? "text-amber-600" : "text-primary"
          )} />
          <div className="flex-1">
            <p className="font-semibold text-sm">Informe Anual F-01 CCHEN — Año {data.f01.year}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.f01.status === "overdue"
                ? "Plazo vencido — Informe no presentado. Riesgo de sanción."
                : data.f01.status === "urgent"
                ? `${data.f01.days_to_deadline} días para el plazo (31 marzo ${data.f01.year})`
                : `${data.f01.days_to_deadline} días para el plazo (31 marzo ${data.f01.year})`}
            </p>
          </div>
          <Link href="/f01-cchen" className="text-xs font-medium text-primary hover:underline flex items-center gap-1 flex-shrink-0">
            Ver informe <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Quick access links */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" /> ACCESO RÁPIDO
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <QuickLink href="/dosimetry" icon={Activity} label="Dosimetría POE" desc="Lecturas y límites anuales" />
          <QuickLink href="/special-surveillance" icon={Baby} label="Vigilancia Especial" desc="Embarazadas, menores, estudiantes" />
          <QuickLink href="/zone-access" icon={Radiation} label="Control de Acceso" desc="Registro de ingresos y egresos" />
          <QuickLink href="/instruments-maintenance" icon={Zap} label="Calibraciones" desc="Equipos y fechas de calibración" />
          <QuickLink href="/f01-cchen" icon={FileText} label="Formulario F-01" desc="Informe anual CCHEN" />
          <QuickLink href="/regulatory-reports" icon={Shield} label="Reportes CCHEN" desc="Informes regulatorios" />
          <QuickLink href="/incidents" icon={AlertTriangle} label="Incidentes" desc="Registro y seguimiento" />
          <QuickLink href="/radiation-program" icon={CheckCircle2} label="Programa PR" desc="Estado del PPR" />
          <QuickLink href="/management-report" icon={BarChart3} label="Informe Gerencial" desc="Resumen ejecutivo KPIs" />
        </div>
      </div>

      {/* Regulatory responsibility reminder */}
      <div className="rounded-xl border bg-blue-50/50 p-5 text-xs text-blue-900 space-y-2">
        <p className="font-semibold flex items-center gap-1.5 text-sm">
          <Shield className="w-4 h-4" /> Responsabilidades del Encargado de Protección Radiológica
        </p>
        <p><strong>DS 3/1985 Arts. 24-30:</strong> El Encargado PR es responsable de supervisar que las prácticas con radiaciones ionizantes se realicen conforme a las normas. Debe asegurarse de que el personal cuente con la instrucción adecuada.</p>
        <p><strong>DS 3/1985 Art. 25:</strong> Responsabilidades específicas incluyen: control dosimétrico del personal, investigación de accidentes radiológicos, calibración de instrumentos, y presentación del informe anual a CCHEN.</p>
        <p><strong>DS 3/1985 Art. 50:</strong> El incumplimiento de las obligaciones del Encargado PR puede acarrear responsabilidad personal y de la institución ante la CCHEN y el Servicio de Salud correspondiente.</p>
      </div>
    </div>
  );
}
