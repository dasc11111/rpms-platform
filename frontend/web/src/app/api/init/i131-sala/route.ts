import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Medicina Nuclear (Administracion de I-131): columna adicional opcional
// "sala" para habilitar la trazabilidad Administracion -> Sala ->
// Contaminacion -> Liberacion de Sala -> Desechos (Prompt Maestro Medicina
// Nuclear, secciones 9 y 49). No modifica ni elimina columnas existentes,
// no cambia los registros actuales. Idempotente: puede ejecutarse mas de
// una vez sin efectos adversos.

export async function GET() {
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS sala TEXT`;

  return NextResponse.json({ ok: true });
}
