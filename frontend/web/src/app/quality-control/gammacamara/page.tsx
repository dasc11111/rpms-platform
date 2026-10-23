import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";
import { GammacamaraQcApp } from "@/components/quality-control/gammacamara-qc-app";

export const dynamic = "force-dynamic";

/**
 * MODULO 2 - GAMMACAMARA
 * Página principal del módulo de control de calidad de la gammacámara.
 * Incluye navegación a submódulos FASE A (ficha técnica, eventos servicio)
 * y carga inicial de datos para el registro de pruebas de QC.
 */

const NAV_LINKS = [
  { href: "/quality-control/gammacamara/equipment", label: "Ficha técnica" },
  { href: "/quality-control/gammacamara/service-events", label: "Eventos servicio" },
  { href: "/quality-control/gammacamara/baseline", label: "Baseline" },
  { href: "/quality-control/gammacamara/evidence", label: "Evidencia" },
  { href: "/quality-control/gammacamara/report", label: "Informe PDF" },
];

export default async function GammacamaraQcPage() {
  await ensureGammacamaraQcTables();

  const { rows: testRows } = await sql`
    SELECT * FROM qc_gammacamara_tests ORDER BY test_date DESC, id DESC LIMIT 500;
  `;

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  const { rows: toleranceRows } = await sql`
    SELECT * FROM qc_gammacamara_tolerances WHERE active = true ORDER BY test_type ASC, test_mode ASC;
  `;

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Control de Calidad — Gammacámara</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL · IAEA TECDOC-602. Cámara de centelleo / SPECT.
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
      <GammacamaraQcApp
        initialTests={JSON.parse(JSON.stringify(testRows))}
        instruments={JSON.parse(JSON.stringify(instrumentRows))}
        tolerances={JSON.parse(JSON.stringify(toleranceRows))}
      />
    </div>
  );
}
