"use client";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Indicator {
  id: string; category: string; name: string; description: string;
  unit: string; target: number; target_direction: "lower_better"|"higher_better"|"range";
  target_min?: number; target_max?: number;
  current_value: number; previous_value?: number;
  trend: "up"|"down"|"stable";
  status: "green"|"yellow"|"red";
  ns_reference: string;
}
interface Summary { total:number; green:number; yellow:number; red:number; score:number; }

// ── helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  green:  { bg:"bg-emerald-50",  border:"border-emerald-200", icon: CheckCircle2, iconColor:"text-emerald-600", label:"Conforme" },
  yellow: { bg:"bg-amber-50",    border:"border-amber-200",   icon: AlertTriangle, iconColor:"text-amber-600", label:"Alerta" },
  red:    { bg:"bg-red-50",      border:"border-red-200",     icon: XCircle,       iconColor:"text-red-600", label:"No conforme" },
};

function TrendIcon({ trend, lowerBetter }: { trend: string; lowerBetter: boolean }) {
  if (trend === "stable") return <Minus className="h-4 w-4 text-muted-foreground"/>;
  const isGood = (trend === "down" && lowerBetter) || (trend === "up" && !lowerBetter);
  return trend === "up"
    ? <TrendingUp className={`h-4 w-4 ${isGood ? "text-emerald-600" : "text-red-500"}`}/>
    : <TrendingDown className={`h-4 w-4 ${isGood ? "text-emerald-600" : "text-red-500"}`}/>;
}

function formatValue(val: number, unit: string): string {
  if (unit === "%") return `${val}%`;
  if (unit === "mSv/año") return `${val.toFixed(2)} mSv`;
  return `${val} ${unit}`;
}

function TargetBar({ ind }: { ind: Indicator }) {
  const { current_value: v, target: t, target_direction: dir } = ind;
  let pct = 0;
  if (dir === "higher_better") pct = t > 0 ? Math.min(v / t * 100, 100) : (v > 0 ? 100 : 0);
  else if (dir === "lower_better") pct = t > 0 ? Math.min((t - Math.min(v, t)) / t * 100, 100) : (v === 0 ? 100 : 0);

  const color = ind.status === "green" ? "bg-emerald-500" : ind.status === "yellow" ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>Actual: <strong className="text-foreground">{formatValue(v, ind.unit)}</strong></span>
        <span>Meta: {dir === "lower_better" ? "≤" : "≥"}{formatValue(t, ind.unit)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{width:`${pct}%`}}/>
      </div>
    </div>
  );
}

function IndicatorCard({ ind }: { ind: Indicator }) {
  const cfg = STATUS_CONFIG[ind.status];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`}/>
            <p className="text-xs font-semibold leading-tight truncate">{ind.name}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{ind.description}</p>
        </div>
        <TrendIcon trend={ind.trend} lowerBetter={ind.target_direction === "lower_better"}/>
      </div>
      <TargetBar ind={ind}/>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-[10px] font-medium ${cfg.iconColor}`}>{cfg.label}</span>
        <span className="text-[10px] text-muted-foreground">{ind.ns_reference}</span>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function IndicatorsPage() {
  const [data, setData]       = useState<{ indicators: Indicator[]; categories: string[]; summary: Summary; computed_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/indicators");
    const d = await r.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const indicators = (data?.indicators ?? []).filter(i => !filterCat || i.category === filterCat);
  const categories = data?.categories ?? [];
  const s = data?.summary ?? { total:0, green:0, yellow:0, red:0, score:0 };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent"/>Indicadores de Desempeño PR
          </h1>
          <p className="text-sm text-muted-foreground">
            KPIs del Programa de Protección Radiológica — NS-06.0 §8.4 · Hospital Dr. Hernán Henríquez Aravena
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>Actualizar
        </button>
      </div>

      {/* Score global */}
      <div className={`rounded-lg border px-5 py-4 flex items-center gap-5 ${
        s.score >= 80 ? "border-emerald-200 bg-emerald-50/50" :
        s.score >= 60 ? "border-amber-200 bg-amber-50/50" : "border-red-200 bg-red-50/50"}`}>
        <div className="text-center shrink-0">
          <p className={`text-4xl font-bold ${s.score >= 80 ? "text-emerald-700" : s.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
            {s.score}%
          </p>
          <p className="text-xs text-muted-foreground">Score global</p>
        </div>
        <div className="flex-1">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${s.score >= 80 ? "bg-emerald-500" : s.score >= 60 ? "bg-amber-400" : "bg-red-500"}`}
              style={{width:`${s.score}%`}}/>
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"/>
              {s.green} conformes
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block"/>
              {s.yellow} en alerta
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block"/>
              {s.red} no conformes
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 text-right">
          <p>{s.total} indicadores</p>
          {data?.computed_at && (
            <p>Actualizado: {new Date(data.computed_at).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</p>
          )}
        </div>
      </div>

      {/* Alertas críticas */}
      {s.red > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2 text-sm">
          <XCircle className="h-4 w-4 text-red-600 shrink-0"/>
          <span className="text-red-700">{s.red} indicador(es) no conforme(s) — requieren acción correctiva inmediata</span>
        </div>
      )}

      {/* Filtro por categoría */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilterCat("")}
          className={`rounded-full px-3 py-1 text-xs border ${!filterCat ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}>
          Todas
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`rounded-full px-3 py-1 text-xs border ${filterCat===c ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Grid de indicadores */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full"/>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {indicators.map(ind => <IndicatorCard key={ind.id} ind={ind}/>)}
        </div>
      )}

      {/* Referencia normativa */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">Base normativa NS-06.0 §8.4 — Indicadores de Desempeño</p>
        <p>Los indicadores de desempeño del Programa de Protección Radiológica deben monitorearse periódicamente para evaluar la eficacia
        del programa. Los valores se calculan en tiempo real desde los registros operacionales del sistema.
        Un score ≥ 80% indica un programa en cumplimiento; 60–79% requiere acciones de mejora; &lt; 60% requiere revisión integral del programa.</p>
      </div>
    </div>
  );
}
