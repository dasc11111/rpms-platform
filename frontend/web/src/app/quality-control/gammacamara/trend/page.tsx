import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";
import { GammacamaraTrendApp } from "@/components/quality-control/gammacamara-trend-app";

export const dynamic = "force-dynamic";

/**
 * MODULO 2 - GAMMACAMARA - FASE D
 * Gráfico de control (Levey-Jennings) para Gammacámara.
 */

const NAV_LINKS = [
  { href: "/quality-control/gammacamara", label: "← QC principal" },
  { href: "/quality-control/gammacamara/alerts", label: "Alertas" },
  { href: "/quality-control/gammacamara/compliance", label: "Cumplimiento" },
];

export default async function GammacamaraTrendPage() {
  await ensureGammacamaraQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Tendencia / Control — Gammacámara</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL · IAEA TECDOC-602. Gráfico de control de Levey-Jennings por instrumento y prueba.
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

      <GammacamaraTrendApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
