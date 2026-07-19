import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const INCIDENTS = [
  { id: "inc-1", title: "Exposición accidental - Sala 3", date: "2026-06-18", severity: "high", service: "Radioterapia", status: "open" },
  { id: "inc-2", title: "Falla de blindaje puerta - Sala 1", date: "2026-06-10", severity: "medium", service: "Radiodiagnóstico", status: "investigating" },
  { id: "inc-3", title: "Dosímetro extraviado", date: "2026-05-28", severity: "low", service: "Medicina Nuclear", status: "closed" },
  { id: "inc-4", title: "Alarma de radiación fuera de rango", date: "2026-05-14", severity: "medium", service: "Medicina Nuclear", status: "closed" },
];

const SEVERITY_LABEL: Record<string, { label: string; className: string }> = {
  high: { label: "Alta", className: "text-danger" },
  medium: { label: "Media", className: "text-warning" },
  low: { label: "Baja", className: "text-muted-foreground" },
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  open: { label: "Abierto", className: "text-danger" },
  investigating: { label: "En investigación", className: "text-warning" },
  closed: { label: "Cerrado", className: "text-success" },
};

export default function IncidentsPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Incidentes</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Incidentes abiertos" value={1} href="/incidents" icon={AlertTriangle} tone="danger" />
        <KPICard label="En investigación" value={1} href="/incidents" icon={Clock} tone="warning" />
        <KPICard label="Cerrados (año)" value={14} href="/incidents" icon={CheckCircle2} />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Incidente</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Severidad</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {INCIDENTS.map((i) => {
              const sev = SEVERITY_LABEL[i.severity] ?? { label: i.severity, className: "text-muted-foreground" };
              const st = STATUS_LABEL[i.status] ?? { label: i.status, className: "text-muted-foreground" };
              return (
                <tr key={i.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{i.title}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{i.date}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{i.service}</td>
                  <td className={`px-3 py-2.5 ${sev.className}`}>{sev.label}</td>
                  <td className={`px-3 py-2.5 ${st.className}`}>{st.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
