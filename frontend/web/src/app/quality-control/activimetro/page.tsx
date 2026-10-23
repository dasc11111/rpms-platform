import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import { ActivimetroQcApp } from "@/components/quality-control/activimetro-qc-app";

export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "/quality-control/activimetro/dashboard", label: "Tablero" },
  { href: "/quality-control/activimetro/equipment", label: "Ficha técnica" },
  { href: "/quality-control/activimetro/inspection", label: "ACTIV-01 Inspección" },
  { href: "/quality-control/activimetro/radionuclide-accuracy", label: "ACTIV-05 Exactitud" },
  { href: "/quality-control/activimetro/constancy", label: "ACTIV-06 Constancia" },
  { href: "/quality-control/activimetro/purity", label: "ACTIV-07 Pureza" },
  { href: "/quality-control/activimetro/baseline", label: "Baseline" },
  { href: "/quality-control/activimetro/service-events", label: "Eventos servicio" },
  { href: "/quality-control/activimetro/evidence", label: "Evidencia" },
  { href: "/quality-control/activimetro/audit", label: "Bitácora auditoría" },
  { href: "/quality-control/activimetro/report", label: "Informe PDF" },
];

export default async function ActivimetroQcPage() {
  await ensureActivimetroQcTables();

  const { rows: testRows } = await sql`
    SELECT * FROM qc_activimetro_tests ORDER BY test_date DESC, id DESC LIMIT 500;
  `;

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  const { rows: toleranceRows } = await sql`
    SELECT * FROM qc_activimetro_tolerances WHERE active = true ORDER BY test_type ASC;
  `;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 px-6 pt-4">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <ActivimetroQcApp
        initialTests={JSON.parse(JSON.stringify(testRows))}
        instruments={JSON.parse(JSON.stringify(instrumentRows))}
        tolerances={JSON.parse(JSON.stringify(toleranceRows))}
      />
    </div>
  );
}
