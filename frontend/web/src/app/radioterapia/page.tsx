"use client";

export const dynamic = "force-dynamic";

import { RadioterapiaApp } from "@/components/radioterapia/radioterapia-app";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

export default function RadioterapiaPage() {
  return (
    <div>
      <RadioterapiaApp />
      <div className="px-6 pb-6">
        <ModulePdfPanel
          module="radioterapia"
          ownerType="module"
          title="Documentos del módulo Radioterapia"
        />
      </div>
    </div>
  );
}
