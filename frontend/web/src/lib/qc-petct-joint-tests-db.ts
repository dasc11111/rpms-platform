import { sql } from "@/lib/db";

/**
 * MODULO 4 - PET/CT - FASE D: PRUEBAS DE INTERACCION PET/CT (PETCT-01 y PETCT-02)
 * Registro de resultados de las pruebas que evaluan la interaccion entre el
 * componente PET y el componente CT del equipo hibrido (seccion 2, categoria
 * C del prompt de mejora: PET/CT - interaccion entre ambos). Estas
 * pruebas NO deben mezclarse con las tablas propias de PET (Fase B) ni de
 * CT (Fase C), aunque reutilizan el mismo motor de calculo y el mismo
 * patron de columnas comunes + raw_inputs/calculated en JSONB.
 *
 * PETCT-01: Exactitud del registro PET/CT (seccion 6 del prompt). Evalua el
 * desplazamiento X/Y/Z entre PET y CT expresado en voxels.
 * PETCT-02: PET/CT Offset Calibration X/Y/Z (seccion 14 del prompt). Debe
 * mantener historico y compararse automaticamente contra el resultado
 * anterior y el baseline del equipo (secciones 27-28); esta comparacion se
 * realiza en el motor de calculo (qc-petct-calc.ts) a partir de los valores
 * previos que la API adjunta como parte de raw_inputs antes de calcular.
 *
 * Trazabilidad y correccion de errores (secciones 33-34): mismo mecanismo
 * que qc_petct_pet_tests / qc_petct_ct_tests (borrador editable mientras
 * is_finalized = false; corregir un registro finalizado crea una fila
 * nueva con supersedes_id, el original nunca se modifica ni se elimina).
 */

let ensured = false;

export type JointTestCode = "PETCT-01" | "PETCT-02" | "PET-CLINICO" | "PET-QI-RUTINA";

