import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRoomClearanceSchema } from "@/lib/room-clearance-db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  await ensureRoomClearanceSchema();

  const { rows: resumenRows } = await sql`
    SELECT
      COUNT(*) FILTER (WHERE eval_date = CURRENT_DATE)::int AS hoy,
      COUNT(*) FILTER (WHERE date_trunc('month', eval_date) = date_trunc('month', CURRENT_DATE))::int AS mes,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado_general_laboratorio = 'liberado')::int AS lab_liberados,
      COUNT(*) FILTER (WHERE estado_general_sala = 'liberado')::int AS sala_liberados,
      COUNT(*) FILTER (WHERE estado_general_laboratorio IN ('requiere_descontaminacion', 'no_liberado'))::int AS lab_contaminados,
      COUNT(*) FILTER (WHERE estado_general_sala IN ('requiere_descontaminacion', 'no_liberado'))::int AS sala_contaminados,
      COUNT(*) FILTER (WHERE estado_general_laboratorio = 'requiere_descontaminacion' OR estado_general_sala = 'requiere_descontaminacion')::int AS descontaminaciones
    FROM room_clearance_evaluations
  `;
  const resumen = resumenRows[0] ?? {};

  const { rows: puntosRows } = await sql`
    SELECT
      AVG(bq_cm2)::float AS avg_bq_cm2,
      AVG(tasa_dosis_usv_h)::float AS avg_usv_h,
      MAX(bq_cm2)::float AS max_bq_cm2,
      COUNT(*) FILTER (WHERE cumple = false)::int AS puntos_sobre_limite
    FROM room_clearance_points
  `;
  const puntos = puntosRows[0] ?? {};

  const { rows: puntoMaxRows } = await sql`
    SELECT p.punto, p.area_tipo, p.bq_cm2, p.semaforo, e.eval_date, e.id AS evaluation_id
    FROM room_clearance_points p
    JOIN room_clearance_evaluations e ON e.id = p.evaluation_id
    ORDER BY p.bq_cm2 DESC NULLS LAST
    LIMIT 1
  `;
  const puntoMax = puntoMaxRows[0] ?? null;

  const { rows: historialMensual } = await sql`
    SELECT
      to_char(date_trunc('month', eval_date), 'YYYY-MM') AS mes,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado_general_laboratorio = 'liberado' AND estado_general_sala = 'liberado')::int AS liberados
    FROM room_clearance_evaluations
    GROUP BY 1
    ORDER BY 1
  `;

  const { rows: distribucionRadionuclido } = await sql`
    SELECT radionuclido, COUNT(*)::int AS total
    FROM room_clearance_evaluations
    GROUP BY radionuclido
    ORDER BY total DESC
  `;

  return NextResponse.json({
    hoy: resumen.hoy ?? 0,
    mes: resumen.mes ?? 0,
    total: resumen.total ?? 0,
    lab_liberados: resumen.lab_liberados ?? 0,
    sala_liberados: resumen.sala_liberados ?? 0,
    lab_contaminados: resumen.lab_contaminados ?? 0,
    sala_contaminados: resumen.sala_contaminados ?? 0,
    descontaminaciones: resumen.descontaminaciones ?? 0,
    avg_bq_cm2: puntos.avg_bq_cm2 ?? 0,
    avg_usv_h: puntos.avg_usv_h ?? 0,
    max_bq_cm2: puntos.max_bq_cm2 ?? 0,
    puntos_sobre_limite: puntos.puntos_sobre_limite ?? 0,
    punto_max: puntoMax,
    historial_mensual: historialMensual,
    distribucion_radionuclido: distribucionRadionuclido,
  });
}
