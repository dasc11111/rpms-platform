import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import { ensurePetCtQcTables } from "@/lib/qc-petct-db";

export const dynamic = "force-dynamic";

/**
 * Hub de Control de Calidad — muestra resumen de los 4 módulos QC.
 * DS 133/1984 MINSAL · IAEA TECDOC-602.
 */

interface ModuleStats {
  totalTests: number;
  lastTestDate: string | null;
  outOfControl: number;
  warning: number;
  overdueTests: number;
  upcomingTests: number;
}

async function getActivimetroStats(): Promise<ModuleStats> {
  try {
    // Latest test per (instrument, test_type)
    const { rows: lastTests } = await sql`
      SELECT DISTINCT ON (instrument_id, test_type)
        instrument_id, test_type, test_date, result_status
      FROM qc_activimetro_tests
      ORDER BY instrument_id, test_type, test_date DESC, id DESC
    `;
    // Tolerances
    const { rows: tolerances } = await sql`
      SELECT test_type, frequency_days FROM qc_activimetro_tolerances WHERE active = true
    `;
    const { rows: countRow } = await sql`SELECT COUNT(*)::int AS n FROM qc_activimetro_tests`;
    const { rows: lastRow } = await sql`SELECT MAX(test_date)::text AS d FROM qc_activimetro_tests`;

    const freqMap = Object.fromEntries(tolerances.map((t) => [t.test_type, t.frequency_days as number]));
    const today = new Date();
    let overdue = 0, upcoming = 0, outOfControl = 0, warning = 0;
    for (const t of lastTests) {
      const status = t.result_status as string;
      if (status === "fuera_control_3de" || status === "no_cumple") outOfControl++;
      else if (status === "alerta_2de" || status === "advertencia") warning++;
      const freq = freqMap[t.test_type as string];
      if (freq) {
        const lastDate = new Date((t.test_date as string) + "T12:00:00");
        const daysSince = (today.getTime() - lastDate.getTime()) / 86400000;
        if (daysSince > freq) overdue++;
        else if (daysSince > freq * 0.85) upcoming++;
      }
    }
    return {
      totalTests: (countRow[0]?.n as number) ?? 0,
      lastTestDate: (lastRow[0]?.d as string) ?? null,
      outOfControl,
      warning,
      overdueTests: overdue,
      upcomingTests: upcoming,
    };
  } catch {
    return { totalTests: 0, lastTestDate: null, outOfControl: 0, warning: 0, overdueTests: 0, upcomingTests: 0 };
  }
}

async function getGammacamaraStats(): Promise<ModuleStats> {
  try {
    const { rows: lastTests } = await sql`
      SELECT DISTINCT ON (instrument_id, test_type, test_mode)
        instrument_id, test_type, test_mode, test_date, result_status
      FROM qc_gammacamara_tests
      ORDER BY instrument_id, test_type, test_mode, test_date DESC, id DESC
    `;
    const { rows: tolerances } = await sql`
      SELECT test_type, test_mode, frequency_days FROM qc_gammacamara_tolerances WHERE active = true
    `;
    const { rows: countRow } = await sql`SELECT COUNT(*)::int AS n FROM qc_gammacamara_tests`;
    const { rows: lastRow } = await sql`SELECT MAX(test_date)::text AS d FROM qc_gammacamara_tests`;

    const freqMap = Object.fromEntries(
      tolerances.map((t) => [`${t.test_type}|${t.test_mode}`, t.frequency_days as number])
    );
    const today = new Date();
    let overdue = 0, upcoming = 0, outOfControl = 0, warning = 0;
    for (const t of lastTests) {
      const status = t.result_status as string;
      if (status === "no_cumple") outOfControl++;
      else if (status === "advertencia") warning++;
      const freq = freqMap[`${t.test_type}|${t.test_mode}`] ?? freqMap[`${t.test_type}|na`];
      if (freq) {
        const lastDate = new Date((t.test_date as string) + "T12:00:00");
        const daysSince = (today.getTime() - lastDate.getTime()) / 86400000;
        if (daysSince > freq) overdue++;
        else if (daysSince > freq * 0.85) upcoming++;
      }
    }
    return {
      totalTests: (countRow[0]?.n as number) ?? 0,
      lastTestDate: (lastRow[0]?.d as string) ?? null,
      outOfControl,
      warning,
      overdueTests: overdue,
      upcomingTests: upcoming,
    };
  } catch {
    return { totalTests: 0, lastTestDate: null, outOfControl: 0, warning: 0, overdueTests: 0, upcomingTests: 0 };
  }
}

