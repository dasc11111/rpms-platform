import { Wrench, ClipboardCheck, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const INSTRUMENTS = [
  { id: "ins-1", name: "Cámara de ionización Fluke 451P", serial: "SN-88213", lastCal: "2026-02-10", nextCal: "2027-02-10", status: "ok" },
  { id: "ins-2", name: "Contador Geiger-Müller RadEye", serial: "SN-44120", lastCal: "2025-11-05", nextCal: "2026-11-05", status: "ok" },
  { id: "ins-3", name: "Sonda de contaminación superficial", serial: "SN-90871", lastCal: "2025-08-01", nextCal: "2026-08-01", status: "expiring" },
  { id: "ins-4", name: "Dosímetro de área TLD", serial: "SN-12903", lastCal: "2025-05-15", nextCal: "2026-05-15", status: "expired" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ok: { label: "Vigente", className: "text-success" },
  expiring: { label: "Por vencer", className: "text-warning" },
  expired: { label: "Vencido", className: "text-danger" },
};

export default function InstrumentsPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Instrumentos</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Instrumentos registrados" value={19} href="/instruments" icon={Wrench} />
        <KPICard label="Calibraciones por vencer" value={1} href="/instruments" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Vencidos" value={1} href="/instruments" icon={AlertTriangle} tone="danger" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Instrumento</th>
              <th className="px-3 py-2">N° Serie</th>
              <th className="px-3 py-2">Última calibración</th>
              <th className="px-3 py-2">Próxima calibración</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {INSTRUMENTS.map((i) => {
              const st = STATUS_LABEL[i.status] ?? { label: i.status, className: "text-muted-foreground" };
              return (
                <tr key={i.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{i.name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i.serial}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{i.lastCal}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{i.nextCal}</td>
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
