"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  ExternalLink, ClipboardCheck, FileText, ArrowRight, Info,
  Target, Activity, Calendar, Download,
} from "lucide-react";
import Link from "next/link";

// ── types ──────────────────────────────────────────────────────────────────
interface Indicator {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  target: number;
  target_direction: "lower_better" | "higher_better" | "range";
  target_min?: number;
  target_max?: number;
  current_value: number;
  previous_value?: number;
  trend: "up" | "down" | "stable";
  status: "green" | "yellow" | "red";
  ns_reference: string;
}

interface Summary {
  total: number;
  green: number;
  yellow: number;
  red: number;
  score: number;
}

interface IndicatorsData {
  indicators: Indicator[];
  categories: string[];
  summary: Summary;
  computed_at: string;
}

// ── config ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Conforme",
    dot: "bg-emerald-500",
  },
  yellow: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
    label: "En alerta",
    dot: "bg-amber-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    icon: XCircle,
    iconColor: "text-red-600",
    badge: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400",
    label: "No conforme",
    dot: "bg-red-500",
  },
};

// Map indicators to related module links
const INDICATOR_LINKS: Record<string, { label: string; href: string }[]> = {
  avg_dose_poe: [
    { label: "Dosimetría personal", href: "/personal-dosimetry" },
    { label: "Estadísticas dosis", href: "/dosimetry/stats" },
  ],
  poe_over_15msv: [
    { label: "Dosimetría personal", href: "/personal-dosimetry" },
    { label: "Programa ALARA", href: "/alara" },
  ],
  dosimetry_coverage: [
    { label: "Dosimetría", href: "/dosimetry" },
    { label: "Trabajadores", href: "/workers" },
  ],
  instrument_calibration: [
    { label: "Estado calibraciones", href: "/instruments/calibrations" },
    { label: "Instrumentos", href: "/instruments" },
  ],
  training_coverage: [
    { label: "Capacitación PR", href: "/training" },
    { label: "Trabajadores", href: "/workers" },
  ],
  committee_sessions: [
    { label: "Comité PR — Sesiones", href: "/committee" },
  ],
  open_capa: [
    { label: "CAPA — No conformidades", href: "/capa" },
    { label: "Planes de mejora", href: "/improvement-plans" },
  ],
  docs_overdue: [
    { label: "Procedimientos", href: "/procedures" },
    { label: "Programa PR (PPR)", href: "/radiation-program" },
  ],
  incidents_count: [
    { label: "Incidentes", href: "/incidents" },
    { label: "Programa ALARA", href: "/alara" },
  ],
  license_expired: [
    { label: "Licencias de operación CCHEN", href: "/operating-licenses" },
    { label: "Autorizaciones CCHEN", href: "/licenses" },
  ],
  vendors_cchen_expired: [
    { label: "Proveedores de servicio", href: "/service-providers" },
  ],
  area_monitoring_monthly: [
    { label: "Monitoreo de área", href: "/area-monitoring" },
    { label: "Monitoreo ambiental", href: "/environmental-monitoring" },
  ],
};

// Action plan suggestions per status
const ACTION_SUGGESTIONS: Record<string, Record<string, string>> = {
  avg_dose_poe: {
    yellow: "Revisar distribución de trabajos con alta carga radiactiva. Aplicar medidas ALARA adicionales.",
    red: "Iniciar investigación inmediata. Revisar procedimientos, EPP y redistribución de tareas. Generar CAPA.",
  },
  poe_over_15msv: {
    yellow: "Iniciar seguimiento individual a los trabajadores afectados. Evaluar rotación de personal.",
    red: "Notificar al Comité PR. Restricción inmediata de tareas con exposición hasta normalizar. Generar CAPA.",
  },
  dosimetry_coverage: {
    yellow: "Identificar trabajadores POE sin registro y coordinar entrega de dosímetros.",
    red: "Revisar padrón de trabajadores POE activos y programa de dosimetría. Gestionar urgentemente.",
  },
  instrument_calibration: {
    yellow: "Programar calibración de instrumentos próximos a vencer.",
    red: "Retirar de servicio los instrumentos vencidos. Coordinar calibración prioritaria.",
  },
  training_coverage: {
    yellow: "Programar jornadas de capacitación para los trabajadores faltantes antes del cierre del año.",
    red: "Revisar plan anual de capacitación. Generar plan de recuperación urgente.",
  },
  committee_sessions: {
    yellow: "Programar las sesiones faltantes antes del cierre del año.",
    red: "Convocar sesión de Comité PR extraordinaria. Reprogramar la agenda anual.",
  },
  open_capa: {
    yellow: "Revisar CAPA abiertas y actualizar estado. Verificar acciones correctivas en curso.",
    red: "CAPA con plazo vencido requieren cierre inmediato o justificación documentada.",
  },
  docs_overdue: {
    yellow: "Programar revisión de los documentos vencidos en las próximas 2 semanas.",
    red: "Revisión urgente de documentos. Actualizar o declarar obsoletos según corresponda.",
  },
  incidents_count: {
    yellow: "Revisar causas raíz de los incidentes ocurridos. Verificar acciones correctivas.",
    red: "Análisis tendencial de incidentes. Revisar programa preventivo completo. Generar informe al Comité.",
  },
  license_expired: {
    yellow: "Iniciar proceso de renovación de licencias vencidas ante CCHEN.",
    red: "Detener actividades no autorizadas. Gestionar renovación urgente ante CCHEN.",
  },
  vendors_cchen_expired: {
    yellow: "Solicitar a proveedores la renovación de su autorización CCHEN.",
    red: "Suspender contratos con proveedores sin autorización vigente hasta regularizar.",
  },
  area_monitoring_monthly: {
    yellow: "Programar los monitoreos faltantes antes del cierre del mes.",
    red: "Revisar programa de monitoreo de área. Reactivar rutinas periódicas.",
  },
};