export type JointTestRecord = {
  id: number;
  equipment_id: number | null;
  test_code: JointTestCode;
  performed_at: string;
  operator: string;
  physicist_reviewed_by: string | null;
  phantom: string | null;
  protocol: string | null;
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

export async function ensureJointTestsTables() {
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_joint_tests (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES petct_equipment(id) ON DELETE SET NULL,
    test_code TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operator TEXT NOT NULL,
    physicist_reviewed_by TEXT,
    phantom TEXT,
    protocol TEXT,
    raw_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'requiere_revision',
    action_level TEXT NOT NULL DEFAULT 'normal',
    comments TEXT,
    corrective_action TEXT,
    is_finalized BOOLEAN NOT NULL DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by TEXT,
    supersedes_id INTEGER REFERENCES qc_petct_joint_tests(id) ON DELETE SET NULL,
    edit_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_joint_tests_equipment ON qc_petct_joint_tests(equipment_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_joint_tests_code ON qc_petct_joint_tests(test_code, performed_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_joint_tests_supersedes ON qc_petct_joint_tests(supersedes_id);`;

  ensured = true;
}

export type CreateJointTestInput = {
  equipment_id: number | null;
  test_code: JointTestCode;
  performed_at?: string | null;
  operator: string;
  physicist_reviewed_by?: string | null;
  phantom?: string | null;
  protocol?: string | null;
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

export async function createJointTest(input: CreateJointTestInput): Promise<JointTestRecord> {
  await ensureJointTestsTables();
  const { rows } = await sql`INSERT INTO qc_petct_joint_tests (
    equipment_id, test_code, performed_at, operator, physicist_reviewed_by, phantom, protocol,
    raw_inputs, calculated, status, action_level, comments, corrective_action,
    supersedes_id, edit_reason, created_by
  ) VALUES (
    ${input.equipment_id ?? null}, ${input.test_code}, ${input.performed_at ?? new Date().toISOString()},
    ${input.operator}, ${input.physicist_reviewed_by ?? null}, ${input.phantom ?? null}, ${input.protocol ?? null},
    ${JSON.stringify(input.raw_inputs)}::jsonb, ${JSON.stringify(input.calculated)}::jsonb,
    ${input.status}, ${input.action_level}, ${input.comments ?? null}, ${input.corrective_action ?? null},
    ${input.supersedes_id ?? null}, ${input.edit_reason ?? null}, ${input.created_by ?? null}
  ) RETURNING *;`;
  return rows[0] as JointTestRecord;
}

export async function listJointTests(filters: { equipment_id?: number; test_code?: JointTestCode } = {}): Promise<JointTestRecord[]> {
  await ensureJointTestsTables();
  if (filters.equipment_id && filters.test_code) {
    const { rows } = await sql`SELECT * FROM qc_petct_joint_tests WHERE equipment_id = ${filters.equipment_id} AND test_code = ${filters.test_code} ORDER BY performed_at DESC;`;
    return rows as JointTestRecord[];
  }
  if (filters.equipment_id) {
    const { rows } = await sql`SELECT * FROM qc_petct_joint_tests WHERE equipment_id = ${filters.equipment_id} ORDER BY performed_at DESC;`;
    return rows as JointTestRecord[];
  }
  if (filters.test_code) {
    const { rows } = await sql`SELECT * FROM qc_petct_joint_tests WHERE test_code = ${filters.test_code} ORDER BY performed_at DESC;`;
    return rows as JointTestRecord[];
  }
  const { rows } = await sql`SELECT * FROM qc_petct_joint_tests ORDER BY performed_at DESC LIMIT 500;`;
  return rows as JointTestRecord[];
}

export async function getJointTestById(id: number): Promise<JointTestRecord | null> {
  await ensureJointTestsTables();
  const { rows } = await sql`SELECT * FROM qc_petct_joint_tests WHERE id = ${id};`;
  return (rows[0] as JointTestRecord) ?? null;
}

/**
 * Devuelve, siguiendo supersedes_id, la cadena de versiones de un control
 * (original + correcciones posteriores), igual que en Fase B/C.
 */
export async function listJointVersionChain(rootId: number): Promise<JointTestRecord[]> {
  await ensureJointTestsTables();
  const chain: JointTestRecord[] = [];
  let currentId: number | null = rootId;
  const visited = new Set<number>();
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const record = await getJointTestById(currentId);
    if (!record) break;
    chain.push(record);
    const { rows }: { rows: Array<{ id: number }> } = await sql`SELECT id FROM qc_petct_joint_tests WHERE supersedes_id = ${currentId} LIMIT 1;`;
    currentId = (rows[0]?.id as number | undefined) ?? null;
  }
  return chain;
}

export async function finalizeJointTest(id: number, finalizedBy: string): Promise<JointTestRecord | null> {
  await ensureJointTestsTables();
  const { rows } = await sql`UPDATE qc_petct_joint_tests SET is_finalized = true, finalized_at = now(), finalized_by = ${finalizedBy}, updated_at = now() WHERE id = ${id} AND is_finalized = false RETURNING *;`;
  return (rows[0] as JointTestRecord) ?? null;
}

export type UpdateDraftJointTestInput = {
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments?: string | null;
  corrective_action?: string | null;
  operator?: string;
  phantom?: string | null;
  protocol?: string | null;
};

/** Solo permitido mientras is_finalized = false (verificar antes de llamar). */
export async function updateDraftJointTest(id: number, patch: UpdateDraftJointTestInput): Promise<JointTestRecord | null> {
  await ensureJointTestsTables();
  const { rows } = await sql`UPDATE qc_petct_joint_tests SET
    raw_inputs = ${JSON.stringify(patch.raw_inputs)}::jsonb,
    calculated = ${JSON.stringify(patch.calculated)}::jsonb,
    status = ${patch.status},
    action_level = ${patch.action_level},
    comments = ${patch.comments ?? null},
    corrective_action = ${patch.corrective_action ?? null},
    operator = COALESCE(${patch.operator ?? null}, operator),
    phantom = COALESCE(${patch.phantom ?? null}, phantom),
    protocol = COALESCE(${patch.protocol ?? null}, protocol),
    updated_at = now()
  WHERE id = ${id} AND is_finalized = false
  RETURNING *;`;
  return (rows[0] as JointTestRecord) ?? null;
}

/**
 * Corrige un registro YA finalizado (seccion 33 del prompt): nunca se
 * modifica el registro original. Crea una fila nueva con
 * supersedes_id = id del registro corregido.
 */
export async function createCorrectedJointVersion(
  originalId: number,
  patch: Partial<CreateJointTestInput>,
  editReason: string,
  editedBy: string
): Promise<JointTestRecord | null> {
  await ensureJointTestsTables();
  const original = await getJointTestById(originalId);
  if (!original) return null;

  const merged: CreateJointTestInput = {
    equipment_id: patch.equipment_id ?? original.equipment_id,
    test_code: (patch.test_code ?? original.test_code) as JointTestCode,
    performed_at: patch.performed_at ?? original.performed_at,
    operator: patch.operator ?? original.operator,
    physicist_reviewed_by: patch.physicist_reviewed_by ?? original.physicist_reviewed_by,
    phantom: patch.phantom ?? original.phantom,
    protocol: patch.protocol ?? original.protocol,
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

  const created = await createJointTest(merged);

  const { recordAuditLog } = await import("@/lib/qc-petct-architecture-db");
  await recordAuditLog({
    entity_type: "qc_petct_joint_tests",
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
