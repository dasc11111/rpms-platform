import { NuclearMedicineAlertsApp } from "@/components/nuclear-medicine/nm-alerts-app";

export const dynamic = "force-dynamic";

export default function NuclearMedicineAlertsPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Alertas de Medicina Nuclear</h1>
      </div>
      <p className="mb-6 max-w-3xl text-xs text-muted-foreground">
        Vista consolidada de solo lectura que agrega alertas ya calculadas por los modulos existentes
        (Contaminacion, Liberacion de Sala, Gestion de Residuos, Instrumentos y Calibracion, Transporte).
        Corresponde a la Fase 10 (propuesta en el informe de Fase 0), implementada como agregacion de datos
        ya existentes, sin nuevos calculos, limites ni cambios en los modulos operativos. No incluye datos de
        Control de Calidad (fuera de alcance, seccion 2 del prompt maestro).
      </p>
      <NuclearMedicineAlertsApp />
    </div>
  );
}
