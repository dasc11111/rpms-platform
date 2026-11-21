import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Biohazard,
  MapPin,
  ShieldAlert,
  ClipboardCheck,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

// Límites de contaminación superficial NS-06.0 CCHEN / IAEA BSS — Bq/cm²
const CONTAMINATION_LIMITS = {
  // Área controlada (zona radiactiva)
  CONTROLLED_BETA_GAMMA: 3.7,   // 3.7 Bq/cm² = 0.1 nCi/cm²
  CONTROLLED_ALPHA: 0.37,       // 0.37 Bq/cm² = 0.01 nCi/cm²
  // Área supervisada
  SUPERVISED_BETA_GAMMA: 0.37,  // 0.37 Bq/cm²
  SUPERVISED_ALPHA: 0.037,      // 0.037 Bq/cm²
  // Material no controlado (liberación)
  RELEASE_BETA_GAMMA: 0.4,      // 0.4 Bq/cm² (IAEA RS-G-1.7)
  RELEASE_ALPHA: 0.04,          // 0.04 Bq/cm²
  // Dosis ambiental (μSv/h)
  AMBIENT_CONTROLLED_MAX: 25,   // μSv/h en área controlada
  AMBIENT_SUPERVISED_MAX: 2.5,  // μSv/h en área supervisada
  AMBIENT_PUBLIC_MAX: 0.1,      // μSv/h para público
};

type MeasureType = "surface" | "ambient" | "air";
type ZoneType = "controlled" | "supervised" | "public";
type MeasureResult = "pass" | "investigation" | "fail";

interface ContamRow {
  id: number;
  location: string;
  zone_type: ZoneType;
  measure_type: MeasureType;
  nuclide: string;
  value: number;
  unit: string;
  result: MeasureResult;
  measured_by: string;
  measured_at: string;
  instrument_id: string | null;
  notes: string | null;
}

const ZONE_LABEL: Record<ZoneType, { label: string; cls: string }> = {
  controlled: { label: "Controlada",   cls: "text-red-700 bg-red-50" },
  supervised: { label: "Supervisada",  cls: "text-amber-700 bg-amber-50" },
  public:     { label: "Pública",      cls: "text-green-700 bg-green-50" },
};

const RESULT_LABEL: Record<MeasureResult, { label: string; cls: string }> = {
  pass:          { label: "Conforme",        cls: "text-green-700 bg-green-50" },
  investigation: { label: "Investigación",   cls: "text-amber-700 bg-amber-50" },
  fail:          { label: "No conforme",     cls: "text-red-700 bg-red-50" },
};

const MEASURE_LABEL: Record<MeasureType, string> = {
  surface: "Sup. (Bq/cm²)",
  ambient: "Ambiental (μSv/h)",
  air:     "Aire (Bq/m³)",
};

