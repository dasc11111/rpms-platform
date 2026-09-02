import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Medicina Nuclear (Contaminacion): columnas adicionales opcionales "hora_medicion"
// y "opr" para completar los campos exigidos por el Prompt Maestro Medicina
// Nuclear, seccion 10 (fecha, hora, radionuclido, sala, area, punto de medicion,
// detector, CPS medidos, CPS fondo, CPS netos, uSv/h, eficiencia, area activa,
// Bq/cm2, responsable, OPR, observaciones). No modifica ni elimina columnas
// existentes, no cambia los registros actuales. Idempotente: puede ejecutarse
// mas de una vez sin efectos adversos.

export async function GET() {
  await sql`ALTER TABLE contamination_records ADD COLUMN IF NOT EXISTS hora_medicion TEXT`;
  await sql`ALTER TABLE contamination_records ADD COLUMN IF NOT EXISTS opr TEXT`;

return NextResponse.json({ ok: true });
}
