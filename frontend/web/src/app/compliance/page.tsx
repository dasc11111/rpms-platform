import { sql } from "@/lib/db";
import { ShieldAlert, FileWarning, CheckCircle2, Calendar } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface ComplianceRow {
  id: number;
  requirement: string;
  regulation: string;
  owner: string | null;
  service: string | null;
  next_review_date: string | null;
  status: string;
  notes: string | null;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ok: { label: "Al día", className: "text-success" },
  pending: { label: "Pendiente", className: "text-warning" },
  scheduled: { label: "Programado", className: "text-muted-foreground" },
  overdue: { label: "Vencido", className: "text-danger" },
};

export default async function CompliancePage() {
  let requirements: ComplianceRow[] = [];
  let okCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let next90Count = 0;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const { rows } = await sql`
      SELECT id, requirement, regulation, owner, service,
             next_review_date::text, status, notes
      FROM compliance_requirements
      ORDER BY
        CASE status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
        next_review_date ASC NULLS LAST
    `;
    requirements = rows as ComplianceRow[];

    for (const r of requirements) {
      if (r.status === "ok") okCount++;
      else if (r.status === "pending") pendingCount++;
      else if (r.status === "overdue") overdueCount++;
      if (r.next_review_date && r.next_review_date >= today && r.next_review_date <= in90) next90Count++;
    }
  } catch {
    // tabla no creada aún
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Cumplimiento Regulatorio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">NS-06.0 CCHEN · DS 133/1984 · DS 3/1985 MINSAL</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Al día" value={okCount} href="/compliance" icon={CheckCircle2} />
        <KPICard label="Pendientes" value={pendingCount} href="/compliance" icon={FileWarning} tone="warning" />
        <KPICard label="Vencidos" value={overdueCount} href="/compliance" icon={ShieldAlert} tone="danger" />
        <KPICard label="Próximos 90 días" value={next90Count} href="/compliance" icon={Calendar} tone="warning" />
      </div>

      {requirements.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No hay requisitos registrados. Ejecuta <code className="font-mono text-xs">/api/init</code> para inicializar las tablas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Requisito</th>
                <th className="px-3 py-2">Normativa</th>
                <th className="px-3 py-2">Responsable</th>
                <th className="px-3 py-2">Próxima revisión</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {requirements.map((r) => {
                const st = STATUS_LABEL[r.status] ?? { label: r.status, className: "text-muted-foreground" };
                return (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-medium">{r.requirement}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.regulation}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.owner ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.next_review_date ?? "—"}</td>
                    <td className={`px-3 py-2.5 font-medium ${st.className}`}>{st.label}</td>
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
