import { sql } from "@/lib/db";

export type NmReferenceRecordType = "criterio_radiologico" | "referencia_tecnica";
export type NmReferenceOrganization = "arpansa" | "iaea" | "icrp" | "normativa_chilena" | "otro";
export type NmReferenceVerificationStatus = "verificado" | "pendiente_verificacion";
export type NmReferenceStatus = "activo" | "archivado";

export interface NmReferenceRecord {
  id: number;
  record_type: NmReferenceRecordType;
  organization: NmReferenceOrganization;
  document_title: string;
  document_code: string | null;
  year: number | null;
  version: string | null;
  chapter: string | null;
  section_ref: string | null;
  table_ref: string | null;
  radionuclide: string | null;
  criterion_type: string | null;
  variable_name: string | null;
  value_text: string | null;
  unit: string | null;
  context: string | null;
  official_url: string | null;
  verification_date: string | null;
  verification_status: NmReferenceVerificationStatus;
  notes: string | null;
  status: NmReferenceStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NmReferenceHistoryRecord {
  id: number;
  reference_id: number;
  action: string;
  previous_value: string | null;
  new_value: string | null;
  notes: string | null;
  actor_email: string | null;
  created_at: string;
}

let ensured = false;

export async function ensureNmReferencesTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS nm_technical_references (
      id SERIAL PRIMARY KEY,
      record_type TEXT NOT NULL DEFAULT 'referencia_tecnica',
      organization TEXT NOT NULL DEFAULT 'otro',
      document_title TEXT NOT NULL,
      document_code TEXT,
      year INTEGER,
      version TEXT,
      chapter TEXT,
      section_ref TEXT,
      table_ref TEXT,
      radionuclide TEXT,
      criterion_type TEXT,
      variable_name TEXT,
      value_text TEXT,
      unit TEXT,
      context TEXT,
      official_url TEXT,
      verification_date DATE,
      verification_status TEXT NOT NULL DEFAULT 'pendiente_verificacion',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'activo',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nm_reference_history (
      id SERIAL PRIMARY KEY,
      reference_id INTEGER REFERENCES nm_technical_references(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      previous_value TEXT,
      new_value TEXT,
      notes TEXT,
      actor_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export async function logNmReferenceAudit(action: string, actorEmail: string | null, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'medicina_nuclear_referencias', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logNmReferenceAudit failed", err);
  }
}

export const NM_REFERENCE_TYPES = [
  { value: "criterio_radiologico", label: "Criterio radiologico" },
  { value: "referencia_tecnica", label: "Referencia tecnica" },
];

export const NM_REFERENCE_ORGANIZATIONS = [
  { value: "arpansa", label: "ARPANSA" },
  { value: "iaea", label: "IAEA" },
  { value: "icrp", label: "ICRP" },
  { value: "normativa_chilena", label: "Normativa chilena" },
  { value: "otro", label: "Otro" },
];

export const NM_REFERENCE_VERIFICATION_STATUSES = [
  { value: "pendiente_verificacion", label: "Pendiente de verificacion" },
  { value: "verificado", label: "Verificado" },
];

export const NM_REFERENCE_STATUSES = [
  { value: "activo", label: "Activo" },
  { value: "archivado", label: "Archivado" },
 ];
