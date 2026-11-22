"use client";

import { useEffect, useState } from "react";
import {
  ScanLine, BarChart3, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PuntoMax {
  punto: string;
  area_tipo: string;
  bq_cm2: number;
  semaforo: string;
  eval_date: string;
  evaluation_id: number;
}

interface StatsData {
  hoy: number;
  mes: number;
  total: number;
  lab_liberados: number;
  sala_liberados: number;
  lab_contaminados: number;
  sala_contaminados: number;
  descontaminaciones: number;
  avg_bq_cm2: number;
  avg_usv_h: number;
  max_bq_cm2: number;
  puntos_sobre_limite: number;
  punto_max: PuntoMax | null;
  historial_mensual: { mes: string; total: number; liberados: number }[];
  distribucion_radionuclido: { radionuclido: string; total: number }[];
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtBq(v: number) {
  if (!v) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 2 }) + " Bq/cm²";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoomClearanceStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/room-clearance/stats")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const maxMonth = data ? Math.max(...data.historial_mensual.map(m => m.total), 1) : 1;
  const totalRnuclido = data ? data.distribucion_radionuclido.reduce((s, r) => s + r.total, 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <ScanLine className="h-6 w-6 text-teal-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Estadísticas de Liberación de Salas MN</h1>
              <p className="text-sm text-gray-500">Resumen de evaluaciones de liberación radiológica de salas de Medicina Nuclear</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-gray-400">Cargando estadísticas...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* Alert: points over limit */}
            {data.puntos_sobre_limite > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3 text-red-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span><strong>{data.puntos_sobre_limite}</strong> puntos de medición con actividad sobre los límites de referencia — revisar procedimientos de descontaminación.</span>
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total evaluaciones",   value: data.total,              icon: ScanLine,    color: "teal"   },
                { label: "Hoy",                  value: data.hoy,                icon: CheckCircle2, color: "green" },
                { label: "Este mes",             value: data.mes,                icon: BarChart3,   color: "blue"   },
                { label: "Descontaminaciones",   value: data.descontaminaciones, icon: AlertTriangle, color: "red"  },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{value.toLocaleString("es-CL")}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Liberation results */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Resultados de Liberación
                </h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Laboratorio liberado",          value: data.lab_liberados,    cls: "bg-green-500" },
                    { label: "Sala liberada",                 value: data.sala_liberados,   cls: "bg-green-400" },
                    { label: "Lab. contaminado / no liberado", value: data.lab_contaminados, cls: "bg-red-500" },
                    { label: "Sala contaminada / no liberada",value: data.sala_contaminados, cls: "bg-red-400" },
                  ].map(({ label, value, cls }) => {
                    const pct = data.total > 0 ? (value / data.total) * 100 : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-gray-600 w-48 shrink-0">{label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className={`h-2 rounded-full ${cls}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-16 text-right">{value} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dose metrics */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Métricas de Contaminación</h2>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Actividad prom.</div>
                    <div className="font-bold text-gray-800">{fmtBq(data.avg_bq_cm2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Actividad máx.</div>
                    <div className="font-bold text-gray-800">{fmtBq(data.max_bq_cm2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Tasa dosis prom.</div>
                    <div className="font-bold text-gray-800">
                      {data.avg_usv_h ? data.avg_usv_h.toLocaleString("es-CL", { maximumFractionDigits: 2 }) + " µSv/h" : "—"}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-500 mb-1">Puntos sobre límite</div>
                    <div className="font-bold text-red-700">{data.puntos_sobre_limite}</div>
                  </div>
                </div>
                {data.punto_max && (
                  <div className="border border-orange-100 bg-orange-50 rounded-lg p-3 text-xs text-orange-700">
                    <span className="font-semibold">Máximo histórico: </span>
                    {data.punto_max.punto} ({data.punto_max.area_tipo}) — {fmtBq(data.punto_max.bq_cm2)} el {fmtDate(data.punto_max.eval_date)}
                  </div>
                )}
              </div>

              {/* Por radionúclido */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Por Radionúclido</h2>
                <div className="space-y-2">
                  {data.distribucion_radionuclido.map((r, i) => {
                    const pct = totalRnuclido > 0 ? (r.total / totalRnuclido) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-gray-700">{r.radionuclido || "Sin dato"}</span>
                            <span className="text-gray-500 ml-2">{r.total}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly trend */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-400" /> Historial Mensual
                </h2>
                {data.historial_mensual.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-1 h-32 overflow-x-auto">
                    {data.historial_mensual.map((m, i) => (
                      <div key={i} className="flex-1 min-w-[22px] flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-gray-500">{m.total}</span>
                        <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.round((m.total / maxMonth) * 96)}px`, minHeight: "2px" }}>
                          <div className="bg-teal-500 w-full" style={{ height: `${m.total > 0 ? Math.round((m.liberados / m.total) * 100) : 0}%` }} />
                          <div className="bg-teal-200 w-full flex-1" />
                        </div>
                        <span className="text-[9px] text-gray-400">{m.mes.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> Liberadas</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-200 inline-block" /> No liberadas</div>
                </div>
              </div>

            </div>

            {/* Regulatory footer */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°3/1985 MINSAL Art. 60-64 — Monitoreo de contaminación superficial en instalaciones radiactivas.
                DS N°594/1999 MINSAL — Límites de contaminación superficial en lugares de trabajo controlados.
                ICRP Publication 103 (Tabla B-3) — Límites de contaminación superficial para liberación de áreas.
                CCHEN ORD. sobre procedimientos de liberación radiológica de salas de Medicina Nuclear.
                IAEA Safety Standards Series GSG-7 — Ocupational radiation protection in the uranium mining and processing industry.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
