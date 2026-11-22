"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, Atom, Award, Bell, Biohazard, ChevronRight,
  Flame, GraduationCap, Radio, RefreshCw, ShieldCheck, Tag, Trash2,
  TrendingDown, Users, Wrench, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Alert {
  level: "critical" | "warning" | "info";
  module: string;
  message: string;
  count: number;
  href: string;
}
interface DosePoint { month: string; avg_dose: number; max_dose: number; records: number }
interface IncidentPoint { month: string; count: number; ines_1_plus: number }
interface DashData {
  generated_at: string;
  year: number;
  program_score: number;
  program_status: "good" | "attention" | "warning" | "critical";
  critical_alerts: Alert[];
  modules: {
    dosimetry: { total_records:number; this_month:number; over_limit:number; approaching_limit:number; avg_dose_msv:number; max_dose_msv:number; collective_dose_msv:number };
    workers:   { total:number; oer:number; oer_b:number; with_dosimetry:number; medical_expired:number; medical_expiring:number };
    sources:   { total:number; in_use:number; stored:number; auth_expired:number; auth_expiring:number; leak_test_overdue:number; leak_test_failed:number };
    incidents: { total_year:number; open:number; ines_1_plus:number; cchen_pending:number; this_month:number };
    reports:   { in_progress:number; submitted:number; approved:number; overdue:number };
    training:  { total_year:number; completed:number; planned:number; total_participants:number; overdue:number };
    equipment: { total:number; calibration_overdue:number; calibration_soon:number; out_of_service:number };
    waste:     { total:number; stored:number; transferred:number; total_activity_gbq:number };
  };
  trends: { dose_history: DosePoint[]; incident_history: IncidentPoint[] };
}

// ── helpers ────────────────────────────────────────────────────────────────
const SCORE_CFG = {
  good:      { label: "Óptimo",    color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", ring: "stroke-emerald-500" },
  attention: { label: "Atención",  color: "text-amber-600",   bg: "bg-amber-50   border-amber-200",   ring: "stroke-amber-500"   },
  warning:   { label: "Alerta",    color: "text-orange-600",  bg: "bg-orange-50  border-orange-200",  ring: "stroke-orange-500"  },
  critical:  { label: "Crítico",   color: "text-red-600",     bg: "bg-red-50     border-red-200",     ring: "stroke-red-500"     },
};
const ALERT_CFG = {
  critical: { icon: XCircle,       bg: "bg-red-50    border-red-200",    text: "text-red-700",    badge: "bg-red-100    text-red-800"    },
  warning:  { icon: AlertCircle,   bg: "bg-amber-50  border-amber-200",  text: "text-amber-700",  badge: "bg-amber-100  text-amber-800"  },
  info:     { icon: Bell,          bg: "bg-blue-50   border-blue-200",   text: "text-blue-700",   badge: "bg-blue-100   text-blue-800"   },
};

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// ── MiniBar chart ──────────────────────────────────────────────────────────
function MiniBar({ data, keys, colors }: { data: Array<Record<string,number|string>>; keys: string[]; colors: string[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-4">Sin datos</p>;
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => Number(d[k] ?? 0))), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="flex items-end gap-0.5 w-full" style={{ height: 48 }}>
            {keys.map((k, ki) => {
              const h = Math.max(2, Math.round((Number(d[k] ?? 0) / maxVal) * 48));
              return <div key={k} className={`flex-1 rounded-sm ${colors[ki]}`} style={{ height: h }} title={`${k}: ${d[k]}`} />;
            })}
          </div>
          <span className="text-[9px] text-muted-foreground">{fmtMonth(String(d.month))}</span>
        </div>
      ))}
    </div>
  );
}

