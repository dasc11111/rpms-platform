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
    await sql`
        CREATE TABLE IF NOT EXISTS rt_risks (
              id SERIAL PRIMARY KEY,
                    facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
                          linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
                                description TEXT NOT NULL,
                                      area TEXT,
                                            equipment TEXT,
                                                  process TEXT,
                                                        cause TEXT,
                                                              consequence TEXT,
                                                                    probability INTEGER NOT NULL DEFAULT 1,
                                                                          severity INTEGER NOT NULL DEFAULT 1,
                                                                                existing_control TEXT,
                                                                                      action TEXT,
                                                                                            responsible TEXT,
                                                                                                  due_date DATE,
                                                                                                        status TEXT NOT NULL DEFAULT 'identificado',
                                                                                                              evidence_url TEXT,
                                                                                                                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                                          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                              );
                                                                                                                                `;
  

await sql`
ALTER TABLE rt_incidents
ADD COLUMN IF NOT EXISTS incident_time TEXT,
ADD COLUMN IF NOT EXISTS person_involved TEXT,
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otro',
ADD COLUMN IF NOT EXISTS estimated_dose TEXT,
ADD COLUMN IF NOT EXISTS impact TEXT,
ADD COLUMN IF NOT EXISTS immediate_actions TEXT,
ADD COLUMN IF NOT EXISTS responsible TEXT,
ADD COLUMN IF NOT EXISTS documents_url TEXT,
ADD COLUMN IF NOT EXISTS investigation_stage TEXT NOT NULL DEFAULT 'registrado',
ADD COLUMN IF NOT EXISTS root_cause_method TEXT,
ADD COLUMN IF NOT EXISTS root_cause_data JSONB;
`;

await sql`
CREATE TABLE IF NOT EXISTS rt_incident_stage_history (
id SERIAL PRIMARY KEY,
incident_id INTEGER REFERENCES rt_incidents(id) ON DELETE CASCADE,
stage TEXT NOT NULL,
notes TEXT,
responsible TEXT,
stage_date DATE NOT NULL DEFAULT CURRENT_DATE,
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

export const RT_PROBABILITY_SCALE = [
  { value: 1, label: "Muy baja" },
  { value: 2, label: "Baja" },
  { value: 3, label: "Media" },
  { value: 4, label: "Alta" },
  { value: 5, label: "Muy alta" },
  ];

export const RT_SEVERITY_SCALE = [
  { value: 1, label: "Insignificante" },
  { value: 2, label: "Menor" },
  { value: 3, label: "Moderada" },
  { value: 4, label: "Mayor" },
  { value: 5, label: "Catastrofica" },
  ];

export const RT_RISK_STATUSES = [
  { value: "identificado", label: "Identificado", color: "blanco" },
  { value: "en_tratamiento", label: "En tratamiento", color: "amarillo" },
  { value: "controlado", label: "Controlado", color: "verde" },
  { value: "cerrado", label: "Cerrado", color: "negro" },
  ];

export function getRiskClassification(probability: any, severity: any): { score: number; level: string; label: string; color: string } {
  const score = (Number(probability) || 0) * (Number(severity) || 0);
  if (score <= 4) return { score, level: "bajo", label: "Bajo", color: "verde" };
  if (score <= 9) return { score, level: "moderado", label: "Moderado", color: "amarillo" };
  if (score <= 15) return { score, level: "alto", label: "Alto", color: "naranjo" };
  return { score, level: "muy_alto", label: "Muy alto", color: "rojo" };
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


export const RT_INCIDENT_CATEGORIES = [
{ value: "radiologico", label: "Radiologico" },
{ value: "operacional", label: "Operacional" },
{ value: "tecnico", label: "Tecnico" },
{ value: "dosimetrico", label: "Dosimetrico" },
{ value: "instrumental", label: "Instrumental" },
{ value: "mantenimiento", label: "Mantenimiento" },
{ value: "documental", label: "Documental" },
{ value: "seguridad", label: "Seguridad" },
{ value: "emergencia", label: "Emergencia" },
{ value: "otro", label: "Otro" },
];

export const RT_INCIDENT_STAGES = [
{ value: "registrado", label: "Registrado" },
{ value: "evaluacion_inicial", label: "Evaluacion inicial" },
{ value: "investigacion", label: "Investigacion" },
{ value: "causa", label: "Causa" },
{ value: "accion_correctiva", label: "Accion correctiva" },
{ value: "verificacion", label: "Verificacion" },
{ value: "cierre", label: "Cierre" },
];

export const RT_ROOT_CAUSE_METHODS = [
{ value: "ninguno", label: "Ninguno / no requiere" },
{ value: "5_porques", label: "5 Por que (5 Whys)" },
{ value: "ishikawa", label: "Ishikawa (causa-efecto)" },
{ value: "simple", label: "Analisis simple" },
{ value: "personalizado", label: "Analisis personalizado" },
];

export function getIncidentStageIndex(stage: any) {
const idx = RT_INCIDENT_STAGES.findIndex((s) => s.value === stage);
return idx === -1 ? 0 : idx;
}
