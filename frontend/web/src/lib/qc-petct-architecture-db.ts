import { sql } from "@/lib/db";

/**
 * MODULO 4 - PET/CT - FASE A: ARQUITECTURA
 * Infraestructura de soporte para el sistema profesional de QA/QC PET/CT
 * (Prompt de mejora Modulo 4): catalogo configurable de pruebas, baseline
 * del equipo con control de cambios, eventos de servicio tecnico (control
 * post-servicio), evidencia grafica asociada a un control, y bitacora de
 * auditoria generica.
 *
 * Principios aplicados:
 * - El catalogo de pruebas (secciones 4 y 25 del prompt) es DATOS, no
 *   codigo: agregar una prueba nueva o cambiar su frecuencia no requiere
 *   modificar el motor de calculo, solo esta tabla. Las Fases B/C/D
 *   implementaran el formulario y calculo especifico de cada prueba
 *   listada aqui (columna implemented indica si ya existe la pantalla).
 * - El baseline (secciones 27-28) nunca se sobrescribe: al establecer un
 *   nuevo baseline se marca el anterior como no vigente y se conserva,
 *   enlazado mediante previous_baseline_id, con motivo y usuario del
 *   cambio.
 * - Los eventos de servicio (seccion 26) registran que pruebas de QC
 *   corresponde repetir tras una intervencion tecnica; el sistema no
 *   decide automaticamente resultados clinicos, solo lista las pruebas
 *   requeridas segun el catalogo.
 * - La evidencia (seccion 23) referencia opcionalmente un test_id o un
 *   equipment_id; el archivo en si se administra fuera de esta tabla
 *   (almacenamiento de blobs), aqui solo se guarda la referencia/URL y los
 *   metadatos.
 * - La bitacora de auditoria (secciones 33-34) es generica y reutilizable
 *   por cualquier entidad de PET/CT (equipo, baseline, prueba, catalogo).
 */

let ensured = false;

