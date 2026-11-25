"use client";


import { useEffect, useState, useCallback } from "react";
import {
  Award, RefreshCw, ChevronDown, ChevronUp,
  FileText, Search, CheckCircle, AlertTriangle,
  Clock, Wrench, Building2, Calendar,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type CalStatus = "vigente" | "por_vencer" | "proximo" | "vencida" | "sin_calibrar";

interface InstrumentCal {
  id: number;
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  service?: string | null;
  unit?: string | null;
  instrument_status?: string | null;
  calibration_frequency_months?: number | null;
  last_calibration_date?: string | null;
  expiry_date?: string | null;
  certificate_number?: string | null;
  calibration_company?: string | null;
  total_calibrations?: number;
  cal_status: CalStatus;
  days_to_expiry?: number | null;
}

interface Stats {
  total: number;
  vigente: number;
  por_vencer: number;
  proximo: number;
  vencida: number;
  sin_calibrar: number;
}

interface OverviewData {
  instruments: InstrumentCal[];
  stats: Stats;
}

const CAL_CFG: Record<CalStatus, { label: string; cls: string; dot: string }> = {
  vigente:      { label: "Vigente",        cls: "bg-green-100 text-green-700 border border-green-200",   dot: "bg-green-500" },
  por_vencer:   { label: "Por vencer",     cls: "bg-red-100 text-red-700 border border-red-200",         dot: "bg-red-500" },
  proximo:      { label: "Próximo",        cls: "bg-yellow-100 text-yellow-700 border border-yellow-200", dot: "bg-yellow-500" },
  vencida:      { label: "Vencida",        cls: "bg-red-200 text-red-800 border border-red-300",         dot: "bg-red-700" },
  sin_calibrar: { label: "Sin calibrar",   cls: "bg-gray-100 text-gray-700 border border-gray-200",      dot: "bg-gray-400" },
};

const CAL_STATUSES: CalStatus[] = ["vigente", "por_vencer", "proximo", "vencida", "sin_calibrar"];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { dateStyle: "short" });
}

