import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Package,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

// Categorías IAEA de residuos radiactivos (IAEA GSG-1)
// Vida media en días para cálculo de decaimiento
const NUCLIDE_HALF_LIFE: Record<string, number> = {
  "I-131":   8.02,
  "Tc-99m":  0.251,  // 6.01 horas
  "F-18":    0.077,  // 1.83 horas
  "Ga-67":   3.26,
  "In-111":  2.80,
  "Tl-201":  3.05,
  "Lu-177":  6.65,
  "Y-90":    2.67,
  "Sr-89":   50.5,
  "P-32":    14.3,
  "Co-57":   272,
};

type WasteCategory = "exempt" | "llw" | "ilw" | "hlw";
type WasteStatus = "storage" | "decay_waiting" | "ready_release" | "transferred" | "disposed";
type WasteState = "solid" | "liquid" | "gas";

interface WasteRow {
  id: number;
  container_code: string;
  nuclide: string;
  category: WasteCategory;
  physical_state: WasteState;
  activity_bq_initial: number;
  activity_reference_date: string;
  activity_current_bq: number | null;
  half_life_days: number;
  volume_liters: number;
  mass_kg: number;
  location: string;
  status: WasteStatus;
  estimated_release_date: string | null;
  generated_by: string | null;
  notes: string | null;
}

const CAT_LABEL: Record<WasteCategory, { label: string; cls: string; desc: string }> = {
  exempt:  { label: "Exento",        cls: "text-green-700 bg-green-50",   desc: "< 10× Bq exento" },
  llw:     { label: "BBNA",          cls: "text-blue-700 bg-blue-50",     desc: "Baja actividad" },
  ilw:     { label: "MBNA",          cls: "text-amber-700 bg-amber-50",   desc: "Media actividad" },
  hlw:     { label: "ABNA",          cls: "text-red-700 bg-red-50",       desc: "Alta actividad" },
};

const STATUS_LABEL: Record<WasteStatus, { label: string; cls: string }> = {
  storage:        { label: "En almacén",       cls: "text-blue-700 bg-blue-50" },
  decay_waiting:  { label: "En decaimiento",   cls: "text-amber-700 bg-amber-50" },
  ready_release:  { label: "Listo liberar",    cls: "text-green-700 bg-green-50" },
  transferred:    { label: "Transferido",      cls: "text-purple-700 bg-purple-50" },
  disposed:       { label: "Eliminado",        cls: "text-gray-500 bg-gray-50" },
};

function calcCurrentActivity(initialBq: number, refDate: string, halfLifeDays: number): number {
  if (halfLifeDays <= 0) return initialBq;
  const ref = new Date(refDate).getTime();
  const now = Date.now();
  const elapsedDays = (now - ref) / (1000 * 60 * 60 * 24);
  return initialBq * Math.pow(0.5, elapsedDays / halfLifeDays);
}

function daysUntilRelease(initialBq: number, refDate: string, halfLifeDays: number, exemptLimitBq: number): number {
  if (initialBq <= exemptLimitBq) return 0;
  if (halfLifeDays <= 0) return Infinity;
  const ref = new Date(refDate).getTime();
  const elapsedDays = (Date.now() - ref) / (1000 * 60 * 60 * 24);
  const tHalf = halfLifeDays * Math.log2(initialBq / exemptLimitBq);
  return Math.max(0, tHalf - elapsedDays);
}

