import { WasteRecordsApp } from "@/components/waste/waste-records-app";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

export const dynamic = "force-dynamic";

export default function WasteRecordsPage() {
  return (
    <div>
      <WasteRecordsApp />
      <div className="px-6 pb-6">
        <ModulePdfPanel
          module="waste-records"
          ownerType="module"
          title="Documentos del módulo Registros de Residuos"
        />
      </div>
    </div>
  );
}
