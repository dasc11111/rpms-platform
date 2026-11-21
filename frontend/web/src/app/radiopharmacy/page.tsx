import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  FlaskConical,
  Thermometer,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Beaker,
  Timer,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

// Límites regulatorios radiofarmacia — NS-06.0 §8, USP <797>, IAEA-TECDOC-1708
const QC_LIMITS = {
  RADIONUCLIDIC_PURITY_MIN: 99.9,   // % mínimo pureza radionuclídica
  RADIOCHEMICAL_PURITY_MIN: 95.0,   // % mínimo pureza radioquímica Tc-99m
  PH_MIN: 4.0,
  PH_MAX: 8.5,
  STERILITY_ENDOTOXIN_MAX: 175,     // EU/m (endotoxinas)
  DOSE_CALIBRATOR_TOLERANCE: 5.0,   // % máx variación calibrador de dosis
  TEMP_COLD_MIN: 2,
  TEMP_COLD_MAX: 8,                  // °C refrigeración
};

type PrepStatus = "pending" | "in_qc" | "released" | "rejected" | "expired" | "administered";
type RadioPharmType = "diagnostic" | "therapeutic" | "in_vitro";
type PrepState = "liquid" | "kit" | "generator";

interface PrepRow {
  id: number;
  batch_code: string;
  radiopharmaceutical: string;
  nuclide: string;
  rp_type: RadioPharmType;
  physical_state: PrepState;
  activity_mbq: number;
  volume_ml: number;
  concentration_mbq_ml: number | null;
  ph: number | null;
  radiochemical_purity: number | null;
  radionuclidic_purity: number | null;
  preparation_date: string;
  expiry_time: string;
  status: PrepStatus;
  prepared_by: string | null;
  qc_pass: boolean | null;
  doses_planned: number;
  doses_dispensed: number;
  notes: string | null;
}

const STATUS_LABEL: Record<PrepStatus, { label: string; cls: string }> = {
  pending:      { label: "Preparando",    cls: "text-blue-700 bg-blue-50" },
  in_qc:        { label: "Control CC",   cls: "text-amber-700 bg-amber-50" },
  released:     { label: "Liberado",     cls: "text-green-700 bg-green-50" },
  rejected:     { label: "Rechazado",    cls: "text-red-700 bg-red-50" },
  expired:      { label: "Vencido",      cls: "text-gray-500 bg-gray-50" },
  administered: { label: "Administrado", cls: "text-purple-700 bg-purple-50" },
};

const RP_TYPE_LABEL: Record<RadioPharmType, string> = {
  diagnostic:  "Diagnóstico",
  therapeutic: "Terapéutico",
  in_vitro:    "In vitro",
};

// Radiofármacos frecuentes en Medicina Nuclear
const COMMON_RPS = [
  { name: "Tc-99m MDP (oseo)",         nuclide: "Tc-99m", halfLife: 0.251, activity: 925,  doses: 10, type: "diagnostic" as RadioPharmType },
  { name: "Tc-99m DTPA (renal)",        nuclide: "Tc-99m", halfLife: 0.251, activity: 185,  doses: 4,  type: "diagnostic" as RadioPharmType },
  { name: "Tc-99m Sestamibi (cardio)",  nuclide: "Tc-99m", halfLife: 0.251, activity: 740,  doses: 8,  type: "diagnostic" as RadioPharmType },
  { name: "Tc-99m MAG3 (renal)",        nuclide: "Tc-99m", halfLife: 0.251, activity: 185,  doses: 4,  type: "diagnostic" as RadioPharmType },
  { name: "F-18 FDG (PET metabólico)",  nuclide: "F-18",   halfLife: 0.077, activity: 7400, doses: 20, type: "diagnostic" as RadioPharmType },
  { name: "Ga-67 Citrato (infección)", nuclide: "Ga-67",  halfLife: 3.26,  activity: 185,  doses: 3,  type: "diagnostic" as RadioPharmType },
  { name: "Lu-177 DOTATATE (PRRT)",    nuclide: "Lu-177", halfLife: 6.65,  activity: 7400, doses: 1,  type: "therapeutic" as RadioPharmType },
  { name: "I-131 NaI (terapia)",       nuclide: "I-131",  halfLife: 8.02,  activity: 3700, doses: 1,  type: "therapeutic" as RadioPharmType },
];