function daysLabel(days: number | null | undefined) {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `Hace ${Math.abs(days)} días`;
  if (days === 0) return "Hoy";
  return `En ${days} días`;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CalibrationsOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterStatus, setFilterStatus] = useState<"" | CalStatus>("");
  const [filterService, setFilterService] = useState("");
  const [search, setSearch] = useState("");

  // expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterService) params.set("service", filterService);
      if (search) params.set("q", search);
      const res = await fetch(`/api/calibrations-overview?${params}`);
      const json = await res.json();
      setData({ instruments: json.instruments ?? [], stats: json.stats ?? {} });
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterService, search]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const instruments = data?.instruments ?? [];
  const stats = data?.stats;

  const services = Array.from(new Set(instruments.map((i) => i.service).filter(Boolean))).sort();

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Award className="h-4 w-4 text-indigo-500" />
            <span>Instrumentos</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Estado de Calibraciones de Instrumentos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista consolidada del estado de calibración de todos los instrumentos que requieren calibración periódica.
            DS 3/1985 · NCh-ISO 17025 · IAEA Safety Reports Series No. 16.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* ── KPI Tiles ── */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Total con calibración", value: stats.total, cls: "text-indigo-700", dot: "bg-indigo-500" },
            { label: "Vigente", value: stats.vigente, cls: "text-green-700", dot: "bg-green-500" },
            { label: "Próximo (≤90d)", value: stats.proximo, cls: "text-yellow-700", dot: "bg-yellow-500" },
            { label: "Por vencer (≤30d)", value: stats.por_vencer, cls: "text-red-600", dot: "bg-red-500" },
            { label: "Vencida / Sin calibrar", value: (stats.vencida ?? 0) + (stats.sin_calibrar ?? 0), cls: "text-red-800", dot: "bg-red-700" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full ${k.dot}`} />
                <span className="text-xs text-gray-500 leading-tight">{k.label}</span>
              </div>
              <span className={`text-2xl font-bold ${k.cls}`}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar instrumento, código, serie, certificado…"
            className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm text-gray-700 min-w-[260px]"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "" | CalStatus)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los estados</option>
          {CAL_STATUSES.map((s) => <option key={s} value={s}>{CAL_CFG[s].label}</option>)}
        </select>
        <select value={filterService} onChange={(e) => setFilterService(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <option value="">Todos los servicios</option>
          {services.map((s) => <option key={s!} value={s!}>{s}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-gray-400">
          {instruments.length} instrumento{instruments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Content ── */}
      {loading && <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">Cargando…</div>}
      {error && !loading && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>}

      {!loading && !error && instruments.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Award className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No hay instrumentos con calibración registrada.</p>
        </div>
      )}

      {!loading && !error && instruments.length > 0 && (
        <div className="space-y-3">
          {instruments.map((inst) => {
            const isOpen = expanded.has(inst.id);
            const cfg = CAL_CFG[inst.cal_status] ?? CAL_CFG.sin_calibrar;
            const urgent = inst.cal_status === "vencida" || inst.cal_status === "por_vencer";
            return (
              <div key={inst.id} className={`rounded-xl border bg-white shadow-sm overflow-hidden ${urgent ? "border-red-200" : "border-gray-200"}`}>
                <button onClick={() => toggle(inst.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                  <Wrench className={`h-5 w-5 flex-shrink-0 ${urgent ? "text-red-400" : "text-indigo-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{inst.name}</span>
                      <span className="font-mono text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{inst.code}</span>
                      {inst.service && <span className="text-xs text-gray-500">{inst.service}</span>}
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      {inst.last_calibration_date && (
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Última cal.: {fmtDate(inst.last_calibration_date)}</span>
                      )}
                      {inst.expiry_date && (
                        <span className={`flex items-center gap-1 ${urgent ? "text-red-600 font-medium" : ""}`}>
                          <Clock className="h-3 w-3" />Vence: {fmtDate(inst.expiry_date)} ({daysLabel(inst.days_to_expiry)})
                        </span>
                      )}
                      {inst.calibration_company && (
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{inst.calibration_company}</span>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
                      <Field label="Código" value={inst.code} mono />
                      <Field label="Nombre" value={inst.name} />
                      {inst.brand && <Field label="Marca" value={inst.brand} />}
                      {inst.model && <Field label="Modelo" value={inst.model} />}
                      {inst.serial_number && <Field label="N° serie" value={inst.serial_number} />}
                      {inst.unit && <Field label="Unidad/Servicio" value={inst.unit} />}
                      <Field label="Frecuencia calibración" value={inst.calibration_frequency_months ? `${inst.calibration_frequency_months} meses` : "—"} />
                      <Field label="Última calibración" value={fmtDate(inst.last_calibration_date)} />
                      <Field label="Vencimiento" value={fmtDate(inst.expiry_date)} />
                      <Field label="Días para vencer" value={daysLabel(inst.days_to_expiry)} />
                      {inst.certificate_number && <Field label="N° certificado" value={inst.certificate_number} mono />}
                      {inst.calibration_company && <Field label="Empresa calibradora" value={inst.calibration_company} />}
                      <Field label="Total calibraciones" value={String(inst.total_calibrations ?? 0)} />
                      <Field label="Estado cal." value={cfg.label} />
                    </dl>
                    <div className="mt-3 flex justify-end">
                      <a href={`/instruments/${inst.id}`} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-white hover:text-indigo-600">
                        <Wrench className="h-3 w-3" />
                        Ver ficha del instrumento
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Regulatory footer ── */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-500 space-y-0.5">
            <p className="font-medium text-gray-600">Marco normativo aplicable</p>
            <p>DS 3/1985 (MINSAL) — Art. 76: Todo instrumento de medición de radiaciones ionizantes debe mantener calibración vigente</p>
            <p>NCh-ISO 17025 — Calibración periódica trazable a patrones nacionales/internacionales para instrumentos de medición</p>
            <p>IAEA Safety Reports Series No. 16 — Calibration of radiation protection monitoring instruments: frequency and documentation</p>
            <p>CCHEN ORD. — Exigencia de certificado de calibración vigente en toda fiscalización de instalaciones</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className={`text-sm text-gray-800 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

// Suppress unused icon warnings
const _icons = { CheckCircle, AlertTriangle };
void _icons;
