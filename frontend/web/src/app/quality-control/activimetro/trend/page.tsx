import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import { ActivimetroTrendApp } from "@/components/quality-control/activimetro-trend-app";

export const dynamic = "force-dynamic";

/**
 * MODULO 1 - ACTIVIMETRO - FASE D
 * Gráfico de control (Levey-Jennings) para el Activímetro.
 */

const NAV_LINKS = [
  { href: "/quality-control/activimetro", label: "← QC principal" },
  { href: "/quality-control/activimetro/alerts", label: "Alertas" },
  { href: "/quality-control/activimetro/compliance", label: "Cumplimiento" },
];

export default async function ActivimetroTrendPage() {
  await ensureActivimetroQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Tendencia / Control — Activímetro</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL · IAEA TECDOC-602. Gráfico de control de Levey-Jennings por instrumento y prueba del Activímetro.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <ActivimetroTrendApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
