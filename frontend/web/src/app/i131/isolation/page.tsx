"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, Shield, User } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type IsolationStatus = "en_aislamiento" | "apto_alta" | "vencido";

interface IsolationRecord {
  id: number;
  admin_date: string;
  paciente_nombre: string;
  paciente_run: string | null;
  ficha_clinica: string | null;
  sala: string | null;
  dosis_administrada: number | null;
  tasa_dosis: string | null;
  medico_solicitante: string | null;
  diagnostico: string | null;
  days_since_admin: number;
  remaining_activity_mci: number | null;
  estimated_release_date: string | null;
  days_to_release: number | null;
  isolation_status: IsolationStatus;
  can_release_by_activity: boolean;
  release_threshold_mci: number;
}

interface Stats {
  en_aislamiento: number;
  apto_alta: number;
  total_tracked: number;
  release_threshold_mci: number;
  release_threshold_gbq: number;
  release_dose_rate_usv_h: number;
}

interface IsolationData { data: IsolationRecord[]; stats: Stats; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusCfg(s: IsolationStatus) {
  if (s === "en_aislamiento") return { label: "En aislamiento", bg: "bg-orange-100 text-orange-700", dot: "bg-orange-500" };
  if (s === "apto_alta")     return { label: "Apto para alta",  bg: "bg-green-100 text-green-700",  dot: "bg-green-500" };
  return                           { label: "Vencido",         bg: "bg-gray-100 text-gray-500",   dot: "bg-gray-400" };
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function I131IsolationPage() {
  const [data, setData] = useState<IsolationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<IsolationStatus | "all">("all");

  const fetchData = () => {
    setLoading(true);
    fetch("/api/i131/isolation")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const int = setInterval(fetchData, 60_000); // refresh every minute
    return () => clearInterval(int);
  }, []);

  const records = data?.data ?? [];
  const filtered = filterStatus === "all" ? records : records.filter(r => r.isolation_status === filterStatus);
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Shield className="h-6 w-6 text-orange-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Aislamiento de Pacientes I-131</h1>
              <p className="text-sm text-gray-500">
                Seguimiento de criterios de alta radiológica — vida media I-131: 8.02 días
              </p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-gray-400">Calculando aislamiento...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar datos.</div>
        ) : (
          <>
            {/* Release criteria info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700">
              <strong>Criterio de alta:</strong> actividad remanente &lt; {stats?.release_threshold_mci} mCi ({stats?.release_threshold_gbq?.toFixed(2)} GBq)
              <span className="mx-2">ó</span>
              tasa de dosis a 1 m &lt; {stats?.release_dose_rate_usv_h} µSv/h <em>(lo que se cumpla primero)</em>
            </div>

            {/* Alert: apto alta */}
            {(stats?.apto_alta ?? 0) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3 text-green-700 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span><strong>{stats?.apto_alta}</strong> paciente(s) apto(s) para alta radiológica — verificar antes de dar el alta.</span>
              </div>
            )}

            {/* KPI Tiles */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "En aislamiento",   value: stats?.en_aislamiento ?? 0, icon: AlertTriangle, color: "orange" },
                { label: "Aptos para alta",  value: stats?.apto_alta ?? 0,       icon: CheckCircle2, color: "green"  },
                { label: "Total seguimiento",value: stats?.total_tracked ?? 0,   icon: User,         color: "blue"   },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {(["all", "en_aislamiento", "apto_alta", "vencido"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
                >
                  {s === "all" ? `Todos (${records.length})` : statusCfg(s).label + ` (${records.filter(r => r.isolation_status === s).length})`}
                </button>
              ))}
            </div>

            {/* Patient cards */}
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Sin registros en este estado.</div>
            ) : (
              <div className="space-y-3">
                {filtered.map(r => {
                  const cfg = statusCfg(r.isolation_status);
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <User className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="font-semibold text-gray-900">{r.paciente_nombre}</span>
                            {r.paciente_run && <span className="text-xs text-gray-400">{r.paciente_run}</span>}
                            {r.ficha_clinica && <span className="text-xs text-gray-400">FC: {r.ficha_clinica}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600 mt-2">
                            <div>
                              <div className="text-gray-400 mb-0.5">Fecha administración</div>
                              <div className="font-medium">{fmtDate(r.admin_date)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 mb-0.5">Días desde adm.</div>
                              <div className="font-medium">{r.days_since_admin} días</div>
                            </div>
                            <div>
                              <div className="text-gray-400 mb-0.5">Dosis administrada</div>
                              <div className="font-medium">{r.dosis_administrada ? r.dosis_administrada + " mCi" : "—"}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 mb-0.5">Actividad remanente</div>
                              <div className={`font-medium ${r.can_release_by_activity ? "text-green-600" : "text-orange-600"}`}>
                                {r.remaining_activity_mci != null ? r.remaining_activity_mci.toFixed(1) + " mCi" : "—"}
                              </div>
                            </div>
                            {r.sala && (
                              <div>
                                <div className="text-gray-400 mb-0.5">Sala</div>
                                <div className="font-medium">{r.sala}</div>
                              </div>
                            )}
                            {r.tasa_dosis && (
                              <div>
                                <div className="text-gray-400 mb-0.5">Tasa de dosis</div>
                                <div className="font-medium">{r.tasa_dosis}</div>
                              </div>
                            )}
                            {r.medico_solicitante && (
                              <div>
                                <div className="text-gray-400 mb-0.5">Médico</div>
                                <div className="font-medium">{r.medico_solicitante}</div>
                              </div>
                            )}
                            {r.diagnostico && (
                              <div>
                                <div className="text-gray-400 mb-0.5">Diagnóstico</div>
                                <div className="font-medium">{r.diagnostico}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Release info */}
                        <div className="text-right shrink-0">
                          {r.isolation_status === "en_aislamiento" ? (
                            <div className="flex flex-col items-end gap-1">
                              <Clock className="h-4 w-4 text-orange-400" />
                              <div className="text-xs text-gray-500">Alta estimada</div>
                              <div className="font-semibold text-sm text-orange-700">{fmtDate(r.estimated_release_date)}</div>
                              <div className="text-xs text-gray-400">{r.days_to_release != null ? r.days_to_release + " días" : ""}</div>
                            </div>
                          ) : r.isolation_status === "apto_alta" ? (
                            <div className="flex flex-col items-end gap-1">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <div className="text-xs font-semibold text-green-700">Criterio cumplido</div>
                              <div className="text-xs text-gray-400">Verificar tasa de dosis</div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Regulatory footer */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°3/1985 MINSAL Art. 32-38 — Criterios de aislamiento y alta para pacientes tratados con I-131.
                ICRP Publication 94 — Release of Patients After Therapy with Unsealed Radionuclides.
                IAEA Safety Standards Series SSG-46 — Radiation Protection and Safety in Medical Uses of Ionizing Radiation.
                NRC Regulatory Guide 8.39 — Release Criteria for Patients Administered Radioactive Materials.
                CCHEN ORD. sobre procedimientos de alta radiológica en Medicina Nuclear.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
