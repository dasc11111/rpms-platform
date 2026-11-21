import { sql } from "@/lib/db";

/**
 * MODULO 2 - GAMMACAMARA - FASE A
 * Esquema de base de datos para la ficha técnica de la gammacámara y
 * los eventos de servicio técnico.
 *
 * Regulación: DS 133/1984 MINSAL (autorización de equipos generadores de
 * radiación, registro y trazabilidad de mantenimientos).
 * Referencia técnica: IAEA TECDOC-602 (Quality Control Atlas for
 * Scintillation Camera Systems).
 *
 * La ficha tecnica alimenta el registro de pruebas, baseline, eventos de
 * servicio y evidencia documental. Cada control de calidad debe poder
 * vincularse al equipo sobre el que se realiza (via instrument_id del
 * modulo de instrumentos o via el id propio de este equipo).
 */

let ensured = false;

export async function ensureGammacamaraEquipmentTables(): Promise<void> {
  if (ensured) return;

  // Ficha técnica del equipo gammacámara
  await sql`
    CREATE TABLE IF NOT EXISTS qc_gammacamara_equipment (
      id SERIAL PRIMARY KEY,
      institution_name TEXT,
      service_name TEXT,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      internal_code TEXT,
      num_detectors INTEGER DEFAULT 2,
      crystal_type TEXT DEFAULT 'NaI(Tl)',
      crystal_size_inch NUMERIC(6,2),
      fov_dimensions TEXT,
      energy_resolution_percent NUMERIC(6,2),
      intrinsic_resolution_fwhm_mm NUMERIC(6,2),
      collimator_types TEXT,
      software_name TEXT,
      software_version TEXT,
      installation_date DATE,
      acceptance_date DATE,
      last_calibration_date DATE,
      last_service_date DATE,
      authorization_number TEXT,
      authorization_expiry_date DATE,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Eventos de servicio técnico
  await sql`
    CREATE TABLE IF NOT EXISTS qc_gammacamara_service_events (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES qc_gammacamara_equipment(id) ON DELETE SET NULL,
      service_type TEXT NOT NULL,
      service_date DATE,
      technician TEXT,
      company TEXT,
      description TEXT,
      finding TEXT,
      action_taken TEXT,
      status TEXT NOT NULL DEFAULT 'completado',
      post_service_qc_required BOOLEAN DEFAULT false,
      post_service_qc_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_equip_active ON qc_gammacamara_equipment(active)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_svc_equipment ON qc_gammacamara_service_events(equipment_id, status)`;

  ensured = true;
}

export type GammacamaraEquipment = {
  id: number;
  institution_name: string | null;
  service_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  num_detectors: number | null;
  crystal_type: string | null;
  crystal_size_inch: number | null;
  fov_dimensions: string | null;
  energy_resolution_percent: number | null;
  intrinsic_resolution_fwhm_mm: number | null;
  collimator_types: string | null;
  software_name: string | null;
  software_version: string | null;
  installation_date: string | null;
  acceptance_date: string | null;
  last_calibration_date: string | null;
  last_service_date: string | null;
  authorization_number: string | null;
  authorization_expiry_date: string | null;
  notes: string | null;
  active: boolean;
};

export type GammacamaraServiceEvent = {
  id: number;
  equipment_id: number | null;
  service_type: string;
  service_date: string | null;
  technician: string | null;
  company: string | null;
  description: string | null;
  finding: string | null;
  action_taken: string | null;
  status: string;
  post_service_qc_required: boolean;
  post_service_qc_completed: boolean;
  created_at: string;
};

export async function listGammacamaraEquipment(): Promise<GammacamaraEquipment[]> {
  const { rows } = await sql`
    SELECT * FROM qc_gammacamara_equipment WHERE active = true ORDER BY institution_name, model
  `;
  return rows as GammacamaraEquipment[];
}

export async function getGammacamaraEquipmentById(id: number): Promise<GammacamaraEquipment | null> {
  const { rows } = await sql`SELECT * FROM qc_gammacamara_equipment WHERE id = ${id}`;
  return (rows[0] as GammacamaraEquipment) ?? null;
}

export async function createGammacamaraEquipment(data: Partial<GammacamaraEquipment>): Promise<GammacamaraEquipment> {
  const { rows } = await sql`
    INSERT INTO qc_gammacamara_equipment (
      institution_name, service_name, manufacturer, model, serial_number, internal_code,
      num_detectors, crystal_type, crystal_size_inch, fov_dimensions,
      energy_resolution_percent, intrinsic_resolution_fwhm_mm, collimator_types,
      software_name, software_version, installation_date, acceptance_date,
      last_calibration_date, last_service_date, authorization_number,
      authorization_expiry_date, notes
    ) VALUES (
      ${data.institution_name ?? null}, ${data.service_name ?? null},
      ${data.manufacturer ?? null}, ${data.model ?? null},
      ${data.serial_number ?? null}, ${data.internal_code ?? null},
      ${data.num_detectors ?? 2}, ${data.crystal_type ?? "NaI(Tl)"},
      ${data.crystal_size_inch ?? null}, ${data.fov_dimensions ?? null},
      ${data.energy_resolution_percent ?? null}, ${data.intrinsic_resolution_fwhm_mm ?? null},
      ${data.collimator_types ?? null}, ${data.software_name ?? null},
      ${data.software_version ?? null},
      ${data.installation_date ?? null}, ${data.acceptance_date ?? null},
      ${data.last_calibration_date ?? null}, ${data.last_service_date ?? null},
      ${data.authorization_number ?? null}, ${data.authorization_expiry_date ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `;
  return rows[0] as GammacamaraEquipment;
}

export async function updateGammacamaraEquipment(id: number, data: Partial<GammacamaraEquipment>): Promise<GammacamaraEquipment | null> {
  const { rows } = await sql`
    UPDATE qc_gammacamara_equipment SET
      institution_name = COALESCE(${data.institution_name ?? null}, institution_name),
      service_name = COALESCE(${data.service_name ?? null}, service_name),
      manufacturer = COALESCE(${data.manufacturer ?? null}, manufacturer),
      model = COALESCE(${data.model ?? null}, model),
      serial_number = ${data.serial_number ?? null},
      internal_code = ${data.internal_code ?? null},
      num_detectors = ${data.num_detectors ?? null},
      crystal_type = ${data.crystal_type ?? null},
      crystal_size_inch = ${data.crystal_size_inch ?? null},
      fov_dimensions = ${data.fov_dimensions ?? null},
      energy_resolution_percent = ${data.energy_resolution_percent ?? null},
      intrinsic_resolution_fwhm_mm = ${data.intrinsic_resolution_fwhm_mm ?? null},
      collimator_types = ${data.collimator_types ?? null},
      software_name = ${data.software_name ?? null},
      software_version = ${data.software_version ?? null},
      installation_date = ${data.installation_date ?? null},
      acceptance_date = ${data.acceptance_date ?? null},
      last_calibration_date = ${data.last_calibration_date ?? null},
      last_service_date = ${data.last_service_date ?? null},
      authorization_number = ${data.authorization_number ?? null},
      authorization_expiry_date = ${data.authorization_expiry_date ?? null},
      notes = ${data.notes ?? null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as GammacamaraEquipment) ?? null;
}

export async function listGammacamaraServiceEvents(equipmentId?: number): Promise<GammacamaraServiceEvent[]> {
  if (equipmentId) {
    const { rows } = await sql`
      SELECT * FROM qc_gammacamara_service_events
      WHERE equipment_id = ${equipmentId}
      ORDER BY service_date DESC, id DESC
    `;
    return rows as GammacamaraServiceEvent[];
  }
  const { rows } = await sql`
    SELECT * FROM qc_gammacamara_service_events ORDER BY service_date DESC, id DESC
  `;
  return rows as GammacamaraServiceEvent[];
}

export async function createGammacamaraServiceEvent(data: Partial<GammacamaraServiceEvent>): Promise<GammacamaraServiceEvent> {
  const { rows } = await sql`
    INSERT INTO qc_gammacamara_service_events (
      equipment_id, service_type, service_date, technician, company,
      description, finding, action_taken, status,
      post_service_qc_required, post_service_qc_completed
    ) VALUES (
      ${data.equipment_id ?? null}, ${data.service_type ?? "mantenimiento_preventivo"},
      ${data.service_date ?? null}, ${data.technician ?? null}, ${data.company ?? null},
      ${data.description ?? null}, ${data.finding ?? null}, ${data.action_taken ?? null},
      ${data.status ?? "completado"},
      ${data.post_service_qc_required ?? false}, ${data.post_service_qc_completed ?? false}
    )
    RETURNING *
  `;
  return rows[0] as GammacamaraServiceEvent;
}

export async function updateGammacamaraServiceEvent(id: number, data: Partial<GammacamaraServiceEvent>): Promise<GammacamaraServiceEvent | null> {
  const { rows } = await sql`
    UPDATE qc_gammacamara_service_events SET
      service_type = ${data.service_type ?? null},
      service_date = ${data.service_date ?? null},
      technician = ${data.technician ?? null},
      company = ${data.company ?? null},
      description = ${data.description ?? null},
      finding = ${data.finding ?? null},
      action_taken = ${data.action_taken ?? null},
      status = ${data.status ?? null},
      post_service_qc_required = ${data.post_service_qc_required ?? null},
      post_service_qc_completed = ${data.post_service_qc_completed ?? null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as GammacamaraServiceEvent) ?? null;
}
