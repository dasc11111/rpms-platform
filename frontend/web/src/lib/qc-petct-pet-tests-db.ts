import { sql } from "@/lib/db";

/**
 * MODULO 4 - PET/CT - FASE B: PRUEBAS PET (PET-01 a PET-06)
 * Registro de resultados de las pruebas de aceptacion y control de calidad
 * PET descritas en la seccion 5 del prompt de mejora (IAEA Human Health
 * Series No. 1). Una sola tabla para las 6 pruebas: cada prueba tiene
 * campos especificos de entrada/calculo distintos, por lo que se guardan en
 * columnas JSONB (raw_inputs / calculated) en vez de crear 6 tablas
 * separadas; los campos comunes (equipo, fecha, operador, phantom,
 * radionuclido, actividad, protocolo) si son columnas propias para permitir
 * filtros y reportes.
 *
 * Trazabilidad y correccion de errores (secciones 33-34 del prompt):
 * - Mientras el registro no esta finalizado (is_finalized = false) se
 *   considera borrador y puede editarse en el mismo registro.
 * - Una vez finalizado, cualquier correccion crea un NUEVO registro
 *   (supersedes_id apunta al registro anterior) con motivo y usuario de la
 *   edicion; el registro finalizado original NUNCA se modifica ni se
 *   elimina. Se registra en la bitacora de auditoria comun del modulo
 *   (qc_petct_audit_log, definida en qc-petct-architecture-db.ts).
 */

let ensured = false;

export type PetTestCode = "PET-01" | "PET-02" | "PET-03" | "PET-04" | "PET-05" | "PET-06" | "PET-ESTAB" | "PET-CONC" | "PET-SUV-CAL";

