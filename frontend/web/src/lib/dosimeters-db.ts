// Creacion perezosa (idempotente) de las tablas del modulo de Asignacion de
// Dosimetros. Se invoca al inicio de cada endpoint para asegurar que el
// esquema exista sin depender de una migracion manual en la base de datos.
import { sql } from "@/lib/db";

let ensured = false;

export async function ensureDosimeterTables(): Promise<void> {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimeters (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'cuerpo_entero',
      status TEXT NOT NULL DEFAULT 'disponible',
      worker_rut TEXT,
      worker_name TEXT,
      service TEXT,
      unit TEXT,
      delivery_date DATE,
      estimated_return_date DATE,
      actual_return_date DATE,
      observations TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimeter_assignments (
      id SERIAL PRIMARY KEY,
      dosimeter_id INT NOT NULL REFERENCES dosimeters(id) ON DELETE CASCADE,
      worker_rut TEXT NOT NULL,
      worker_name TEXT,
      service TEXT,
      unit TEXT,
      delivery_date DATE,
      estimated_return_date DATE,
      actual_return_date DATE,
      status_at_close TEXT,
      observations TEXT,
      closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimeter_history (
      id SERIAL PRIMARY KEY,
      dosimeter_id INT NOT NULL,
      changed_by TEXT,
      changed_at TIMESTAMP DEFAULT now(),
      field_name TEXT,
      old_value TEXT,
      new_value TEXT
    )
  `;

  ensured = true;
}