// ── helpers ─────────────────────────────────────────────────────────────────
function fmtVal(val: number, unit: string): string {
  if (unit === "%") return `${val.toFixed(1)}%`;
  if (unit === "mSv/año") return `${val.toFixed(2)} mSv/año`;
  return `${val} ${unit}`;
}

function TrendIcon({ trend, lowerBetter }: { trend: string; lowerBetter: boolean }) {
  if (trend === "stable") return <Minus className="h-4 w-4 text-muted-foreground" />;
  const isGood = (trend === "down" && lowerBetter) || (trend === "up" && !lowerBetter);
  if (trend === "up")
    return <TrendingUp className={`h-4 w-4 ${isGood ? "text-emerald-600" : "text-red-500"}`} />;
  return <TrendingDown className={`h-4 w-4 ${isGood ? "text-emerald-600" : "text-red-500"}`} />;
}

function ProgressBar({ value, target, direction }: { value: number; target: number; direction: string }) {
  const max = direction === "higher_better" ? Math.max(target * 1.2, value * 1.1) : Math.max(target * 2, value * 1.5, 10);
  const pct = Math.min((value / max) * 100, 100);
  const targetPct = Math.min((target / max) * 100, 100);
  let barColor = "bg-emerald-500";
  if (direction === "lower_better") {
    barColor = value <= target ? "bg-emerald-500" : value <= target * 1.5 ? "bg-amber-400" : "bg-red-500";
  } else {
    barColor = value >= target ? "bg-emerald-500" : value >= target * 0.6 ? "bg-amber-400" : "bg-red-500";
  }
  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      {/* Target line */}
      <div
        className="absolute top-[-3px] h-[8px] w-[2px] bg-foreground/40 rounded-full"
        style={{ left: `${targetPct}%` }}
        title={`Meta: ${target}`}
      />
    </div>
  );
}

