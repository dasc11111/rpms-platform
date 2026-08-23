import { sql } from "@/lib/db";

/**
 * MODULO 1 - ACTIVIMETRO (DOSE CALIBRATOR)
 * Esquema de base de datos para el sistema de Control de Calidad.
 *
 * Referencia tecnica principal: documento "Anexo_QA_08_Activimetro" (Google Sheet)
 * proporcionado por el usuario como modelo obligatorio de reproduccion fiel.
 * Referencia complementaria: IAEA TECDOC-602.
 *
 * Principios aplicados (Prompt maestro CC):
 * - Captura de multiples lecturas por prueba (no un unico valor).
 * - Calculos (promedio, SD, CV%, diferencia %, correccion por decaimiento,
 *   regresion ln-ln) se realizan en el motor de calculo, nunca por el operador.
 * - Tolerancias configurables en tabla separada, con trazabilidad de version
 *   y fuente de referencia utilizada en cada prueba.
 * - Las lecturas originales nunca se eliminan tras el calculo.
 */

let ensured = false;

export type ActivimetroTestType =
    | "precision"
  | "exactitud"
  | "linealidad"
  | "respuesta_fondo"
  | "geometria_volumen";

export async function ensureActivimetroQcTables() {
    if (ensured) return;

  // Tabla de cabecera: una fila por prueba/sesion de control de calidad
  await sql`
      CREATE TABLE IF NOT EXISTS qc_activimetro_tests (
            id SERIAL PRIMARY KEY,
                  instrument_id INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
                        instrument_code TEXT,
                              instrument_name TEXT,
                                    test_type TEXT NOT NULL,
                                          test_date DATE NOT NULL,
                                                test_time TIME,
                                                      performed_by TEXT,
                                                            opr_reviewed_by TEXT,
                                                                  radionuclide TEXT,
                                                                        reference_source TEXT NOT NULL DEFAULT 'Documento QA Activimetro proporcionado por usuario',
                                                                              protocol_version TEXT,
                                                                                    num_readings INTEGER,
                                                                                          mean_value NUMERIC,
                                                                                                stddev_value NUMERIC,
                                                                                                      cv_percent NUMERIC,
                                                                                                            reference_value NUMERIC,
                                                                                                                  percent_difference NUMERIC,
                                                                                                                        tolerance_percent NUMERIC,
                                                                                                                              tolerance_parameter TEXT,
                                                                                                                                    regression_slope NUMERIC,
                                                                                                                                          regression_intercept NUMERIC,
                                                                                                                                                regression_r2 NUMERIC,
                                                                                                                                                      half_life_minutes NUMERIC,
                                                                                                                                                            decay_constant NUMERIC,
                                                                                                                                                                  reference_activity NUMERIC,
                                                                                                                                                                        reference_datetime TIMESTAMPTZ,
                                                                                                                                                                              measurement_datetime TIMESTAMPTZ,
                                                                                                                                                                                    corrected_activity NUMERIC,
                                                                                                                                                                                          result_status TEXT NOT NULL DEFAULT 'pendiente_revision',
                                                                                                                                                                                                metadata JSONB,
                                                                                                                                                                                                      observaciones TEXT,
                                                                                                                                                                                                            corrective_action TEXT,
                                                                                                                                                                                                                  created_by TEXT,
                                                                                                                                                                                                                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                                                                                                                                              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                                                                                                                                  );
                                                                                                                                                                                                                                    `;

  // Tabla de detalle: lecturas individuales originales (nunca se eliminan)
  await sql`
      CREATE TABLE IF NOT EXISTS qc_activimetro_readings (
            id SERIAL PRIMARY KEY,
                  test_id INTEGER NOT NULL REFERENCES qc_activimetro_tests(id) ON DELETE CASCADE,
                        reading_index INTEGER NOT NULL,
                              reading_label TEXT,
                                    measured_value NUMERIC NOT NULL,
                                          unit TEXT,
                                                elapsed_time_minutes NUMERIC,
                                                      measured_at TIMESTAMPTZ,
                                                            metadata JSONB,
                                                                  notes TEXT,
                                                                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                            );
                                                                              `;

  // Tabla de configuracion de tolerancias: PRUEBA -> PARAMETRO -> TOLERANCIA -> REFERENCIA -> VERSION
  await sql`
      CREATE TABLE IF NOT EXISTS qc_activimetro_tolerances (
            id SERIAL PRIMARY KEY,
                  test_type TEXT NOT NULL,
                        parameter_name TEXT NOT NULL,
                              tolerance_percent NUMERIC,
                                    tolerance_absolute NUMERIC,
                                          warning_percent NUMERIC,
                                                reference_source TEXT NOT NULL,
                                                      protocol_version TEXT NOT NULL DEFAULT '1.0',
                                                            num_readings_required INTEGER,
                                                                  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
                                                                        active BOOLEAN NOT NULL DEFAULT true,
                                                                              notes TEXT,
                                                                                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                UNIQUE(test_type, parameter_name, protocol_version)
                                                                                                    );
                                                                                                      `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_tests_instrument ON qc_activimetro_tests(instrument_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_tests_date ON qc_activimetro_tests(test_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_tests_type ON qc_activimetro_tests(test_type);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_readings_test ON qc_activimetro_readings(test_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_tolerances_type ON qc_activimetro_tolerances(test_type, active);`;

  await seedDefaultTolerances();

  ensured = true;
}

/**
 * Valores por defecto tomados del documento Google Sheet proporcionado por el
 * usuario (Anexo_QA_08_Activimetro_TECDOC602). Se insertan solo si la tabla
 * esta vacia, para no sobrescribir ajustes posteriores del Fisico Medico/OPR.
 * IMPORTANTE: ante ambiguedad en el documento fuente, el valor se marca en
 * notes como "REVISAR CON FISICO MEDICO" en lugar de inventarse.
 */
async function seedDefaultTolerances() {
    const { rows: existing } = await sql`SELECT COUNT(*)::int AS count FROM qc_activimetro_tolerances`;
    if (existing[0]?.count > 0) return;

  const rows: Array<{
        test_type: ActivimetroTestType;
        parameter_name: string;
        tolerance_percent: number | null;
        num_readings_required: number | null;
        notes: string | null;
  }> = [
    { test_type: "precision", parameter_name: "cv_percent", tolerance_percent: 5, num_readings_required: 10, notes: null },
    { test_type: "exactitud", parameter_name: "percent_difference", tolerance_percent: 5, num_readings_required: 3, notes: null },
    { test_type: "linealidad", parameter_name: "percent_difference", tolerance_percent: 10, num_readings_required: 5, notes: null },
    { test_type: "respuesta_fondo", parameter_name: "measured_value", tolerance_percent: null, num_readings_required: 1, notes: "REVISAR CON FISICO MEDICO: tolerancia absoluta segun fondo habitual del equipo" },
    { test_type: "geometria_volumen", parameter_name: "percent_difference", tolerance_percent: 10, num_readings_required: 1, notes: null },
      ];

  for (const row of rows) {
        await sql`
              INSERT INTO qc_activimetro_tolerances
                      (test_type, parameter_name, tolerance_percent, reference_source, protocol_version, num_readings_required, notes)
                            VALUES
                                    (${row.test_type}, ${row.parameter_name}, ${row.tolerance_percent}, 'Documento QA Activimetro proporcionado por usuario', '1.0', ${row.num_readings_required}, ${row.notes})
                                          ON CONFLICT (test_type, parameter_name, protocol_version) DO NOTHING;
                                              `;
  }
}
