import { sql } from "./db";

// Creacion perezosa (idempotente) de las tablas del modulo "Liberacion de
// Sala": evaluaciones diarias de contaminacion superficial (Laboratorio y
// Sala de Pacientes) y sus puntos de medicion. No requiere modificar
// /api/init: se auto-inicializa la primera vez que se usa cualquier
// endpoint de /api/room-clearance, igual patron que dosimeters-db.ts.
let ensured = false;

export async function ensureRoomClearanceSchema(): Promise<void> {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS room_clearance_evaluations (
      id SERIAL PRIMARY KEY,
      eval_date DATE NOT NULL,
      responsable TEXT NOT NULL,
      radionuclido TEXT NOT NULL DEFAULT 'TC-99M',
      instrumento_utilizado TEXT,
      observaciones_generales TEXT,
      estado_general_laboratorio TEXT NOT NULL DEFAULT 'liberado',
      resumen_laboratorio JSONB,
      estado_general_sala TEXT NOT NULL DEFAULT 'liberado',
      resumen_sala JSONB,
      usuario TEXT,
      version_formulario TEXT NOT NULL DEFAULT '1.0',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_clearance_eval_date ON room_clearance_evaluations(eval_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_clearance_responsable ON room_clearance_evaluations(lower(responsable))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_clearance_radionuclido ON room_clearance_evaluations(radionuclido)`;

  await sql`
    CREATE TABLE IF NOT EXISTS room_clearance_points (
      id SERIAL PRIMARY KEY,
      evaluation_id INTEGER NOT NULL REFERENCES room_clearance_evaluations(id) ON DELETE CASCADE,
      area_tipo TEXT NOT NULL,
      punto TEXT NOT NULL,
      cps_medida NUMERIC NOT NULL DEFAULT 0,
      cps_fondo NUMERIC NOT NULL DEFAULT 0,
      tasa_dosis_usv_h NUMERIC,
      cps_neto NUMERIC NOT NULL DEFAULT 0,
      bq_cm2 NUMERIC NOT NULL DEFAULT 0,
      bq_m2 NUMERIC NOT NULL DEFAULT 0,
      pct_limite NUMERIC,
      clasificacion TEXT NOT NULL DEFAULT 'sin_contaminacion',
      semaforo TEXT NOT NULL DEFAULT 'verde',
      cumple BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_clearance_points_eval ON room_clearance_points(evaluation_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_clearance_points_area ON room_clearance_points(area_tipo)`;

  // Limites de contaminacion superficial para los radionuclidos especificos
  // de este modulo que aun no existieran en la tabla general de limites
  // (contamination_limits), reutilizando el mismo esquema de umbrales
  // Registro/Investigacion/Intervencion ya validado en el modulo de
  // Registro de Contaminacion.
  await sql`
    INSERT INTO contamination_limits (radionuclido, limite_bq_m2, pct_registro, pct_investigacion, pct_intervencion, notas)
    VALUES
      ('LU-177', 370000, 5, 30, 50, 'Valor por defecto configurable para Lu-177, consistente con el nivel de referencia generico. Debe ser validado por el OPR segun normativa vigente.'),
      ('GA-68', 370000, 5, 30, 50, 'Valor por defecto configurable para Ga-68, consistente con el nivel de referencia generico. Debe ser validado por el OPR segun normativa vigente.')
    ON CONFLICT (radionuclido) DO NOTHING
  `;

  ensured = true;
}
