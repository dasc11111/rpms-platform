import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import { SpectComplianceApp } from "@/components/quality-control/spect-compliance-app";

export const dynamic = "force-dynamic";

/**
 * MODULO 3 - SPECT - FASE D
 * Panel de cumplimiento de frecuencias de QC para SPECT.
 */

const NAV_LINKS = [
  { href: "/quality-control/spect", label: "← QC principal" },
  { href: "/quality-control/spect/alerts", label: "Alertas" },
  { href: "/quality-control/spect/trend", label: "Tendencia" },
];

export default async function SpectCompliancePage() {
  await ensureSpectQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Cumplimiento QC — SPECT</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL · IAEA TECDOC-602. Vencimientos y catálogo de pruebas SPECT por instrumento.
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

      <SpectComplianceApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
