import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  ShieldAlert,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

// Límites anuales DS 3/1985 MINSAL (mSv) — ICRP 103
const LIMITS = {
  ANNUAL_BODY_OCC: 20,       // Trabajadores ocupacionales: cuerpo entero 20 mSv/año
  ANNUAL_BODY_PUBLIC: 1,     // Público general: 1 mSv/año
  ANNUAL_LENS: 20,           // Cristalino: 20 mSv/año (ICRP 118)
  ANNUAL_SKIN: 500,          // Piel: 500 mSv/año
  QUARTERLY_NI_1: 1.25,      // NI-1 (Nivel de Investigación 1): 1.25 mSv/trimestre (25% del límite trimestral 5 mSv)
  QUARTERLY_NI_2: 3.75,      // NI-2 (Nivel de Investigación 2): 3.75 mSv/trimestre (75%)
  QUARTERLY_BODY_OCC: 5,     // Límite trimestral: 5 mSv/trimestre (20 mSv/4)
};

type LevelType = "normal" | "ni1" | "ni2" | "exceeded";

function getLevel(dose: number): LevelType {
  if (dose >= LIMITS.QUARTERLY_BODY_OCC) return "exceeded";
  if (dose >= LIMITS.QUARTERLY_NI_2) return "ni2";
  if (dose >= LIMITS.QUARTERLY_NI_1) return "ni1";
  return "normal";
}

const LEVEL_LABEL: Record<LevelType, { label: string; cls: string }> = {
  normal:   { label: "Normal",         cls: "text-green-700 bg-green-50" },
  ni1:      { label: "NI-1 Invest.",   cls: "text-amber-700 bg-amber-50" },
  ni2:      { label: "NI-2 Acción",    cls: "text-orange-700 bg-orange-50" },
  exceeded: { label: "Supera límite",  cls: "text-red-700 bg-red-50" },
};

interface DosRow {
  worker_rut: string;
  worker_name: string;
  year: number;
  quarter: number;
  period_label: string;
  dose_body: number;
  dose_lens: number;
  dose_skin: number;
  accum_year_body: number;
  accum_12m_body: number;
  accum_60m_body: number;
  level: string;
}

