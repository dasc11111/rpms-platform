import { sql } from "@/lib/db";
import { AlertCircle, FlaskConical, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

function formatBq(bq: number): string {
  if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
  if (bq >= 1e9) return `${(bq / 1e9).toFixed(2)} GBq`;
  if (bq >= 1e6) return `${(bq / 1e6).toFixed(2)} MBq`;
  if (bq >= 1e3) return `${(bq / 1e3).toFixed(2)} kBq`;
  return `${bq.toFixed(0)} Bq`;
}

function calcActivityNow(activityBq: number, halfLifeDays: number, calibrationDatetime: string): number {
  const refDate = new Date(calibrationDatetime);
  const now = new Date();
  const daysDiff = (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
  return activityBq * Math.pow(0.5, daysDiff / halfLifeDays);
}

type Radiopharm = {
  id: number;
  name: string;
  isotope: string;
  half_life_days: string;
  batch_number: string;
  supplier: string | null;
  activity_bq: string;
  calibration_datetime: string;
  expiry_datetime: string;
  volume_ml: string | null;
  status: string;
  service: string | null;
  received_at: string;
};

export default async function RadiopharmacyPage() {
  let items: Radiopharm[] = [];
  let dbError = false;

  try {
    const { rows } = await sql<Radiopharm>`
      SELECT id, name, isotope, half_life_days::text, batch_number, supplier,
             activity_bq::text, calibration_datetime::text, expiry_datetime::text,
             volume_ml::text, status, service, received_at::text
      FROM radiopharmaceuticals
      ORDER BY expiry_datetime ASC
      LIMIT 100
    `;
    items = rows;
  } catch {
    dbError = true;
  }

  const active = items.filter((r) => r.status === "active").length;
  const expired = items.filter((r) => r.status === "expired").length;
  const expiringSoon = items.filter((r) => {
    if (r.status !== "active") return false;
    const expiry = new Date(r.expiry_datetime);
    const diff = (expiry.getTime() - Date.now()) / (1000 * 60 * 60);
    return diff <= 24;
  }).length;

  const statusColors: Record<string, string> = {
    active: "text-emerald-400",
    expired: "text-red-400",
    depleted: "text-muted-foreground",
    returned: "text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    active: "Activo",
    expired: "Expirado",
    depleted: "Agotado",
    returned: "Devuelto",
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Radiofarmacia</h1>
          <p className="text-xs text-muted-foreground">Lotes de radiofármacos — control de actividad y vencimiento</p>
        </div>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Registrar lote
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Lotes totales", value: items.length, color: "text-foreground" },
          { label: "Activos", value: active, color: "text-emerald-400" },
          { label: "Vencen en 24h", value: expiringSoon, color: expiringSoon > 0 ? "text-amber-400" : "text-muted-foreground" },
          { label: "Expirados", value: expired, color: expired > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {dbError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Base de datos no inicializada.{" "}
            <a href="/api/init" className="underline">
              Inicializar
            </a>
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Lote</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Isótopo</th>
              <th className="px-3 py-2">Actividad calibración</th>
              <th className="px-3 py-2">Actividad actual (calc.)</th>
              <th className="px-3 py-2">Calibración</th>
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {items.length === 0 && !dbError && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <FlaskConical className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  No hay lotes registrados
                </td>
              </tr>
            )}
            {items.map((r) => {
              const actNow = calcActivityNow(
                parseFloat(r.activity_bq),
                parseFloat(r.half_life_days),
                r.calibration_datetime,
              );
              const isExpired = new Date(r.expiry_datetime) < new Date();
              const expiringSoon24 =
                !isExpired &&
                (new Date(r.expiry_datetime).getTime() - Date.now()) / (1000 * 60 * 60) <= 24;

              return (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-[11px]">{r.batch_number}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 font-semibold">{r.isotope}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBq(parseFloat(r.activity_bq))}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {actNow > 0 ? formatBq(actNow) : "< 0 Bq"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.calibration_datetime).toLocaleDateString("es-CL")}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      isExpired
                        ? "text-red-400 font-semibold"
                        : expiringSoon24
                          ? "text-amber-400 font-semibold"
                          : "text-muted-foreground"
                    }`}
                  >
                    {new Date(r.expiry_datetime).toLocaleString("es-CL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {isExpired && " ⚠"}
                    {expiringSoon24 && " ⏳"}
                  </td>
                  <td className={`px-3 py-2 font-medium ${statusColors[r.status] ?? ""}`}>
                    {statusLabels[r.status] ?? r.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
