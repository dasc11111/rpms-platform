import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import {
  ensureActivimetroArchitectureTables,
  recordActivimetroAuditLog,
} from "@/lib/qc-activimetro-architecture-db";
import { getLinkedEquipmentId } from "@/lib/qc-activimetro-constancy-db";
import type { ResultStatus } from "@/lib/qc-activimetro-calc";

/**
 * MODULO ACTIVIMETRO - ACTIV-07: PUREZA RADIONUCLEIDICA DE 99mTc
 *
 * Definicion tomada literalmente del catalogo configurable
 * qc_activimetro_test_catalog (seccion 4 del prompt maestro): "Evaluar la
 * pureza radionucleidica del eluido de 99mTc mediante prueba guiada de 12
 * pasos (identificacion, muestra, procedimiento, preparacion,
 * configuracion, fondo, mediciones, impurezas, calculo, evaluacion,
 * revision, validacion)." responsible_level = fisico_medico, radionuclide
 * = 99mTc, freq_daily = true.
 *
 * El catalogo NO define formula ni tolerance_description para esta
 * prueba: el porcentaje de impureza (paso 8, Impurezas) se calcula con
 * aritmetica basica (actividad de impureza / actividad del eluido x 100),
 * pero el LIMITE de aceptacion (paso 10, Evaluacion) se deja NULL hasta
 * que el Fisico Medico responsable lo configure en
 * qc_activimetro_tolerances (seccion 45: nunca se inventan tolerancias).
 * Mientras tanto el resultado se informa como pendiente de revision.
 *
 * Ademas del registro detallado de los 12 pasos en la tabla dedicada
 * qc_activimetro_purity_tests, se crea un registro resumen en la tabla
 * compartida qc_activimetro_tests (test_type = 'pureza_radionucleidica')
 * para que el tablero de vencimientos ya existente (basado en
 * qc_activimetro_tolerances.frequency_days) siga funcionando igual que
 * con las demas pruebas, sin duplicar logica.
 */

const TEST_TYPE = "pureza_radionucleidica";
const PARAMETER_NAME = "impurity_percent";

let ensured = false;

