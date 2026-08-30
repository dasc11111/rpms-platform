import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";
import {
    ensureActivimetroArchitectureTables,
    recordActivimetroAuditLog,
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
 * MODULO ACTIVIMETRO - ACTIV-05: EXACTITUD POR RADIONUCLIDO
 * (seccion 12 del prompt maestro QA/QC Activimetros)
 *
 * Reutiliza la arquitectura ya existente del modulo basico (ACTIV-02):
 * - qc_activimetro_tests (test_type = 'exactitud_radionuclido')
 * - qc_activimetro_readings (lecturas individuales, nunca se eliminan)
 * - qc_activimetro_tolerances (tolerancia configurable, nunca hardcoded)
 *
 * Diferencia con ACTIV-02: el radionucleido se selecciona desde el catalogo
 * configurable qc_activimetro_radionuclides (99mTc, 131I, 18F, 68Ga, 177Lu,
 * otros) y la correccion por decaimiento entre el instante de calibracion
 * de la fuente de referencia y el instante de medicion se calcula de forma
 * automatica con la vida media del catalogo (nunca se introduce manualmente
 * ni se inventa un valor).
 */

const TEST_TYPE = "exactitud_radionuclido";
const PARAMETER_NAME = "percent_difference";

let seeded = false;

export async function ensureExactitudRadionuclidoTolerance() {
    await ensureActivimetroQcTables();
    await ensureActivimetroArchitectureTables();
    if (seeded) return;

  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM qc_activimetro_tolerances WHERE test_type = ${TEST_TYPE} AND parameter_name = ${PARAMETER_NAME};`;
    if (rows[0]?.count === 0) {
          await sql`INSERT INTO qc_activimetro_tolerances
                (test_type, parameter_name, tolerance_percent, reference_source, protocol_version, num_readings_required, frequency_days, notes)
                      VALUES
                            (${TEST_TYPE}, ${PARAMETER_NAME}, 5, 'Documento QA Activimetro proporcionado por usuario (misma tolerancia base que ACTIV-02)', '1.0', 3, 365,
                                   'REVISAR CON FISICO MEDICO: tolerancia asumida igual a ACTIV-02 (+/-5%); ajustar por radionucleido segun protocolo institucional si corresponde')
                                         ON CONFLICT (test_type, parameter_name, protocol_version) DO NOTHING;`;
    }
    seeded = true;
}

export type ExactitudRadionuclidoToleranceConfig = {
    tolerance_percent: number | null;
    warning_percent: number | null;
    num_readings_required: number | null;
    frequency_days: number | null;
    reference_source: string;
    protocol_version: string;
    notes: string | null;
};

export async function getExactitudRadionuclidoTolerance(): Promise<ExactitudRadionuclidoToleranceConfig | null> {
    await ensureExactitudRadionuclidoTolerance();
    const { rows } = await sql`SELECT tolerance_percent, warning_percent, num_readings_required, frequency_days, reference_source, protocol_version, notes
        FROM qc_activimetro_tolerances WHERE test_type = ${TEST_TYPE} AND parameter_name = ${PARAMETER_NAME} AND active = true
            ORDER BY effective_from DESC LIMIT 1;`;
    return (rows[0] as ExactitudRadionuclidoToleranceConfig) ?? null;
}

export type ExactitudRadionuclidoTest = {
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
    reference_source: string;
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
    created_at: string;
};

export type CreateExactitudRadionuclidoInput = {
    instrument_id: number | null;
    instrument_code?: string | null;
    instrument_name?: string | null;
    test_date: string;
    test_time?: string | null;
    performed_by?: string | null;
    opr_reviewed_by?: string | null;
    radionuclide: string;
    reference_activity: number;
    reference_datetime: string;
    measurement_datetime: string;
    readings: number[];
    observaciones?: string | null;
    created_by?: string | null;
};

export async function createExactitudRadionuclidoTest(input: CreateExactitudRadionuclidoInput) {
    await ensureExactitudRadionuclidoTolerance();

  const { rows: rnRows } = await sql`SELECT * FROM qc_activimetro_radionuclides WHERE symbol = ${input.radionuclide} AND active = true;`;
    const rn = rnRows[0] as ActivimetroRadionuclide | undefined;
    if (!rn) {
          throw new Error("El radionucleido '" + input.radionuclide + "' no esta definido en el catalogo. Debe ser configurado por el Fisico Medico responsable antes de registrar esta prueba.");
    }

  const tolerance = await getExactitudRadionuclidoTolerance();

  const readings = input.readings;
    const meanValue = mean(readings);
    const stddevValue = stddev(readings);
    const cvPercent = coefficientOfVariation(readings);

  const elapsedMinutes = (new Date(input.measurement_datetime).getTime() - new Date(input.reference_datetime).getTime()) / 60000;
    const correctedActivity = decayCorrectActivity(input.reference_activity, rn.half_life_minutes, elapsedMinutes, "forward");

  const diff = percentDifference(meanValue, correctedActivity);
    const status = evaluateTolerance(diff, tolerance?.tolerance_percent ?? null, tolerance?.warning_percent ?? null);

  const { rows } = await sql`INSERT INTO qc_activimetro_tests (
        instrument_id, instrument_code, instrument_name, test_type, test_date, test_time,
              performed_by, opr_reviewed_by, radionuclide, reference_source, protocol_version,
                    num_readings, mean_value, stddev_value, cv_percent, reference_value, percent_difference,
                          tolerance_percent, tolerance_parameter, half_life_minutes, decay_constant,
                                reference_activity, reference_datetime, measurement_datetime, corrected_activity,
                                      result_status, observaciones, created_by
                                          ) VALUES (
                                                ${input.instrument_id}, ${input.instrument_code ?? null}, ${input.instrument_name ?? null}, ${TEST_TYPE}, ${input.test_date}, ${input.test_time ?? null},
                                                      ${input.performed_by ?? null}, ${input.opr_reviewed_by ?? null}, ${input.radionuclide}, ${tolerance?.reference_source ?? "Documento QA Activimetro proporcionado por usuario"}, ${tolerance?.protocol_version ?? "1.0"},
                                                            ${readings.length}, ${meanValue}, ${stddevValue}, ${cvPercent}, ${correctedActivity}, ${diff},
                                                                  ${tolerance?.tolerance_percent ?? null}, ${PARAMETER_NAME}, ${rn.half_life_minutes}, ${rn.decay_constant_per_min},
                                                                        ${input.reference_activity}, ${input.reference_datetime}, ${input.measurement_datetime}, ${correctedActivity},
                                                                              ${status}, ${input.observaciones ?? null}, ${input.created_by ?? null}
                                                                                  ) RETURNING *;`;

  const test = rows[0] as ExactitudRadionuclidoTest;

  for (let i = 0; i < readings.length; i++) {
        await sql`INSERT INTO qc_activimetro_readings (test_id, reading_index, measured_value, unit)
              VALUES (${test.id}, ${i + 1}, ${readings[i]}, 'MBq');`;
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

  return test;
}

export async function listExactitudRadionuclidoTests(instrumentId?: number, radionuclide?: string) {
    await ensureExactitudRadionuclidoTolerance();
    if (instrumentId && radionuclide) {
          const { rows } = await sql`SELECT * FROM qc_activimetro_tests WHERE test_type = ${TEST_TYPE} AND instrument_id = ${instrumentId} AND radionuclide = ${radionuclide} ORDER BY test_date DESC, id DESC;`;
          return rows as ExactitudRadionuclidoTest[];
    }
    if (instrumentId) {
          const { rows } = await sql`SELECT * FROM qc_activimetro_tests WHERE test_type = ${TEST_TYPE} AND instrument_id = ${instrumentId} ORDER BY test_date DESC, id DESC;`;
          return rows as ExactitudRadionuclidoTest[];
    }
    const { rows } = await sql`SELECT * FROM qc_activimetro_tests WHERE test_type = ${TEST_TYPE} ORDER BY test_date DESC, id DESC LIMIT 100;`;
    return rows as ExactitudRadionuclidoTest[];
}

export async function listExactitudRadionuclidoReadings(testId: number) {
    await ensureExactitudRadionuclidoTolerance();
    const { rows } = await sql`SELECT * FROM qc_activimetro_readings WHERE test_id = ${testId} ORDER BY reading_index;`;
    return rows;
}
