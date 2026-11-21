import { sql } from "@/lib/db";

/**
 * MODULO 3 - SPECT
 * Esquema de base de datos para el sistema de Control de Calidad.
 *
 * Referencia tecnica principal: IAEA TECDOC-602 "Quality Control Atlas for
 * Scintillation Camera Systems" (seccion de pruebas especificas de SPECT).
 *
 * Principios aplicados (Prompt maestro CC de Control de Calidad):
 * - Modulo independiente de Modulo 1 (Activimetro) y Modulo 2 (Gammacamara):
 *   pruebas, parametros, tolerancias y frecuencias propias de SPECT; no se
 *   mezclan logicas entre modulos, y no se traslada automaticamente una
 *   prueba de gammacamara planar a SPECT.
 * - Las pruebas de este modulo son especificas de la adquisicion tomografica
 *   (rotacion del cabezal/gantry y reconstruccion), distintas de las pruebas
 *   planares ya cubiertas por Modulo 2 (uniformidad, resolucion, sensibilidad
 *   de la camara como detector plano):
 *     1) Centro de Rotacion (COR): verifica el alineamiento entre el eje
 *        mecanico de rotacion del cabezal y el eje electronico/de imagen
 *        asumido por el algoritmo de reconstruccion. Se expresa como una
 *        desviacion en pixeles respecto del valor ideal (0).
 *     2) Uniformidad Tomografica: uniformidad evaluada sobre cortes
 *        reconstruidos de un maniqui cilindrico uniforme, distinta de la
 *        uniformidad planar de flood (Modulo 2), porque la retroproyeccion
 *        puede amplificar pequenas no uniformidades no visibles en la
 *        imagen planar.
 * - El operador ingresa unicamente los valores medidos/reportados por el
 *   equipo o por el software de control de calidad del SPECT; el sistema
 *   clasifica el resultado contra tolerancia, nunca al reves.
 * - Tolerancias configurables en tabla separada, con trazabilidad de version
 *   y fuente de referencia utilizada en cada prueba.
 * - Las lecturas originales nunca se eliminan tras el calculo.
 * - frequency_days permite avisar con anticipacion cuando corresponda repetir
 *   cada prueba, y alertar si existe retraso (mismo requisito que Modulo 1 y
 *   Modulo 2).
 */

let ensured = false;

export type SpectTestType = "centro_rotacion" | "uniformidad_tomografica";

export async function ensureSpectQcTables() {
  if (ensured) return;

  // Tabla de cabecera: una fila por prueba/sesion de control de calidad
  await sql`
    CREATE TABLE IF NOT EXISTS qc_spect_tests (
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
      reference_source TEXT NOT NULL DEFAULT 'IAEA TECDOC-602',
      protocol_version TEXT,
      num_readings INTEGER,
      mean_value NUMERIC,
      stddev_value NUMERIC,
      cv_percent NUMERIC,
      reference_value NUMERIC,
      absolute_difference NUMERIC,
      percent_value NUMERIC,
      tolerance_percent NUMERIC,
      tolerance_absolute NUMERIC,
      tolerance_parameter TEXT,
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
    CREATE TABLE IF NOT EXISTS qc_spect_readings (
      id SERIAL PRIMARY KEY,
      test_id INTEGER NOT NULL REFERENCES qc_spect_tests(id) ON DELETE CASCADE,
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

  // Tabla de configuracion de tolerancias: PRUEBA -> PARAMETRO -> TOLERANCIA
  // (no requiere test_mode: a diferencia de Modulo 2, ninguna de las dos
  // pruebas de este modulo tiene una distincion analoga a intrinseca/
  // extrinseca segun IAEA TECDOC-602).
  await sql`
    CREATE TABLE IF NOT EXISTS qc_spect_tolerances (
      id SERIAL PRIMARY KEY,
      test_type TEXT NOT NULL,
      parameter_name TEXT NOT NULL,
      tolerance_percent NUMERIC,
      tolerance_absolute NUMERIC,
      warning_percent NUMERIC,
      warning_absolute NUMERIC,
      reference_source TEXT NOT NULL,
      protocol_version TEXT NOT NULL DEFAULT '1.0',
      num_readings_required INTEGER,
      frequency_days INTEGER,
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(test_type, parameter_name, protocol_version)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_tests_instrument ON qc_spect_tests(instrument_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_tests_date ON qc_spect_tests(test_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_tests_type ON qc_spect_tests(test_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_readings_test ON qc_spect_readings(test_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_spect_tolerances_type ON qc_spect_tolerances(test_type, active);`;

  await seedDefaultTolerances();

  ensured = true;
}

/**
 * Valores por defecto basados en IAEA TECDOC-602 (criterios generales de
 * Centro de Rotacion y Uniformidad Tomografica para sistemas SPECT). Se
 * insertan solo si la tabla esta vacia, para no sobrescribir ajustes
 * posteriores del Fisico Medico/OPR. Ante ambiguedad o dependencia del
 * fabricante/modelo especifico, el valor se marca en notes como
 * "REVISAR CON FISICO MEDICO" en lugar de inventarse.
 */
async function seedDefaultTolerances() {
  const { rows: existing } = await sql`SELECT COUNT(*)::int AS count FROM qc_spect_tolerances`;
  if (existing[0]?.count > 0) return;

  const rows: Array<{
    test_type: SpectTestType;
    parameter_name: string;
    tolerance_percent: number | null;
    tolerance_absolute: number | null;
    num_readings_required: number | null;
    frequency_days: number | null;
    notes: string | null;
  }> = [
    {
      test_type: "centro_rotacion",
      parameter_name: "cor_offset_pixels",
      tolerance_percent: null,
      tolerance_absolute: 0.5,
      num_readings_required: 4,
      frequency_days: 30,
      notes:
        "REVISAR CON FISICO MEDICO: tolerancia generica IAEA TECDOC-602 de +/-0.5 pixel respecto del centro de rotacion ideal; numero de lecturas (proyecciones/cabezales) y frecuencia mensual asumidos, ajustar segun manual del fabricante y protocolo institucional",
    },
    {
      test_type: "uniformidad_tomografica",
      parameter_name: "uniformity_percent",
      tolerance_percent: 10,
      tolerance_absolute: null,
      num_readings_required: 1,
      frequency_days: 30,
      notes:
        "REVISAR CON FISICO MEDICO: tolerancia expresada como % de uniformidad integral en cortes reconstruidos del maniqui cilindrico uniforme; valor y frecuencia mensual asumidos, ajustar segun manual del fabricante y protocolo institucional",
    },
  ];

  for (const row of rows) {
    await sql`
      INSERT INTO qc_spect_tolerances
        (test_type, parameter_name, tolerance_percent, tolerance_absolute, reference_source, protocol_version, num_readings_required, frequency_days, notes)
      VALUES
        (${row.test_type}, ${row.parameter_name}, ${row.tolerance_percent}, ${row.tolerance_absolute}, 'IAEA TECDOC-602', '1.0', ${row.num_readings_required}, ${row.frequency_days}, ${row.notes})
      ON CONFLICT (test_type, parameter_name, protocol_version) DO NOTHING;
    `;
  }
}
