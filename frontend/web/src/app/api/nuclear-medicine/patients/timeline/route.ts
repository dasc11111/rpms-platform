import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 1 - Medicina Nuclear: linea de tiempo de solo lectura para un
// paciente especifico, identificado por paciente_run. Combina
// i131_administrations y room_release_records. No modifica datos.
//
// La comparacion se hace sobre una version normalizada del RUN (solo
// digitos y K) para incluir registros aunque el RUN este guardado con
// distinto formato (con o sin puntos/guion) en cada tabla de origen.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = (searchParams.get("run") ?? "").trim();

  if (!run) {
    return NextResponse.json({ error: "Parametro 'run' es obligatorio" }, { status: 400 });
  }

  const query = `
    SELECT
      'i131'::text AS origen,
      id,
      admin_date::date AS event_date,
      paciente_nombre,
      paciente_run,
      radiofarmaco AS detalle_principal,
      dosis_administrada::numeric AS valor,
      'mCi'::text AS unidad,
      medico_solicitante AS responsable,
      diagnostico AS contexto,
      notas AS observaciones
    FROM i131_administrations
    WHERE regexp_replace(upper(paciente_run), '[^0-9K]', '', 'g') = regexp_replace(upper($1), '[^0-9K]', '', 'g')
    UNION ALL
    SELECT
      'room_release'::text AS origen,
      id,
      release_date::date AS event_date,
      paciente_nombre,
      paciente_run,
      sala AS detalle_principal,
      actividad_medida_liberacion::numeric AS valor,
      COALESCE(unidad_actividad, 'mCi')::text AS unidad,
      responsable_opr AS responsable,
      criterio_liberacion AS contexto,
      observaciones
    FROM room_release_records
    WHERE regexp_replace(upper(paciente_run), '[^0-9K]', '', 'g') = regexp_replace(upper($1), '[^0-9K]', '', 'g')
    ORDER BY event_date ASC NULLS LAST
  `;

  const { rows } = await sql.query(query, [run]);

  return NextResponse.json({ rows });
}
