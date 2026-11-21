import { sql } from "@/lib/db";

/**
 * MODULO 4 - PET/CT - FASE A: ARQUITECTURA
 * Ficha tecnica del equipo PET/CT (Prompt de mejora Modulo 4, seccion 3).
 *
 * Cada equipo PET/CT dispone de una ficha propia con sus caracteristicas
 * tecnicas. Esta ficha es la base para: seleccionar el equipo en cada
 * control, mostrar si corresponde la prueba de TOF (PET-06), y vincular
 * baseline / eventos de servicio / catalogo de pruebas a un equipo
 * especifico. No se mezcla con la tabla generica "instruments" del resto
 * de la plataforma: esta tabla es especifica de PET/CT y guarda campos que
 * "instruments" no contempla (detectores, TOF, FOV, versiones de software,
 * etc.), pero se referencia opcionalmente al registro generico via
 * instrument_id para mantener compatibilidad con el resto del sistema.
 */

let ensured = false;

export type PetCtEquipment = {
  id: number;
  instrument_id: number | null;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  num_detectors: number | null;
  detector_type: string | null;
  crystal_material: string | null;
  acquisition_mode: string | null;
  has_tof: boolean;
  tof_timing_resolution_ps: number | null;
  fov_axial_cm: number | null;
  fov_transaxial_cm: number | null;
  num_rings: number | null;
  ct_num_slices: number | null;
  ct_kvp_options: string | null;
  ct_technology: string | null;
  software_name: string | null;
  software_version: string | null;
  pet_reconstruction_version: string | null;
  ct_reconstruction_version: string | null;
  installation_date: string | null;
  acceptance_date: string | null;
  last_calibration_date: string | null;
  last_service_date: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function ensurePetCtEquipmentTables() {
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS petct_equipment (
      id SERIAL PRIMARY KEY,
      instrument_id INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
      institution_name TEXT,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      internal_code TEXT,
      num_detectors INTEGER,
      detector_type TEXT,
      crystal_material TEXT,
      acquisition_mode TEXT,
      has_tof BOOLEAN NOT NULL DEFAULT false,
      tof_timing_resolution_ps NUMERIC,
      fov_axial_cm NUMERIC,
      fov_transaxial_cm NUMERIC,
      num_rings INTEGER,
      ct_num_slices INTEGER,
      ct_kvp_options TEXT,
      ct_technology TEXT,
      software_name TEXT,
      software_version TEXT,
      pet_reconstruction_version TEXT,
      ct_reconstruction_version TEXT,
      installation_date DATE,
      acceptance_date DATE,
      last_calibration_date DATE,
      last_service_date DATE,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_petct_equipment_active ON petct_equipment(active);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_petct_equipment_instrument ON petct_equipment(instrument_id);`;

  ensured = true;
}

export async function listPetCtEquipment(): Promise<PetCtEquipment[]> {
  await ensurePetCtEquipmentTables();
  const { rows } = await sql`SELECT * FROM petct_equipment WHERE active = true ORDER BY institution_name, model;`;
  return rows as PetCtEquipment[];
}

export async function getPetCtEquipmentById(id: number): Promise<PetCtEquipment | null> {
  await ensurePetCtEquipmentTables();
  const { rows } = await sql`SELECT * FROM petct_equipment WHERE id = ${id};`;
  return (rows[0] as PetCtEquipment) ?? null;
}

export async function createPetCtEquipment(data: Partial<PetCtEquipment>): Promise<PetCtEquipment> {
  await ensurePetCtEquipmentTables();
  const { rows } = await sql`INSERT INTO petct_equipment (
      instrument_id, institution_name, manufacturer, model, serial_number, internal_code,
      num_detectors, detector_type, crystal_material, acquisition_mode, has_tof,
      tof_timing_resolution_ps, fov_axial_cm, fov_transaxial_cm, num_rings,
      ct_num_slices, ct_kvp_options, ct_technology, software_name, software_version,
      pet_reconstruction_version, ct_reconstruction_version, installation_date,
      acceptance_date, last_calibration_date, last_service_date, notes
    ) VALUES (
      ${data.instrument_id ?? null}, ${data.institution_name ?? null}, ${data.manufacturer ?? null},
      ${data.model ?? null}, ${data.serial_number ?? null}, ${data.internal_code ?? null},
      ${data.num_detectors ?? null}, ${data.detector_type ?? null}, ${data.crystal_material ?? null},
      ${data.acquisition_mode ?? null}, ${data.has_tof ?? false}, ${data.tof_timing_resolution_ps ?? null},
      ${data.fov_axial_cm ?? null}, ${data.fov_transaxial_cm ?? null}, ${data.num_rings ?? null},
      ${data.ct_num_slices ?? null}, ${data.ct_kvp_options ?? null}, ${data.ct_technology ?? null},
      ${data.software_name ?? null}, ${data.software_version ?? null},
      ${data.pet_reconstruction_version ?? null}, ${data.ct_reconstruction_version ?? null},
      ${data.installation_date ?? null}, ${data.acceptance_date ?? null},
      ${data.last_calibration_date ?? null}, ${data.last_service_date ?? null}, ${data.notes ?? null}
    ) RETURNING *;`;
  return rows[0] as PetCtEquipment;
}

export async function updatePetCtEquipment(id: number, data: Partial<PetCtEquipment>): Promise<PetCtEquipment | null> {
  await ensurePetCtEquipmentTables();
  const existing = await getPetCtEquipmentById(id);
  if (!existing) return null;

  const merged = { ...existing, ...data };
  const { rows } = await sql`UPDATE petct_equipment SET
      instrument_id = ${merged.instrument_id},
      institution_name = ${merged.institution_name},
      manufacturer = ${merged.manufacturer},
      model = ${merged.model},
      serial_number = ${merged.serial_number},
      internal_code = ${merged.internal_code},
      num_detectors = ${merged.num_detectors},
      detector_type = ${merged.detector_type},
      crystal_material = ${merged.crystal_material},
      acquisition_mode = ${merged.acquisition_mode},
      has_tof = ${merged.has_tof},
      tof_timing_resolution_ps = ${merged.tof_timing_resolution_ps},
      fov_axial_cm = ${merged.fov_axial_cm},
      fov_transaxial_cm = ${merged.fov_transaxial_cm},
      num_rings = ${merged.num_rings},
      ct_num_slices = ${merged.ct_num_slices},
      ct_kvp_options = ${merged.ct_kvp_options},
      ct_technology = ${merged.ct_technology},
      software_name = ${merged.software_name},
      software_version = ${merged.software_version},
      pet_reconstruction_version = ${merged.pet_reconstruction_version},
      ct_reconstruction_version = ${merged.ct_reconstruction_version},
      installation_date = ${merged.installation_date},
      acceptance_date = ${merged.acceptance_date},
      last_calibration_date = ${merged.last_calibration_date},
      last_service_date = ${merged.last_service_date},
      notes = ${merged.notes},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *;`;
  return rows[0] as PetCtEquipment;
}
