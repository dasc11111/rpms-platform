import { sql } from "@/lib/db";

let ensured = false;

export async function ensureQualityControlTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS quality_control_tests (
      id SERIAL PRIMARY KEY,
      instrument_id INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
      instrument_code TEXT,
      instrument_name TEXT,
      test_type TEXT NOT NULL,
      test_date DATE NOT NULL,
      performed_by TEXT,
      radionuclide TEXT,
      measured_value NUMERIC,
      reference_value NUMERIC,
      unit TEXT,
      tolerance_percent NUMERIC,
      deviation_percent NUMERIC,
      result_status TEXT NOT NULL DEFAULT 'pendiente_revision',
      corrective_action TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_tests_instrument ON quality_control_tests(instrument_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_tests_date ON quality_control_tests(test_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_qc_tests_type ON quality_control_tests(test_type);`;

  ensured = true;
}
