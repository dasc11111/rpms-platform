import { sql } from "@/lib/db";
import { ensurePetCtQcTables } from "@/lib/qc-petct-db";
import { PetCtQcApp } from "@/components/quality-control/petct-qc-app";

export const dynamic = "force-dynamic";

export default async function PetCtQcPage() {
  await ensurePetCtQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return <PetCtQcApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />;
}
