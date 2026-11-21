import { sql } from "@/lib/db";
import { Radio, Ban, ClipboardCheck, Wrench } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface EquipmentRow {
  id: number;
  name: string;
  type: string;
  service: string | null;
  room: string | null;
  last_qa_date: string | null;
  next_qa_date: string | null;
  status: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  operational: { label: "Operativo", className: "text-success" },
  pending: { label: "QA pendiente", className: "text-warning" },
  out_of_service: { label: "Fuera de servicio", className: "text-danger" },
};

export default async function EquipmentPage() {
  let equipmentList: EquipmentRow[] = [];
  let totalCount = 0;
  let outOfServiceCount = 0;
  let pendingQACount = 0;

  try {
    const { rows } = await sql`
      SELECT id, name, type, service, room,
             last_qa_date::text, next_qa_date::text, status
      FROM equipment
      ORDER BY name
    `;
    equipmentList = rows as EquipmentRow[];
    totalCount = equipmentList.length;
    outOfServiceCount = equipmentList.filter((r) => r.status === "out_of_service").length;
    pendingQACount = equipmentList.filter((r) => r.status === "pending").length;
  } catch {
    // La tabla puede no existir aún
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Equipos</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Equipos registrados" value={totalCount} href="/equipment" icon={Radio} />
        <KPICard label="Fuera de servicio" value={outOfServiceCount} href="/equipment" icon={Ban} tone="danger" />
        <KPICard label="QA pendientes" value={pendingQACount} href="/equipment" icon={ClipboardCheck} tone="warning" />
        <KPICard label="Mantenciones abiertas" value={0} href="/equipment" icon={Wrench} tone="warning" />
      </div>

      {equipmentList.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No hay equipos registrados. Ejecuta <code className="font-mono text-xs">/api/init</code> para inicializar las tablas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Equipo</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Servicio</th>
                <th className="px-3 py-2">Sala</th>
                <th className="px-3 py-2">Último QA</th>
                <th className="px-3 py-2">Próximo QA</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {equipmentList.map((eq) => {
                const st = STATUS_LABEL[eq.status] ?? { label: eq.status, className: "" };
                return (
                  <tr key={eq.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium">{eq.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eq.type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eq.service ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eq.room ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eq.last_qa_date ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eq.next_qa_date ?? "—"}</td>
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
