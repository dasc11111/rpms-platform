"use client";

// Fase 23C — Dashboard/Analytics PET/CT
// KPIs globales, distribución por radiofármaco y estado, tendencia 30 días,
// panel de pacientes activos con dosimetría en vivo.
// DS 133/1984 Art. 22-26, IAEA HHS No. 1.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChartCard,
  DonutChartCard,
  AreaChartCard,
  type ChartDatum,
} from "@/components/ui/Charts";
import {
  calcDecay,
  doseRateAt1m_usvh,
  DOSE_RELEASE_THRESHOLD_USVH,
  PETCT_EXAM_STATE_LABELS,
  type PetctRadionuclide,
  type PetctExamState,
} from "@/lib/petct";
import { PetctAlertsPanel } from "@/components/petct/petct-alerts";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface KpiData {
  total_examinations: string;
  exams_today: string;
  completed: string;
  cancelled: string;
  active_patients: string;
  scheduled: string;
  avg_dose_mbq: string | null;
  max_dose_mbq: string | null;
  exams_last_30d: string;
  exams_last_7d: string;
}

interface PharmaRow {
  name: string;
  count: string;
  avg_mbq: string | null;
  avg_weight_kg: string | null;
}

interface ActivePatient {
  id: string;
  patient_id: string;
  patient_name: string | null;
  radiopharmaceutical: string;
  radionuclide: PetctRadionuclide;
  administered_mbq: number;
  injection_datetime: string;
  uptake_minutes: number;
  state: PetctExamState;
  exam_start: string | null;
  operator: string;
}

interface QcRow {
  qc_date: string;
  phantom_type: string;
  uniformity_pass: boolean;
  image_quality_pass: boolean;
  performed_by: string;
}

interface DashboardData {
  kpi: KpiData;
  pharmaDistribution: PharmaRow[];
  stateDistribution: ChartDatum[];
  nuclideDistribution: ChartDatum[];
  trend30d: ChartDatum[];
  weeklyActivity: ChartDatum[];
  activePatients: ActivePatient[];
  recentQc: QcRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("es-CL");
}