export type PetCtTestCatalogEntry = {
  id: number;
  test_code: string;
  test_name: string;
  modality: string;
  objective: string | null;
  responsible_level: string;
  freq_acceptance: boolean;
  freq_daily: boolean;
  freq_weekly: boolean;
  freq_monthly: boolean;
  freq_quarterly: boolean;
  freq_annual: boolean;
  freq_post_service: boolean;
  material_required: string | null;
  radionuclide: string | null;
  activity_required: string | null;
  acquisition_protocol: string | null;
  reconstruction_protocol: string | null;
  formula: string | null;
  reference_value: string | null;
  tolerance_description: string | null;
  action_level_description: string | null;
  corrective_action: string | null;
  reference_bibliography: string;
  requires_tof: boolean;
  implemented: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function ensurePetCtArchitectureTables() {
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_test_catalog (
      id SERIAL PRIMARY KEY,
      test_code TEXT NOT NULL UNIQUE,
      test_name TEXT NOT NULL,
      modality TEXT NOT NULL,
      objective TEXT,
      responsible_level TEXT NOT NULL DEFAULT 'fisico_medico',
      freq_acceptance BOOLEAN NOT NULL DEFAULT false,
      freq_daily BOOLEAN NOT NULL DEFAULT false,
      freq_weekly BOOLEAN NOT NULL DEFAULT false,
      freq_monthly BOOLEAN NOT NULL DEFAULT false,
      freq_quarterly BOOLEAN NOT NULL DEFAULT false,
      freq_annual BOOLEAN NOT NULL DEFAULT false,
      freq_post_service BOOLEAN NOT NULL DEFAULT false,
      material_required TEXT,
      radionuclide TEXT,
      activity_required TEXT,
      acquisition_protocol TEXT,
      reconstruction_protocol TEXT,
      formula TEXT,
      reference_value TEXT,
      tolerance_description TEXT,
      action_level_description TEXT,
      corrective_action TEXT,
      reference_bibliography TEXT NOT NULL DEFAULT 'IAEA Human Health Series No. 1',
      requires_tof BOOLEAN NOT NULL DEFAULT false,
      implemented BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_baseline (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES petct_equipment(id) ON DELETE SET NULL,
      test_code TEXT NOT NULL,
      parameter_name TEXT NOT NULL,
      value NUMERIC,
      unit TEXT,
      date_established DATE NOT NULL DEFAULT CURRENT_DATE,
      methodology TEXT,
      phantom TEXT,
      activity NUMERIC,
      protocol TEXT,
      reconstruction TEXT,
      operator TEXT,
      physicist_responsible TEXT,
      is_current BOOLEAN NOT NULL DEFAULT true,
      previous_baseline_id INTEGER REFERENCES qc_petct_baseline(id) ON DELETE SET NULL,
      change_reason TEXT,
      changed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_service_events (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES petct_equipment(id) ON DELETE SET NULL,
      service_type TEXT NOT NULL,
      component_affected TEXT,
      service_date DATE NOT NULL,
      technician TEXT,
      work_order_number TEXT,
      description TEXT,
      tests_required JSONB,
      tests_completed JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pendiente',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_evidence (
      id SERIAL PRIMARY KEY,
      test_id INTEGER REFERENCES qc_petct_tests(id) ON DELETE CASCADE,
      equipment_id INTEGER REFERENCES petct_equipment(id) ON DELETE SET NULL,
      evidence_type TEXT NOT NULL,
      file_name TEXT,
      file_url TEXT,
      description TEXT,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_audit_log (
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

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_catalog_modality ON qc_petct_test_catalog(modality, active);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_baseline_lookup ON qc_petct_baseline(equipment_id, test_code, parameter_name, is_current);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_service_equipment ON qc_petct_service_events(equipment_id, status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_evidence_test ON qc_petct_evidence(test_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_evidence_equipment ON qc_petct_evidence(equipment_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_audit_entity ON qc_petct_audit_log(entity_type, entity_id);`;

  await seedTestCatalog();

  ensured = true;
}
/**
 * Catalogo inicial de pruebas PET/CT segun IAEA Human Health Series No. 1.
 * Se insertan solo si no existen (ON CONFLICT DO NOTHING) para no pisar
 * ajustes posteriores del Fisico Medico. 'implemented' = true unicamente
 * para las 2 pruebas ya construidas en Fase 22 (Modulo 4 inicial); el resto
 * queda registrado como pendiente de implementacion de pantalla/calculo en
 * las Fases B/C/D, pero ya disponible como referencia de catalogo, objetivo
 * y bibliografia.
 */
async function seedTestCatalog() {
  const { rows: existing } = await sql`SELECT COUNT(*)::int AS count FROM qc_petct_test_catalog`;
  if (existing[0]?.count > 0) return;

  const entries: Array<Partial<PetCtTestCatalogEntry> & { test_code: string; test_name: string; modality: string }> = [
    { test_code: 'calibracion_cruzada', test_name: 'Calibracion Cruzada (Cross-Calibration)', modality: 'PET', objective: 'Verificar concordancia entre la concentracion de actividad reportada por el PET y la de referencia del activimetro (base de exactitud de SUV).', responsible_level: 'fisico_medico', freq_quarterly: true, implemented: true },
    { test_code: 'uniformidad_imagen', test_name: 'Uniformidad de Imagen PET', modality: 'PET', objective: 'Evaluar uniformidad sobre cortes reconstruidos de un maniqui cilindrico uniforme.', responsible_level: 'fisico_medico', freq_monthly: true, implemented: true },
    { test_code: 'PET-01', test_name: 'Resolucion espacial', modality: 'PET', objective: 'Evaluar la capacidad del sistema PET para resolver estructuras pequenas (FWHM).', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, formula: 'FWHM observada / FWHM esperada', tolerance_description: 'FWHM observada < 1.05 x FWHM esperada' },
    { test_code: 'PET-02', test_name: 'Sensibilidad', modality: 'PET', objective: 'Determinar la sensibilidad del sistema (STOT) y compararla con el valor esperado.', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, formula: 'STOT observada / STOT esperada', tolerance_description: 'STOT observada > 0.95 x STOT esperada' },
    { test_code: 'PET-03', test_name: 'Fraccion de dispersion, perdidas de conteo y randoms (NEC)', modality: 'PET', objective: 'Evaluar scatter fraction, count losses, randoms y NEC en funcion de la actividad.', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, tolerance_description: 'SF observada < 1.05 x SF esperada; NEC observada >= NEC recomendada' },
    { test_code: 'PET-04', test_name: 'Resolucion energetica', modality: 'PET', objective: 'Evaluar la resolucion energetica del sistema de deteccion.', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, formula: 'RE observada / RE esperada', tolerance_description: 'RE observada < 1.05 x RE esperada' },
    { test_code: 'PET-05', test_name: 'Calidad de imagen y exactitud de correccion de atenuacion/dispersion', modality: 'PET', objective: 'Evaluar uniformidad, contraste, recuperacion, artefactos y exactitud de concentracion (esferas).', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, tolerance_description: 'Evaluacion CUMPLE / NO CUMPLE / REQUIERE REVISION segun comportamiento de esferas y comentario tecnico' },
    { test_code: 'PET-06', test_name: 'Coincidencia temporal (TOF)', modality: 'PET', objective: 'Evaluar la resolucion temporal del sistema TOF, cuando el equipo dispone de esta tecnologia.', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, requires_tof: true, formula: 'RT observada / RT esperada', tolerance_description: 'RT observada < 1.05 x RT esperada; NO APLICA si el equipo no dispone de TOF' },
    { test_code: 'PETCT-01', test_name: 'Exactitud del registro PET/CT', modality: 'PETCT', objective: 'Evaluar el error de registro espacial (offset X/Y/Z) entre PET y CT.', responsible_level: 'fisico_medico', freq_acceptance: true, freq_annual: true, freq_post_service: true, tolerance_description: 'Error de registro dentro de +/-1 voxel' },
    { test_code: 'PETCT-02', test_name: 'PET/CT Offset Calibration (X/Y/Z)', modality: 'PETCT', objective: 'Controlar el offset de calibracion entre PET y CT en los tres ejes.', responsible_level: 'fisico_medico', freq_quarterly: true, freq_post_service: true, tolerance_description: 'Comparacion contra resultado anterior, baseline y post-servicio; sin valor universal fijo' },
    { test_code: 'PET-ESTAB', test_name: 'Estabilidad del detector (control rutinario)', modality: 'PET', objective: 'Control rutinario de estabilidad del detector, con posible integracion del resultado automatico del equipo.', responsible_level: 'operador', freq_daily: true },
    { test_code: 'PET-CLINICO', test_name: 'PET/CT scan en modo clinico', modality: 'PETCT', objective: 'Evaluar un estudio adquirido en modo clinico: artefactos, uniformidad, errores de reconstruccion, correccion y fusion.', responsible_level: 'fisico_medico', freq_annual: true },
    { test_code: 'PET-CONC', test_name: 'Concentracion de radioactividad', modality: 'PET', objective: 'Comparar la concentracion medida contra la concentracion conocida (% diferencia); base de la cuantificacion.', responsible_level: 'fisico_medico', freq_quarterly: true },
    { test_code: 'PET-SUV-CAL', test_name: 'Calibracion de concentracion radioactiva / SUV', modality: 'PET', objective: 'Mantener la trazabilidad activimetro <-> PET/CT para la cuantificacion (SUV), segun especificaciones del fabricante.', responsible_level: 'fisico_medico', freq_quarterly: true, freq_post_service: true },
    { test_code: 'PET-QI-RUTINA', test_name: 'Prueba rutinaria de calidad de imagen PET/CT', modality: 'PETCT', objective: 'Adquisicion integrada (aprox. 20 millones de eventos verdaderos) con analisis de uniformidad, concentracion y resolucion espacial.', responsible_level: 'fisico_medico', freq_monthly: true },
    { test_code: 'CT-01', test_name: 'Radiacion dispersa y verificacion de blindaje', modality: 'CT', responsible_level: 'fisico_medico', freq_acceptance: true },
    { test_code: 'CT-02', test_name: 'Alineacion de laser', modality: 'CT', responsible_level: 'opr', freq_daily: true, freq_monthly: true },
    { test_code: 'CT-03', test_name: 'Alineacion de mesa y exactitud posicional', modality: 'CT', responsible_level: 'opr', freq_monthly: true },
    { test_code: 'CT-04', test_name: 'Exactitud del scout view', modality: 'CT', responsible_level: 'opr', freq_monthly: true },
    { test_code: 'CT-05', test_name: 'Inspeccion visual y revision del programa', modality: 'CT', responsible_level: 'operador', freq_daily: true },
    { test_code: 'CT-06', test_name: 'Perfil y ancho del corte (slice)', modality: 'CT', responsible_level: 'fisico_medico', freq_annual: true },
    { test_code: 'CT-07', test_name: 'Modulacion de alto contraste', modality: 'CT', responsible_level: 'fisico_medico', freq_annual: true },
    { test_code: 'CT-08', test_name: 'kVp y HVL', modality: 'CT', responsible_level: 'fisico_medico', freq_annual: true },
    { test_code: 'CT-09', test_name: 'Dosis (CTDIvol / DLP)', modality: 'CT', responsible_level: 'fisico_medico', freq_annual: true, freq_post_service: true },
    { test_code: 'CT-10', test_name: 'Ruido', modality: 'CT', responsible_level: 'fisico_medico', freq_monthly: true },
    { test_code: 'CT-11', test_name: 'Uniformidad', modality: 'CT', responsible_level: 'fisico_medico', freq_monthly: true },
    { test_code: 'CT-12', test_name: 'Artefactos', modality: 'CT', responsible_level: 'operador', freq_daily: true },
    { test_code: 'CT-13', test_name: 'Numero CT', modality: 'CT', responsible_level: 'fisico_medico', freq_monthly: true },
    { test_code: 'CT-14', test_name: 'Exactitud de densidad electronica', modality: 'CT', responsible_level: 'fisico_medico', freq_annual: true, notes: 'Cuando corresponda (uso en planificacion de radioterapia)' } as unknown as Partial<PetCtTestCatalogEntry> & { test_code: string; test_name: string; modality: string },
  ];

  for (const e of entries) {
    await sql`INSERT INTO qc_petct_test_catalog
        (test_code, test_name, modality, objective, responsible_level, freq_acceptance, freq_daily, freq_weekly, freq_monthly, freq_quarterly, freq_annual, freq_post_service, formula, tolerance_description, requires_tof, implemented)
      VALUES
        (${e.test_code}, ${e.test_name}, ${e.modality}, ${e.objective ?? null}, ${e.responsible_level ?? 'fisico_medico'}, ${e.freq_acceptance ?? false}, ${e.freq_daily ?? false}, ${e.freq_weekly ?? false}, ${e.freq_monthly ?? false}, ${e.freq_quarterly ?? false}, ${e.freq_annual ?? false}, ${e.freq_post_service ?? false}, ${e.formula ?? null}, ${e.tolerance_description ?? null}, ${e.requires_tof ?? false}, ${e.implemented ?? false})
      ON CONFLICT (test_code) DO NOTHING;`;
  }
}

export async function listTestCatalog(modality?: string): Promise<PetCtTestCatalogEntry[]> {
  await ensurePetCtArchitectureTables();
  const { rows } = modality
    ? await sql`SELECT * FROM qc_petct_test_catalog WHERE active = true AND modality = ${modality} ORDER BY test_code;`
    : await sql`SELECT * FROM qc_petct_test_catalog WHERE active = true ORDER BY test_code;`;
  return rows as PetCtTestCatalogEntry[];
}

export async function getTestCatalogByCode(code: string): Promise<PetCtTestCatalogEntry | null> {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_petct_test_catalog WHERE test_code = ${code};`;
  return (rows[0] as PetCtTestCatalogEntry) ?? null;
}

/**
 * Establece un nuevo baseline para (equipo, prueba, parametro). El baseline
 * anterior NUNCA se elimina: se marca is_current = false y se conserva
 * enlazado via previous_baseline_id, junto con motivo y usuario del cambio
 * (seccion 28 del prompt: 'Si se modifica: registrar motivo; registrar
 * usuario; registrar fecha; mantener baseline anterior').
 */
export async function setPetCtBaseline(input: {
  equipment_id: number | null;
  test_code: string;
  parameter_name: string;
  value: number | null;
  unit?: string | null;
  methodology?: string | null;
  phantom?: string | null;
  activity?: number | null;
  protocol?: string | null;
  reconstruction?: string | null;
  operator?: string | null;
  physicist_responsible?: string | null;
  change_reason?: string | null;
  changed_by?: string | null;
}) {
  await ensurePetCtArchitectureTables();

  const { rows: currentRows } = await sql`SELECT id FROM qc_petct_baseline WHERE test_code = ${input.test_code} AND parameter_name = ${input.parameter_name} AND is_current = true AND (equipment_id = ${input.equipment_id} OR (equipment_id IS NULL AND ${input.equipment_id} IS NULL));`;
  const previousId = currentRows[0]?.id ?? null;

  if (previousId) {
    await sql`UPDATE qc_petct_baseline SET is_current = false WHERE id = ${previousId};`;
  }

  const { rows } = await sql`INSERT INTO qc_petct_baseline (equipment_id, test_code, parameter_name, value, unit, methodology, phantom, activity, protocol, reconstruction, operator, physicist_responsible, is_current, previous_baseline_id, change_reason, changed_by) VALUES (${input.equipment_id}, ${input.test_code}, ${input.parameter_name}, ${input.value}, ${input.unit ?? null}, ${input.methodology ?? null}, ${input.phantom ?? null}, ${input.activity ?? null}, ${input.protocol ?? null}, ${input.reconstruction ?? null}, ${input.operator ?? null}, ${input.physicist_responsible ?? null}, true, ${previousId}, ${input.change_reason ?? null}, ${input.changed_by ?? null}) RETURNING *;`;

  if (previousId) {
    await recordAuditLog({
      entity_type: 'qc_petct_baseline',
      entity_id: rows[0].id,
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

export async function getCurrentBaseline(equipmentId: number | null, testCode: string, parameterName: string) {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_petct_baseline WHERE test_code = ${testCode} AND parameter_name = ${parameterName} AND is_current = true AND (equipment_id = ${equipmentId} OR (equipment_id IS NULL AND ${equipmentId} IS NULL)) LIMIT 1;`;
  return rows[0] ?? null;
}

export async function listBaselineHistory(equipmentId: number | null, testCode: string, parameterName: string) {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_petct_baseline WHERE test_code = ${testCode} AND parameter_name = ${parameterName} AND (equipment_id = ${equipmentId} OR (equipment_id IS NULL AND ${equipmentId} IS NULL)) ORDER BY created_at DESC;`;
  return rows;
}

/**
 * Registra una intervencion tecnica (seccion 26). tests_required se calcula
 * a partir del catalogo (freq_post_service = true) salvo que se indique una
 * lista explicita; el sistema solo lista las pruebas correspondientes, no
 * decide automaticamente resultados clinicos ni de mantenimiento.
 */
export async function createServiceEvent(input: {
  equipment_id: number | null;
  service_type: string;
  component_affected?: string | null;
  service_date: string;
  technician?: string | null;
  work_order_number?: string | null;
  description?: string | null;
  tests_required?: string[] | null;
  created_by?: string | null;
}) {
  await ensurePetCtArchitectureTables();

  let testsRequired = input.tests_required ?? null;
  if (!testsRequired) {
    const { rows } = await sql`SELECT test_code FROM qc_petct_test_catalog WHERE freq_post_service = true AND active = true;`;
    testsRequired = rows.map((r: { test_code: string }) => r.test_code);
  }

  const { rows } = await sql`INSERT INTO qc_petct_service_events (equipment_id, service_type, component_affected, service_date, technician, work_order_number, description, tests_required, created_by) VALUES (${input.equipment_id}, ${input.service_type}, ${input.component_affected ?? null}, ${input.service_date}, ${input.technician ?? null}, ${input.work_order_number ?? null}, ${input.description ?? null}, ${JSON.stringify(testsRequired)}, ${input.created_by ?? null}) RETURNING *;`;
  return rows[0];
}

export async function listServiceEvents(equipmentId?: number) {
  await ensurePetCtArchitectureTables();
  const { rows } = equipmentId
    ? await sql`SELECT * FROM qc_petct_service_events WHERE equipment_id = ${equipmentId} ORDER BY service_date DESC;`
    : await sql`SELECT * FROM qc_petct_service_events ORDER BY service_date DESC;`;
  return rows;
}

export async function updateServiceEventStatus(id: number, status: string, testsCompleted?: string[]) {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`UPDATE qc_petct_service_events SET status = ${status}, tests_completed = COALESCE(${testsCompleted ? JSON.stringify(testsCompleted) : null}, tests_completed), updated_at = now() WHERE id = ${id} RETURNING *;`;
  return rows[0] ?? null;
}

export async function addEvidence(input: {
  test_id?: number | null;
  equipment_id?: number | null;
  evidence_type: string;
  file_name?: string | null;
  file_url?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
}) {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_petct_evidence (test_id, equipment_id, evidence_type, file_name, file_url, description, uploaded_by) VALUES (${input.test_id ?? null}, ${input.equipment_id ?? null}, ${input.evidence_type}, ${input.file_name ?? null}, ${input.file_url ?? null}, ${input.description ?? null}, ${input.uploaded_by ?? null}) RETURNING *;`;
  return rows[0];
}

export async function listEvidence(testId?: number, equipmentId?: number) {
  await ensurePetCtArchitectureTables();
  if (testId) {
    const { rows } = await sql`SELECT * FROM qc_petct_evidence WHERE test_id = ${testId} ORDER BY uploaded_at DESC;`;
    return rows;
  }
  if (equipmentId) {
    const { rows } = await sql`SELECT * FROM qc_petct_evidence WHERE equipment_id = ${equipmentId} ORDER BY uploaded_at DESC;`;
    return rows;
  }
  const { rows } = await sql`SELECT * FROM qc_petct_evidence ORDER BY uploaded_at DESC LIMIT 200;`;
  return rows;
}

export async function recordAuditLog(input: {
  entity_type: string;
  entity_id: number;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  change_reason?: string | null;
  changed_by?: string | null;
}) {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`INSERT INTO qc_petct_audit_log (entity_type, entity_id, action, field_name, old_value, new_value, change_reason, changed_by) VALUES (${input.entity_type}, ${input.entity_id}, ${input.action}, ${input.field_name ?? null}, ${input.old_value ?? null}, ${input.new_value ?? null}, ${input.change_reason ?? null}, ${input.changed_by ?? null}) RETURNING *;`;
  return rows[0];
}

export async function listAuditLog(entityType: string, entityId: number) {
  await ensurePetCtArchitectureTables();
  const { rows } = await sql`SELECT * FROM qc_petct_audit_log WHERE entity_type = ${entityType} AND entity_id = ${entityId} ORDER BY changed_at DESC;`;
  return rows;
}
