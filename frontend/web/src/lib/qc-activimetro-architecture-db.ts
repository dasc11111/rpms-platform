import { sql } from "@/lib/db";

/**
 * MODULO ACTIVIMETRO - FASE A: ARQUITECTURA
 * Infraestructura de soporte para el sistema profesional de QA/QC de
 * Activimetros (Dose Calibrators), siguiendo el mismo principio ya
 * aplicado en PET/CT: el catalogo de pruebas es DATOS, no codigo.
 *
 * Esta capa agrega, sin romper el modulo basico existente
 * (qc-activimetro-db.ts / qc-activimetro-calc.ts, con las 5 pruebas
 * cuantitativas ya implementadas: precision, exactitud, linealidad,
 * respuesta_fondo, geometria_volumen):
 *
 * - Ficha tecnica dedicada del equipo (qc_activimetro_equipment),
 *   independiente de la tabla generica instruments.
 * - Catalogo configurable ACTIV-01 a ACTIV-07 (qc_activimetro_test_catalog).
 * - Catalogo de radionucleidos (qc_activimetro_radionuclides).
 * - Fuentes/patrones con trazabilidad metrologica (qc_activimetro_sources).
 * - Procedimientos institucionales versionados (qc_activimetro_procedures /
 *   qc_activimetro_procedure_versions); nunca se sobrescribe una version.
 * - Baseline historico por equipo/prueba/parametro, sin sobrescritura.
 * - Eventos de servicio tecnico (post-servicio).
 * - Evidencia grafica/documental.
 * - Bitacora de auditoria generica y reutilizable.
 *
 * Principio (seccion 45 del prompt maestro): no se inventan tolerancias,
 * energias, geometrias, tiempos, limites ni formulas. Cuando el dato no
 * esta definido, se deja NULL y la UI debe mostrar 'Parametro no
 * configurado. Debe ser definido por el Fisico Medico responsable.'
 */

let ensured = false;

