import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";
import { DOSIMETER_TYPE_LABELS, DOSIMETER_STATUS_LABELS, DOSIMETER_STATUS_COLORS, isOverdue, daysOverdue } from "@/lib/dosimeters";
import { DosimeterEditModal } from "@/components/dosimeters/dosimeter-edit-modal";
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

function fmtDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function DosimeterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return notFound();

  await ensureDosimeterTables();

  const { rows: dosimeterRows } = await sql`SELECT * FROM dosimeters WHERE id = ${id}`;
  const dosimeter: any = dosimeterRows[0];
  if (!dosimeter) return notFound();

  const { rows: assignments } = await sql`
    SELECT * FROM dosimeter_assignments WHERE dosimeter_id = ${id} ORDER BY created_at DESC, id DESC
  `;

  const { rows: history } = await sql`
    SELECT * FROM dosimeter_history WHERE dosimeter_id = ${id} ORDER BY changed_at DESC, id DESC
  `;

  const overdue = isOverdue(dosimeter);
  const overdueDays = overdue ? daysOverdue(dosimeter.estimated_return_date) : null;

  const techFields: { label: string; value: string | null | undefined }[] = [
    { label: "Tipo de dosimetro", value: DOSIMETER_TYPE_LABELS[dosimeter.type as keyof typeof DOSIMETER_TYPE_LABELS] ?? dosimeter.type },
    { label: "Trabajador asignado", value: dosimeter.worker_name },
    { label: "RUN", value: dosimeter.worker_rut },
    { label: "Servicio", value: dosimeter.service },
    { label: "Unidad", value: dosimeter.unit },
    { label: "Fecha de entrega", value: fmtDate(dosimeter.delivery_date) },
    { label: "Fecha estimada de devolucion", value: fmtDate(dosimeter.estimated_return_date) },
    { label: "Fecha efectiva de devolucion", value: fmtDate(dosimeter.actual_return_date) },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <Link href="/dosimeters" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Dosimetros
      </Link>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold font-mono">{dosimeter.code}</h1>
        <div className="flex gap-1.5">
          <DosimeterAssignModal dosimeterId={id} code={dosimeter.code} />
          <DosimeterReturnModal dosimeterId={id} code={dosimeter.code} />
          <DosimeterEditModal dosimeter={dosimeter} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {DOSIMETER_TYPE_LABELS[dosimeter.type as keyof typeof DOSIMETER_TYPE_LABELS] ?? dosimeter.type}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", DOSIMETER_STATUS_COLORS[dosimeter.status as keyof typeof DOSIMETER_STATUS_COLORS])}>
          {DOSIMETER_STATUS_LABELS[dosimeter.status as keyof typeof DOSIMETER_STATUS_LABELS] ?? dosimeter.status}
        </span>
        {overdue && (
          <span className="inline-flex items-center rounded-full border border-danger/50 bg-danger/20 px-2.5 py-1 text-xs font-semibold text-danger">
            Fuera de plazo: {overdueDays} dias
          </span>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Ficha del dosimetro</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {techFields.map((f) => (
            <div key={f.label} className="flex justify-between border-b border-border/60 pb-1">
              <span className="text-muted-foreground">{f.label}</span>
              <span>{f.value || "-"}</span>
            </div>
          ))}
        </div>
        {dosimeter.observations && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Observaciones: </span>{dosimeter.observations}
          </p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Historial de asignaciones</h2>
        {assignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Trabajador</th>
                  <th className="px-2 py-1.5">RUN</th>
                  <th className="px-2 py-1.5">Servicio</th>
                  <th className="px-2 py-1.5">Unidad</th>
                  <th className="px-2 py-1.5">Entrega</th>
                  <th className="px-2 py-1.5">Devolucion estimada</th>
                  <th className="px-2 py-1.5">Devolucion efectiva</th>
                  <th className="px-2 py-1.5">Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(assignments as any[]).map((a) => (
                  <tr key={a.id}>
                    <td className="px-2 py-1.5 font-medium">{a.worker_name ?? "-"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{a.worker_rut}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{a.service ?? "-"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{a.unit ?? "-"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fmtDate(a.delivery_date)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fmtDate(a.estimated_return_date)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fmtDate(a.actual_return_date)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{a.status_at_close ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin asignaciones registradas.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Historial de auditoria</h2>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Fecha</th>
                  <th className="px-2 py-1.5">Usuario</th>
                  <th className="px-2 py-1.5">Campo</th>
                  <th className="px-2 py-1.5">Valor anterior</th>
                  <th className="px-2 py-1.5">Valor nuevo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(history as any[]).map((h) => (
                  <tr key={h.id}>
                    <td className="px-2 py-1.5">{fmtDateTime(h.changed_at)}</td>
                    <td className="px-2 py-1.5">{h.changed_by ?? "-"}</td>
                    <td className="px-2 py-1.5">{h.field_name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{h.old_value ?? "-"}</td>
                    <td className="px-2 py-1.5">{h.new_value ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
        )}
      </div>
    </div>
  );
}