export type PetTestRecord = {
  id: number;
  equipment_id: number | null;
  test_code: PetTestCode;
  performed_at: string;
  operator: string;
  physicist_reviewed_by: string | null;
  phantom: string | null;
  radionuclide: string | null;
  activity_mbq: number | null;
  activity_datetime: string | null;
  protocol_acquisition: string | null;
  protocol_reconstruction: string | null;
  reconstruction_filter: string | null;
  iterations: number | null;
  subsets: number | null;
  matrix_size: string | null;
  voxel_mm: string | null;
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments: string | null;
  corrective_action: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  supersedes_id: number | null;
  edit_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensurePetTestsTables() {
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_pet_tests (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES petct_equipment(id) ON DELETE SET NULL,
    test_code TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operator TEXT NOT NULL,
    physicist_reviewed_by TEXT,
    phantom TEXT,
    radionuclide TEXT,
    activity_mbq NUMERIC,
    activity_datetime TIMESTAMPTZ,
    protocol_acquisition TEXT,
    protocol_reconstruction TEXT,
    reconstruction_filter TEXT,
    iterations INTEGER,
    subsets INTEGER,
    matrix_size TEXT,
    voxel_mm TEXT,
    raw_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'requiere_revision',
    action_level TEXT NOT NULL DEFAULT 'normal',
    comments TEXT,
    corrective_action TEXT,
    is_finalized BOOLEAN NOT NULL DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by TEXT,
    supersedes_id INTEGER REFERENCES qc_petct_pet_tests(id) ON DELETE SET NULL,
    edit_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_pet_tests_equipment ON qc_petct_pet_tests(equipment_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_pet_tests_code ON qc_petct_pet_tests(test_code, performed_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_pet_tests_supersedes ON qc_petct_pet_tests(supersedes_id);`;

  ensured = true;
}

export type CreatePetTestInput = {
  equipment_id: number | null;
  test_code: PetTestCode;
  performed_at?: string | null;
  operator: string;
  physicist_reviewed_by?: string | null;
  phantom?: string | null;
  radionuclide?: string | null;
  activity_mbq?: number | null;
  activity_datetime?: string | null;
  protocol_acquisition?: string | null;
  protocol_reconstruction?: string | null;
  reconstruction_filter?: string | null;
  iterations?: number | null;
  subsets?: number | null;
  matrix_size?: string | null;
  voxel_mm?: string | null;
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments?: string | null;
  corrective_action?: string | null;
  supersedes_id?: number | null;
  edit_reason?: string | null;
  created_by?: string | null;
};

export async function createPetTest(input: CreatePetTestInput): Promise<PetTestRecord> {
  await ensurePetTestsTables();
  const { rows } = await sql`INSERT INTO qc_petct_pet_tests (
    equipment_id, test_code, performed_at, operator, physicist_reviewed_by, phantom, radionuclide,
    activity_mbq, activity_datetime, protocol_acquisition, protocol_reconstruction,
    reconstruction_filter, iterations, subsets, matrix_size, voxel_mm,
    raw_inputs, calculated, status, action_level, comments, corrective_action,
    supersedes_id, edit_reason, created_by
  ) VALUES (
    ${input.equipment_id ?? null}, ${input.test_code}, ${input.performed_at ?? new Date().toISOString()},
    ${input.operator}, ${input.physicist_reviewed_by ?? null}, ${input.phantom ?? null}, ${input.radionuclide ?? null},
    ${input.activity_mbq ?? null}, ${input.activity_datetime ?? null},
    ${input.protocol_acquisition ?? null}, ${input.protocol_reconstruction ?? null},
    ${input.reconstruction_filter ?? null}, ${input.iterations ?? null}, ${input.subsets ?? null},
    ${input.matrix_size ?? null}, ${input.voxel_mm ?? null},
    ${JSON.stringify(input.raw_inputs)}::jsonb, ${JSON.stringify(input.calculated)}::jsonb,
    ${input.status}, ${input.action_level}, ${input.comments ?? null}, ${input.corrective_action ?? null},
    ${input.supersedes_id ?? null}, ${input.edit_reason ?? null}, ${input.created_by ?? null}
  ) RETURNING *;`;
  return rows[0] as PetTestRecord;
}

export async function listPetTests(filters: { equipment_id?: number; test_code?: PetTestCode } = {}): Promise<PetTestRecord[]> {
  await ensurePetTestsTables();
  if (filters.equipment_id && filters.test_code) {
    const { rows } = await sql`SELECT * FROM qc_petct_pet_tests WHERE equipment_id = ${filters.equipment_id} AND test_code = ${filters.test_code} ORDER BY performed_at DESC;`;
    return rows as PetTestRecord[];
  }
  if (filters.equipment_id) {
    const { rows } = await sql`SELECT * FROM qc_petct_pet_tests WHERE equipment_id = ${filters.equipment_id} ORDER BY performed_at DESC;`;
    return rows as PetTestRecord[];
  }
  if (filters.test_code) {
    const { rows } = await sql`SELECT * FROM qc_petct_pet_tests WHERE test_code = ${filters.test_code} ORDER BY performed_at DESC;`;
    return rows as PetTestRecord[];
  }
  const { rows } = await sql`SELECT * FROM qc_petct_pet_tests ORDER BY performed_at DESC LIMIT 500;`;
  return rows as PetTestRecord[];
}

export async function getPetTestById(id: number): Promise<PetTestRecord | null> {
  await ensurePetTestsTables();
  const { rows } = await sql`SELECT * FROM qc_petct_pet_tests WHERE id = ${id};`;
  return (rows[0] as PetTestRecord) ?? null;
}

/**
 * Devuelve, siguiendo supersedes_id, la cadena de versiones de un control
 * (original + correcciones posteriores). Se usa para mostrar en el
 * historial la version vigente sin ocultar las anteriores.
 */
export async function listVersionChain(rootId: number): Promise<PetTestRecord[]> {
  await ensurePetTestsTables();
  const chain: PetTestRecord[] = [];
  let currentId: number | null = rootId;
  const visited = new Set<number>();
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const record = await getPetTestById(currentId);
    if (!record) break;
    chain.push(record);
    const { rows }: { rows: Array<{ id: number }> } = await sql`SELECT id FROM qc_petct_pet_tests WHERE supersedes_id = ${currentId} LIMIT 1;`;
    currentId = (rows[0]?.id as number | undefined) ?? null;
  }
  return chain;
}

export async function finalizePetTest(id: number, finalizedBy: string): Promise<PetTestRecord | null> {
  await ensurePetTestsTables();
  const { rows } = await sql`UPDATE qc_petct_pet_tests SET is_finalized = true, finalized_at = now(), finalized_by = ${finalizedBy}, updated_at = now() WHERE id = ${id} AND is_finalized = false RETURNING *;`;
  return (rows[0] as PetTestRecord) ?? null;
}

export type UpdateDraftPetTestInput = {
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments?: string | null;
  corrective_action?: string | null;
  operator?: string;
  phantom?: string | null;
  radionuclide?: string | null;
  activity_mbq?: number | null;
  activity_datetime?: string | null;
};

/** Solo permitido mientras is_finalized = false (verificar antes de llamar). */
export async function updateDraftPetTest(id: number, patch: UpdateDraftPetTestInput): Promise<PetTestRecord | null> {
  await ensurePetTestsTables();
  const { rows } = await sql`UPDATE qc_petct_pet_tests SET
    raw_inputs = ${JSON.stringify(patch.raw_inputs)}::jsonb,
    calculated = ${JSON.stringify(patch.calculated)}::jsonb,
    status = ${patch.status},
    action_level = ${patch.action_level},
    comments = ${patch.comments ?? null},
    corrective_action = ${patch.corrective_action ?? null},
    operator = COALESCE(${patch.operator ?? null}, operator),
    phantom = COALESCE(${patch.phantom ?? null}, phantom),
    radionuclide = COALESCE(${patch.radionuclide ?? null}, radionuclide),
    activity_mbq = COALESCE(${patch.activity_mbq ?? null}, activity_mbq),
    activity_datetime = COALESCE(${patch.activity_datetime ?? null}, activity_datetime),
    updated_at = now()
  WHERE id = ${id} AND is_finalized = false
  RETURNING *;`;
  return (rows[0] as PetTestRecord) ?? null;
}

/**
 * Corrige un registro YA finalizado (seccion 33 del prompt): nunca se
 * modifica el registro original. Se crea una nueva fila con
 * supersedes_id = id del registro corregido, copiando los campos que no
 * cambian y aplicando el patch sobre los que si cambian. Requiere motivo y
 * usuario de la edicion.
 */
export async function createCorrectedVersion(
  originalId: number,
  patch: Partial<CreatePetTestInput>,
  editReason: string,
  editedBy: string
): Promise<PetTestRecord | null> {
  await ensurePetTestsTables();
  const original = await getPetTestById(originalId);
  if (!original) return null;

  const merged: CreatePetTestInput = {
    equipment_id: patch.equipment_id ?? original.equipment_id,
    test_code: (patch.test_code ?? original.test_code) as PetTestCode,
    performed_at: patch.performed_at ?? original.performed_at,
    operator: patch.operator ?? original.operator,
    physicist_reviewed_by: patch.physicist_reviewed_by ?? original.physicist_reviewed_by,
    phantom: patch.phantom ?? original.phantom,
    radionuclide: patch.radionuclide ?? original.radionuclide,
    activity_mbq: patch.activity_mbq ?? original.activity_mbq,
    activity_datetime: patch.activity_datetime ?? original.activity_datetime,
    protocol_acquisition: patch.protocol_acquisition ?? original.protocol_acquisition,
    protocol_reconstruction: patch.protocol_reconstruction ?? original.protocol_reconstruction,
    reconstruction_filter: patch.reconstruction_filter ?? original.reconstruction_filter,
    iterations: patch.iterations ?? original.iterations,
    subsets: patch.subsets ?? original.subsets,
    matrix_size: patch.matrix_size ?? original.matrix_size,
    voxel_mm: patch.voxel_mm ?? original.voxel_mm,
    raw_inputs: patch.raw_inputs ?? original.raw_inputs,
    calculated: patch.calculated ?? original.calculated,
    status: patch.status ?? original.status,
    action_level: patch.action_level ?? original.action_level,
    comments: patch.comments ?? original.comments,
    corrective_action: patch.corrective_action ?? original.corrective_action,
    supersedes_id: originalId,
    edit_reason: editReason,
    created_by: editedBy,
  };

  const created = await createPetTest(merged);

  const { recordAuditLog } = await import("@/lib/qc-petct-architecture-db");
  await recordAuditLog({
    entity_type: "qc_petct_pet_tests",
    entity_id: created.id,
    action: "correccion_registro_finalizado",
    field_name: null,
    old_value: `registro #${originalId}`,
    new_value: `registro #${created.id}`,
    change_reason: editReason,
    changed_by: editedBy,
  });

  return created;
}
