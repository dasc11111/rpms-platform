import { sql } from "@/lib/db";

export type NmIncidentCategory =
  | "derrame"
  | "perdida_material"
  | "exposicion"
  | "contaminacion"
  | "equipo"
  | "otro";

export type NmIncidentSeverity = "leve" | "moderado" | "grave";
export type NmNotificationStatus = "pendiente" | "notificado" | "no_aplica";
export type NmInvestigationStatus = "abierto" | "en_investigacion" | "cerrado";
export type NmIncidentStatus = "abierto" | "cerrado";

export interface NmIncidentRecord {
  id: number;
  event_date: string;
  event_time: string | null;
  category: NmIncidentCategory;
  severity: NmIncidentSeverity;
  is_near_miss: boolean;
  location: string | null;
  person_involved: string | null;
  description: string;
  immediate_actions: string | null;
  notification_status: NmNotificationStatus;
  notified_to: string | null;
  investigation_status: NmInvestigationStatus;
  corrective_actions: string | null;
  responsible: string | null;
  documents_url: string | null;
  status: NmIncidentStatus;
  created_at: string;
  updated_at: string;
}

export interface NmIncidentStageHistoryRecord {
  id: number;
  incident_id: number;
  stage: string;
  notes: string | null;
  responsible: string | null;
  stage_date: string;
  created_at: string;
}

let ensured = false;

export async function ensureNmIncidentsTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS nm_incidents (
      id SERIAL PRIMARY KEY,
      event_date DATE NOT NULL,
      event_time TEXT,
      category TEXT NOT NULL DEFAULT 'otro',
      severity TEXT NOT NULL DEFAULT 'leve',
      is_near_miss BOOLEAN NOT NULL DEFAULT false,
      location TEXT,
      person_involved TEXT,
      description TEXT NOT NULL,
      immediate_actions TEXT,
      notification_status TEXT NOT NULL DEFAULT 'pendiente',
      notified_to TEXT,
      investigation_status TEXT NOT NULL DEFAULT 'abierto',
      corrective_actions TEXT,
      responsible TEXT,
      documents_url TEXT,
      status TEXT NOT NULL DEFAULT 'abierto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nm_incident_stage_history (
      id SERIAL PRIMARY KEY,
      incident_id INTEGER REFERENCES nm_incidents(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      notes TEXT,
      responsible TEXT,
      stage_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  ensured = true;
}

export async function logNmIncidentAudit(action: string, actorEmail: string | null, details: any) {
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
      VALUES (${actorEmail}, ${action}, 'medicina_nuclear_incidentes', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logNmIncidentAudit failed", err);
  }
}

export const NM_INCIDENT_CATEGORIES = [
  { value: "derrame", label: "Derrame de material radiactivo" },
  { value: "perdida_material", label: "Perdida de material radiactivo" },
  { value: "exposicion", label: "Exposicion no planificada" },
  { value: "contaminacion", label: "Contaminacion (personal, paciente o area)" },
  { value: "equipo", label: "Falla o mal funcionamiento de equipo" },
  { value: "otro", label: "Otro" },
];

export const NM_INCIDENT_SEVERITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "grave", label: "Grave" },
];

export const NM_NOTIFICATION_STATUSES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "notificado", label: "Notificado" },
  { value: "no_aplica", label: "No aplica" },
];

export const NM_INVESTIGATION_STATUSES = [
  { value: "abierto", label: "Abierto" },
  { value: "en_investigacion", label: "En investigacion" },
  { value: "cerrado", label: "Cerrado" },
];

export const NM_INCIDENT_STATUSES = [
  { value: "abierto", label: "Abierto" },
  { value: "cerrado", label: "Cerrado" },
];
