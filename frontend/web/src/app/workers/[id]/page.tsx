import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatMSv } from "@/lib/utils";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound();
  const rut = decodeURIComponent(id);

  const { rows: workerRows } = await sql`
    SELECT rut, name, role, service, category, status, annual_dose
    FROM workers
    WHERE rut = ${rut}
    LIMIT 1
  `;
  const worker = workerRows[0];
  if (!worker) return notFound();

  const { rows: readingRows } = await sql`
    SELECT period, dose
    FROM dosimetry_readings
    WHERE worker_rut = ${rut}
    ORDER BY period ASC
  `;

  const monthlyDoses = readingRows.map((r: any) => Number(r.dose));
  const annualDose = Number(worker.annual_dose);
  const max = monthlyDoses.length > 0 ? Math.max(...monthlyDoses) : 1;

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <Link href="/workers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Trabajadores
      </Link>
      <h1 className="text-xl font-semibold mb-1">{worker.name}</h1>
      <p className="text-xs text-muted-foreground mb-4">{worker.role} · {worker.service} · Categoría {worker.category} (ICRP)</p>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Dosis Hp(10) registradas</h2>
        <p className="text-xs text-muted-foreground mb-2">Anual acumulada: {formatMSv(annualDose)}</p>
        {monthlyDoses.length > 0 ? (
          <div className="flex h-16 items-end gap-1">
            {readingRows.map((r: any, i: number) => {
              const v = Number(r.dose);
              const h = (v / max) * 80 + 20;
              return <div key={i} className="flex-1 rounded-t bg-accent-subtle hover:bg-accent" style={{ height: `${h}%` }} title={`${r.period}: ${v.toFixed(2)} mSv`} />;
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin lecturas dosimétricas registradas.</p>
        )}
      </div>
    </div>
  );
}
