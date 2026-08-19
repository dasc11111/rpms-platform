import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 1 - Medicina Nuclear: linea de tiempo de solo lectura para un
// paciente especifico, identificado por paciente_run. Combina
// i131_administrations y room_release_records. No modifica datos.
//
// Fase 3 (Base de datos y trazabilidad): se agrega un tercer origen,
// "residuo" (radioactive_waste_labels), enlazado a traves de la relacion
// ya existente room_release_id -> room_release_records.id (definida
// desde el modulo de Gestion de Residuos Radiactivos). No se agrega
// ningun campo nuevo ni se solicita informacion adicional: el RUN y
// nombre del paciente se obtienen del Acta de Liberacion de Sala
// asociada, igual que ya lo hace el propio rotulo de residuo.
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
    UNION ALL
    SELECT
      'residuo'::text AS origen,
      wl.id,
      wl.generation_date::date AS event_date,
      rr.paciente_nombre,
      rr.paciente_run,
      wl.label_number AS detalle_principal,
      wl.actividad_estimada_residual::numeric AS valor,
      COALESCE(wl.unidad_actividad, 'mCi')::text AS unidad,
      wl.responsible AS responsable,
      wl.waste_type AS contexto,
      wl.observations AS observaciones
    FROM radioactive_waste_labels wl
    JOIN room_release_records rr ON rr.id = wl.room_release_id
    WHERE regexp_replace(upper(rr.paciente_run), '[^0-9K]', '', 'g') = regexp_replace(upper($1), '[^0-9K]', '', 'g')
    ORDER BY event_date ASC NULLS LAST
  `;

  const { rows } = await sql.query(query, [run]);

  return NextResponse.json({ rows });
}
