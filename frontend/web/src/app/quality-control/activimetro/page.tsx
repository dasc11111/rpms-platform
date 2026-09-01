import Link from "next/link";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import { ActivimetroQcApp } from "@/components/quality-control/activimetro-qc-app";

export const dynamic = "force-dynamic";

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
      <div className="flex justify-end gap-2 flex-wrap px-6 pt-4">
        <Link
          href="/quality-control/activimetro/dashboard"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Tablero de control
        </Link>
        <Link
          href="/quality-control/activimetro/equipment"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Ficha tecnica del equipo
        </Link>
        <Link
          href="/quality-control/activimetro/inspection"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ACTIV-01 - Inspeccion fisica y funcional
        </Link>
        <Link
          href="/quality-control/activimetro/radionuclide-accuracy"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ACTIV-05 - Exactitud por radionuclido
        </Link>
        <Link
          href="/quality-control/activimetro/constancy"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ACTIV-06 - Constancia
        </Link>
        <Link
          href="/quality-control/activimetro/purity"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ACTIV-07 - Pureza radionucleidica de 99mTc
        </Link>
        <Link
          href="/quality-control/activimetro/baseline"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Baseline del equipo
        </Link>
        <Link
          href="/quality-control/activimetro/service-events"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Eventos de servicio tecnico
        </Link>
        <Link
          href="/quality-control/activimetro/evidence"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Evidencia grafica y documental
        </Link>
        <Link
          href="/quality-control/activimetro/audit"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Bitacora de auditoria
        </Link>
        <Link
          href="/quality-control/activimetro/report"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Informe PDF
        </Link>
      </div>
      <ActivimetroQcApp
        initialTests={JSON.parse(JSON.stringify(testRows))}
        instruments={JSON.parse(JSON.stringify(instrumentRows))}
        tolerances={JSON.parse(JSON.stringify(toleranceRows))}
      />
    </div>
  );
}
