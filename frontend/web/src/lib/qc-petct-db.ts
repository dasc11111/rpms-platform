import { sql } from "@/lib/db";

/**
 * MODULO 4 - PET/CT
 * Esquema de base de datos para el sistema de Control de Calidad.
 *
 * Referencia tecnica principal: IAEA Human Health Series No. 1, "Quality
 * Assurance for PET and PET/CT Systems" (2009). NO IDENTIFICADO EN IAEA
 * TECDOC-602: ese documento (1991, "Quality Control Atlas for Scintillation
 * Camera Systems") es anterior a la adopcion clinica generalizada de PET y
 * no cubre pruebas especificas de PET/CT; por eso este modulo usa una
 * referencia tecnica distinta a Modulo 2 (Gammacamara) y Modulo 3 (SPECT),
 * documentada explicitamente en cada registro (reference_source).
 *
 * Principios aplicados (Prompt maestro CC de Control de Calidad):
 * - Modulo independiente de Modulo 1 (Activimetro), Modulo 2 (Gammacamara) y
 *   Modulo 3 (SPECT): pruebas, parametros, tolerancias y frecuencias propias
 *   de PET/CT; no se traslada automaticamente ninguna prueba de gammacamara
 *   planar ni de SPECT a este modulo.
 * - Las pruebas de este modulo son especificas de la fisica de deteccion en
 *   coincidencia y de la cuantificacion (SUV) del PET, distintas de las
 *   pruebas de camara planar/SPECT:
 *   1) Calibracion Cruzada (Cross-Calibration): verifica que la
 *      concentracion de actividad (Bq/mL) reportada por el software del
 *      PET, para un maniqui/fuente de actividad conocida, concuerde con la
 *      concentracion de referencia obtenida a partir de la medicion del
 *      activimetro. Es la base de la exactitud cuantitativa (SUV) y no
 *      tiene equivalente en Modulo 2 ni Modulo 3.
 *   2) Uniformidad de Imagen PET: uniformidad evaluada sobre cortes
 *      reconstruidos de un maniqui cilindrico uniforme adquirido en el PET,
 *      distinta de la uniformidad planar (Modulo 2) y de la uniformidad
 *      tomografica SPECT (Modulo 3), porque la reconstruccion PET involucra
 *      correccion de atenuacion, dispersion y coincidencias aleatorias que
 *      no existen en SPECT/gammacamara.
 * - El componente CT del equipo hibrido PET/CT (control de calidad
 *   radiologico: numero CT, ruido, espesor de corte, dosis) NO esta
 *   cubierto por este modulo. NO IDENTIFICADO EN EL ALCANCE DE ESTE MODULO:
 *   requiere un modulo de Control de Calidad de Tomografia Computarizada
 *   independiente (fuera del alcance de Medicina Nuclear / ARPANSA RPS
 *   14.2), que no se crea en esta fase.
 * - El operador ingresa unicamente los valores medidos/reportados por el
 *   equipo o por el software de control de calidad del PET; el sistema
 *   clasifica el resultado contra tolerancia, nunca al reves.
 * - Tolerancias configurables en tabla separada, con trazabilidad de version
 *   y fuente de referencia utilizada en cada prueba.
 * - Las lecturas originales nunca se eliminan tras el calculo.
 * - frequency_days permite avisar con anticipacion cuando corresponda repetir
 *   cada prueba, y alertar si existe retraso (mismo requisito que Modulo 1,
 *   Modulo 2 y Modulo 3).
 */

let ensured = false;

export type PetCtTestType = "calibracion_cruzada" | "uniformidad_imagen";

export async function ensurePetCtQcTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS qc_petct_tests (
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
      reference_source TEXT NOT NULL DEFAULT 'IAEA Human Health Series No. 1',
      protocol_version TEXT,
      num_readings INTEGER,
      mean_value NUMERIC,
      stddev_value NUMERIC,
      cv_percent NUMERIC,
      reference_value NUMERIC,
      measured_value NUMERIC,
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

  await sql`
    CREATE TABLE IF NOT EXISTS qc_petct_readings (
      id SERIAL PRIMARY KEY,
      test_id INTEGER NOT NULL REFERENCES qc_petct_tests(id) ON DELETE CASCADE,
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

  await sql`
    CREATE TABLE IF NOT EXISTS qc_petct_tolerances (
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

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_tests_instrument ON qc_petct_tests(instrument_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_tests_date ON qc_petct_tests(test_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_tests_type ON qc_petct_tests(test_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_readings_test ON qc_petct_readings(test_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_petct_tolerances_type ON qc_petct_tolerances(test_type, active);`;

  await seedDefaultTolerances();

  ensured = true;
}

/**
 * Valores por defecto. La bibliografia especializada en PET/CT (a diferencia
 * de IAEA TECDOC-602 para gammacamara/SPECT) no fija un unico valor de
 * tolerancia universal para calibracion cruzada ni uniformidad: dependen del
 * fabricante, del algoritmo de reconstruccion y del protocolo institucional.
 * Se insertan solo si la tabla esta vacia, para no sobrescribir ajustes
 * posteriores del Fisico Medico/OPR. Ante ambiguedad, el valor se marca en
 * notes como "REVISAR CON FISICO MEDICO" en lugar de inventarse sin aviso.
 */
async function seedDefaultTolerances() {
  const { rows: existing } = await sql`SELECT COUNT(*)::int AS count FROM qc_petct_tolerances`;
  if (existing[0]?.count > 0) return;

  const rows: Array<{
    test_type: PetCtTestType;
    parameter_name: string;
    tolerance_percent: number | null;
    tolerance_absolute: number | null;
    num_readings_required: number | null;
    frequency_days: number | null;
    notes: string | null;
  }> = [
    {
      test_type: "calibracion_cruzada",
      parameter_name: "activity_deviation_percent",
      tolerance_percent: 10,
      tolerance_absolute: null,
      num_readings_required: 1,
      frequency_days: 90,
      notes:
        "REVISAR CON FISICO MEDICO: tolerancia generica de +/-10% entre la concentracion de actividad reportada por el PET y la de referencia (activimetro), basada en practica clinica habitual (IAEA Human Health Series No. 1); frecuencia trimestral asumida, ajustar segun manual del fabricante y protocolo institucional",
    },
    {
      test_type: "uniformidad_imagen",
      parameter_name: "uniformity_percent",
      tolerance_percent: 15,
      tolerance_absolute: null,
      num_readings_required: 1,
      frequency_days: 30,
      notes:
        "REVISAR CON FISICO MEDICO: tolerancia expresada como % de uniformidad integral en cortes reconstruidos del maniqui cilindrico uniforme adquirido en el PET; valor y frecuencia mensual asumidos, ajustar segun manual del fabricante y protocolo institucional",
    },
  ];

  for (const row of rows) {
    await sql`
      INSERT INTO qc_petct_tolerances
        (test_type, parameter_name, tolerance_percent, tolerance_absolute, reference_source, protocol_version, num_readings_required, frequency_days, notes)
      VALUES
        (${row.test_type}, ${row.parameter_name}, ${row.tolerance_percent}, ${row.tolerance_absolute}, 'IAEA Human Health Series No. 1', '1.0', ${row.num_readings_required}, ${row.frequency_days}, ${row.notes})
      ON CONFLICT (test_type, parameter_name, protocol_version) DO NOTHING;
    `;
  }
}
