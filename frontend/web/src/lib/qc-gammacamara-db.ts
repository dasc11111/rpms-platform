import { sql } from "@/lib/db";

/**
 * MODULO 2 - GAMMACAMARA
 * Esquema de base de datos para el sistema de Control de Calidad.
 *
 * Referencia tecnica principal: IAEA TECDOC-602 "Quality Control Atlas for
 * Scintillation Camera Systems" (uniformidad, resolucion espacial y
 * sensibilidad para camaras gamma planares).
 *
 * Principios aplicados (Prompt maestro CC de Control de Calidad):
 * - Modulo independiente del Modulo 1 (Activimetro): pruebas, parametros,
 *   tolerancias y frecuencias propias de Gammacamara; no se mezclan logicas
 *   entre modulos.
 * - El operador ingresa unicamente los valores medidos/reportados por el
 *   equipo (uniformidad integral/diferencial calculada por el propio
 *   software de la gammacamara, lecturas de resolucion o de sensibilidad);
 *   el sistema clasifica el resultado contra tolerancia, nunca al reves.
 * - Tolerancias configurables en tabla separada, con trazabilidad de version
 *   y fuente de referencia utilizada en cada prueba.
 * - Las lecturas originales nunca se eliminan tras el calculo.
 * - frequency_days permite avisar con anticipacion cuando corresponda repetir
 *   cada prueba, y alertar si existe retraso (mismo requisito que Modulo 1).
 */

let ensured = false;

export type GammacamaraTestType = "uniformidad" | "resolucion" | "sensibilidad";
export type GammacamaraTestMode = "intrinseca" | "extrinseca" | "na";

