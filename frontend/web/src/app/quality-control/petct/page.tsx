import Link from "next/link";
import { sql } from "@/lib/db";
import { ensurePetCtQcTables } from "@/lib/qc-petct-db";
import { PetCtQcApp } from "@/components/quality-control/petct-qc-app";

export const dynamic = "force-dynamic";

export default async function PetCtQcPage() {
  await ensurePetCtQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Link
          href="/quality-control/petct/equipment"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Ficha tecnica del equipo
        </Link>
        <Link
          href="/quality-control/petct/baseline"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Baseline del equipo
        </Link>
        <Link
          href="/quality-control/petct/service-events"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Eventos de servicio tecnico
        </Link>
        <Link
          href="/quality-control/petct/evidence"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Evidencia grafica
        </Link>
        <Link
          href="/quality-control/petct/pet-tests"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Pruebas PET (PET-01 a PET-06)
        </Link>
        <Link
          href="/quality-control/petct/ct-tests"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Pruebas CT (CT-01 a CT-14)
        </Link>
        <Link
          href="/quality-control/petct/joint-tests"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Interaccion PET/CT (PETCT-01, PETCT-02)
        </Link>
        <Link
          href="/quality-control/petct/compliance"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Cumplimiento y catalogo
        </Link>
      </div>
      <PetCtQcApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
