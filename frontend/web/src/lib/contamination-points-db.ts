// Modulo Contaminacion - Puntos de medicion configurables (Seccion 12 del
// PROMPT MAESTRO CLAUDE CHROME - MEDICINA NUCLEAR).
//
// El modulo "Liberacion de Sala" (src/lib/room-clearance.ts) ya usa una lista
// fija de puntos por area (Laboratorio / Sala de Pacientes), correcta y en
// produccion (RC_LABORATORIO_PUNTOS / RC_SALA_PACIENTES_PUNTOS); esta tabla
// NO la reemplaza ni la modifica. Esta tabla agrega la misma capacidad -lista
// predefinida y editable de puntos de medicion- al registro general de
// "Contaminacion" (formulario libre por area/sala/punto), que hasta ahora
// solo ofrecia autocompletado basado en historial de uso (ver
// contamination_field_suggestions / /api/contamination/suggestions), sin una
// lista de referencia oficial ni botones de seleccion rapida (Seccion 11).
//
// Idempotente: CREATE TABLE IF NOT EXISTS + seed solo si la tabla esta vacia.
//
// Seccion 12: NO incluir "Capacho plomado" en la lista (exclusion explicita
// del prompt maestro). No se agrega ninguna fila con ese nombre.
//
// Seccion 13: "Almohada" debe evaluarse bajo el mismo criterio de
// contaminacion que "Ropa de cama"; no se crea un criterio ni un limite
// independiente para ella (los limites del modulo Contaminacion se
// configuran por radionuclido en contamination_limits, no por punto de
// medicion), salvo que una referencia oficial aplicable establezca uno
// expresamente en el futuro.

import { sql } from "@/lib/db";

export const CONTAMINATION_POINT_CATEGORIES = ["LABORATORIO", "SALA_PACIENTES", "OTRO"] as const;
export type ContaminationPointCategory = (typeof CONTAMINATION_POINT_CATEGORIES)[number];

export const CONTAMINATION_POINT_CATEGORY_LABELS: Record<ContaminationPointCategory, string> = {
  LABORATORIO: "Laboratorio",
  SALA_PACIENTES: "Sala de pacientes",
  OTRO: "Otro",
};

export type ContaminationMeasurementPoint = {
  id: number;
  categoria: ContaminationPointCategory;
  nombre: string;
  activo: boolean;
  orden: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

let ensured = false;
export async function ensureContaminationMeasurementPoints(): Promise<void> {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS contamination_measurement_points (
      id SERIAL PRIMARY KEY,
      categoria TEXT NOT NULL,
      nombre TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      orden INTEGER NOT NULL DEFAULT 0,
      notas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (categoria, nombre)
    );
  `;

  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM contamination_measurement_points`;
  if ((rows[0]?.count ?? 0) === 0) {
    await sql`
      INSERT INTO contamination_measurement_points (categoria, nombre, orden, notas) VALUES
      ('LABORATORIO', 'Mesón de laboratorio', 1, NULL),
      ('LABORATORIO', 'Bandejas', 2, NULL),
      ('LABORATORIO', 'Mesa de punción', 3, NULL),
      ('LABORATORIO', 'Portajeringas', 4, NULL),
      ('LABORATORIO', 'Camilla de laboratorio', 5, NULL),
      ('LABORATORIO', 'Piso de gammacámara', 6, NULL),
      ('SALA_PACIENTES', 'Sala del paciente', 1, NULL),
      ('SALA_PACIENTES', 'Cama', 2, NULL),
      ('SALA_PACIENTES', 'Ropa de cama', 3, NULL),
      ('SALA_PACIENTES', 'Almohada', 4, 'Mismo criterio de contaminación que "Ropa de cama" (Sección 13 del Prompt Maestro de Medicina Nuclear). No tiene límite independiente salvo referencia oficial expresa.'),
      ('SALA_PACIENTES', 'Piso baño del paciente', 5, NULL),
      ('SALA_PACIENTES', 'WC del paciente', 6, NULL),
      ('SALA_PACIENTES', 'Lavamanos del paciente', 7, NULL),
      ('SALA_PACIENTES', 'Piso baño del personal', 8, NULL),
      ('SALA_PACIENTES', 'Lavamanos baño del personal', 9, NULL),
      ('SALA_PACIENTES', 'Basurero cortopunzante', 10, NULL)
      ON CONFLICT (categoria, nombre) DO NOTHING;
    `;
  }
  ensured = true;
}
