import { Activity, Package, Search, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const READINGS = [
  { id: "d-1", worker: "Javiera Muñoz", type: "TLD cuerpo entero", period: "2026-06", dose: 0.28, status: "read" },
  { id: "d-2", worker: "Marcelo Rojas", type: "TLD cuerpo entero", period: "2026-06", dose: 0.34, status: "read" },
  { id: "d-3", worker: "Camila Torres", type: "OSL anillo", period: "2026-06", dose: 0.05, status: "read" },
  { id: "d-4", worker: "Andrés Silva", type: "TLD cuerpo entero", period: "2026-06", dose: 0.19, status: "pending" },
  { id: "d-5", worker: "Andrés Silva", type: "TLD cuerpo entero", period: "2026-05", dose: 0.22, status: "lost" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  read: { label: "Leído", className: "text-success" },
  pending: { label: "Pendiente", className: "text-warning" },
  lost: { label: "Extraviado", className: "text-danger" },
};

export default function DosimetryPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Dosimetría</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Dosímetros activos" value={224} href="/dosimetry" icon={Activity} />
        <KPICard label="Pend. devolver" value={7} href="/dosimetry" icon={Package} tone="warning" />
        <KPICard label="Extraviados" value={2} href="/dosimetry" icon={Search} tone="danger" />
        <KPICard label="Lecturas fuera de rango" value={1} href="/dosimetry" icon={AlertTriangle} tone="danger" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">Tipo dosímetro</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2 text-right">Dosis (mSv)</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {READINGS.map((r) => {
              const st = STATUS_LABEL[r.status] ?? { label: r.status, className: "text-muted-foreground" };
              return (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{r.worker}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.type}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.period}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{r.dose.toFixed(2)}</td>
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
