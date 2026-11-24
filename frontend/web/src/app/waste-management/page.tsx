import { WasteManagementApp } from "@/components/room-release/waste-management-app";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

export const dynamic = "force-dynamic";

export default function WasteManagementPage() {
  return (
    <div>
      <WasteManagementApp />
      <div className="px-6 pb-6">
        <ModulePdfPanel
          module="waste-management"
          ownerType="module"
          title="Documentos del módulo Gestión de Residuos"
        />
      </div>
    </div>
  );
}