export default async function ContaminationPage() {
  // Lazy migration
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS contamination_records (
        id SERIAL PRIMARY KEY,
        location VARCHAR(200) NOT NULL,
        zone_type VARCHAR(20) DEFAULT 'controlled',
        measure_type VARCHAR(20) DEFAULT 'surface',
        nuclide VARCHAR(30) DEFAULT 'I-131',
        value NUMERIC(12,4) NOT NULL,
        unit VARCHAR(20) DEFAULT 'Bq/cm2',
        result VARCHAR(20) DEFAULT 'pass',
        measured_by VARCHAR(200),
        measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        instrument_id VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch { /* already exists */ }

  // Seed demo data
  let seeded = false;
  try {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM contamination_records`;
    if (Number((cnt[0] as any)?.n ?? 0) === 0) {
      const demos = [
        { loc: "Sala de dosis oral I-131", zone: "controlled", type: "surface", nuc: "I-131", val: 2.1, unit: "Bq/cm2", result: "pass" },
        { loc: "Sala de dosis oral I-131", zone: "controlled", type: "ambient", nuc: "I-131", val: 12.5, unit: "uSv/h", result: "pass" },
        { loc: "Sala de espera post-terapia", zone: "supervised", type: "surface", nuc: "I-131", val: 0.52, unit: "Bq/cm2", result: "investigation" },
        { loc: "Baño pacientes hospitalizados", zone: "controlled", type: "surface", nuc: "I-131", val: 4.8, unit: "Bq/cm2", result: "fail" },
        { loc: "Pasillo área nuclear", zone: "supervised", type: "ambient", nuc: "varios", val: 1.2, unit: "uSv/h", result: "pass" },
        { loc: "Sala de gammacámara", zone: "controlled", type: "surface", nuc: "Tc-99m", val: 0.8, unit: "Bq/cm2", result: "pass" },
        { loc: "Sala de gammacámara", zone: "controlled", type: "ambient", nuc: "Tc-99m", val: 3.2, unit: "uSv/h", result: "pass" },
        { loc: "Acceso área nuclear", zone: "supervised", type: "surface", nuc: "Tc-99m", val: 0.15, unit: "Bq/cm2", result: "pass" },
        { loc: "Bodega de residuos", zone: "controlled", type: "ambient", nuc: "varios", val: 18.7, unit: "uSv/h", result: "pass" },
        { loc: "Sala de preparación radiofármacos", zone: "controlled", type: "surface", nuc: "Tc-99m", val: 1.9, unit: "Bq/cm2", result: "pass" },
      ];
      for (const d of demos) {
        await sql`
          INSERT INTO contamination_records
            (location, zone_type, measure_type, nuclide, value, unit, result, measured_by, measured_at)
          VALUES
            (${d.loc}, ${d.zone}, ${d.type}, ${d.nuc}, ${d.val}, ${d.unit}, ${d.result},
             'TM Diego Solís Catalán', now() - (random() * interval '7 days'))
        `;
      }
      seeded = true;
    }
  } catch { /* table doesn't exist */ }

  let rows: ContamRow[] = [];
  let totalMeasures = 0;
  let totalFail = 0;
  let totalInvestigation = 0;
  let totalPass = 0;

  try {
    const { rows: dbRows } = await sql`
      SELECT id, location, zone_type, measure_type, nuclide,
             value::float, unit, result, measured_by,
             measured_at::text, instrument_id, notes
      FROM contamination_records
      ORDER BY measured_at DESC
      LIMIT 100
    `;
    rows = dbRows as ContamRow[];
    totalMeasures = rows.length;
    for (const r of rows) {
      if (r.result === "fail") totalFail++;
      else if (r.result === "investigation") totalInvestigation++;
      else totalPass++;
    }
  } catch { /* tabla no existe */ }

  // Group by location for summary
  const byLocation = new Map<string, { pass: number; invest: number; fail: number }>();
  for (const r of rows) {
    const existing = byLocation.get(r.location) ?? { pass: 0, invest: 0, fail: 0 };
    if (r.result === "fail") existing.fail++;
    else if (r.result === "investigation") existing.invest++;
    else existing.pass++;
    byLocation.set(r.location, existing);
  }
  const locationSummary = Array.from(byLocation.entries())
    .map(([loc, counts]) => ({ loc, ...counts }))
    .sort((a, b) => b.fail - a.fail || b.invest - a.invest);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Registro de Contaminación Radiactiva</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitoreo de contaminación superficial y ambiental en áreas controladas y supervisadas
          {seeded && <span className="ml-2 text-accent">(datos demo inicializados)</span>}
        </p>
        <p className="text-xs text-muted-foreground">NS-06.0 CCHEN §7 · IAEA BSS (GSR Part 3) · DS 133/1984</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KPICard label="Total mediciones" value={totalMeasures} href="/contamination" icon={ClipboardCheck as ComponentType<{ className?: string }>} />
        <KPICard label="Conformes" value={totalPass} href="/contamination" icon={CheckCircle2 as ComponentType<{ className?: string }>} tone="success" />
        <KPICard label="En investigación" value={totalInvestigation} href="/contamination" icon={AlertTriangle as ComponentType<{ className?: string }>} tone={totalInvestigation > 0 ? "warning" : "default"} />
        <KPICard label="No conformes" value={totalFail} href="/contamination" icon={Biohazard as ComponentType<{ className?: string }>} tone={totalFail > 0 ? "danger" : "default"} />
        <KPICard label="Lím. β/γ ctrl (Bq/cm²)" value={CONTAMINATION_LIMITS.CONTROLLED_BETA_GAMMA} href="/contamination" icon={ShieldAlert as ComponentType<{ className?: string }>} hint="NS-06.0 §7" />
        <KPICard label="Lím. amb. ctrl (μSv/h)" value={CONTAMINATION_LIMITS.AMBIENT_CONTROLLED_MAX} href="/contamination" icon={MapPin as ComponentType<{ className?: string }>} hint="Área controlada" />
      </div>

      {/* Alertas */}
      {totalFail > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>⚠ Contaminación no conforme detectada:</strong> {totalFail} medición(es) superan los límites
          establecidos. Activar protocolo de descontaminación inmediata. NS-06.0 §7, DS 133/1984 Art. 55.
        </div>
      )}

      {/* Tabla de límites */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-3">Límites de Contaminación — NS-06.0 CCHEN / IAEA BSS</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Tipo de zona</th>
                <th className="pb-2 pr-4 font-medium">Sup. β/γ (Bq/cm²)</th>
                <th className="pb-2 pr-4 font-medium">Sup. α (Bq/cm²)</th>
                <th className="pb-2 pr-4 font-medium">Dosis ambiental (μSv/h)</th>
                <th className="pb-2 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr className="text-red-700">
                <td className="py-1.5 pr-4 font-medium">Área controlada</td>
                <td className="py-1.5 pr-4">{CONTAMINATION_LIMITS.CONTROLLED_BETA_GAMMA}</td>
                <td className="py-1.5 pr-4">{CONTAMINATION_LIMITS.CONTROLLED_ALPHA}</td>
                <td className="py-1.5 pr-4">≤ {CONTAMINATION_LIMITS.AMBIENT_CONTROLLED_MAX}</td>
                <td className="py-1.5 text-muted-foreground">NS-06.0 §7.2</td>
              </tr>
              <tr className="text-amber-700">
                <td className="py-1.5 pr-4 font-medium">Área supervisada</td>
                <td className="py-1.5 pr-4">{CONTAMINATION_LIMITS.SUPERVISED_BETA_GAMMA}</td>
                <td className="py-1.5 pr-4">{CONTAMINATION_LIMITS.SUPERVISED_ALPHA}</td>
                <td className="py-1.5 pr-4">≤ {CONTAMINATION_LIMITS.AMBIENT_SUPERVISED_MAX}</td>
                <td className="py-1.5 text-muted-foreground">NS-06.0 §7.3</td>
              </tr>
              <tr className="text-green-700">
                <td className="py-1.5 pr-4 font-medium">Liberación (público)</td>
                <td className="py-1.5 pr-4">{CONTAMINATION_LIMITS.RELEASE_BETA_GAMMA}</td>
                <td className="py-1.5 pr-4">{CONTAMINATION_LIMITS.RELEASE_ALPHA}</td>
                <td className="py-1.5 pr-4">≤ {CONTAMINATION_LIMITS.AMBIENT_PUBLIC_MAX}</td>
                <td className="py-1.5 text-muted-foreground">IAEA RS-G-1.7</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen por área */}
      {locationSummary.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold mb-3">Resumen por Área</h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {locationSummary.map((loc) => {
              const hasIssue = loc.fail > 0 || loc.invest > 0;
              return (
                <div
                  key={loc.loc}
                  className={`rounded-lg border p-3 text-xs ${
                    loc.fail > 0
                      ? "border-red-200 bg-red-50/40"
                      : loc.invest > 0
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <MapPin className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${loc.fail > 0 ? "text-red-500" : loc.invest > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                    <div>
                      <div className="font-medium">{loc.loc}</div>
                      <div className="mt-1 flex gap-2 text-muted-foreground">
                        {loc.pass > 0 && <span className="text-green-700">✓ {loc.pass}</span>}
                        {loc.invest > 0 && <span className="text-amber-700">⚡ {loc.invest}</span>}
                        {loc.fail > 0 && <span className="text-red-700">✗ {loc.fail}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla de mediciones */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Registro de Mediciones</h2>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin registros. Ejecute{" "}
            <a href="/api/init" className="text-accent underline">/api/init</a> para datos demo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Área / Ubicación</th>
                  <th className="px-3 py-2 font-medium">Zona</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Nuclido</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Medido por</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((r) => {
                  const zl = ZONE_LABEL[r.zone_type] ?? ZONE_LABEL.controlled;
                  const rl = RESULT_LABEL[r.result] ?? RESULT_LABEL.pass;
                  return (
                    <tr
                      key={r.id}
                      className={
                        r.result === "fail"
                          ? "bg-red-50/30"
                          : r.result === "investigation"
                          ? "bg-amber-50/20"
                          : ""
                      }
                    >
                      <td className="px-4 py-1.5 font-medium">{r.location}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${zl.cls}`}>
                          {zl.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {MEASURE_LABEL[r.measure_type] ?? r.measure_type}
                      </td>
                      <td className="px-3 py-1.5 font-mono">{r.nuclide}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        {Number(r.value).toFixed(3)} {r.unit}
                      </td>
                      <td className="px-3 py-1.5">{r.measured_by}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {r.measured_at ? r.measured_at.slice(0, 10) : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${rl.cls}`}>
                          {rl.label}
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
