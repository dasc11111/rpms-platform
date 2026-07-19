import { BarChart3, FileText } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const REPORTS = [
  { id: "rep-1", name: "Informe dosimétrico mensual", type: "Dosimetría", period: "Junio 2026", generated: "2026-07-02", format: "PDF" },
  { id: "rep-2", name: "Reporte de cumplimiento normativo", type: "Cumplimiento", period: "2do trimestre 2026", generated: "2026-07-05", format: "PDF" },
  { id: "rep-3", name: "Estado de equipos y QA", type: "Equipos", period: "Junio 2026", generated: "2026-07-01", format: "XLSX" },
  { id: "rep-4", name: "Resumen de incidentes", type: "Incidentes", period: "2do trimestre 2026", generated: "2026-07-03", format: "PDF" },
];

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Reportes</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Reportes generados (mes)" value={12} href="/reports" icon={FileText} />
        <KPICard label="Programados" value={4} href="/reports" icon={BarChart3} tone="info" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Reporte</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2">Generado</th>
              <th className="px-3 py-2">Formato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {REPORTS.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{r.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.type}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.period}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.generated}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.format}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