// ── IndicatorCard ────────────────────────────────────────────────────────────
function IndicatorCard({ ind }: { ind: Indicator }) {
  const [expanded, setExpanded] = useState(ind.status !== "green");
  const cfg = STATUS_CONFIG[ind.status];
  const Icon = cfg.icon;
  const lowerBetter = ind.target_direction === "lower_better";
  const links = INDICATOR_LINKS[ind.id] ?? [];
  const suggestion = ACTION_SUGGESTIONS[ind.id]?.[ind.status];
  const delta = ind.previous_value !== undefined ? ind.current_value - ind.previous_value : null;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* Header row */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={`mt-0.5 shrink-0 ${cfg.iconColor}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{ind.name}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{ind.description}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2 ml-2">
          <div className="text-right">
            <p className="text-lg font-bold leading-none">{fmtVal(ind.current_value, ind.unit)}</p>
            {delta !== null && (
              <p className={`text-[11px] mt-0.5 ${delta === 0 ? "text-muted-foreground" : delta > 0 === lowerBetter ? "text-red-500" : "text-emerald-600"}`}>
                {delta > 0 ? "+" : ""}{fmtVal(delta, ind.unit)} vs año ant.
              </p>
            )}
          </div>
          <TrendIcon trend={ind.trend} lowerBetter={lowerBetter} />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-current/10 px-4 py-3 flex flex-col gap-3">
          {/* Progress bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Valor actual: <strong className="text-foreground">{fmtVal(ind.current_value, ind.unit)}</strong></span>
              <span>Meta: <strong className="text-foreground">{fmtVal(ind.target, ind.unit)}</strong></span>
            </div>
            <ProgressBar value={ind.current_value} target={ind.target} direction={ind.target_direction} />
          </div>

          {/* Previous year comparison */}
          {ind.previous_value !== undefined && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Año anterior: <strong className="text-foreground">{fmtVal(ind.previous_value, ind.unit)}</strong></span>
              <span>·</span>
              <span>
                Variación:{" "}
                <strong className={delta === null || delta === 0 ? "text-foreground" : delta > 0 === lowerBetter ? "text-red-500" : "text-emerald-600"}>
                  {delta === null || delta === 0 ? "sin cambio" : `${delta > 0 ? "+" : ""}${fmtVal(delta, ind.unit)}`}
                </strong>
              </span>
            </div>
          )}

          {/* Regulatory reference */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{ind.ns_reference}</span>
          </div>

          {/* Action suggestion if not green */}
          {suggestion && (
            <div className={`rounded-md border px-3 py-2 text-xs ${
              ind.status === "red"
                ? "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
            }`}>
              <p className="font-semibold mb-0.5 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                Acción recomendada
              </p>
              <p>{suggestion}</p>
            </div>
          )}

          {/* Module links */}
          {links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted hover:border-accent transition-colors"
                >
                  {l.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SummaryRow ────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

// ── CategorySection ────────────────────────────────────────────────────────
function CategorySection({
  category,
  indicators,
}: {
  category: string;
  indicators: Indicator[];
}) {
  const green = indicators.filter((i) => i.status === "green").length;
  const red = indicators.filter((i) => i.status === "red").length;
  const yellow = indicators.filter((i) => i.status === "yellow").length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{category}</h2>
        <div className="flex items-center gap-1">
          {green > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              {green}
            </span>
          )}
          {yellow > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
              {yellow}
            </span>
          )}
          {red > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
              {red}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {indicators.map((ind) => (
          <IndicatorCard key={ind.id} ind={ind} />
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function IndicatorsPage() {
  const [data, setData] = useState<IndicatorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"" | "green" | "yellow" | "red">("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/indicators");
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter logic
  const allIndicators = data?.indicators ?? [];
  const filtered = allIndicators
    .filter((i) => !filterCat || i.category === filterCat)
    .filter((i) => !filterStatus || i.status === filterStatus);

  // Group by category for cards view
  const categoriesInView = [...new Set(filtered.map((i) => i.category))];
  const categories = data?.categories ?? [];

  const s = data?.summary ?? { total: 0, green: 0, yellow: 0, red: 0, score: 0 };

  // Print handler
  function handlePrint() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* ── Header ── */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Indicadores de Desempeño PR
          </h1>
          <p className="text-xs text-muted-foreground">
            KPIs del Programa de Protección Radiológica — NS-06.0 §8.4 · Hospital Dr. Hernán Henríquez Aravena
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Score global ── */}
      <div
        className={`mb-4 rounded-lg border px-5 py-4 flex items-center gap-5 ${
          s.score >= 80
            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20"
            : s.score >= 60
            ? "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20"
            : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20"
        }`}
      >
        {/* Score number */}
        <div className="text-center shrink-0 w-16">
          <p
            className={`text-4xl font-bold ${
              s.score >= 80 ? "text-emerald-700" : s.score >= 60 ? "text-amber-600" : "text-red-600"
            }`}
          >
            {s.score}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Score global</p>
        </div>

        {/* Bar + legend */}
        <div className="flex-1 min-w-0">
          <ScoreBar score={s.score} />
          <div className="mt-2 flex gap-4 text-xs flex-wrap">
            <button
              onClick={() => setFilterStatus(filterStatus === "green" ? "" : "green")}
              className={`flex items-center gap-1.5 transition-opacity ${filterStatus && filterStatus !== "green" ? "opacity-40" : ""}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-emerald-700 dark:text-emerald-400">{s.green} conforme{s.green !== 1 ? "s" : ""}</span>
            </button>
            <button
              onClick={() => setFilterStatus(filterStatus === "yellow" ? "" : "yellow")}
              className={`flex items-center gap-1.5 transition-opacity ${filterStatus && filterStatus !== "yellow" ? "opacity-40" : ""}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
              <span className="text-amber-700 dark:text-amber-400">{s.yellow} en alerta</span>
            </button>
            <button
              onClick={() => setFilterStatus(filterStatus === "red" ? "" : "red")}
              className={`flex items-center gap-1.5 transition-opacity ${filterStatus && filterStatus !== "red" ? "opacity-40" : ""}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
              <span className="text-red-700 dark:text-red-400">{s.red} no conforme{s.red !== 1 ? "s" : ""}</span>
            </button>
          </div>
        </div>

        {/* Meta info */}
        <div className="shrink-0 text-xs text-muted-foreground text-right hidden sm:block">
          <p className="flex items-center gap-1 justify-end">
            <Activity className="h-3.5 w-3.5" />
            {s.total} indicadores
          </p>
          {data?.computed_at && (
            <p className="mt-0.5">
              Calculado:{" "}
              {new Date(data.computed_at).toLocaleTimeString("es-CL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      {/* ── Critical alert banner ── */}
      {s.red > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2 text-sm dark:border-red-800 dark:bg-red-950/20">
          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-red-700 dark:text-red-400">
            {s.red} indicador{s.red !== 1 ? "es" : ""} no conforme{s.red !== 1 ? "s" : ""} — requieren acción correctiva.{" "}
            <Link href="/capa" className="underline hover:no-underline font-medium">
              Generar CAPA
            </Link>
            {" · "}
            <Link href="/improvement-plans" className="underline hover:no-underline font-medium">
              Plan de mejora
            </Link>
          </span>
        </div>
      )}

      {/* ── Filters bar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterCat("")}
            className={`rounded-full px-3 py-1 text-xs border transition-colors ${
              !filterCat
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border hover:bg-muted"
            }`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(filterCat === c ? "" : c)}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                filterCat === c
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            onClick={() => setViewMode("cards")}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              viewMode === "cards" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            }`}
          >
            Tarjetas
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              viewMode === "table" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            }`}
          >
            Tabla
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : viewMode === "cards" ? (
        /* Cards view — grouped by category */
        <div className="flex flex-col gap-6">
          {categoriesInView.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              indicators={filtered.filter((i) => i.category === cat)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay indicadores con los filtros aplicados.
            </p>
          )}
        </div>
      ) : (
        /* Table view */
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Indicador</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Meta</th>
                <th className="px-3 py-2 text-right">Año ant.</th>
                <th className="px-3 py-2">Tendencia</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((ind) => {
                const cfg = STATUS_CONFIG[ind.status];
                const lowerBetter = ind.target_direction === "lower_better";
                return (
                  <tr key={ind.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{ind.category}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{ind.name}</p>
                      <p className="text-xs text-muted-foreground">{ind.description}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmtVal(ind.current_value, ind.unit)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtVal(ind.target, ind.unit)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {ind.previous_value !== undefined ? fmtVal(ind.previous_value, ind.unit) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <TrendIcon trend={ind.trend} lowerBetter={lowerBetter} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px]">{ind.ns_reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Info panel ── */}
      <div className="mt-6 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Interpretación del Score Global
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            ≥ 80% — Programa en cumplimiento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            60–79% — Acciones de mejora requeridas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            &lt; 60% — Revisión integral del programa
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Los indicadores son calculados en tiempo real desde los registros operacionales del sistema.
          Los valores verde y en alerta aportan 100% y 60% al score respectivamente.
          Haga clic en el nombre de un indicador para ver su detalle, meta y módulo relacionado.
        </p>
      </div>

      {/* ── Action buttons ── */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/capa"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          CAPA — No conformidades
        </Link>
        <Link
          href="/improvement-plans"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Planes de mejora PR
        </Link>
        <Link
          href="/management-report"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          <FileText className="h-3.5 w-3.5" />
          Informe de gestión
        </Link>
        <Link
          href="/alara"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          <Activity className="h-3.5 w-3.5" />
          Programa ALARA
        </Link>
        <Link
          href="/annual-report"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Informe anual integrado
        </Link>
      </div>

      {/* ── Regulatory footer ── */}
      <div className="mt-6 rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground print:mt-4">
        <p className="font-semibold text-foreground mb-1">Base normativa</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>NS-06.0 §8.4 — Indicadores de Desempeño PR</span>
          <span>DS 3/1985 Arts. 8, 10, 42 — Protección Radiológica</span>
          <span>IAEA GSG-7 — Radiation Protection Programme</span>
          <span>OIEA SSG-26 — Radiological Protection Programme</span>
        </div>
        <p className="mt-1.5">
          Los indicadores de desempeño son calculados automáticamente desde los registros del sistema RPMS.
          Para modificar metas o añadir indicadores personalizados, coordinar con el Encargado de Protección Radiológica.
        </p>
      </div>
    </div>
  );
}
