import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatMSv } from "@/lib/utils";
import { sql } from "@/lib/db";
import { StatusActionButton } from "@/components/workers/status-action-button";

export const dynamic = "force-dynamic";

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound();
  const rut = decodeURIComponent(id);

  const { rows: workerRows } = await sql`
    SELECT rut, name, role, service, category, status, annual_dose,
           dv, sex, address, phone, email, birth_date, estamento, contract_type, unit
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
  const isActive = worker.status !== "inactive";

  const contactFields: { label: string; value: string | null }[] = [
    { label: "Sexo", value: worker.sex },
    { label: "Fecha nacimiento", value: worker.birth_date },
    { label: "Teléfono", value: worker.phone },
    { label: "Correo", value: worker.email },
    { label: "Dirección", value: worker.address },
    { label: "Estamento", value: worker.estamento },
    { label: "Calidad contractual", value: worker.contract_type },
    { label: "Unidad", value: worker.unit },
  ].filter((f) => f.value);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <Link href="/workers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Trabajadores
      </Link>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{worker.name}</h1>
        <StatusActionButton rut={worker.rut} active={isActive} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">{worker.role} · {worker.service} · Categoría {worker.category} (ICRP)</p>

      {!isActive && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Este trabajador está dado de baja. Sus datos se conservan y puede reactivarse en cualquier momento.
        </div>
      )}

      {contactFields.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Datos de contacto</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {contactFields.map((f) => (
              <div key={f.label} className="flex justify-between border-b border-border/60 pb-1">
                <span className="text-muted-foreground">{f.label}</span>
                <span>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
