import { sql } from "@/lib/db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import { SpectQcApp } from "@/components/quality-control/spect-qc-app";

export const dynamic = "force-dynamic";

export default async function SpectQcPage() {
  await ensureSpectQcTables();

  const { rows: instrumentRows } = await sql`
    SELECT id, code, name FROM instruments ORDER BY name ASC;
  `;

  return <SpectQcApp instruments={JSON.parse(JSON.stringify(instrumentRows))} />;
}