export async function ensureGammacamaraQcTables() {
  if (ensured) return;

  // Tabla de cabecera: una fila por prueba/sesion de control de calidad
  await sql`
    CREATE TABLE IF NOT EXISTS qc_gammacamara_tests (
      id SERIAL PRIMARY KEY,
      instrument_id INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
      instrument_code TEXT,
      instrument_name TEXT,
      test_type TEXT NOT NULL,
      test_mode TEXT NOT NULL DEFAULT 'na',
      test_date DATE NOT NULL,
      test_time TIME,
      performed_by TEXT,
      opr_reviewed_by TEXT,
      radionuclide TEXT,
      reference_source TEXT NOT NULL DEFAULT 'IAEA TECDOC-602',
      protocol_version TEXT,
      num_readings INTEGER,
      mean_value NUMERIC,
      stddev_value NUMERIC,
      cv_percent NUMERIC,
      reference_value NUMERIC,
      percent_difference NUMERIC,
      tolerance_percent NUMERIC,
      tolerance_parameter TEXT,
      integral_percent NUMERIC,
      differential_percent NUMERIC,
      integral_status TEXT,
      differential_status TEXT,
      worst_parameter TEXT,
      half_life_minutes NUMERIC,
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
    CREATE TABLE IF NOT EXISTS qc_gammacamara_readings (
      id SERIAL PRIMARY KEY,
      test_id INTEGER NOT NULL REFERENCES qc_gammacamara_tests(id) ON DELETE CASCADE,
      reading_index INTEGER NOT NULL,
      reading_label TEXT,
      parameter_name TEXT,
      measured_value NUMERIC NOT NULL,
      unit TEXT,
      elapsed_time_minutes NUMERIC,
      measured_at TIMESTAMPTZ,
      metadata JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Tabla de configuracion de tolerancias: PRUEBA -> MODO -> PARAMETRO -> TOLERANCIA
  await sql`
    CREATE TABLE IF NOT EXISTS qc_gammacamara_tolerances (
      id SERIAL PRIMARY KEY,
      test_type TEXT NOT NULL,
      test_mode TEXT NOT NULL DEFAULT 'na',
      parameter_name TEXT NOT NULL,
      tolerance_percent NUMERIC,
      tolerance_absolute NUMERIC,
      warning_percent NUMERIC,
      reference_source TEXT NOT NULL,
      protocol_version TEXT NOT NULL DEFAULT '1.0',
      num_readings_required INTEGER,
      frequency_days INTEGER,
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(test_type, test_mode, parameter_name, protocol_version)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_tests_instrument ON qc_gammacamara_tests(instrument_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_tests_date ON qc_gammacamara_tests(test_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_tests_type ON qc_gammacamara_tests(test_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_readings_test ON qc_gammacamara_readings(test_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_gamma_tolerances_type ON qc_gammacamara_tolerances(test_type, active);`;

  await seedDefaultTolerances();

  ensured = true;
}

/**
 * Valores por defecto basados en IAEA TECDOC-602 (criterios generales de
 * uniformidad, resolucion y sensibilidad para camaras gamma planares).
 * Se insertan solo si la tabla esta vacia, para no sobrescribir ajustes
 * posteriores del Fisico Medico/OPR. Ante ambiguedad o dependencia del
 * fabricante/modelo especifico, el valor se marca en notes como
 * "REVISAR CON FISICO MEDICO" en lugar de inventarse.
 */
async function seedDefaultTolerances() {
  const { rows: existing } = await sql`SELECT COUNT(*)::int AS count FROM qc_gammacamara_tolerances`;
  if (existing[0]?.count > 0) return;

  const rows: Array<{
    test_type: GammacamaraTestType;
    test_mode: GammacamaraTestMode;
    parameter_name: string;
    tolerance_percent: number | null;
    num_readings_required: number | null;
    frequency_days: number | null;
    notes: string | null;
  }> = [
    {
      test_type: "uniformidad",
      test_mode: "intrinseca",
      parameter_name: "integral_percent",
      tolerance_percent: 5,
      num_readings_required: 1,
      frequency_days: 1,
      notes: "REVISAR CON FISICO MEDICO: criterio generico IAEA TECDOC-602 (sin colimador); ajustar segun manual del fabricante y antiguedad del equipo",
    },
    {
      test_type: "uniformidad",
      test_mode: "intrinseca",
      parameter_name: "differential_percent",
      tolerance_percent: 5,
      num_readings_required: 1,
      frequency_days: 1,
      notes: "REVISAR CON FISICO MEDICO: criterio generico IAEA TECDOC-602 (sin colimador); ajustar segun manual del fabricante y antiguedad del equipo",
    },
    {
      test_type: "uniformidad",
      test_mode: "extrinseca",
      parameter_name: "integral_percent",
      tolerance_percent: 5,
      num_readings_required: 1,
      frequency_days: 7,
      notes: "REVISAR CON FISICO MEDICO: frecuencia semanal asumida para uniformidad extrinseca (con colimador); ajustar segun protocolo institucional",
    },
    {
      test_type: "uniformidad",
      test_mode: "extrinseca",
      parameter_name: "differential_percent",
      tolerance_percent: 5,
      num_readings_required: 1,
      frequency_days: 7,
      notes: "REVISAR CON FISICO MEDICO: frecuencia semanal asumida para uniformidad extrinseca (con colimador); ajustar segun protocolo institucional",
    },
    {
      test_type: "resolucion",
      test_mode: "na",
      parameter_name: "fwhm_percent_change",
      tolerance_percent: 10,
      num_readings_required: 1,
      frequency_days: 90,
      notes: "REVISAR CON FISICO MEDICO: tolerancia expresada como variacion % respecto de la resolucion basal establecida en la prueba de aceptacion; frecuencia trimestral asumida",
    },
    {
      test_type: "sensibilidad",
      test_mode: "na",
      parameter_name: "percent_difference",
      tolerance_percent: 10,
      num_readings_required: 1,
      frequency_days: 90,
      notes: "REVISAR CON FISICO MEDICO: tolerancia expresada como variacion % respecto de la sensibilidad basal establecida en la prueba de aceptacion; frecuencia trimestral asumida",
    },
  ];

  for (const row of rows) {
    await sql`
      INSERT INTO qc_gammacamara_tolerances
        (test_type, test_mode, parameter_name, tolerance_percent, reference_source, protocol_version, num_readings_required, frequency_days, notes)
      VALUES
        (${row.test_type}, ${row.test_mode}, ${row.parameter_name}, ${row.tolerance_percent}, 'IAEA TECDOC-602', '1.0', ${row.num_readings_required}, ${row.frequency_days}, ${row.notes})
      ON CONFLICT (test_type, test_mode, parameter_name, protocol_version) DO NOTHING;
    `;
  }
}
