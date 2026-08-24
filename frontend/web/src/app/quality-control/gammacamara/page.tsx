import { sql } from "@/lib/db";
import { ensureGammacamaraQcTables } from "@/lib/qc-gammacamara-db";
import { GammacamaraQcApp } from "@/components/quality-control/gammacamara-qc-app";

export const dynamic = "force-dynamic";

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
    <GammacamaraQcApp
      initialTests={JSON.parse(JSON.stringify(testRows))}
      instruments={JSON.parse(JSON.stringify(instrumentRows))}
      tolerances={JSON.parse(JSON.stringify(toleranceRows))}
    />
  );
}
