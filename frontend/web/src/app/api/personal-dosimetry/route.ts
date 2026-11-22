import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_workers (
      id SERIAL PRIMARY KEY,
      worker_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      rut TEXT,
      role TEXT,
      service TEXT,
      category TEXT DEFAULT 'A' CHECK (category IN ('A','B')),
      dosimeter_type TEXT DEFAULT 'tld' CHECK (dosimeter_type IN ('tld','osl','film','electronic','ring','neutron')),
      dosimeter_number TEXT,
      active BOOLEAN DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_records (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER REFERENCES dosimetry_workers(id) ON DELETE CASCADE,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      period_quarter INTEGER,
      period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly','quarterly','annual')),
      hp10_msv NUMERIC(8,4),
      hp007_msv NUMERIC(8,4),
      hp3_msv NUMERIC(8,4),
      effective_dose_msv NUMERIC(8,4),
      read_date DATE,
      read_by TEXT,
      dosimeter_id TEXT,
      service TEXT,
      area TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','read','validated','reported')),
      anomaly TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_annual_summary (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER REFERENCES dosimetry_workers(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      total_hp10_msv NUMERIC(8,4) DEFAULT 0,
      total_hp007_msv NUMERIC(8,4) DEFAULT 0,
      total_effective_msv NUMERIC(8,4) DEFAULT 0,
      limit_hp10_msv NUMERIC(8,4) DEFAULT 20,
      limit_hp007_msv NUMERIC(8,4) DEFAULT 500,
      limit_effective_msv NUMERIC(8,4) DEFAULT 20,
      percent_hp10 NUMERIC(5,1),
      percent_hp007 NUMERIC(5,1),
      percent_effective NUMERIC(5,1),
      alert_level TEXT DEFAULT 'normal' CHECK (alert_level IN ('normal','caution','warning','exceeded')),
      UNIQUE(worker_id, year)
    )
  `;

  const count = await sql`SELECT COUNT(*) as n FROM dosimetry_workers`;
  if (Number(count[0].n) === 0) {
    // Seed workers
    await sql`
      INSERT INTO dosimetry_workers (worker_code, full_name, rut, role, service, category, dosimeter_type, dosimeter_number) VALUES
      ('TM-001', 'Dr. Carlos Pérez Muñoz', '12.345.678-9', 'Radiólogo', 'Radiología', 'A', 'tld', 'TLD-2024-001'),
      ('TM-002', 'Dra. Ana González Vidal', '13.456.789-0', 'Radióloga', 'Radiología', 'A', 'tld', 'TLD-2024-002'),
      ('TM-003', 'Diego Solís Catalán', '16.397.583-1', 'Tecnólogo Médico', 'Protección Radiológica', 'A', 'tld', 'TLD-2024-003'),
      ('TM-004', 'María Elena Ruiz Torres', '14.567.890-1', 'TENS', 'Radiología', 'A', 'tld', 'TLD-2024-004'),
      ('TM-005', 'Roberto Soto Álvarez', '15.678.901-2', 'Tecnólogo Médico', 'Medicina Nuclear', 'A', 'tld', 'TLD-2024-005'),
      ('TM-006', 'Carmen López Fuentes', '11.234.567-8', 'Químico Farmacéutico', 'Radiofarmacia', 'A', 'osl', 'OSL-2024-006'),
      ('TM-007', 'Francisco Morales Jara', '17.890.123-4', 'Médico Intervencional', 'Hemodinamia', 'A', 'tld', 'TLD-2024-007'),
      ('TM-008', 'Patricia Vera Castillo', '10.123.456-7', 'TENS', 'Medicina Nuclear', 'B', 'tld', 'TLD-2024-008')
    `;

    // Seed 2024 annual summaries
    await sql`
      INSERT INTO dosimetry_annual_summary (worker_id, year, total_hp10_msv, total_hp007_msv, total_effective_msv, limit_hp10_msv, limit_hp007_msv, limit_effective_msv, percent_hp10, percent_hp007, percent_effective, alert_level)
      SELECT w.id, 2024,
        CASE w.worker_code
          WHEN 'TM-001' THEN 2.84
          WHEN 'TM-002' THEN 1.92
          WHEN 'TM-003' THEN 0.76
          WHEN 'TM-004' THEN 0.44
          WHEN 'TM-005' THEN 3.21
          WHEN 'TM-006' THEN 1.15
          WHEN 'TM-007' THEN 11.40
          WHEN 'TM-008' THEN 0.28
        END,
        CASE w.worker_code
          WHEN 'TM-001' THEN 15.2
          WHEN 'TM-002' THEN 9.8
          WHEN 'TM-003' THEN 3.4
          WHEN 'TM-004' THEN 2.1
          WHEN 'TM-005' THEN 18.6
          WHEN 'TM-006' THEN 5.8
          WHEN 'TM-007' THEN 42.3
          WHEN 'TM-008' THEN 1.2
        END,
        CASE w.worker_code
          WHEN 'TM-001' THEN 2.84
          WHEN 'TM-002' THEN 1.92
          WHEN 'TM-003' THEN 0.76
          WHEN 'TM-004' THEN 0.44
          WHEN 'TM-005' THEN 3.21
          WHEN 'TM-006' THEN 1.15
          WHEN 'TM-007' THEN 11.40
          WHEN 'TM-008' THEN 0.28
        END,
        20, 500, 20,
        CASE w.worker_code
          WHEN 'TM-001' THEN 14.2
          WHEN 'TM-002' THEN 9.6
          WHEN 'TM-003' THEN 3.8
          WHEN 'TM-004' THEN 2.2
          WHEN 'TM-005' THEN 16.1
          WHEN 'TM-006' THEN 5.8
          WHEN 'TM-007' THEN 57.0
          WHEN 'TM-008' THEN 1.4
        END,
        CASE w.worker_code
          WHEN 'TM-001' THEN 3.0
          WHEN 'TM-002' THEN 2.0
          WHEN 'TM-003' THEN 0.7
          WHEN 'TM-004' THEN 0.4
          WHEN 'TM-005' THEN 3.7
          WHEN 'TM-006' THEN 1.2
          WHEN 'TM-007' THEN 8.5
          WHEN 'TM-008' THEN 0.2
        END,
        CASE w.worker_code
          WHEN 'TM-001' THEN 14.2
          WHEN 'TM-002' THEN 9.6
          WHEN 'TM-003' THEN 3.8
          WHEN 'TM-004' THEN 2.2
          WHEN 'TM-005' THEN 16.1
          WHEN 'TM-006' THEN 5.8
          WHEN 'TM-007' THEN 57.0
          WHEN 'TM-008' THEN 1.4
        END,
        CASE w.worker_code
          WHEN 'TM-007' THEN 'warning'
          WHEN 'TM-005' THEN 'caution'
          ELSE 'normal'
        END
      FROM dosimetry_workers w
    `;

    // Seed 10 monthly records for 2024 (selected months for some workers)
    await sql`
      INSERT INTO dosimetry_records (worker_id, period_year, period_month, period_type, hp10_msv, hp007_msv, effective_dose_msv, read_date, read_by, dosimeter_id, service, area, status)
      SELECT w.id, r.yr, r.mo, 'monthly', r.hp10, r.hp007, r.hp10, (r.yr || '-' || LPAD(r.mo::text,2,'0') || '-28')::date, 'TLD Lab Santiago', w.dosimeter_number, w.service, 'General', 'validated'
      FROM dosimetry_workers w
      JOIN (VALUES
        ('TM-007', 2024, 10, 1.05, 4.2),
        ('TM-007', 2024, 11, 0.98, 3.8),
        ('TM-005', 2024, 10, 0.31, 1.9),
        ('TM-005', 2024, 11, 0.28, 1.6),
        ('TM-001', 2024, 10, 0.24, 1.3),
        ('TM-001', 2024, 11, 0.22, 1.1),
        ('TM-006', 2024, 10, 0.10, 0.5),
        ('TM-003', 2024, 10, 0.06, 0.3),
        ('TM-004', 2024, 10, 0.04, 0.2),
        ('TM-008', 2024, 10, 0.02, 0.1)
      ) AS r(wc, yr, mo, hp10, hp007) ON w.worker_code = r.wc
    `;
  }
}

export async function GET(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || "2024");
  const workerId = searchParams.get("worker_id");
  const service = searchParams.get("service");
  const alertLevel = searchParams.get("alert_level");
  const search = searchParams.get("search") || "";

  if (workerId) {
    // Monthly records for a specific worker
    const records = await sql`
      SELECT dr.*, dw.full_name, dw.worker_code, dw.role
      FROM dosimetry_records dr
      JOIN dosimetry_workers dw ON dw.id = dr.worker_id
      WHERE dr.worker_id = ${parseInt(workerId)}
        AND dr.period_year = ${year}
        AND dr.active = true
      ORDER BY dr.period_month DESC
    `;
    return NextResponse.json({ records });
  }

  // Worker annual summaries
  let query = sql`
    SELECT
      dw.id, dw.worker_code, dw.full_name, dw.rut, dw.role, dw.service,
      dw.category, dw.dosimeter_type, dw.dosimeter_number,
      s.year, s.total_hp10_msv, s.total_hp007_msv, s.total_effective_msv,
      s.limit_hp10_msv, s.limit_hp007_msv, s.limit_effective_msv,
      s.percent_hp10, s.percent_hp007, s.percent_effective,
      s.alert_level,
      (SELECT COUNT(*) FROM dosimetry_records r WHERE r.worker_id = dw.id AND r.period_year = ${year} AND r.active = true) as record_count,
      (SELECT MAX(r.read_date) FROM dosimetry_records r WHERE r.worker_id = dw.id AND r.active = true) as last_read_date
    FROM dosimetry_workers dw
    LEFT JOIN dosimetry_annual_summary s ON s.worker_id = dw.id AND s.year = ${year}
    WHERE dw.active = true
      AND (${search} = '' OR dw.full_name ILIKE ${'%' + search + '%'} OR dw.worker_code ILIKE ${'%' + search + '%'})
      AND (${service || ''} = '' OR dw.service = ${service || ''})
      AND (${alertLevel || ''} = '' OR s.alert_level = ${alertLevel || ''})
    ORDER BY COALESCE(s.percent_hp10, 0) DESC, dw.full_name
  `;

  const workers = await query;

  const stats = await safeQuery(async () => {
    const r = await sql`
      SELECT
        COUNT(DISTINCT dw.id) as total_workers,
        COUNT(DISTINCT CASE WHEN s.alert_level = 'warning' THEN dw.id END) as warning_count,
        COUNT(DISTINCT CASE WHEN s.alert_level = 'caution' THEN dw.id END) as caution_count,
        COUNT(DISTINCT CASE WHEN s.alert_level = 'exceeded' THEN dw.id END) as exceeded_count,
        COUNT(DISTINCT CASE WHEN s.alert_level = 'normal' OR s.alert_level IS NULL THEN dw.id END) as normal_count,
        ROUND(AVG(s.total_hp10_msv)::numeric, 3) as avg_hp10,
        ROUND(MAX(s.total_hp10_msv)::numeric, 3) as max_hp10,
        COUNT(DISTINCT CASE WHEN s.percent_hp10 >= 75 THEN dw.id END) as near_limit
      FROM dosimetry_workers dw
      LEFT JOIN dosimetry_annual_summary s ON s.worker_id = dw.id AND s.year = ${year}
      WHERE dw.active = true
    `;
    return r[0];
  }, { total_workers: 0, warning_count: 0, caution_count: 0, exceeded_count: 0, normal_count: 0, avg_hp10: 0, max_hp10: 0, near_limit: 0 });

  return NextResponse.json({ workers, stats, year });
}

export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { _type } = body;

  if (_type === "record") {
    const {
      worker_id, period_year, period_month, period_type = "monthly",
      hp10_msv, hp007_msv, hp3_msv, effective_dose_msv,
      read_date, read_by, dosimeter_id, service, area, status = "pending",
      anomaly, notes
    } = body;

    const result = await sql`
      INSERT INTO dosimetry_records (
        worker_id, period_year, period_month, period_type,
        hp10_msv, hp007_msv, hp3_msv, effective_dose_msv,
        read_date, read_by, dosimeter_id, service, area, status, anomaly, notes
      ) VALUES (
        ${worker_id}, ${period_year}, ${period_month}, ${period_type},
        ${hp10_msv || null}, ${hp007_msv || null}, ${hp3_msv || null}, ${effective_dose_msv || null},
        ${read_date || null}, ${read_by || null}, ${dosimeter_id || null},
        ${service || null}, ${area || null}, ${status}, ${anomaly || null}, ${notes || null}
      ) RETURNING *
    `;

    // Update annual summary
    await sql`
      INSERT INTO dosimetry_annual_summary (worker_id, year, total_hp10_msv, total_hp007_msv, total_effective_msv, limit_hp10_msv, limit_hp007_msv, limit_effective_msv, percent_hp10, percent_hp007, percent_effective, alert_level)
      SELECT
        ${worker_id}, ${period_year},
        COALESCE(SUM(r.hp10_msv), 0),
        COALESCE(SUM(r.hp007_msv), 0),
        COALESCE(SUM(COALESCE(r.effective_dose_msv, r.hp10_msv)), 0),
        20, 500, 20,
        ROUND((COALESCE(SUM(r.hp10_msv), 0) / 20 * 100)::numeric, 1),
        ROUND((COALESCE(SUM(r.hp007_msv), 0) / 500 * 100)::numeric, 1),
        ROUND((COALESCE(SUM(COALESCE(r.effective_dose_msv, r.hp10_msv)), 0) / 20 * 100)::numeric, 1),
        CASE
          WHEN COALESCE(SUM(r.hp10_msv), 0) > 20 THEN 'exceeded'
          WHEN COALESCE(SUM(r.hp10_msv), 0) / 20 * 100 >= 75 THEN 'warning'
          WHEN COALESCE(SUM(r.hp10_msv), 0) / 20 * 100 >= 50 THEN 'caution'
          ELSE 'normal'
        END
      FROM dosimetry_records r
      WHERE r.worker_id = ${worker_id} AND r.period_year = ${period_year} AND r.active = true
      ON CONFLICT (worker_id, year) DO UPDATE SET
        total_hp10_msv = EXCLUDED.total_hp10_msv,
        total_hp007_msv = EXCLUDED.total_hp007_msv,
        total_effective_msv = EXCLUDED.total_effective_msv,
        percent_hp10 = EXCLUDED.percent_hp10,
        percent_hp007 = EXCLUDED.percent_hp007,
        percent_effective = EXCLUDED.percent_effective,
        alert_level = EXCLUDED.alert_level
    `;

    return NextResponse.json(result[0], { status: 201 });
  }

  // Create worker
  const {
    worker_code, full_name, rut, role, service, category = "A",
    dosimeter_type = "tld", dosimeter_number, notes
  } = body;

  let code = worker_code;
  if (!code) {
    const last = await sql`SELECT worker_code FROM dosimetry_workers ORDER BY id DESC LIMIT 1`;
    if (last.length > 0) {
      const n = parseInt(last[0].worker_code.replace("TM-", "")) + 1;
      code = `TM-${String(n).padStart(3, "0")}`;
    } else {
      code = "TM-001";
    }
  }

  const result = await sql`
    INSERT INTO dosimetry_workers (worker_code, full_name, rut, role, service, category, dosimeter_type, dosimeter_number, notes)
    VALUES (${code}, ${full_name}, ${rut || null}, ${role || null}, ${service || null}, ${category}, ${dosimeter_type}, ${dosimeter_number || null}, ${notes || null})
    RETURNING *
  `;
  return NextResponse.json(result[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { id, _table = "worker", ...fields } = body;
  delete fields._type;

  const table = _table === "record" ? "dosimetry_records" : "dosimetry_workers";
  const sets = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k], i) => `"${k}" = $${i + 2}`)
    .join(", ");
  const vals = Object.values(fields).filter(v => v !== undefined);

  if (!sets) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const result = await sql.unsafe(
    `UPDATE ${table} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...vals]
  );
  return NextResponse.json(result[0]);
}

export async function DELETE(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const table = searchParams.get("table") === "record" ? "dosimetry_records" : "dosimetry_workers";

  await sql.unsafe(`UPDATE ${table} SET active = false WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