export async function ensurePurityTables() {
  await ensureActivimetroQcTables();
  await ensureActivimetroArchitectureTables();
  if (ensured) return;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_purity_tests (
    id SERIAL PRIMARY KEY,
    instrument_id INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
    equipment_id INTEGER REFERENCES qc_activimetro_equipment(id) ON DELETE SET NULL,
    linked_test_id INTEGER REFERENCES qc_activimetro_tests(id) ON DELETE SET NULL,
    test_date DATE NOT NULL,
    test_time TEXT,
    performed_by TEXT,
    physicist_reviewed_by TEXT,
    generator_batch TEXT,
    elution_datetime TIMESTAMPTZ,
    eluate_volume_ml NUMERIC,
    eluate_activity_mbq NUMERIC,
    procedure_reference TEXT,
    preparation_method TEXT,
    materials_used TEXT,
    geometry TEXT,
    energy_window TEXT,
    background_reading NUMERIC,
    background_unit TEXT DEFAULT 'MBq',
    eluate_reading NUMERIC,
    impurity_type TEXT,
    impurity_reading NUMERIC,
    reading_unit TEXT DEFAULT 'MBq',
    impurity_percent NUMERIC,
    formula_used TEXT,
    tolerance_percent NUMERIC,
    result_status TEXT NOT NULL DEFAULT 'pendiente_revision',
    review_notes TEXT,
    review_status TEXT DEFAULT 'pendiente',
    validated_by TEXT,
    validation_datetime TIMESTAMPTZ,
    final_status TEXT DEFAULT 'pendiente',
    observaciones TEXT,
    metadata JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_purity_instrument ON qc_activimetro_purity_tests(instrument_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_purity_equipment ON qc_activimetro_purity_tests(equipment_id);`;

  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM qc_activimetro_tolerances WHERE test_type = ${TEST_TYPE} AND parameter_name = ${PARAMETER_NAME};`;
  if (rows[0]?.count === 0) {
    await sql`INSERT INTO qc_activimetro_tolerances
      (test_type, parameter_name, tolerance_percent, reference_source, protocol_version, num_readings_required, frequency_days, notes)
      VALUES
      (${TEST_TYPE}, ${PARAMETER_NAME}, ${null}, 'Documento QA Activimetro proporcionado por usuario', '1.0', 1, 1,
      'REVISAR CON FISICO MEDICO: el limite de aceptacion de impureza radionucleidica (% Mo-99 u otra impureza respecto al eluido de 99mTc) no esta definido en el documento fuente para ACTIV-07. Debe ser configurado por el Fisico Medico responsable antes de poder emitir un resultado de cumple/no cumple; mientras tanto el sistema solo informa el porcentaje de impureza calculado.')
      ON CONFLICT (test_type, parameter_name, protocol_version) DO NOTHING;`;
  }
  ensured = true;
}

export type PurityToleranceConfig = {
  tolerance_percent: number | null;
  num_readings_required: number | null;
  frequency_days: number | null;
  reference_source: string;
  protocol_version: string;
  notes: string | null;
};

export async function getPurityTolerance(): Promise<PurityToleranceConfig | null> {
  await ensurePurityTables();
  const { rows } = await sql`SELECT tolerance_percent, num_readings_required, frequency_days, reference_source, protocol_version, notes
    FROM qc_activimetro_tolerances WHERE test_type = ${TEST_TYPE} AND parameter_name = ${PARAMETER_NAME} AND active = true
    ORDER BY effective_from DESC LIMIT 1;`;
  return (rows[0] as PurityToleranceConfig) ?? null;
}

function evaluatePurityResult(impurityPercent: number | null, tolerancePercent: number | null): ResultStatus {
  if (impurityPercent == null || tolerancePercent == null) return "pendiente_revision" as ResultStatus;
  return (impurityPercent <= tolerancePercent ? "cumple" : "no_cumple") as ResultStatus;
}

export type CreatePurityInput = {
  instrument_id: number | null;
  test_date: string;
  test_time?: string | null;
  performed_by?: string | null;
  physicist_reviewed_by?: string | null;
  generator_batch?: string | null;
  elution_datetime?: string | null;
  eluate_volume_ml?: number | null;
  eluate_activity_mbq?: number | null;
  procedure_reference?: string | null;
  preparation_method?: string | null;
  materials_used?: string | null;
  geometry?: string | null;
  energy_window?: string | null;
  background_reading?: number | null;
  eluate_reading: number;
  impurity_type?: string | null;
  impurity_reading?: number | null;
  review_notes?: string | null;
  validated_by?: string | null;
  observaciones?: string | null;
  created_by?: string | null;
};

/**
 * Registra una prueba de pureza radionucleidica (ACTIV-07) con sus 12
 * pasos. El calculo de impurity_percent es aritmetica basica; el
 * resultado cumple/no_cumple/pendiente_revision depende de la tolerancia
 * configurada (puede ser NULL, nunca inventada).
 */
export async function createPurityTest(input: CreatePurityInput) {
  await ensurePurityTables();

  if (!input.eluate_reading || input.eluate_reading <= 0) {
    throw new Error("La lectura del eluido (paso 7, Mediciones) debe ser un valor mayor a cero.");
  }

  const impurityPercent =
    input.impurity_reading != null && !Number.isNaN(input.impurity_reading)
      ? (Number(input.impurity_reading) / Number(input.eluate_reading)) * 100
      : null;

  const tolerance = await getPurityTolerance();
  const status = evaluatePurityResult(impurityPercent, tolerance?.tolerance_percent ?? null);

  const equipmentId = await getLinkedEquipmentId(input.instrument_id);

  const formulaUsed = "% impureza = (Actividad de impureza / Actividad del eluido de 99mTc) x 100. Formula aritmetica basica; el limite de aceptacion no esta configurado en el catalogo (debe definirlo el Fisico Medico responsable).";

  const { rows: instRows } = input.instrument_id
    ? await sql`SELECT code, name FROM instruments WHERE id = ${input.instrument_id};`
    : { rows: [] as Array<{ code: string | null; name: string | null }> };
  const instrument = instRows[0];

  const { rows: linkedRows } = await sql`INSERT INTO qc_activimetro_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_date, test_time,
      performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
      num_readings, mean_value, reference_value, percent_difference,
      tolerance_percent, tolerance_parameter, result_status, metadata, observaciones, created_by
    ) VALUES (
      ${input.instrument_id}, ${instrument?.code ?? null}, ${instrument?.name ?? null}, ${TEST_TYPE}, ${input.test_date}, ${input.test_time ?? null},
      ${input.performed_by ?? null}, ${input.physicist_reviewed_by ?? null}, '99mTc', ${tolerance?.reference_source ?? "Documento QA Activimetro proporcionado por usuario"}, ${tolerance?.protocol_version ?? "1.0"},
      1, ${impurityPercent}, ${tolerance?.tolerance_percent ?? null}, ${impurityPercent},
      ${tolerance?.tolerance_percent ?? null}, ${PARAMETER_NAME}, ${status}, ${JSON.stringify({ equipment_id: equipmentId })}, ${input.observaciones ?? null}, ${input.created_by ?? null}
    ) RETURNING *;`;
  const linkedTest = linkedRows[0] as { id: number } | undefined;
  if (!linkedTest) {
    throw new Error("No se pudo crear el registro resumen de la prueba en qc_activimetro_tests.");
  }

  const { rows } = await sql`INSERT INTO qc_activimetro_purity_tests (
      instrument_id, equipment_id, linked_test_id, test_date, test_time,
      performed_by, physicist_reviewed_by,
      generator_batch, elution_datetime, eluate_volume_ml, eluate_activity_mbq,
      procedure_reference,
      preparation_method, materials_used,
      geometry, energy_window,
      background_reading,
      eluate_reading, impurity_type, impurity_reading,
      impurity_percent,
      formula_used,
      tolerance_percent, result_status,
      review_notes,
      validated_by,
      observaciones, created_by
    ) VALUES (
      ${input.instrument_id}, ${equipmentId}, ${linkedTest.id}, ${input.test_date}, ${input.test_time ?? null},
      ${input.performed_by ?? null}, ${input.physicist_reviewed_by ?? null},
      ${input.generator_batch ?? null}, ${input.elution_datetime ?? null}, ${input.eluate_volume_ml ?? null}, ${input.eluate_activity_mbq ?? null},
      ${input.procedure_reference ?? null},
      ${input.preparation_method ?? null}, ${input.materials_used ?? null},
      ${input.geometry ?? null}, ${input.energy_window ?? null},
      ${input.background_reading ?? null},
      ${input.eluate_reading}, ${input.impurity_type ?? null}, ${input.impurity_reading ?? null},
      ${impurityPercent},
      ${formulaUsed},
      ${tolerance?.tolerance_percent ?? null}, ${status},
      ${input.review_notes ?? null},
      ${input.validated_by ?? null},
      ${input.observaciones ?? null}, ${input.created_by ?? null}
    ) RETURNING *;`;

  const test = rows[0] as { id: number } | undefined;
  if (!test) {
    throw new Error("No se pudo registrar la prueba de pureza radionucleidica.");
  }

  await recordActivimetroAuditLog({
    entity_type: "qc_activimetro_purity_tests",
    entity_id: test.id,
    action: "create",
    field_name: "result_status",
    old_value: null,
    new_value: status,
    changed_by: input.created_by ?? input.performed_by ?? null,
  });

  return { ...test, impurity_percent: impurityPercent };
}

export async function listPurityTests(instrumentId?: number) {
  await ensurePurityTables();
  if (instrumentId) {
    const { rows } = await sql`SELECT * FROM qc_activimetro_purity_tests WHERE instrument_id = ${instrumentId} ORDER BY test_date DESC, id DESC;`;
    return rows;
  }
  const { rows } = await sql`SELECT * FROM qc_activimetro_purity_tests ORDER BY test_date DESC, id DESC LIMIT 100;`;
  return rows;
}

export async function getPurityTestById(id: number) {
  await ensurePurityTables();
  const { rows } = await sql`SELECT * FROM qc_activimetro_purity_tests WHERE id = ${id};`;
  return rows[0] ?? null;
}

/**
 * Paso 11 (Revision) y Paso 12 (Validacion): el Fisico Medico responsable
 * revisa y valida la prueba ya registrada. Nunca se sobrescribe el
 * registro original de mediciones; solo se completan los campos de
 * revision/validacion y se deja auditoria del cambio.
 */
export async function reviewAndValidatePurityTest(input: {
  id: number;
  review_notes?: string | null;
  review_status: string;
  validated_by?: string | null;
  final_status: string;
  changed_by?: string | null;
}) {
  await ensurePurityTables();
  const existing = await getPurityTestById(input.id);
  if (!existing) throw new Error("Prueba de pureza radionucleidica no encontrada.");

  const { rows } = await sql`UPDATE qc_activimetro_purity_tests SET
      review_notes = ${input.review_notes ?? null},
      review_status = ${input.review_status},
      validated_by = ${input.validated_by ?? null},
      validation_datetime = now(),
      final_status = ${input.final_status}
    WHERE id = ${input.id}
    RETURNING *;`;

  await recordActivimetroAuditLog({
    entity_type: "qc_activimetro_purity_tests",
    entity_id: input.id,
    action: "review_validate",
    field_name: "final_status",
    old_value: (existing as { final_status: string | null }).final_status,
    new_value: input.final_status,
    changed_by: input.changed_by ?? input.validated_by ?? null,
  });

  return rows[0];
}
