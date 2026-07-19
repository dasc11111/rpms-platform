import Link from "next/link";
import { sql } from "@/lib/db";
import { CsvImport } from "@/components/import/csv-import";
import { WorkerFormModal } from "@/components/workers/worker-form-modal";
import { StatusActionButton } from "@/components/workers/status-action-button";
import { WorkerEditModal } from "@/components/workers/worker-edit-modal";

export const dynamic = "force-dynamic";

type WorkerRow = {
  rut: string;
  name: string;
  role: string | null;
  service: string | null;
  category: string | null;
  status: string;
  annual_dose: string;
  dv: string | null;
  sex: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  estamento: string | null;
  contract_type: string | null;
  unit: string | null;
};

async function getWorkers(): Promise<WorkerRow[]> {
  try {
    const { rows } = await sql`
      SELECT rut, name, role, service, category, status, annual_dose,
             dv, sex, address, phone, email, birth_date, estamento, contract_type, unit
      FROM workers
      WHERE status <> 'inactive'
      ORDER BY name ASC
    `;
    return rows as WorkerRow[];
  } catch {
    return [];
  }
}

async function getInactiveCount(): Promise<number> {
  try {
    const { rows } = await sql`SELECT COUNT(*)::int AS count FROM workers WHERE status = 'inactive'`;
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function WorkersPage() {
  const [workers, inactiveCount] = await Promise.all([getWorkers(), getInactiveCount()]);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trabajadores</h1>
        <Link
          href="/workers/inactive"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Ver trabajadores inactivos ({inactiveCount})
        </Link>
      </div>
      <WorkerFormModal />
      <CsvImport
        endpoint="/api/workers"
        label="Importar CSV de trabajadores"
        hint="Columnas: rut, nombre, cargo, servicio, categoria, estado, dosis_anual"
      />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">RUT</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Dosis 2026</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {workers.map((w) => (
              <tr key={w.rut} className="hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <Link href={`/workers/${encodeURIComponent(w.rut)}`} className="font-medium hover:text-accent">{w.name}</Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{w.rut}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{w.service}</td>
                <td className="px-3 py-2.5">
                  {w.status === "active" ? <span className="text-success">Activa</span> : <span className="text-warning">Suspendida</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(w.annual_dose).toFixed(2)} mSv</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <WorkerEditModal worker={w} />
                    <StatusActionButton rut={w.rut} active={true} />
                  </div>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No hay trabajadores cargados todavía. Importa un CSV o agrega uno manualmente para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
