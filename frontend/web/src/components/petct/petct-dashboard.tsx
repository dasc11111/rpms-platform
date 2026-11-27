"use client";

// Fase 23C — Dashboard/Analytics PET/CT — Multi-panel profesional
// KPIs globales, distribución por radiofármaco y estado, tendencia 30 días,
// panel de pacientes activos con dosimetría en vivo.
// DS 133/1984 Art. 22-26, IAEA HHS No. 1.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
  stateDistribution: { name: string; value: number }[];
  nuclideDistribution: { name: string; value: number }[];
  trend30d: { fecha: string; examenes: number; dosis_prom_mbq: number }[];
  weeklyActivity: { semana: string; examenes: number; dosis_total_mbq: number }[];
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

// ── KPI Color Map (static Tailwind classes — no interpolation) ─────────────────

const KPI_COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  blue:   { border: "border-blue-100",   text: "text-blue-600",   bg: "bg-blue-50" },
  green:  { border: "border-green-100",  text: "text-green-600",  bg: "bg-green-50" },
  teal:   { border: "border-teal-100",   text: "text-teal-600",   bg: "bg-teal-50" },
  orange: { border: "border-orange-100", text: "text-orange-600", bg: "bg-orange-50" },
  red:    { border: "border-red-100",    text: "text-red-600",    bg: "bg-red-50" },
  yellow: { border: "border-yellow-100", text: "text-yellow-600", bg: "bg-yellow-50" },
  purple: { border: "border-purple-100", text: "text-purple-600", bg: "bg-purple-50" },
  sky:    { border: "border-sky-100",    text: "text-sky-600",    bg: "bg-sky-50" },
  rose:   { border: "border-rose-100",   text: "text-rose-600",   bg: "bg-rose-50" },
  indigo: { border: "border-indigo-100", text: "text-indigo-600", bg: "bg-indigo-50" },
  gray:   { border: "border-gray-100",   text: "text-gray-600",   bg: "bg-gray-50" },
};