async function getSpectStats(): Promise<ModuleStats> {
  try {
    const { rows: lastTests } = await sql`
      SELECT DISTINCT ON (instrument_id, test_type, test_mode)
        instrument_id, test_type, test_mode, test_date, result_status
      FROM qc_spect_tests
      ORDER BY instrument_id, test_type, test_mode, test_date DESC, id DESC
    `;
    const { rows: tolerances } = await sql`
      SELECT test_type, test_mode, frequency_days FROM qc_spect_tolerances WHERE active = true
    `;
    const { rows: countRow } = await sql`SELECT COUNT(*)::int AS n FROM qc_spect_tests`;
    const { rows: lastRow } = await sql`SELECT MAX(test_date)::text AS d FROM qc_spect_tests`;

    const freqMap = Object.fromEntries(
      tolerances.map((t) => [`${t.test_type}|${t.test_mode}`, t.frequency_days as number])
    );
    const today = new Date();
    let overdue = 0, upcoming = 0, outOfControl = 0, warning = 0;
    for (const t of lastTests) {
      const status = t.result_status as string;
      if (status === "no_cumple") outOfControl++;
      else if (status === "advertencia") warning++;
      const freq = freqMap[`${t.test_type}|${t.test_mode}`] ?? freqMap[`${t.test_type}|na`];
      if (freq) {
        const lastDate = new Date((t.test_date as string) + "T12:00:00");
        const daysSince = (today.getTime() - lastDate.getTime()) / 86400000;
        if (daysSince > freq) overdue++;
        else if (daysSince > freq * 0.85) upcoming++;
      }
    }
    return {
      totalTests: (countRow[0]?.n as number) ?? 0,
      lastTestDate: (lastRow[0]?.d as string) ?? null,
      outOfControl,
      warning,
      overdueTests: overdue,
      upcomingTests: upcoming,
    };
  } catch {
    return { totalTests: 0, lastTestDate: null, outOfControl: 0, warning: 0, overdueTests: 0, upcomingTests: 0 };
  }
}

async function getPetctStats(): Promise<ModuleStats> {
  try {
    // PET/CT uses performed_at (timestamptz), status ('no_cumple'/'ok'/'requiere_revision'),
    // action_level ('advertencia'/'normal'), and equipment_id / test_code columns.
    const { rows: petLast } = await sql`
      SELECT DISTINCT ON (equipment_id, test_code)
        equipment_id, test_code, performed_at, status, action_level, is_finalized
      FROM qc_petct_pet_tests
      WHERE is_finalized = true
      ORDER BY equipment_id, test_code, performed_at DESC, id DESC
    `;
    const { rows: ctLast } = await sql`
      SELECT DISTINCT ON (equipment_id, test_code)
        equipment_id, test_code, performed_at, status, action_level, is_finalized
      FROM qc_petct_ct_tests
      WHERE is_finalized = true
      ORDER BY equipment_id, test_code, performed_at DESC, id DESC
    `;
    const { rows: jointLast } = await sql`
      SELECT DISTINCT ON (equipment_id, test_code)
        equipment_id, test_code, performed_at, status, action_level, is_finalized
      FROM qc_petct_joint_tests
      WHERE is_finalized = true
      ORDER BY equipment_id, test_code, performed_at DESC, id DESC
    `;
    const { rows: petCount } = await sql`SELECT COUNT(*)::int AS n FROM qc_petct_pet_tests`;
    const { rows: ctCount } = await sql`SELECT COUNT(*)::int AS n FROM qc_petct_ct_tests`;
    const { rows: jointCount } = await sql`SELECT COUNT(*)::int AS n FROM qc_petct_joint_tests`;
    const { rows: lastRow } = await sql`
      SELECT GREATEST(
        (SELECT MAX(performed_at) FROM qc_petct_pet_tests),
        (SELECT MAX(performed_at) FROM qc_petct_ct_tests),
        (SELECT MAX(performed_at) FROM qc_petct_joint_tests)
      )::date::text AS d
    `;

    const allLast = [...petLast, ...ctLast, ...jointLast];
    let outOfControl = 0, warning = 0;
    for (const t of allLast) {
      if (t.status === "no_cumple") outOfControl++;
      else if (t.action_level === "advertencia") warning++;
    }
    const total =
      ((petCount[0]?.n as number) ?? 0) +
      ((ctCount[0]?.n as number) ?? 0) +
      ((jointCount[0]?.n as number) ?? 0);
    return {
      totalTests: total,
      lastTestDate: (lastRow[0]?.d as string) ?? null,
      outOfControl,
      warning,
      // Overdue computation for PET/CT uses the architecture catalog — see /compliance page
      overdueTests: 0,
      upcomingTests: 0,
    };
  } catch {
    return { totalTests: 0, lastTestDate: null, outOfControl: 0, warning: 0, overdueTests: 0, upcomingTests: 0 };
  }
}

