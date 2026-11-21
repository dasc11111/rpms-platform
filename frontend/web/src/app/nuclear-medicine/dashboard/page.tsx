import { NuclearMedicineDashboard } from "@/components/nuclear-medicine/nm-dashboard";

export const dynamic = "force-dynamic";

export default function NuclearMedicineDashboardPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard de Medicina Nuclear</h1>
      </div>
      <p className="mb-6 max-w-3xl text-xs text-muted-foreground">
        Vista consolidada de solo lectura de los modulos de Medicina Nuclear (I-131,
        Contaminacion, Liberacion de Sala y Gestion de Residuos). Corresponde a la Fase 8
        (propuesta en el informe de Fase 0), implementada como agregacion de datos ya
        existentes, sin nuevos calculos ni cambios en los modulos operativos.
      </p>
      <NuclearMedicineDashboard />
    </div>
  );
}
