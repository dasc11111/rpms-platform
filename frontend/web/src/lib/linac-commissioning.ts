import { sql } from "@/lib/db";

let ensured = false;

export async function ensureCommissioningTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_commissioning_datasets (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      modality TEXT,
      energy TEXT,
      measurement_type TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      supersedes_id INTEGER,
      is_baseline BOOLEAN NOT NULL DEFAULT false,
      measurement_date DATE NOT NULL,
      measured_by TEXT,
      instrument_used TEXT,
      data JSONB NOT NULL DEFAULT '{}',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'borrador',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_commissioning_documents (
      id SERIAL PRIMARY KEY,
      dataset_id INTEGER REFERENCES linac_commissioning_datasets(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'informe',
      title TEXT,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export const COMMISSIONING_CATEGORIES = [
  { value: "fotones", label: "Fotones" },
  { value: "electrones", label: "Electrones" },
  { value: "mlc", label: "MLC" },
  { value: "colimadores", label: "Colimadores" },
  { value: "epid", label: "EPID" },
  { value: "cbct", label: "CBCT" },
  { value: "mesa", label: "Mesa de tratamiento" },
  { value: "imagenes", label: "Sistemas de imagenes" },
];

export const COMMISSIONING_MEASUREMENT_TYPES = [
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

export async function logCommissioningAudit(action: string, actorEmail: string | null, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'linac_commissioning', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logCommissioningAudit failed", err);
  }
}
