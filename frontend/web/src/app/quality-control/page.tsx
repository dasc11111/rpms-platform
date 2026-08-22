import { sql } from "@/lib/db";
import { ensureQualityControlTables } from "@/lib/quality-control-db";
import { QualityControlApp } from "@/components/quality-control/quality-control-app";

export const dynamic = "force-dynamic";

export default async function QualityControlPage() {
  await ensureQualityControlTables();

  const { rows: testRows } = await sql`
    SELECT * FROM quality_control_tests ORDER BY test_date DESC, id DESC LIMIT 2000;
  `;

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return (
    <QualityControlApp
      initialTests={JSON.parse(JSON.stringify(testRows))}
      instruments={JSON.parse(JSON.stringify(instrumentRows))}
    />
  );
}
