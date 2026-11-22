"use client";

export const dynamic = "force-dynamic";

// §91 — Liberación de Salas de Medicina Nuclear
// Monitoreo de contaminación superficial en Laboratorio y Sala de Pacientes
// Normativa: DS 3/1985 Art. 36 · NS-06.0 §5.3 · IAEA Safety Reports No. 19
// IAEA-TECDOC-1040 · Procedimiento HHHA-MN-RC-001

import { useState, useEffect, useCallback } from "react";
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Atom,
  ClipboardList,
  FileText,
  Info,
  Plus,
  Loader2,
} from "lucide-react";

// ─────────────── Types ───────────────────────────────────────────────────────

interface RcEvaluation {
  id: number;
  eval_date: string;
  responsable: string;
  radionuclido: string;
  instrumento_utilizado: string | null;
  estado_general_laboratorio: string;
  estado_general_sala: string;
  resumen_laboratorio: RcResumen;
  resumen_sala: RcResumen;
  observaciones_generales: string | null;
  resultado_global: string | null;
  usuario: string | null;
  version_formulario: string | null;
  created_at: string;
}

interface RcResumen {
  estado_general: string;
  total_puntos: number;
  puntos_ok: number;
  puntos_registro: number;
  puntos_investigacion: number;
  puntos_sobre_limite: number;
  max_pct_limite: number | null;
  puntos?: RcPunto[];
}

interface RcPunto {
  punto: string;
  cps_medida: number;
  cps_fondo: number;
  cps_neto: number;
  bq_m2: number | null;
  pct_limite: number | null;
  clasificacion: string;
  semaforo: string;
  cumple: boolean;
}

// ─────────────── Helpers ─────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function estadoLabel(e: string): { label: string; cls: string; icon: React.ReactNode } {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    conforme:                { label: "Conforme",           cls: "bg-green-100 text-green-800 border-green-300",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    liberado:                { label: "Liberado",           cls: "bg-green-100 text-green-800 border-green-300",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    requiere_descontaminacion:{ label: "Descontaminación", cls: "bg-orange-100 text-orange-800 border-orange-300",icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    no_liberado:             { label: "No Liberada",        cls: "bg-red-100 text-red-800 border-red-300",        icon: <XCircle className="w-3.5 h-3.5" /> },
  };
  return map[e] ?? { label: e ?? "—", cls: "bg-gray-100 text-gray-700 border-gray-300", icon: <Info className="w-3.5 h-3.5" /> };
}

function semaforoColor(s: string) {
  if (s === "verde")     return "bg-green-500";
  if (s === "amarillo")  return "bg-yellow-400";
  if (s === "naranja")   return "bg-orange-500";
  if (s === "rojo")      return "bg-red-600";
  return "bg-gray-300";
}

// ─────────────── Point Detail Row ────────────────────────────────────────────

function PointRow({ p }: { p: RcPunto }) {
  return (
    <tr className={`text-xs border-b last:border-0 ${!p.cumple ? "bg-red-50/60" : ""}`}>
      <td className="py-1.5 px-3 font-medium">{p.punto}</td>
      <td className="py-1.5 px-2 text-center font-mono">{p.cps_medida.toFixed(1)}</td>
      <td className="py-1.5 px-2 text-center font-mono">{p.cps_fondo.toFixed(1)}</td>
      <td className="py-1.5 px-2 text-center font-mono">{p.cps_neto.toFixed(1)}</td>
      <td className="py-1.5 px-2 text-center font-mono">
        {p.bq_m2 !== null ? p.bq_m2.toFixed(0) : "—"}
      </td>
      <td className="py-1.5 px-2 text-center font-mono">
        {p.pct_limite !== null ? `${p.pct_limite.toFixed(1)}%` : "—"}
      </td>
      <td className="py-1.5 px-2 text-center">
        <span className={`inline-block w-3 h-3 rounded-full ${semaforoColor(p.semaforo)}`} title={p.semaforo} />
      </td>
      <td className="py-1.5 px-2 text-center">
        {p.cumple
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mx-auto" />
          : <XCircle className="w-3.5 h-3.5 text-red-600 mx-auto" />
        }
      </td>
    </tr>
  );
}

// ─────────────── Area Summary ────────────────────────────────────────────────

