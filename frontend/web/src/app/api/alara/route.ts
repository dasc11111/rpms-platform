import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS alara_actions (
      id               SERIAL PRIMARY KEY,
      year             INT NOT NULL,
      quarter          INT,
      service          TEXT,
      action_type      TEXT NOT NULL DEFAULT 'optimizacion',
      title            TEXT NOT NULL,
      description      TEXT,
      rationale        TEXT,
      expected_benefit TEXT,
      dose_reduction_pct NUMERIC(5,1),
      responsible      TEXT,
      status           TEXT NOT NULL DEFAULT 'planificado',
      start_date       DATE,
      end_date         DATE,
      completion_date  DATE,
      actual_reduction_pct NUMERIC(5,1),
      verified_by      TEXT,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS alara_dose_constraints (
      id            SERIAL PRIMARY KEY,
      service       TEXT NOT NULL,
      role          TEXT,
      constraint_msv NUMERIC(8,3) NOT NULL,
      limit_msv      NUMERIC(8,3) NOT NULL DEFAULT 20,
      year           INT NOT NULL,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

// GET — collective dose summary + actions
export async function GET(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "summary";
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  if (resource === "actions") {
    const { rows } = await sql`
      SELECT * FROM alara_actions
      ORDER BY year DESC, quarter, created_at DESC
    `;
    return NextResponse.json({ actions: rows });
  }

  if (resource === "constraints") {
    const { rows } = await sql`
      SELECT * FROM alara_dose_constraints ORDER BY service, role
    `;
    return NextResponse.json({ constraints: rows });
  }

  // Default: collective dose summary from dosimetry_readings
  // Group by service and year
  const { rows: collective } = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio')       AS service,
      EXTRACT(YEAR FROM d.period_end)::int                         AS yr,
      COUNT(DISTINCT d.worker_id)::int                             AS worker_count,
      SUM(d.dose)::numeric(10,3)                                   AS collective_dose_msv,
      AVG(d.dose)::numeric(8,3)                                    AS avg_dose_msv,
      MAX(d.dose)::numeric(8,3)                                    AS max_dose_msv,
      COUNT(*) FILTER (WHERE d.dose > 6)::int                     AS above_constraint,
      COUNT(*) FILTER (WHERE d.dose > 20)::int                    AS above_limit,
      COUNT(*) FILTER (WHERE d.dose = 0 OR d.dose IS NULL)::int   AS zero_dose
    FROM dosimetry_readings d
    JOIN workers w ON w.id = d.worker_id
    WHERE EXTRACT(YEAR FROM d.period_end) = ${year}
      AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
    GROUP BY 1, 2
    ORDER BY collective_dose_msv DESC
  `;

  // Trend: last 5 years totals
  const { rows: trend } = await sql`
    SELECT
      EXTRACT(YEAR FROM d.period_end)::int AS yr,
      COUNT(DISTINCT d.worker_id)::int     AS workers,
      SUM(d.dose)::numeric(10,3)           AS collective_dose_msv,
      AVG(d.dose)::numeric(8,3)            AS avg_dose_msv,
      MAX(d.dose)::numeric(8,3)            AS max_dose_msv,
      COUNT(*) FILTER (WHERE d.dose > 20)::int AS exceeded_limit
    FROM dosimetry_readings d
    WHERE (d.body_region = 'whole_body' OR d.body_region IS NULL)
      AND EXTRACT(YEAR FROM d.period_end) >= ${year - 4}
    GROUP BY 1
    ORDER BY 1
  `;

  // ALARA actions for selected year
  const { rows: actions } = await sql`
    SELECT * FROM alara_actions WHERE year = ${year} ORDER BY quarter NULLS LAST, created_at
  `;

  // Constraints
  const { rows: constraints } = await sql`
    SELECT * FROM alara_dose_constraints WHERE year = ${year} ORDER BY service, role
  `;

  return NextResponse.json({ collective, trend, actions, constraints, year });
}

// POST
export async function POST(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "action";
  const body = await req.json();

  if (resource === "constraint") {
    const { service, role, constraint_msv, limit_msv, year, notes } = body;
    const { rows } = await sql`
      INSERT INTO alara_dose_constraints (service, role, constraint_msv, limit_msv, year, notes)
      VALUES (${service}, ${role ?? null}, ${constraint_msv}, ${limit_msv ?? 20}, ${year}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ constraint: rows[0] }, { status: 201 });
  }

  // default: action
  const {
    year, quarter, service, action_type, title, description, rationale,
    expected_benefit, dose_reduction_pct, responsible, status,
    start_date, end_date, completion_date, actual_reduction_pct, verified_by, notes,
  } = body;
  const { rows } = await sql`
    INSERT INTO alara_actions (
      year, quarter, service, action_type, title, description, rationale,
      expected_benefit, dose_reduction_pct, responsible, status,
      start_date, end_date, completion_date, actual_reduction_pct, verified_by, notes
    ) VALUES (
      ${year}, ${quarter ?? null}, ${service ?? null}, ${action_type ?? "optimizacion"},
      ${title}, ${description ?? null}, ${rationale ?? null},
      ${expected_benefit ?? null}, ${dose_reduction_pct ?? null}, ${responsible ?? null},
      ${status ?? "planificado"}, ${start_date ?? null}, ${end_date ?? null},
      ${completion_date ?? null}, ${actual_reduction_pct ?? null}, ${verified_by ?? null}, ${notes ?? null}
    ) RETURNING *
  `;
  return NextResponse.json({ action: rows[0] }, { status: 201 });
}

