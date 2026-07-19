import Link from "next/link";
import { sql } from "@/lib/db";
import { CsvImport } from "@/components/import/csv-import";

export const dynamic = "force-dynamic";

type WorkerRow = {
  rut: string;
  name: string;
  role: string | null;
  service: string | null;
  category: string | null;
  status: string;
  annual_dose: string;
};

async function getWorkers(): Promise<WorkerRow[]> {
  try {
    const { rows } = await sql`
      SELECT rut, name, role, service, category, status, annual_dose
      FROM workers
      ORDER BY name ASC
    `;
    return rows as WorkerRow[];
  } catch {
    return [];
  }
}

export default async function WorkersPage() {
  const workers = await getWorkers();

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Trabajadores</h1>
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
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No hay trabajadores cargados todavía. Importa un CSV para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
