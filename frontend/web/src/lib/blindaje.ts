import { sql } from "@/lib/db";

// MODULO: BLINDAJE Y DISENO. Ver docs/BLINDAJE_MASTER_MATRICES.md para fuentes.
// REGLA (S55): ningun valor normativo se hardcodea; todo viene de
// blindaje_regulatory_parameters o blindaje_materials, con fuente y pagina.

let ensured = false;

export async function ensureBlindajeTables() {
  if (ensured) return;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_projects (
id SERIAL PRIMARY KEY,
project_number TEXT,
version TEXT NOT NULL DEFAULT '1.0',
name TEXT NOT NULL,
institution TEXT,
service TEXT,
unit TEXT,
address TEXT,
city TEXT,
responsible TEXT,
opr_name TEXT,
medical_physicist TEXT,
facility_type TEXT NOT NULL DEFAULT 'diagnostico',
mode TEXT NOT NULL DEFAULT 'simple',
status TEXT NOT NULL DEFAULT 'borrador',
notes TEXT,
created_by TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_equipment (
id SERIAL PRIMARY KEY,
project_id INTEGER NOT NULL REFERENCES blindaje_projects(id) ON DELETE CASCADE,
manufacturer TEXT,
model TEXT,
equipment_type TEXT,
parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_sources (
id SERIAL PRIMARY KEY,
project_id INTEGER NOT NULL REFERENCES blindaje_projects(id) ON DELETE CASCADE,
source_type TEXT,
radionuclide TEXT,
energy TEXT,
activity NUMERIC,
activity_unit TEXT,
dose_rate NUMERIC,
dose_rate_unit TEXT,
geometry TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_workload (
id SERIAL PRIMARY KEY,
project_id INTEGER NOT NULL REFERENCES blindaje_projects(id) ON DELETE CASCADE,
input_mode TEXT NOT NULL DEFAULT 'simple',
data JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_pir (
id SERIAL PRIMARY KEY,
project_id INTEGER NOT NULL REFERENCES blindaje_projects(id) ON DELETE CASCADE,
code TEXT NOT NULL,
name TEXT NOT NULL,
description TEXT,
distance_m NUMERIC,
area_type TEXT,
occupancy_type TEXT,
occupancy_factor NUMERIC,
result_value NUMERIC,
result_unit TEXT,
result_status TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_barriers (
id SERIAL PRIMARY KEY,
project_id INTEGER NOT NULL REFERENCES blindaje_projects(id) ON DELETE CASCADE,
pir_id INTEGER REFERENCES blindaje_pir(id) ON DELETE SET NULL,
code TEXT NOT NULL,
name TEXT NOT NULL,
barrier_type TEXT NOT NULL DEFAULT 'primaria',
material TEXT,
density NUMERIC,
material_source TEXT,
thickness_existing_cm NUMERIC,
thickness_required_cm NUMERIC,
thickness_adopted_cm NUMERIC,
margin_cm NUMERIC,
distance_m NUMERIC,
use_factor NUMERIC,
occupancy_factor NUMERIC,
result_value NUMERIC,
result_unit TEXT,
result_status TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_materials (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
density NUMERIC,
density_unit TEXT NOT NULL DEFAULT 'g/cm3',
hvl NUMERIC,
tvl NUMERIC,
coefficients JSONB NOT NULL DEFAULT '{}'::jsonb,
method TEXT,
application_range TEXT,
source_document TEXT,
source_page TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_regulatory_parameters (
id SERIAL PRIMARY KEY,
norma TEXT NOT NULL,
version TEXT,
effective_date DATE,
parameter_name TEXT NOT NULL,
value NUMERIC,
unit TEXT,
modality TEXT,
applicability TEXT,
source_document TEXT NOT NULL,
source_page TEXT,
source_section TEXT,
notes TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_formulas (
id SERIAL PRIMARY KEY,
internal_code TEXT NOT NULL,
name TEXT NOT NULL,
modality TEXT,
description TEXT,
equation TEXT,
variables JSONB NOT NULL DEFAULT '{}'::jsonb,
units TEXT,
assumptions TEXT,
validity_range TEXT,
source_document TEXT,
source_page TEXT,
version TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS blindaje_audit (
id SERIAL PRIMARY KEY,
project_id INTEGER REFERENCES blindaje_projects(id) ON DELETE CASCADE,
entity_type TEXT NOT NULL,
entity_id INTEGER,
field_name TEXT,
old_value TEXT,
new_value TEXT,
user_name TEXT,
reason TEXT,
changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

ensured = true;
}

export async function listBlindajeProjects() {
  await ensureBlindajeTables();
  const rows = await sql`SELECT * FROM blindaje_projects ORDER BY created_at DESC`;
  return rows;
}

export async function getBlindajeProject(id: number) {
  await ensureBlindajeTables();
  const rows = await sql`SELECT * FROM blindaje_projects WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createBlindajeProject(data: Record<string, unknown>) {
  await ensureBlindajeTables();
  const rows = await sql`
  INSERT INTO blindaje_projects (
  project_number, name, institution, service, unit, address, city,
  responsible, opr_name, medical_physicist, facility_type, mode, status, notes, created_by
  ) VALUES (
  ${data.project_number || null}, ${data.name}, ${data.institution || null},
  ${data.service || null}, ${data.unit || null}, ${data.address || null},
  ${data.city || null}, ${data.responsible || null}, ${data.opr_name || null},
  ${data.medical_physicist || null}, ${data.facility_type || 'diagnostico'},
  ${data.mode || 'simple'}, ${data.status || 'borrador'}, ${data.notes || null},
  ${data.created_by || null}
  ) RETURNING *;
  `;
  return rows[0];
}

export async function listBlindajeMaterials() {
  await ensureBlindajeTables();
  return sql`SELECT * FROM blindaje_materials ORDER BY name ASC`;
}

export async function listBlindajeRegulatoryParameters(modality?: string) {
  await ensureBlindajeTables();
  if (modality) {
    return sql`SELECT * FROM blindaje_regulatory_parameters WHERE modality = ${modality} ORDER BY norma ASC`;
  }
  return sql`SELECT * FROM blindaje_regulatory_parameters ORDER BY norma ASC`;
}

export async function listBlindajeFormulas(modality?: string) {
  await ensureBlindajeTables();
  if (modality) {
    return sql`SELECT * FROM blindaje_formulas WHERE modality = ${modality} ORDER BY internal_code ASC`;
  }
  return sql`SELECT * FROM blindaje_formulas ORDER BY internal_code ASC`;
}

export async function addBlindajeAudit(entry: Record<string, unknown>) {
  await ensureBlindajeTables();
  await sql`
  INSERT INTO blindaje_audit (
  project_id, entity_type, entity_id, field_name, old_value, new_value, user_name, reason
  ) VALUES (
  ${entry.project_id || null}, ${entry.entity_type}, ${entry.entity_id || null},
  ${entry.field_name || null}, ${entry.old_value || null}, ${entry.new_value || null},
  ${entry.user_name || null}, ${entry.reason || null}
  );
  `;
}