// PATCH
export async function PATCH(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "action";
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const body = await req.json();

  if (resource === "constraint") {
    const { service, role, constraint_msv, limit_msv, year, notes } = body;
    const { rows } = await sql`
      UPDATE alara_dose_constraints SET
        service        = COALESCE(${service ?? null}, service),
        role           = COALESCE(${role ?? null}, role),
        constraint_msv = COALESCE(${constraint_msv ?? null}::numeric, constraint_msv),
        limit_msv      = COALESCE(${limit_msv ?? null}::numeric, limit_msv),
        year           = COALESCE(${year ?? null}::int, year),
        notes          = COALESCE(${notes ?? null}, notes)
      WHERE id = ${parseInt(id, 10)}
      RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ constraint: rows[0] });
  }

  const {
    year, quarter, service, action_type, title, description, rationale,
    expected_benefit, dose_reduction_pct, responsible, status,
    start_date, end_date, completion_date, actual_reduction_pct, verified_by, notes,
  } = body;
  const { rows } = await sql`
    UPDATE alara_actions SET
      year                 = COALESCE(${year ?? null}::int, year),
      quarter              = COALESCE(${quarter ?? null}::int, quarter),
      service              = COALESCE(${service ?? null}, service),
      action_type          = COALESCE(${action_type ?? null}, action_type),
      title                = COALESCE(${title ?? null}, title),
      description          = COALESCE(${description ?? null}, description),
      rationale            = COALESCE(${rationale ?? null}, rationale),
      expected_benefit     = COALESCE(${expected_benefit ?? null}, expected_benefit),
      dose_reduction_pct   = COALESCE(${dose_reduction_pct ?? null}::numeric, dose_reduction_pct),
      responsible          = COALESCE(${responsible ?? null}, responsible),
      status               = COALESCE(${status ?? null}, status),
      start_date           = COALESCE(${start_date ?? null}::date, start_date),
      end_date             = COALESCE(${end_date ?? null}::date, end_date),
      completion_date      = COALESCE(${completion_date ?? null}::date, completion_date),
      actual_reduction_pct = COALESCE(${actual_reduction_pct ?? null}::numeric, actual_reduction_pct),
      verified_by          = COALESCE(${verified_by ?? null}, verified_by),
      notes                = COALESCE(${notes ?? null}, notes),
      updated_at           = NOW()
    WHERE id = ${parseInt(id, 10)}
    RETURNING *
  `;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ action: rows[0] });
}

// DELETE
export async function DELETE(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "action";
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (resource === "constraint") {
    await sql`DELETE FROM alara_dose_constraints WHERE id = ${parseInt(id, 10)}`;
  } else {
    await sql`DELETE FROM alara_actions WHERE id = ${parseInt(id, 10)}`;
  }
  return NextResponse.json({ ok: true });
}
