import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 3 - Medicina Nuclear (Base de datos y trazabilidad): indices
// adicionales de solo lectura para acelerar las busquedas por RUN de
// paciente que ya usaban Administracion de I-131 y Liberacion de Sala
// desde Fase 1/2 (vista "Pacientes y Tratamientos"). No crea tablas
// nuevas, no modifica columnas existentes, no cambia ni elimina datos.
// Idempotente: puede ejecutarse mas de una vez sin efectos adversos.

export async function GET() {
  await sql`CREATE INDEX IF NOT EXISTS idx_i131_paciente_run ON i131_administrations(paciente_run)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_i131_paciente_run_normalizado ON i131_administrations(regexp_replace(upper(paciente_run), '[^0-9K]', '', 'g'))`;

  await sql`CREATE INDEX IF NOT EXISTS idx_room_release_paciente_run ON room_release_records(paciente_run)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_release_paciente_run_normalizado ON room_release_records(regexp_replace(upper(paciente_run), '[^0-9K]', '', 'g'))`;

  return NextResponse.json({ ok: true });
}
