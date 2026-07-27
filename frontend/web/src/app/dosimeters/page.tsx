import Link from "next/link";
import { Tag, PackageCheck, PackageX, Users, AlertTriangle, CalendarClock } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { sql } from "@/lib/db";
import { DOSIMETER_TYPE_LABELS, DOSIMETER_STATUS_LABELS, DOSIMETER_STATUS_COLORS, DosimeterRow, isOverdue, daysOverdue, getCurrentQuarter, quarterLabel } from "@/lib/dosimeters";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";
import { rutMatchKey } from "@/lib/rut";
import { DosimeterFormModal } from "@/components/dosimeters/dosimeter-form-modal";
import { DosimeterAssignModal } from "@/components/dosimeters/dosimeter-assign-modal";
import { DosimeterReturnModal } from "@/components/dosimeters/dosimeter-return-modal";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmtDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

async function getDosimeters(): Promise<DosimeterRow[]> {
  await ensureDosimeterTables();
  const { rows } = await sql`SELECT * FROM dosimeters ORDER BY code ASC`;
  return rows as DosimeterRow[];
}

async function getActiveWorkerRuts(): Promise<string[]> {
  try {
    const { rows } = await sql`SELECT rut FROM workers WHERE status <> 'inactive'`;
    return (rows as { rut: string }[]).map((r) => r.rut);
  } catch {
    return [];
  }
}

export default async function DosimetersPage() {
  const dosimeters = await getDosimeters();
  const activeWorkerRuts = await getActiveWorkerRuts();

  const total = dosimeters.length;
  const disponibles = dosimeters.filter((d) => d.status === "disponible").length;
  const asignados = dosimeters.filter((d) => d.status === "asignado").length;
  const extraviados = dosimeters.filter((d) => d.status === "extraviado").length;
  const fueraDePlazo = dosimeters.filter((d) => isOverdue(d)).length;

  const assignedWorkerKeys = new Set(
    dosimeters.filter((d) => d.status === "asignado" && d.worker_rut).map((d) => rutMatchKey(d.worker_rut as string))
  );
  const workersWithoutDosimeter = activeWorkerRuts.filter((rut) => !assignedWorkerKeys.has(rutMatchKey(rut))).length;

  const { year, quarter } = getCurrentQuarter();
  const currentQuarterLabel = quarterLabel(year, quarter);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-1">Dosimetros</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Asignacion y control de dosimetros fisicos por codigo XA · Recambio vigente: {currentQuarterLabel}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Dosimetros registrados" value={total} href="/dosimeters" icon={Tag} />
        <KPICard label="Disponibles" value={disponibles} href="/dosimeters" icon={PackageCheck} />
        <KPICard label="Asignados" value={asignados} href="/dosimeters" icon={Users} />
        <KPICard label="Extraviados" value={extraviados} href="/dosimeters" icon={PackageX} tone="danger" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Fuera de plazo de devolucion" value={fueraDePlazo} href="/dosimeters" icon={AlertTriangle} tone="danger" />
        <KPICard label="Trabajadores sin dosimetro" value={workersWithoutDosimeter} href="/dosimeters" icon={Users} tone="warning" />
        <KPICard label="Trimestre vigente" value={quarter} href="/dosimeters" icon={CalendarClock} hint={`Ano ${year}`} />
      </div>

      <DosimeterFormModal />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Codigo XA</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Unidad</th>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Devolucion estimada</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {dosimeters.map((d) => {
              const overdue = isOverdue(d);
              const overdueDays = overdue ? daysOverdue(d.estimated_return_date) : null;
              return (
                <tr key={d.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <Link href={`/dosimeters/${d.id}`} className="hover:text-accent hover:underline">
                      {d.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{DOSIMETER_TYPE_LABELS[d.type]}</td>
                  <td className="px-3 py-2.5">{d.worker_name ?? "-"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.service ?? "-"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.unit ?? "-"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(d.delivery_date)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(d.estimated_return_date)}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", DOSIMETER_STATUS_COLORS[d.status])}>
                      {DOSIMETER_STATUS_LABELS[d.status]}
                    </span>
                    {overdue && (
                      <span className="ml-1.5 text-[11px] text-danger">+{overdueDays}d</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <DosimeterAssignModal dosimeterId={d.id} code={d.code} />
                      <DosimeterReturnModal dosimeterId={d.id} code={d.code} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {dosimeters.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No hay dosimetros registrados todavia. Agrega uno para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
