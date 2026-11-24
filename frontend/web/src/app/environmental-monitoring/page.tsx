"use client";

export const dynamic = "force-dynamic";

// §156 — Monitoreo Ambiental Externo / Perimetral
// DS 3/1985 Arts. 38-42 · CCHEN NS-05.0 §8 · IAEA GSR Part 3 Req. 27
// Límite público: 1 mSv/año = 0.114 µSv/h continuo equivalente

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Activity, AlertTriangle, CheckCircle2,
  Plus, X, RefreshCw, ChevronDown, ChevronUp,
  Radiation, Wind, Droplets, Leaf, Clock, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonitoringPoint {
  id: number;
  point_code: string;
  name: string;
  location: string | null;
  point_type: string;
  baseline_usvh: number | null;
  alert_threshold_usvh: number;
  action_threshold_usvh: number;
  frequency: string;
  latest_rate: number | null;
  latest_cumul: number | null;
  latest_reading_date: string | null;
  latest_anomaly: boolean | null;
  days_since_reading: number | null;
  alarm_level: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  perimeter:       { label: "Perímetro",          icon: MapPin,     color: "text-teal-700 bg-teal-50 border-teal-200" },
  public_area:     { label: "Área pública",        icon: Activity,   color: "text-blue-700 bg-blue-50 border-blue-200" },
  effluent_air:    { label: "Efluente aéreo",      icon: Wind,       color: "text-sky-700 bg-sky-50 border-sky-200" },
  effluent_liquid: { label: "Efluente líquido",    icon: Droplets,   color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  soil:            { label: "Suelo",               icon: Leaf,       color: "text-green-700 bg-green-50 border-green-200" },
  vegetation:      { label: "Vegetación",          icon: Leaf,       color: "text-lime-700 bg-lime-50 border-lime-200" },
};

const ALARM_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  normal: { label: "Normal", cls: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle2 },
  alert:  { label: "Alerta", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: AlertTriangle },
  action: { label: "Acción", cls: "bg-red-100  text-red-800   border-red-300",   icon: Radiation },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function RateBar({ rate, alert, action, baseline }: { rate: number | null; alert: number; action: number; baseline: number | null }) {
  if (rate === null) return <div className="text-xs text-muted-foreground">Sin lecturas</div>;
  const max = action * 1.2;
  const pct = Math.min((rate / max) * 100, 100);
  const color = rate >= action ? "bg-red-500" : rate >= alert ? "bg-amber-500" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold">{Number(rate).toFixed(3)} µSv/h</span>
        <span className="text-muted-foreground">
          {baseline !== null ? `Línea base: ${Number(baseline).toFixed(3)}` : ""}
        </span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
        {/* Alert threshold marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500/80" style={{ left: `${(alert / max) * 100}%` }} />
        {/* Action threshold marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80" style={{ left: `${(action / max) * 100}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0</span>
        <span className="text-amber-600">Alerta: {alert}</span>
        <span className="text-red-600">Acción: {action}</span>
        <span>{max.toFixed(1)} µSv/h</span>
      </div>
    </div>
  );
}

// ─── Point Card ───────────────────────────────────────────────────────────────

function PointCard({ point, onRefresh }: { point: MonitoringPoint; onRefresh: () => void }) {
  const [open, setOpen] = useState(point.alarm_level !== "normal");
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [reading, setReading] = useState({ dose_rate_usvh: "", reading_date: new Date().toISOString().split("T")[0], measured_by: "", weather: "", anomaly: false, anomaly_note: "" });
  const [saving, setSaving] = useState(false);

  const typeCfg  = TYPE_CONFIG[point.point_type] ?? TYPE_CONFIG.perimeter;
  const alarmCfg = ALARM_CONFIG[point.alarm_level] ?? ALARM_CONFIG.normal;
  const TypeIcon  = typeCfg.icon;
  const AlarmIcon = alarmCfg.icon;

  const overdue = point.days_since_reading !== null && point.days_since_reading > (
    point.frequency === "daily" ? 2 : point.frequency === "weekly" ? 10 : 35
  );

  const saveReading = async () => {
    if (!reading.dose_rate_usvh) return;
    setSaving(true);
    await fetch("/api/environmental-monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        point_id: point.id,
        ...reading,
        dose_rate_usvh: Number(reading.dose_rate_usvh),
        anomaly: reading.anomaly,
        anomaly_note: reading.anomaly_note || null,
        measured_by: reading.measured_by || null,
        weather: reading.weather || null,
      }),
    });
    setSaving(false);
    setShowReadingForm(false);
    onRefresh();
  };

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden",
      point.alarm_level === "action" ? "border-red-300" :
      point.alarm_level === "alert"  ? "border-amber-300" : ""
    )}>
      <div className="p-4 flex items-start gap-3">
        <div className={cn("rounded-lg border p-2 flex-shrink-0", typeCfg.color)}>
          <TypeIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{point.name}</p>
              <p className="text-xs text-muted-foreground">{point.point_code} · {point.location ?? "—"}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", typeCfg.color)}>
                {typeCfg.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", alarmCfg.cls)}>
                <AlarmIcon className="w-3 h-3" /> {alarmCfg.label}
              </span>
            </div>
          </div>

          <div className="mt-2">
            <RateBar
              rate={point.latest_rate}
              alert={Number(point.alert_threshold_usvh)}
              action={Number(point.action_threshold_usvh)}
              baseline={point.baseline_usvh}
            />
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Última lectura: {fmtDate(point.latest_reading_date)}</span>
            {point.days_since_reading !== null && (
              <span className={overdue ? "text-amber-600 font-medium" : ""}>
                {overdue ? `⚠ Vencida (${point.days_since_reading}d sin lectura)` : `Hace ${point.days_since_reading}d`}
              </span>
            )}
            <span className="capitalize">Freq: {point.frequency}</span>
          </div>
        </div>

        <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground ml-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Action level alert */}
          {point.alarm_level === "action" && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
              <Radiation className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-800">NIVEL DE ACCIÓN SUPERADO</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Tasa de dosis {Number(point.latest_rate).toFixed(3)} µSv/h supera el umbral de acción ({Number(point.action_threshold_usvh).toFixed(1)} µSv/h).
                  Investigar fuente, notificar al Encargado PR, registrar en bitácora. DS 3/1985 Art. 42.
                </p>
              </div>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Umbral alerta</p>
              <p className="font-medium text-amber-700">{Number(point.alert_threshold_usvh).toFixed(2)} µSv/h</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Umbral acción</p>
              <p className="font-medium text-red-700">{Number(point.action_threshold_usvh).toFixed(2)} µSv/h</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Línea base</p>
              <p className="font-medium">{point.baseline_usvh != null ? `${Number(point.baseline_usvh).toFixed(3)} µSv/h` : "—"}</p>
            </div>
          </div>

          {/* Register reading button */}
          {!showReadingForm ? (
            <button
              onClick={() => setShowReadingForm(true)}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
            >
              <Plus className="w-3 h-3" /> Registrar nueva lectura
            </button>
          ) : (
            <div className="bg-muted/40 rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold">Nueva lectura — {point.point_code}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-muted-foreground">Tasa de dosis (µSv/h) *</label>
                  <input type="number" step="0.001" className="w-full border rounded px-2 py-1 mt-0.5"
                    value={reading.dose_rate_usvh} onChange={e => setReading(r => ({ ...r, dose_rate_usvh: e.target.value }))} />
                </div>
                <div>
                  <label className="text-muted-foreground">Fecha *</label>
                  <input type="date" className="w-full border rounded px-2 py-1 mt-0.5"
                    value={reading.reading_date} onChange={e => setReading(r => ({ ...r, reading_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-muted-foreground">Medido por</label>
                  <input className="w-full border rounded px-2 py-1 mt-0.5"
                    value={reading.measured_by} onChange={e => setReading(r => ({ ...r, measured_by: e.target.value }))} />
                </div>
                <div>
                  <label className="text-muted-foreground">Condiciones climáticas</label>
                  <input className="w-full border rounded px-2 py-1 mt-0.5" placeholder="Despejado / Lluvia"
                    value={reading.weather} onChange={e => setReading(r => ({ ...r, weather: e.target.value }))} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id={`anom-${point.id}`}
                    checked={reading.anomaly} onChange={e => setReading(r => ({ ...r, anomaly: e.target.checked }))} />
                  <label htmlFor={`anom-${point.id}`} className="text-muted-foreground">Anomalía detectada</label>
                </div>
                {reading.anomaly && (
                  <div className="col-span-2">
                    <label className="text-muted-foreground">Descripción de la anomalía</label>
                    <input className="w-full border rounded px-2 py-1 mt-0.5"
                      value={reading.anomaly_note} onChange={e => setReading(r => ({ ...r, anomaly_note: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveReading} disabled={saving || !reading.dose_rate_usvh}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Guardando…" : "Guardar lectura"}
                </button>
                <button onClick={() => setShowReadingForm(false)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnvironmentalMonitoringPage() {
  const [points, setPoints] = useState<MonitoringPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/environmental-monitoring");
    const d = await r.json();
    setPoints(d.points ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterType ? points.filter(p => p.point_type === filterType) : points;
  const actionCount = points.filter(p => p.alarm_level === "action").length;
  const alertCount  = points.filter(p => p.alarm_level === "alert").length;
  const overdueCount = points.filter(p => {
    if (!p.days_since_reading) return false;
    const max = p.frequency === "daily" ? 2 : p.frequency === "weekly" ? 10 : 35;
    return p.days_since_reading > max;
  }).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-teal-600" />
            Monitoreo Ambiental Externo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §156 — Vigilancia perimetral y zonas no controladas · DS 3/1985 Arts. 38-42 · IAEA GSR Part 3 Req. 27
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Límite anual público: 1 mSv/año ≈ 0.114 µSv/h continuo</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border hover:bg-muted text-muted-foreground">
          <RefreshCw className={cn("w-4 h-4", loading ? "animate-spin" : "")} />
        </button>
      </div>

      {/* Critical banner */}
      {!loading && (actionCount > 0 || alertCount > 0) && (
        <div className={cn(
          "rounded-xl border p-4 flex items-start gap-3",
          actionCount > 0 ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"
        )}>
          <Radiation className={cn("w-5 h-5 mt-0.5 flex-shrink-0", actionCount > 0 ? "text-red-600" : "text-amber-600")} />
          <div>
            <p className={cn("font-semibold text-sm", actionCount > 0 ? "text-red-800" : "text-amber-800")}>
              {actionCount > 0
                ? `${actionCount} punto(s) en NIVEL DE ACCIÓN — Investigación inmediata requerida`
                : `${alertCount} punto(s) en nivel de alerta — Revisión requerida`}
            </p>
            <p className={cn("text-xs mt-0.5", actionCount > 0 ? "text-red-700" : "text-amber-700")}>
              Verificar fuentes radiactivas, notificar Encargado PR, registrar en bitácora (DS 3/1985 Art. 42).
            </p>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Puntos activos",    value: points.length,    color: "text-teal-700 bg-teal-50 border-teal-200",   icon: MapPin },
          { label: "En nivel alerta",   value: alertCount,       color: alertCount > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200", icon: AlertTriangle },
          { label: "En nivel acción",   value: actionCount,      color: actionCount > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200", icon: Radiation },
          { label: "Lecturas vencidas", value: overdueCount,     color: overdueCount > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200", icon: Clock },
        ].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <div key={i} className={cn("rounded-xl border p-4 flex items-center gap-3", tile.color)}>
              <Icon className="w-5 h-5 opacity-70 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium opacity-70">{tile.label}</p>
                <p className="text-2xl font-bold leading-tight">{loading ? "…" : tile.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <select className="border rounded-lg px-3 py-2 text-sm bg-background"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Points list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-10 text-center">
          <MapPin className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay puntos de monitoreo configurados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => <PointCard key={p.id} point={p} onRefresh={load} />)}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="rounded-xl border bg-blue-50/50 p-5 text-xs text-blue-900 space-y-2">
        <p className="font-semibold flex items-center gap-1.5 text-sm">
          <FileText className="w-4 h-4" /> Marco Regulatorio — Monitoreo Ambiental
        </p>
        <p><strong>DS 3/1985 Arts. 38-42:</strong> Las instalaciones con fuentes de radiación deben establecer un programa de monitoreo ambiental que incluya puntos de medición en el perímetro de la instalación y en zonas accesibles al público.</p>
        <p><strong>DS 3/1985 Art. 10:</strong> El límite de dosis efectiva para miembros del público es de 1 mSv/año adicional a la radiación de fondo. Para fuentes individuales: 0.3 mSv/año en diseño.</p>
        <p><strong>IAEA GSR Part 3 Req. 27:</strong> El titular debe establecer niveles de investigación y de acción para el programa de monitoreo ambiental, basados en las restricciones de dosis aplicables al público.</p>
        <p><strong>Niveles de referencia CCHEN NS-05.0 §8:</strong> Nivel de alerta: 0.5 µSv/h (zona perimetral); Nivel de acción: 1.0 µSv/h. Para áreas públicas internas: alerta 0.75 µSv/h, acción 1.5 µSv/h.</p>
      </div>
    </div>
  );
}