function fmtMbq(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${Number(v).toFixed(1)} MBq`;
}

function elapsedMin(isoDatetime: string): number {
  return (Date.now() - new Date(isoDatetime).getTime()) / 60_000;
}

function fmtMin(min: number): string {
  if (min <= 0) return "0 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function stateLabelShort(state: PetctExamState): string {
  const labels: Record<PetctExamState, string> = {
    programado: "Programado",
    en_espera: "Uptake",
    en_examen: "En examen",
    completado: "Completado",
    cancelado: "Cancelado",
  };
  return labels[state] ?? state;
}

// ── KPI Tile ───────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  color = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const colorMap = {
    default: "text-foreground",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${colorMap[color]}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── Active patient row ─────────────────────────────────────────────────────────

function ActivePatientRow({ patient }: { patient: ActivePatient }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - new Date(patient.injection_datetime).getTime()) / 60_000;
  const currentMbq = calcDecay(Number(patient.administered_mbq), elapsed, patient.radionuclide);
  const doseRate = doseRateAt1m_usvh(currentMbq);
  const uptakeRemaining = Math.max(0, patient.uptake_minutes - elapsed);
  const uptakeDone = uptakeRemaining <= 0;
  const aboveThreshold = doseRate > DOSE_RELEASE_THRESHOLD_USVH;

  const doseColor = aboveThreshold
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
      {/* ID + estado */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/petct/${patient.id}`}
            className="font-semibold text-foreground hover:text-accent hover:underline truncate"
          >
            {patient.patient_id}
          </a>
          {patient.patient_name && (
            <span className="text-sm text-muted-foreground truncate">{patient.patient_name}</span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              patient.state === "en_examen"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {stateLabelShort(patient.state)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {patient.radiopharmaceutical} · {fmtMbq(patient.administered_mbq)} · Op: {patient.operator}
        </div>
      </div>

      {/* Dosimetría en vivo */}
      <div className="flex items-center gap-4 text-sm shrink-0">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Act. actual</div>
          <div className="font-medium">{currentMbq.toFixed(1)} MBq</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Dosis@1m</div>
          <div className={`font-semibold ${doseColor}`}>{doseRate.toFixed(1)} µSv/h</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">
            {uptakeDone ? "Captación" : "Captación en"}
          </div>
          <div className={`font-medium ${uptakeDone ? "text-green-600 dark:text-green-400" : ""}`}>
            {uptakeDone ? "Completa ✓" : fmtMin(uptakeRemaining)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard component ───────────────────────────────────────────────────

export function PetctDashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/petct/dashboard", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json as DashboardData);
        setLastUpdate(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 60s when there are active patients
  useEffect(() => {
    const hasActive = Number(data.kpi.active_patients) > 0;
    if (hasActive) {
      intervalRef.current = setInterval(refresh, 60_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data.kpi.active_patients, refresh]);

  const { kpi, pharmaDistribution, stateDistribution, nuclideDistribution, trend30d, weeklyActivity, activePatients, recentQc } = data;

  // Prepare state chart data with labels
  const stateLabelMap: Record<string, string> = {
    programado: "Programado",
    en_espera: "En espera",
    en_examen: "En examen",
    completado: "Completado",
    cancelado: "Cancelado",
  };
  const stateChartData = stateDistribution.map((r) => ({
    ...r,
    name: stateLabelMap[String(r.name)] ?? String(r.name),
  }));

  const pharmaChartData = pharmaDistribution.map((r) => ({
    name: r.name.length > 20 ? r.name.slice(0, 18) + "…" : r.name,
    Exámenes: Number(r.count),
  }));

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard PET/CT</h1>
          <p className="text-sm text-muted-foreground">
            Analytics y monitoreo de exámenes — HHHA Medicina Nuclear
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Actualizado: {lastUpdate.toLocaleTimeString("es-CL")}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          <a
            href="/petct"
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
          >
            ← Lista
          </a>
        </div>
      </div>

      {/* KPI tiles row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiTile
          label="Total exámenes"
          value={fmtNum(kpi.total_examinations)}
          color="default"
        />
        <KpiTile
          label="Hoy"
          value={fmtNum(kpi.exams_today)}
          sub="inyecciones"
          color="blue"
        />
        <KpiTile
          label="Pacientes activos"
          value={fmtNum(kpi.active_patients)}
          sub="en sala / examen"
          color={Number(kpi.active_patients) > 0 ? "amber" : "default"}
        />
        <KpiTile
          label="Programados"
          value={fmtNum(kpi.scheduled)}
          sub="pendientes"
          color="default"
        />
        <KpiTile
          label="Completados"
          value={fmtNum(kpi.completed)}
          color="green"
        />
        <KpiTile
          label="Cancelados"
          value={fmtNum(kpi.cancelled)}
          color={Number(kpi.cancelled) > 0 ? "red" : "default"}
        />
      </div>

      {/* KPI tiles row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiTile
          label="Dosis promedio"
          value={kpi.avg_dose_mbq ? `${Number(kpi.avg_dose_mbq).toFixed(1)} MBq` : "—"}
          sub="administrada"
        />
        <KpiTile
          label="Dosis máxima"
          value={kpi.max_dose_mbq ? `${Number(kpi.max_dose_mbq).toFixed(1)} MBq` : "—"}
          sub="administrada"
          color={Number(kpi.max_dose_mbq) > 500 ? "amber" : "default"}
        />
        <KpiTile
          label="Últimos 7 días"
          value={fmtNum(kpi.exams_last_7d)}
          sub="exámenes"
          color="blue"
        />
        <KpiTile
          label="Últimos 30 días"
          value={fmtNum(kpi.exams_last_30d)}
          sub="exámenes"
          color="default"
        />
      </div>

      {/* Alertas en tiempo real */}
      <PetctAlertsPanel />

      {/* Pacientes activos */}
      {activePatients.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            Pacientes activos ({activePatients.length})
          </h2>
          <div className="space-y-2">
            {activePatients.map((p) => (
              <ActivePatientRow key={p.id} patient={p} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Umbral alta: {DOSE_RELEASE_THRESHOLD_USVH} µSv/h a 1 m · DS 133/1984 Art. 22-26 · Actualización automática cada 60 s
          </p>
        </section>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia 30 días */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">Tendencia — últimos 30 días</h2>
          <p className="text-xs text-muted-foreground mb-4">Exámenes por día</p>
          {trend30d.length > 0 ? (
            <AreaChartCard data={trend30d} xKey="fecha" yKeys={["examenes"]} height={240} />
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
              Sin datos en los últimos 30 días
            </div>
          )}
        </div>

        {/* Actividad semanal */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">Actividad semanal</h2>
          <p className="text-xs text-muted-foreground mb-4">Exámenes y dosis total por semana (8 semanas)</p>
          {weeklyActivity.length > 0 ? (
            <BarChartCard data={weeklyActivity} xKey="semana" yKeys={["examenes"]} height={240} />
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
              Sin datos recientes
            </div>
          )}
        </div>

        {/* Distribución por radiofármaco */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">Distribución por radiofármaco</h2>
          <p className="text-xs text-muted-foreground mb-4">Número de exámenes</p>
          {pharmaChartData.length > 0 ? (
            <BarChartCard data={pharmaChartData} xKey="name" yKeys={["Exámenes"]} height={240} />
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
              Sin datos
            </div>
          )}
        </div>

        {/* Distribución por estado */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">Distribución por estado</h2>
          <p className="text-xs text-muted-foreground mb-4">Exámenes por estado actual</p>
          {stateChartData.length > 0 ? (
            <DonutChartCard data={stateChartData} dataKey="value" nameKey="name" height={240} />
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
              Sin datos
            </div>
          )}
        </div>
      </div>

      {/* Tabla detallada de radiofármacos */}
      {pharmaDistribution.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Detalle por radiofármaco</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Radiofármaco</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">N° exámenes</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Dosis prom.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Peso prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pharmaDistribution.map((row) => (
                  <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-right text-foreground">{fmtNum(row.count)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtMbq(row.avg_mbq)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {row.avg_weight_kg ? `${Number(row.avg_weight_kg).toFixed(1)} kg` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* QC reciente */}
      {recentQc.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Control de calidad diario — últimas 7 sesiones</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fantoma</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Uniformidad</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Calidad imagen</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentQc.map((qc) => (
                  <tr key={String(qc.qc_date)} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground">
                      {new Date(qc.qc_date).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{qc.phantom_type}</td>
                    <td className="px-4 py-3 text-center">
                      {qc.uniformity_pass ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">✓ Pasa</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-medium">✗ Falla</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {qc.image_quality_pass ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">✓ Pasa</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-medium">✗ Falla</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{qc.performed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pie regulatorio */}
      <footer className="text-xs text-muted-foreground border-t border-border pt-4">
        Módulo PET/CT — Medicina Nuclear HHHA · DS 133/1984 Art. 22-26 · DS 3/1985 Art. 5 · IAEA HHS No. 1 · IAEA SRS-58 ·
        Umbral de alta paciente: {DOSE_RELEASE_THRESHOLD_USVH} µSv/h a 1 m (Γ = 0,143 µSv·m²/(MBq·h))
      </footer>
    </div>
  );
}