// ── ScoreDial ──────────────────────────────────────────────────────────────
function ScoreDial({ score, status }: { score: number; status: keyof typeof SCORE_CFG }) {
  const cfg = SCORE_CFG[status];
  const r = 36; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={96} height={96} className="-rotate-90">
        <circle cx={48} cy={48} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-muted/30" />
        <circle cx={48} cy={48} r={r} fill="none" strokeWidth={8} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className={cfg.ring} />
      </svg>
      <div className="-mt-16 flex flex-col items-center">
        <span className={`text-2xl font-bold ${cfg.color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
      <span className={`mt-8 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── ModuleCard ─────────────────────────────────────────────────────────────
function ModuleCard({ icon: Icon, label, kpis, href, hasIssue }: {
  icon: React.ComponentType<{className?:string}>;
  label: string;
  kpis: Array<{ label: string; value: string | number; alert?: boolean }>;
  href: string;
  hasIssue?: boolean;
}) {
  return (
    <Link href={href} className={`block rounded-lg border p-4 hover:shadow-md transition-shadow ${hasIssue ? "border-red-300 bg-red-50/40" : "border-border bg-surface"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${hasIssue ? "text-red-500" : "text-accent"}`} />
        <span className="text-sm font-semibold">{label}</span>
        {hasIssue && <span className="ml-auto h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {kpis.map(k => (
          <div key={k.label}>
            <p className={`text-lg font-bold leading-none ${k.alert ? "text-red-600" : ""}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-accent">
        <span>Ver módulo</span><ChevronRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="p-8 text-muted-foreground">Error cargando datos.</p>;

  const { modules: m, critical_alerts, trends, program_score, program_status, year } = data;
  const criticalCount = critical_alerts.filter(a => a.level === "critical").length;
  const warningCount  = critical_alerts.filter(a => a.level === "warning").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard Ejecutivo PR</h1>
          <p className="text-sm text-muted-foreground">
            Año {year} · Actualizado {fmtTs(data.generated_at)}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Score + resumen alertas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {/* Dial */}
        <div className="sm:col-span-1 flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score Programa PR</p>
          <ScoreDial score={program_score} status={program_status} />
        </div>

        {/* KPIs rápidos */}
        <div className="sm:col-span-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Alertas críticas",   value: criticalCount, sub: "requieren acción inmediata", alert: criticalCount > 0 },
            { label: "Advertencias",        value: warningCount,  sub: "revisar en breve",           alert: warningCount > 0  },
            { label: "Trabajadores OER",    value: m.workers.oer, sub: `de ${m.workers.total} activos`                        },
            { label: "Incidentes año",      value: m.incidents.total_year, sub: `${m.incidents.open} abiertos`                },
            { label: "Dosis prom. trim.",   value: `${m.dosimetry.avg_dose_msv} mSv`, sub: `máx ${m.dosimetry.max_dose_msv} mSv` },
            { label: "Fuentes activas",     value: m.sources.total, sub: `${m.sources.in_use} en uso`                        },
            { label: "Capacitaciones año",  value: m.training.completed, sub: `${m.training.planned} planificadas`           },
            { label: "Residuos activos",    value: m.waste.stored,  sub: `${m.waste.total_activity_gbq.toFixed(1)} GBq total`},
          ].map(k => (
            <div key={k.label} className={`rounded-lg border p-3 ${k.alert ? "border-red-300 bg-red-50" : "border-border bg-surface"}`}>
              <p className={`text-2xl font-bold ${k.alert ? "text-red-600" : ""}`}>{k.value}</p>
              <p className="text-xs font-medium leading-tight">{k.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas críticas */}
      {critical_alerts.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-accent" />
            Alertas del Programa ({critical_alerts.length})
            {criticalCount > 0 && <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-700">{criticalCount} críticas</span>}
          </h2>
          <div className="flex flex-col gap-2">
            {critical_alerts.map((a, i) => {
              const cfg = ALERT_CFG[a.level];
              const Icon = cfg.icon;
              return (
                <Link key={i} href={a.href} className={`flex items-center gap-3 rounded-md border px-3 py-2 hover:opacity-80 transition-opacity ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.text}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${cfg.text}`}>{a.message}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{a.module}</span>
                  <ChevronRight className={`h-3 w-3 shrink-0 ${cfg.text}`} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {critical_alerts.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-emerald-700 font-medium">Sin alertas activas — Programa PR en estado óptimo</p>
        </div>
      )}

      {/* Módulos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estado por Módulo</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ModuleCard icon={Activity}     label="Dosimetría"        href="/dosimetry"
            hasIssue={m.dosimetry.over_limit > 0}
            kpis={[
              { label: "Registros trim.", value: m.dosimetry.total_records },
              { label: "Sobre límite",    value: m.dosimetry.over_limit, alert: m.dosimetry.over_limit > 0 },
              { label: "Dosis prom.",     value: `${m.dosimetry.avg_dose_msv} mSv` },
              { label: "Dosis colect.",   value: `${m.dosimetry.collective_dose_msv.toFixed(1)} mSv` },
            ]} />
          <ModuleCard icon={Users}        label="Trabajadores"      href="/workers"
            hasIssue={m.workers.medical_expired > 0}
            kpis={[
              { label: "Total activos",   value: m.workers.total },
              { label: "OER",             value: m.workers.oer },
              { label: "Examen vencido",  value: m.workers.medical_expired, alert: m.workers.medical_expired > 0 },
              { label: "Vence 90 días",   value: m.workers.medical_expiring, alert: m.workers.medical_expiring > 0 },
            ]} />
          <ModuleCard icon={Atom}         label="Fuentes Radiact."  href="/sources"
            hasIssue={m.sources.auth_expired > 0 || m.sources.leak_test_failed > 0}
            kpis={[
              { label: "Total fuentes",   value: m.sources.total },
              { label: "Auth. vencida",   value: m.sources.auth_expired, alert: m.sources.auth_expired > 0 },
              { label: "Fuga fallida",    value: m.sources.leak_test_failed, alert: m.sources.leak_test_failed > 0 },
              { label: "Auth. próxima",   value: m.sources.auth_expiring, alert: m.sources.auth_expiring > 0 },
            ]} />
          <ModuleCard icon={Flame}        label="Incidentes"        href="/incidents"
            hasIssue={m.incidents.cchen_pending > 0 || m.incidents.ines_1_plus > 0}
            kpis={[
              { label: "Total año",       value: m.incidents.total_year },
              { label: "Abiertos",        value: m.incidents.open, alert: m.incidents.open > 0 },
              { label: "INES ≥ 1",        value: m.incidents.ines_1_plus, alert: m.incidents.ines_1_plus > 0 },
              { label: "CCHEN pendiente", value: m.incidents.cchen_pending, alert: m.incidents.cchen_pending > 0 },
            ]} />
          <ModuleCard icon={Radio}        label="Reportes CCHEN"    href="/regulatory-reports"
            hasIssue={m.reports.overdue > 0}
            kpis={[
              { label: "En elaboración",  value: m.reports.in_progress },
              { label: "Enviados",        value: m.reports.submitted },
              { label: "Aprobados",       value: m.reports.approved },
              { label: "Vencidos",        value: m.reports.overdue, alert: m.reports.overdue > 0 },
            ]} />
          <ModuleCard icon={GraduationCap} label="Capacitaciones"   href="/training"
            hasIssue={m.training.overdue > 0}
            kpis={[
              { label: "Completadas",     value: m.training.completed },
              { label: "Planificadas",    value: m.training.planned },
              { label: "Participantes",   value: m.training.total_participants },
              { label: "Atrasadas",       value: m.training.overdue, alert: m.training.overdue > 0 },
            ]} />
          <ModuleCard icon={Wrench}       label="Instrumentos"      href="/instruments"
            hasIssue={m.equipment.calibration_overdue > 0 || m.equipment.out_of_service > 0}
            kpis={[
              { label: "Total",           value: m.equipment.total },
              { label: "Calib. vencida",  value: m.equipment.calibration_overdue, alert: m.equipment.calibration_overdue > 0 },
              { label: "Calib. próxima",  value: m.equipment.calibration_soon },
              { label: "Fuera servicio",  value: m.equipment.out_of_service, alert: m.equipment.out_of_service > 0 },
            ]} />
          <ModuleCard icon={Trash2}       label="Residuos"          href="/waste-management"
            hasIssue={false}
            kpis={[
              { label: "Total activos",   value: m.waste.total },
              { label: "Almacenados",     value: m.waste.stored },
              { label: "Transferidos",    value: m.waste.transferred },
              { label: "Actividad total", value: `${m.waste.total_activity_gbq.toFixed(1)} GBq` },
            ]} />
        </div>
      </div>

      {/* Tendencias */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Dosis últimos 6 meses */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-1 text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Dosis últimos 6 meses
          </h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Promedio y máximo mensual (mSv)</p>
          <MiniBar data={trends.dose_history} keys={["avg_dose","max_dose"]} colors={["bg-accent/70","bg-orange-400/80"]} />
          <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-accent/70 inline-block" />Promedio</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-orange-400/80 inline-block" />Máximo</span>
          </div>
        </div>

        {/* Incidentes últimos 6 meses */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-1 text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            Incidentes últimos 6 meses
          </h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Total e INES ≥1 por mes</p>
          <MiniBar data={trends.incident_history} keys={["count","ines_1_plus"]} colors={["bg-orange-400/70","bg-red-500/80"]} />
          <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-orange-400/70 inline-block" />Total</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-red-500/80 inline-block" />INES ≥1</span>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Accesos Rápidos</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/dosimetry",          label: "Dosimetría",          icon: Activity      },
            { href: "/workers",            label: "Trabajadores",         icon: Users         },
            { href: "/sources",            label: "Fuentes",              icon: Atom          },
            { href: "/incidents",          label: "Incidentes",           icon: Flame         },
            { href: "/regulatory-reports", label: "Reportes CCHEN",       icon: Radio         },
            { href: "/training",           label: "Capacitación",         icon: GraduationCap },
            { href: "/instruments",        label: "Instrumentos",         icon: Wrench        },
            { href: "/waste-management",   label: "Residuos",             icon: Trash2        },
            { href: "/alara",              label: "ALARA",                icon: TrendingDown  },
            { href: "/compliance",         label: "Cumplimiento",         icon: ShieldCheck   },
            { href: "/contamination",      label: "Contaminación",        icon: Biohazard     },
            { href: "/expiries",           label: "Vencimientos",         icon: Award         },
            { href: "/alerts",             label: "Alertas",              icon: Bell          },
            { href: "/logbook",            label: "Libro Novedades",      icon: Tag           },
          ].map(l => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                <Icon className="h-3.5 w-3.5 text-accent" />{l.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Normativa */}
      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: DS 3/1985 Capítulos I-X · CCHEN Reglamento Informe Anual · IAEA GSR Part 3 (2014) · IAEA Safety Standards Series · DS 594/1999 (Ambientes Ocupacionales)
      </div>
    </div>
  );
}
