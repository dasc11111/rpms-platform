import Link from "next/link";
import { sql } from "@/lib/db";
import { ensurePetCtQcTables } from "@/lib/qc-petct-db";
import { PetCtQcApp } from "@/components/quality-control/petct-qc-app";

export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "/quality-control/petct/equipment", label: "Ficha técnica" },
  { href: "/quality-control/petct/baseline", label: "Baseline" },
  { href: "/quality-control/petct/service-events", label: "Eventos servicio" },
  { href: "/quality-control/petct/evidence", label: "Evidencia gráfica" },
  { href: "/quality-control/petct/pet-tests", label: "Pruebas PET" },
  { href: "/quality-control/petct/ct-tests", label: "Pruebas CT" },
  { href: "/quality-control/petct/joint-tests", label: "Interacción PET/CT" },
  { href: "/quality-control/petct/comparison", label: "Comparación" },
  { href: "/quality-control/petct/compliance", label: "Cumplimiento" },
  { href: "/quality-control/petct/trend", label: "Tendencia" },
  { href: "/quality-control/petct/alerts", label: "Alertas" },
  { href: "/quality-control/petct/report", label: "Informe PDF" },
];

export default async function PetCtQcPage() {
  await ensurePetCtQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
      <PetCtQcApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
