"use client";

/**
 * Panel de Aislamiento I-131
 * Monitoreo de pacientes en aislamiento post-administración de I-131
 * DS 3/1985 MINSAL - Criterio alta: actividad < 30 mCi (1.11 GBq) o tasa dosis < 25 μSv/h a 1m
 */
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, ShieldCheck } from "lucide-react";

const _qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

interface IsolationRecord {
  id: number;
  admin_date: string;
  paciente_nombre: string;
  paciente_run: string | null;
  ficha_clinica: string | null;
  sala: string | null;
  dosis_administrada: number;
  tasa_dosis: string | null;
  medico_solicitante: string | null;
  diagnostico: string | null;
  days_since_admin: number;
  remaining_activity_mci: number;
  estimated_release_date: string;
  days_to_release: number;
  isolation_status: "en_aislamiento" | "apto_alta" | "vencido";
  can_release_by_activity: boolean;
  release_threshold_mci: number;
}

interface IsolationStats {
  en_aislamiento: number;
  apto_alta: number;
  total_tracked: number;
  release_threshold_mci: number;
  release_threshold_gbq: number;
  release_dose_rate_usv_h: number;
}

const STATUS_CONFIG = {
  en_aislamiento: {
    label: "En aislamiento",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: AlertTriangle,
    iconClass: "text-red-500",
  },
  apto_alta: {
    label: "Apto para alta",
    bg: "bg-green-50 border-green-200",
    text: "text-green-700",
    icon: CheckCircle,
    iconClass: "text-green-500",
  },
  vencido: {
    label: "Seguimiento vencido",
    bg: "bg-muted/40 border-border",
    text: "text-muted-foreground",
    icon: Clock,
    iconClass: "text-muted-foreground",
  },
};

function ActivityBar({ remaining, initial }: { remaining: number; initial: number }) {
  const pct = Math.min(100, (remaining / initial) * 100);
  const threshold_pct = Math.min(100, (30 / initial) * 100);
  return (
    <div className="relative h-3 w-full rounded-full bg-muted">
      {/* Threshold marker */}
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 opacity-50"
        style={{ left: `${threshold_pct}%` }}
        title="Umbral de alta (30 mCi)"
      />
      <div
        className={`h-full rounded-full transition-all ${pct <= threshold_pct ? "bg-green-400" : "bg-red-400"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function I131IsolationPanelInner() {
  const { data, isLoading, error } = useQuery<{ data: IsolationRecord[]; stats: IsolationStats }>({
    queryKey: ["i131-isolation"],
    queryFn: async () => {
      const res = await fetch("/api/i131/isolation");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // refresca cada 5 min
  });

  const stats = data?.stats;
  const records = data?.data ?? [];

  return (
    <div>
      {/* Info banner */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="text-xs text-accent">
          <p className="font-semibold">Criterios de alta DS 3/1985 MINSAL</p>
          <p className="mt-0.5">
            El paciente puede ser dado de alta del aislamiento cuando se cumpla el primer criterio:
            <br />
            • Actividad remanente &lt; <strong>30 mCi (1.11 GBq)</strong>, O
            <br />
            • Tasa de dosis a 1 m &lt; <strong>25 μSv/h</strong>
            <br />
            Vida media física I-131: <strong>8.02 días</strong>
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.en_aislamiento}</p>
            <p className="text-xs text-red-600 font-medium mt-0.5">En aislamiento</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.apto_alta}</p>
            <p className="text-xs text-green-600 font-medium mt-0.5">Aptos para alta</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-2xl font-bold">{stats.total_tracked}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Total seguimiento (30 días)</p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Calculando estado de aislamiento...</div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-red-500">Error: {String(error)}</div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-12 text-center text-sm text-muted-foreground">
          No hay administraciones de I-131 en seguimiento (últimos 30 días).
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Sala</th>
                <th className="px-3 py-2">Admin.</th>
                <th className="px-3 py-2">Días</th>
                <th className="px-3 py-2">Dosis inicial</th>
                <th className="px-3 py-2">Actividad remanente</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Alta estimada</th>
                <th className="px-3 py-2">Tasa dosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {records.map((rec) => {
                const cfg = STATUS_CONFIG[rec.isolation_status];
                const StatusIcon = cfg.icon;
                return (
                  <tr key={rec.id} className={`hover:bg-muted/30 ${rec.isolation_status === "apto_alta" ? "bg-green-50/30" : ""}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-sm">{rec.paciente_nombre}</p>
                      {rec.paciente_run && (
                        <p className="text-xs text-muted-foreground">{rec.paciente_run}</p>
                      )}
                      {rec.ficha_clinica && (
                        <p className="text-xs text-muted-foreground">FC: {rec.ficha_clinica}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{rec.sala ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(rec.admin_date).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-sm font-semibold tabular-nums">{rec.days_since_admin}</span>
                      <span className="text-xs text-muted-foreground ml-0.5">d</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {rec.dosis_administrada.toFixed(0)} mCi
                      <span className="text-muted-foreground ml-1">
                        ({((rec.dosis_administrada * 37) / 1000).toFixed(2)} GBq)
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <span className={`text-xs font-semibold ${rec.can_release_by_activity ? "text-green-600" : "text-red-600"}`}>
                          {rec.remaining_activity_mci} mCi
                        </span>
                        <ActivityBar remaining={rec.remaining_activity_mci} initial={rec.dosis_administrada} />
                        <span className="text-[10px] text-muted-foreground">
                          umbral: {rec.release_threshold_mci} mCi
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        <StatusIcon className={`h-3 w-3 ${cfg.iconClass}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {rec.isolation_status === "apto_alta" ? (
                        <span className="text-green-600 font-semibold">Ahora</span>
                      ) : (
                        <>
                          <p>{new Date(rec.estimated_release_date).toLocaleDateString("es-CL")}</p>
                          <p className="text-muted-foreground">{rec.days_to_release}d restantes</p>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{rec.tasa_dosis ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        * Actividad remanente calculada por decaimiento físico (T½ = 8.02 días). La decisión de alta
        debe considerar también la medición directa de tasa de dosis a 1 m. DS 3/1985 MINSAL.
      </p>
    </div>
  );
}

export function I131IsolationPanel() {
  return (
    <QueryClientProvider client={_qc}>
      <I131IsolationPanelInner />
    </QueryClientProvider>
  );
}
