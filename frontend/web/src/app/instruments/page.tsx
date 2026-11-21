import { sql } from "@vercel/postgres";
import { Wrench, ClipboardCheck, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface InstrumentRow {
  id: number;
  name: string;
  type: string;
  serial_number: string | null;
  last_calibration_date: string | null;
  next_calibration_date: string | null;
  status: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ok: { label: "Vigente", className: "text-success" },
  expiring: { label: "Por vencer", className: "text-warning" },
  expired: { label: "Vencido", className: "text-danger" },
};

export default async function InstrumentsPage() {
  let instruments: InstrumentRow[] = [];
  let totalCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;

  try {
    const { rows } = await sql`
      SELECT id, name, type, serial_number,
             last_calibration_date::text, next_calibration_date::text, status
      FROM instruments
      ORDER BY next_calibration_date ASC
    `;
    instruments = rows as InstrumentRow[];
    totalCount = instruments.length;
    expiringCount = instruments.filter((r) => r.status === "expiring").length;
    expiredCount = instruments.filter((r) => r.status === "expired").length;
  } catch {
    // La tabla puede no existir aún
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Instrumentos de Medición</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Instrumentos registrados" value={totalCount} href="/instruments" icon={Wrench} />
        <KPICard label="Calibraciones por vencer" value={expiringCount} href="/instruments" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Vencidos" value={expiredCount} href="/instruments" icon={AlertTriangle} tone="danger" />
      </div>

      {instruments.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No hay instrumentos registrados. Ejecuta <code className="font-mono text-xs">/api/init</code> para inicializar las tablas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Instrumento</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">N° Serie</th>
                <th className="px-3 py-2">Última cal.</th>
                <th className="px-3 py-2">Próxima cal.</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {instruments.map((ins) => {
                const st = STATUS_LABEL[ins.status] ?? { label: ins.status, className: "" };
                return (
                  <tr key={ins.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium">{ins.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ins.type}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{ins.serial_number ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ins.last_calibration_date ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ins.next_calibration_date ?? "—"}</td>
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