function AreaCard({ title, resumen, icon }: { title: string; resumen: RcResumen; icon: React.ReactNode }) {
  const [showPoints, setShowPoints] = useState(false);
  const st = estadoLabel(resumen.estado_general);

  return (
    <div className={`rounded-lg border p-3 ${resumen.estado_general === "no_liberado" ? "border-red-300 bg-red-50/40" : resumen.estado_general === "requiere_descontaminacion" ? "border-orange-200 bg-orange-50/30" : "border-green-200 bg-green-50/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${st.cls}`}>
            {st.icon}{st.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-green-700 font-medium">{resumen.puntos_ok}/{resumen.total_puntos} OK</span>
          {resumen.puntos_sobre_limite > 0 && (
            <span className="text-red-700 font-medium">{resumen.puntos_sobre_limite} sobre límite</span>
          )}
          {resumen.max_pct_limite !== null && (
            <span>Máx: {resumen.max_pct_limite.toFixed(1)}%</span>
          )}
          {resumen.puntos && resumen.puntos.length > 0 && (
            <button
              onClick={() => setShowPoints(v => !v)}
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
            >
              Puntos {showPoints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {showPoints && resumen.puntos && resumen.puntos.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded border bg-background">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="py-1.5 px-3 font-medium">Punto</th>
                <th className="py-1.5 px-2 text-center">Bruto (cps)</th>
                <th className="py-1.5 px-2 text-center">Fondo (cps)</th>
                <th className="py-1.5 px-2 text-center">Neto (cps)</th>
                <th className="py-1.5 px-2 text-center">Bq/m²</th>
                <th className="py-1.5 px-2 text-center">% Límite</th>
                <th className="py-1.5 px-2 text-center">Semáf.</th>
                <th className="py-1.5 px-2 text-center">Cumple</th>
              </tr>
            </thead>
            <tbody>
              {resumen.puntos.map((p) => (
                <PointRow key={p.punto} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────── Evaluation Card ─────────────────────────────────────────────

function EvaluationCard({ ev }: { ev: RcEvaluation }) {
  const labSt = estadoLabel(ev.estado_general_laboratorio);
  const salaSt = estadoLabel(ev.estado_general_sala);

  const isAlert = ev.estado_general_laboratorio === "no_liberado" || ev.estado_general_sala === "no_liberado";
  const isWarn  = ev.estado_general_laboratorio === "requiere_descontaminacion" || ev.estado_general_sala === "requiere_descontaminacion";

  const autoExpand = isAlert || isWarn;
  const [open, setOpen] = useState(autoExpand);

  const resLab  = typeof ev.resumen_laboratorio === "string" ? JSON.parse(ev.resumen_laboratorio) as RcResumen : ev.resumen_laboratorio;
  const resSala = typeof ev.resumen_sala === "string" ? JSON.parse(ev.resumen_sala) as RcResumen : ev.resumen_sala;

  return (
    <div className={`rounded-xl border bg-card shadow-sm transition-all ${isAlert ? "border-red-300 bg-red-50/30" : isWarn ? "border-orange-300 bg-orange-50/20" : ""}`}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ScanLine className={`w-5 h-5 shrink-0 ${isAlert ? "text-red-500" : isWarn ? "text-orange-500" : "text-blue-500"}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{fmtDate(ev.eval_date)}</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${labSt.cls}`}>
                Lab: {labSt.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${salaSt.cls}`}>
                Sala: {salaSt.label}
              </span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {ev.radionuclido}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ev.responsable}
              {ev.instrumento_utilizado && ` · ${ev.instrumento_utilizado}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAlert && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AreaCard
              title="Laboratorio"
              resumen={resLab}
              icon={<ClipboardList className="w-4 h-4 text-blue-500" />}
            />
            <AreaCard
              title="Sala de Pacientes"
              resumen={resSala}
              icon={<User className="w-4 h-4 text-purple-500" />}
            />
          </div>

          {ev.observaciones_generales && (
            <div className="rounded-lg bg-muted/40 border p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">Observaciones</p>
              <p className="text-sm">{ev.observaciones_generales}</p>
            </div>
          )}

          {isAlert && (
            <div className="rounded-lg bg-red-100 border border-red-300 p-3 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 font-medium">
                SALA NO LIBERADA. Se superaron los límites de contaminación superficial.
                La sala debe permanecer cerrada y realizar descontaminación inmediata según
                NS-06.0 §5.3. Notificar al Encargado PR y registrar en bitácora de incidentes.
              </p>
            </div>
          )}
          {isWarn && !isAlert && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-800">
                Se requiere descontaminación en uno o más puntos antes de liberar la sala.
                Realizar limpieza con materiales absorbentes y repetir medición.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────── Stats ────────────────────────────────────────────────────────

function StatTile({ label, value, color, icon: Icon }: { label: string; value: number | string; color: string; icon: React.ElementType }) {
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

// ─────────────── Main Page ───────────────────────────────────────────────────

export default function RoomClearancePage() {
  const [evaluations, setEvaluations] = useState<RcEvaluation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [estadoLab, setEstadoLab] = useState("");
  const [radionuclido, setRadionuclido] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (q) params.set("q", q);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (estadoLab) params.set("estadoLaboratorio", estadoLab);
      if (radionuclido) params.set("radionuclido", radionuclido);

      const res = await fetch(`/api/room-clearance?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEvaluations(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [q, dateFrom, dateTo, estadoLab, radionuclido, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived stats from loaded evaluations
  const noLibCount = evaluations.filter(e =>
    e.estado_general_laboratorio === "no_liberado" || e.estado_general_sala === "no_liberado"
  ).length;
  const descontCount = evaluations.filter(e =>
    e.estado_general_laboratorio === "requiere_descontaminacion" || e.estado_general_sala === "requiere_descontaminacion"
  ).length;
  const conformeCount = evaluations.filter(e =>
    e.estado_general_laboratorio === "conforme" && e.estado_general_sala === "conforme"
  ).length;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-blue-600" />
            Liberación de Salas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §91 — Monitoreo de contaminación superficial para liberación de salas de Medicina Nuclear
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
          <a
            href="/room-release"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva evaluación
          </a>
        </div>
      </div>

      {/* ── Alert Banners ─────────────────────────────────────────────────── */}
      {noLibCount > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">
              {noLibCount} evaluación(es) con sala NO LIBERADA en esta página
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Las salas no liberadas deben permanecer cerradas hasta completar la descontaminación y
              obtener un resultado conforme (NS-06.0 §5.3 · DS 3/1985 Art. 36).
            </p>
          </div>
        </div>
      )}

      {/* ── KPIs (from loaded page) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label={`Total (p.${page})`} value={evaluations.length} color="bg-muted/40" icon={ClipboardList} />
        <StatTile label="Conformes" value={conformeCount} color="bg-green-50 text-green-900 border-green-200" icon={CheckCircle2} />
        <StatTile label="Descontaminación" value={descontCount} color="bg-orange-50 text-orange-900 border-orange-200" icon={AlertTriangle} />
        <StatTile label="No liberadas" value={noLibCount} color="bg-red-50 text-red-900 border-red-200" icon={XCircle} />
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Buscar responsable, observaciones…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <input
          type="date"
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          title="Desde"
        />
        <input
          type="date"
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          title="Hasta"
        />
        <select
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none"
          value={estadoLab}
          onChange={(e) => { setEstadoLab(e.target.value); setPage(1); }}
        >
          <option value="">Todos los estados</option>
          <option value="conforme">Conforme</option>
          <option value="requiere_descontaminacion">Requiere descontaminación</option>
          <option value="liberado">Liberado</option>
          <option value="no_liberado">No liberado</option>
        </select>
        <select
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none"
          value={radionuclido}
          onChange={(e) => { setRadionuclido(e.target.value); setPage(1); }}
        >
          <option value="">Todos los radionúclidos</option>
          {["TC-99M","I-131","I-123","GA-67","GA-68","F-18","LU-177"].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando evaluaciones…
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      ) : evaluations.length === 0 ? (
        <div className="p-8 rounded-xl border bg-muted/20 text-center text-sm text-muted-foreground">
          <ScanLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No se encontraron evaluaciones de liberación de sala.</p>
          <p className="mt-1 text-xs">
            Registre una nueva evaluación desde el módulo{" "}
            <a href="/room-release" className="text-blue-600 underline">Room Release</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev) => (
            <EvaluationCard key={ev.id} ev={ev} />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            {total} evaluaciones · Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
            >
              ← Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ── Info Box ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1.5">
        <p className="font-semibold flex items-center gap-1.5">
          <Atom className="w-3.5 h-3.5" />
          Criterios de Liberación — Medicina Nuclear
        </p>
        <p>• <strong>Límite superficial (Tc-99m):</strong> ≤ 400 Bq/m² (límite primario operacional HHHA, basado en IAEA Safety Reports No. 19).</p>
        <p>• <strong>Registro:</strong> &gt; 10% del límite. <strong>Investigación:</strong> &gt; 30%. <strong>Intervención:</strong> &gt; 100% → sala no liberada.</p>
        <p>• <strong>Puntos monitoreados:</strong> 6 en Laboratorio + 10 en Sala de Pacientes según Procedimiento HHHA-MN-RC-001.</p>
        <p>• <strong>Frecuencia:</strong> Mínimo al término de cada jornada de trabajo con material radiactivo (NS-06.0 §5.3.2).</p>
      </div>

      {/* ── Regulatory Footer ────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold flex items-center gap-1.5 text-foreground">
          <FileText className="w-3.5 h-3.5" />
          Marco Normativo — Liberación de Salas
        </p>
        <p>• <strong>DS 3/1985 Art. 36:</strong> Descontaminación de áreas y superficies contaminadas; registro obligatorio de mediciones.</p>
        <p>• <strong>NS-06.0 §5.3:</strong> Monitoreo de contaminación superficial en instalaciones de Medicina Nuclear — criterios y frecuencias.</p>
        <p>• <strong>IAEA Safety Reports No. 19:</strong> Occupational Radiation Protection in the Mining and Processing of Raw Materials — metodología de monitoreo de superficie.</p>
        <p>• <strong>IAEA-TECDOC-1040:</strong> Calibration of radiation protection monitoring instruments — criterios instrumentales para medición de contaminación superficial.</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          <Calendar className="w-3.5 h-3.5" />
          <span>Total registros en sistema: <strong className="text-foreground">{total}</strong></span>
        </div>
      </div>
    </div>
  );
}
