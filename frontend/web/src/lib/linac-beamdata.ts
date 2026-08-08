import { sql } from "@/lib/db";

let ensured = false;

export async function ensureBeamDataTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_beam_data (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      modality TEXT,
      energy TEXT,
      measurement_type TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      supersedes_id INTEGER,
      measurement_date DATE NOT NULL,
      measured_by TEXT,
      instrument_used TEXT,
      data JSONB NOT NULL DEFAULT '{}',
      uncertainty_type TEXT,
      uncertainty_value TEXT,
      uncertainty_unit TEXT,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export const BEAM_DATA_MEASUREMENT_TYPES = [
  { value: "factor_salida", label: "Factor de salida" },
  { value: "pdd", label: "PDD (Porcentaje de dosis en profundidad)" },
  { value: "tpr", label: "TPR" },
  { value: "perfil", label: "Perfil de haz" },
  { value: "simetria", label: "Simetria" },
  { value: "planicidad", label: "Planicidad" },
  { value: "factor_cuna", label: "Factor de cuna" },
  { value: "factor_bandeja", label: "Factor de bandeja" },
  { value: "factor_campo_pequeno", label: "Factor de campo pequeno" },
  { value: "curva", label: "Curva" },
  { value: "matriz", label: "Matriz de datos" },
  { value: "otro", label: "Otro" },
];

export async function importBeamDataEntry(input: any) {
  await ensureBeamDataTables();
  let version = 1;
  if (input.supersedesId) {
    const { rows: prevRows } = await sql`SELECT version FROM linac_beam_data WHERE id = ${input.supersedesId}`;
    version = (Number(prevRows[0]?.version) || 0) + 1;
    await sql`UPDATE linac_beam_data SET is_current = false WHERE id = ${input.supersedesId}`;
  } else {
    const { rows: existingRows } = await sql`
      SELECT id, version FROM linac_beam_data
      WHERE linac_id = ${input.linacId} AND measurement_type = ${input.measurementType}
        AND COALESCE(modality, '') = COALESCE(${input.modality || null}, '')
        AND COALESCE(energy, '') = COALESCE(${input.energy || null}, '')
        AND is_current = true
      LIMIT 1;
    `;
    if (existingRows[0]) {
      version = (Number(existingRows[0].version) || 0) + 1;
      await sql`UPDATE linac_beam_data SET is_current = false WHERE id = ${existingRows[0].id}`;
    }
  }

  const { rows } = await sql`
    INSERT INTO linac_beam_data (
      linac_id, modality, energy, measurement_type, version, is_current, supersedes_id,
      measurement_date, measured_by, instrument_used, data, uncertainty_type, uncertainty_value, uncertainty_unit,
      file_name, blob_url, mime_type, notes, created_by
    ) VALUES (
      ${input.linacId}, ${input.modality || null}, ${input.energy || null}, ${input.measurementType},
      ${version}, true, ${input.supersedesId || null}, ${input.measurementDate}, ${input.measuredBy || null},
      ${input.instrumentUsed || null}, ${JSON.stringify(input.data || {})}::jsonb,
      ${input.uncertaintyType || null}, ${input.uncertaintyValue || null}, ${input.uncertaintyUnit || null},
      ${input.fileName || null}, ${input.blobUrl || null}, ${input.mimeType || null}, ${input.notes || null}, ${input.createdBy || null}
    )
    RETURNING id;
  `;
  return { id: rows[0]!.id, version };
}

export async function logBeamDataAudit(action: string, actorEmail: string | null, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'linac_beamdata', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logBeamDataAudit failed", err);
  }
}
