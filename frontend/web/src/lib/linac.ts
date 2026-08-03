import { sql } from "@/lib/db";

let ensured = false;

export async function ensureLinacTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_units (
      id SERIAL PRIMARY KEY,
      brand TEXT,
      model TEXT,
      manufacturer TEXT,
      manufacture_year INTEGER,
      install_year INTEGER,
      serial_number TEXT,
      inventory_number TEXT,
      photon_energies TEXT,
      electron_energies TEXT,
      mlc_type TEXT,
      epid BOOLEAN NOT NULL DEFAULT false,
      cbct BOOLEAN NOT NULL DEFAULT false,
      record_verify_system TEXT,
      tps_associated TEXT,
      room TEXT,
      operational_status TEXT NOT NULL DEFAULT 'activo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_authorizations (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      document_number TEXT,
      issue_date DATE,
      expiry_date DATE,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_qc_tests (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      periodicity TEXT NOT NULL,
      test_name TEXT NOT NULL,
      test_date DATE NOT NULL,
      expected_value TEXT,
      obtained_value TEXT,
      tolerance TEXT,
      unit TEXT,
      status TEXT NOT NULL DEFAULT 'cumple',
      observations TEXT,
      responsible TEXT,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_clinical_operations (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      op_date DATE NOT NULL,
      patients_treated INTEGER DEFAULT 0,
      operating_hours NUMERIC DEFAULT 0,
      downtime_hours NUMERIC DEFAULT 0,
      interruptions INTEGER DEFAULT 0,
      treatment_type TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_radiation_protection (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      measurement_date DATE NOT NULL,
      measurement_time TEXT,
      measurement_type TEXT,
      location TEXT,
      value NUMERIC,
      unit TEXT,
      instrument_ref TEXT,
      responsible TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_maintenance (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      maintenance_type TEXT NOT NULL,
      maintenance_date DATE NOT NULL,
      company TEXT,
      hours NUMERIC,
      cost NUMERIC,
      observations TEXT,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_incidents (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      incident_date DATE NOT NULL,
      incident_time TEXT,
      description TEXT,
      cause TEXT,
      consequence TEXT,
      dose NUMERIC,
      ines_level TEXT,
      investigation TEXT,
      corrective_actions TEXT,
      status TEXT NOT NULL DEFAULT 'abierto',
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_risks (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      risk TEXT NOT NULL,
      frequency INTEGER,
      consequence INTEGER,
      risk_level INTEGER,
      responsible TEXT,
      mitigation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_emergencies (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      emergency_type TEXT,
      event_date DATE NOT NULL,
      description TEXT,
      checklist JSONB,
      roles JSONB,
      responsible TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_audits (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      audit_type TEXT,
      audit_date DATE NOT NULL,
      findings TEXT,
      nonconformities TEXT,
      actions TEXT,
      follow_up TEXT,
      status TEXT NOT NULL DEFAULT 'abierta',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_documents (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
      category TEXT,
      title TEXT,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export const LINAC_AUTH_TYPES = [
  { value: "seremi", label: "Autorizacion SEREMI" },
  { value: "cchen", label: "Autorizacion CCHEN" },
  { value: "resolucion", label: "Resolucion" },
  { value: "informe_seguridad", label: "Informe de Seguridad" },
  { value: "licencia", label: "Licencia" },
];

export const LINAC_TREATMENT_TYPES = ["IMRT", "VMAT", "3DCRT", "SRS", "SBRT", "TBI"];

export const LINAC_QC_PERIODICITIES = [
  { value: "diario", label: "QC Diario" },
  { value: "semanal", label: "QC Semanal" },
  { value: "mensual", label: "QC Mensual" },
  { value: "trimestral", label: "QC Trimestral" },
  { value: "semestral", label: "QC Semestral" },
  { value: "anual", label: "QC Anual" },
];

export const LINAC_MAINTENANCE_TYPES = [
  { value: "preventivo", label: "Preventivo" },
  { value: "correctivo", label: "Correctivo" },
  { value: "predictivo", label: "Predictivo" },
];

export const LINAC_RADIATION_MEASUREMENT_TYPES = [
  { value: "fuga", label: "Radiacion de fuga" },
  { value: "blindaje", label: "Blindaje" },
  { value: "monitor_area", label: "Monitor de area" },
  { value: "interlock", label: "Interlock" },
  { value: "puerta", label: "Puerta" },
  { value: "boton_emergencia", label: "Boton de emergencia" },
];

export const LINAC_AUDIT_TYPES = [
  { value: "interna", label: "Interna" },
  { value: "externa", label: "Externa" },
  { value: "seremi", label: "SEREMI" },
  { value: "cchen", label: "CCHEN" },
  { value: "iaea", label: "IAEA" },
];

export function daysUntil(dateValue: any) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function computeVigencyLevel(expiryDate: any) {
  const days = daysUntil(expiryDate);
  if (days === null) return "sin_vigencia";
  if (days <= 30) return "rojo";
  if (days <= 90) return "naranjo";
  if (days <= 180) return "amarillo";
  return "verde";
}

export async function logLinacAudit(action: string, actorEmail: string, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'linac', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logLinacAudit failed", err);
  }
}
