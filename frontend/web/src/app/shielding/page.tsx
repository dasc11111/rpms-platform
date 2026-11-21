import { sql } from "@/lib/db";
import { AlertCircle, Plus, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

type ShieldingRecord = {
  id: number;
  name: string;
  room: string;
  service: string | null;
  material: string;
  thickness_mm: string | null;
  lead_equivalent_mm: string | null;
  design_dose_rate_usv_h: string | null;
  measured_dose_rate_usv_h: string | null;
  last_measurement_date: string | null;
  next_measurement_date: string | null;
  status: string;
  notes: string | null;
};

export default async function ShieldingPage() {
  let shields: ShieldingRecord[] = [];
  let dbError = false;

  try {
    const { rows } = await sql<ShieldingRecord>`
      SELECT id, name, room, service, material,
             thickness_mm::text, lead_equivalent_mm::text,
             design_dose_rate_usv_h::text, measured_dose_rate_usv_h::text,
             last_measurement_date::text, next_measurement_date::text,
             status, notes
      FROM shielding
      ORDER BY next_measurement_date ASC NULLS LAST, room
    `;
    shields = rows;
  } catch {
    dbError = true;
  }

  const ok = shields.filter((s) => s.status === "ok").length;
  const review = shields.filter((s) => s.status === "review").length;
  const failed = shields.filter((s) => s.status === "failed").length;
  const overdue = shields.filter((s) => {
    if (!s.next_measurement_date) return false;
    return new Date(s.next_measurement_date) < new Date();
  }).length;

  const statusColors: Record<string, string> = {
    ok: "text-emerald-400",
    review: "text-amber-400",
    failed: "text-red-400",
  };

  const statusLabels: Record<string, string> = {
    ok: "OK",
    review: "Revisar",
    failed: "Falla",
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Blindajes</h1>
          <p className="text-xs text-muted-foreground">Control de blindajes — DS 3/1985 MINSAL · NS-06.0 CCHEN</p>
        </div>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Registrar blindaje
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total blindajes", value: shields.length, color: "text-foreground" },
          { label: "Conformes", value: ok, color: "text-emerald-400" },
          { label: "En revisión", value: review, color: review > 0 ? "text-amber-400" : "text-muted-foreground" },
          { label: "Medición vencida", value: overdue, color: overdue > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {failed > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {failed} blindaje{failed > 1 ? "s" : ""} en falla — requiere acción inmediata.
          </span>
        </div>
      )}

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
              <th className="px-3 py-2">Nombre / Ubicación</th>
              <th className="px-3 py-2">Sala</th>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Espesor</th>
              <th className="px-3 py-2">Pb equiv.</th>
              <th className="px-3 py-2">Tasa diseño</th>
              <th className="px-3 py-2">Tasa medida</th>
              <th className="px-3 py-2">Próx. medición</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {shields.length === 0 && !dbError && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  <Shield className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  No hay blindajes registrados
                </td>
              </tr>
            )}
            {shields.map((s) => {
              const isOverdue = s.next_measurement_date && new Date(s.next_measurement_date) < new Date();

              return (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.room}</td>
                  <td className="px-3 py-2">{s.material}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {s.thickness_mm ? `${parseFloat(s.thickness_mm).toFixed(0)} mm` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {s.lead_equivalent_mm ? `${parseFloat(s.lead_equivalent_mm).toFixed(1)} mmPb` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {s.design_dose_rate_usv_h ? `${parseFloat(s.design_dose_rate_usv_h).toFixed(2)} µSv/h` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {s.measured_dose_rate_usv_h ? `${parseFloat(s.measured_dose_rate_usv_h).toFixed(2)} µSv/h` : "—"}
                  </td>
                  <td className={`px-3 py-2 ${isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
                    {s.next_measurement_date ?? "—"}
                    {isOverdue && " ⚠"}
                  </td>
                  <td className={`px-3 py-2 font-semibold ${statusColors[s.status] ?? ""}`}>
                    {statusLabels[s.status] ?? s.status}
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
