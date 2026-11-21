import { sql } from "@/lib/db";
import { AlertCircle, Plus, RadioIcon } from "lucide-react";

export const dynamic = "force-dynamic";

function calcActivityNow(activityBqInitial: number, halfLifeDays: number, referenceDate: string): number {
  const refDate = new Date(referenceDate);
  const now = new Date();
  const daysDiff = (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
  return activityBqInitial * Math.pow(0.5, daysDiff / halfLifeDays);
}

function formatBq(bq: number): string {
  if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
  if (bq >= 1e9) return `${(bq / 1e9).toFixed(2)} GBq`;
  if (bq >= 1e6) return `${(bq / 1e6).toFixed(2)} MBq`;
  if (bq >= 1e3) return `${(bq / 1e3).toFixed(2)} kBq`;
  return `${bq.toFixed(0)} Bq`;
}

function iaeaCategoryLabel(cat: number | null): string {
  if (!cat) return "—";
  const labels: Record<number, string> = { 1: "Cat.1 Peligrosa", 2: "Cat.2 Alta", 3: "Cat.3 Media", 4: "Cat.4 Baja", 5: "Cat.5 Mínima" };
  return labels[cat] ?? `Cat.${cat}`;
}

type Source = {
  id: number;
  source_code: string;
  isotope: string;
  half_life_days: string;
  activity_bq_initial: string;
  activity_reference_date: string;
  category_iaea: number | null;
  manufacturer: string | null;
  serial_number: string | null;
  location: string | null;
  status: string;
  last_inventory_date: string | null;
  next_inventory_date: string | null;
  notes: string | null;
};

export default async function SourcesPage() {
  let sources: Source[] = [];
  let dbError = false;

  try {
    const { rows } = await sql<Source>`
      SELECT id, source_code, isotope, half_life_days::text, activity_bq_initial::text,
             activity_reference_date::text, category_iaea, manufacturer, serial_number,
             location, status, last_inventory_date::text, next_inventory_date::text, notes
      FROM radioactive_sources
      ORDER BY next_inventory_date ASC NULLS LAST, isotope
    `;
    sources = rows;
  } catch {
    dbError = true;
  }

  const inUse = sources.filter((s) => s.status === "in_use").length;
  const stored = sources.filter((s) => s.status === "stored").length;
  const overdue = sources.filter((s) => {
    if (!s.next_inventory_date) return false;
    return new Date(s.next_inventory_date) < new Date();
  }).length;

  const statusColors: Record<string, string> = {
    in_use: "text-blue-400",
    stored: "text-emerald-400",
    returned: "text-muted-foreground",
    disposed: "text-muted-foreground",
    lost: "text-red-400",
  };

  const statusLabels: Record<string, string> = {
    in_use: "En uso",
    stored: "Almacenada",
    returned: "Devuelta",
    disposed: "Eliminada",
    lost: "Extraviada",
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Fuentes Radiactivas</h1>
          <p className="text-xs text-muted-foreground">Control de fuentes selladas — NS-06.0 CCHEN</p>
        </div>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Nueva fuente
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total fuentes", value: sources.length, color: "text-foreground" },
          { label: "En uso", value: inUse, color: "text-blue-400" },
          { label: "Almacenadas", value: stored, color: "text-emerald-400" },
          { label: "Inventario vencido", value: overdue, color: overdue > 0 ? "text-red-400" : "text-muted-foreground" },
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
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Isótopo</th>
              <th className="px-3 py-2">Vida media</th>
              <th className="px-3 py-2">Actividad actual</th>
              <th className="px-3 py-2">Categoría IAEA</th>
              <th className="px-3 py-2">Ubicación</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Próx. inventario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {sources.length === 0 && !dbError && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <RadioIcon className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  No hay fuentes registradas
                </td>
              </tr>
            )}
            {sources.map((s) => {
              const activityNow = calcActivityNow(
                parseFloat(s.activity_bq_initial),
                parseFloat(s.half_life_days),
                s.activity_reference_date,
              );
              const isOverdue = s.next_inventory_date && new Date(s.next_inventory_date) < new Date();

              return (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-[11px]">{s.source_code}</td>
                  <td className="px-3 py-2 font-semibold">{s.isotope}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {parseFloat(s.half_life_days) >= 1
                      ? `${parseFloat(s.half_life_days).toFixed(1)} d`
                      : `${(parseFloat(s.half_life_days) * 24).toFixed(1)} h`}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatBq(activityNow)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        s.category_iaea && s.category_iaea <= 2
                          ? "bg-red-500/15 text-red-400"
                          : s.category_iaea === 3
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {iaeaCategoryLabel(s.category_iaea)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.location ?? "—"}</td>
                  <td className={`px-3 py-2 font-medium ${statusColors[s.status] ?? ""}`}>
                    {statusLabels[s.status] ?? s.status}
                  </td>
                  <td className={`px-3 py-2 ${isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
                    {s.next_inventory_date ?? "—"}
                    {isOverdue && " ⚠"}
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
