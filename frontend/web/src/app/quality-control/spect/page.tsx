import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import { SpectQcApp } from "@/components/quality-control/spect-qc-app";

export const dynamic = "force-dynamic";

/**
 * MODULO 2 - SPECT
 * Página principal del módulo de control de calidad SPECT.
 * Incluye navegación a submódulos FASE A (ficha técnica, eventos servicio)
 * y carga inicial de instrumentos para el registro de pruebas de QC.
 */

const NAV_LINKS = [
  { href: "/quality-control/spect/equipment", label: "Ficha técnica" },
  { href: "/quality-control/spect/service-events", label: "Eventos servicio" },
  { href: "/quality-control/spect/baseline", label: "Baseline" },
  { href: "/quality-control/spect/evidence", label: "Evidencia" },
  { href: "/quality-control/spect/report", label: "Informe PDF" },
  { href: "/quality-control/spect/alerts", label: "Alertas" },
  { href: "/quality-control/spect/compliance", label: "Cumplimiento" },
  { href: "/quality-control/spect/trend", label: "Tendencia" },
];

export default async function SpectQcPage() {
  await ensureSpectQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Control de Calidad — SPECT</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL · IAEA TECDOC-602. Tomografía computarizada de emisión de fotón único.
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-wrap gap-2">
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* QC App */}
      <SpectQcApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
