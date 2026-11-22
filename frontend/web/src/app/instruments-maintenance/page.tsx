"use client";

export const dynamic = "force-dynamic";

// §90 — Calibraciones Externas y Mantenciones de Instrumentos
// Normativa: DS 3/1985 Art. 28 · NS-06.0 §8.3 · IAEA Safety Reports No. 16
// IAEA-TECDOC-1040 · NCh-ISO 17025 · NMX-CC-9001-IMNC-2015

import { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Building2,
  FileText,
  TrendingUp,
  AlertCircle,
  Info,
} from "lucide-react";

// ─────────────── Types ───────────────────────────────────────────────────────

interface CalibrationInstrument {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  service: string | null;
  unit: string | null;
  instrument_status: string | null;
  calibration_frequency_months: number | null;
  last_calibration_date: string | null;
  expiry_date: string | null;
  certificate_number: string | null;
  calibration_company: string | null;
  total_calibrations: number;
  cal_status: "vigente" | "proximo" | "por_vencer" | "vencida" | "sin_calibrar";
  days_to_expiry: number | null;
}

interface MaintenanceInstrument {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  service: string | null;
  unit: string | null;
  instrument_status: string | null;
  maintenance_frequency_months: number | null;
  last_maintenance_date: string | null;
  last_maintenance_type: string | null;
  last_company: string | null;
  next_maintenance_date: string | null;
  next_date_computed: string | null;
  total_maintenances: number;
  cost_this_year: number | null;
  maint_status: "al_dia" | "proximo" | "urgente" | "vencido" | "sin_mantenimiento";
  days_to_next: number | null;
}

interface CalStats {
  total: number;
  vigente: number;
  por_vencer: number;
  proximo: number;
  vencida: number;
  sin_calibrar: number;
}

interface MaintStats {
  total: number;
  al_dia: number;
  proximo: number;
  urgente: number;
  vencido: number;
  sin_mantenimiento: number;
  cost_year: number;
}

// ─────────────── Helpers ─────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtCLP(n: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

// ─────────────── Status Badges ───────────────────────────────────────────────

function CalBadge({ status, days }: { status: CalibrationInstrument["cal_status"]; days: number | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    vigente:     { label: "Vigente",        cls: "bg-green-100 text-green-800 border-green-300" },
    proximo:     { label: "Próx. 90d",      cls: "bg-blue-100 text-blue-800 border-blue-300" },
    por_vencer:  { label: "Por vencer 30d", cls: "bg-orange-100 text-orange-800 border-orange-300" },
    vencida:     { label: "VENCIDA",        cls: "bg-red-100 text-red-800 border-red-300" },
    sin_calibrar:{ label: "Sin calibrar",   cls: "bg-gray-100 text-gray-700 border-gray-300" },
  };
  const { label, cls } = map[status] ?? map["sin_calibrar"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>
      {label}
      {days !== null && (status === "por_vencer" || status === "proximo") && (
        <span className="opacity-70">({days}d)</span>
      )}
      {days !== null && status === "vencida" && (
        <span className="opacity-80">({Math.abs(days)}d)</span>
      )}
    </span>
  );
}

