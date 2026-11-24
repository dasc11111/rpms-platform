// §159 — Gestión de Licencias y Autorizaciones CCHEN
// DS 3/1985 Arts. 7-14 · CCHEN NS-05.0 §3 · Reglamento de Licencias CCHEN
// Control de vencimientos, renovaciones, alertas anticipadas

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_licenses (
      id                SERIAL PRIMARY KEY,
      license_number    VARCHAR(50) UNIQUE,
      license_type      VARCHAR(40) NOT NULL,
      -- license_type: facility_operation, source_registration, personnel_qualification,
      --   equipment_authorization, transport, waste_management
      holder_name       TEXT NOT NULL,
      holder_rut        VARCHAR(15),
      facility_name     TEXT,
      scope             TEXT,
      -- What is authorized
      conditions        TEXT,
      issue_date        DATE NOT NULL,
      expiry_date       DATE NOT NULL,
      renewal_lead_days INTEGER DEFAULT 90,
      -- How many days before expiry to start renewal process
      status            VARCHAR(20) NOT NULL DEFAULT 'active',
      -- status: active, expired, suspended, cancelled, renewal_in_progress
      cchen_contact     TEXT,
      renewal_submitted_date DATE,
      renewal_code      VARCHAR(30),
      notes             TEXT,
      last_inspection   DATE,
      next_inspection   DATE,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS license_renewal_log (
      id              SERIAL PRIMARY KEY,
      license_id      INTEGER NOT NULL REFERENCES cchen_licenses(id),
      action          VARCHAR(30) NOT NULL,
      -- action: renewal_started, documents_submitted, inspection_scheduled, renewed, rejected, suspended
      action_date     DATE NOT NULL,
      performed_by    TEXT,
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const { rowCount } = await sql`SELECT 1 FROM cchen_licenses LIMIT 1`;
  if (!rowCount) {
    const curYear = new Date().getFullYear();

    await sql`
      INSERT INTO cchen_licenses
        (license_number, license_type, holder_name, holder_rut, facility_name, scope,
         conditions, issue_date, expiry_date, renewal_lead_days, status, cchen_contact, last_inspection, next_inspection)
      VALUES
        ('LIC-OP-' || ${curYear - 2} || '-MN-0124',
         'facility_operation',
         'Hospital Dr. Hernán Henríquez Aravena',
         '61.606.700-5',
         'Servicio de Medicina Nuclear',
         'Operación de instalación de medicina nuclear: diagnóstico con Tc-99m, I-131, Ga-67, F-18; terapia con I-131 y Lu-177',
         'Dosis máx. POE: 20 mSv/año. Informe semestral a CCHEN. Encargado PR calificado. Plan emergencias vigente.',
         (${curYear - 2} || '-04-01')::date,
         (${curYear + 1} || '-03-31')::date,
         90, 'active', 'inspector.mn@cchen.cl',
         (${curYear - 1} || '-09-15')::date,
         (${curYear} || '-09-15')::date),

        ('LIC-OP-' || ${curYear - 3} || '-RT-0089',
         'facility_operation',
         'Hospital Dr. Hernán Henríquez Aravena',
         '61.606.700-5',
         'Servicio de Radioterapia',
         'Operación de instalación de radioterapia: acelerador lineal VARIAN, braquiterapia HDR Ir-192',
         'Mapa radiológico vigente. Blindajes anuales verificados. Personal con licencias individuales vigentes.',
         (${curYear - 3} || '-07-01')::date,
         (${curYear} || '-06-30')::date,
         120, 'renewal_in_progress', 'inspector.rt@cchen.cl',
         (${curYear - 1} || '-07-10')::date,
         (${curYear} || '-07-10')::date),

        ('LIC-SRC-' || ${curYear - 1} || '-CS137-001',
         'source_registration',
         'Hospital Dr. Hernán Henríquez Aravena',
         '61.606.700-5',
         null,
         'Uso de fuente sellada Cs-137 (Cat. 2) — calibración de equipos de medición',
         'Almacenamiento en contenedor blindado homologado. Pruebas de fuga cada 6 meses. Inventario anual CCHEN.',
         (${curYear - 1} || '-03-01')::date,
         (${curYear - 1} || '-02-28')::date,
         60, 'expired', 'fuentes@cchen.cl', null, null),

        ('LIC-PQ-' || ${curYear - 1} || '-EPR-0045',
         'personnel_qualification',
         'TM. Diego Armando Solís Catalán',
         '16.397.583-1',
         null,
         'Encargado de Protección Radiológica — instalaciones médicas Categoría B',
         'Actualización de competencias cada 3 años. Acreditación CCHEN vigente.',
         (${curYear - 1} || '-01-10')::date,
         (${curYear + 2} || '-01-09')::date,
         60, 'active', 'capacitacion@cchen.cl', null, null),

        ('LIC-EQ-' || ${curYear - 2} || '-PET-0033',
         'equipment_authorization',
         'Hospital Dr. Hernán Henríquez Aravena',
         '61.606.700-5',
         'Servicio PET-CT',
         'Autorización de operación — equipo PET-CT Siemens Biograph mCT 64',
         'Calibración anual obligatoria. Informe de mantenimiento preventivo semestral.',
         (${curYear - 2} || '-11-15')::date,
         (${curYear + 1} || '-11-14')::date,
         60, 'active', 'equipos@cchen.cl',
         (${curYear - 1} || '-11-20')::date,
         (${curYear} || '-11-20')::date),

        ('LIC-WM-' || ${curYear - 1} || '-RM-0012',
         'waste_management',
         'Hospital Dr. Hernán Henríquez Aravena',
         '61.606.700-5',
         null,
         'Gestión de residuos radiactivos — decay-in-storage y envío a CCHEN. Incluye efluentes líquidos y sólidos.',
         'Registros de residuos cada 3 meses. Envío a CCHEN según protocolo NS-05.0 §9.',
         (${curYear - 1} || '-05-01')::date,
         (${curYear + 2} || '-04-30')::date,
         90, 'active', 'residuos@cchen.cl',
         (${curYear} || '-01-10')::date,
         (${curYear + 1} || '-01-10')::date)
    `;

    // Seed renewal log for the renewal_in_progress license
    const { rows } = await sql`SELECT id FROM cchen_licenses WHERE status = 'renewal_in_progress'`;
    if (rows.length) {
      await sql`
        INSERT INTO license_renewal_log (license_id, action, action_date, performed_by, notes)
        VALUES
          (${rows[0].id}, 'renewal_started',       CURRENT_DATE - INTERVAL '45 days', 'TM. Diego Solís', 'Inicio proceso de renovación. Documentación recopilada.'),
          (${rows[0].id}, 'documents_submitted',   CURRENT_DATE - INTERVAL '30 days', 'TM. Diego Solís', 'Expediente de renovación presentado en CCHEN. Código ingreso: REN-2026-0847'),
          (${rows[0].id}, 'inspection_scheduled',  CURRENT_DATE - INTERVAL '10 days', 'CCHEN', 'Inspección programada para ' || CURRENT_DATE + INTERVAL '20 days')
      `;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

function alertLevel(daysLeft: number, renewalLeadDays: number, status: string): string {
  if (status === "expired") return "critical";
  if (status === "renewal_in_progress") return "info";
  if (daysLeft < 0) return "critical";
  if (daysLeft <= 30) return "critical";
  if (daysLeft <= renewalLeadDays) return "warning";
  return "ok";
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
        COUNT(*) FILTER (WHERE status = 'active') AS active_licenses,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired_licenses,
        COUNT(*) FILTER (WHERE status = 'renewal_in_progress') AS renewals_in_progress,
        COUNT(*) FILTER (WHERE status = 'active' AND expiry_date < CURRENT_DATE + INTERVAL '90 days') AS expiring_90d,
        COUNT(*) FILTER (WHERE status = 'active' AND expiry_date < CURRENT_DATE + INTERVAL '30 days') AS expiring_30d
      FROM cchen_licenses
    `;
    return NextResponse.json({ stats: rows[0] });
  }

  if (id) {
    const { rows: lic } = await sql`SELECT * FROM cchen_licenses WHERE id = ${Number(id)}`;
    if (!lic.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { rows: log } = await sql`
      SELECT * FROM license_renewal_log WHERE license_id = ${Number(id)} ORDER BY action_date DESC
    `;
    return NextResponse.json({ license: lic[0], log });
  }

  const { rows } = await sql`
    SELECT * FROM cchen_licenses ORDER BY expiry_date ASC
  `;

  const withComputed = rows.map(l => {
    const days = daysUntilExpiry(l.expiry_date);
    return {
      ...l,
      days_until_expiry: days,
      alert_level: alertLevel(days, Number(l.renewal_lead_days), l.status),
    };
  });

  return NextResponse.json({ licenses: withComputed });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();

  // If logging a renewal action
  if (body.license_id && body.action) {
    const { rows } = await sql`
      INSERT INTO license_renewal_log (license_id, action, action_date, performed_by, notes)
      VALUES (${body.license_id}, ${body.action}, ${body.action_date ?? new Date().toISOString().split("T")[0]}, ${body.performed_by ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    // Update license status if relevant
    if (body.action === "renewal_started") {
      await sql`UPDATE cchen_licenses SET status = 'renewal_in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ${body.license_id}`;
    }
    if (body.action === "renewed") {
      await sql`UPDATE cchen_licenses SET status = 'active', renewal_submitted_date = null, renewal_code = null, updated_at = CURRENT_TIMESTAMP WHERE id = ${body.license_id}`;
    }
    return NextResponse.json({ log: rows[0] }, { status: 201 });
  }

  // Create new license
  const { rows } = await sql`
    INSERT INTO cchen_licenses
      (license_number, license_type, holder_name, holder_rut, facility_name, scope, conditions,
       issue_date, expiry_date, renewal_lead_days, status, cchen_contact, notes)
    VALUES
      (${body.license_number ?? null}, ${body.license_type}, ${body.holder_name},
       ${body.holder_rut ?? null}, ${body.facility_name ?? null},
       ${body.scope ?? null}, ${body.conditions ?? null},
       ${body.issue_date}, ${body.expiry_date},
       ${body.renewal_lead_days ?? 90}, ${'active'},
       ${body.cchen_contact ?? null}, ${body.notes ?? null})
    RETURNING *
  `;
  return NextResponse.json({ license: rows[0] }, { status: 201 });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  await sql`
    UPDATE cchen_licenses SET
      status                 = COALESCE(${body.status ?? null}, status),
      expiry_date            = COALESCE(${body.expiry_date ?? null}::date, expiry_date),
      renewal_submitted_date = COALESCE(${body.renewal_submitted_date ?? null}::date, renewal_submitted_date),
      renewal_code           = COALESCE(${body.renewal_code ?? null}, renewal_code),
      last_inspection        = COALESCE(${body.last_inspection ?? null}::date, last_inspection),
      next_inspection        = COALESCE(${body.next_inspection ?? null}::date, next_inspection),
      notes                  = COALESCE(${body.notes ?? null}, notes),
      updated_at             = CURRENT_TIMESTAMP
    WHERE id = ${Number(id)}
  `;
  const { rows } = await sql`SELECT * FROM cchen_licenses WHERE id = ${Number(id)}`;
  return NextResponse.json({ license: rows[0] });
}
