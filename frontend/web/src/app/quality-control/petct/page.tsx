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
      <div className="flex justify-end">
        <Link
          href="/quality-control/petct/equipment"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Ficha tecnica del equipo
        </Link>
      </div>
      <PetCtQcApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />
    </div>
  );
}
