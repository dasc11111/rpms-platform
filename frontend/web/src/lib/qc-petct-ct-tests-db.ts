import { sql } from "@/lib/db";

/**
 * MODULO 4 - PET/CT - FASE C: PRUEBAS CT (CT-01 a CT-14)
 * Registro de resultados de las pruebas de control de calidad del
 * componente CT del equipo hibrido, descritas en la seccion 19 del prompt
 * de mejora (IAEA Human Health Series No. 1, tabla de frecuencias CT). El
 * componente CT es independiente del componente PET (seccion 2): esta
 * tabla es propia y NO comparte filas con qc_petct_pet_tests, aunque
 * reutiliza el mismo patron de columnas comunes + raw_inputs/calculated en
 * JSONB, por la misma razon que en Fase B: cada prueba tiene campos de
 * entrada distintos y crear 14 tablas separadas duplicaria la trazabilidad
 * comun (borrador/finalizado/correccion de errores).
 *
 * Trazabilidad y correccion de errores (secciones 33-34 del prompt): mismo
 * mecanismo que qc_petct_pet_tests (borrador editable mientras
 * is_finalized = false; corregir un registro finalizado crea una fila
 * nueva con supersedes_id, el original nunca se modifica ni se elimina).
 */

let ensured = false;

export type CtTestCode =
  | "CT-01"
  | "CT-02"
  | "CT-03"
  | "CT-04"
  | "CT-05"
  | "CT-06"
  | "CT-07"
  | "CT-08"
  | "CT-09"
  | "CT-10"
  | "CT-11"
  | "CT-12"
  | "CT-13"
  | "CT-14";

