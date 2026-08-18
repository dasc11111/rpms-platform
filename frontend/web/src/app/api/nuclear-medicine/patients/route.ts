import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 1 - Medicina Nuclear: vista de trazabilidad de solo lectura.
// Combina i131_administrations y room_release_records usando paciente_run
// como llave comun (ya existe en ambas tablas). No modifica ni escribe
// datos en ninguna tabla existente.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const params: unknown[] = [];
  let whereClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    whereClause = "WHERE paciente_run ILIKE $1 OR paciente_nombre ILIKE $1";
  }

  const query = `
    WITH combined AS (
      SELECT
        paciente_run,
        paciente_nombre,
        admin_date::date AS event_date,
        'i131'::text AS origen
      FROM i131_administrations
      WHERE paciente_run IS NOT NULL AND btrim(paciente_run) <> ''
      UNION ALL
      SELECT
        paciente_run,
        paciente_nombre,
        release_date::date AS event_date,
        'room_release'::text AS origen
      FROM room_release_records
      WHERE paciente_run IS NOT NULL AND btrim(paciente_run) <> ''
    )
    SELECT
      paciente_run,
      (array_agg(paciente_nombre ORDER BY event_date DESC NULLS LAST))[1] AS paciente_nombre,
      COUNT(*) FILTER (WHERE origen = 'i131')::int AS total_administraciones,
      COUNT(*) FILTER (WHERE origen = 'room_release')::int AS total_liberaciones,
      MAX(event_date) AS ultima_actividad,
      MIN(event_date) AS primera_actividad
    FROM combined
    ${whereClause}
    GROUP BY paciente_run
    ORDER BY ultima_actividad DESC NULLS LAST
    LIMIT 200
  `;

  const { rows } = await sql.query(query, params);

  return NextResponse.json({ rows });
}
