import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 Art. 10: Dosis efectiva a miembros del público no debe superar 1 mSv/año.
// Este módulo estima y registra la dosis anual a grupos críticos del público.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public_dose_records (
      id              SERIAL PRIMARY KEY,
      year            INTEGER     NOT NULL,
      quarter         INTEGER     CHECK (quarter BETWEEN 1 AND 4),
      group_name      TEXT        NOT NULL,
      location        TEXT,
      dose_msv        NUMERIC(10,4) NOT NULL,
      dose_basis      TEXT,
      calculation_method TEXT     NOT NULL DEFAULT 'measurement',
      notes           TEXT,
      reviewed_by     TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public_dose_annual_summary (
      id              SERIAL PRIMARY KEY,
      year            INTEGER     NOT NULL UNIQUE,
      max_dose_msv    NUMERIC(10,4),
      avg_dose_msv    NUMERIC(10,4),
      groups_assessed INTEGER,
      limit_msv       NUMERIC(10,4) DEFAULT 1.0,
      compliant       BOOLEAN,
      reviewer        TEXT,
      report_date     DATE,
      observations    TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM public_dose_records LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO public_dose_records
        (year, quarter, group_name, location, dose_msv, dose_basis, calculation_method)
      VALUES
        (${y}, 1, 'Pacientes en sala de espera MN',  'Medicina Nuclear – sala espera', 0.0082, 'Medición directa tasa de dosis × tiempo permanencia estimado', 'measurement'),
        (${y}, 1, 'Personal administrativo colindante','Hospital – oficina 2° piso',    0.0031, 'Medición ambiental punto MN-04 × 2000h/año laboral',           'calculation'),
        (${y}, 2, 'Pacientes en sala de espera MN',  'Medicina Nuclear – sala espera', 0.0075, 'Medición directa tasa de dosis × tiempo permanencia estimado', 'measurement'),
        (${y}, 2, 'Personal administrativo colindante','Hospital – oficina 2° piso',    0.0028, 'Medición ambiental punto MN-04 × 2000h/año laboral',           'calculation'),
        (${y}, 3, 'Pacientes en sala de espera MN',  'Medicina Nuclear – sala espera', 0.0091, 'Medición directa tasa de dosis × tiempo permanencia estimado', 'measurement'),
        (${y}, 3, 'Personal administrativo colindante','Hospital – oficina 2° piso',    0.0034, 'Medición ambiental punto MN-04 × 2000h/año laboral',           'calculation')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ?? String(new Date().getFullYear());

  try {
    const { rows: records } = await sql`
      SELECT * FROM public_dose_records WHERE year = ${parseInt(year)}
      ORDER BY quarter, group_name
    `;

    // Annual totals per group
    const { rows: byGroup } = await sql`
      SELECT group_name, year,
        SUM(dose_msv)  AS total_dose_msv,
        COUNT(*)       AS quarters_reported,
        MAX(location)  AS location
      FROM public_dose_records
      WHERE year = ${parseInt(year)}
      GROUP BY group_name, year
      ORDER BY total_dose_msv DESC
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(DISTINCT group_name) AS groups,
        SUM(dose_msv)              AS total_dose,
        MAX(dose_msv)              AS max_quarterly,
        MIN(year)                  AS first_year,
        MAX(year)                  AS last_year
      FROM public_dose_records
      WHERE year = ${parseInt(year)}
    `;

    // Check vs 1 mSv limit
    const maxAnnual = byGroup.reduce((m, r) => Math.max(m, parseFloat(r.total_dose_msv)), 0);
    const compliant = maxAnnual < 1.0;

    // Available years
    const { rows: years } = await sql`
      SELECT DISTINCT year FROM public_dose_records ORDER BY year DESC
    `;

    return NextResponse.json({ records, byGroup, stats: stats[0], compliant, maxAnnual, years: years.map(r => r.year) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.year || !body.group_name || body.dose_msv == null) {
      return NextResponse.json({ error: "year, group_name y dose_msv son obligatorios" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO public_dose_records
        (year, quarter, group_name, location, dose_msv, dose_basis, calculation_method, notes, reviewed_by)
      VALUES
        (${body.year}, ${body.quarter ?? null}, ${body.group_name}, ${body.location ?? null},
         ${body.dose_msv}, ${body.dose_basis ?? null}, ${body.calculation_method ?? "measurement"},
         ${body.notes ?? null}, ${body.reviewed_by ?? null})
      RETURNING *
    `;
    return NextResponse.json({ record: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM public_dose_records WHERE id=${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
