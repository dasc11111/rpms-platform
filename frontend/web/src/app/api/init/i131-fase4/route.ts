import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 4 - Medicina Nuclear (Administracion de radiofarmacos/I-131):
// columnas adicionales, todas opcionales (NULL permitido), para registrar
// controles de seguridad radiologica descritos en ARPANSA RPS 14.2
// (Seccion 4.3 Patient Identification and Procedure Confirmation,
    // Seccion 4.4 Radionuclide Therapy Procedures, Clausula 3.1.7(b) doble
    // verificacion de actividad dispensada para terapia). No modifica ni
// elimina columnas existentes, no cambia los registros actuales.
// Idempotente: puede ejecutarse mas de una vez sin efectos adversos.

export async function GET() {
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS tipo_procedimiento TEXT`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS identidad_confirmada BOOLEAN`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS embarazo_descartado TEXT`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS fecha_test_embarazo DATE`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS lactancia_consultada TEXT`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS segunda_verificacion_responsable TEXT`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS bloqueo_tiroideo_considerado TEXT`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS actividad_dentro_tolerancia BOOLEAN`;
    await sql`ALTER TABLE i131_administrations ADD COLUMN IF NOT EXISTS informacion_radioproteccion_entregada BOOLEAN`;

    return NextResponse.json({ ok: true });
  }
