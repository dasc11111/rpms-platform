import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import {
  ensureActivimetroArchitectureTables,
  recordActivimetroAuditLog,
  getCurrentActivimetroBaseline,
  setActivimetroBaseline,
  type ActivimetroRadionuclide,
} from "@/lib/qc-activimetro-architecture-db";
import {
  mean,
  stddev,
  coefficientOfVariation,
  percentDifference,
  decayCorrectActivity,
  evaluateTolerance,
  type ResultStatus,
} from "@/lib/qc-activimetro-calc";

/**
 * MODULO ACTIVIMETRO - ACTIV-06: CONSTANCIA
 *
 * Definicion tomada literalmente del catalogo configurable
 * qc_activimetro_test_catalog (seccion 4 del prompt maestro): "Control
 * periodico comparando la actividad medida contra tolerancia, baseline y
 * resultado anterior."
 *
 * Reutiliza la arquitectura ya existente, sin duplicar codigo:
 * - qc_activimetro_tests (test_type = 'constancia') / qc_activimetro_readings
 *   (lecturas individuales, nunca se eliminan).
 * - qc_activimetro_tolerances (tolerancia configurable). La tolerancia NO
 *   esta definida en el documento fuente para esta prueba: se deja NULL,
 *   con nota explicita para el Fisico Medico responsable (seccion 45: nunca
 *   se inventan tolerancias).
 * - qc_activimetro_baseline: comparacion contra el baseline vigente del
 *   equipo (seccion 28). Si el instrumento no tiene ficha tecnica vinculada
 *   en qc_activimetro_equipment, la comparacion contra baseline simplemente
 *   no esta disponible (no se inventa un equipo ni un valor).
 * - qc_activimetro_audit_log.
 *
 * El radionucleido es OPCIONAL: muchas instituciones usan para la
 * constancia diaria una fuente de verificacion de vida media larga que no
 * forma parte del catalogo clinico qc_activimetro_radionuclides. Si se
 * selecciona un radionucleido del catalogo y se completan fecha/hora de
 * referencia y medicion, se aplica correccion por decaimiento; en caso
 * contrario se compara directamente la media de lecturas, sin inventar una
 * vida media no configurada.
 */

const TEST_TYPE = "constancia";
const PARAMETER_NAME = "percent_difference_baseline";
const BASELINE_PARAMETER = "mean_value";
const BASELINE_TEST_CODE = "ACTIV-06";

let seeded = false;

