import { sql } from "@/lib/db";

let ensured = false;

export async function ensureBaselineTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_baselines (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      measurement_type TEXT NOT NULL,
      modality TEXT,
      energy TEXT,
      dataset_id INTEGER REFERENCES linac_commissioning_datasets(id),
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      approved_by TEXT,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export async function promoteDatasetToBaseline(
  linacId: number,
  category: string,
  measurementType: string,
  modality: string | null,
  energy: string | null,
  datasetId: number,
  approvedBy: string | null,
  notes: string | null
) {
  await ensureBaselineTables();

  const { rows: prevRows } = await sql`
    SELECT id, version FROM linac_baselines
    WHERE linac_id = ${linacId} AND category = ${category} AND measurement_type = ${measurementType}
      AND (modality IS NOT DISTINCT FROM ${modality}) AND (energy IS NOT DISTINCT FROM ${energy})
      AND is_current = true
  `;

  let version = 1;
  if (prevRows[0]) {
    version = (Number(prevRows[0].version) || 0) + 1;
    await sql`UPDATE linac_baselines SET is_current = false WHERE id = ${prevRows[0].id}`;
  }

  const { rows } = await sql`
    INSERT INTO linac_baselines (
      linac_id, category, measurement_type, modality, energy, dataset_id, version, is_current,
      approved_by, notes
    ) VALUES (
      ${linacId}, ${category}, ${measurementType}, ${modality}, ${energy}, ${datasetId}, ${version}, true,
      ${approvedBy}, ${notes}
    )
    RETURNING id;
  `;

  return { id: rows[0]!.id, version };
}

export async function logBaselineAudit(action: string, actorEmail: string | null, details: any) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        actor_email TEXT,
        action TEXT NOT NULL,
        category TEXT,
        details JSONB,
        ip_address TEXT,
        success BOOLEAN NOT NULL DEFAULT true
      );
    `;
    await sql`
      INSERT INTO audit_logs (actor_email, action, category, details)
      VALUES (${actorEmail}, ${action}, 'linac_baseline', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logBaselineAudit failed", err);
  }
}
