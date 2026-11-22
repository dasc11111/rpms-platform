import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §78 — Declaración Anual de Dosis ante CCHEN
// DS 3/1985 Art. 10 + NS-06.0 §4.4: Todo establecimiento que utilice
// radiaciones ionizantes debe declarar anualmente las dosis recibidas por
// el personal POE ante la CCHEN, en los plazos y formatos establecidos.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_declarations (
      id                SERIAL PRIMARY KEY,
      declaration_code  TEXT        NOT NULL UNIQUE,
      year              INTEGER     NOT NULL,
      establishment_name TEXT       NOT NULL DEFAULT 'Hospital Dr. Hernán Henríquez Aravena',
      establishment_rut  TEXT       DEFAULT '61.606.400-5',
      cchen_license      TEXT,
      responsible_pr     TEXT,
      responsible_rut    TEXT,
      responsible_title  TEXT,
      total_poe          INTEGER,
      total_poe_dosimetry INTEGER,
      poe_male           INTEGER,
      poe_female         INTEGER,
      avg_dose_mSv       NUMERIC(6,3),
      max_dose_mSv       NUMERIC(6,3),
      total_collective_mSv NUMERIC(10,3),
      poe_over_1mSv      INTEGER,
      poe_over_6mSv      INTEGER,
      poe_over_15mSv     INTEGER,
      poe_over_20mSv     INTEGER,
      poe_pregnant       INTEGER     DEFAULT 0,
      poe_apprentice     INTEGER     DEFAULT 0,
      incidents_count    INTEGER     DEFAULT 0,
      work_areas_count   INTEGER,
      radiation_sources  TEXT,
      submission_date    DATE,
      submitted_by       TEXT,
      cchen_receipt_number TEXT,
      status             TEXT        NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','ready','submitted','acknowledged','corrected')),
      observations       TEXT,
      active             BOOLEAN     DEFAULT true,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_declaration_workers (
      id                SERIAL PRIMARY KEY,
      declaration_id    INTEGER     REFERENCES cchen_declarations(id) ON DELETE CASCADE,
      worker_rut        TEXT        NOT NULL,
      worker_name       TEXT        NOT NULL,
      worker_gender     TEXT        CHECK (worker_gender IN ('M','F')),
      worker_dob        DATE,
      job_title         TEXT,
      work_area         TEXT,
      dosimeter_type    TEXT,
      annual_dose_mSv   NUMERIC(6,3) NOT NULL DEFAULT 0,
      h10_dose_mSv      NUMERIC(6,3),
      hp007_dose_mSv    NUMERIC(6,3),
      internal_dose_mSv NUMERIC(6,3) DEFAULT 0,
      effective_dose_mSv NUMERIC(6,3),
      is_pregnant       BOOLEAN     DEFAULT false,
      is_apprentice     BOOLEAN     DEFAULT false,
      notes             TEXT
    )
  `;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function nextCode(year: number): Promise<string> {
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*) AS n FROM cchen_declarations WHERE year=$1`, [year]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `DECL-CCHEN-${year}-${String(n).padStart(2, "0")}`;
}

