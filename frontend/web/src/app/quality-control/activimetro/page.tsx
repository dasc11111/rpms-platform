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
    <ActivimetroQcApp
      initialTests={JSON.parse(JSON.stringify(testRows))}
      instruments={JSON.parse(JSON.stringify(instrumentRows))}
      tolerances={JSON.parse(JSON.stringify(toleranceRows))}
    />
  );
}
