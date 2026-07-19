import { ShieldAlert, FileWarning, CheckCircle2 } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const REQUIREMENTS = [
  { id: "c-1", requirement: "Inspección blindaje Sala 3", regulation: "DS 3/1985 MINSAL", owner: "Oficial de Protección Radiológica", nextReview: "2026-08-01", status: "pending" },
  { id: "c-2", requirement: "Renovación licencia LINAC", regulation: "Reglamento SSS", owner: "Jefe de Servicio", nextReview: "2026-08-01", status: "pending" },
  { id: "c-3", requirement: "Auditoría interna programa ALARA", regulation: "Política interna RPMS", owner: "Comité de Radioprotección", nextReview: "2026-09-15", status: "scheduled" },
  { id: "c-4", requirement: "Verificación dosimetría personal", regulation: "DS 3/1985 MINSAL", owner: "Oficial de Protección Radiológica", nextReview: "2026-07-01", status: "ok" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "text-warning" },
  scheduled: { label: "Programado", className: "text-info" },
  ok: { label: "Al día", className: "text-success" },
};

export default function CompliancePage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Cumplimiento</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Requisitos al día" value={31} href="/compliance" icon={CheckCircle2} />
        <KPICard label="Pendientes" value={4} href="/compliance" icon={FileWarning} tone="warning" />
        <KPICard label="Inspecciones próx. 90 días" value={2} href="/compliance" icon={ShieldAlert} tone="warning" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Requisito</th>
              <th className="px-3 py-2">Normativa</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Próxima revisión</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {REQUIREMENTS.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{r.requirement}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.regulation}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.owner}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.nextReview}</td>
                <td className={`px-3 py-2.5 ${STATUS_LABEL[r.status].className}`}>{STATUS_LABEL[r.status].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
