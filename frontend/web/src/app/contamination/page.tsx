import { ContaminationApp } from "@/components/contamination/contamination-app";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

export const dynamic = "force-dynamic";

export default function ContaminationPage() {
    return (
      <div>
        <ContaminationApp />
        <div className="px-6 pb-6">
          <ModulePdfPanel
            module="contamination"
            ownerType="module"
            title="Documentos del módulo Contaminación"
          />
        </div>
      </div>
    );
}
