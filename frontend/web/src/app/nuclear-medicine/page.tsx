import Link from "next/link";
import {
  Syringe,
  Biohazard,
  Trash2,
  Recycle,
  Users,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

type ModuleCard = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  status: "activo" | "proximo";
  phase?: string;
};

const NUCLEO_OPERACIONAL: ModuleCard[] = [
  {
    href: "/i131",
    label: "Administracion de I-131",
    description: "Registro de administraciones de radiofarmacos, dosis, pacientes y restricciones post-tratamiento.",
    icon: Syringe,
    status: "activo",
  },
  {
    href: "/contamination",
    label: "Contaminacion",
    description: "Monitoreo, limites y registro historico de contaminacion superficial y personal.",
    icon: Biohazard,
    status: "activo",
  },
  {
    href: "/room-release",
    label: "Liberacion de Sala",
    description: "Criterios y actas de liberacion de habitaciones tras hospitalizacion con radiofarmacos.",
    icon: Trash2,
    status: "activo",
  },
  {
    href: "/waste-management",
    label: "Gestion de Residuos Radiactivos",
    description: "Inventario, ubicaciones, movimientos y decaimiento de residuos radiactivos.",
    icon: Recycle,
    status: "activo",
  },
];

const TRAZABILIDAD: ModuleCard[] = [
  {
    href: "/nuclear-medicine/patients",
    label: "Pacientes y Tratamientos",
    description: "Vista de trazabilidad de solo lectura: combina I-131 y Liberacion de Sala por RUN del paciente. No crea ni modifica registros.",
    icon: Users,
    status: "activo",
    phase: "Fase 1 (nuevo)",
  },
];

const ANALITICA: ModuleCard[] = [
  {
    href: "/nuclear-medicine/dashboard",
    label: "Dashboard de Medicina Nuclear",
    description: "Vista consolidada de solo lectura: agrega los indicadores ya calculados por I-131, Contaminacion, Liberacion de Sala y Residuos. No crea ni modifica registros.",
    icon: BarChart3,
    status: "activo",
    phase: "Fase 8 (nuevo)",
  },
];

const PROXIMAMENTE: ModuleCard[] = [
  {
    href: "/nuclear-medicine/incidents",
    label: "Emergencias e Incidentes (MN)",
    description: "Registro cualitativo de derrames, perdida de material, exposiciones y notificacion de incidentes. Severidad clasificada manualmente, sin umbrales numericos automaticos.",
    icon: AlertTriangle,
    status: "activo",
    phase: "Fase 12 (nuevo)",
  }, {
    href: "#",
    label: "Alertas de Medicina Nuclear",
    description: "Alertas criticas, medias e informativas basadas en normativa chilena y procedimientos internos.",
    icon: ShieldAlert,
    status: "proximo",
    phase: "Fase 10 (propuesta)",
  },
];

function ModuleGrid({ items }: { items: ModuleCard[] }) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((m) => {
        const Icon = m.icon;
        if (m.status === "activo") {
          return (
            <Link
              key={m.href}
              href={m.href}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-accent" strokeWidth={2} />
                <span className="text-sm font-medium">{m.label}</span>
                {m.phase && (
                  <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent-subtle text-foreground">
                    {m.phase}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{m.description}</p>
            </Link>
          );
        }
        return (
          <div
            key={m.label}
            className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-surface/50 p-4 opacity-70"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              <span className="text-sm font-medium">{m.label}</span>
              {m.phase && (
                <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                  {m.phase}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{m.description}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function NuclearMedicinePage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Medicina Nuclear</h1>
      </div>
      <p className="mb-6 max-w-3xl text-xs text-muted-foreground">
        Punto de entrada unificado para los modulos de Medicina Nuclear. Los modulos existentes se mantienen
        operativos sin cambios; esta vista los organiza conforme al mapeo realizado en la Fase 0 (auditoria),
        usando ARPANSA RPS 14.2 como referencia tecnica estructural, no como normativa chilena.
      </p>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Nucleo operacional (en produccion)</h2>
      </div>
      <ModuleGrid items={NUCLEO_OPERACIONAL} />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Trazabilidad</h2>
      </div>
      <ModuleGrid items={TRAZABILIDAD} />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Analitica</h2>
      </div>
      <ModuleGrid items={ANALITICA} />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Proximamente (diseno Fase 0, pendiente de autorizacion)</h2>
      </div>
      <ModuleGrid items={PROXIMAMENTE} />

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Documentacion de referencia</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          ARPANSA RPS 14.2 (Radiation Protection in Nuclear Medicine) es la referencia tecnica estructural
          utilizada para auditar y disenar esta seccion. No debe interpretarse como normativa chilena; los
          requisitos regulatorios vigentes estan en Documentos, Medicina Nuclear, Normativa Nacional.
        </p>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          Ir a Documentos <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
