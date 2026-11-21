import { sql } from "@/lib/db";
import { ShieldAlert, FileWarning, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import type { ComponentType } from "react";

export const dynamic = "force-dynamic";

interface ComplianceRow {
  id: number;
  requirement: string;
  regulation: string;
  reference_code: string | null;
  priority: string | null;
  owner: string | null;
  service: string | null;
  next_review_date: string | null;
  status: string;
  notes: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "Al día", cls: "bg-emerald-50 text-emerald-700" },
  pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-700" },
  scheduled: { label: "Programado", cls: "bg-blue-50 text-blue-700" },
  overdue: { label: "Vencido", cls: "bg-red-50 text-red-700" },
};

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  critical: { label: "Crítico", cls: "text-red-700 font-semibold" },
  high: { label: "Alto", cls: "text-amber-700 font-medium" },
  normal: { label: "Normal", cls: "text-muted-foreground" },
};

export default async function CompliancePage() {
  let requirements: ComplianceRow[] = [];
  let okCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let next90Count = 0;
  let criticalPending = 0;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    // Add columns if they don't exist
    try {
      await sql`ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS reference_code TEXT`;
      await sql`ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'`;
    } catch { /* ya existen */ }

    const { rows } = await sql`
      SELECT id, requirement, regulation, reference_code, priority, owner, service,
             next_review_date::text, status, notes
      FROM compliance_requirements
      ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
        CASE status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
        next_review_date ASC NULLS LAST
    `;
    requirements = rows as ComplianceRow[];

    for (const r of requirements) {
      if (r.status === "ok") okCount++;
      else if (r.status === "pending") pendingCount++;
      else if (r.status === "overdue") overdueCount++;
      if (r.next_review_date && r.next_review_date >= today && r.next_review_date <= in90) next90Count++;
      if ((r.status === "pending" || r.status === "overdue") && r.priority === "critical") criticalPending++;
    }
  } catch {
    // tabla no creada aún
  }

  const critical = requirements.filter((r) => r.priority === "critical");
  const others = requirements.filter((r) => r.priority !== "critical");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Cumplimiento Regulatorio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Matriz NS-06.0 CCHEN · DS 133/1984 · DS 3/1985 MINSAL — {requirements.length} requisitos
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Al día"
          value={okCount}
          href="/compliance"
          icon={CheckCircle2 as ComponentType<{ className?: string }>}
          tone="success"
        />
        <KPICard
          label="Pendientes"
          value={pendingCount}
          href="/compliance"
          icon={FileWarning as ComponentType<{ className?: string }>}
          tone={pendingCount > 0 ? "warning" : "default"}
        />
        <KPICard
          label="Vencidos"
          value={overdueCount}
          href="/compliance"
          icon={ShieldAlert as ComponentType<{ className?: string }>}
          tone={overdueCount > 0 ? "danger" : "default"}
        />
        <KPICard
          label="Próximos 90 días"
          value={next90Count}
          href="/compliance"
          icon={Calendar as ComponentType<{ className?: string }>}
          tone={next90Count > 0 ? "warning" : "default"}
        />
      </div>

      {/* Alerta crítica */}
      {criticalPending > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <strong>⚠ {criticalPending} requisito{criticalPending > 1 ? "s" : ""} crítico{criticalPending > 1 ? "s" : ""} pendiente{criticalPending > 1 ? "s" : ""}:</strong>{" "}
            Estos requisitos afectan directamente la autorización de la instalación ante CCHEN y deben resolverse con prioridad.
          </div>
        </div>
      )}

      {requirements.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No hay requisitos registrados. Ejecuta <code className="font-mono text-xs">/api/init</code> para inicializar con la matriz NS-06.0 completa.
        </div>
      ) : (
        <>
          {/* Requisitos críticos */}
          {critical.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-surface overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-200">
                <h2 className="font-semibold text-sm text-red-800">Requisitos Críticos — Autorización CCHEN</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2">Código</th>
                      <th className="text-left px-4 py-2">Requisito</th>
                      <th className="text-left px-4 py-2">Normativa</th>
                      <th className="text-left px-4 py-2">Responsable</th>
                      <th className="text-left px-4 py-2">Próxima revisión</th>
                      <th className="text-left px-4 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {critical.map((r) => {
                      const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
                      return (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.reference_code ?? "—"}</td>
                          <td className="px-4 py-2.5 font-medium">{r.requirement}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.regulation}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.owner ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.next_review_date ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resto de requisitos */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="font-semibold text-sm">Requisitos de Alta Prioridad y Normales</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2">Código</th>
                    <th className="text-left px-4 py-2">Requisito</th>
                    <th className="text-left px-4 py-2">Normativa</th>
                    <th className="text-left px-4 py-2">Prioridad</th>
                    <th className="text-left px-4 py-2">Responsable</th>
                    <th className="text-left px-4 py-2">Próxima revisión</th>
                    <th className="text-left px-4 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((r) => {
                    const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
                    const prio = PRIORITY_LABEL[r.priority ?? "normal"] ?? PRIORITY_LABEL["normal"]!;
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.reference_code ?? "—"}</td>
                        <td className="px-4 py-2.5 font-medium">{r.requirement}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.regulation}</td>
                        <td className={`px-4 py-2.5 text-xs ${prio.cls}`}>{prio.label}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.owner ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.next_review_date ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Referencia regulatoria */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Marco regulatorio:</strong>{" "}
        NS-06.0 CCHEN — Norma de Seguridad para Instalaciones Radiactivas · DS 133/1984 Minsal — Autorización de instalaciones ·
        DS 3/1985 Minsal — Protección radiológica · IAEA Safety Standards GSR Part 3 (RSO requirements)
      </div>
    </div>
  );
}
