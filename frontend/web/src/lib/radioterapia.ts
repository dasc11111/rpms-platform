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

  await sql`
    CREATE TABLE IF NOT EXISTS rt_actions (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL DEFAULT 'correctiva',
      origin TEXT NOT NULL DEFAULT 'manual',
      origin_ref TEXT,
      description TEXT NOT NULL,
      cause TEXT,
      action TEXT NOT NULL,
      responsible TEXT,
      priority TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL DEFAULT 'pendiente',
      created_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      closed_date DATE,
      evidence_url TEXT,
      effectiveness_verification TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

export const RT_ACTION_TYPES = [
  { value: "correctiva", label: "Correctiva" },
  { value: "preventiva", label: "Preventiva" },
];

export const RT_ACTION_ORIGINS = [
  { value: "incidente", label: "Incidente" },
  { value: "auditoria", label: "Auditoria" },
  { value: "desviacion", label: "Desviacion (QC/blindaje/dispositivo)" },
  { value: "vencimiento", label: "Vencimiento (autorizacion/calibracion/capacitacion)" },
  { value: "riesgo", label: "Riesgo" },
  { value: "tendencia", label: "Tendencia" },
  { value: "alerta", label: "Alerta" },
  { value: "manual", label: "Registro manual" },
];

export const RT_ACTION_PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Critica" },
];

export const RT_ACTION_STATUSES = [
  { value: "pendiente", label: "Pendiente", color: "amarillo" },
  { value: "en_proceso", label: "En proceso", color: "azul" },
  { value: "atrasada", label: "Atrasada", color: "naranjo" },
  { value: "completada", label: "Completada", color: "verde" },
  { value: "no_resuelta", label: "No resuelta", color: "rojo" },
  { value: "cancelada", label: "Cancelada", color: "negro" },
];

export function daysUntilDate(dateValue: any): number | null {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getActionAlertLevel(status: string, dueDate: any): { level: string; label: string; daysOverdue: number | null; daysRemaining: number | null } {
  const days = daysUntilDate(dueDate);
  const isOpenStatus = status === "pendiente" || status === "en_proceso" || status === "atrasada";
  if (!isOpenStatus) return { level: "cerrada", label: "Cerrada", daysOverdue: null, daysRemaining: null };
  if (days === null) return { level: "sin_fecha", label: "Sin fecha compromiso", daysOverdue: null, daysRemaining: null };
  if (days < 0) return { level: "vencida", label: "Accion vencida", daysOverdue: Math.abs(days), daysRemaining: null };
  if (days <= 7) return { level: "rojo", label: "Vence en 7 dias o menos", daysOverdue: null, daysRemaining: days };
  if (days <= 15) return { level: "naranjo", label: "Vence en 15 dias o menos", daysOverdue: null, daysRemaining: days };
  if (days <= 30) return { level: "amarillo", label: "Vence en 30 dias o menos", daysOverdue: null, daysRemaining: days };
  return { level: "verde", label: "En plazo", daysOverdue: null, daysRemaining: days };
}

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
