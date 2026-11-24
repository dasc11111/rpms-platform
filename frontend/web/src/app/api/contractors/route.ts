// §160 — Control de Personal Externo y Contratistas POE
// DS 3/1985 Arts. 20-23 · CCHEN NS-05.0 §7.4 · IAEA GSR Part 3 Req. 24
// Registros de ingreso, dosis acumuladas, coordinación entre empleadores

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS contractors (
      id                  SERIAL PRIMARY KEY,
      rut                 VARCHAR(15) UNIQUE NOT NULL,
      full_name           TEXT NOT NULL,
      company             TEXT NOT NULL,
      company_rut         VARCHAR(15),
      role                TEXT,
      specialty           TEXT,
      -- specialty: physicist, engineer, technician, maintenance, installer, vendor
      contact_phone       TEXT,
      contact_email       TEXT,
      -- PR compliance fields
      has_dosimeter       BOOLEAN DEFAULT false,
      dosimeter_number    VARCHAR(30),
      has_pr_training     BOOLEAN DEFAULT false,
      pr_training_date    DATE,
      pr_training_expiry  DATE,
      has_medical_cert    BOOLEAN DEFAULT false,
      medical_cert_expiry DATE,
      -- Dose tracking
      annual_dose_mSv     NUMERIC(8,3) DEFAULT 0,
      cumulative_dose_mSv NUMERIC(8,3) DEFAULT 0,
      -- Access control
      authorized_areas    TEXT,
      -- comma-separated list
      status              VARCHAR(20) NOT NULL DEFAULT 'active',
      -- status: active, inactive, banned
      notes               TEXT,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS contractor_visits (
      id              SERIAL PRIMARY KEY,
      contractor_id   INTEGER NOT NULL REFERENCES contractors(id),
      visit_date      DATE NOT NULL,
      entry_time      TIME,
      exit_time       TIME,
      purpose         TEXT,
      areas_accessed  TEXT,
      supervisor      TEXT,
      dose_received_mSv NUMERIC(6,3),
      dosimeter_read  NUMERIC(6,3),
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const { rowCount } = await sql`SELECT 1 FROM contractors LIMIT 1`;
  if (!rowCount) {
    const refYear = new Date().getFullYear();

    await sql`
      INSERT INTO contractors
        (rut, full_name, company, company_rut, role, specialty,
         contact_phone, contact_email,
         has_dosimeter, dosimeter_number, has_pr_training, pr_training_date, pr_training_expiry,
         has_medical_cert, medical_cert_expiry, annual_dose_mSv, cumulative_dose_mSv,
         authorized_areas, status)
      VALUES
        ('12.456.789-0', 'Carlos Moreno Espinoza', 'TechMed Servicios', '76.123.456-7',
         'Físico Médico Consultor', 'physicist',
         '+56 9 8765 4321', 'c.moreno@techmed.cl',
         true, 'EXT-2024-TM-001', true, ${(refYear - 1) + '-09-10'}, ${(refYear + 2) + '-09-09'},
         true, ${(refYear + 1) + '-03-15'}, 1.2, 8.7,
         'Sala caliente, sala de calibración, sala de control RT', 'active'),

        ('15.789.012-3', 'Rodrigo Ibáñez Parra', 'Siemens Healthineers', '76.987.654-3',
         'Ingeniero de Servicio', 'engineer',
         '+56 9 7654 3210', 'r.ibanez@siemens.cl',
         true, 'EXT-2024-SH-002', true, ${(refYear - 1) + '-11-20'}, ${(refYear + 2) + '-11-19'},
         true, ${(refYear + 1) + '-06-30'}, 0.8, 4.2,
         'Sala PET-CT, sala de equipos', 'active'),

        ('18.234.567-8', 'Patricia Lagos Muñoz', 'Electro Maintenance SpA', '77.345.678-9',
         'Técnico Electromecánico', 'maintenance',
         '+56 9 6543 2109', 'p.lagos@electro.cl',
         false, null, false, null, null,
         false, null, 0.0, 0.0,
         null, 'active'),

        ('13.567.890-1', 'Felipe Contreras Rojas', 'Varian Medical', '76.456.789-0',
         'Especialista Acelerador Lineal', 'installer',
         '+56 9 5432 1098', 'f.contreras@varian.com',
         true, 'EXT-2025-VM-003', true, ${refYear + '-01-15'}, ${(refYear + 3) + '-01-14'},
         true, ${(refYear + 1) + '-12-31'}, 2.1, 15.3,
         'Búnker RT, sala de control RT, almacén técnico', 'active'),

        ('16.890.123-4', 'Javiera Muñoz Álvarez', 'Bracco Diagnostics', '76.789.012-1',
         'Representante Técnica de Productos', 'vendor',
         '+56 9 4321 0987', 'j.munoz@bracco.cl',
         false, null, true, ${(refYear - 1) + '-06-01'}, ${(refYear + 2) + '-05-31'},
         true, ${(refYear + 1) + '-06-15'}, 0.0, 0.3,
         'Sala caliente (acompañada)', 'active'),

        ('14.123.456-5', 'Andrés Vega Torres', 'Constructora GPC', '77.012.345-6',
         'Supervisor de Obra', 'technician',
         '+56 9 3210 9876', 'a.vega@gpc.cl',
         false, null, false, null, null,
         false, null, 0.0, 0.0,
         null, 'inactive')
    `;

    // Seed visits for active contractors
    const { rows: conts } = await sql`SELECT id FROM contractors WHERE status = 'active' AND has_dosimeter = true ORDER BY id LIMIT 3`;
    for (const c of conts) {
      await sql`
        INSERT INTO contractor_visits
          (contractor_id, visit_date, entry_time, exit_time, purpose, areas_accessed, supervisor, dose_received_mSv)
        VALUES
          (${c.id}, CURRENT_DATE - INTERVAL '30 days', '09:00', '14:30',
           'Mantención preventiva equipos', 'Sala técnica, sala de control', 'TM. Diego Solís', 0.12),
          (${c.id}, CURRENT_DATE - INTERVAL '7 days', '10:00', '17:00',
           'Visita técnica programada', 'Sala técnica', 'TM. Diego Solís', 0.08)
      `;
    }
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const summary = searchParams.get("summary");

  if (summary) {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active_contractors,
        COUNT(*) FILTER (WHERE status = 'active' AND NOT has_dosimeter) AS missing_dosimeter,
        COUNT(*) FILTER (WHERE status = 'active' AND NOT has_pr_training) AS missing_training,
        COUNT(*) FILTER (WHERE status = 'active' AND pr_training_expiry < CURRENT_DATE) AS expired_training,
        COUNT(*) FILTER (WHERE status = 'active' AND NOT has_medical_cert) AS missing_medical,
        COUNT(*) FILTER (WHERE status = 'active' AND medical_cert_expiry < CURRENT_DATE) AS expired_medical,
        COUNT(*) FILTER (WHERE status = 'active' AND annual_dose_mSv > 15) AS above_75pct_limit
      FROM contractors
    `;
    return NextResponse.json({ stats: rows[0] });
  }

  if (id) {
    const { rows: cont } = await sql`SELECT * FROM contractors WHERE id = ${Number(id)}`;
    if (!cont.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { rows: visits } = await sql`
      SELECT * FROM contractor_visits WHERE contractor_id = ${Number(id)} ORDER BY visit_date DESC LIMIT 20
    `;
    return NextResponse.json({ contractor: cont[0], visits });
  }

  const { rows } = await sql`
    SELECT c.*,
      COUNT(v.id) FILTER (WHERE v.visit_date >= DATE_TRUNC('year', CURRENT_DATE)) AS visits_this_year,
      MAX(v.visit_date) AS last_visit_date
    FROM contractors c
    LEFT JOIN contractor_visits v ON v.contractor_id = c.id
    WHERE c.status != 'banned'
    GROUP BY c.id
    ORDER BY
      CASE c.status WHEN 'active' THEN 0 ELSE 1 END,
      c.company, c.full_name
  `;

  // Compliance flags
  const withFlags = rows.map(c => ({
    ...c,
    compliance_issues: [
      !c.has_dosimeter && c.status === "active" ? "Sin dosímetro" : null,
      !c.has_pr_training && c.status === "active" ? "Sin capacitación PR" : null,
      c.pr_training_expiry && new Date(c.pr_training_expiry) < new Date() ? "Capacitación PR vencida" : null,
      !c.has_medical_cert && c.status === "active" ? "Sin certificado médico" : null,
      c.medical_cert_expiry && new Date(c.medical_cert_expiry) < new Date() ? "Cert. médico vencido" : null,
      Number(c.annual_dose_mSv) > 15 ? `Dosis anual alta (${Number(c.annual_dose_mSv).toFixed(1)} mSv)` : null,
    ].filter(Boolean),
  }));

  return NextResponse.json({ contractors: withFlags });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();

  // Log visit
  if (body.contractor_id && body.visit_date) {
    const { rows } = await sql`
      INSERT INTO contractor_visits
        (contractor_id, visit_date, entry_time, exit_time, purpose, areas_accessed, supervisor, dose_received_mSv, notes)
      VALUES
        (${body.contractor_id}, ${body.visit_date}, ${body.entry_time ?? null}, ${body.exit_time ?? null},
         ${body.purpose ?? null}, ${body.areas_accessed ?? null}, ${body.supervisor ?? null},
         ${body.dose_received_mSv ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    // Update annual dose if provided
    if (body.dose_received_mSv) {
      await sql`
        UPDATE contractors SET
          annual_dose_mSv = annual_dose_mSv + ${Number(body.dose_received_mSv)},
          cumulative_dose_mSv = cumulative_dose_mSv + ${Number(body.dose_received_mSv)},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${body.contractor_id}
      `;
    }
    return NextResponse.json({ visit: rows[0] }, { status: 201 });
  }

  // Create contractor
  const { rows } = await sql`
    INSERT INTO contractors
      (rut, full_name, company, company_rut, role, specialty, contact_phone, contact_email,
       has_dosimeter, dosimeter_number, has_pr_training, pr_training_date, pr_training_expiry,
       has_medical_cert, medical_cert_expiry, authorized_areas, notes)
    VALUES
      (${body.rut}, ${body.full_name}, ${body.company}, ${body.company_rut ?? null},
       ${body.role ?? null}, ${body.specialty ?? null},
       ${body.contact_phone ?? null}, ${body.contact_email ?? null},
       ${body.has_dosimeter ?? false}, ${body.dosimeter_number ?? null},
       ${body.has_pr_training ?? false}, ${body.pr_training_date ?? null}, ${body.pr_training_expiry ?? null},
       ${body.has_medical_cert ?? false}, ${body.medical_cert_expiry ?? null},
       ${body.authorized_areas ?? null}, ${body.notes ?? null})
    RETURNING *
  `;
  return NextResponse.json({ contractor: rows[0] }, { status: 201 });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json();

  await sql`
    UPDATE contractors SET
      has_dosimeter       = COALESCE(${body.has_dosimeter ?? null}::boolean, has_dosimeter),
      dosimeter_number    = COALESCE(${body.dosimeter_number ?? null}, dosimeter_number),
      has_pr_training     = COALESCE(${body.has_pr_training ?? null}::boolean, has_pr_training),
      pr_training_date    = COALESCE(${body.pr_training_date ?? null}::date, pr_training_date),
      pr_training_expiry  = COALESCE(${body.pr_training_expiry ?? null}::date, pr_training_expiry),
      has_medical_cert    = COALESCE(${body.has_medical_cert ?? null}::boolean, has_medical_cert),
      medical_cert_expiry = COALESCE(${body.medical_cert_expiry ?? null}::date, medical_cert_expiry),
      authorized_areas    = COALESCE(${body.authorized_areas ?? null}, authorized_areas),
      status              = COALESCE(${body.status ?? null}, status),
      notes               = COALESCE(${body.notes ?? null}, notes),
      updated_at          = CURRENT_TIMESTAMP
    WHERE id = ${Number(id)}
  `;
  const { rows } = await sql`SELECT * FROM contractors WHERE id = ${Number(id)}`;
  return NextResponse.json({ contractor: rows[0] });
}
