import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await sql`
    CREATE TABLE IF NOT EXISTS workers (
      id SERIAL PRIMARY KEY,
      rut TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      service TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      annual_dose NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_readings (
      id SERIAL PRIMARY KEY,
      worker_rut TEXT,
      worker_name TEXT NOT NULL,
      dosimeter_type TEXT,
      period TEXT NOT NULL,
      dose NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'read',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (worker_name, period, dosimeter_type)
    );
  `;

  const { rows: workerCount } = await sql`SELECT COUNT(*)::int AS count FROM workers`;
  if (workerCount[0].count === 0) {
    await sql`
      INSERT INTO workers (rut, name, role, service, category, status, annual_dose) VALUES
      ('17.245.892-0', 'Javiera Muñoz', 'Físico Médico', 'Radioterapia', 'A', 'active', 3.2),
      ('18.123.456-3', 'Marcelo Rojas', 'Tecnólogo Médico', 'Medicina Nuclear', 'A', 'active', 4.1),
      ('15.987.654-3', 'Camila Torres', 'Ingeniero', 'Biomédica', 'B', 'active', 0.8),
      ('16.456.789-3', 'Andrés Silva', 'Radiofarmaceuta', 'Medicina Nuclear', 'A', 'suspended', 2.4)
      ON CONFLICT (rut) DO NOTHING;
    `;
  }

  const { rows: readingCount } = await sql`SELECT COUNT(*)::int AS count FROM dosimetry_readings`;
  if (readingCount[0].count === 0) {
    await sql`
      INSERT INTO dosimetry_readings (worker_rut, worker_name, dosimeter_type, period, dose, status) VALUES
      ('17.245.892-0', 'Javiera Muñoz', 'TLD cuerpo entero', '2026-06', 0.28, 'read'),
      ('18.123.456-3', 'Marcelo Rojas', 'TLD cuerpo entero', '2026-06', 0.34, 'read'),
      ('15.987.654-3', 'Camila Torres', 'OSL anillo', '2026-06', 0.05, 'read'),
      ('16.456.789-3', 'Andrés Silva', 'TLD cuerpo entero', '2026-06', 0.19, 'pending'),
      ('16.456.789-3', 'Andrés Silva', 'TLD cuerpo entero', '2026-05', 0.22, 'lost')
      ON CONFLICT (worker_name, period, dosimeter_type) DO NOTHING;
    `;
  }

  return NextResponse.json({ ok: true });
}
