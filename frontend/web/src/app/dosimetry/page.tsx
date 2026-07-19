import { Activity, Package, Search, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { CsvImport } from "@/components/import/csv-import";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  read: { label: "Leído", className: "text-success" },
  pending: { label: "Pendiente", className: "text-warning" },
  lost: { label: "Extraviado", className: "text-danger" },
};

type Reading = {
  worker_rut: string | null;
  worker_name: string;
  dosimeter_type: string | null;
  period: string;
  dose: string;
  status: string;
};

async function getReadings(): Promise<Reading[]> {
  try {
    const { rows } = await sql`
      SELECT worker_rut, worker_name, dosimeter_type, period, dose, status
      FROM dosimetry_readings
      ORDER BY period DESC, worker_name ASC
    `;
    return rows as Reading[];
  } catch {
    return [];
  }
}

export default async function DosimetryPage() {
  const readings = await getReadings();
  const total = readings.length;
  const pending = readings.filter((r) => r.status === "pending").length;
  const lost = readings.filter((r) => r.status === "lost").length;
  const outOfRange = readings.filter((r) => Number(r.dose) > 1).length;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Dosimetría</h1>
      <CsvImport
        endpoint="/api/dosimetry"
        label="Importar CSV de dosimetría"
        hint="Columnas: rut, trabajador, tipo_dosimetro, periodo, dosis, estado"
      />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Lecturas registradas" value={total} href="/dosimetry" icon={Activity} />
        <KPICard label="Pendientes" value={pending} href="/dosimetry" icon={Package} tone="warning" />
        <KPICard label="Extraviados" value={lost} href="/dosimetry" icon={Search} tone="danger" />
        <KPICard label="Lecturas fuera de rango" value={outOfRange} href="/dosimetry" icon={AlertTriangle} tone="danger" />
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
            {readings.map((r, i) => {
              const st = STATUS_LABEL[r.status] ?? { label: r.status, className: "text-muted-foreground" };
              return (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{r.worker_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.dosimeter_type}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.period}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose).toFixed(2)}</td>
                  <td className={`px-3 py-2.5 ${st.className}`}>{st.label}</td>
                </tr>
              );
            })}
            {readings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No hay lecturas dosimétricas cargadas todavía. Importa un CSV para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
