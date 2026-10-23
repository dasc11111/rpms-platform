"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, Download, FileText, XCircle } from "lucide-react";

const _qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleStatus = "ok" | "warning" | "danger";

interface ModuleKPI {
  label: string;
  value: number | string;
  status: ModuleStatus;
  detail?: string | null;
  ok?: number;
  pendiente?: number;
  vencido?: number;
}

interface ReportSummary {
  generated_at: string;
  modules: Record<string, ModuleKPI>;
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ModuleStatus }) {
  if (status === "ok") return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (status === "warning") return <Clock className="h-5 w-5 text-yellow-500" />;
  return <XCircle className="h-5 w-5 text-red-500" />;
}

const STATUS_BG: Record<ModuleStatus, string> = {
  ok: "bg-green-50 border-green-200",
  warning: "bg-yellow-50 border-yellow-200",
  danger: "bg-red-50 border-red-200",
};

const STATUS_TEXT: Record<ModuleStatus, string> = {
  ok: "text-green-700",
  warning: "text-yellow-700",
  danger: "text-red-700",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function ModuleCard({ id, kpi }: { id: string; kpi: ModuleKPI }) {
  const LINKS: Record<string, string> = {
    workers: "/workers",
    dosimetry: "/dosimetry",
    i131: "/i131",
    incidents: "/incidents",
    compliance: "/compliance",
    instruments: "/instruments",
    waste: "/waste-records",
  };

  return (
    <div className={`rounded-lg border p-4 ${STATUS_BG[kpi.status]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-medium ${STATUS_TEXT[kpi.status]} opacity-80`}>{kpi.label}</p>
          <p className={`mt-1 text-2xl font-bold ${STATUS_TEXT[kpi.status]}`}>{kpi.value}</p>
          {kpi.detail && (
            <p className={`mt-0.5 text-xs ${STATUS_TEXT[kpi.status]} opacity-70`}>{kpi.detail}</p>
          )}
          {/* Compliance breakdown */}
          {id === "compliance" && (kpi.ok !== undefined) && (
            <div className="mt-2 flex gap-2 text-xs">
              <span className="text-green-600">{kpi.ok} OK</span>
              <span className="text-yellow-600">{kpi.pendiente} pend.</span>
              <span className="text-red-600">{kpi.vencido} venc.</span>
            </div>
          )}
        </div>
        <StatusIcon status={kpi.status} />
      </div>
      {LINKS[id] && (
        <a href={LINKS[id]} className={`mt-3 block text-xs underline underline-offset-2 ${STATUS_TEXT[kpi.status]} opacity-70 hover:opacity-100`}>
          Ver módulo →
        </a>
      )}
    </div>
  );
}

// ─── Report types ─────────────────────────────────────────────────────────────

// exportType = undefined means not yet available (shows disabled button)
const REPORT_TYPES = [
  {
    id: "dosimetry",
    name: "Informe Dosimétrico — Lecturas trimestrales",
    description: "Dosis individuales Hp(10) y Hp(0.07) por trabajador y servicio. DS 3/1985 MINSAL.",
    format: "CSV",
    regulation: "DS 3/1985",
    exportType: "dosimetry",
  },
  {
    id: "compliance",
    name: "Reporte de Cumplimiento Normativo",
    description: "Estado de requisitos DS 133/1984, DS 3/1985, Ley 18.302, NCh 2764, CCHEN.",
    format: "CSV",
    regulation: "DS 133/1984 · Ley 18.302",
    exportType: "compliance",
  },
  {
    id: "i131",
    name: "Registro Administración I-131",
    description: "Libro de administraciones de Yodo-131. Criterios de aislamiento DS 3/1985.",
    format: "CSV",
    regulation: "DS 3/1985",
    exportType: "i131",
  },
  {
    id: "incidents",
    name: "Resumen de Incidentes Radiológicos",
    description: "Incidentes, cuasi-accidentes y acciones correctivas del período.",
    format: "CSV",
    regulation: "DS 133/1984 · CCHEN",
    exportType: "incidents",
  },
  {
    id: "waste",
    name: "Informe de Gestión de Residuos Radiactivos",
    description: "Inventario, almacenamiento y disposición de residuos. Formularios CCHEN.",
    format: "CSV",
    regulation: "Ley 18.302",
    exportType: "waste",
  },
  {
    id: "summary",
    name: "Resumen Ejecutivo SPRM",
    description: "Consolidado de indicadores de todos los módulos del sistema.",
    format: "CSV",
    regulation: "DS 133/1984 · DS 3/1985",
    exportType: "summary",
  },
  {
    id: "equipment",
    name: "Estado de Equipos y Control de Calidad",
    description: "Equipos, calibraciones, mantenimientos y resultados QC.",
    format: "PDF",
    regulation: "DS 133/1984",
    exportType: undefined as string | undefined,
  },
];

// ─── Main App ─────────────────────────────────────────────────────────────────

function ReportsAppInner() {
  const { data, isLoading, error } = useQuery<ReportSummary>({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const modules = data?.modules ?? {};
  const generatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })
    : null;

  // Global status
  const statuses = Object.values(modules).map((m) => m.status);
  const hasDanger = statuses.includes("danger");
  const hasWarning = statuses.includes("warning");
  const globalStatus: ModuleStatus = hasDanger ? "danger" : hasWarning ? "warning" : "ok";
  const globalLabel = hasDanger ? "Requiere atención urgente" : hasWarning ? "Revisar alertas" : "Sistema en norma";

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reportes y Resumen Ejecutivo</h1>
          <p className="text-xs text-muted-foreground">
            Estado consolidado del Sistema de Protección Radiológica (SPRM). DS 133/1984, DS 3/1985, Ley 18.302, CCHEN.
          </p>
        </div>
        {generatedAt && (
          <span className="text-xs text-muted-foreground">Actualizado: {generatedAt}</span>
        )}
      </div>

      {/* Global status banner */}
      {!isLoading && !error && (
        <div className={`mb-5 flex items-center gap-3 rounded-lg border p-4 ${STATUS_BG[globalStatus]}`}>
          <StatusIcon status={globalStatus} />
          <div>
            <p className={`font-semibold ${STATUS_TEXT[globalStatus]}`}>{globalLabel}</p>
            <p className={`text-xs ${STATUS_TEXT[globalStatus]} opacity-70`}>
              {Object.values(modules).filter((m) => m.status === "ok").length} módulos en norma ·{" "}
              {Object.values(modules).filter((m) => m.status === "warning").length} con alertas ·{" "}
              {Object.values(modules).filter((m) => m.status === "danger").length} urgentes
            </p>
          </div>
        </div>
      )}

      {/* KPI grid */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Cargando datos...</div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-red-500">Error cargando datos: {String(error)}</div>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(modules).map(([id, kpi]) => (
            <ModuleCard key={id} id={id} kpi={kpi} />
          ))}
        </div>
      )}

      {/* Report types */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Informes disponibles
        </h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Informe</th>
                <th className="px-3 py-2 hidden sm:table-cell">Regulación</th>
                <th className="px-3 py-2 hidden md:table-cell">Formato</th>
                <th className="px-3 py-2 text-right">Generar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {REPORT_TYPES.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{r.regulation}</span>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{r.format}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {r.exportType ? (
                      <a
                        href={`/api/reports/export?type=${r.exportType}`}
                        download
                        className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        title={`Descargar ${r.name} en CSV`}
                      >
                        <Download className="h-3 w-3" />
                        CSV
                      </a>
                    ) : (
                      <button
                        className="rounded border border-border px-2.5 py-1 text-xs opacity-40 cursor-not-allowed"
                        disabled
                        title="Disponible próximamente"
                      >
                        Próximo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Exportación CSV disponible para todos los módulos. Exportación PDF en próxima versión.
        </p>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function ReportsApp() {
  return (
    <QueryClientProvider client={_qc}>
      <ReportsAppInner />
    </QueryClientProvider>
  );
}