export default async function DosimetryPage() {
  // Lazy migration: ensure dosimetry_quarterly table exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS dosimetry_quarterly (
        id SERIAL PRIMARY KEY,
        worker_rut VARCHAR(12) NOT NULL,
        worker_name VARCHAR(200) NOT NULL,
        year INT NOT NULL,
        quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
        period_label VARCHAR(20),
        dose_body NUMERIC(8,3) DEFAULT 0,
        dose_lens NUMERIC(8,3) DEFAULT 0,
        dose_skin NUMERIC(8,3) DEFAULT 0,
        accum_year_body NUMERIC(8,3) DEFAULT 0,
        accum_12m_body NUMERIC(8,3) DEFAULT 0,
        accum_60m_body NUMERIC(8,3) DEFAULT 0,
        level VARCHAR(20) DEFAULT 'normal',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (worker_rut, year, quarter)
      )
    `;
  } catch { /* already exists */ }

  // Seed demo data if table is empty
  let seeded = false;
  try {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM dosimetry_quarterly`;
    if (Number((cnt[0] as any)?.n ?? 0) === 0) {
      const demoWorkers = [
        { rut: "12345678-9", name: "Juan Pérez González" },
        { rut: "98765432-1", name: "María Silva Muñoz" },
        { rut: "11223344-5", name: "Carlos Torres Riquelme" },
        { rut: "55667788-9", name: "Ana López Fuentes" },
      ];
      const currentYear = new Date().getFullYear();
      for (const w of demoWorkers) {
        for (let q = 1; q <= 4; q++) {
          const dose = parseFloat((Math.random() * 2.5).toFixed(3));
          const level = getLevel(dose);
          const accum = parseFloat((dose * q * 0.9).toFixed(3));
          await sql`
            INSERT INTO dosimetry_quarterly
              (worker_rut, worker_name, year, quarter, period_label,
               dose_body, dose_lens, dose_skin,
               accum_year_body, accum_12m_body, accum_60m_body, level)
            VALUES
              (${w.rut}, ${w.name}, ${currentYear}, ${q},
               ${"T" + q + "-" + currentYear},
               ${dose}, ${parseFloat((dose * 0.3).toFixed(3))}, ${parseFloat((dose * 0.5).toFixed(3))},
               ${accum}, ${accum}, ${accum},
               ${level})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      seeded = true;
    }
  } catch { /* table may not exist yet */ }

  let rows: DosRow[] = [];
  let totalWorkers = 0;
  let countNI1 = 0;
  let countNI2 = 0;
  let countExceeded = 0;

  try {
    const { rows: dbRows } = await sql`
      SELECT worker_rut, worker_name, year, quarter, period_label,
             dose_body::float, dose_lens::float, dose_skin::float,
             accum_year_body::float, accum_12m_body::float, accum_60m_body::float,
             level
      FROM dosimetry_quarterly
      ORDER BY year DESC, quarter DESC, worker_name ASC
      LIMIT 200
    `;
    rows = dbRows as DosRow[];

    // KPI counts from latest quarter for each worker
    const latestByWorker = new Map<string, DosRow>();
    for (const r of rows) {
      const key = r.worker_rut;
      if (!latestByWorker.has(key)) latestByWorker.set(key, r);
    }
    totalWorkers = latestByWorker.size;
    for (const r of latestByWorker.values()) {
      const lv = r.level as LevelType;
      if (lv === "ni1") countNI1++;
      else if (lv === "ni2") countNI2++;
      else if (lv === "exceeded") countExceeded++;
    }
  } catch { /* tabla no creada */ }

  // Group by worker for the main table
  const byWorker = new Map<string, DosRow[]>();
  for (const r of rows) {
    const existing = byWorker.get(r.worker_rut) ?? [];
    existing.push(r);
    byWorker.set(r.worker_rut, existing);
  }

  const workerList = Array.from(byWorker.entries()).map(([rut, records]) => ({
    rut,
    name: records[0]!.worker_name,
    records: records.sort((a, b) => a.year - b.year || a.quarter - b.quarter),
    latestLevel: (records[0]!.level as LevelType) ?? "normal",
  }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dosimetría Personal — Seguimiento Trimestral</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Niveles de Investigación (NI) según DS 3/1985 MINSAL · ICRP 103 · NS-06.0 §11
          {seeded && <span className="ml-2 text-accent">(datos demo inicializados)</span>}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KPICard label="Trabajadores" value={totalWorkers} href="/dosimetry" icon={Users as ComponentType<{ className?: string }>} />
        <KPICard label="NI-1 (Investigar)" value={countNI1} href="/dosimetry" icon={TrendingUp as ComponentType<{ className?: string }>} tone={countNI1 > 0 ? "warning" : "default"} />
        <KPICard label="NI-2 (Acción)" value={countNI2} href="/dosimetry" icon={AlertTriangle as ComponentType<{ className?: string }>} tone={countNI2 > 0 ? "danger" : "default"} />
        <KPICard label="Supera límite" value={countExceeded} href="/dosimetry" icon={ShieldAlert as ComponentType<{ className?: string }>} tone={countExceeded > 0 ? "danger" : "default"} />
        <KPICard label="Lím. anual (mSv)" value={LIMITS.ANNUAL_BODY_OCC} href="/dosimetry" icon={Activity as ComponentType<{ className?: string }>} hint="DS 3/1985" />
        <KPICard label="Lím. trim. (mSv)" value={LIMITS.QUARTERLY_BODY_OCC} href="/dosimetry" icon={CheckCircle2 as ComponentType<{ className?: string }>} hint="20 mSv / 4" />
      </div>

      {/* Alerta si hay NI-2 o superados */}
      {(countNI2 > 0 || countExceeded > 0) && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>⚠ Acción requerida:</strong> {countExceeded > 0 && `${countExceeded} trabajador(es) superan el límite trimestral (5 mSv). Notificar al OPR e investigar causa inmediata.`}
          {countNI2 > 0 && ` ${countNI2} trabajador(es) en NI-2 requieren revisión de prácticas y reducción de dosis.`}
          {" "}Regulación: NS-06.0 §11, DS 3/1985 Art. 15.
        </div>
      )}

      {/* Tabla de límites de referencia */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-3">Límites de Dosis y Niveles de Investigación — DS 3/1985 MINSAL</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Nivel</th>
                <th className="pb-2 pr-4 font-medium">Umbral trimestral</th>
                <th className="pb-2 pr-4 font-medium">Acción requerida</th>
                <th className="pb-2 font-medium">Base regulatoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr className="text-green-700">
                <td className="py-1.5 pr-4 font-medium">Normal</td>
                <td className="py-1.5 pr-4">&lt; 1.25 mSv/trim</td>
                <td className="py-1.5 pr-4">Ninguna</td>
                <td className="py-1.5 text-muted-foreground">DS 3/1985 Art. 3</td>
              </tr>
              <tr className="text-amber-700">
                <td className="py-1.5 pr-4 font-medium">NI-1 — Investigar</td>
                <td className="py-1.5 pr-4">≥ 1.25 mSv/trim (25%)</td>
                <td className="py-1.5 pr-4">Revisar procedimientos, registrar causa</td>
                <td className="py-1.5 text-muted-foreground">NS-06.0 §11.3</td>
              </tr>
              <tr className="text-orange-700">
                <td className="py-1.5 pr-4 font-medium">NI-2 — Acción</td>
                <td className="py-1.5 pr-4">≥ 3.75 mSv/trim (75%)</td>
                <td className="py-1.5 pr-4">Investigación formal OPR, restricción actividades</td>
                <td className="py-1.5 text-muted-foreground">NS-06.0 §11.4</td>
              </tr>
              <tr className="text-red-700">
                <td className="py-1.5 pr-4 font-medium">Supera límite</td>
                <td className="py-1.5 pr-4">≥ 5 mSv/trim</td>
                <td className="py-1.5 pr-4">Notificar CCHEN, suspender exposición, investigación</td>
                <td className="py-1.5 text-muted-foreground">DS 3/1985 · NS-06.0 §16</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla dosimétrica por trabajador */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Registros Trimestrales por Trabajador</h2>
          <div className="flex gap-2">
            <a
              href="/api/reports/generate?type=dosimetry_quarterly&format=csv"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              ↓ Exportar CSV
            </a>
            <a
              href="/api/reports/generate?type=dosimetry_monthly&format=csv"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              ↓ Lecturas CSV
            </a>
          </div>
        </div>
        {workerList.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin datos dosimétricos. Ingrese lecturas en el módulo de dosimetría o ejecute{" "}
            <a href="/api/init" className="text-accent underline">/api/init</a> para datos demo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Trabajador</th>
                  <th className="px-3 py-2 font-medium">RUT</th>
                  <th className="px-3 py-2 font-medium">Período</th>
                  <th className="px-3 py-2 font-medium text-right">Cuerpo (mSv)</th>
                  <th className="px-3 py-2 font-medium text-right">Cristalino</th>
                  <th className="px-3 py-2 font-medium text-right">Piel</th>
                  <th className="px-3 py-2 font-medium text-right">Acum. año</th>
                  <th className="px-3 py-2 font-medium text-right">Acum. 12m</th>
                  <th className="px-3 py-2 font-medium">Nivel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {workerList.flatMap(({ rut, name, records }) =>
                  records.map((r, idx) => {
                    const lv = r.level as LevelType;
                    const { label, cls } = LEVEL_LABEL[lv] ?? LEVEL_LABEL.normal;
                    const rowBg =
                      lv === "exceeded"
                        ? "bg-red-50/40"
                        : lv === "ni2"
                        ? "bg-orange-50/30"
                        : lv === "ni1"
                        ? "bg-amber-50/20"
                        : "";
                    return (
                      <tr key={`${rut}-${r.year}-${r.quarter}`} className={rowBg}>
                        <td className="px-4 py-1.5 font-medium">{idx === 0 ? name : ""}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{idx === 0 ? rut : ""}</td>
                        <td className="px-3 py-1.5 font-mono">{r.period_label ?? `T${r.quarter}-${r.year}`}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.dose_body).toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.dose_lens).toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.dose_skin).toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.accum_year_body).toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.accum_12m_body).toFixed(3)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                            {label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pie regulatorio */}
      <div className="rounded-xl border border-border bg-surface p-5 text-xs text-muted-foreground">
        <h3 className="font-semibold text-foreground mb-2">Base Regulatoria</h3>
        <div className="grid gap-1 md:grid-cols-2">
          <div>• DS 3/1985 MINSAL: Límite anual 20 mSv cuerpo entero, 20 mSv cristalino, 500 mSv piel</div>
          <div>• NS-06.0 CCHEN §11: Programa de vigilancia dosimétrica individual</div>
          <div>• ICRP 103 (2007): Sistema de protección radiológica — limitación de dosis</div>
          <div>• ICRP 118 (2012): Límite cristalino 20 mSv/año (revisado de 150 mSv)</div>
          <div>• NS-06.0 §11.3: NI-1 al 25% del límite trimestral (1.25 mSv)</div>
          <div>• NS-06.0 §11.4: NI-2 al 75% del límite trimestral (3.75 mSv)</div>
        </div>
      </div>
    </div>
  );
}
