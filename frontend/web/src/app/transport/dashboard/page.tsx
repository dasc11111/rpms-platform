"use client";

import { useEffect, useState } from "react";
import {
  Truck, BarChart3, AlertTriangle, CheckCircle2,
  TrendingUp, Calendar, Shield, RefreshCw, Radiation,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthInfo {
  number: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  daysRemaining: number | null;
  alertLevel: "ok" | "warning" | "critical" | "expired";
}

interface DashData {
  totalTransports: number;
  transportsToday: number;
  transportsThisMonth: number;
  transportsThisYear: number;
  materialCounts: Record<string, number>;
  averages: { it: number; doseContact: number; dose1m: number; doseVehicle: number };
  exceededLimits: number;
  compliance: {
    total: number;
    dosimeterPct: number;
    radiactivo7Pct: number;
    nu2915Pct: number;
    driverPct: number;
    oprPct: number;
  };
  generatorStats: {
    total: number;
    totalActivityMci: number;
    avgActivityMci: number;
    maxActivityMci: number;
    minActivityMci: number;
  };
  i131Stats: {
    totalShipments: number;
    totalCapsules: number;
    totalActivityMci: number;
    avgActivityMci: number;
    maxActivityMci: number;
    minActivityMci: number;
  };
  monthlyTrend: { month: string; total: number }[];
  yearlyTrend: { year: number; total: number }[];
  authorization: AuthInfo | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMci(v: number) {
  return v.toLocaleString("es-CL", { maximumFractionDigits: 1 });
}

function authBadge(level: AuthInfo["alertLevel"]) {
  switch (level) {
    case "ok":       return { cls: "bg-green-100 text-green-700 border border-green-200", label: "Vigente" };
    case "warning":  return { cls: "bg-yellow-100 text-yellow-700 border border-yellow-200", label: "Por vencer" };
    case "critical": return { cls: "bg-orange-100 text-orange-700 border border-orange-200", label: "Urgente" };
    case "expired":  return { cls: "bg-red-100 text-red-700 border border-red-200", label: "Vencida" };
  }
}

function ComplianceBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 95 ? "bg-green-500" : pct >= 80 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

const MATERIAL_LABELS: Record<string, string> = {
  MO_TC99:   "Generador Mo-99/Tc-99m",
  I131:      "I-131",
  TC99M:     "Tc-99m marcado",
  I131_CAP:  "Cápsula I-131",
  OTRO:      "Otro material",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransportDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/transport/dashboard")
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const auth = data?.authorization ?? null;
  const authBadgeInfo = auth ? authBadge(auth.alertLevel) : null;

  // Max month for bar chart normalization
  const maxMonth = data ? Math.max(...data.monthlyTrend.map(m => m.total), 1) : 1;
  const maxYear  = data ? Math.max(...data.yearlyTrend.map(y => y.total), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Truck className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard de Transporte Radiactivo</h1>
              <p className="text-sm text-gray-500">Estadísticas y cumplimiento normativo de envíos de material radiactivo</p>
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
            {/* Authorization banner */}
            {auth && (
              <div className={`rounded-xl border px-5 py-3 flex items-center justify-between ${
                auth.alertLevel === "expired" ? "bg-red-50 border-red-200" :
                auth.alertLevel === "critical" ? "bg-orange-50 border-orange-200" :
                auth.alertLevel === "warning" ? "bg-yellow-50 border-yellow-200" :
                "bg-green-50 border-green-200"
              }`}>
                <div className="flex items-center gap-3">
                  <Shield className={`h-5 w-5 ${
                    auth.alertLevel === "expired" ? "text-red-600" :
                    auth.alertLevel === "critical" ? "text-orange-600" :
                    auth.alertLevel === "warning" ? "text-yellow-600" : "text-green-600"
                  }`} />
                  <div>
                    <span className="font-semibold text-sm text-gray-800">Autorización de Transporte</span>
                    {auth.number && <span className="ml-2 text-xs text-gray-600">N° {auth.number}</span>}
                  </div>
                  {authBadgeInfo && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${authBadgeInfo.cls}`}>
                      {authBadgeInfo.label}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-xs text-gray-500 mr-2">Vence:</span>
                  <span className="font-medium">{fmtDate(auth.expiryDate)}</span>
                  {auth.daysRemaining !== null && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({auth.daysRemaining > 0 ? `${auth.daysRemaining}d restantes` : "VENCIDA"})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total acumulado",   value: data.totalTransports,       icon: Truck,          color: "blue" },
                { label: "Envíos hoy",         value: data.transportsToday,       icon: Calendar,       color: "green" },
                { label: "Este mes",           value: data.transportsThisMonth,   icon: TrendingUp,     color: "purple" },
                { label: "Este año",           value: data.transportsThisYear,    icon: BarChart3,      color: "indigo" },
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

              {/* Compliance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Cumplimiento de Registros
                </h2>
                <p className="text-xs text-gray-400 mb-4">Basado en {data.compliance.total.toLocaleString("es-CL")} envíos totales</p>
                <div className="space-y-3">
                  <ComplianceBar pct={data.compliance.dosimeterPct}  label="Dosímetro" />
                  <ComplianceBar pct={data.compliance.radiactivo7Pct} label="Señal Radiactivo-7" />
                  <ComplianceBar pct={data.compliance.nu2915Pct}      label="NU-2915" />
                  <ComplianceBar pct={data.compliance.driverPct}      label="Conductor registrado" />
                  <ComplianceBar pct={data.compliance.oprPct}         label="OPR registrado" />
                </div>
              </div>

              {/* Radiation dose averages */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Radiation className="h-4 w-4 text-orange-500" /> Dosis Promedio Registradas
                </h2>
                {data.exceededLimits > 0 && (
                  <div className="mb-3 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {data.exceededLimits} envíos con valores sobre límites (Dosis 1m &gt;100 µSv/h o Dosis vehículo &gt;2000 µSv/h)
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "IT (Índice de Transporte)", value: data.averages.it.toFixed(2), unit: "" },
                    { label: "Dosis contacto", value: data.averages.doseContact.toFixed(1), unit: "µSv/h" },
                    { label: "Dosis a 1 m", value: data.averages.dose1m.toFixed(1), unit: "µSv/h" },
                    { label: "Dosis en vehículo", value: data.averages.doseVehicle.toFixed(1), unit: "µSv/h" },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className="text-lg font-bold text-gray-800">{value} <span className="text-xs font-normal text-gray-500">{unit}</span></div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Material breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Material counts */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Material por tipo</h2>
                <div className="space-y-2">
                  {Object.entries(data.materialCounts).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{MATERIAL_LABELS[code] ?? code}</span>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  ))}
                  {Object.keys(data.materialCounts).length === 0 && (
                    <p className="text-xs text-gray-400">Sin datos.</p>
                  )}
                </div>
              </div>

              {/* Generator stats */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Generador Mo-99/Tc-99m</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total envíos</span><span className="font-semibold">{data.generatorStats.total}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Actividad total</span><span className="font-semibold">{fmtMci(data.generatorStats.totalActivityMci)} mCi</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Actividad prom.</span><span className="font-semibold">{fmtMci(data.generatorStats.avgActivityMci)} mCi</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Máximo</span><span className="font-semibold">{fmtMci(data.generatorStats.maxActivityMci)} mCi</span></div>
                </div>
              </div>

              {/* I-131 stats */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Yodo-131 (Cápsulas)</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total envíos</span><span className="font-semibold">{data.i131Stats.totalShipments}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total cápsulas</span><span className="font-semibold">{data.i131Stats.totalCapsules}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Actividad total</span><span className="font-semibold">{fmtMci(data.i131Stats.totalActivityMci)} mCi</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Actividad prom.</span><span className="font-semibold">{fmtMci(data.i131Stats.avgActivityMci)} mCi/cáp.</span></div>
                </div>
              </div>

            </div>

            {/* Trend charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Monthly trend */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Tendencia mensual (últimos 12 meses)</h2>
                {data.monthlyTrend.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {data.monthlyTrend.map(m => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">{m.total}</span>
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${Math.round((m.total / maxMonth) * 96)}px`, minHeight: "2px" }}
                        />
                        <span className="text-[10px] text-gray-400 rotate-45 origin-left w-6 overflow-hidden whitespace-nowrap">{m.month.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Yearly trend */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Tendencia anual</h2>
                {data.yearlyTrend.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="flex items-end gap-2 h-32">
                    {data.yearlyTrend.map(y => (
                      <div key={y.year} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">{y.total}</span>
                        <div
                          className="w-full bg-indigo-500 rounded-t"
                          style={{ height: `${Math.round((y.total / maxYear) * 96)}px`, minHeight: "2px" }}
                        />
                        <span className="text-xs text-gray-500">{y.year}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Regulatory footer */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°12/2010 MINENERGIA — Reglamento de Seguridad Radiológica (Art. 50-62, transporte).
                OIEA SSR-6 (Rev. 1) 2018 — Reglamento para el transporte seguro de material radiactivo.
                DS N°1.439/2015 MOP — Reglamento para el transporte de mercancías peligrosas por carretera (ADR nacional).
                CCHEN ORD. N°0001 — Autorización de transporte de material radiactivo, requisitos y registros.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
