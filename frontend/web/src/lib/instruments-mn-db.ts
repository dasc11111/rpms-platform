import { sql } from "@/lib/db";

// Fase 15 (Medicina Nuclear) - ARPANSA RPS 14.2, Seccion 15 (Base DETECTORES).
// Extension aditiva y NO destructiva del modulo general de Instrumentos y
// Calibracion ya existente en la plataforma. No se crea una tabla ni un
// modulo nuevo: se reutiliza el ya existente (reglas 2/32 y 16/32 de Fase 0
// - no duplicar modulos, priorizar reciclaje de codigo). Los campos son
// NULLABLE, no afectan instrumentos de otras areas y no modifican registros
// historicos existentes (regla 24/32).
let ensured = false;

export async function ensureInstrumentMnColumns(): Promise<void> {
  if (ensured) return;
  await sql`ALTER TABLE instruments ADD COLUMN IF NOT EXISTS radionuclide TEXT`;
  await sql`ALTER TABLE instruments ADD COLUMN IF NOT EXISTS efficiency_pct NUMERIC`;
  await sql`ALTER TABLE instruments ADD COLUMN IF NOT EXISTS active_area_cm2 NUMERIC`;
  await sql`ALTER TABLE instruments ADD COLUMN IF NOT EXISTS geometry TEXT`;
  ensured = true;
}