function MaintBadge({ status, days }: { status: MaintenanceInstrument["maint_status"]; days: number | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    al_dia:          { label: "Al día",          cls: "bg-green-100 text-green-800 border-green-300" },
    proximo:         { label: "Próx. 90d",        cls: "bg-blue-100 text-blue-800 border-blue-300" },
    urgente:         { label: "Urgente 30d",      cls: "bg-orange-100 text-orange-800 border-orange-300" },
    vencido:         { label: "VENCIDO",          cls: "bg-red-100 text-red-800 border-red-300" },
    sin_mantenimiento:{ label: "Sin mantención", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  };
  const { label, cls } = map[status] ?? map["sin_mantenimiento"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>
      {label}
      {days !== null && (status === "urgente" || status === "proximo") && (
        <span className="opacity-70">({days}d)</span>
      )}
      {days !== null && status === "vencido" && (
        <span className="opacity-80">({Math.abs(days)}d)</span>
      )}
    </span>
  );
}

// ─────────────── KPI Tile ────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${color}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0 opacity-70" />
      <div>
        <p className="text-xs font-medium opacity-70 leading-tight">{label}</p>
        <p className="text-xl font-bold leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─────────────── Calibration Card ────────────────────────────────────────────

function CalibrationCard({ inst }: { inst: CalibrationInstrument }) {
  const autoExpand = inst.cal_status === "vencida" || inst.cal_status === "por_vencer";
  const [open, setOpen] = useState(autoExpand);

  const isAlert = inst.cal_status === "vencida";
  const isWarn  = inst.cal_status === "por_vencer";

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm transition-all ${
        isAlert ? "border-red-300 bg-red-50/40" : isWarn ? "border-orange-300 bg-orange-50/30" : ""
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FlaskConical className={`w-5 h-5 shrink-0 ${isAlert ? "text-red-500" : isWarn ? "text-orange-500" : "text-blue-500"}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{inst.name}</span>
              {inst.code && <span className="text-xs text-muted-foreground font-mono">{inst.code}</span>}
              <CalBadge status={inst.cal_status} days={inst.days_to_expiry} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[inst.brand, inst.model].filter(Boolean).join(" · ")}
              {inst.service && ` · ${inst.service}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {inst.expiry_date && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Vence: {fmtDate(inst.expiry_date)}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t px-4 pb-4 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Última calibración</p>
            <p className="font-medium">{fmtDate(inst.last_calibration_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vencimiento</p>
            <p className={`font-medium ${isAlert ? "text-red-600 font-bold" : isWarn ? "text-orange-600 font-semibold" : ""}`}>
              {fmtDate(inst.expiry_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N° Certificado</p>
            <p className="font-medium font-mono">{inst.certificate_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Empresa calibradora</p>
            <p className="font-medium">{inst.calibration_company || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N° de serie</p>
            <p className="font-medium font-mono">{inst.serial_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Frecuencia</p>
            <p className="font-medium">
              {inst.calibration_frequency_months ? `${inst.calibration_frequency_months} meses` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unidad / Servicio</p>
            <p className="font-medium">{inst.unit || inst.service || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total calibraciones</p>
            <p className="font-medium">{inst.total_calibrations}</p>
          </div>

          {isAlert && (
            <div className="col-span-full rounded-lg bg-red-100 border border-red-300 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 font-medium">
                Calibración VENCIDA. El instrumento no puede usarse para mediciones oficiales hasta ser recalibrado.
                Según NS-06.0 §8.3 y DS 3/1985 Art. 28, debe retirarse del servicio inmediatamente.
              </p>
            </div>
          )}
          {isWarn && !isAlert && (
            <div className="col-span-full rounded-lg bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-800">
                Calibración próxima a vencer. Programar recalibración con empresa acreditada ante INN/CCHEN.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────── Maintenance Card ────────────────────────────────────────────

function MaintenanceCard({ inst }: { inst: MaintenanceInstrument }) {
  const autoExpand = inst.maint_status === "vencido" || inst.maint_status === "urgente";
  const [open, setOpen] = useState(autoExpand);

  const isAlert = inst.maint_status === "vencido";
  const isWarn  = inst.maint_status === "urgente";

  const nextDate = inst.next_maintenance_date || inst.next_date_computed;

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm transition-all ${
        isAlert ? "border-red-300 bg-red-50/40" : isWarn ? "border-orange-300 bg-orange-50/30" : ""
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Wrench className={`w-5 h-5 shrink-0 ${isAlert ? "text-red-500" : isWarn ? "text-orange-500" : "text-purple-500"}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{inst.name}</span>
              {inst.code && <span className="text-xs text-muted-foreground font-mono">{inst.code}</span>}
              <MaintBadge status={inst.maint_status} days={inst.days_to_next} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[inst.brand, inst.model].filter(Boolean).join(" · ")}
              {inst.service && ` · ${inst.service}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {nextDate && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Próx: {fmtDate(nextDate)}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Última mantención</p>
            <p className="font-medium">{fmtDate(inst.last_maintenance_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="font-medium capitalize">{inst.last_maintenance_type || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Próxima mantención</p>
            <p className={`font-medium ${isAlert ? "text-red-600 font-bold" : isWarn ? "text-orange-600 font-semibold" : ""}`}>
              {fmtDate(nextDate ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Empresa</p>
            <p className="font-medium">{inst.last_company || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N° de serie</p>
            <p className="font-medium font-mono">{inst.serial_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Frecuencia</p>
            <p className="font-medium">
              {inst.maintenance_frequency_months ? `${inst.maintenance_frequency_months} meses` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Costo año actual</p>
            <p className="font-medium">{fmtCLP(inst.cost_this_year)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total mantenciones</p>
            <p className="font-medium">{inst.total_maintenances}</p>
          </div>

          {isAlert && (
            <div className="col-span-full rounded-lg bg-red-100 border border-red-300 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 font-medium">
                Mantención VENCIDA. Programar con proveedor autorizado de forma urgente.
                El uso sin mantención puede comprometer la seguridad y exactitud de las mediciones.
              </p>
            </div>
          )}
          {isWarn && !isAlert && (
            <div className="col-span-full rounded-lg bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-800">
                Mantención próxima. Coordinar con empresa de servicio técnico en los próximos 30 días.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────── Main Page ───────────────────────────────────────────────────

type TabKey = "calibrations" | "maintenances";

export default function InstrumentsMaintenancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("calibrations");

  // Calibration state
  const [calInstruments, setCalInstruments] = useState<CalibrationInstrument[]>([]);
  const [calStats, setCalStats] = useState<CalStats | null>(null);
  const [calServices, setCalServices] = useState<string[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState<string | null>(null);
  const [calQ, setCalQ] = useState("");
  const [calStatus, setCalStatus] = useState("");
  const [calService, setCalService] = useState("");

  // Maintenance state
  const [maintInstruments, setMaintInstruments] = useState<MaintenanceInstrument[]>([]);
  const [maintStats, setMaintStats] = useState<MaintStats | null>(null);
  const [maintServices, setMaintServices] = useState<string[]>([]);
  const [maintLoading, setMaintLoading] = useState(true);
  const [maintError, setMaintError] = useState<string | null>(null);
  const [maintQ, setMaintQ] = useState("");
  const [maintStatus, setMaintStatus] = useState("");
  const [maintService, setMaintService] = useState("");
  const [maintYear] = useState(new Date().getFullYear());

  // ── Fetch calibrations ────────────────────────────────────────────────────
  const fetchCal = useCallback(async () => {
    setCalLoading(true);
    setCalError(null);
    try {
      const params = new URLSearchParams();
      if (calQ) params.set("q", calQ);
      if (calStatus) params.set("status", calStatus);
      if (calService) params.set("service", calService);
      const res = await fetch(`/api/calibrations-overview?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCalInstruments(data.instruments ?? []);
      setCalStats(data.stats ?? null);
      setCalServices(data.services ?? []);
    } catch (e) {
      setCalError(String(e));
    } finally {
      setCalLoading(false);
    }
  }, [calQ, calStatus, calService]);

  // ── Fetch maintenances ────────────────────────────────────────────────────
  const fetchMaint = useCallback(async () => {
    setMaintLoading(true);
    setMaintError(null);
    try {
      const params = new URLSearchParams({ year: String(maintYear) });
      if (maintQ) params.set("q", maintQ);
      if (maintStatus) params.set("type", maintStatus);
      if (maintService) params.set("service", maintService);
      const res = await fetch(`/api/maintenances-overview?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMaintInstruments(data.instruments ?? []);
      setMaintStats(data.stats ?? null);
      setMaintServices(data.services ?? []);
    } catch (e) {
      setMaintError(String(e));
    } finally {
      setMaintLoading(false);
    }
  }, [maintQ, maintStatus, maintService, maintYear]);

  useEffect(() => { fetchCal(); }, [fetchCal]);
  useEffect(() => { fetchMaint(); }, [fetchMaint]);

  // ── Alert counts for tab badges ───────────────────────────────────────────
  const calAlerts = (calStats?.vencida ?? 0) + (calStats?.por_vencer ?? 0);
  const maintAlerts = (maintStats?.vencido ?? 0) + (maintStats?.urgente ?? 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 text-purple-600" />
            Calibraciones y Mantenciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §90 — Gestión de calibraciones externas y mantenciones de instrumentos de medición radiológica
          </p>
        </div>
        <button
          onClick={() => { fetchCal(); fetchMaint(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* ── Global Alerts ────────────────────────────────────────────────── */}
      {calAlerts > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">
              {calStats?.vencida ?? 0} calibración(es) vencida(s) · {calStats?.por_vencer ?? 0} por vencer en 30 días
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Instrumentos con calibración vencida deben retirarse del servicio inmediatamente (NS-06.0 §8.3).
              Contactar laboratorio acreditado ante INN para recalibración urgente.
            </p>
          </div>
        </div>
      )}
      {maintAlerts > 0 && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">
              {maintStats?.vencido ?? 0} mantención(es) vencida(s) · {maintStats?.urgente ?? 0} urgente(s) en 30 días
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Coordinar con proveedor de servicio técnico para evitar deterioro del desempeño del instrumento.
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border">
        {(
          [
            { key: "calibrations", label: "Calibraciones Externas", icon: FlaskConical, alerts: calAlerts },
            { key: "maintenances", label: "Mantenciones", icon: Wrench, alerts: maintAlerts },
          ] as const
        ).map(({ key, label, icon: Icon, alerts }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {alerts > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                {alerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ CALIBRATIONS TAB ══════════════════════════════════ */}
      {activeTab === "calibrations" && (
        <div className="space-y-5">
          {/* KPIs */}
          {calStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiTile label="Total instrumentos" value={calStats.total} color="bg-muted/40" icon={FlaskConical} />
              <KpiTile label="Vigentes" value={calStats.vigente} color="bg-green-50 text-green-900 border-green-200" icon={CheckCircle2} />
              <KpiTile label="Próx. 90d" value={calStats.proximo} color="bg-blue-50 text-blue-900 border-blue-200" icon={Calendar} />
              <KpiTile label="Por vencer 30d" value={calStats.por_vencer} color="bg-orange-50 text-orange-900 border-orange-200" icon={Clock} />
              <KpiTile label="Vencidas" value={calStats.vencida} color="bg-red-50 text-red-900 border-red-200" icon={AlertTriangle} />
              <KpiTile label="Sin calibrar" value={calStats.sin_calibrar} color="bg-gray-50 text-gray-700 border-gray-200" icon={Info} />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Buscar instrumento, código, certificado…"
                value={calQ}
                onChange={(e) => setCalQ(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <select
                  className="pl-8 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none appearance-none"
                  value={calStatus}
                  onChange={(e) => setCalStatus(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="vigente">Vigente</option>
                  <option value="proximo">Próx. 90d</option>
                  <option value="por_vencer">Por vencer</option>
                  <option value="vencida">Vencida</option>
                  <option value="sin_calibrar">Sin calibrar</option>
                </select>
              </div>
              {calServices.length > 0 && (
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    className="pl-8 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none appearance-none"
                    value={calService}
                    onChange={(e) => setCalService(e.target.value)}
                  >
                    <option value="">Todos los servicios</option>
                    {calServices.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* List */}
          {calLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Cargando calibraciones…
            </div>
          ) : calError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{calError}</div>
          ) : calInstruments.length === 0 ? (
            <div className="p-8 rounded-xl border bg-muted/20 text-center text-sm text-muted-foreground">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No se encontraron instrumentos con criterios de calibración.</p>
              <p className="mt-1 text-xs">Configure la frecuencia de calibración en el módulo de Instrumentos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calInstruments.map((inst) => (
                <CalibrationCard key={inst.id} inst={inst} />
              ))}
            </div>
          )}

          {/* Regulatory footer */}
          <div className="rounded-xl border bg-blue-50/50 p-4 text-xs text-blue-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Marco Normativo — Calibraciones Externas
            </p>
            <p>• <strong>DS 3/1985 Art. 28</strong>: Todo instrumento de medición debe mantenerse calibrado por laboratorio autorizado.</p>
            <p>• <strong>NS-06.0 §8.3</strong>: Frecuencia mínima de calibración según tipo de instrumento; retiro inmediato si vencida.</p>
            <p>• <strong>IAEA Safety Reports No. 16</strong>: Dosimetry in Diagnostic Radiology — calibración trazable a patrones nacionales.</p>
            <p>• <strong>IAEA-TECDOC-1040</strong>: Calibration of radiation protection monitoring instruments.</p>
            <p>• <strong>NCh-ISO 17025</strong>: Requisitos para laboratorios de calibración — acreditación ante INN.</p>
          </div>
        </div>
      )}

      {/* ══════════════ MAINTENANCES TAB ══════════════════════════════════ */}
      {activeTab === "maintenances" && (
        <div className="space-y-5">
          {/* KPIs */}
          {maintStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiTile label="Total instrumentos" value={maintStats.total} color="bg-muted/40" icon={Wrench} />
              <KpiTile label="Al día" value={maintStats.al_dia} color="bg-green-50 text-green-900 border-green-200" icon={CheckCircle2} />
              <KpiTile label="Próx. 90d" value={maintStats.proximo} color="bg-blue-50 text-blue-900 border-blue-200" icon={Calendar} />
              <KpiTile label="Urgente 30d" value={maintStats.urgente} color="bg-orange-50 text-orange-900 border-orange-200" icon={Clock} />
              <KpiTile label="Vencidos" value={maintStats.vencido} color="bg-red-50 text-red-900 border-red-200" icon={AlertTriangle} />
              <KpiTile label={`Costo ${maintYear}`} value={fmtCLP(maintStats.cost_year)} color="bg-purple-50 text-purple-900 border-purple-200" icon={TrendingUp} />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Buscar instrumento, código, empresa…"
                value={maintQ}
                onChange={(e) => setMaintQ(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <select
                  className="pl-8 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none appearance-none"
                  value={maintStatus}
                  onChange={(e) => setMaintStatus(e.target.value)}
                >
                  <option value="">Todos los tipos</option>
                  <option value="preventivo">Preventivo</option>
                  <option value="correctivo">Correctivo</option>
                  <option value="predictivo">Predictivo</option>
                </select>
              </div>
              {maintServices.length > 0 && (
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    className="pl-8 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none appearance-none"
                    value={maintService}
                    onChange={(e) => setMaintService(e.target.value)}
                  >
                    <option value="">Todos los servicios</option>
                    {maintServices.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* List */}
          {maintLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Cargando mantenciones…
            </div>
          ) : maintError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{maintError}</div>
          ) : maintInstruments.length === 0 ? (
            <div className="p-8 rounded-xl border bg-muted/20 text-center text-sm text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No se encontraron instrumentos con plan de mantención registrado.</p>
              <p className="mt-1 text-xs">Configure la frecuencia de mantención en el módulo de Instrumentos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {maintInstruments.map((inst) => (
                <MaintenanceCard key={inst.id} inst={inst} />
              ))}
            </div>
          )}

          {/* Regulatory footer */}
          <div className="rounded-xl border bg-purple-50/50 p-4 text-xs text-purple-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Marco Normativo — Mantenciones de Instrumentos
            </p>
            <p>• <strong>DS 3/1985 Art. 28</strong>: Mantención periódica de equipos e instrumentos de medición radiológica.</p>
            <p>• <strong>NS-06.0 §8</strong>: Programa de aseguramiento de calidad para instrumentación del Programa de Protección Radiológica.</p>
            <p>• <strong>IAEA Safety Reports No. 16</strong>: Maintenance and quality control of radiation monitoring instrumentation.</p>
            <p>• <strong>NMX-CC-9001-IMNC-2015 (ISO 9001)</strong>: Gestión de equipos de seguimiento y medición — mantenimiento preventivo documentado.</p>
          </div>
        </div>
      )}
    </div>
  );
}
