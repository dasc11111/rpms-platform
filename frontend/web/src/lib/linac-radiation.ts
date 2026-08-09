import { sql } from "@/lib/db";

let ensured = false;

export async function ensureRadiationExtendedTables() {
  if (ensured) return;

  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS category TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS worker_rut TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS instrument_id INTEGER`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS dose_value NUMERIC`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS dose_unit TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS limit_value NUMERIC`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS reference_level NUMERIC`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS semaphore TEXT NOT NULL DEFAULT 'verde'`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'conforme'`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS frequency TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS next_due_date DATE`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS file_name TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS blob_url TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS mime_type TEXT`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS size_bytes INTEGER`;
  await sql`ALTER TABLE linac_radiation_protection ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_radiation_alerts (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      record_id INTEGER,
      category TEXT,
      semaphore TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'abierta',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT
    );
  `;

  ensured = true;
}

export const RADIATION_CATEGORIES: { value: string; label: string }[] = [
  { value: "blindaje", label: "Blindajes" },
  { value: "levantamiento", label: "Levantamiento Radiometrico" },
  { value: "monitoreo_ambiental", label: "Monitoreo Ambiental" },
  { value: "monitor_area", label: "Monitores de Area" },
  { value: "dosimetria_ocupacional", label: "Dosimetria Ocupacional" },
  { value: "instrumentacion", label: "Instrumentacion" },
  { value: "calibracion", label: "Calibraciones" },
  { value: "interlock", label: "Interlocks" },
  { value: "sistema_seguridad", label: "Sistemas de Seguridad" },
];

export const RADIATION_FREQUENCIES: { value: string; label: string }[] = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "unica", label: "Unica / Puntual" },
];

export function computeRadiationSemaphore(status: any, value: any, limitValue: any, referenceLevel: any): string {
  if (status === "no_conforme") return "rojo";
  const v = value === null || value === undefined || value === "" ? null : Number(value);
  const limit = limitValue === null || limitValue === undefined || limitValue === "" ? null : Number(limitValue);
  const ref = referenceLevel === null || referenceLevel === undefined || referenceLevel === "" ? null : Number(referenceLevel);
  if (v === null || Number.isNaN(v) || (limit === null && ref === null)) return "verde";
  if (limit !== null && !Number.isNaN(limit) && v > limit) return "rojo";
  if (ref !== null && !Number.isNaN(ref) && v > ref) return "amarillo";
  return "verde";
}

export function daysUntilDue(dateValue: any): number | null {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export async function generateRadiationAlert(linacId: any, recordId: any, category: any, semaphore: any, message: any) {
  try {
    await sql`
      INSERT INTO linac_radiation_alerts (linac_id, record_id, category, semaphore, message)
      VALUES (${linacId}, ${recordId}, ${category}, ${semaphore}, ${message})
    `;
  } catch (err) {
    console.error("generateRadiationAlert failed", err);
  }
}

export async function checkDueDateAlert(linacId: any, recordId: any, category: any, categoryLabel: any, testName: any, nextDueDate: any) {
  const days = daysUntilDue(nextDueDate);
  if (days === null) return;
  if (days <= 30) {
    const message = categoryLabel + ': "' + testName + '" ' + (days < 0 ? "vencida hace " + Math.abs(days) + " dias." : "vence en " + days + " dias.");
    await generateRadiationAlert(linacId, recordId, category, days < 0 ? "rojo" : "amarillo", message);
  }
}

export async function logRadiationAudit(action: string, actorEmail: string | null, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'linac_radiation', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logRadiationAudit failed", err);
  }
}
