import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fase 1 - Medicina Nuclear: vista de trazabilidad de solo lectura.
// Combina i131_administrations y room_release_records usando paciente_run
// como llave comun (ya existe en ambas tablas). No modifica ni escribe
// datos en ninguna tabla existente.
//
// Fase 3 (Base de datos y trazabilidad): se agrega un tercer origen,
// "residuo" (radioactive_waste_labels), enlazado mediante la relacion ya
// existente room_release_id -> room_release_records.id. Se usa el mismo
// paciente_run/paciente_nombre del Acta de Liberacion de Sala asociada;
// no se solicita ni se guarda informacion nueva.
//
// Fase 24A: se agrega un cuarto origen, "petct" (petct_examinations),
// usando patient_id como equivalente de paciente_run. La tabla usa
// patient_id/patient_name en lugar de paciente_run/paciente_nombre,
// pero la normalizacion de RUN aplica igual para agrupar correctamente.
// Solo se lee; no se modifica ninguna tabla existente.
//
// Nota sobre formato de RUN: el RUN puede estar guardado con o sin
// puntos/guion segun el modulo de origen (ej. "13961611-1" vs
// "13.961.611-1"). Para evitar duplicar al mismo paciente en el listado,
// se agrupa por una version normalizada del RUN (solo digitos y K, en
// mayuscula), calculada al vuelo unicamente para esta comparacion. El
// dato original en cada tabla NO se modifica ni se sobrescribe.

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
      UNION ALL
      SELECT
        rr.paciente_run,
        rr.paciente_nombre,
        wl.generation_date::date AS event_date,
        'residuo'::text AS origen
      FROM radioactive_waste_labels wl
      JOIN room_release_records rr ON rr.id = wl.room_release_id
      WHERE rr.paciente_run IS NOT NULL AND btrim(rr.paciente_run) <> ''
      UNION ALL
      SELECT
        patient_id AS paciente_run,
        patient_name AS paciente_nombre,
        injection_datetime::date AS event_date,
        'petct'::text AS origen
      FROM petct_examinations
      WHERE patient_id IS NOT NULL AND btrim(patient_id) <> ''
    ),
    normalized AS (
      SELECT
        *,
        regexp_replace(upper(paciente_run), '[^0-9K]', '', 'g') AS run_normalizado
      FROM combined
    )
    SELECT
      run_normalizado,
      (array_agg(paciente_run ORDER BY event_date DESC NULLS LAST))[1] AS paciente_run,
      (array_agg(paciente_nombre ORDER BY event_date DESC NULLS LAST))[1] AS paciente_nombre,
      COUNT(*) FILTER (WHERE origen = 'i131')::int AS total_administraciones,
      COUNT(*) FILTER (WHERE origen = 'room_release')::int AS total_liberaciones,
      COUNT(*) FILTER (WHERE origen = 'residuo')::int AS total_residuos,
      COUNT(*) FILTER (WHERE origen = 'petct')::int AS total_petct,
      COUNT(DISTINCT paciente_run)::int AS variantes_run,
      MAX(event_date) AS ultima_actividad,
      MIN(event_date) AS primera_actividad
    FROM normalized
    ${whereClause}
    GROUP BY run_normalizado
    ORDER BY ultima_actividad DESC NULLS LAST
    LIMIT 200
  `;

  try {
    const { rows } = await sql.query(query, params);
    return NextResponse.json({ rows });
  } catch (err) {
    // petct_examinations may not exist yet — degrade gracefully
    console.warn("[nm/patients] petct_examinations not available, falling back:", err);
    const fallbackQuery = `
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
        UNION ALL
        SELECT
          rr.paciente_run,
          rr.paciente_nombre,
          wl.generation_date::date AS event_date,
          'residuo'::text AS origen
        FROM radioactive_waste_labels wl
        JOIN room_release_records rr ON rr.id = wl.room_release_id
        WHERE rr.paciente_run IS NOT NULL AND btrim(rr.paciente_run) <> ''
      ),
      normalized AS (
        SELECT
          *,
          regexp_replace(upper(paciente_run), '[^0-9K]', '', 'g') AS run_normalizado
        FROM combined
      )
      SELECT
        run_normalizado,
        (array_agg(paciente_run ORDER BY event_date DESC NULLS LAST))[1] AS paciente_run,
        (array_agg(paciente_nombre ORDER BY event_date DESC NULLS LAST))[1] AS paciente_nombre,
        COUNT(*) FILTER (WHERE origen = 'i131')::int AS total_administraciones,
        COUNT(*) FILTER (WHERE origen = 'room_release')::int AS total_liberaciones,
        COUNT(*) FILTER (WHERE origen = 'residuo')::int AS total_residuos,
        0::int AS total_petct,
        COUNT(DISTINCT paciente_run)::int AS variantes_run,
        MAX(event_date) AS ultima_actividad,
        MIN(event_date) AS primera_actividad
      FROM normalized
      ${whereClause}
      GROUP BY run_normalizado
      ORDER BY ultima_actividad DESC NULLS LAST
      LIMIT 200
    `;
    const { rows } = await sql.query(fallbackQuery, params);
    return NextResponse.json({ rows });
  }
}