export default async function WastePage() {
  // Lazy migration
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS radioactive_waste (
        id SERIAL PRIMARY KEY,
        container_code VARCHAR(50) UNIQUE NOT NULL,
        nuclide VARCHAR(30) NOT NULL,
        category VARCHAR(20) DEFAULT 'llw',
        physical_state VARCHAR(10) DEFAULT 'solid',
        activity_bq_initial NUMERIC(16,2) NOT NULL,
        activity_reference_date TIMESTAMPTZ NOT NULL,
        half_life_days NUMERIC(10,3),
        volume_liters NUMERIC(10,3) DEFAULT 0,
        mass_kg NUMERIC(10,3) DEFAULT 0,
        location VARCHAR(200),
        status VARCHAR(20) DEFAULT 'decay_waiting',
        estimated_release_date TIMESTAMPTZ,
        generated_by VARCHAR(200),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch { /* already exists */ }

  // Seed demo data
  let seeded = false;
  try {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM radioactive_waste`;
    if (Number((cnt[0] as any)?.n ?? 0) === 0) {
      const demos = [
        { code: "RW-001", nuc: "I-131",  cat: "llw",  state: "solid",  bq: 3.7e9,  status: "decay_waiting",  loc: "Bodega residuos Sala I-131" },
        { code: "RW-002", nuc: "Tc-99m", cat: "llw",  state: "liquid", bq: 1.85e9, status: "decay_waiting",  loc: "Bodega residuos Sala Prep" },
        { code: "RW-003", nuc: "Tc-99m", cat: "exempt",state: "solid",  bq: 185e3,  status: "ready_release",  loc: "Bodega residuos Sala Prep" },
        { code: "RW-004", nuc: "I-131",  cat: "llw",  state: "liquid", bq: 925e6,  status: "decay_waiting",  loc: "Bodega residuos Sala I-131" },
        { code: "RW-005", nuc: "Ga-67",  cat: "llw",  state: "solid",  bq: 370e6,  status: "decay_waiting",  loc: "Bodega residuos Medicina Nuclear" },
        { code: "RW-006", nuc: "F-18",   cat: "llw",  state: "solid",  bq: 1850e6, status: "ready_release",  loc: "Bodega residuos PET" },
        { code: "RW-007", nuc: "Lu-177", cat: "ilw",  state: "liquid", bq: 7400e6, status: "storage",        loc: "Bodega blindada Terapia" },
        { code: "RW-008", nuc: "Co-57",  cat: "exempt",state: "solid",  bq: 50e3,   status: "ready_release",  loc: "Bodega control de calidad" },
      ];
      for (const d of demos) {
        const hl = NUCLIDE_HALF_LIFE[d.nuc] ?? 10;
        await sql`
          INSERT INTO radioactive_waste
            (container_code, nuclide, category, physical_state, activity_bq_initial,
             activity_reference_date, half_life_days, volume_liters, mass_kg,
             location, status, generated_by)
          VALUES
            (${d.code}, ${d.nuc}, ${d.cat}, ${d.state}, ${d.bq},
             now() - (random() * interval '20 days'), ${hl}, 5.0, 2.5,
             ${d.loc}, ${d.status}, 'TM Diego Solís Catalán')
          ON CONFLICT DO NOTHING
        `;
      }
      seeded = true;
    }
  } catch { /* table doesn't exist */ }

  let rows: WasteRow[] = [];
  let totalContainers = 0;
  let totalDecaying = 0;
  let totalReadyRelease = 0;
  let totalStorage = 0;

  try {
    const { rows: dbRows } = await sql`
      SELECT id, container_code, nuclide, category, physical_state,
             activity_bq_initial::float, activity_reference_date::text,
             activity_current_bq::float, half_life_days::float,
             volume_liters::float, mass_kg::float, location, status,
             estimated_release_date::text, generated_by, notes
      FROM radioactive_waste
      WHERE status NOT IN ('disposed')
      ORDER BY
        CASE status WHEN 'storage' THEN 0 WHEN 'decay_waiting' THEN 1 WHEN 'ready_release' THEN 2 ELSE 3 END,
        activity_bq_initial DESC
      LIMIT 100
    `;
    rows = dbRows as WasteRow[];
    totalContainers = rows.length;
    for (const r of rows) {
      if (r.status === "decay_waiting") totalDecaying++;
      else if (r.status === "ready_release") totalReadyRelease++;
      else if (r.status === "storage") totalStorage++;
    }
  } catch { /* tabla no existe */ }

  // Enrich with calculated current activity
  const enriched = rows.map((r) => {
    const halfLife = r.half_life_days ?? (NUCLIDE_HALF_LIFE[r.nuclide] ?? 10);
    const currentBq = calcCurrentActivity(r.activity_bq_initial, r.activity_reference_date, halfLife);
    const daysLeft = daysUntilRelease(r.activity_bq_initial, r.activity_reference_date, halfLife, 37000); // 37 kBq ~ exemption
    return { ...r, currentBq, daysLeft: isFinite(daysLeft) ? Math.ceil(daysLeft) : null };
  });

  function fmtBq(bq: number): string {
    if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
    if (bq >= 1e9)  return `${(bq / 1e9).toFixed(2)} GBq`;
    if (bq >= 1e6)  return `${(bq / 1e6).toFixed(2)} MBq`;
    if (bq >= 1e3)  return `${(bq / 1e3).toFixed(1)} kBq`;
    return `${bq.toFixed(0)} Bq`;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Residuos Radiactivos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inventario, seguimiento de decaimiento y gestión de residuos radiactivos hospitalarios
          {seeded && <span className="ml-2 text-accent">(datos demo inicializados)</span>}
        </p>
        <p className="text-xs text-muted-foreground">NS-06.0 §9 CCHEN · DS 133/1984 · IAEA GSG-1 · IAEA GSR Part 5</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KPICard label="Total contenedores" value={totalContainers} href="/waste" icon={Package as ComponentType<{ className?: string }>} />
        <KPICard label="En almacenamiento" value={totalStorage} href="/waste" icon={Trash2 as ComponentType<{ className?: string }>} tone="warning" />
        <KPICard label="En decaimiento" value={totalDecaying} href="/waste" icon={Clock as ComponentType<{ className?: string }>} tone="default" />
        <KPICard label="Listos para liberar" value={totalReadyRelease} href="/waste" icon={CheckCircle2 as ComponentType<{ className?: string }>} tone={totalReadyRelease > 0 ? "success" : "default"} />
        <KPICard label="ABNA almacenada" value={enriched.filter(r => r.category === "hlw").length} href="/waste" icon={ShieldAlert as ComponentType<{ className?: string }>} tone={enriched.filter(r => r.category === "hlw").length > 0 ? "danger" : "default"} hint="Alta actividad" />
        <KPICard label="Lím. 10 vidas medias" value={10} href="/waste" icon={AlertTriangle as ComponentType<{ className?: string }>} hint="Regla decaimiento" />
      </div>

      {/* Categorías IAEA */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-3">Clasificación de Residuos — IAEA GSG-1 / NS-06.0 §9</h2>
        <div className="grid gap-3 text-xs md:grid-cols-4">
          {(Object.entries(CAT_LABEL) as [WasteCategory, typeof CAT_LABEL[WasteCategory]][]).map(([cat, info]) => (
            <div key={cat} className={`rounded-lg border p-3 ${info.cls.replace("text-", "border-").split(" ")[0]!.replace("700", "200")} bg-opacity-20`}>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}>{info.label}</span>
              <div className="mt-1 font-medium">{info.desc}</div>
              <div className="mt-0.5 text-muted-foreground">
                {cat === "exempt" && "Libre de gestión especial"}
                {cat === "llw"    && "Almacen. temporal + decaimiento"}
                {cat === "ilw"    && "Gestión especializada CCHEN"}
                {cat === "hlw"    && "Almacen. seguro a largo plazo"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de inventario */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Inventario de Residuos Activos</h2>
          <span className="text-xs text-muted-foreground">Actividad actual calculada por decaimiento radiactivo</span>
        </div>
        {enriched.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin registros. Ejecute{" "}
            <a href="/api/init" className="text-accent underline">/api/init</a> para datos demo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Nuclido</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium">Estado físico</th>
                  <th className="px-3 py-2 font-medium text-right">Act. inicial</th>
                  <th className="px-3 py-2 font-medium text-right">Act. actual</th>
                  <th className="px-3 py-2 font-medium">T½ (días)</th>
                  <th className="px-3 py-2 font-medium">Días p/ liberar</th>
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {enriched.map((r) => {
                  const cl = CAT_LABEL[r.category] ?? CAT_LABEL.llw;
                  const sl = STATUS_LABEL[r.status] ?? STATUS_LABEL.storage;
                  const halfLife = r.half_life_days ?? (NUCLIDE_HALF_LIFE[r.nuclide] ?? 10);
                  return (
                    <tr
                      key={r.id}
                      className={
                        r.category === "hlw"
                          ? "bg-red-50/20"
                          : r.status === "ready_release"
                          ? "bg-green-50/20"
                          : ""
                      }
                    >
                      <td className="px-4 py-1.5 font-mono font-medium">{r.container_code}</td>
                      <td className="px-3 py-1.5 font-mono">{r.nuclide}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cl.cls}`}>
                          {cl.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 capitalize">{r.physical_state}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtBq(r.activity_bq_initial)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-accent">{fmtBq(r.currentBq)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{halfLife.toFixed(2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {r.daysLeft === null ? "—" : r.daysLeft === 0 ? (
                          <span className="text-green-600 font-semibold">✓ Listo</span>
                        ) : (
                          `${r.daysLeft} días`
                        )}
                      </td>
                      <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground" title={r.location ?? ""}>
                        {r.location}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${sl.cls}`}>
                          {sl.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
