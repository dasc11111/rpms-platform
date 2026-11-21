import { sql } from "@/lib/db";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * Infraestructura de soporte avanzado: baseline historico y evidencia
 * grafica/documental, siguiendo el mismo principio aplicado en PET/CT,
 * Activimetro y Gammacamara.
 *
 * Regulacion: DS 133/1984 MINSAL.
 * Referencia: IAEA TECDOC-602 (Quality Control Atlas — seccion SPECT).
 *
 * El baseline nunca se sobrescribe: al establecer un nuevo valor el
 * anterior se conserva (is_current = false) y queda enlazado via
 * previous_baseline_id. La evidencia referencia URLs externas.
 */

let ensured = false;

export async function ensureSpectArchitectureTables(): Promise<void> {
  if (ensured) return;

  // Baseline historico por equipo / tipo de prueba / parametro
  await sql`
    CREATE TABLE IF NOT EXISTS qc_spect_baseline (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES qc_spect_equipment(id) ON DELETE SET NULL,
      test_type TEXT NOT NULL,
      parameter_name TEXT NOT NULL,
      value NUMERIC(12,4),
      unit TEXT,
      date_established DATE NOT NULL DEFAULT CURRENT_DATE,
      methodology TEXT,
      phantom TEXT,
      protocol TEXT,
      operator TEXT,
      physicist_responsible TEXT,
      is_current BOOLEAN NOT NULL DEFAULT true,
      previous_baseline_id INTEGER REFERENCES qc_spect_baseline(id) ON DELETE SET NULL,
      change_reason TEXT,
      changed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Evidencia grafica/documental — solo metadatos y URL de referencia
  await sql`
    CREATE TABLE IF NOT EXISTS qc_spect_evidence (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES qc_spect_equipment(id) ON DELETE SET NULL,
      test_id INTEGER REFERENCES qc_spect_tests(id) ON DELETE SET NULL,
      evidence_type TEXT NOT NULL DEFAULT 'foto_equipo',
      file_name TEXT,
      file_url TEXT NOT NULL,
      description TEXT,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_baseline_lookup ON qc_spect_baseline(equipment_id, test_type, parameter_name, is_current)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_evidence_equip ON qc_spect_evidence(equipment_id)`;

  ensured = true;
}

// ── Baseline ─────────────────────────────────────────────────────────────────

export type SpectBaseline = {
  id: number;
  equipment_id: number | null;
  test_type: string;
  parameter_name: string;
  value: number | null;
  unit: string | null;
  date_established: string;
  methodology: string | null;
  phantom: string | null;
  protocol: string | null;
  operator: string | null;
  physicist_responsible: string | null;
  is_current: boolean;
  previous_baseline_id: number | null;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
};

export async function getCurrentSpectBaseline(
  testType: string,
  parameterName: string,
  equipmentId?: number
): Promise<SpectBaseline | null> {
  const eqId = equipmentId ?? null;
  const { rows } = await sql`
    SELECT * FROM qc_spect_baseline
    WHERE test_type = ${testType}
      AND parameter_name = ${parameterName}
      AND is_current = true
      AND (equipment_id = ${eqId} OR (equipment_id IS NULL AND ${eqId}::integer IS NULL))
    LIMIT 1
  `;
  return (rows[0] as SpectBaseline) ?? null;
}

export async function getSpectBaselineHistory(
  testType: string,
  parameterName: string,
  equipmentId?: number
): Promise<SpectBaseline[]> {
  const eqId = equipmentId ?? null;
  const { rows } = await sql`
    SELECT * FROM qc_spect_baseline
    WHERE test_type = ${testType}
      AND parameter_name = ${parameterName}
      AND (equipment_id = ${eqId} OR (equipment_id IS NULL AND ${eqId}::integer IS NULL))
    ORDER BY created_at DESC
  `;
  return rows as SpectBaseline[];
}

export async function setSpectBaseline(data: {
  equipment_id: number | null;
  test_type: string;
  parameter_name: string;
  value: number | null;
  unit: string | null;
  methodology: string | null;
  phantom: string | null;
  protocol: string | null;
  operator: string | null;
  physicist_responsible: string | null;
  change_reason: string | null;
  changed_by: string | null;
}): Promise<SpectBaseline> {
  // Mark existing current as non-current
  const { rows: prev } = await sql`
    SELECT id FROM qc_spect_baseline
    WHERE test_type = ${data.test_type}
      AND parameter_name = ${data.parameter_name}
      AND is_current = true
      AND (equipment_id = ${data.equipment_id} OR (equipment_id IS NULL AND ${data.equipment_id}::integer IS NULL))
    LIMIT 1
  `;
  const previousId = (prev[0] as { id: number } | undefined)?.id ?? null;
  if (previousId) {
    await sql`UPDATE qc_spect_baseline SET is_current = false WHERE id = ${previousId}`;
  }
  const { rows } = await sql`
    INSERT INTO qc_spect_baseline (
      equipment_id, test_type, parameter_name, value, unit,
      methodology, phantom, protocol, operator, physicist_responsible,
      is_current, previous_baseline_id, change_reason, changed_by
    ) VALUES (
      ${data.equipment_id}, ${data.test_type}, ${data.parameter_name},
      ${data.value}, ${data.unit}, ${data.methodology}, ${data.phantom},
      ${data.protocol}, ${data.operator}, ${data.physicist_responsible},
      true, ${previousId}, ${data.change_reason}, ${data.changed_by}
    )
    RETURNING *
  `;
  return rows[0] as SpectBaseline;
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export type SpectEvidence = {
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

export async function listSpectEvidence(
  equipmentId?: number,
  testId?: number
): Promise<SpectEvidence[]> {
  if (equipmentId && testId) {
    const { rows } = await sql`
      SELECT * FROM qc_spect_evidence
      WHERE equipment_id = ${equipmentId} AND test_id = ${testId}
      ORDER BY uploaded_at DESC
    `;
    return rows as SpectEvidence[];
  }
  if (equipmentId) {
    const { rows } = await sql`
      SELECT * FROM qc_spect_evidence WHERE equipment_id = ${equipmentId} ORDER BY uploaded_at DESC
    `;
    return rows as SpectEvidence[];
  }
  if (testId) {
    const { rows } = await sql`
      SELECT * FROM qc_spect_evidence WHERE test_id = ${testId} ORDER BY uploaded_at DESC
    `;
    return rows as SpectEvidence[];
  }
  const { rows } = await sql`SELECT * FROM qc_spect_evidence ORDER BY uploaded_at DESC LIMIT 200`;
  return rows as SpectEvidence[];
}

export async function createSpectEvidence(data: {
  equipment_id: number | null;
  test_id: number | null;
  evidence_type: string;
  file_name: string | null;
  file_url: string;
  description: string | null;
  uploaded_by: string | null;
}): Promise<SpectEvidence> {
  const { rows } = await sql`
    INSERT INTO qc_spect_evidence (
      equipment_id, test_id, evidence_type, file_name, file_url, description, uploaded_by
    ) VALUES (
      ${data.equipment_id}, ${data.test_id}, ${data.evidence_type},
      ${data.file_name}, ${data.file_url}, ${data.description}, ${data.uploaded_by}
    )
    RETURNING *
  `;
  return rows[0] as SpectEvidence;
}