export default async function RadiopharmacyPage() {
  // Lazy migration
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS radiopharmacy_preps (
        id SERIAL PRIMARY KEY,
        batch_code VARCHAR(50) UNIQUE NOT NULL,
        radiopharmaceutical VARCHAR(200) NOT NULL,
        nuclide VARCHAR(30) NOT NULL,
        rp_type VARCHAR(20) DEFAULT 'diagnostic',
        physical_state VARCHAR(20) DEFAULT 'liquid',
        activity_mbq NUMERIC(12,2) NOT NULL,
        volume_ml NUMERIC(8,2),
        concentration_mbq_ml NUMERIC(10,3),
        ph NUMERIC(4,2),
        radiochemical_purity NUMERIC(5,2),
        radionuclidic_purity NUMERIC(6,3),
        preparation_date TIMESTAMPTZ NOT NULL,
        expiry_time TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        prepared_by VARCHAR(200),
        qc_pass BOOLEAN,
        doses_planned INT DEFAULT 1,
        doses_dispensed INT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS radiopharmacy_generator_records (
        id SERIAL PRIMARY KEY,
        generator_id VARCHAR(50) NOT NULL,
        nuclide_parent VARCHAR(30) NOT NULL,
        nuclide_daughter VARCHAR(30) NOT NULL,
        calibration_activity_gbq NUMERIC(10,2) NOT NULL,
        calibration_date TIMESTAMPTZ NOT NULL,
        elution_count INT DEFAULT 0,
        last_elution TIMESTAMPTZ,
        aluminum_pass BOOLEAN,
        molybdenum_breakthrough_ppm NUMERIC(6,3),
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch { /* already exists */ }

  // Seed demo preps
  let seeded = false;
  try {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM radiopharmacy_preps`;
    if (Number((cnt[0] as any)?.n ?? 0) === 0) {
      for (let i = 0; i < COMMON_RPS.length; i++) {
        const rp = COMMON_RPS[i]!;
        const statusOpts: PrepStatus[] = ["released", "released", "released", "in_qc", "pending", "administered", "rejected", "expired"];
        const st = statusOpts[i % statusOpts.length]!;
        await sql`
          INSERT INTO radiopharmacy_preps
            (batch_code, radiopharmaceutical, nuclide, rp_type, physical_state,
             activity_mbq, volume_ml, concentration_mbq_ml, ph,
             radiochemical_purity, radionuclidic_purity,
             preparation_date, expiry_time, status, prepared_by, qc_pass,
             doses_planned, doses_dispensed)
          VALUES
            (${`RP-2024-${String(i + 1).padStart(3, "0")}`},
             ${rp.name}, ${rp.nuclide}, ${rp.type}, 'liquid',
             ${rp.activity}, ${(rp.activity / rp.doses).toFixed(1)},
             ${(rp.doses).toFixed(1)},
             ${(5.5 + Math.random() * 1.5).toFixed(1)},
             ${(96 + Math.random() * 3.9).toFixed(1)},
             ${(99.9 + Math.random() * 0.09).toFixed(3)},
             now() - interval '2 hours', now() + interval '6 hours',
             ${st},
             'TM Diego Solís Catalán',
             ${st === "released" || st === "administered"},
             ${rp.doses},
             ${st === "administered" ? rp.doses : st === "released" ? Math.floor(rp.doses * 0.5) : 0})
          ON CONFLICT DO NOTHING
        `;
      }

      // Seed generator
      await sql`
        INSERT INTO radiopharmacy_generator_records
          (generator_id, nuclide_parent, nuclide_daughter, calibration_activity_gbq,
           calibration_date, elution_count, last_elution, aluminum_pass,
           molybdenum_breakthrough_ppm, status)
        VALUES
          ('GEN-MO99-001', 'Mo-99', 'Tc-99m', 37.0,
           now() - interval '3 days', 6, now() - interval '20 hours',
           true, 0.002, 'active')
        ON CONFLICT DO NOTHING
      `;
      seeded = true;
    }
  } catch { /* table doesn't exist */ }

  let preps: PrepRow[] = [];
  let totalBatches = 0, released = 0, inQC = 0, rejected = 0;

  try {
    const { rows } = await sql`
      SELECT id, batch_code, radiopharmaceutical, nuclide, rp_type, physical_state,
             activity_mbq::float, volume_ml::float, concentration_mbq_ml::float,
             ph::float, radiochemical_purity::float, radionuclidic_purity::float,
             preparation_date::text, expiry_time::text, status, prepared_by,
             qc_pass, doses_planned, doses_dispensed, notes
      FROM radiopharmacy_preps
      ORDER BY preparation_date DESC
      LIMIT 50
    `;
    preps = rows as PrepRow[];
    totalBatches = preps.length;
    for (const p of preps) {
      if (p.status === "released") released++;
      else if (p.status === "in_qc") inQC++;
      else if (p.status === "rejected") rejected++;
    }
  } catch { /* table doesn't exist */ }

  interface GenRow {
    id: number;
    generator_id: string;
    nuclide_parent: string;
    nuclide_daughter: string;
    calibration_activity_gbq: number;
    calibration_date: string;
    elution_count: number;
    last_elution: string | null;
    aluminum_pass: boolean | null;
    molybdenum_breakthrough_ppm: number | null;
    status: string;
  }
  let generators: GenRow[] = [];
  try {
    const { rows } = await sql`
      SELECT id, generator_id, nuclide_parent, nuclide_daughter,
             calibration_activity_gbq::float, calibration_date::text,
             elution_count, last_elution::text, aluminum_pass,
             molybdenum_breakthrough_ppm::float, status
      FROM radiopharmacy_generator_records
      ORDER BY calibration_date DESC LIMIT 5
    `;
    generators = rows as GenRow[];
  } catch { /* ok */ }

  function fmtDate(dt: string) {
    try { return new Date(dt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }); }
    catch { return dt; }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Radiofarmacia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preparación, control de calidad y trazabilidad de radiofármacos
          {seeded && <span className="ml-2 text-accent">(datos demo inicializados)</span>}
        </p>
        <p className="text-xs text-muted-foreground">NS-06.0 §8 CCHEN · USP {"<797>"} · IAEA-TECDOC-1708 · DS 3/1985</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KPICard label="Lotes hoy" value={totalBatches} href="/radiopharmacy" icon={FlaskConical as ComponentType<{ className?: string }>} />
        <KPICard label="Liberados" value={released} href="/radiopharmacy" icon={CheckCircle2 as ComponentType<{ className?: string }>} tone="success" />
        <KPICard label="En control CC" value={inQC} href="/radiopharmacy" icon={Beaker as ComponentType<{ className?: string }>} tone="warning" />
        <KPICard label="Rechazados" value={rejected} href="/radiopharmacy" icon={AlertTriangle as ComponentType<{ className?: string }>} tone={rejected > 0 ? "danger" : "default"} />
        <KPICard label="Generadores activos" value={generators.filter(g => g.status === "active").length} href="/radiopharmacy" icon={Timer as ComponentType<{ className?: string }>} hint="Mo-99/Tc-99m" />
        <KPICard label="Pureza RC mín." value={`${QC_LIMITS.RADIOCHEMICAL_PURITY_MIN}%`} href="/radiopharmacy" icon={ShieldCheck as ComponentType<{ className?: string }>} hint="Tc-99m USP" />
      </div>

      {/* Control de calidad — límites */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-3">Parámetros Control de Calidad — USP {"<797>"} / NS-06.0 §8</h2>
        <div className="grid gap-2 text-xs md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Pureza radionuclídica", value: `≥ ${QC_LIMITS.RADIONUCLIDIC_PURITY_MIN}%`, icon: "🔬" },
            { label: "Pureza radioquímica", value: `≥ ${QC_LIMITS.RADIOCHEMICAL_PURITY_MIN}%`, icon: "⚗️" },
            { label: "pH aceptable", value: `${QC_LIMITS.PH_MIN} – ${QC_LIMITS.PH_MAX}`, icon: "🧪" },
            { label: "Endotoxinas máx", value: `${QC_LIMITS.STERILITY_ENDOTOXIN_MAX} EU/m`, icon: "🦠" },
            { label: "Calibrador dosis", value: `± ${QC_LIMITS.DOSE_CALIBRATOR_TOLERANCE}%`, icon: "📡" },
            { label: "Temperatura refrigeración", value: `${QC_LIMITS.TEMP_COLD_MIN}–${QC_LIMITS.TEMP_COLD_MAX} °C`, icon: "🌡️" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background p-3">
              <div className="text-lg">{item.icon}</div>
              <div className="mt-1 font-semibold text-foreground">{item.value}</div>
              <div className="text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Generadores */}
      {generators.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <Thermometer className="h-4 w-4 text-accent" />
            <h2 className="font-semibold">Generadores Mo-99 / Tc-99m</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">ID Generador</th>
                  <th className="px-3 py-2 font-medium">Par madre/hija</th>
                  <th className="px-3 py-2 font-medium text-right">Act. calibración (GBq)</th>
                  <th className="px-3 py-2 font-medium">Fecha calibración</th>
                  <th className="px-3 py-2 font-medium text-right">Eluciones</th>
                  <th className="px-3 py-2 font-medium">Última elución</th>
                  <th className="px-3 py-2 font-medium">Al³⁺</th>
                  <th className="px-3 py-2 font-medium">Mo breakthrough</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {generators.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-2 font-mono font-medium">{g.generator_id}</td>
                    <td className="px-3 py-2 font-mono">{g.nuclide_parent}/{g.nuclide_daughter}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.calibration_activity_gbq.toFixed(1)}</td>
                    <td className="px-3 py-2">{fmtDate(g.calibration_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.elution_count}</td>
                    <td className="px-3 py-2">{g.last_elution ? fmtDate(g.last_elution) : "—"}</td>
                    <td className="px-3 py-2">
                      {g.aluminum_pass === null ? "—" : g.aluminum_pass
                        ? <span className="text-green-600 font-semibold">✓ OK</span>
                        : <span className="text-red-600 font-semibold">✗ Falla</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {g.molybdenum_breakthrough_ppm !== null
                        ? `${g.molybdenum_breakthrough_ppm.toFixed(3)} ppm`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.status === "active" ? "text-green-700 bg-green-50" : "text-gray-500 bg-gray-50"}`}>
                        {g.status === "active" ? "Activo" : g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla de lotes */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-accent" />
            <h2 className="font-semibold">Lotes de Radiofármacos</h2>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Vigencia calculada en tiempo real</span>
          </div>
        </div>
        {preps.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sin registros hoy.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Lote</th>
                  <th className="px-3 py-2 font-medium">Radiofármaco</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium text-right">Act. (MBq)</th>
                  <th className="px-3 py-2 font-medium text-right">pH</th>
                  <th className="px-3 py-2 font-medium text-right">Pur. RC%</th>
                  <th className="px-3 py-2 font-medium text-right">Pur. RN%</th>
                  <th className="px-3 py-2 font-medium">Vencimiento</th>
                  <th className="px-3 py-2 font-medium">Dosis P/D</th>
                  <th className="px-3 py-2 font-medium">CC</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {preps.map((p) => {
                  const sl = STATUS_LABEL[p.status] ?? STATUS_LABEL.pending;
                  const rcOk = p.radiochemical_purity === null || p.radiochemical_purity >= QC_LIMITS.RADIOCHEMICAL_PURITY_MIN;
                  const rnOk = p.radionuclidic_purity === null || p.radionuclidic_purity >= QC_LIMITS.RADIONUCLIDIC_PURITY_MIN;
                  const expired = p.status !== "expired" && new Date(p.expiry_time) < new Date();
                  return (
                    <tr
                      key={p.id}
                      className={
                        p.status === "rejected" || (!rcOk && !rnOk)
                          ? "bg-red-50/20"
                          : p.status === "released"
                          ? "bg-green-50/10"
                          : expired
                          ? "bg-gray-50/20"
                          : ""
                      }
                    >
                      <td className="px-4 py-1.5 font-mono font-medium">{p.batch_code}</td>
                      <td className="px-3 py-1.5 max-w-[160px] truncate" title={p.radiopharmaceutical}>{p.radiopharmaceutical}</td>
                      <td className="px-3 py-1.5">{RP_TYPE_LABEL[p.rp_type] ?? p.rp_type}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.activity_mbq.toFixed(0)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${p.ph !== null && (p.ph < QC_LIMITS.PH_MIN || p.ph > QC_LIMITS.PH_MAX) ? "text-red-600 font-semibold" : ""}`}>
                        {p.ph !== null ? p.ph.toFixed(1) : "—"}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${!rcOk ? "text-red-600 font-semibold" : "text-green-700"}`}>
                        {p.radiochemical_purity !== null ? `${p.radiochemical_purity.toFixed(1)}%` : "—"}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${!rnOk ? "text-red-600 font-semibold" : "text-green-700"}`}>
                        {p.radionuclidic_purity !== null ? `${p.radionuclidic_purity.toFixed(3)}%` : "—"}
                      </td>
                      <td className={`px-3 py-1.5 ${expired ? "text-red-600 font-semibold" : ""}`}>
                        {fmtDate(p.expiry_time)}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {p.doses_dispensed}/{p.doses_planned}
                      </td>
                      <td className="px-3 py-1.5">
                        {p.qc_pass === null ? "—" : p.qc_pass
                          ? <span className="text-green-600 font-semibold">✓</span>
                          : <span className="text-red-600 font-semibold">✗</span>}
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
