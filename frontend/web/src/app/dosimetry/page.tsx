import { Users, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DoseReportModal } from "@/components/dosimetry/dose-report-modal";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  worker_rut: string;
  worker_name: string;
  departamento: string | null;
  year: number;
  quarter: number;
  period_label: string;
  dose_body: string;
  dose_lens: string;
  dose_skin: string;
  accum_60m_body: string;
  level: string;
};

const LEVEL_LABEL: Record<string, { label: string; className: string }> = {
  normal: { label: "Normal", className: "text-muted-foreground" },
  registro: { label: "Nivel de registro", className: "text-warning" },
  investigacion: { label: "Nivel de investigación", className: "text-orange-500" },
  intervencion: { label: "Nivel de intervención", className: "text-danger" },
};

async function getData(): Promise<Row[]> {
  try {
    const { rows } = await sql`
      SELECT worker_rut, worker_name, departamento, year, quarter, period_label,
             dose_body, dose_lens, dose_skin, accum_60m_body, level
      FROM dosimetry_quarterly
      ORDER BY year DESC, quarter DESC, worker_name ASC
    `;
    return rows as Row[];
  } catch {
    return [];
  }
}

export default async function DosimetryPage() {
  const all = await getData();

  const latest = all[0];
  const latestLabel = latest?.period_label ?? null;
  const latestRows = latestLabel ? all.filter((r) => r.period_label === latestLabel) : [];

  const countByLevel = (lvl: string) => latestRows.filter((r) => r.level === lvl).length;
  const totalWorkers = new Set(all.map((r) => r.worker_rut)).size;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-1">Dosimetría</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        {latestLabel ? `Último período cargado: ${latestLabel}` : "Sin datos cargados"} · Niveles de referencia (dosis cuerpo entero por trimestre): Registro ≥ 0,1 mSv · Investigación ≥ 1,6 mSv · Intervención ≥ 5 mSv
      </p>

      <DoseReportModal />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Trabajadores monitoreados" value={totalWorkers} href="/dosimetry" icon={Users} />
        <KPICard label="Nivel de registro" value={countByLevel("registro")} href="/dosimetry" icon={ShieldCheck} tone="warning" />
        <KPICard label="Nivel de investigación" value={countByLevel("investigacion")} href="/dosimetry" icon={AlertTriangle} tone="warning" />
        <KPICard label="Nivel de intervención" value={countByLevel("intervencion")} href="/dosimetry" icon={ShieldAlert} tone="danger" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">Departamento</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2 text-right">Cuerpo entero (mSv)</th>
              <th className="px-3 py-2 text-right">Cristalino (mSv)</th>
              <th className="px-3 py-2 text-right">Piel (mSv)</th>
              <th className="px-3 py-2 text-right">Acumulado 5 años (mSv)</th>
              <th className="px-3 py-2">Nivel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {latestRows.map((r, i) => {
              const lv = LEVEL_LABEL[r.level] ?? { label: r.level, className: "text-muted-foreground" };
              return (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{r.worker_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.departamento}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.period_label}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_body).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_lens).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_skin).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.accum_60m_body).toFixed(2)}</td>
                  <td className={`px-3 py-2.5 ${lv.className}`}>{lv.label}</td>
                </tr>
              );
            })}
            {latestRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No hay lecturas dosimétricas cargadas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
