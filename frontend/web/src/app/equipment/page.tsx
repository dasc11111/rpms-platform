import { Radio, Ban, ClipboardCheck, Wrench } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const EQUIPMENT = [
  { id: "e-1", name: "Varian TrueBeam", type: "LINAC", service: "Radioterapia", room: "Sala 3", lastQA: "2026-06-02", nextQA: "2026-07-02", status: "operational" },
  { id: "e-2", name: "Siemens Somatom", type: "Tomógrafo (TC)", service: "Radiodiagnóstico", room: "Sala 1", lastQA: "2026-05-20", nextQA: "2026-08-20", status: "operational" },
  { id: "e-3", name: "GE Discovery", type: "Gamma cámara SPECT", service: "Medicina Nuclear", room: "Sala 2", lastQA: "2026-04-15", nextQA: "2026-07-15", status: "pending" },
  { id: "e-4", name: "Philips DigitalDiagnost", type: "Equipo Rx", service: "Radiodiagnóstico", room: "Sala 4", lastQA: "2026-03-10", nextQA: "2026-06-10", status: "out_of_service" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  operational: { label: "Operativo", className: "text-success" },
  pending: { label: "QA pendiente", className: "text-warning" },
  out_of_service: { label: "Fuera de servicio", className: "text-danger" },
};

export default function EquipmentPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Equipos</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Equipos registrados" value={42} href="/equipment" icon={Radio} />
        <KPICard label="Fuera de servicio" value={2} href="/equipment" icon={Ban} tone="danger" />
        <KPICard label="QA pendientes" value={8} href="/equipment" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Mantenciones abiertas" value={3} href="/equipment" icon={Wrench} tone="warning" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Equipo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Servicio / Sala</th>
              <th className="px-3 py-2">Última QA</th>
              <th className="px-3 py-2">Próxima QA</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {EQUIPMENT.map((e) => (
              <tr key={e.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{e.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.type}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.service} · {e.room}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.lastQA}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.nextQA}</td>
                <td className={`px-3 py-2.5 ${STATUS_LABEL[e.status].className}`}>{STATUS_LABEL[e.status].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
