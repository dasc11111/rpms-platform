import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { StatusActionButton } from "@/components/workers/status-action-button";

export const dynamic = "force-dynamic";

type WorkerRow = {
  rut: string;
  name: string;
  role: string | null;
  service: string | null;
};

async function getInactiveWorkers(): Promise<WorkerRow[]> {
  try {
    const { rows } = await sql`
      SELECT rut, name, role, service
      FROM workers
      WHERE status = 'inactive'
      ORDER BY name ASC
    `;
    return rows as WorkerRow[];
  } catch {
    return [];
  }
}

export default async function InactiveWorkersPage() {
  const workers = await getInactiveWorkers();

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <Link href="/workers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Trabajadores
      </Link>
      <h1 className="text-lg font-semibold mb-1">Trabajadores inactivos</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Trabajadores dados de baja. Sus datos e historial se conservan; puedes reactivarlos en cualquier
        momento (modo recordar) sin perder información.
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">RUT</th>
              <th className="px-3 py-2">Servicio</th>
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
                <td className="px-3 py-2.5 text-right">
                  <StatusActionButton rut={w.rut} active={false} />
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No hay trabajadores inactivos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
