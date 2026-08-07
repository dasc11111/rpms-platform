import { sql } from "@/lib/db";

let ensured = false;

export async function ensureRadioterapiaTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_facilities (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      responsible_qa TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'activo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_bunkers (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      design_reference TEXT,
      status TEXT NOT NULL DEFAULT 'activo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_shielding (
      id SERIAL PRIMARY KEY,
      bunker_id INTEGER REFERENCES rt_bunkers(id) ON DELETE CASCADE,
      element TEXT NOT NULL,
      material TEXT,
      thickness_cm NUMERIC,
      calculation_reference TEXT,
      verification_date DATE,
      status TEXT NOT NULL DEFAULT 'conforme',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_safety_devices (
      id SERIAL PRIMARY KEY,
      bunker_id INTEGER REFERENCES rt_bunkers(id) ON DELETE CASCADE,
      device_type TEXT NOT NULL,
      name TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'operativo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_safety_device_checks (
      id SERIAL PRIMARY KEY,
      device_id INTEGER REFERENCES rt_safety_devices(id) ON DELETE CASCADE,
      check_date DATE NOT NULL,
      result TEXT NOT NULL DEFAULT 'conforme',
      observations TEXT,
      responsible TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_radiation_surveys (
      id SERIAL PRIMARY KEY,
      bunker_id INTEGER REFERENCES rt_bunkers(id) ON DELETE CASCADE,
      survey_date DATE NOT NULL,
      location TEXT,
      measured_value NUMERIC,
      unit TEXT DEFAULT 'uSv/h',
      instrument_ref TEXT,
      responsible TEXT,
      observations TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_incidents (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
      is_near_miss BOOLEAN NOT NULL DEFAULT false,
      event TEXT NOT NULL,
      incident_date DATE NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'menor',
      cause TEXT,
      corrective_actions TEXT,
      status TEXT NOT NULL DEFAULT 'abierto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_audits (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      audit_type TEXT NOT NULL,
      audit_date DATE NOT NULL,
      findings TEXT,
      nonconformities TEXT,
      actions TEXT,
      status TEXT NOT NULL DEFAULT 'abierta',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_trainings (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      worker_rut TEXT,
      worker_name TEXT NOT NULL,
      training_name TEXT NOT NULL,
      training_date DATE,
      expiry_date DATE,
      institution TEXT,
      status TEXT NOT NULL DEFAULT 'vigente',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_competencies (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      worker_rut TEXT,
      worker_name TEXT NOT NULL,
      competency TEXT NOT NULL,
      evaluation_date DATE,
      result TEXT NOT NULL DEFAULT 'competente',
      evaluator TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rt_kpi_snapshots (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      period_label TEXT NOT NULL,
      kpi_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export const RT_DEVICE_TYPES = [
  { value: "interlock", label: "Interlock" },
  { value: "alarma", label: "Alarma" },
  { value: "puerta", label: "Puerta blindada" },
  { value: "monitor_area", label: "Monitor de area" },
];

export const RT_AUDIT_TYPES = [
  { value: "interna", label: "Interna" },
  { value: "externa", label: "Externa" },
  { value: "seremi", label: "SEREMI" },
  { value: "cchen", label: "CCHEN" },
  { value: "iaea", label: "IAEA" },
];

export const RT_INCIDENT_SEVERITIES = [
  { value: "menor", label: "Menor" },
  { value: "moderado", label: "Moderado" },
  { value: "grave", label: "Grave" },
];

export async function logRadioterapiaAudit(action: string, actorEmail: string | null, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'radioterapia', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logRadioterapiaAudit failed", err);
  }
}