async function computeFromDosimetry(year: number) {
  return safeQuery(async () => {
    const { rows } = await sql.unsafe(
      `SELECT
        COUNT(DISTINCT worker_id)::int             AS total_poe_dosimetry,
        ROUND(AVG(annual_dose_mSv)::numeric, 3)    AS avg_dose,
        ROUND(MAX(annual_dose_mSv)::numeric, 3)    AS max_dose,
        ROUND(SUM(annual_dose_mSv)::numeric, 3)    AS collective_dose,
        COUNT(*) FILTER (WHERE annual_dose_mSv > 1)::int   AS over_1,
        COUNT(*) FILTER (WHERE annual_dose_mSv > 6)::int   AS over_6,
        COUNT(*) FILTER (WHERE annual_dose_mSv > 15)::int  AS over_15,
        COUNT(*) FILTER (WHERE annual_dose_mSv > 20)::int  AS over_20
       FROM (
         SELECT worker_id, SUM(dose_msv) AS annual_dose_mSv
         FROM dosimetry_records
         WHERE EXTRACT(YEAR FROM reading_date)=$1
           AND dose_type = 'effective'
         GROUP BY worker_id
       ) sub`,
      [year]
    );
    return rows[0] ?? {};
  }, {});
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM cchen_declarations`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear() - 1; // Last complete year
  const code = `DECL-CCHEN-${year}-01`;
  const seeds = [
    {
      declaration_code: code, year,
      establishment_name: "Hospital Dr. Hernán Henríquez Aravena",
      establishment_rut: "61.606.400-5",
      cchen_license: "CCHEN-LIC-2023-MN-0045",
      responsible_pr: "TM. Diego Solís Catalán",
      responsible_rut: "16.397.583-1",
      responsible_title: "Encargado de Protección Radiológica",
      total_poe: 32,
      total_poe_dosimetry: 30,
      poe_male: 18,
      poe_female: 14,
      avg_dose_mSv: 2.14,
      max_dose_mSv: 8.70,
      total_collective_mSv: 64.2,
      poe_over_1mSv: 24,
      poe_over_6mSv: 3,
      poe_over_15mSv: 0,
      poe_over_20mSv: 0,
      poe_pregnant: 0,
      poe_apprentice: 2,
      incidents_count: 1,
      work_areas_count: 5,
      radiation_sources: "Generadores de rayos X, fuentes selladas Tc-99m, I-131, I-125; aceleradores lineales no aplica",
      submission_date: `${year + 1}-03-31`,
      submitted_by: "TM. Diego Solís Catalán",
      cchen_receipt_number: `REC-CCHEN-${year + 1}-0892`,
      status: "acknowledged",
      observations: `Declaración anual año ${year} presentada dentro del plazo reglamentario. 1 incidente INES-0 registrado en julio ${year} (derrame menor I-131), sin exposición excesiva. 3 trabajadores superaron nivel de acción 6 mSv, con evaluación ALARA iniciada.`,
    },
    {
      declaration_code: `DECL-CCHEN-${year + 1}-01`,
      year: year + 1,
      establishment_name: "Hospital Dr. Hernán Henríquez Aravena",
      establishment_rut: "61.606.400-5",
      cchen_license: "CCHEN-LIC-2023-MN-0045",
      responsible_pr: "TM. Diego Solís Catalán",
      responsible_rut: "16.397.583-1",
      responsible_title: "Encargado de Protección Radiológica",
      total_poe: 34,
      total_poe_dosimetry: 32,
      poe_male: 19,
      poe_female: 15,
      avg_dose_mSv: 1.95,
      max_dose_mSv: 7.20,
      total_collective_mSv: 62.4,
      poe_over_1mSv: 22,
      poe_over_6mSv: 1,
      poe_over_15mSv: 0,
      poe_over_20mSv: 0,
      poe_pregnant: 1,
      poe_apprentice: 2,
      incidents_count: 0,
      work_areas_count: 5,
      radiation_sources: "Generadores de rayos X, fuentes selladas Tc-99m, I-131, I-125",
      status: "ready",
      observations: `Declaración anual año ${year + 1} en preparación. Se proyecta mejora en dosis promedio respecto al año anterior. 1 trabajadora embarazada con reasignación preventiva a área de baja exposición desde semana 8. Sin incidentes radiológicos.`,
    },
  ];

  for (const s of seeds) {
    const keys = Object.keys(s);
    const vals = Object.values(s);
    await sql.unsafe(
      `INSERT INTO cchen_declarations (${keys.join(",")})
       VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})
       ON CONFLICT (declaration_code) DO NOTHING`,
      vals
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const declId   = sp.get("decl_id");
    const compute  = sp.get("compute"); // ?compute=YYYY
    const year     = sp.get("year");

    // Auto-compute from dosimetry table
    if (compute) {
      const data = await computeFromDosimetry(parseInt(compute));
      return NextResponse.json({ computed: data, year: parseInt(compute) });
    }

    // Workers for a specific declaration
    if (declId) {
      const { rows } = await sql.unsafe(
        `SELECT * FROM cchen_declaration_workers WHERE declaration_id=$1 ORDER BY worker_name`,
        [parseInt(declId)]
      );
      return NextResponse.json({ workers: rows });
    }

    const conditions: string[] = [`d.active=true`];
    const params: unknown[] = [];
    if (year) { params.push(parseInt(year)); conditions.push(`d.year=$${params.length}`); }

    const { rows } = await sql.unsafe(
      `SELECT d.*,
        (SELECT COUNT(*) FROM cchen_declaration_workers w WHERE w.declaration_id=d.id)::int AS workers_count
       FROM cchen_declarations d
       WHERE ${conditions.join(" AND ")}
       ORDER BY d.year DESC`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='acknowledged')::int AS acknowledged,
          COUNT(*) FILTER (WHERE status='submitted')::int AS submitted,
          COUNT(*) FILTER (WHERE status IN ('draft','ready'))::int AS pending,
          MAX(year)::int AS latest_year
        FROM cchen_declarations WHERE active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ declarations: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "worker") {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      const { rows } = await sql.unsafe(
        `INSERT INTO cchen_declaration_workers (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
        vals
      );
      return NextResponse.json({ worker: rows[0] }, { status: 201 });
    }

    const yr = data.year ?? (new Date().getFullYear() - 1);
    const code = data.declaration_code || await nextCode(yr);
    const fields = { declaration_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO cchen_declarations (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ declaration: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { _type, id, ...rest } = body;
    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);

    if (_type === "worker") {
      const { rows } = await sql.unsafe(
        `UPDATE cchen_declaration_workers SET ${set} WHERE id=$${values.length} RETURNING *`,
        values
      );
      return NextResponse.json({ worker: rows[0] });
    }

    const { rows } = await sql.unsafe(
      `UPDATE cchen_declarations SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ declaration: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { _type, id } = await req.json();
    if (_type === "worker") {
      await sql.unsafe(`DELETE FROM cchen_declaration_workers WHERE id=$1`, [id]);
    } else {
      await sql.unsafe(`UPDATE cchen_declarations SET active=false, updated_at=now() WHERE id=$1`, [id]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