export type CtTestRecord = {
  id: number;
  equipment_id: number | null;
  test_code: CtTestCode;
  performed_at: string;
  operator: string;
  physicist_reviewed_by: string | null;
  phantom: string | null;
  protocol: string | null;
  kvp: number | null;
  mas: number | null;
  pitch: number | null;
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

export async function ensureCtTestsTables() {
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS qc_petct_ct_tests (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES petct_equipment(id) ON DELETE SET NULL,
    test_code TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operator TEXT NOT NULL,
    physicist_reviewed_by TEXT,
    phantom TEXT,
    protocol TEXT,
    kvp NUMERIC,
    mas NUMERIC,
    pitch NUMERIC,
    raw_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'requiere_revision',
    action_level TEXT NOT NULL DEFAULT 'normal',
    comments TEXT,
    corrective_action TEXT,
    is_finalized BOOLEAN NOT NULL DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by TEXT,
    supersedes_id INTEGER REFERENCES qc_petct_ct_tests(id) ON DELETE SET NULL,
    edit_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_ct_tests_equipment ON qc_petct_ct_tests(equipment_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_ct_tests_code ON qc_petct_ct_tests(test_code, performed_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_ct_tests_supersedes ON qc_petct_ct_tests(supersedes_id);`;

  ensured = true;
}

export type CreateCtTestInput = {
  equipment_id: number | null;
  test_code: CtTestCode;
  performed_at?: string | null;
  operator: string;
  physicist_reviewed_by?: string | null;
  phantom?: string | null;
  protocol?: string | null;
  kvp?: number | null;
  mas?: number | null;
  pitch?: number | null;
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

export async function createCtTest(input: CreateCtTestInput): Promise<CtTestRecord> {
  await ensureCtTestsTables();
  const { rows } = await sql`INSERT INTO qc_petct_ct_tests (
    equipment_id, test_code, performed_at, operator, physicist_reviewed_by, phantom, protocol,
    kvp, mas, pitch, raw_inputs, calculated, status, action_level, comments, corrective_action,
    supersedes_id, edit_reason, created_by
  ) VALUES (
    ${input.equipment_id ?? null}, ${input.test_code}, ${input.performed_at ?? new Date().toISOString()},
    ${input.operator}, ${input.physicist_reviewed_by ?? null}, ${input.phantom ?? null}, ${input.protocol ?? null},
    ${input.kvp ?? null}, ${input.mas ?? null}, ${input.pitch ?? null},
    ${JSON.stringify(input.raw_inputs)}::jsonb, ${JSON.stringify(input.calculated)}::jsonb,
    ${input.status}, ${input.action_level}, ${input.comments ?? null}, ${input.corrective_action ?? null},
    ${input.supersedes_id ?? null}, ${input.edit_reason ?? null}, ${input.created_by ?? null}
  ) RETURNING *;`;
  return rows[0] as CtTestRecord;
}

export async function listCtTests(filters: { equipment_id?: number; test_code?: CtTestCode } = {}): Promise<CtTestRecord[]> {
  await ensureCtTestsTables();
  if (filters.equipment_id && filters.test_code) {
    const { rows } = await sql`SELECT * FROM qc_petct_ct_tests WHERE equipment_id = ${filters.equipment_id} AND test_code = ${filters.test_code} ORDER BY performed_at DESC;`;
    return rows as CtTestRecord[];
  }
  if (filters.equipment_id) {
    const { rows } = await sql`SELECT * FROM qc_petct_ct_tests WHERE equipment_id = ${filters.equipment_id} ORDER BY performed_at DESC;`;
    return rows as CtTestRecord[];
  }
  if (filters.test_code) {
    const { rows } = await sql`SELECT * FROM qc_petct_ct_tests WHERE test_code = ${filters.test_code} ORDER BY performed_at DESC;`;
    return rows as CtTestRecord[];
  }
  const { rows } = await sql`SELECT * FROM qc_petct_ct_tests ORDER BY performed_at DESC LIMIT 500;`;
  return rows as CtTestRecord[];
}

export async function getCtTestById(id: number): Promise<CtTestRecord | null> {
  await ensureCtTestsTables();
  const { rows } = await sql`SELECT * FROM qc_petct_ct_tests WHERE id = ${id};`;
  return (rows[0] as CtTestRecord) ?? null;
}

/**
 * Devuelve, siguiendo supersedes_id, la cadena de versiones de un control
 * (original + correcciones posteriores), igual que en Fase B.
 */
export async function listCtVersionChain(rootId: number): Promise<CtTestRecord[]> {
  await ensureCtTestsTables();
  const chain: CtTestRecord[] = [];
  let currentId: number | null = rootId;
  const visited = new Set<number>();
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const record = await getCtTestById(currentId);
    if (!record) break;
    chain.push(record);
    const { rows }: { rows: Array<{ id: number }> } = await sql`SELECT id FROM qc_petct_ct_tests WHERE supersedes_id = ${currentId} LIMIT 1;`;
    currentId = (rows[0]?.id as number | undefined) ?? null;
  }
  return chain;
}

export async function finalizeCtTest(id: number, finalizedBy: string): Promise<CtTestRecord | null> {
  await ensureCtTestsTables();
  const { rows } = await sql`UPDATE qc_petct_ct_tests SET is_finalized = true, finalized_at = now(), finalized_by = ${finalizedBy}, updated_at = now() WHERE id = ${id} AND is_finalized = false RETURNING *;`;
  return (rows[0] as CtTestRecord) ?? null;
}

export type UpdateDraftCtTestInput = {
  raw_inputs: Record<string, unknown>;
  calculated: Record<string, unknown>;
  status: string;
  action_level: string;
  comments?: string | null;
  corrective_action?: string | null;
  operator?: string;
  phantom?: string | null;
  protocol?: string | null;
  kvp?: number | null;
  mas?: number | null;
  pitch?: number | null;
};

/** Solo permitido mientras is_finalized = false (verificar antes de llamar). */
export async function updateDraftCtTest(id: number, patch: UpdateDraftCtTestInput): Promise<CtTestRecord | null> {
  await ensureCtTestsTables();
  const { rows } = await sql`UPDATE qc_petct_ct_tests SET
    raw_inputs = ${JSON.stringify(patch.raw_inputs)}::jsonb,
    calculated = ${JSON.stringify(patch.calculated)}::jsonb,
    status = ${patch.status},
    action_level = ${patch.action_level},
    comments = ${patch.comments ?? null},
    corrective_action = ${patch.corrective_action ?? null},
    operator = COALESCE(${patch.operator ?? null}, operator),
    phantom = COALESCE(${patch.phantom ?? null}, phantom),
    protocol = COALESCE(${patch.protocol ?? null}, protocol),
    kvp = COALESCE(${patch.kvp ?? null}, kvp),
    mas = COALESCE(${patch.mas ?? null}, mas),
    pitch = COALESCE(${patch.pitch ?? null}, pitch),
    updated_at = now()
  WHERE id = ${id} AND is_finalized = false
  RETURNING *;`;
  return (rows[0] as CtTestRecord) ?? null;
}

/**
 * Corrige un registro YA finalizado (seccion 33 del prompt): nunca se
 * modifica el registro original. Crea una fila nueva con
 * supersedes_id = id del registro corregido.
 */
export async function createCorrectedCtVersion(
  originalId: number,
  patch: Partial<CreateCtTestInput>,
  editReason: string,
  editedBy: string
): Promise<CtTestRecord | null> {
  await ensureCtTestsTables();
  const original = await getCtTestById(originalId);
  if (!original) return null;

  const merged: CreateCtTestInput = {
    equipment_id: patch.equipment_id ?? original.equipment_id,
    test_code: (patch.test_code ?? original.test_code) as CtTestCode,
    performed_at: patch.performed_at ?? original.performed_at,
    operator: patch.operator ?? original.operator,
    physicist_reviewed_by: patch.physicist_reviewed_by ?? original.physicist_reviewed_by,
    phantom: patch.phantom ?? original.phantom,
    protocol: patch.protocol ?? original.protocol,
    kvp: patch.kvp ?? original.kvp,
    mas: patch.mas ?? original.mas,
    pitch: patch.pitch ?? original.pitch,
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

  const created = await createCtTest(merged);

  const { recordAuditLog } = await import("@/lib/qc-petct-architecture-db");
  await recordAuditLog({
    entity_type: "qc_petct_ct_tests",
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