export type ActivimetroEquipment = {
  id: number;
  instrument_id: number | null;
  institution_name: string | null;
  service_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  chamber_type: string | null;
  detector_type: string | null;
  software_name: string | null;
  software_version: string | null;
  installation_date: string | null;
  acceptance_date: string | null;
  last_calibration_date: string | null;
  last_service_date: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivimetroTestCatalogEntry = {
  id: number;
  test_code: string;
  test_name: string;
  objective: string | null;
  responsible_level: string;
  freq_acceptance: boolean;
  freq_daily: boolean;
  freq_weekly: boolean;
  freq_monthly: boolean;
  freq_quarterly: boolean;
  freq_semiannual: boolean;
  freq_annual: boolean;
  freq_post_service: boolean;
  material_required: string | null;
  radionuclide: string | null;
  activity_required: string | null;
  procedure_text: string | null;
  formula: string | null;
  reference_value: string | null;
  tolerance_description: string | null;
  action_level_description: string | null;
  corrective_action: string | null;
  reference_bibliography: string;
  procedure_version: string | null;
  implemented: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivimetroRadionuclide = {
  id: number;
  name: string;
  symbol: string;
  half_life_minutes: number;
  decay_constant_per_min: number;
  unit: string | null;
  reference_source: string | null;
  active: boolean;
};

export async function ensureActivimetroArchitectureTables() {
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_equipment (
    id SERIAL PRIMARY KEY,
    instrument_id INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
    institution_name TEXT,
    service_name TEXT,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    internal_code TEXT,
    chamber_type TEXT,
    detector_type TEXT,
    software_name TEXT,
    software_version TEXT,
    installation_date DATE,
    acceptance_date DATE,
    last_calibration_date DATE,
    last_service_date DATE,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_test_catalog (
    id SERIAL PRIMARY KEY,
    test_code TEXT NOT NULL UNIQUE,
    test_name TEXT NOT NULL,
    objective TEXT,
    responsible_level TEXT NOT NULL DEFAULT 'fisico_medico',
    freq_acceptance BOOLEAN NOT NULL DEFAULT false,
    freq_daily BOOLEAN NOT NULL DEFAULT false,
    freq_weekly BOOLEAN NOT NULL DEFAULT false,
    freq_monthly BOOLEAN NOT NULL DEFAULT false,
    freq_quarterly BOOLEAN NOT NULL DEFAULT false,
    freq_semiannual BOOLEAN NOT NULL DEFAULT false,
    freq_annual BOOLEAN NOT NULL DEFAULT false,
    freq_post_service BOOLEAN NOT NULL DEFAULT false,
    material_required TEXT,
    radionuclide TEXT,
    activity_required TEXT,
    procedure_text TEXT,
    formula TEXT,
    reference_value TEXT,
    tolerance_description TEXT,
    action_level_description TEXT,
    corrective_action TEXT,
    reference_bibliography TEXT NOT NULL DEFAULT 'IAEA Human Health Series No. 1 / TECDOC-602',
    procedure_version TEXT,
    implemented BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_radionuclides (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL UNIQUE,
    half_life_minutes NUMERIC NOT NULL,
    decay_constant_per_min NUMERIC NOT NULL,
    unit TEXT,
    reference_source TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_sources (
    id SERIAL PRIMARY KEY,
    radionuclide TEXT,
    certificate_number TEXT,
    institution_lab TEXT,
    calibration_date DATE,
    certified_activity NUMERIC,
    activity_unit TEXT,
    uncertainty_percent NUMERIC,
    reference_datetime TIMESTAMPTZ,
    geometry TEXT,
    container TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_procedures (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    responsible TEXT,
    bibliography TEXT,
    status TEXT NOT NULL DEFAULT 'vigente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(code)
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_procedure_versions (
    id SERIAL PRIMARY KEY,
    procedure_id INTEGER NOT NULL REFERENCES qc_activimetro_procedures(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    review_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT true,
    document_url TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(procedure_id, version)
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_baseline (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES qc_activimetro_equipment(id) ON DELETE SET NULL,
    test_code TEXT NOT NULL,
    parameter_name TEXT NOT NULL,
    value NUMERIC,
    unit TEXT,
    date_established DATE NOT NULL DEFAULT CURRENT_DATE,
    radionuclide TEXT,
    geometry TEXT,
    operator TEXT,
    physicist_responsible TEXT,
    is_current BOOLEAN NOT NULL DEFAULT true,
    previous_baseline_id INTEGER REFERENCES qc_activimetro_baseline(id) ON DELETE SET NULL,
    change_reason TEXT,
    changed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_service_events (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES qc_activimetro_equipment(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL,
    component_affected TEXT,
    service_date DATE NOT NULL,
    technician TEXT,
    company TEXT,
    work_order_number TEXT,
    description TEXT,
    tests_required JSONB,
    tests_completed JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_evidence (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES qc_activimetro_tests(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES qc_activimetro_equipment(id) ON DELETE SET NULL,
    evidence_type TEXT NOT NULL,
    file_name TEXT,
    file_url TEXT,
    description TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_audit_log (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    changed_by TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_equipment_active ON qc_activimetro_equipment(active);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_catalog_active ON qc_activimetro_test_catalog(active);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_baseline_lookup ON qc_activimetro_baseline(equipment_id, test_code, parameter_name, is_current);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_service_equipment ON qc_activimetro_service_events(equipment_id, status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_evidence_test ON qc_activimetro_evidence(test_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_evidence_equipment ON qc_activimetro_evidence(equipment_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_audit_entity ON qc_activimetro_audit_log(entity_type, entity_id);`;

  await seedTestCatalog();
  await seedRadionuclides();

  ensured = true;
}

/**
 * Catalogo inicial ACTIV-01 a ACTIV-07 (seccion 4 del prompt maestro).
 * ON CONFLICT DO NOTHING para no pisar ajustes posteriores del Fisico
 * Medico. implemented = true solo para las pruebas cuantitativas ya
 * construidas en el modulo basico (precision/exactitud/linealidad, que
 * corresponden a ACTIV-02/03/04); el resto queda pendiente de pantalla
 * dedicada en fases posteriores, pero ya disponible como referencia.
 */
async function seedTestCatalog() {
  const entries: Array<Partial<ActivimetroTestCatalogEntry> & { test_code: string; test_name: string }> = [
    { test_code: 'ACTIV-01', test_name: 'Inspeccion fisica y funcional', objective: 'Verificar integridad fisica, camara de medicion, porta-viales/jeringas, pantalla, teclado, conectores, fuente de alimentacion, limpieza, identificacion y documentacion.', responsible_level: 'operador', freq_daily: true, implemented: false },
    { test_code: 'ACTIV-02', test_name: 'Exactitud', objective: 'Comparar la actividad medida contra un valor de referencia certificado (fuente patron).', responsible_level: 'fisico_medico', freq_annual: true, freq_post_service: true, formula: 'Diferencia % = ((Actividad medida - Actividad de referencia) / Actividad de referencia) x 100', implemented: true },
    { test_code: 'ACTIV-03', test_name: 'Precision / Repetibilidad', objective: 'Evaluar la dispersion de multiples lecturas repetidas de una misma fuente (CV%).', responsible_level: 'operador', freq_daily: true, formula: 'CV% = SD / Media x 100', implemented: true },
    { test_code: 'ACTIV-04', test_name: 'Linealidad', objective: 'Evaluar la respuesta lineal del activimetro en un rango de actividades mediante regresion (incluye analisis ln-ln cuando corresponda).', responsible_level: 'fisico_medico', freq_quarterly: true, freq_post_service: true, implemented: true },
    { test_code: 'ACTIV-05', test_name: 'Exactitud por radionuclido', objective: 'Repetir la evaluacion de exactitud para distintos radionucleidos del catalogo configurable (99mTc, 131I, 18F, 68Ga, 177Lu, otros).', responsible_level: 'fisico_medico', freq_annual: true, implemented: false },
    { test_code: 'ACTIV-06', test_name: 'Constancia', objective: 'Control periodico comparando la actividad medida contra tolerancia, baseline y resultado anterior.', responsible_level: 'operador', freq_daily: true, implemented: false },
    { test_code: 'ACTIV-07', test_name: 'Pureza radionucleidica de 99mTc', objective: 'Evaluar la pureza radionucleidica del eluido de 99mTc mediante prueba guiada de 12 pasos (identificacion, muestra, procedimiento, preparacion, configuracion, fondo, mediciones, impurezas, calculo, evaluacion, revision, validacion).', responsible_level: 'fisico_medico', radionuclide: '99mTc', freq_daily: true, implemented: false },
  ];

  for (const e of entries) {
    await sql`INSERT INTO qc_activimetro_test_catalog
      (test_code, test_name, objective, responsible_level, freq_acceptance, freq_daily, freq_weekly, freq_monthly, freq_quarterly, freq_semiannual, freq_annual, freq_post_service, radionuclide, formula, implemented)
      VALUES
      (${e.test_code}, ${e.test_name}, ${e.objective ?? null}, ${e.responsible_level ?? 'fisico_medico'}, ${e.freq_acceptance ?? false}, ${e.freq_daily ?? false}, ${e.freq_weekly ?? false}, ${e.freq_monthly ?? false}, ${e.freq_quarterly ?? false}, ${e.freq_semiannual ?? false}, ${e.freq_annual ?? false}, ${e.freq_post_service ?? false}, ${e.radionuclide ?? null}, ${e.formula ?? null}, ${e.implemented ?? false})
      ON CONFLICT (test_code) DO NOTHING;`;
  }
}

/**
 * Catalogo de radionucleidos (seccion 12). Vidas medias de referencia
 * (NNDC / IAEA). decay_constant_per_min = ln(2) / half_life_minutes.
 */
async function seedRadionuclides() {
  const LN2 = Math.log(2);
  const entries: Array<{ name: string; symbol: string; half_life_minutes: number; unit: string }> = [
    { name: 'Tecnecio-99m', symbol: '99mTc', half_life_minutes: 360.6, unit: 'MBq' },
    { name: 'Yodo-131', symbol: '131I', half_life_minutes: 11554.56, unit: 'MBq' },
    { name: 'Fluor-18', symbol: '18F', half_life_minutes: 109.77, unit: 'MBq' },
    { name: 'Galio-68', symbol: '68Ga', half_life_minutes: 67.71, unit: 'MBq' },
    { name: 'Lutecio-177', symbol: '177Lu', half_life_minutes: 9569.6, unit: 'MBq' },
  ];

  for (const e of entries) {
    const decay = LN2 / e.half_life_minutes;
    await sql`INSERT INTO qc_activimetro_radionuclides (name, symbol, half_life_minutes, decay_constant_per_min, unit, reference_source)
      VALUES (${e.name}, ${e.symbol}, ${e.half_life_minutes}, ${decay}, ${e.unit}, 'IAEA / NNDC - valores estandar de vida media')
      ON CONFLICT (symbol) DO NOTHING;`;
  }
}

// ---------- Equipo (ficha tecnica) ----------

export async function listActivimetroEquipment(): Promise<ActivimetroEquipment[]> {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_equipment WHERE active = true ORDER BY institution_name, model;`;
  return rows as ActivimetroEquipment[];
}

export async function getActivimetroEquipmentById(id: number): Promise<ActivimetroEquipment | null> {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_equipment WHERE id = ${id};`;
  return (rows[0] as ActivimetroEquipment) ?? null;
}

export async function createActivimetroEquipment(data: Partial<ActivimetroEquipment>): Promise<ActivimetroEquipment> {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_activimetro_equipment (
    instrument_id, institution_name, service_name, manufacturer, model, serial_number, internal_code,
    chamber_type, detector_type, software_name, software_version,
    installation_date, acceptance_date, last_calibration_date, last_service_date, notes
  ) VALUES (
    ${data.instrument_id ?? null}, ${data.institution_name ?? null}, ${data.service_name ?? null},
    ${data.manufacturer ?? null}, ${data.model ?? null}, ${data.serial_number ?? null}, ${data.internal_code ?? null},
    ${data.chamber_type ?? null}, ${data.detector_type ?? null}, ${data.software_name ?? null}, ${data.software_version ?? null},
    ${data.installation_date ?? null}, ${data.acceptance_date ?? null}, ${data.last_calibration_date ?? null}, ${data.last_service_date ?? null}, ${data.notes ?? null}
  ) RETURNING *;`;
  return rows[0] as ActivimetroEquipment;
}

export async function updateActivimetroEquipment(id: number, data: Partial<ActivimetroEquipment>): Promise<ActivimetroEquipment | null> {
  await ensureActivimetroArchitectureTables();
  const existing = await getActivimetroEquipmentById(id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const { rows } = await sql`UPDATE qc_activimetro_equipment SET
    instrument_id = ${merged.instrument_id},
    institution_name = ${merged.institution_name},
    service_name = ${merged.service_name},
    manufacturer = ${merged.manufacturer},
    model = ${merged.model},
    serial_number = ${merged.serial_number},
    internal_code = ${merged.internal_code},
    chamber_type = ${merged.chamber_type},
    detector_type = ${merged.detector_type},
    software_name = ${merged.software_name},
    software_version = ${merged.software_version},
    installation_date = ${merged.installation_date},
    acceptance_date = ${merged.acceptance_date},
    last_calibration_date = ${merged.last_calibration_date},
    last_service_date = ${merged.last_service_date},
    notes = ${merged.notes},
    updated_at = now()
  WHERE id = ${id}
  RETURNING *;`;
  return rows[0] as ActivimetroEquipment;
}

// ---------- Catalogo de pruebas ----------

export async function listActivimetroTestCatalog(): Promise<ActivimetroTestCatalogEntry[]> {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_test_catalog WHERE active = true ORDER BY test_code;`;
  return rows as ActivimetroTestCatalogEntry[];
}

export async function getActivimetroTestCatalogByCode(code: string): Promise<ActivimetroTestCatalogEntry | null> {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_test_catalog WHERE test_code = ${code};`;
  return (rows[0] as ActivimetroTestCatalogEntry) ?? null;
}

export async function updateActivimetroTestCatalogEntry(code: string, data: Partial<ActivimetroTestCatalogEntry>): Promise<ActivimetroTestCatalogEntry | null> {
  await ensureActivimetroArchitectureTables();
  const existing = await getActivimetroTestCatalogByCode(code);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const { rows } = await sql`UPDATE qc_activimetro_test_catalog SET
    test_name = ${merged.test_name},
    objective = ${merged.objective},
    responsible_level = ${merged.responsible_level},
    material_required = ${merged.material_required},
    radionuclide = ${merged.radionuclide},
    activity_required = ${merged.activity_required},
    procedure_text = ${merged.procedure_text},
    formula = ${merged.formula},
    reference_value = ${merged.reference_value},
    tolerance_description = ${merged.tolerance_description},
    action_level_description = ${merged.action_level_description},
    corrective_action = ${merged.corrective_action},
    reference_bibliography = ${merged.reference_bibliography},
    procedure_version = ${merged.procedure_version},
    updated_at = now()
  WHERE test_code = ${code}
  RETURNING *;`;
  return rows[0] as ActivimetroTestCatalogEntry;
}

// ---------- Radionucleidos ----------

export async function listActivimetroRadionuclides(): Promise<ActivimetroRadionuclide[]> {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_radionuclides WHERE active = true ORDER BY name;`;
  return rows as ActivimetroRadionuclide[];
}

// ---------- Fuentes / patrones ----------

export async function listActivimetroSources() {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_sources WHERE active = true ORDER BY calibration_date DESC;`;
  return rows;
}

export async function createActivimetroSource(input: {
  radionuclide?: string | null;
  certificate_number?: string | null;
  institution_lab?: string | null;
  calibration_date?: string | null;
  certified_activity?: number | null;
  activity_unit?: string | null;
  uncertainty_percent?: number | null;
  reference_datetime?: string | null;
  geometry?: string | null;
  container?: string | null;
  notes?: string | null;
}) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_activimetro_sources
    (radionuclide, certificate_number, institution_lab, calibration_date, certified_activity, activity_unit, uncertainty_percent, reference_datetime, geometry, container, notes)
    VALUES (${input.radionuclide ?? null}, ${input.certificate_number ?? null}, ${input.institution_lab ?? null}, ${input.calibration_date ?? null}, ${input.certified_activity ?? null}, ${input.activity_unit ?? null}, ${input.uncertainty_percent ?? null}, ${input.reference_datetime ?? null}, ${input.geometry ?? null}, ${input.container ?? null}, ${input.notes ?? null})
    RETURNING *;`;
  return rows[0];
}

// ---------- Procedimientos versionados ----------

export async function listActivimetroProcedures() {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT p.*, v.version AS current_version, v.effective_date AS current_effective_date, v.review_date AS current_review_date, v.document_url AS current_document_url
    FROM qc_activimetro_procedures p
    LEFT JOIN qc_activimetro_procedure_versions v ON v.procedure_id = p.id AND v.is_current = true
    ORDER BY p.name;`;
  return rows;
}

export async function createActivimetroProcedure(input: { code: string; name: string; responsible?: string | null; bibliography?: string | null }) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_activimetro_procedures (code, name, responsible, bibliography)
    VALUES (${input.code}, ${input.name}, ${input.responsible ?? null}, ${input.bibliography ?? null})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING *;`;
  return rows[0];
}

/**
 * Crea una nueva version del procedimiento. La version anterior NUNCA se
 * elimina: se marca is_current = false y se conserva integra (seccion 40:
 * nunca sobrescribir una version anterior; cada prueba historica conserva
 * la version utilizada en su ejecucion via el campo procedure_version).
 */
export async function createActivimetroProcedureVersion(input: {
  procedure_id: number;
  version: string;
  effective_date?: string | null;
  review_date?: string | null;
  document_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
}) {
  await ensureActivimetroArchitectureTables();
  await sql`UPDATE qc_activimetro_procedure_versions SET is_current = false WHERE procedure_id = ${input.procedure_id};`;
  const { rows } = await sql`INSERT INTO qc_activimetro_procedure_versions (procedure_id, version, effective_date, review_date, is_current, document_url, notes, created_by)
    VALUES (${input.procedure_id}, ${input.version}, ${input.effective_date ?? new Date().toISOString().slice(0, 10)}, ${input.review_date ?? null}, true, ${input.document_url ?? null}, ${input.notes ?? null}, ${input.created_by ?? null})
    ON CONFLICT (procedure_id, version) DO UPDATE SET is_current = true
    RETURNING *;`;
  return rows[0];
}

// ---------- Baseline historico ----------

/**
 * Establece un nuevo baseline para (equipo, prueba, parametro). El baseline
 * anterior NUNCA se elimina: se marca is_current = false y se conserva
 * enlazado via previous_baseline_id, junto con motivo y usuario del cambio
 * (seccion 28: si se modifica, registrar motivo, usuario y fecha, y
 * mantener el baseline anterior).
 */
export async function setActivimetroBaseline(input: {
  equipment_id: number | null;
  test_code: string;
  parameter_name: string;
  value: number | null;
  unit?: string | null;
  radionuclide?: string | null;
  geometry?: string | null;
  operator?: string | null;
  physicist_responsible?: string | null;
  change_reason?: string | null;
  changed_by?: string | null;
}) {
  await ensureActivimetroArchitectureTables();

  const { rows: currentRows } = await sql`SELECT id FROM qc_activimetro_baseline WHERE test_code = ${input.test_code} AND parameter_name = ${input.parameter_name} AND is_current = true AND (equipment_id = ${input.equipment_id} OR (equipment_id IS NULL AND ${input.equipment_id} IS NULL));`;
  const previousId = currentRows[0]?.id ?? null;

  if (previousId) {
    await sql`UPDATE qc_activimetro_baseline SET is_current = false WHERE id = ${previousId};`;
  }

  const { rows } = await sql`INSERT INTO qc_activimetro_baseline (equipment_id, test_code, parameter_name, value, unit, radionuclide, geometry, operator, physicist_responsible, is_current, previous_baseline_id, change_reason, changed_by)
    VALUES (${input.equipment_id}, ${input.test_code}, ${input.parameter_name}, ${input.value}, ${input.unit ?? null}, ${input.radionuclide ?? null}, ${input.geometry ?? null}, ${input.operator ?? null}, ${input.physicist_responsible ?? null}, true, ${previousId}, ${input.change_reason ?? null}, ${input.changed_by ?? null})
    RETURNING *;`;

  if (previousId) {
    await recordActivimetroAuditLog({
      entity_type: 'qc_activimetro_baseline',
      entity_id: rows[0]!.id,
      action: 'update_baseline',
      field_name: input.parameter_name,
      old_value: null,
      new_value: String(input.value),
      change_reason: input.change_reason ?? null,
      changed_by: input.changed_by ?? null,
    });
  }

  return rows[0];
}

export async function getCurrentActivimetroBaseline(equipmentId: number | null, testCode: string, parameterName: string) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_baseline WHERE test_code = ${testCode} AND parameter_name = ${parameterName} AND is_current = true AND (equipment_id = ${equipmentId} OR (equipment_id IS NULL AND ${equipmentId} IS NULL)) LIMIT 1;`;
  return rows[0] ?? null;
}

export async function listActivimetroBaselineHistory(equipmentId: number | null, testCode: string, parameterName: string) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_baseline WHERE test_code = ${testCode} AND parameter_name = ${parameterName} AND (equipment_id = ${equipmentId} OR (equipment_id IS NULL AND ${equipmentId} IS NULL)) ORDER BY created_at DESC;`;
  return rows;
}

// ---------- Eventos de servicio tecnico (post-servicio) ----------

/**
 * Registra una intervencion tecnica (seccion 30). tests_required se calcula
 * a partir del catalogo (freq_post_service = true) salvo que se indique una
 * lista explicita; el sistema solo lista las pruebas correspondientes, no
 * decide automaticamente resultados clinicos ni de mantenimiento.
 */
export async function createActivimetroServiceEvent(input: {
  equipment_id: number | null;
  service_type: string;
  component_affected?: string | null;
  service_date: string;
  technician?: string | null;
  company?: string | null;
  work_order_number?: string | null;
  description?: string | null;
  tests_required?: string[] | null;
  created_by?: string | null;
}) {
  await ensureActivimetroArchitectureTables();

  let testsRequired = input.tests_required ?? null;
  if (!testsRequired) {
    const { rows } = await sql`SELECT test_code FROM qc_activimetro_test_catalog WHERE freq_post_service = true AND active = true;`;
    testsRequired = rows.map((r) => (r as { test_code: string }).test_code);
  }

  const { rows } = await sql`INSERT INTO qc_activimetro_service_events (equipment_id, service_type, component_affected, service_date, technician, company, work_order_number, description, tests_required, created_by)
    VALUES (${input.equipment_id}, ${input.service_type}, ${input.component_affected ?? null}, ${input.service_date}, ${input.technician ?? null}, ${input.company ?? null}, ${input.work_order_number ?? null}, ${input.description ?? null}, ${JSON.stringify(testsRequired)}, ${input.created_by ?? null})
    RETURNING *;`;
  return rows[0];
}

export async function listActivimetroServiceEvents(equipmentId?: number) {
  await ensureActivimetroArchitectureTables();
  const { rows } = equipmentId
    ? await sql`SELECT * FROM qc_activimetro_service_events WHERE equipment_id = ${equipmentId} ORDER BY service_date DESC;`
    : await sql`SELECT * FROM qc_activimetro_service_events ORDER BY service_date DESC;`;
  return rows;
}

export async function updateActivimetroServiceEventStatus(id: number, status: string, testsCompleted?: string[]) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`UPDATE qc_activimetro_service_events SET status = ${status}, tests_completed = COALESCE(${testsCompleted ? JSON.stringify(testsCompleted) : null}, tests_completed), updated_at = now() WHERE id = ${id} RETURNING *;`;
  return rows[0] ?? null;
}

// ---------- Evidencia ----------

export async function addActivimetroEvidence(input: {
  test_id?: number | null;
  equipment_id?: number | null;
  evidence_type: string;
  file_name?: string | null;
  file_url?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
}) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_activimetro_evidence (test_id, equipment_id, evidence_type, file_name, file_url, description, uploaded_by)
    VALUES (${input.test_id ?? null}, ${input.equipment_id ?? null}, ${input.evidence_type}, ${input.file_name ?? null}, ${input.file_url ?? null}, ${input.description ?? null}, ${input.uploaded_by ?? null})
    RETURNING *;`;
  return rows[0];
}

export async function listActivimetroEvidence(testId?: number, equipmentId?: number) {
  await ensureActivimetroArchitectureTables();
  if (testId) {
    const { rows } = await sql`SELECT * FROM qc_activimetro_evidence WHERE test_id = ${testId} ORDER BY uploaded_at DESC;`;
    return rows;
  }
  if (equipmentId) {
    const { rows } = await sql`SELECT * FROM qc_activimetro_evidence WHERE equipment_id = ${equipmentId} ORDER BY uploaded_at DESC;`;
    return rows;
  }
  const { rows } = await sql`SELECT * FROM qc_activimetro_evidence ORDER BY uploaded_at DESC LIMIT 200;`;
  return rows;
}

// ---------- Auditoria ----------

export async function recordActivimetroAuditLog(input: {
  entity_type: string;
  entity_id: number;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  change_reason?: string | null;
  changed_by?: string | null;
}) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_activimetro_audit_log (entity_type, entity_id, action, field_name, old_value, new_value, change_reason, changed_by)
    VALUES (${input.entity_type}, ${input.entity_id}, ${input.action}, ${input.field_name ?? null}, ${input.old_value ?? null}, ${input.new_value ?? null}, ${input.change_reason ?? null}, ${input.changed_by ?? null})
    RETURNING *;`;
  return rows[0];
}

export async function listActivimetroAuditLog(entityType: string, entityId: number) {
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_audit_log WHERE entity_type = ${entityType} AND entity_id = ${entityId} ORDER BY changed_at DESC;`;
  return rows;
}