function formatDate(d: string | null) {
  if (!d) return "Sin registros";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface ModuleCard {
  label: string;
  description: string;
  href: string;
  stats: ModuleStats;
  navLinks: { href: string; label: string }[];
  color: string;
}

function StatusPill({ count, variant }: { count: number; variant: "red" | "amber" | "green" | "muted" }) {
  const styles = {
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    green: "bg-green-500/15 text-green-600 dark:text-green-400",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${styles[variant]}`}>
      {count}
    </span>
  );
}

function ModuleCard({ mod }: { mod: ModuleCard }) {
  const { stats } = mod;
  const hasIssues = stats.outOfControl > 0 || stats.overdueTests > 0;
  const hasWarnings = stats.warning > 0 || stats.upcomingTests > 0;

  return (
    <div className={`rounded-xl border bg-surface overflow-hidden ${hasIssues ? "border-red-400/50" : hasWarnings ? "border-amber-400/40" : "border-border"}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b border-border ${mod.color}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{mod.label}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{mod.description}</p>
          </div>
          <Link
            href={mod.href}
            className="shrink-0 rounded-md border border-border bg-surface/80 px-2.5 py-1 text-[11px] font-medium hover:bg-muted/40 transition-colors"
          >
            Abrir →
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {[
          { label: "Registros", value: String(stats.totalTests), pill: null },
          {
            label: "Último test",
            value: formatDate(stats.lastTestDate),
            pill: null,
          },
          {
            label: "Vencidos",
            value: String(stats.overdueTests),
            pill: stats.overdueTests > 0 ? ("red" as const) : ("muted" as const),
          },
          {
            label: "Fuera control",
            value: String(stats.outOfControl),
            pill: stats.outOfControl > 0 ? ("red" as const) : ("muted" as const),
          },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-sm font-semibold tabular-nums">{item.value}</p>
              {item.pill && <StatusPill count={Number(item.value)} variant={item.pill} />}
            </div>
          </div>
        ))}
      </div>

      {/* Warnings row */}
      {(stats.warning > 0 || stats.upcomingTests > 0) && (
        <div className="flex gap-3 px-4 py-2 bg-amber-500/5 border-t border-amber-400/20 text-[11px] text-amber-700 dark:text-amber-400">
          {stats.warning > 0 && (
            <span>⚠ {stats.warning} prueba{stats.warning !== 1 ? "s" : ""} en advertencia</span>
          )}
          {stats.upcomingTests > 0 && (
            <span>⏰ {stats.upcomingTests} próxima{stats.upcomingTests !== 1 ? "s" : ""} a vencer</span>
          )}
        </div>
      )}

      {/* Nav links */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-t border-border">
        {mod.navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function QualityControlHubPage() {
  await Promise.all([
    ensureActivimetroQcTables(),
    ensureGammacamaraQcTables(),
    ensureSpectQcTables(),
    ensurePetCtQcTables(),
  ]);

  const [activimetroStats, gammacamaraStats, spectStats, petctStats] = await Promise.all([
    getActivimetroStats(),
    getGammacamaraStats(),
    getSpectStats(),
    getPetctStats(),
  ]);

  const modules: ModuleCard[] = [
    {
      label: "Activímetro",
      description: "Módulo 1 — IAEA TECDOC-602. Precisión, exactitud, linealidad, respuesta de fondo, geometría.",
      href: "/quality-control/activimetro",
      stats: activimetroStats,
      color: "bg-blue-500/5",
      navLinks: [
        { href: "/quality-control/activimetro/dashboard", label: "Tablero" },
        { href: "/quality-control/activimetro/alerts", label: "Alertas" },
        { href: "/quality-control/activimetro/compliance", label: "Cumplimiento" },
        { href: "/quality-control/activimetro/trend", label: "Tendencia" },
        { href: "/quality-control/activimetro/report", label: "Informe PDF" },
      ],
    },
    {
      label: "Gammacámara",
      description: "Módulo 2 — IAEA TECDOC-602. Uniformidad, resolución espacial, sensibilidad.",
      href: "/quality-control/gammacamara",
      stats: gammacamaraStats,
      color: "bg-violet-500/5",
      navLinks: [
        { href: "/quality-control/gammacamara/alerts", label: "Alertas" },
        { href: "/quality-control/gammacamara/compliance", label: "Cumplimiento" },
        { href: "/quality-control/gammacamara/trend", label: "Tendencia" },
        { href: "/quality-control/gammacamara/baseline", label: "Baseline" },
        { href: "/quality-control/gammacamara/report", label: "Informe PDF" },
      ],
    },
    {
      label: "SPECT",
      description: "Módulo 3 — IAEA TECDOC-602. Uniformidad 3D, resolución, sensibilidad. Requiere gammacámara con tomografía.",
      href: "/quality-control/spect",
      stats: spectStats,
      color: "bg-emerald-500/5",
      navLinks: [
        { href: "/quality-control/spect/alerts", label: "Alertas" },
        { href: "/quality-control/spect/compliance", label: "Cumplimiento" },
        { href: "/quality-control/spect/trend", label: "Tendencia" },
        { href: "/quality-control/spect/baseline", label: "Baseline" },
        { href: "/quality-control/spect/report", label: "Informe PDF" },
      ],
    },
    {
      label: "PET/CT",
      description: "Módulo 4 — IAEA TECDOC-1750. PET (resolución, sensibilidad, SUV), CT (dosis, calidad imagen) y pruebas conjuntas.",
      href: "/quality-control/petct",
      stats: petctStats,
      color: "bg-orange-500/5",
      navLinks: [
        { href: "/quality-control/petct/alerts", label: "Alertas" },
        { href: "/quality-control/petct/compliance", label: "Cumplimiento" },
        { href: "/quality-control/petct/trend", label: "Tendencia" },
        { href: "/quality-control/petct/comparison", label: "Comparación" },
        { href: "/quality-control/petct/report", label: "Informe PDF" },
      ],
    },
  ];

  const totalOverdue = modules.reduce((s, m) => s + m.stats.overdueTests, 0);
  const totalOutOfControl = modules.reduce((s, m) => s + m.stats.outOfControl, 0);
  const totalWarning = modules.reduce((s, m) => s + m.stats.warning, 0);
  const totalTests = modules.reduce((s, m) => s + m.stats.totalTests, 0);

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Control de Calidad — Medicina Nuclear</h1>
          <p className="text-xs text-muted-foreground">
            DS 133/1984 MINSAL · IAEA TECDOC-602 / TECDOC-1750. Programa de control de calidad para equipos de
            medicina nuclear.
          </p>
        </div>
      </div>

      {/* Global summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total registros", value: String(totalTests), color: "text-foreground" },
          {
            label: "Vencidos (total)",
            value: String(totalOverdue),
            color: totalOverdue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
          },
          {
            label: "Fuera de control",
            value: String(totalOutOfControl),
            color: totalOutOfControl > 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
          },
          {
            label: "En advertencia",
            value: String(totalWarning),
            color: totalWarning > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <ModuleCard key={mod.href} mod={mod} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground text-center">
        Los valores mostrados reflejan el estado actual de la base de datos. Actualice la página para ver cambios
        recientes.
      </p>
    </div>
  );
}