// ── Pie chart colors ───────────────────────────────────────────────────────────

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

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

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
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
                ? "bg-blue-100 text-blue-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {stateLabelShort(patient.state)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {patient.radiopharmaceutical} · {fmtMbq(patient.administered_mbq)} · Op: {patient.operator}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm shrink-0">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Act. actual</div>
          <div className="font-medium">{currentMbq.toFixed(1)} MBq</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Dosis@1m</div>
          <div className={`font-semibold ${aboveThreshold ? "text-red-600" : "text-green-600"}`}>
            {doseRate.toFixed(1)} µSv/h
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">
            {uptakeDone ? "Captación" : "Captación en"}
          </div>
          <div className={`font-medium ${uptakeDone ? "text-green-600" : ""}`}>
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
  const [dashTab, setDashTab] = useState("resumen");
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

  const TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "operacion", label: "Operación Clínica" },
    { id: "calidad", label: "Control de Calidad" },
    { id: "distribuciones", label: "Distribuciones" },
  ];

  return (
    <div className="p-6 space-y-4">
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

      {/* Main dashboard card */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {/* Tab navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDashTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dashTab === tab.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {Number(kpi.active_patients) > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {kpi.active_patients} paciente{Number(kpi.active_patients) !== 1 ? "s" : ""} activo{Number(kpi.active_patients) !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="p-4">
          {/* ── TAB: RESUMEN ─────────────────────────────────────────── */}
          {dashTab === "resumen" && (() => {
            const kpis = [
              { label: "Total exámenes", value: fmtNum(kpi.total_examinations), sub: "histórico", color: "blue" },
              { label: "Hoy", value: fmtNum(kpi.exams_today), sub: "inyecciones", color: "teal" },
              { label: "Pacientes activos", value: fmtNum(kpi.active_patients), sub: "en sala / examen", color: Number(kpi.active_patients) > 0 ? "orange" : "gray" },
              { label: "Programados", value: fmtNum(kpi.scheduled), sub: "pendientes", color: "indigo" },
              { label: "Completados", value: fmtNum(kpi.completed), sub: "finalizados", color: "green" },
              { label: "Cancelados", value: fmtNum(kpi.cancelled), sub: "no realizados", color: Number(kpi.cancelled) > 0 ? "red" : "gray" },
            ];
            return (
              <div className="space-y-6">
                {/* KPI row 1 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {kpis.map((k) => {
                    const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.gray;
                    return (
                      <div key={k.label} className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-1`}>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</span>
                        <span className={`text-2xl font-bold ${c.text}`}>{k.value}</span>
                        {k.sub && <span className="text-xs text-muted-foreground">{k.sub}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* KPI row 2 — dosis */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Dosimetría administrada</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Dosis promedio", value: kpi.avg_dose_mbq ? `${Number(kpi.avg_dose_mbq).toFixed(1)} MBq` : "—", sub: "administrada", color: "blue" },
                      { label: "Dosis máxima", value: kpi.max_dose_mbq ? `${Number(kpi.max_dose_mbq).toFixed(1)} MBq` : "—", sub: "administrada", color: Number(kpi.max_dose_mbq) > 500 ? "orange" : "teal" },
                      { label: "Últimos 7 días", value: fmtNum(kpi.exams_last_7d), sub: "exámenes", color: "sky" },
                      { label: "Últimos 30 días", value: fmtNum(kpi.exams_last_30d), sub: "exámenes", color: "indigo" },
                    ].map((k) => {
                      const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.gray;
                      return (
                        <div key={k.label} className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-1`}>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</span>
                          <span className={`text-2xl font-bold ${c.text}`}>{k.value}</span>
                          {k.sub && <span className="text-xs text-muted-foreground">{k.sub}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alertas */}
                <PetctAlertsPanel />

                {/* Tabla radiofármacos resumen */}
                {pharmaDistribution.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Uso por radiofármaco</h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Radiofármaco</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">N° exámenes</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Dosis prom.</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">% del total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pharmaDistribution.map((row) => {
                            const total = pharmaDistribution.reduce((s, r) => s + Number(r.count), 0);
                            const pct = total > 0 ? (Number(row.count) / total) * 100 : 0;
                            return (
                              <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                                <td className="px-4 py-2.5 text-right text-foreground">{fmtNum(row.count)}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtMbq(row.avg_mbq)}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── TAB: OPERACIÓN CLÍNICA ───────────────────────────────── */}
          {dashTab === "operacion" && (() => {
            const totalExams = Number(kpi.total_examinations) || 1;
            const completionRate = Math.round((Number(kpi.completed) / totalExams) * 100);
            const cancellationRate = Math.round((Number(kpi.cancelled) / totalExams) * 100);

            const semaforo = (val: number, warn: number, bad: number, invert = false) => {
              if (!invert) {
                if (val >= warn) return KPI_COLOR_MAP.green;
                if (val >= bad) return KPI_COLOR_MAP.yellow;
                return KPI_COLOR_MAP.red;
              } else {
                if (val <= warn) return KPI_COLOR_MAP.green;
                if (val <= bad) return KPI_COLOR_MAP.yellow;
                return KPI_COLOR_MAP.red;
              }
            };

            return (
              <div className="space-y-6">
                {/* Métricas operacionales */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    (() => { const c = semaforo(completionRate, 90, 75); return { label: "Tasa de completitud", value: `${completionRate}%`, sub: `${fmtNum(kpi.completed)} / ${fmtNum(kpi.total_examinations)}`, color: Object.keys(KPI_COLOR_MAP).find(k => KPI_COLOR_MAP[k] === c) ?? "gray" }; })(),
                    (() => { const c = semaforo(cancellationRate, 5, 10, true); return { label: "Tasa de cancelación", value: `${cancellationRate}%`, sub: `${fmtNum(kpi.cancelled)} cancelados`, color: Object.keys(KPI_COLOR_MAP).find(k => KPI_COLOR_MAP[k] === c) ?? "gray" }; })(),
                    { label: "Exámenes (7 días)", value: fmtNum(kpi.exams_last_7d), sub: "últimos 7 días", color: "sky" },
                    { label: "Exámenes (30 días)", value: fmtNum(kpi.exams_last_30d), sub: "últimos 30 días", color: "indigo" },
                  ].map((k) => {
                    const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.gray;
                    return (
                      <div key={k.label} className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-1`}>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</span>
                        <span className={`text-2xl font-bold ${c.text}`}>{k.value}</span>
                        {k.sub && <span className="text-xs text-muted-foreground">{k.sub}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Semáforo de operación */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Estado operacional</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Completitud exámenes", value: completionRate, unit: "%", warn: 90, bad: 75, invert: false, desc: "≥90% óptimo" },
                      { label: "Cancelación", value: cancellationRate, unit: "%", warn: 5, bad: 10, invert: true, desc: "≤5% óptimo" },
                      { label: "Pacientes activos ahora", value: Number(kpi.active_patients), unit: "", warn: 0, bad: 5, invert: false, desc: "en sala/examen" },
                    ].map((item) => {
                      const c = (() => {
                        if (!item.invert) {
                          if (item.value >= item.warn) return KPI_COLOR_MAP.green;
                          if (item.value >= item.bad) return KPI_COLOR_MAP.yellow;
                          return KPI_COLOR_MAP.red;
                        } else {
                          if (item.value <= item.warn) return KPI_COLOR_MAP.green;
                          if (item.value <= item.bad) return KPI_COLOR_MAP.yellow;
                          return KPI_COLOR_MAP.red;
                        }
                      })();
                      return (
                        <div key={item.label} className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</span>
                          </div>
                          <div className={`text-3xl font-bold mb-1 ${c.text}`}>{item.value}{item.unit}</div>
                          <div className="w-full h-2 rounded-full bg-white/60 overflow-hidden mt-2">
                            <div
                              className={`h-full rounded-full ${c.bg.replace("bg-", "bg-").replace("-50", "-400")}`}
                              style={{ width: `${Math.min(item.value, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pacientes activos */}
                {activePatients.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      Pacientes activos ({activePatients.length})
                    </h3>
                    <div className="space-y-2">
                      {activePatients.map((p) => (
                        <ActivePatientRow key={p.id} patient={p} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Umbral alta: {DOSE_RELEASE_THRESHOLD_USVH} µSv/h a 1 m · DS 133/1984 Art. 22-26 · Auto-refresh 60 s
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
                    <p className="text-sm text-muted-foreground">No hay pacientes activos en este momento</p>
                  </div>
                )}

                {/* Detalle por radiofármaco */}
                {pharmaDistribution.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Detalle por radiofármaco</h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Radiofármaco</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">N° exámenes</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Dosis prom.</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Peso prom.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pharmaDistribution.map((row) => (
                            <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                              <td className="px-4 py-2.5 text-right text-foreground">{fmtNum(row.count)}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtMbq(row.avg_mbq)}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {row.avg_weight_kg ? `${Number(row.avg_weight_kg).toFixed(1)} kg` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── TAB: CONTROL DE CALIDAD ──────────────────────────────── */}
          {dashTab === "calidad" && (() => {
            const qcTotal = recentQc.length;
            const qcUniformityPass = recentQc.filter((q) => q.uniformity_pass).length;
            const qcImagePass = recentQc.filter((q) => q.image_quality_pass).length;
            const qcBothPass = recentQc.filter((q) => q.uniformity_pass && q.image_quality_pass).length;
            const uniformityRate = qcTotal > 0 ? Math.round((qcUniformityPass / qcTotal) * 100) : 0;
            const imageRate = qcTotal > 0 ? Math.round((qcImagePass / qcTotal) * 100) : 0;
            const globalRate = qcTotal > 0 ? Math.round((qcBothPass / qcTotal) * 100) : 0;

            const semCol = (rate: number) => {
              if (rate >= 95) return KPI_COLOR_MAP.green;
              if (rate >= 80) return KPI_COLOR_MAP.yellow;
              return KPI_COLOR_MAP.red;
            };

            return (
              <div className="space-y-6">
                {/* QC KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Sesiones QC", value: fmtNum(qcTotal), sub: "últimas sesiones", color: "blue" },
                    (() => { const c = semCol(globalRate); const key = Object.keys(KPI_COLOR_MAP).find(k => KPI_COLOR_MAP[k] === c) ?? "gray"; return { label: "Aprobación global", value: `${globalRate}%`, sub: `${qcBothPass}/${qcTotal} sesiones`, color: key }; })(),
                    (() => { const c = semCol(uniformityRate); const key = Object.keys(KPI_COLOR_MAP).find(k => KPI_COLOR_MAP[k] === c) ?? "gray"; return { label: "Uniformidad", value: `${uniformityRate}%`, sub: `${qcUniformityPass}/${qcTotal}`, color: key }; })(),
                    (() => { const c = semCol(imageRate); const key = Object.keys(KPI_COLOR_MAP).find(k => KPI_COLOR_MAP[k] === c) ?? "gray"; return { label: "Calidad imagen", value: `${imageRate}%`, sub: `${qcImagePass}/${qcTotal}`, color: key }; })(),
                  ].map((k) => {
                    const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.gray;
                    return (
                      <div key={k.label} className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-1`}>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</span>
                        <span className={`text-2xl font-bold ${c.text}`}>{k.value}</span>
                        {k.sub && <span className="text-xs text-muted-foreground">{k.sub}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Barras de aprobación */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Tasas de aprobación QC</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Uniformidad del detector", value: uniformityRate, color: "bg-teal-500" },
                      { label: "Calidad de imagen (fantoma)", value: imageRate, color: "bg-blue-500" },
                      { label: "Aprobación global (ambos criterios)", value: globalRate, color: "bg-indigo-500" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-semibold text-foreground">{item.value}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla QC */}
                {recentQc.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Control de calidad diario — últimas {recentQc.length} sesiones
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fecha</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fantoma</th>
                            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Uniformidad</th>
                            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Calidad imagen</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Operador</th>
                            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {recentQc.map((qc) => {
                            const allPass = qc.uniformity_pass && qc.image_quality_pass;
                            return (
                              <tr key={String(qc.qc_date)} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-2.5 text-foreground">
                                  {new Date(qc.qc_date).toLocaleDateString("es-CL")}
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">{qc.phantom_type}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {qc.uniformity_pass ? (
                                    <span className="text-green-600 font-medium">✓ Pasa</span>
                                  ) : (
                                    <span className="text-red-600 font-medium">✗ Falla</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {qc.image_quality_pass ? (
                                    <span className="text-green-600 font-medium">✓ Pasa</span>
                                  ) : (
                                    <span className="text-red-600 font-medium">✗ Falla</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">{qc.performed_by}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${allPass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {allPass ? "Conforme" : "No conforme"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Criterios IAEA HHS No. 1 · IAEA SRS-58 · Revisión diaria obligatoria DS 133/1984
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
                    <p className="text-sm text-muted-foreground">No hay registros de control de calidad disponibles</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── TAB: DISTRIBUCIONES (con Recharts) ──────────────────── */}
          {dashTab === "distribuciones" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tendencia 30 días */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Tendencia — últimos 30 días</h3>
                  <p className="text-xs text-muted-foreground mb-4">Exámenes por día</p>
                  {trend30d.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trend30d} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Line type="monotone" dataKey="examenes" stroke="#3b82f6" strokeWidth={2} dot={false} name="Exámenes" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                      Sin datos en los últimos 30 días
                    </div>
                  )}
                </div>

                {/* Actividad semanal */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Actividad semanal</h3>
                  <p className="text-xs text-muted-foreground mb-4">Exámenes por semana (8 semanas)</p>
                  {weeklyActivity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={weeklyActivity} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="semana" tick={{ fontSize: 10 }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="examenes" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Exámenes" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                      Sin datos recientes
                    </div>
                  )}
                </div>

                {/* Distribución por radiofármaco */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Distribución por radiofármaco</h3>
                  <p className="text-xs text-muted-foreground mb-4">Número de exámenes por producto</p>
                  {pharmaChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={pharmaChartData} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} width={120} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="Exámenes" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                  )}
                </div>

                {/* Distribución por estado */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Distribución por estado</h3>
                  <p className="text-xs text-muted-foreground mb-4">Exámenes por estado actual</p>
                  {stateChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={stateChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={2}
                        >
                          {stateChartData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                  )}
                </div>
              </div>

              {/* Distribución por nucleido */}
              {nuclideDistribution.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Distribución por radionúclido</h3>
                  <p className="text-xs text-muted-foreground mb-4">Exámenes por tipo de radionúclido utilizado</p>
                  <div className="space-y-2">
                    {nuclideDistribution.map((n, idx) => {
                      const total = nuclideDistribution.reduce((s, r) => s + Number(r.value), 0);
                      const pct = total > 0 ? (Number(n.value) / total) * 100 : 0;
                      return (
                        <div key={String(n.name)} className="flex items-center gap-3">
                          <div className="w-24 text-xs text-muted-foreground shrink-0 text-right">{n.name}</div>
                          <div className="flex-1 h-6 rounded-lg bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-lg flex items-center justify-end pr-2"
                              style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                            >
                              {pct > 15 && (
                                <span className="text-white text-xs font-semibold">{Math.round(pct)}%</span>
                              )}
                            </div>
                          </div>
                          <div className="w-16 text-xs text-muted-foreground">{fmtNum(n.value)} exáms.</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer regulatorio */}
      <footer className="text-xs text-muted-foreground border-t border-border pt-3">
        Módulo PET/CT — Medicina Nuclear HHHA · DS 133/1984 Art. 22-26 · DS 3/1985 Art. 5 · IAEA HHS No. 1 · IAEA SRS-58 ·
        Umbral alta paciente: {DOSE_RELEASE_THRESHOLD_USVH} µSv/h a 1 m (Γ = 0,143 µSv·m²/(MBq·h))
      </footer>
    </div>
  );
}
