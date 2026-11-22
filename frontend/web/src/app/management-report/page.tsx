"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, Award, CheckCircle2, Flame, GraduationCap,
  RefreshCw, Shield, ShieldAlert, TrendingDown, Trash2, Users, Wrench, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportData {
  year: number;
  generated_at: string;
  dosimetry: {
    workers_monitored: number; collective_dose: string; avg_dose: string;
    max_dose: string; above_limit: number; above_constraint: number; zero_dose: number;
  };
  incidents: { total: number; high_severity: number; closed: number; open: number };
  training: { sessions: number; total_registered: number; total_attended: number; total_passed: number };
  calibrations: { total_instruments: number; vigente: number; vencida: number; por_vencer: number };
  alara: { total: number; completed: number; in_progress: number; avg_reduction_pct: string | null };
  waste: { total_records: number; in_storage: number; released_this_year: number };
  compliance: { total_items: number; compliant: number; non_compliant: number };
  by_service: { service: string; workers: number; collective_dose: string; max_dose: string }[];
  emergency: { total_plans: number; active_plans: number; overdue_drills: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function pct(a: number, b: number): string {
  if (!b) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

function Section({ title, icon: Icon, iconColor = "text-blue-600", children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; iconColor?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        <Icon className={cn("w-4 h-4", iconColor)} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, alert = false }: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-lg p-3 border text-center", alert ? "bg-red-50 border-red-200" : "bg-muted/30 border-border")}>
      <p className={cn("text-xl font-bold", alert ? "text-red-700" : "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <p className="text-xs font-medium mt-0.5 text-muted-foreground">{label}</p>
    </div>
  );
}

function HealthBar({ value, max, color = "blue" }: { value: number; max: number; color?: string }) {
  const pctWidth = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const C: Record<string, string> = { blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-500" };
  return (
    <div className="w-full bg-muted rounded-full h-2 mt-1">
      <div className={cn("h-2 rounded-full transition-all", C[color] ?? C.blue)} style={{ width: `${pctWidth}%` }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ManagementReportPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/management-report?year=${year}`);
      const json = await res.json();
      setData(json);
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">Generando informe de gestión…</div>;
  }

  const { dosimetry: d, incidents: inc, training: tr, calibrations: cal, alara, waste, compliance, by_service, emergency } = data;
  const compliancePct = compliance.total_items > 0 ? Math.round((compliance.compliant / compliance.total_items) * 100) : 0;
  const calOkPct      = cal.total_instruments > 0 ? Math.round((cal.vigente / cal.total_instruments) * 100) : 0;
  const trainAttPct   = tr.total_registered > 0 ? Math.round(((tr.total_attended ?? 0) / tr.total_registered) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Informe de Gestión Radiológica
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Resumen ejecutivo consolidado — Hospital Dr. Hernán Henríquez Aravena · {data.year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background">
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchData} className="p-2 border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Normativa banner */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        <span className="font-semibold">Marco normativo:</span> DS 3/1985 MINSAL · NS-06.0 CCHEN · Ley 20.936 (Seguridad Nuclear)
        · ICRP 103 (Límite 20 mSv/año) · D.S. N°594/99 MINSAL (Riesgos Ocupacionales)
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Dosimetría ──────────────────────────────────────────────────── */}
        <Section title="Dosimetría Ocupacional" icon={Activity} iconColor="text-blue-600">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Trabajadores monitorizados" value={d.workers_monitored ?? 0} />
            <Stat label="Dosis colectiva (mSv)" value={parseFloat(d.collective_dose ?? "0").toFixed(1)} />
            <Stat label="Dosis media (mSv)" value={parseFloat(d.avg_dose ?? "0").toFixed(2)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Dosis máxima (mSv)" value={parseFloat(d.max_dose ?? "0").toFixed(2)} alert={parseFloat(d.max_dose ?? "0") > 20} />
            <Stat label={"> 20 mSv (límite legal)"} value={d.above_limit ?? 0} alert={(d.above_limit ?? 0) > 0} />
            <Stat label={"> 6 mSv (restricción)"} value={d.above_constraint ?? 0} alert={(d.above_constraint ?? 0) > 0} />
          </div>
          {by_service.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Top servicios por dosis colectiva</p>
              {by_service.slice(0, 5).map(s => (
                <div key={s.service} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate font-medium">{s.service}</span>
                  <span className="w-10 text-right text-muted-foreground">{s.workers} TOE</span>
                  <div className="flex-1">
                    <HealthBar value={parseFloat(s.collective_dose)} max={parseFloat(by_service[0].collective_dose)} color="blue" />
                  </div>
                  <span className="w-16 text-right font-mono">{parseFloat(s.collective_dose).toFixed(1)} mSv</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/dosimetry" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver dosimetría →</Link>
        </Section>

        {/* ── Incidentes ───────────────────────────────────────────────────── */}
        <Section title="Incidentes y Eventos" icon={AlertTriangle} iconColor="text-orange-600">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Stat label={`Incidentes ${data.year}`} value={inc.total ?? 0} />
            <Stat label="Alta severidad / INES ≥2" value={inc.high_severity ?? 0} alert={(inc.high_severity ?? 0) > 0} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Abiertos / en gestión" value={inc.open ?? 0} alert={(inc.open ?? 0) > 2} />
            <Stat label="Cerrados" value={inc.closed ?? 0} sub={pct(inc.closed ?? 0, inc.total ?? 0) + " cierre"} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Tasa de cierre</p>
            <HealthBar value={inc.closed ?? 0} max={inc.total || 1} color={((inc.closed ?? 0) / (inc.total || 1)) > 0.8 ? "green" : "orange"} />
          </div>
          <Link href="/incidents" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver incidentes →</Link>
        </Section>

        {/* ── Capacitación ─────────────────────────────────────────────────── */}
        <Section title="Capacitación en Protección Radiológica" icon={GraduationCap} iconColor="text-green-600">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Stat label="Sesiones completadas" value={tr.sessions ?? 0} />
            <Stat label="Participantes inscritos" value={tr.total_registered ?? 0} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Asistieron" value={tr.total_attended ?? 0} sub={trainAttPct + "% asistencia"} />
            <Stat label="Aprobaron" value={tr.total_passed ?? 0} sub={pct(tr.total_passed ?? 0, tr.total_attended ?? 0) + " aprobación"} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Tasa de asistencia ({trainAttPct}%)</p>
            <HealthBar value={tr.total_attended ?? 0} max={tr.total_registered || 1} color={trainAttPct >= 80 ? "green" : trainAttPct >= 60 ? "yellow" : "red"} />
          </div>
          <Link href="/training" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver capacitación →</Link>
        </Section>

        {/* ── Calibraciones ────────────────────────────────────────────────── */}
        <Section title="Estado de Calibraciones" icon={Award} iconColor="text-purple-600">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Stat label="Instrumentos con calibración" value={cal.total_instruments ?? 0} />
            <Stat label="Vigentes" value={cal.vigente ?? 0} sub={calOkPct + "% vigentes"} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Por vencer (≤30 d)" value={cal.por_vencer ?? 0} alert={(cal.por_vencer ?? 0) > 0} />
            <Stat label="Vencidas" value={cal.vencida ?? 0} alert={(cal.vencida ?? 0) > 0} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Cobertura vigente ({calOkPct}%)</p>
            <HealthBar value={cal.vigente ?? 0} max={cal.total_instruments || 1} color={calOkPct >= 90 ? "green" : calOkPct >= 70 ? "yellow" : "red"} />
          </div>
          <Link href="/instruments/calibrations" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver calibraciones →</Link>
        </Section>

        {/* ── ALARA ────────────────────────────────────────────────────────── */}
        <Section title="Programa ALARA" icon={TrendingDown} iconColor="text-green-600">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Stat label={`Acciones ALARA ${data.year}`} value={alara.total ?? 0} />
            <Stat label="Completadas" value={alara.completed ?? 0} sub={pct(alara.completed ?? 0, alara.total ?? 0) + " completado"} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="En progreso" value={alara.in_progress ?? 0} />
            <Stat label="Reducción media lograda" value={alara.avg_reduction_pct ? `${parseFloat(alara.avg_reduction_pct).toFixed(1)}%` : "—"} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Avance de acciones</p>
            <HealthBar value={alara.completed ?? 0} max={alara.total || 1} color="green" />
          </div>
          <Link href="/alara" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver programa ALARA →</Link>
        </Section>

        {/* ── Cumplimiento NS-06.0 ─────────────────────────────────────────── */}
        <Section title="Cumplimiento NS-06.0 CCHEN" icon={ShieldAlert} iconColor="text-blue-600">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Ítems evaluados" value={compliance.total_items ?? 0} />
            <Stat label="Cumplen" value={compliance.compliant ?? 0} sub={compliancePct + "% cumplimiento"} />
            <Stat label="No cumplen / alerta" value={compliance.non_compliant ?? 0} alert={(compliance.non_compliant ?? 0) > 0} />
          </div>
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Nivel de cumplimiento ({compliancePct}%)</p>
            <HealthBar value={compliance.compliant ?? 0} max={compliance.total_items || 1}
              color={compliancePct >= 90 ? "green" : compliancePct >= 70 ? "yellow" : "red"} />
          </div>
          <Link href="/compliance" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver cumplimiento →</Link>
        </Section>

        {/* ── Residuos ─────────────────────────────────────────────────────── */}
        <Section title="Residuos Radiactivos" icon={Trash2} iconColor="text-orange-600">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Registros totales" value={waste.total_records ?? 0} />
            <Stat label="En almacenamiento" value={waste.in_storage ?? 0} alert={(waste.in_storage ?? 0) > 10} />
            <Stat label={`Liberados ${data.year}`} value={waste.released_this_year ?? 0} />
          </div>
          <Link href="/waste-management" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver gestión de residuos →</Link>
        </Section>

        {/* ── Planes de emergencia ─────────────────────────────────────────── */}
        <Section title="Planes de Emergencia" icon={Flame} iconColor="text-red-600">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Planes registrados" value={emergency.total_plans ?? 0} />
            <Stat label="Planes activos" value={emergency.active_plans ?? 0} />
            <Stat label="Simulacros atrasados" value={emergency.overdue_drills ?? 0} alert={(emergency.overdue_drills ?? 0) > 0} />
          </div>
          <Link href="/emergency" className="mt-3 inline-flex text-xs text-blue-600 hover:underline">Ver planes de emergencia →</Link>
        </Section>

      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-right">
        Generado: {new Date(data.generated_at).toLocaleString("es-CL")} · Año {data.year} ·
        Sistema RPMS — Hospital Dr. Hernán Henríquez Aravena
      </div>
    </div>
  );
}