export async function ensureConstanciaTolerance() {
  await ensureActivimetroQcTables();
  await ensureActivimetroArchitectureTables();
  if (seeded) return;

  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM qc_activimetro_tolerances WHERE test_type = ${TEST_TYPE} AND parameter_name = ${PARAMETER_NAME};`;
  if (rows[0]?.count === 0) {
    await sql`INSERT INTO qc_activimetro_tolerances
      (test_type, parameter_name, tolerance_percent, reference_source, protocol_version, num_readings_required, frequency_days, notes)
      VALUES
      (${TEST_TYPE}, ${PARAMETER_NAME}, ${null}, 'Documento QA Activimetro proporcionado por usuario', '1.0', 1, 1,
      'REVISAR CON FISICO MEDICO: tolerancia no definida en el documento fuente para ACTIV-06 (Constancia). Debe ser configurada por el Fisico Medico responsable antes de poder emitir un resultado de cumple/no cumple; mientras tanto el sistema solo informa el porcentaje de variacion frente al baseline y a la prueba anterior.')
      ON CONFLICT (test_type, parameter_name, protocol_version) DO NOTHING;`;
  }
  seeded = true;
}

export type ConstanciaToleranceConfig = {
  tolerance_percent: number | null;
  warning_percent: number | null;
  num_readings_required: number | null;
  frequency_days: number | null;
  reference_source: string;
  protocol_version: string;
  notes: string | null;
};

export async function getConstanciaTolerance(): Promise<ConstanciaToleranceConfig | null> {
  await ensureConstanciaTolerance();
  const { rows } = await sql`SELECT tolerance_percent, warning_percent, num_readings_required, frequency_days, reference_source, protocol_version, notes
    FROM qc_activimetro_tolerances WHERE test_type = ${TEST_TYPE} AND parameter_name = ${PARAMETER_NAME} AND active = true
    ORDER BY effective_from DESC LIMIT 1;`;
  return (rows[0] as ConstanciaToleranceConfig) ?? null;
}

export async function getLinkedEquipmentId(instrumentId: number | null | undefined): Promise<number | null> {
  if (!instrumentId) return null;
  await ensureActivimetroArchitectureTables();
  const { rows } = await sql`SELECT id FROM qc_activimetro_equipment WHERE instrument_id = ${instrumentId} AND active = true LIMIT 1;`;
  return (rows[0]?.id as number) ?? null;
}

export async function getConstanciaBaselineInfo(instrumentId: number | null | undefined) {
  const equipmentId = await getLinkedEquipmentId(instrumentId);
  if (!equipmentId) {
    return { equipmentId: null, baseline: null };
  }
  const baseline = await getCurrentActivimetroBaseline(equipmentId, BASELINE_TEST_CODE, BASELINE_PARAMETER);
  return { equipmentId, baseline };
}

export type ConstanciaTest = {
  id: number;
  instrument_id: number | null;
  instrument_code: string | null;
  instrument_name: string | null;
  test_type: string;
  test_date: string;
  test_time: string | null;
  performed_by: string | null;
  opr_reviewed_by: string | null;
  radionuclide: string | null;
  num_readings: number | null;
  mean_value: number | null;
  stddev_value: number | null;
  cv_percent: number | null;
  reference_value: number | null;
  percent_difference: number | null;
  tolerance_percent: number | null;
  half_life_minutes: number | null;
  decay_constant: number | null;
  reference_activity: number | null;
  reference_datetime: string | null;
  measurement_datetime: string | null;
  corrected_activity: number | null;
  result_status: ResultStatus;
  observaciones: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CreateConstanciaInput = {
  instrument_id: number | null;
  instrument_code?: string | null;
  instrument_name?: string | null;
  test_date: string;
  test_time?: string | null;
  performed_by?: string | null;
  opr_reviewed_by?: string | null;
  radionuclide?: string | null;
  reference_activity?: number | null;
  reference_datetime?: string | null;
  measurement_datetime?: string | null;
  readings: number[];
  observaciones?: string | null;
  set_as_baseline?: boolean;
  baseline_change_reason?: string | null;
  created_by?: string | null;
};

export async function createConstanciaTest(input: CreateConstanciaInput) {
  await ensureConstanciaTolerance();

  let rn: ActivimetroRadionuclide | undefined;
  if (input.radionuclide) {
    const { rows: rnRows } = await sql`SELECT * FROM qc_activimetro_radionuclides WHERE symbol = ${input.radionuclide} AND active = true;`;
    rn = rnRows[0] as ActivimetroRadionuclide | undefined;
    if (!rn) {
      throw new Error("El radionucleido '" + input.radionuclide + "' no esta definido en el catalogo. Debe ser configurado por el Fisico Medico responsable antes de registrar esta prueba.");
    }
  }

  const readings = input.readings;
  if (!readings || readings.length === 0) {
    throw new Error("Debe registrar al menos una lectura medida.");
  }
  const meanValue = mean(readings);
  const stddevValue = stddev(readings);
  const cvPercent = coefficientOfVariation(readings);

  let measuredValue = meanValue;
  let correctedActivity: number | null = null;
  if (rn && input.reference_activity && input.reference_datetime && input.measurement_datetime) {
    const elapsedMinutes = (new Date(input.measurement_datetime).getTime() - new Date(input.reference_datetime).getTime()) / 60000;
    correctedActivity = decayCorrectActivity(input.reference_activity, Number(rn.half_life_minutes), elapsedMinutes, "forward");
    measuredValue = correctedActivity;
  }

  const equipmentId = await getLinkedEquipmentId(input.instrument_id);
  const baseline = equipmentId ? await getCurrentActivimetroBaseline(equipmentId, BASELINE_TEST_CODE, BASELINE_PARAMETER) : null;
  const baselineValue = baseline && baseline.value != null ? Number(baseline.value) : null;

  const { rows: prevRows } = await sql`SELECT * FROM qc_activimetro_tests WHERE test_type = ${TEST_TYPE} AND instrument_id = ${input.instrument_id} ORDER BY test_date DESC, id DESC LIMIT 1;`;
  const previousTest = prevRows[0] as ConstanciaTest | undefined;
  const previousRaw = previousTest ? (previousTest.corrected_activity ?? previousTest.mean_value) : null;
  const previousValue = previousRaw != null ? Number(previousRaw) : null;

  const percentDiffBaseline = baselineValue != null ? percentDifference(measuredValue, baselineValue) : null;
  const percentDiffPrevious = previousValue != null ? percentDifference(measuredValue, previousValue) : null;

  const tolerance = await getConstanciaTolerance();
  const status = evaluateTolerance(
    percentDiffBaseline ?? NaN,
    tolerance?.tolerance_percent ?? null,
    tolerance?.warning_percent ?? null
  );

  const metadata = {
    equipment_id: equipmentId,
    baseline_id: baseline?.id ?? null,
    baseline_value: baselineValue,
    baseline_date_established: baseline?.date_established ?? null,
    percent_difference_previous: percentDiffPrevious,
    previous_test_id: previousTest?.id ?? null,
    previous_test_date: previousTest?.test_date ?? null,
  };

  const { rows } = await sql`INSERT INTO qc_activimetro_tests (
      instrument_id, instrument_code, instrument_name, test_type, test_date, test_time,
      performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
      num_readings, mean_value, stddev_value, cv_percent, reference_value, percent_difference,
      tolerance_percent, tolerance_parameter, half_life_minutes, decay_constant,
      reference_activity, reference_datetime, measurement_datetime, corrected_activity,
      result_status, metadata, observaciones, created_by
    ) VALUES (
      ${input.instrument_id}, ${input.instrument_code ?? null}, ${input.instrument_name ?? null}, ${TEST_TYPE}, ${input.test_date}, ${input.test_time ?? null},
      ${input.performed_by ?? null}, ${input.opr_reviewed_by ?? null}, ${input.radionuclide ?? null}, ${tolerance?.reference_source ?? "Documento QA Activimetro proporcionado por usuario"}, ${tolerance?.protocol_version ?? "1.0"},
      ${readings.length}, ${meanValue}, ${stddevValue}, ${cvPercent}, ${baselineValue}, ${percentDiffBaseline},
      ${tolerance?.tolerance_percent ?? null}, ${PARAMETER_NAME}, ${rn?.half_life_minutes ?? null}, ${rn?.decay_constant_per_min ?? null},
      ${input.reference_activity ?? null}, ${input.reference_datetime ?? null}, ${input.measurement_datetime ?? null}, ${correctedActivity},
      ${status}, ${JSON.stringify(metadata)}, ${input.observaciones ?? null}, ${input.created_by ?? null}
    ) RETURNING *;`;

  const test = rows[0] as ConstanciaTest;

  for (let i = 0; i < readings.length; i++) {
    await sql`INSERT INTO qc_activimetro_readings (test_id, reading_index, measured_value, unit)
      VALUES (${test.id}, ${i + 1}, ${readings[i]}, 'MBq');`;
  }

  if (input.set_as_baseline && equipmentId) {
    await setActivimetroBaseline({
      equipment_id: equipmentId,
      test_code: BASELINE_TEST_CODE,
      parameter_name: BASELINE_PARAMETER,
      value: measuredValue,
      unit: "MBq",
      radionuclide: input.radionuclide ?? null,
      operator: input.performed_by ?? null,
      physicist_responsible: input.opr_reviewed_by ?? null,
      change_reason: input.baseline_change_reason ?? "Establecido desde prueba ACTIV-06 (Constancia)",
      changed_by: input.created_by ?? input.performed_by ?? null,
    });
  }

  await recordActivimetroAuditLog({
    entity_type: "qc_activimetro_tests",
    entity_id: test.id,
    action: "create",
    field_name: "result_status",
    old_value: null,
    new_value: status,
    changed_by: input.created_by ?? input.performed_by ?? null,
  });

  return { ...test, percent_difference_previous: percentDiffPrevious, equipment_id: equipmentId, baseline_value: baselineValue };
}

export async function listConstanciaTests(instrumentId?: number) {
  await ensureConstanciaTolerance();
  if (instrumentId) {
    const { rows } = await sql`SELECT * FROM qc_activimetro_tests WHERE test_type = ${TEST_TYPE} AND instrument_id = ${instrumentId} ORDER BY test_date DESC, id DESC;`;
    return rows as ConstanciaTest[];
  }
  const { rows } = await sql`SELECT * FROM qc_activimetro_tests WHERE test_type = ${TEST_TYPE} ORDER BY test_date DESC, id DESC LIMIT 100;`;
  return rows as ConstanciaTest[];
}

export async function listConstanciaReadings(testId: number) {
  await ensureConstanciaTolerance();
  const { rows } = await sql`SELECT * FROM qc_activimetro_readings WHERE test_id = ${testId} ORDER BY reading_index;`;
  return rows;
}
