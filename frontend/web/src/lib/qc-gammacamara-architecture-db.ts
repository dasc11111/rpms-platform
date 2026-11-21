import { sql } from "@/lib/db";

/**
 * MODULO 2 - GAMMACAMARA - ARQUITECTURA
 * Infraestructura de soporte avanzado: baseline historico y evidencia
 * grafica/documental, siguiendo el mismo principio aplicado en PET/CT
 * y Activimetro.
 *
 * Regulacion: DS 133/1984 MINSAL.
 * Referencia: IAEA TECDOC-602 (Quality Control Atlas for Scintillation
 * Camera Systems).
 *
 * El baseline nunca se sobrescribe: al establecer un nuevo valor el
 * anterior se conserva (is_current = false) y queda enlazado via
 * previous_baseline_id. La evidencia referencia URLs externas (no
 * almacenamiento de blobs en este modulo).
 */

let ensured = false;

export async function ensureGammacamaraArchitectureTables(): Promise<void> {
  if (ensured) return;

  // Baseline historico por equipo / tipo de prueba / modo / parametro
  await sql`
    CREATE TABLE IF NOT EXISTS qc_gammacamara_baseline (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES qc_gammacamara_equipment(id) ON DELETE SET NULL,
      test_type TEXT NOT NULL,
      test_mode TEXT,
      parameter_name TEXT NOT NULL,
      value NUMERIC(12,4),
      unit TEXT,
      date_established DATE NOT NULL DEFAULT CURRENT_DATE,
      methodology TEXT,
      phantom TEXT,
      source_activity_mbq NUMERIC(10,3),
      protocol TEXT,
      operator TEXT,
      physicist_responsible TEXT,
      is_current BOOLEAN NOT NULL DEFAULT true,
      previous_baseline_id INTEGER REFERENCES qc_gammacamara_baseline(id) ON DELETE SET NULL,
      change_reason TEXT,
      changed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Evidencia grafica/documental — solo metadatos y URL de referencia
  await sql`
    CREATE TABLE IF NOT EXISTS qc_gammacamara_evidence (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES qc_gammacamara_equipment(id) ON DELETE SET NULL,
      test_id INTEGER REFERENCES qc_gammacamara_tests(id) ON DELETE SET NULL,
      evidence_type TEXT NOT NULL DEFAULT 'foto_equipo',
      file_name TEXT,
      file_url TEXT NOT NULL,
      description TEXT,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_baseline_lookup ON qc_gammacamara_baseline(equipment_id, test_type, test_mode, parameter_name, is_current)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_evidence_equip ON qc_gammacamara_evidence(equipment_id)`;

  ensured = true;
}

// ── Baseline ─────────────────────────────────────────────────────────────────

export type GammacamaraBaseline = {
  id: number;
  equipment_id: number | null;
  test_type: string;
  test_mode: string | null;
  parameter_name: string;
  value: number | null;
  unit: string | null;
  date_established: string;
  methodology: string | null;
  phantom: string | null;
  source_activity_mbq: number | null;
  protocol: string | null;
  operator: string | null;
  physicist_responsible: string | null;
  is_current: boolean;
  previous_baseline_id: number | null;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
};

export async function getCurrentGammacamaraBaseline(
  testType: string,
  testMode: string | null,
  parameterName: string,
  equipmentId?: number
): Promise<GammacamaraBaseline | null> {
  const eqId = equipmentId ?? null;
  const mode = testMode || null;
  const { rows } = await sql`
    SELECT * FROM qc_gammacamara_baseline
    WHERE test_type = ${testType}
      AND (test_mode = ${mode} OR (test_mode IS NULL AND ${mode}::text IS NULL))
      AND parameter_name = ${parameterName}
      AND is_current = true
      AND (equipment_id = ${eqId} OR (equipment_id IS NULL AND ${eqId}::integer IS NULL))
    LIMIT 1
  `;
  return (rows[0] as GammacamaraBaseline) ?? null;
}

export async function getGammacamaraBaselineHistory(
  testType: string,
  testMode: string | null,
  parameterName: string,
  equipmentId?: number
): Promise<GammacamaraBaseline[]> {
  const eqId = equipmentId ?? null;
  const mode = testMode || null;
  const { rows } = await sql`
    SELECT * FROM qc_gammacamara_baseline
    WHERE test_type = ${testType}
      AND (test_mode = ${mode} OR (test_mode IS NULL AND ${mode}::text IS NULL))
      AND parameter_name = ${parameterName}
      AND (equipment_id = ${eqId} OR (equipment_id IS NULL AND ${eqId}::integer IS NULL))
    ORDER BY created_at DESC
  `;
  return rows as GammacamaraBaseline[];
}

export async function setGammacamaraBaseline(data: {
  equipment_id: number | null;
  test_type: string;
  test_mode: string | null;
  parameter_name: string;
  value: number | null;
  unit: string | null;
  methodology: string | null;
  phantom: string | null;
  source_activity_mbq: number | null;
  protocol: string | null;
  operator: string | null;
  physicist_responsible: string | null;
  change_reason: string | null;
  changed_by: string | null;
}): Promise<GammacamaraBaseline> {
  const mode = data.test_mode || null;
  // Mark existing current as non-current
  const { rows: prev } = await sql`
    SELECT id FROM qc_gammacamara_baseline
    WHERE test_type = ${data.test_type}
      AND (test_mode = ${mode} OR (test_mode IS NULL AND ${mode}::text IS NULL))
      AND parameter_name = ${data.parameter_name}
      AND is_current = true
      AND (equipment_id = ${data.equipment_id} OR (equipment_id IS NULL AND ${data.equipment_id}::integer IS NULL))
    LIMIT 1
  `;
  const previousId = (prev[0] as { id: number } | undefined)?.id ?? null;
  if (previousId) {
    await sql`UPDATE qc_gammacamara_baseline SET is_current = false WHERE id = ${previousId}`;
  }
  const { rows } = await sql`
    INSERT INTO qc_gammacamara_baseline (
      equipment_id, test_type, test_mode, parameter_name, value, unit,
      methodology, phantom, source_activity_mbq, protocol, operator,
      physicist_responsible, is_current, previous_baseline_id, change_reason, changed_by
    ) VALUES (
      ${data.equipment_id}, ${data.test_type}, ${mode}, ${data.parameter_name},
      ${data.value}, ${data.unit}, ${data.methodology}, ${data.phantom},
      ${data.source_activity_mbq}, ${data.protocol}, ${data.operator},
      ${data.physicist_responsible}, true, ${previousId},
      ${data.change_reason}, ${data.changed_by}
    )
    RETURNING *
  `;
  return rows[0] as GammacamaraBaseline;
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export type GammacamaraEvidence = {
  id: number;
  equipment_id: number | null;
  test_id: number | null;
  evidence_type: string;
  file_name: string | null;
  file_url: string;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

export async function listGammacamaraEvidence(
  equipmentId?: number,
  testId?: number
): Promise<GammacamaraEvidence[]> {
  if (equipmentId && testId) {
    const { rows } = await sql`
      SELECT * FROM qc_gammacamara_evidence
      WHERE equipment_id = ${equipmentId} AND test_id = ${testId}
      ORDER BY uploaded_at DESC
    `;
    return rows as GammacamaraEvidence[];
  }
  if (equipmentId) {
    const { rows } = await sql`
      SELECT * FROM qc_gammacamara_evidence WHERE equipment_id = ${equipmentId} ORDER BY uploaded_at DESC
    `;
    return rows as GammacamaraEvidence[];
  }
  if (testId) {
    const { rows } = await sql`
      SELECT * FROM qc_gammacamara_evidence WHERE test_id = ${testId} ORDER BY uploaded_at DESC
    `;
    return rows as GammacamaraEvidence[];
  }
  const { rows } = await sql`SELECT * FROM qc_gammacamara_evidence ORDER BY uploaded_at DESC LIMIT 200`;
  return rows as GammacamaraEvidence[];
}

export async function createGammacamaraEvidence(data: {
  equipment_id: number | null;
  test_id: number | null;
  evidence_type: string;
  file_name: string | null;
  file_url: string;
  description: string | null;
  uploaded_by: string | null;
}): Promise<GammacamaraEvidence> {
  const { rows } = await sql`
    INSERT INTO qc_gammacamara_evidence (
      equipment_id, test_id, evidence_type, file_name, file_url, description, uploaded_by
    ) VALUES (
      ${data.equipment_id}, ${data.test_id}, ${data.evidence_type},
      ${data.file_name}, ${data.file_url}, ${data.description}, ${data.uploaded_by}
    )
    RETURNING *
  `;
  return rows[0] as GammacamaraEvidence;
}
