import { sql } from "@/lib/db";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface IncidentRow {
  id: number;
  title: string;
  incident_date: string;
  service: string | null;
  severity: string;
  status: string;
}

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

export default async function IncidentsPage() {
  let incidents: IncidentRow[] = [];
  let openCount = 0;
  let investigatingCount = 0;
  let closedCount = 0;

  try {
    const { rows } = await sql`
      SELECT id, title, incident_date::text, service, severity, status
      FROM incidents
      ORDER BY incident_date DESC
      LIMIT 50
    `;
    incidents = rows as IncidentRow[];
    openCount = incidents.filter((r) => r.status === "open").length;
    investigatingCount = incidents.filter((r) => r.status === "investigating").length;
    closedCount = incidents.filter((r) => r.status === "closed").length;
  } catch {
    // La tabla puede no existir aún — mostrar vacío y esperar init
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Incidentes</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Incidentes abiertos" value={openCount} href="/incidents" icon={AlertTriangle} tone="danger" />
        <KPICard label="En investigación" value={investigatingCount} href="/incidents" icon={Clock} tone="warning" />
        <KPICard label="Cerrados" value={closedCount} href="/incidents" icon={CheckCircle2} />
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No hay incidentes registrados. Ejecuta <code className="font-mono text-xs">/api/init</code> para inicializar las tablas.
        </div>
      ) : (
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
              {incidents.map((inc) => {
                const sev = SEVERITY_LABEL[inc.severity] ?? { label: inc.severity, className: "" };
                const st = STATUS_LABEL[inc.status] ?? { label: inc.status, className: "" };
                return (
                  <tr key={inc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium">{inc.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{inc.incident_date}</td>
                    <td className="px-3 py-2 text-muted-foreground">{inc.service ?? "—"}</td>
                    <td className={`px-3 py-2 font-medium ${sev.className}`}>{sev.label}</td>
                    <td className={`px-3 py-2 font-medium ${st.className}`}>{st.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
